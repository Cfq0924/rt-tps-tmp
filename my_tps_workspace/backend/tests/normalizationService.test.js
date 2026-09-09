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

const { datasetToBuffer, DicomMessage, DicomMetaDictionary } = dcmjs.data;
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
    INSERT INTO ebrt_plans (study_id, name, prescription_dose_gy, number_of_fractions, isocenter_x, isocenter_y, isocenter_z)
    VALUES (?, 'Norm Plan', 20, 10, 2, 2, -898)
  `).run(STUDY_ID);
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
    const before = readScaling();
    const result = await svc.normalizePlanDose({ planId: 1, mode: 'VALUE', value: 150, userId: 1, reqId: 't' });
    assert.ok(Math.abs(result.factor - 1.5) < 1e-9);
    const after = readScaling();
    assert.ok(Math.abs(after - before * 1.5) / after < 1e-6);
  });

  it('ISOCENTER mode: iso voxel lands on value% of Rx', async () => {
    const { getDoseGrid } = await import('../src/services/rtDoseService.js');
    // plan isocentre (2,2,-898) maps to dose voxel (i=1, j=1, k=0) at 2mm spacing
    const isoIdx = 0 * 12 + 1 * 4 + 1;
    const before = (await getDoseGrid(doseFileId, {}, 't')).grid[isoIdx];
    await svc.normalizePlanDose({ planId: 1, mode: 'ISOCENTER', value: 100, userId: 1, reqId: 't' });
    const grid2 = await getDoseGrid(doseFileId, {}, 't');
    const isoAfter = grid2.grid[isoIdx];
    // 20 Gy Rx → iso should be ~2000 cGy after ISOCENTER 100
    assert.ok(Math.abs(isoAfter - 2000) < 1, `iso ${isoAfter}`);
  });

  it('rejects unknown modes and missing values', async () => {
    await assert.rejects(
      svc.normalizePlanDose({ planId: 1, mode: 'MAGIC', userId: 1, reqId: 't' }),
      e => e.status === 400,
    );
    await assert.rejects(
      svc.normalizePlanDose({ planId: 1, mode: 'VALUE', value: 0, userId: 1, reqId: 't' }),
      e => e.status === 400,
    );
  });
});
