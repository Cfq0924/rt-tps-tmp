/**
 * DICOM command set (PS3.7) encoding for C-STORE, and Part-10 meta header
 * reading. Command elements are always Implicit VR Little Endian.
 */

/** Pad a string to even length with the trailing NUL/space DICOM pad. */
function evenPad(buf, padByte = 0x20) {
  if (buf.length % 2 === 1) {
    const out = Buffer.alloc(buf.length + 1);
    buf.copy(out, 0);
    out[buf.length] = padByte;
    return out;
  }
  return buf;
}

function cmdElement(group, element, valueBuf) {
  const v = evenPad(valueBuf, 0);
  const out = Buffer.alloc(8 + v.length);
  out.writeUInt16LE(group, 0);
  out.writeUInt16LE(element, 2);
  out.writeUInt32LE(v.length, 4);
  v.copy(out, 8);
  return out;
}

function us(value) {
  const b = Buffer.alloc(2);
  b.writeUInt16LE(value, 0);
  return b;
}

function ul(value) {
  const b = Buffer.alloc(4);
  b.writeUInt32LE(value, 0);
  return b;
}

const C_STORE_RQ = 0x0001;
const C_STORE_RSP = 0x8001;
const NO_DATASET = 0x0101;

/**
 * Build a C-STORE-RQ command set (implicit VR LE, group 0000).
 * @returns {Buffer} padded-to-even command set bytes
 */
export function buildCStoreRq({ messageId, sopClassUid, sopInstanceUid, priority = 0 }) {
  const cls = evenPad(Buffer.from(sopClassUid, 'ascii'), 0);
  const inst = evenPad(Buffer.from(sopInstanceUid, 'ascii'), 0);
  const fields = Buffer.concat([
    cmdElement(0x0000, 0x0002, cls),   // AffectedSOPClassUID
    cmdElement(0x0000, 0x0100, us(C_STORE_RQ)),
    cmdElement(0x0000, 0x0110, us(messageId)),
    cmdElement(0x0000, 0x0700, us(priority)),
    cmdElement(0x0000, 0x0800, us(0x0100)), // CommandDataSetType: dataset follows
    cmdElement(0x0000, 0x1000, inst),  // AffectedSOPInstanceUID
  ]);
  const withLength = Buffer.concat([
    cmdElement(0x0000, 0x0000, ul(fields.length)),
    fields,
  ]);
  return withLength;
}

/**
 * Parse a command set (implicit VR LE) into a map of (group,element) → value.
 * @returns {Map<number, Buffer>} key = (group << 16) | element
 */
export function parseCommandSet(buf) {
  const map = new Map();
  let off = 0;
  while (off + 8 <= buf.length) {
    const group = buf.readUInt16LE(off);
    const element = buf.readUInt16LE(off + 2);
    const len = buf.readUInt32LE(off + 4);
    map.set(((group << 16) | element), buf.subarray(off + 8, off + 8 + len));
    off += 8 + len;
  }
  return map;
}

export const COMMAND = { C_STORE_RQ, C_STORE_RSP };

/** CommandField / Status accessors over a parsed command set. */
export function commandField(map) {
  const v = map.get((0x0000 << 16) | 0x0100);
  return v ? v.readUInt16LE(0) : null;
}

export function status(map) {
  const v = map.get((0x0000 << 16) | 0x0900);
  return v ? v.readUInt16LE(0) : null;
}

export function messageID(map) {
  const v = map.get((0x0000 << 16) | 0x0110);
  return v ? v.readUInt16LE(0) : 0;
}

export function affectedSopClassUid(map) {
  const v = map.get((0x0000 << 16) | 0x0002);
  return v ? v.toString('ascii').replace(/\0+$/, '') : null;
}

export function affectedSopInstanceUid(map) {
  const v = map.get((0x0000 << 16) | 0x1000);
  return v ? v.toString('ascii').replace(/\0+$/, '') : null;
}

/**
 * Build a C-STORE-RSP command set (success unless `status` given).
 */
export function buildCStoreRsp({ messageId, sopClassUid, sopInstanceUid, status: st = 0 }) {
  const cls = evenPad(Buffer.from(sopClassUid, 'ascii'), 0);
  const inst = evenPad(Buffer.from(sopInstanceUid, 'ascii'), 0);
  const fields = Buffer.concat([
    cmdElement(0x0000, 0x0002, cls),
    cmdElement(0x0000, 0x0100, us(C_STORE_RSP)),
    cmdElement(0x0000, 0x0120, us(messageId)), // MessageIDBeingRespondedTo
    cmdElement(0x0000, 0x0800, us(NO_DATASET)),
    cmdElement(0x0000, 0x0900, us(st)),        // Status
    cmdElement(0x0000, 0x1000, inst),
  ]);
  return Buffer.concat([
    cmdElement(0x0000, 0x0000, ul(fields.length)),
    fields,
  ]);
}

/**
 * Read a Part-10 file: locate the dataset and extract meta information.
 * @param {Buffer} fileBuf - full DICOM part-10 file
 * @returns {{datasetOffset:number, sopClassUid:string, sopInstanceUid:string,
 *            transferSyntaxUid:string}} null when the preamble is missing
 */
export function readPart10Meta(fileBuf) {
  if (fileBuf.length < 132 || fileBuf.toString('ascii', 128, 132) !== 'DICM') return null;
  // meta group is always Explicit VR LE
  let off = 132;
  let sopClassUid = null, sopInstanceUid = null, transferSyntaxUid = '1.2.840.10008.1.2';
  let datasetOffset = null;
  while (off + 8 <= fileBuf.length) {
    const group = fileBuf.readUInt16LE(off);
    const element = fileBuf.readUInt16LE(off + 2);
    const vr = fileBuf.toString('ascii', off + 4, off + 6);
    let len;
    let valueOff;
    if (['OB', 'OD', 'OF', 'OL', 'OV', 'OW', 'SQ', 'UC', 'UR', 'UT', 'UN'].includes(vr)) {
      len = fileBuf.readUInt32LE(off + 8);
      valueOff = off + 12;
    } else {
      len = fileBuf.readUInt16LE(off + 6);
      valueOff = off + 8;
    }
    const value = fileBuf.subarray(valueOff, valueOff + len).toString('ascii').replace(/\0+$/, '').trim();
    if (group === 0x0002) {
      if (element === 0x0002) sopClassUid = value;
      if (element === 0x0003) sopInstanceUid = value;
      if (element === 0x0010) transferSyntaxUid = value;
      off = valueOff + len;
    } else {
      datasetOffset = off; // first non-meta element = dataset start
      break;
    }
  }
  if (datasetOffset == null) return null;
  return { datasetOffset, sopClassUid, sopInstanceUid, transferSyntaxUid };
}
