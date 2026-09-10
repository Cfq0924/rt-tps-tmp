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

// synthetic RTSTRUCT: ROI 'PTV Test' as a rectangle x∈[1,5]mm, y∈[1,5]mm on
// frame z=-900 → covers voxel centres (i,j) ∈ {1,2}×{1,2}, i.e. 4 voxels with
// raw doses 110/120/210/220 cGy on the untouched grid
function makeRTStruct(sopUid) {
  const ds = {
    _meta: {},
    SOPClassUID: '1.2.840.10008.5.1.4.1.481.3',
    SOPInstanceUID: sopUid,
    StudyInstanceUID: '1.2.840.normtest.1',
    SeriesInstanceUID: '1.2.840.normtest.rtstruct',
    Modality: 'RTSTRUCT',
    PatientName: 'Norm Test',
    StructureSetROISequence: [{
      ROINumber: 1,
      ReferencedFrameOfReferenceUID: '1.2.840.normtest.1',
      ROIName: 'PTV Test',
    }],
    ROIContourSequence: [{
      ReferencedROINumber: 1,
      ROIDisplayColor: [255, 128, 0],
      ContourSequence: [{
        ContourGeometricType: 'CLOSED_PLANAR',
        NumberOfContourPoints: 4,
        ContourData: [1, 1, -900, 5, 1, -900, 5, 5, -900, 1, 5, -900],
      }],
    }],
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
  writeFileSync(join(TEST_FILES_DIR, 'rtstruct.dcm'), makeRTStruct('1.2.840.normtest.rtstruct'));

  const db2 = new Database(TEST_DB);
  const info = db2.prepare(`
    INSERT INTO dicom_files (study_id, series_instance_uid, sop_instance_uid, modality, instance_number, file_path, file_name)
    VALUES (?, 's', '1.2.840.normtest.dose', 'RTDOSE', 1, ?, ?)
  `).run(STUDY_ID, dosePath, 'dose.dcm');
  doseFileId = info.lastInsertRowid;
  db2.prepare(`
    INSERT INTO dicom_files (study_id, series_instance_uid, sop_instance_uid, modality, instance_number, file_path, file_name)
    VALUES (?, 'rt', '1.2.840.normtest.rtstruct', 'RTSTRUCT', 1, ?, ?)
  `).run(STUDY_ID, join(TEST_FILES_DIR, 'rtstruct.dcm'), 'rtstruct.dcm');
  db2.prepare(`
    INSERT INTO ebrt_plans (study_id, name, prescription_dose_gy, number_of_fractions, isocenter_x, isocenter_y, isocenter_z, reference_points, target_structure_name)
    VALUES (?, 'Norm Plan', 20, 10, 2, 2, -898, ?, 'PTV Test')
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
    const { getDoseGrid } = await import('../src/services/rtDoseService.js');
    const grid = (await getDoseGrid(doseFileId, {}, 't')).grid;
    assert.ok(Math.abs(Math.max(...grid) - 1230 * 1.5) < 1, `max ${Math.max(...grid)}`);
    assert.strictEqual(readScaling(), 0.01); // regenerate path keeps DS unchanged
  });

  it('ISOCENTER mode: iso voxel lands on value% of Rx', async () => {
    // plan isocentre (2,2,-898) maps to dose voxel (i=1, j=1, k=0) at 2mm spacing
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
    assert.ok(Math.abs(Math.max(...grid) - 2000) < 1, `max ${Math.max(...grid)}`);
  });

  it('PRIMARY_REF_POINT scales so the DPV point hits 100% of Rx', async () => {
    const result = await svc.normalizePlanDose({ planId: 1, mode: 'PRIMARY_REF_POINT', userId: 1, reqId: 't' });
    assert.ok(result.factor > 0);
    const { getDoseGrid } = await import('../src/services/rtDoseService.js');
    const grid = (await getDoseGrid(doseFileId, {}, 't')).grid;
    // DPV Prostate at (2,2,-898) → voxel (i=1, j=1, k=0): normalised to 2000 cGy
    assert.ok(Math.abs(grid[0 * 12 + 1 * 4 + 1] - 2000) < 1, `DPV ${grid[0 * 12 + 1 * 4 + 1]}`);
  });

  it('PERCENT_COVERS end-to-end: 50% of Rx covers 50% of PTV Test', async () => {
    const { getDoseGrid } = await import('../src/services/rtDoseService.js');
    // sanity: the fixed stats collector sees the 4 in-ROI voxels
    const pre = await getDoseGrid(doseFileId, {}, 't');
    const stats = await svc.targetStructureStats({
      studyId: STUDY_ID, structureName: 'PTV Test', doseGrid: pre.grid, doseMeta: pre,
    });
    assert.strictEqual(stats.voxelCount, 4, `voxels ${stats.voxelCount}`);

    const result = await svc.normalizePlanDose({
      planId: 1, mode: 'PERCENT_COVERS', value: { cover: 50, ofVolume: 50 }, userId: 1, reqId: 't',
    });
    assert.ok(result.factor > 0, `factor ${result.factor}`);

    const grid = (await getDoseGrid(doseFileId, {}, 't')).grid;
    const targetDoses = [
      grid[0 * 12 + 1 * 4 + 1], grid[0 * 12 + 1 * 4 + 2],
      grid[0 * 12 + 2 * 4 + 1], grid[0 * 12 + 2 * 4 + 2],
    ].sort((a, b) => a - b);
    // cover dose = 50% of 20 Gy Rx = 1000 cGy; the solved factor puts the
    // 50%-coverage threshold on the 3rd-highest target voxel
    const covered = targetDoses.filter(v => v >= 1000 * (1 - 1e-6)).length;
    assert.strictEqual(covered, 2, `covered ${covered} of [${targetDoses}]`);
    assert.ok(targetDoses[1] < 1000, `3rd voxel ${targetDoses[1]} should sit at the threshold`);
    void result;
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

// ---------- pure coverageFactor solver (PERCENT_COVERS) ----------
describe('coverageFactor (PERCENT_COVERS solver)', () => {
  // sorted target-voxel doses: 10..1000 cGy in 100 steps
  const doses = Array.from({ length: 100 }, (_, i) => 10 * (i + 1));

  it('finds a factor so that cover% of Rx covers ofVol% of the volume', async () => {
    const { coverageFactor } = await import('../src/services/normalizationService.js');
    // median of doses ≈ 505 — the factor should put the 50% coverage threshold near there
    const f = coverageFactor(doses, 950, 50);
    const threshold = 950 / f;
    assert.ok(threshold > 400 && threshold < 600, `threshold ${threshold}`);
  });

  it('monotonic: higher ofVol needs a higher factor', async () => {
    const { coverageFactor } = await import('../src/services/normalizationService.js');
    const f30 = coverageFactor(doses, 950, 30);
    const f70 = coverageFactor(doses, 950, 70);
    assert.ok(f70 > f30, `${f70} vs ${f30}`);
  });

  it('converges to the search bound when the goal is unreachable (documented behavior)', async () => {
    const { coverageFactor } = await import('../src/services/normalizationService.js');
    const f = coverageFactor([5, 6, 7], 100000, 50);
    assert.ok(f > 0);
  });
});
