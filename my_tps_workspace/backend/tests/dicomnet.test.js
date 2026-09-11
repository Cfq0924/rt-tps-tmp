import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import dcmjs from 'dcmjs';

const { datasetToBuffer } = dcmjs.data;

const { sendCStore } = await import('../src/dicomnet/scu.js');
const { MiniStoreScp } = await import('../src/dicomnet/scp.js');
const { readPart10Meta } = await import('../src/dicomnet/commandSet.js');

/** Minimal RTDOSE Part-10 file, explicit VR LE (dcmjs default). */
function makeDoseFile({ sopUid, scaling = 1e-3, rows = 3, columns = 4 }) {
  const pixels = new Int32Array(rows * columns).fill(Math.round(50 / 100 / scaling));
  const ds = {
    _meta: {},
    SOPClassUID: '1.2.840.10008.5.1.4.1.481.2',
    SOPInstanceUID: sopUid,
    StudyInstanceUID: '1.2.840.dicomnet.1',
    SeriesInstanceUID: '1.2.840.dicomnet.series',
    Modality: 'RTDOSE',
    PatientName: 'Net Test',
    SamplesPerPixel: 1,
    PhotometricInterpretation: 'MONOCHROME2',
    Rows: rows,
    Columns: columns,
    NumberOfFrames: 1,
    BitsAllocated: 32,
    BitsStored: 32,
    HighBit: 31,
    PixelRepresentation: 1,
    ImagePositionPatient: [0, 0, -900],
    ImageOrientationPatient: [1, 0, 0, 0, 1, 0],
    PixelSpacing: [2, 2],
    FrameIncrementPointer: '3004000C',
    GridFrameOffsetVector: [0],
    DoseUnits: 'GY',
    DoseSummationType: 'PLAN',
    DoseGridScaling: scaling,
    PixelData: new Uint8Array(pixels.buffer),
  };
  return datasetToBuffer(ds);
}

describe('dicomnet C-STORE spike', () => {
  let scp;
  let port;
  const stored = [];

  before(async () => {
    scp = new MiniStoreScp({
      aet: 'TESTPACS',
      onStore: async (entry) => { stored.push(entry); },
    });
    port = await scp.listen();
  });

  after(async () => {
    await scp.close();
  });

  it('reads Part-10 meta (SOP class/instance + transfer syntax)', () => {
    const buf = makeDoseFile({ sopUid: '1.2.840.meta.1' });
    const meta = readPart10Meta(buf);
    assert.strictEqual(meta.sopClassUid, '1.2.840.10008.5.1.4.1.481.2');
    assert.strictEqual(meta.sopInstanceUid, '1.2.840.meta.1');
    assert.strictEqual(meta.transferSyntaxUid, '1.2.840.10008.1.2.1');
    assert.ok(meta.datasetOffset > 132);
    // dataset bytes must round-trip into a valid dataset element
    assert.ok(buf.length > meta.datasetOffset);
  });

  it('C-STORE SCU pushes a file and the SCP receives byte-identical dataset', async () => {
    const fileBuf = makeDoseFile({ sopUid: '1.2.840.net.1' });
    const meta = readPart10Meta(fileBuf);
    const result = await sendCStore({
      host: '127.0.0.1',
      port,
      calledAet: 'TESTPACS',
      fileBuf,
    });
    assert.strictEqual(result.ok, true, result.detail);
    assert.strictEqual(result.status, 0);

    assert.strictEqual(stored.length, 1);
    assert.strictEqual(stored[0].sopInstanceUid, '1.2.840.net.1');
    assert.strictEqual(stored[0].sopClassUid, '1.2.840.10008.5.1.4.1.481.2');
    // dataset forwarded as stored — byte-exact
    const expected = fileBuf.subarray(meta.datasetOffset);
    assert.ok(stored[0].dataset.equals(expected), 'received dataset differs from stored bytes');
  });

  it('transfers multi-PDU datasets (large file) intact', async () => {
    // pad a private element beyond the 16 KiB max PDU to force chunking
    const fileBuf = makeDoseFile({ sopUid: '1.2.840.net.2' });
    const big = Buffer.alloc(40000, 0x41);
    const padded = Buffer.concat([fileBuf, Buffer.from([0x00, 0x11, 0x00, 0x00, 0x4c, 0x49, 0x54, 0x00, 0x40, 0x00, 0x00, 0x00]), big]);
    const result = await sendCStore({ host: '127.0.0.1', port, calledAet: 'TESTPACS', fileBuf: padded });
    assert.strictEqual(result.ok, true, result.detail);
    assert.strictEqual(stored.length, 2);
    const expected = padded.subarray(readPart10Meta(padded).datasetOffset);
    assert.ok(stored[1].dataset.equals(expected), 'chunked dataset differs from stored bytes');
  });

  it('rejects a non-Part-10 buffer without opening a connection', async () => {
    const result = await sendCStore({
      host: '127.0.0.1', port, calledAet: 'TESTPACS', fileBuf: Buffer.from('not dicom at all'),
    });
    assert.strictEqual(result.ok, false);
    assert.match(result.detail, /Part-10/);
    assert.strictEqual(stored.length, 2);
  });

  it('reports a connection failure cleanly', async () => {
    const result = await sendCStore({
      host: '127.0.0.1', port: 1, calledAet: 'TESTPACS', fileBuf: makeDoseFile({ sopUid: '1.2.840.net.3' }), timeoutMs: 2000,
    });
    assert.strictEqual(result.ok, false);
    assert.match(result.detail, /socket/);
  });
});
