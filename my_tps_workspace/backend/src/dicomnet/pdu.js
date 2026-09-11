/**
 * Minimal DICOM upper-layer (PS3.8) PDU encoding/parsing for C-STORE.
 *
 * Scope (Phase 4 M5 spike, offline environment): enough conformance to push
 * stored DICOM files to a PACS as a C-STORE SCU, plus a tiny SCP used in the
 * integration tests. Only the file's own transfer syntax is proposed —
 * datasets are forwarded as stored, never re-encoded.
 *
 * All multi-byte integers are little-endian per PS3.8 unless noted.
 */

export const PDU = {
  A_ASSOCIATE_RQ: 0x01,
  A_ASSOCIATE_AC: 0x02,
  A_ASSOCIATE_RJ: 0x03,
  P_DATA_TF: 0x04,
  A_RELEASE_RQ: 0x05,
  A_RELEASE_RP: 0x06,
  A_ABORT: 0x07,
};

const ITEM = {
  APPLICATION_CONTEXT: 0x10,
  PRESENTATION_CONTEXT_RQ: 0x20,
  PRESENTATION_CONTEXT_AC: 0x21,
  ABSTRACT_SYNTAX: 0x30,
  TRANSFER_SYNTAX: 0x40,
  USER_INFORMATION: 0x50,
  MAX_LENGTH_RECEIVED: 0x51,
  IMPLEMENTATION_CLASS_UID: 0x52,
};

const IMPL_CLASS_UID = '2.25.109823402912736120198374652983746';

function encodeItem(type, payload) {
  const buf = Buffer.alloc(4 + payload.length);
  buf.writeUInt8(type, 0);
  buf.writeUInt8(0, 1);
  buf.writeUInt16BE(payload.length, 2);
  payload.copy(buf, 4);
  return buf;
}

function uidBuffer(uid) {
  return Buffer.from(String(uid), 'ascii');
}

/**
 * Build an A-ASSOCIATE-RQ PDU proposing one presentation context per
 * (id, abstractSyntax, [transferSyntaxes]) tuple.
 */
export function buildAssociateRq({ calledAet, callingAet, presentationContexts }) {
  const fixed = Buffer.alloc(68);
  fixed.writeUInt16BE(0x0001, 0); // protocol version 1
  fixed.write(calledAet.padEnd(16, ' ').slice(0, 16), 4, 'ascii');
  fixed.write(callingAet.padEnd(16, ' ').slice(0, 16), 20, 'ascii');

  const items = [encodeItem(ITEM.APPLICATION_CONTEXT, uidBuffer('1.2.840.10008.3.1.1.1'))];
  for (const pc of presentationContexts) {
    const inner = Buffer.concat([
      encodeItem(ITEM.ABSTRACT_SYNTAX, uidBuffer(pc.abstractSyntax)),
      ...pc.transferSyntaxes.map(ts => encodeItem(ITEM.TRANSFER_SYNTAX, uidBuffer(ts))),
    ]);
    const pcItem = Buffer.alloc(8 + inner.length);
    pcItem.writeUInt8(ITEM.PRESENTATION_CONTEXT_RQ, 0);
    pcItem.writeUInt16BE(inner.length + 4, 2);
    pcItem.writeUInt8(pc.id, 4);
    inner.copy(pcItem, 8);
    items.push(pcItem);
  }

  const maxLen = Buffer.alloc(4);
  maxLen.writeUInt32BE(16384, 0);
  const userInfo = Buffer.concat([
    encodeItem(ITEM.MAX_LENGTH_RECEIVED, maxLen),
    encodeItem(ITEM.IMPLEMENTATION_CLASS_UID, uidBuffer(IMPL_CLASS_UID)),
  ]);
  items.push(encodeItem(ITEM.USER_INFORMATION, userInfo));

  const variable = Buffer.concat(items);
  const header = Buffer.alloc(6);
  header.writeUInt8(PDU.A_ASSOCIATE_RQ, 0);
  header.writeUInt32BE(fixed.length + variable.length, 2);
  return Buffer.concat([header, fixed, variable]);
}

/**
 * Parse an A-ASSOCIATE-AC PDU body (after the 6-byte PDU header).
 * @returns {{accepted: Map<number, string>, maxLength: number}} accepted
 *   presentation context id → transfer syntax UID, peer max PDU length
 */
export function parseAssociateAc(body) {
  const accepted = new Map();
  let maxLength = 16384;
  let off = 68; // fixed portion: version(4) + called(16) + calling(16) + reserved(32)
  while (off + 4 <= body.length) {
    const type = body.readUInt8(off);
    const len = body.readUInt16BE(off + 2);
    const item = body.subarray(off + 4, off + 4 + len);
    if (type === ITEM.PRESENTATION_CONTEXT_AC) {
      const id = item.readUInt8(0);
      const result = item.readUInt8(1);
      const ts = item.subarray(4).toString('ascii').trim();
      if (result === 0) accepted.set(id, ts);
    } else if (type === ITEM.USER_INFORMATION) {
      let u = 0;
      while (u + 4 <= item.length) {
        const ut = item.readUInt8(u);
        const ul = item.readUInt16BE(u + 2);
        if (ut === ITEM.MAX_LENGTH_RECEIVED && ul === 4) {
          maxLength = item.readUInt32BE(u + 4);
        }
        u += 4 + ul;
      }
    }
    off += 4 + len;
  }
  return { accepted, maxLength };
}

/** Encode one P-DATA-TF PDU carrying the given PDVs ({pcId, header, data}). */
export function buildPDataTf(pdvs) {
  const items = pdvs.map(({ pcId, header, data }) => {
    const item = Buffer.alloc(6 + data.length);
    item.writeUInt32BE(2 + data.length, 0);
    item.writeUInt8(pcId, 4);
    item.writeUInt8(header, 5);
    data.copy(item, 6);
    return item;
  });
  const payload = Buffer.concat(items);
  const header = Buffer.alloc(6);
  header.writeUInt8(PDU.P_DATA_TF, 0);
  header.writeUInt32BE(payload.length, 2);
  return Buffer.concat([header, payload]);
}

/** Encode a bare PDU (A-RELEASE-RQ/RP, A-ABORT — 4 reserved trailing bytes). */
export function buildSimplePdu(type) {
  return Buffer.from([type, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
}

/** Incremental PDU splitter: push socket chunks, await complete PDUs. */
export function pduReader() {
  const queue = [];
  let buf = Buffer.alloc(0);
  let pending = null;
  function tryParse() {
    while (buf.length >= 6) {
      const len = buf.readUInt32BE(2);
      if (buf.length < 6 + len) break;
      const type = buf.readUInt8(0);
      const body = Buffer.from(buf.subarray(6, 6 + len));
      buf = buf.subarray(6 + len);
      if (pending) { const r = pending; pending = null; r({ type, body }); }
      else queue.push({ type, body });
    }
  }
  return {
    push(chunk) {
      buf = Buffer.concat([buf, chunk]);
      tryParse();
    },
    async next(timeoutMs = 30000) {
      tryParse();
      if (queue.length) return queue.shift();
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          if (pending === waiter) pending = null;
          reject(new Error('PDU read timeout'));
        }, timeoutMs);
        const waiter = (v) => { clearTimeout(timer); resolve(v); };
        pending = waiter;
      });
    },
  };
}
