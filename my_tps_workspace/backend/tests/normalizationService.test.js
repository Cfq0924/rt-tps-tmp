import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { mkdirSync, unlinkSync, writeFileSync, rmSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import dcmjs from 'dcmjs';

const TEST_DB = join(tmpdir(), `normalize-test-${Date.now()}-${process.pid}.db`);
const TEST_FILES_DIR = join(tmpdir(), `normalize-files-${process.pid}`);
process.env.DB_PATH = TEST_DB;
process.env.UPLOAD_DIR = TEST_FILES_DIR;

const { datasetToBuffer, DicomMessage } = dcmjs.data;
const STUDY_ID = 1;
let doseFileId;
let svc;

// synthetic 2-frame 3×4 dose grid: voxel (i,j,k) = 10·i + 100·j + 1000·k (cGy via scaling 0.01)
function makeDoseFile(sopUid) {
  const scaling = 0.01;
  const pixels = new Int32Array(2 * 3 * 4);
  for (let k = 0; k < 2; k++)
    for (let j = 0; j < 3; j++)
      for (let i = 0; i < 4; i++)
        pixels[k * 12 + j * 4 + i] = Math.round((10 * i + 100 * j + 1000 * k) / 100 / scaling);
  const ds = {
    _meta: {},
    SOPClassUID: '1.2.840.10008.5.1.4.1.481.2',
    SOPInstanceUID: sopUid,
    StudyInstanceUID: '1.2.840.normtest.1',
    SeriesInstanceUID: '1.2.840.normtest.series',
    Modality: 'RTDOSE',
    PatientName: 'Norm Test',
    SamplesPerPixel: 1,
    Rows: 3,
    Columns: 4,
    NumberOfFrames: 2,
    BitsAllocated: 32,
    BitsStored: 32,
    HighBit: 31,
    PixelRepresentation: 1,
    ImagePositionPatient: [0, 0, -900],
    ImageOrientationPatient: [1, 0, 0, 0, 1, 0],
    PixelSpacing: [2, 2],
    GridFrameOffsetVector: [0, 4],
    DoseUnits: 'GY',
    DoseSummationType: 'PLAN',
    DoseGridScaling: scaling,
    PixelData: new Uint8Array(pixels.buffer),
  };
  return datasetToBuffer(ds);
}

async function setup() {
  const { default: Database } = await import('better-sqlite3');
  const db = new Database(TEST_DB);
  const { readFileSync } = await import('fs');
  const schemaPath = join(dirname(fileURLToPath(import.meta.url)), '../src/db/schema.sql');
  db.exec(readFileSync(schemaPath, 'utf-8'));
  const p = db.prepare("INSERT INTO patients (external_id, name) VALUES ('norm-test', 'Norm Test')").run();
  db.prepare('INSERT INTO studies (patient_id, study_instance_uid) VALUES (?, ?)').run(p.lastInsertRowid, '1.2.840.normtest.1');
  db.close();

  mkdirSync(TEST_FILES_DIR, { recursive: true });
  const dosePath = join(TEST_FILES_DIR, 'dose.dcm');
  writeFileSync(dosePath, makeDoseFile('1.2.840.normtest.dose'));

  const db2 = new Database(TEST_DB);
  const info = db2.prepare(`
    INSERT INTO dicom_files (study_id, series_instance_uid, sop_instance_uid, modality, instance_number, file_path, file_name)
    VALUES (?, 's', '1.2.840.normtest.dose', 'RTDOSE', 1, ?, ?)
  `).run(STUDY_ID, dosePath, 'dose.dcm');
  doseFileId = info.lastInsertRowid;
  db2.prepare(`
    INSERT INTO ebrt_plans (study_id, name, prescription_dose_gy, number_of_fractions, isocenter_x, isocenter_y, isocenter_z, reference_points)
    VALUES (?, 'Norm Plan', 20, 10, 2, 2, -898, ?)
  `).run(STUDY_ID, JSON.stringify([
    { name: 'DPV Prostate', isDpv: true, type: 'TARGET', x: 2, y: 2, z: -898, totalDoseLimitGy: 76 },
    { name: 'Point A', type: 'POINT', x: 2, y: 2, z: -898 },
  ]));
  db2.close();
}

describe('normalizationService', () => {
  before(async () => {
    await setup();
    svc = await import('../src/services/normalizationService.js');
  });

  after(() => {
    for (const ext of ['', '-wal', '-shm']) {
      try { unlinkSync(TEST_DB + ext); } catch {}
    }
    try { rmSync(TEST_FILES_DIR, { recursive: true, force: true }); } catch {}
  });

  function readScaling() {
    const buf = readFileSync(join(TEST_FILES_DIR, 'dose.dcm'));
    const dict = DicomMessage.readFile(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
    const el = dict.dict['3004000E'];
    return Number(Array.isArray(el._rawValue) ? el._rawValue[0] : el.Value[0]);
  }

  it('VALUE mode rescales the stored grid by the exact factor', async () => {
    const result = await svc.normalizePlanDose({ planId: 1, mode: 'VALUE', value: 150, userId: 1, reqId: 't' });
    assert.ok(Math.abs(result.factor - 1.5) < 1e-9);
    // original grid max 1230 cGy × 1.5 = 1845 — pixels scaled, scaling unchanged
    const { getDoseGrid } = await import('../src/services/rtDoseService.js');
    const grid = (await getDoseGrid(doseFileId, {}, 't')).grid;
    assert.ok(Math.abs(Math.max(...grid) - 1845) < 1, `max ${Math.max(...grid)}`);
    assert.strictEqual(readScaling(), 0.01); // DS unchanged in the regenerate path
  });

  it('ISOCENTER mode: iso voxel lands on value% of Rx', async () => {
    // plan isocentre (2,2,-898) maps to dose voxel (i=1, j=1, k=0) at 2mm spacing;
    // raw there = 110 → 100% of Rx (2000 cGy)
    const isoIdx = 0 * 12 + 1 * 4 + 1;
    await svc.normalizePlanDose({ planId: 1, mode: 'ISOCENTER', value: 100, userId: 1, reqId: 't' });
    const { getDoseGrid } = await import('../src/services/rtDoseService.js');
    const grid = (await getDoseGrid(doseFileId, {}, 't')).grid;
    assert.ok(Math.abs(grid[isoIdx] - 2000) < 1, `iso ${grid[isoIdx]}`);
  });

  it('BODY_MAX scales so grid max equals value% of Rx', async () => {
    await svc.normalizePlanDose({ planId: 1, mode: 'BODY_MAX', value: 100, userId: 1, reqId: 't' });
    const { getDoseGrid } = await import('../src/services/rtDoseService.js');
    const grid = (await getDoseGrid(doseFileId, {}, 't')).grid;
    // original max 1230 → 100% of Rx = 2000 cGy
    assert.ok(Math.abs(Math.max(...grid) - 2000) < 1, `max ${Math.max(...grid)}`);
  });

  it('PRIMARY_REF_POINT scales so the DPV point hits 100% of Rx', async () => {
    const db = (await import('../src/db/init.js')).getDb();
    db.prepare("UPDATE ebrt_plans SET primary_point_name = 'DPV Prostate' WHERE id = 1").run();
    const result = await svc.normalizePlanDose({ planId: 1, mode: 'PRIMARY_REF_POINT', userId: 1, reqId: 't' });
    assert.ok(result.factor > 0);
    // DPV Prostate at (2,2,-898) → voxel (i=1, j=1, k=0): raw 110 → normalised to 2000 cGy
    const { getDoseGrid } = await import('../src/services/rtDoseService.js');
    const grid = (await getDoseGrid(doseFileId, {}, 't')).grid;
    assert.ok(Math.abs(grid[0 * 12 + 1 * 4 + 1] - 2000) < 1, `DPV ${grid[0 * 12 + 1 * 4 + 1]}`);
  });

  it('NONE records the choice without rescaling', async () => {
    const before = readScaling();
    const result = await svc.normalizePlanDose({ planId: 1, mode: 'NONE', userId: 1, reqId: 't' });
    assert.strictEqual(result.factor, 1);
    assert.strictEqual(readScaling(), before);
  });

  it('rejects unknown modes and missing values', async () => {
    await assert.rejects(
      async () => svc.normalizePlanDose({ planId: 1, mode: 'MAGIC', userId: 1, reqId: 't' }),
      e => e.status === 400,
    );
    await assert.rejects(
      async () => svc.normalizePlanDose({ planId: 1, mode: 'VALUE', value: 0, userId: 1, reqId: 't' }),
      e => e.status === 400,
    );
  });
});
