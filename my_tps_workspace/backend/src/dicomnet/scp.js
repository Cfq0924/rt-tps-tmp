/**
 * Minimal C-STORE SCP — test double for a PACS (Phase 4 M5 integration
 * tests). Accepts associations, accepts every proposed presentation context
 * with its first transfer syntax, receives C-STORE datasets and hands them
 * to an `onStore` callback. Not a production receiver.
 */
import net from 'net';
import { buildAssociateRq, parseAssociateAc, buildPDataTf, buildSimplePdu, pduReader, PDU } from './pdu.js';
import { buildCStoreRsp, parseCommandSet, commandField, messageID, affectedSopClassUid, affectedSopInstanceUid } from './commandSet.js';

export class MiniStoreScp {
  /**
   * @param {Object} [opts]
   * @param {string} [opts.aet] - our AE title
   * @param {Function} [opts.onStore] - async ({sopClassUid, sopInstanceUid, transferSyntaxUid, dataset:Buffer}) => void
   */
  constructor({ aet = 'TESTPACS', onStore } = {}) {
    this.aet = aet;
    this.onStore = onStore;
    this.received = [];
    this.server = null;
    this.port = null;
  }

  /** Start listening on an ephemeral port; resolves with the assigned port. */
  listen() {
    return new Promise((resolve, reject) => {
      this.server = net.createServer(socket => this._handle(socket));
      this.server.on('error', reject);
      this.server.listen(0, '127.0.0.1', () => {
        this.port = this.server.address().port;
        resolve(this.port);
      });
    });
  }

  close() {
    return new Promise(resolve => this.server?.close(() => resolve()));
  }

  _handle(socket) {
    const reader = pduReader();
    const assoc = { pcTs: new Map(), pending: null };

    socket.on('error', () => {});
    socket.on('data', chunk => reader.push(chunk));

    (async () => {
      for (;;) {
        const pdu = await reader.next(30000);
        if (pdu.type === PDU.A_ASSOCIATE_RQ) {
          // accept every proposed presentation context with its first TS
          const body = pdu.body;
          const pcs = [];
          let off = 68;
          while (off + 4 <= body.length) {
            const type = body.readUInt8(off);
            const len = body.readUInt16BE(off + 2);
            const item = body.subarray(off + 4, off + 4 + len);
            if (type === 0x20) { // presentation context RQ
              const id = item.readUInt8(0);
              let u = 4;
              let abstract = null;
              let firstTs = null;
              while (u + 4 <= item.length) {
                const st = item.readUInt8(u);
                const sl = item.readUInt16BE(u + 2);
                const sv = item.subarray(u + 4, u + 4 + sl).toString('ascii').trim();
                if (st === 0x30) abstract = sv;
                if (st === 0x40 && firstTs == null) firstTs = sv;
                u += 4 + sl;
              }
              if (abstract) pcs.push({ id, abstract, ts: firstTs ?? '1.2.840.10008.1.2' });
            }
            off += 4 + len;
          }
          const acItems = [];
          for (const pc of pcs) {
            assoc.pcTs.set(pc.id, pc.ts);
            const inner = Buffer.alloc(4 + pc.ts.length);
            inner.writeUInt8(pc.id, 0);
            inner.writeUInt8(0, 1); // accepted
            Buffer.from(pc.ts, 'ascii').copy(inner, 4);
            const item = Buffer.alloc(4 + inner.length);
            item.writeUInt8(0x21, 0);
            item.writeUInt16BE(inner.length, 2);
            inner.copy(item, 4);
            acItems.push(item);
          }
          const maxLen = Buffer.alloc(4);
          maxLen.writeUInt32BE(65536, 0);
          const ui = Buffer.concat([
            (() => { const b = Buffer.alloc(8); b.writeUInt8(0x51, 0); b.writeUInt16BE(4, 2); maxLen.copy(b, 4); return b; })(),
            (() => {
              const uid = Buffer.from('2.25.99', 'ascii');
              const b = Buffer.alloc(8 + uid.length); b.writeUInt8(0x52, 0); b.writeUInt16BE(uid.length, 2); uid.copy(b, 4); return b;
            })(),
          ]);
          const uiItem = Buffer.alloc(4 + ui.length);
          uiItem.writeUInt8(0x50, 0);
          uiItem.writeUInt16BE(ui.length, 2);
          ui.copy(uiItem, 4);
          acItems.push(uiItem);

          const fixed = Buffer.alloc(68);
          fixed.writeUInt16BE(1, 0);
          const variable = Buffer.concat(acItems);
          const header = Buffer.alloc(6);
          header.writeUInt8(PDU.A_ASSOCIATE_AC, 0);
          header.writeUInt32BE(fixed.length + variable.length, 2);
          socket.write(Buffer.concat([header, fixed, variable]));
        } else if (pdu.type === PDU.P_DATA_TF) {
          let off = 0;
          while (off + 6 <= pdu.body.length) {
            const len = pdu.body.readUInt32BE(off);
            const pcId = pdu.body.readUInt8(off + 4);
            const headerByte = pdu.body.readUInt8(off + 5);
            const data = Buffer.from(pdu.body.subarray(off + 6, off + 4 + len));
            off += 4 + len;
            if (headerByte & 0x01) {
              // last command fragment → C-STORE-RQ
              const cmd = parseCommandSet(data);
              assoc.pending = {
                pcId,
                messageId: messageID(cmd),
                sopClassUid: affectedSopClassUid(cmd),
                sopInstanceUid: affectedSopInstanceUid(cmd),
                ts: assoc.pcTs.get(pcId),
                chunks: [],
              };
            } else {
              // dataset fragment
              if (!assoc.pending) continue;
              assoc.pending.chunks.push(data);
              if (headerByte & 0x02) {
                const p = assoc.pending;
                assoc.pending = null;
                const dataset = Buffer.concat(p.chunks);
                this.received.push({
                  sopClassUid: p.sopClassUid,
                  sopInstanceUid: p.sopInstanceUid,
                  transferSyntaxUid: p.ts,
                  dataset,
                });
                await this.onStore?.({
                  sopClassUid: p.sopClassUid,
                  sopInstanceUid: p.sopInstanceUid,
                  transferSyntaxUid: p.ts,
                  dataset,
                });
                const rsp = buildCStoreRsp({
                  messageId: p.messageId,
                  sopClassUid: p.sopClassUid,
                  sopInstanceUid: p.sopInstanceUid,
                  status: 0,
                });
                socket.write(buildPDataTf([{ pcId: p.pcId, header: 0x03, data: rsp }]));
              }
            }
          }
        } else if (pdu.type === PDU.A_RELEASE_RQ) {
          socket.write(buildSimplePdu(PDU.A_RELEASE_RP));
          socket.end();
          return;
        } else if (pdu.type === PDU.A_ABORT) {
          socket.destroy();
          return;
        }
      }
    })().catch(() => socket.destroy());
  }
}

// re-export for the SCU's convenience in tests
export { buildAssociateRq, parseAssociateAc };
