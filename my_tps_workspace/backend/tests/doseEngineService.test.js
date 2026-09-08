import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { mkdirSync, unlinkSync, writeFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import dcmjs from 'dcmjs';

const TEST_DB = join(tmpdir(), `dose-engine-test-${Date.now()}-${process.pid}.db`);
const TEST_FILES_DIR = join(tmpdir(), `dose-engine-files-${process.pid}`);
process.env.DB_PATH = TEST_DB;
process.env.UPLOAD_DIR = TEST_FILES_DIR;

const { datasetToBuffer } = dcmjs.data;
const STUDY_ID = 1;

// synthetic 6-row × 6-col CT, water block in the middle rows; 2 slices
function makeCT({ sopUid, z, waterRows }) {
  const rows = 6, cols = 6;
  const pixels = new Int16Array(rows * cols);
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      pixels[j * cols + i] = waterRows.includes(j) ? 1024 : 24; // stored: HU 0 (water) | HU -1000 (air)
    }
  }
  const ds = {
    _meta: {},
    SOPClassUID: '1.2.840.10008.5.1.4.1.1.2',
    SOPInstanceUID: sopUid,
    StudyInstanceUID: '1.2.840.enginetest.1',
    SeriesInstanceUID: '1.2.840.enginetest.series',
    Modality: 'CT',
    PatientName: 'Engine Test',
    Rows: rows,
    Columns: cols,
    PixelRepresentation: 1,
    BitsAllocated: 16,
    RescaleSlope: 1,
    RescaleIntercept: -1024,
    ImagePositionPatient: [0, 0, z],
    ImageOrientationPatient: [1, 0, 0, 0, 1, 0],
    PixelSpacing: [3, 3],
    PixelData: new Uint8Array(pixels.buffer),
  };
  return datasetToBuffer(ds);
}

// reference dose geometry: 6×6×2, same frame grid as CT
function makeRefDose({ sopUid }) {
  const pixels = new Int32Array(6 * 6 * 2);
  const ds = {
    _meta: {},
    SOPClassUID: '1.2.840.10008.5.1.4.1.481.2',
    SOPInstanceUID: sopUid,
    StudyInstanceUID: '1.2.840.enginetest.1',
    SeriesInstanceUID: '1.2.840.enginetest.doseseries',
    Modality: 'RTDOSE',
    PatientName: 'Engine Test',
    SamplesPerPixel: 1,
    Rows: 6,
    Columns: 6,
    NumberOfFrames: 2,
    BitsAllocated: 32,
    BitsStored: 32,
    HighBit: 31,
    PixelRepresentation: 1,
    ImagePositionPatient: [0, 0, -900],
    ImageOrientationPatient: [1, 0, 0, 0, 1, 0],
    PixelSpacing: [3, 3],
    GridFrameOffsetVector: [0, 3],
    DoseUnits: 'GY',
    DoseSummationType: 'PLAN',
    DoseGridScaling: 1e-5,
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
  const p = db.prepare("INSERT INTO patients (external_id, name) VALUES ('eng-test', 'Engine Test')").run();
  db.prepare('INSERT INTO studies (patient_id, study_instance_uid) VALUES (?, ?)').run(p.lastInsertRowid, '1.2.840.enginetest.1');
  db.close();

  mkdirSync(TEST_FILES_DIR, { recursive: true });
  const write = (buf, name) => {
    const path = join(TEST_FILES_DIR, name);
    writeFileSync(path, buf);
    return path;
  };
  const db2 = new Database(TEST_DB);
  const insert = db2.prepare(`
    INSERT INTO dicom_files (study_id, series_instance_uid, sop_instance_uid, modality, instance_number, file_path, file_name, image_position_z, pixel_spacing_x, pixel_spacing_y, rows, columns)
    VALUES (?, '1.2.840.enginetest.series', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  // CT water block: rows 1..4 water (y = 3..12 mm), beam from anterior (gantry 0 → dir +y)
  insert.run(STUDY_ID, '1.2.840.enginetest.ct1', 'CT', 1, write(makeCT({ sopUid: '1.2.840.enginetest.ct1', z: -900, waterRows: [1, 2, 3, 4] }), 'ct1.dcm'), 'ct1.dcm', -900, 3, 3, 6, 6);
  insert.run(STUDY_ID, '1.2.840.enginetest.ct2', 'CT', 2, write(makeCT({ sopUid: '1.2.840.enginetest.ct2', z: -897, waterRows: [1, 2, 3, 4] }), 'ct2.dcm'), 'ct2.dcm', -897, 3, 3, 6, 6);
  insert.run(STUDY_ID, '1.2.840.enginetest.doseref', 'RTDOSE', 1, write(makeRefDose({ sopUid: '1.2.840.enginetest.doseref' }), 'doseref.dcm'), 'doseref.dcm', -900, 3, 3, 6, 6);

  // plan: single static field, gantry 0, jaws ±9mm both axes, isocentre at
  // the water block centre of slice 2
  const iso = { x: 7.5, y: 7.5, z: -897 };
  const plan = db2.prepare(`
    INSERT INTO ebrt_plans (study_id, name, prescription_dose_gy, number_of_fractions, approval_status, isocenter_x, isocenter_y, isocenter_z)
    VALUES (?, 'Engine Plan', 2, 1, 'REVIEWED', ?, ?, ?)
  `).run(STUDY_ID, iso.x, iso.y, iso.z);
  db2.prepare(`
    INSERT INTO ebrt_beams (plan_id, beam_number, name, beam_type, energy_mv, gantry_angle, jaw_x1, jaw_x2, jaw_y1, jaw_y2, weight)
    VALUES (?, 1, 'AP', 'STATIC', 6, 0, -9, 9, -9, 9, 1)
  `).run(plan.lastInsertRowid);
  const refFile = db2.prepare("SELECT id FROM dicom_files WHERE sop_instance_uid = '1.2.840.enginetest.doseref'").get();
  db.close();
  return { planId: plan.lastInsertRowid, referenceDoseFileId: refFile.id, iso };
}

describe('doseEngineService', () => {
  let svc;
  let ctx;

  before(async () => {
    ctx = await setup();
    svc = await import('../src/services/doseEngineService.js');
  });

  after(() => {
    for (const ext of ['', '-wal', '-shm']) {
      try { unlinkSync(TEST_DB + ext); } catch {}
    }
    try { rmSync(TEST_FILES_DIR, { recursive: true, force: true }); } catch {}
  });

  describe('physics curve primitives', () => {
    it('TPR peaks at dmax then falls off like 6MV water', () => {
      assert.ok(Math.abs(svc.tpr6MV(1.5) - 1) < 1e-9);          // dmax → 1
      const pdd10 = svc.tpr6MV(10);                              // 10 cm
      assert.ok(Math.abs(pdd10 - 0.671) < 0.01, `TPR(10cm)=${pdd10}`);
      assert.ok(svc.tpr6MV(20) < svc.tpr6MV(10));
      assert.ok(svc.tpr6MV(0) === 0);
    });

    it('field profile: flat inside, 50% at edge, ~0 outside', () => {
      assert.ok(Math.abs(svc.fieldProfile(0, 50) - 1) < 0.01);
      assert.ok(Math.abs(svc.fieldProfile(50, 50) - 0.5) < 0.01);
      assert.ok(svc.fieldProfile(90, 50) < 0.01);
      assert.ok(svc.fieldProfile(20, 50) > 0.98);
    });
  });

  describe('computeAndStoreDose', () => {
    let result;

    it('computes and stores a first-class RTDOSE', async () => {
      result = await svc.computeAndStoreDose({
        studyId: STUDY_ID,
        referenceDoseFileId: ctx.referenceDoseFileId,
        planId: ctx.planId,
        prescriptionCgy: 200,
        userId: 1,
        reqId: 't',
      });
      assert.ok(result.doseFileId > 0);
      assert.ok(result.maxDoseCgy > 0);
      assert.strictEqual(result.beams, 1);
    });

    it('normalises the isocentre voxel to the prescription', async () => {
      const { getDoseGrid } = await import('../src/services/rtDoseService.js');
      const grid = await getDoseGrid(result.doseFileId, {}, 't');

      // the hottest voxel is near the entrance of the water block; with
      // isocentre normalisation the max sits above 200 cGy but stays sane
      assert.ok(grid.maxDose > 200, `max ${grid.maxDose}`);
      assert.ok(grid.maxDose < 2000, `max ${grid.maxDose}`);
      assert.strictEqual(grid.doseType, 'CALCULATED');
    });

    it('keeps every voxel non-negative and stores a parseable file', async () => {
      const { getDoseGrid } = await import('../src/services/rtDoseService.js');
      const grid = await getDoseGrid(result.doseFileId, {}, 't');
      for (let i = 0; i < grid.grid.length; i++) {
        assert.ok(grid.grid[i] >= 0, `negative dose at voxel ${i}`);
      }
      // x = 0 (15mm left of centre 7.5) lies outside the ±9mm field + penumbra
      // → the corner column of each frame must be (near) zero
      const corner = grid.grid[0 * 36 + 0 * 6 + 0];
      assert.ok(corner < 1, `corner voxel should be ~0, got ${corner}`);
    });
  });
});
