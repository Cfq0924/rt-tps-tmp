/**
 * Minimal C-STORE SCU (Phase 4 M5, offline spike).
 *
 * One association per file: propose the file's own transfer syntax, stream
 * command set + dataset as P-DATA PDVs sized to the peer's max PDU length,
 * await the C-STORE-RSP, then release. Datasets are forwarded byte-exact
 * (no re-encoding) — conformance scope documented in M5 notes.
 */
import net from 'net';
import { readPart10Meta, buildCStoreRq, parseCommandSet, commandField, status } from './commandSet.js';
import { buildAssociateRq, parseAssociateAc, buildPDataTf, buildSimplePdu, pduReader, PDU } from './pdu.js';

const EXPLICIT_LE = '1.2.840.10008.1.2.1';
const IMPLICIT_LE = '1.2.840.10008.1.2';

/**
 * Send one stored DICOM file to a remote SCP via C-STORE.
 * @param {Object} params
 * @param {string} params.host
 * @param {number} params.port
 * @param {string} params.calledAet
 * @param {string} [params.callingAet] - defaults to 'MYTPS'
 * @param {Buffer} params.fileBuf - complete Part-10 file
 * @param {number} [params.timeoutMs] - per-step socket timeout
 * @returns {Promise<{ok:boolean, status?:number, detail:string, transferSyntaxUid?:string}>}
 */
export function sendCStore({
  host, port, calledAet, callingAet = 'MYTPS', fileBuf, timeoutMs = 15000,
  sopClassUid = null, sopInstanceUid = null,
}) {
  return new Promise((resolve) => {
    const meta = readPart10Meta(fileBuf);
    if (!meta) {
      resolve({ ok: false, detail: 'not a Part-10 DICOM file (missing DICM preamble)' });
      return;
    }
    // some writers omit the MediaStorage UIDs in the Part-10 meta header —
    // fall back to the database-known values instead of failing the file
    meta.sopClassUid = meta.sopClassUid ?? sopClassUid;
    meta.sopInstanceUid = meta.sopInstanceUid ?? sopInstanceUid;
    if (!meta.sopClassUid || !meta.sopInstanceUid) {
      resolve({ ok: false, detail: 'file meta header lacks MediaStorageSOPClass/InstanceUID and no fallback known' });
      return;
    }

    const socket = net.createConnection({ host, port });
    socket.setTimeout(timeoutMs);
    const reader = pduReader();
    let pcId = 1;
    let settled = false;
    const finish = (r) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(r);
    };
    const fail = (detail) => finish({ ok: false, detail });

    socket.on('error', err => fail(`socket: ${err.message}`));
    socket.on('timeout', () => fail('socket timeout'));

    socket.on('connect', () => {
      socket.write(buildAssociateRq({
        calledAet,
        callingAet,
        presentationContexts: [{
          id: pcId,
          abstractSyntax: meta.sopClassUid,
          transferSyntaxes: [meta.transferSyntaxUid, EXPLICIT_LE, IMPLICIT_LE].filter((v, i, a) => a.indexOf(v) === i),
        }],
      }));
    });

    socket.on('data', chunk => reader.push(chunk));

    (async () => {
      // A-ASSOCIATE-AC
      const ac = await reader.next(timeoutMs);
      if (ac.type !== PDU.A_ASSOCIATE_AC) {
        fail(`expected A-ASSOCIATE-AC, got PDU type ${ac.type}`);
        return;
      }
      const { accepted, maxLength } = parseAssociateAc(ac.body);
      const ts = accepted.get(pcId);
      if (!ts) {
        fail('presentation context rejected by the peer');
        return;
      }

      // C-STORE-RQ command set + dataset as PDVs
      const command = buildCStoreRq({
        messageId: 1,
        sopClassUid: meta.sopClassUid,
        sopInstanceUid: meta.sopInstanceUid,
      });
      const chunkSize = Math.max(1024, Math.min(16352, maxLength - 6 - 6));
      const pdvs = [{ pcId, header: 0x03, data: command }]; // 0x03: last command fragment
      const dataset = fileBuf.subarray(meta.datasetOffset);
      for (let off = 0; off < dataset.length; off += chunkSize) {
        const chunk = dataset.subarray(off, Math.min(dataset.length, off + chunkSize));
        const last = off + chunkSize >= dataset.length;
        pdvs.push({ pcId, header: last ? 0x02 : 0x00, data: chunk });
      }
      if (dataset.length === 0) {
        pdvs.push({ pcId, header: 0x02, data: Buffer.alloc(0) });
      }
      // one P-DATA-TF per PDV keeps PDU sizes within the negotiated maximum
      for (const pdv of pdvs) {
        socket.write(buildPDataTf([pdv]));
      }

      // C-STORE-RSP
      for (;;) {
        const rsp = await reader.next(timeoutMs);
        if (rsp.type === PDU.P_DATA_TF) {
          // parse command set from PDVs
          let off = 0;
          let parsed = null;
          while (off + 6 <= rsp.body.length) {
            const len = rsp.body.readUInt32BE(off);
            const pcRsp = rsp.body.readUInt8(off + 4);
            const headerByte = rsp.body.readUInt8(off + 5);
            const data = rsp.body.subarray(off + 6, off + 4 + len);
            if (pcRsp === pcId && (headerByte & 0x01)) {
              parsed = parseCommandSet(data);
            }
            off += 4 + len;
          }
          if (parsed && commandField(parsed) === 0x8001) {
            const st = status(parsed);
            if (st !== 0) {
              fail(`C-STORE failed with status 0x${st.toString(16)}`);
              return;
            }
            socket.write(buildSimplePdu(PDU.A_RELEASE_RQ));
          }
        } else if (rsp.type === PDU.A_RELEASE_RP) {
          finish({ ok: true, status: 0, detail: 'stored', transferSyntaxUid: ts });
          return;
        } else if (rsp.type === PDU.A_ABORT) {
          fail('association aborted by the peer');
          return;
        }
      }
    })().catch(err => fail(`protocol: ${err.message}`));
  });
}
