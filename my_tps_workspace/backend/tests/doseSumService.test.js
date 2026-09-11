import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { mkdirSync, unlinkSync, writeFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import dcmjs from 'dcmjs';

const TEST_DB = join(tmpdir(), `dose-sum-test-${Date.now()}-${process.pid}.db`);
const TEST_FILES_DIR = join(tmpdir(), `dose-sum-files-${process.pid}`);
process.env.DB_PATH = TEST_DB;
process.env.UPLOAD_DIR = TEST_FILES_DIR;

const { datasetToBuffer } = dcmjs.data;
const STUDY_ID = 1;
let fileIdA, fileIdB;

// build a small same-geometry RTDOSE file: 2 frames, 3x4 grid
function makeDoseFile({ sopUid, scaling, values, rows = 4 }) {
  const pixels = new Int32Array(values.length);
  for (let i = 0; i < values.length; i++) pixels[i] = Math.round(values[i] / 100 / scaling);
  const ds = {
    _meta: {},
    SOPClassUID: '1.2.840.10008.5.1.4.1.481.2',
    SOPInstanceUID: sopUid,
    StudyInstanceUID: '1.2.840.sumtest.1',
    SeriesInstanceUID: '1.2.840.sumtest.series',
    Modality: 'RTDOSE',
    PatientName: 'Sum Test',
    SamplesPerPixel: 1,
    PhotometricInterpretation: 'MONOCHROME2',
    Rows: rows,
    Columns: 3,
    NumberOfFrames: 2,
    BitsAllocated: 32,
    BitsStored: 32,
    HighBit: 31,
    PixelRepresentation: 1,
    ImagePositionPatient: [10, 20, -900],
    ImageOrientationPatient: [1, 0, 0, 0, 1, 0],
    PixelSpacing: [2, 3],
    FrameIncrementPointer: '3004000C',
    GridFrameOffsetVector: [0, 5],
    DoseUnits: 'GY',
    DoseType: 'PLAN',
    DoseSummationType: 'PLAN',
    DoseGridScaling: scaling,
    PixelData: new Uint8Array(pixels.buffer),
  };
  return datasetToBuffer(ds);
}

async function setupSchema() {
  const { default: Database } = await import('better-sqlite3');
  const db = new Database(TEST_DB);
  const { readFileSync } = await import('fs');
  const schemaPath = join(dirname(fileURLToPath(import.meta.url)), '../src/db/schema.sql');
  db.exec(readFileSync(schemaPath, 'utf-8'));
  const p = db.prepare("INSERT INTO patients (external_id, name) VALUES ('sum-test', 'Sum Test')").run();
  db.prepare('INSERT INTO studies (patient_id, study_instance_uid) VALUES (?, ?)').run(p.lastInsertRowid, '1.2.840.sumtest.1');
  db.close();

  mkdirSync(TEST_FILES_DIR, { recursive: true });

  // dose A: voxel i → 100 cGy × i ; dose B: voxel i → 50 cGy × i
  const writeDose = (sopUid, scaling, values, name) => {
    const buf = makeDoseFile({ sopUid, scaling, values });
    const path = join(TEST_FILES_DIR, name);
    writeFileSync(path, buf);
    return path;
  };
  const valuesA = Array.from({ length: 24 }, (_, i) => 100 * (i % 12));
  const valuesB = Array.from({ length: 24 }, (_, i) => 50 * (i % 12));
  const pathA = writeDose('1.2.840.sumtest.a', 1e-6, valuesA, 'doseA.dcm');
  const pathB = writeDose('1.2.840.sumtest.b', 1e-6, valuesB, 'doseB.dcm');

  const db2 = new Database(TEST_DB);
  for (const [sop, path, name] of [['1.2.840.sumtest.a', pathA, 'doseA.dcm'], ['1.2.840.sumtest.b', pathB, 'doseB.dcm']]) {
    db2.prepare(`
      INSERT INTO dicom_files (study_id, series_instance_uid, sop_instance_uid, modality, instance_number, file_path, file_name)
      VALUES (?, '1.2.840.sumtest.series', ?, 'RTDOSE', 1, ?, ?)
    `).run(STUDY_ID, sop, path, name);
  }
  fileIdA = db2.prepare("SELECT id FROM dicom_files WHERE sop_instance_uid = '1.2.840.sumtest.a'").get().id;
  fileIdB = db2.prepare("SELECT id FROM dicom_files WHERE sop_instance_uid = '1.2.840.sumtest.b'").get().id;
  db2.close();
}

describe('doseSumService', () => {
  let svc;
  let sum;

  before(async () => {
    await setupSchema();
    svc = await import('../src/services/doseSumService.js');
  });

  after(() => {
    for (const ext of ['', '-wal', '-shm']) {
      try { unlinkSync(TEST_DB + ext); } catch {}
    }
    try { rmSync(TEST_FILES_DIR, { recursive: true, force: true }); } catch {}
  });

  it('sums two same-geometry dose grids into a derived RTDOSE', async () => {
    sum = await svc.createDoseSum({
      studyId: STUDY_ID, doseFileIds: [fileIdA, fileIdB],
      name: 'Plan A + Plan B', userId: 1, reqId: 't',
    });
    assert.ok(sum.outputFileId > 0);
    assert.deepStrictEqual(sum.inputFileIds, [fileIdA, fileIdB]);
  });

  it('produces a parseable RTDOSE whose grid equals the voxel-wise sum', async () => {
    const { parseRTDose } = await import('../src/services/rtDoseService.js');
    const db = (await import('../src/db/init.js')).getDb();
    const out = db.prepare('SELECT file_path FROM dicom_files WHERE id = ?').get(sum.outputFileId);
    const parsed = await parseRTDose(out.file_path);
    assert.strictEqual(parsed.Modality ?? 'RTDOSE', 'RTDOSE');
    assert.strictEqual(parsed.doseSummationType, 'MULTI_PLAN');
    assert.strictEqual(parsed.rows, 4);
    assert.strictEqual(parsed.columns, 3);
    assert.strictEqual(parsed.numberOfFrames, 2);

    const grid = (await import('../src/services/rtDoseService.js')).calculateDoseValue(
      parsed.pixelData, parsed.doseGridScaling, parsed.doseUnits,
    );
    assert.strictEqual(grid.length, 24);
    // dose A voxel = 100·(i%12) cGy, dose B = 50·(i%12) → sum = 150·(i%12)
    for (let i = 0; i < 24; i++) {
      assert.ok(Math.abs(grid[i] - 150 * (i % 12)) < 0.01, `voxel ${i}: ${grid[i]}`);
    }
  });

  it('registers the sum in dicom_files as an RTDOSE of the study', async () => {
    const db = (await import('../src/db/init.js')).getDb();
    const row = db.prepare('SELECT modality, study_id FROM dicom_files WHERE id = ?').get(sum.outputFileId);
    assert.strictEqual(row.modality, 'RTDOSE');
    assert.strictEqual(row.study_id, STUDY_ID);
  });

  it('rejects single-input sums', async () => {
    await assert.rejects(
      svc.createDoseSum({ studyId: STUDY_ID, doseFileIds: [fileIdA], name: 'x', userId: 1, reqId: 't' }),
      e => e.status === 400,
    );
  });

  it('resamples cross-geometry inputs onto the reference grid (M1)', async () => {
    // dose C: constant 10 cGy, 5 rows (different geometry: one extra row)
    const dsBuf = makeDoseFile({ sopUid: '1.2.840.sumtest.c', scaling: 1e-6, values: new Array(30).fill(10), rows: 5 });
    const path = join(TEST_FILES_DIR, 'doseC.dcm');
    writeFileSync(path, dsBuf);
    const { default: Database } = await import('better-sqlite3');
    const db = new Database(TEST_DB);
    const info = db.prepare(`
      INSERT INTO dicom_files (study_id, series_instance_uid, sop_instance_uid, modality, instance_number, file_path, file_name)
      VALUES (?, 's', '1.2.840.sumtest.c', 'RTDOSE', 1, ?, 'doseC.dcm')
    `).run(STUDY_ID, path);
    db.close();

    const sum2 = await svc.createDoseSum({
      studyId: STUDY_ID, doseFileIds: [fileIdA, info.lastInsertRowid], name: 'A + C (resampled)', userId: 1, reqId: 't',
    });
    const { parseRTDose } = await import('../src/services/rtDoseService.js');
    const db2 = (await import('../src/db/init.js')).getDb();
    const out = db2.prepare('SELECT file_path FROM dicom_files WHERE id = ?').get(sum2.outputFileId);
    const parsed = await parseRTDose(out.file_path);
    // output carries the REFERENCE geometry (A: 4 rows), not C's 5 rows
    assert.strictEqual(parsed.rows, 4);
    const grid = (await import('../src/services/rtDoseService.js')).calculateDoseValue(
      parsed.pixelData, parsed.doseGridScaling, parsed.doseUnits,
    );
    // A voxel centres coincide with C's → resampled C is exactly 10 cGy
    for (let i = 0; i < 24; i++) {
      assert.ok(Math.abs(grid[i] - (100 * (i % 12) + 10)) < 0.01, `voxel ${i}: ${grid[i]}`);
    }
  });

  it('lists sums of a study', async () => {
    const sums = svc.listDoseSums({ studyId: STUDY_ID, userId: 1, reqId: 't' });
    assert.strictEqual(sums.length, 2);
    assert.strictEqual(sums[0].name, 'A + C (resampled)');
  });
});
