import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { mkdirSync, unlinkSync, writeFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import dcmjs from 'dcmjs';

const TEST_DB = join(tmpdir(), `couch-test-${Date.now()}-${process.pid}.db`);
const TEST_FILES_DIR = join(tmpdir(), `couch-files-${process.pid}`);
process.env.DB_PATH = TEST_DB;
process.env.UPLOAD_DIR = TEST_FILES_DIR;

const { datasetToBuffer } = dcmjs.data;
const STUDY_ID = 1;
let planId;
let doseFileId;

function makeDoseFile() {
  // voxel (i, j, k) = 10·i + 100·j + 1000·k, scaling 0.01 → cGy = raw value
  const scaling = 0.01;
  const pixels = new Int32Array(2 * 3 * 4);
  for (let k = 0; k < 2; k++)
    for (let j = 0; j < 3; j++)
      for (let i = 0; i < 4; i++)
        pixels[k * 12 + j * 4 + i] = Math.round((10 * i + 100 * j + 1000 * k) / 100 / scaling);
  const ds = {
    _meta: {},
    SOPClassUID: '1.2.840.10008.5.1.4.1.481.2',
    SOPInstanceUID: '1.2.840.couch.dose',
    StudyInstanceUID: '1.2.840.couchtest.1',
    SeriesInstanceUID: '1.2.840.couchtest.series',
    Modality: 'RTDOSE',
    Rows: 3, Columns: 4, NumberOfFrames: 2,
    BitsAllocated: 32, BitsStored: 32, HighBit: 31, PixelRepresentation: 1,
    ImagePositionPatient: [0, 0, -900],
    ImageOrientationPatient: [1, 0, 0, 0, 1, 0],
    PixelSpacing: [2, 2],
    GridFrameOffsetVector: [0, 4],
    DoseUnits: 'GY', DoseSummationType: 'PLAN', DoseGridScaling: scaling,
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
  const p = db.prepare("INSERT INTO patients (external_id, name) VALUES ('couch-test', 'Couch Test')").run();
  db.prepare('INSERT INTO studies (patient_id, study_instance_uid) VALUES (?, ?)').run(p.lastInsertRowid, '1.2.840.couchtest.1');
  db.close();

  mkdirSync(TEST_FILES_DIR, { recursive: true });
  const dosePath = join(TEST_FILES_DIR, 'dose.dcm');
  writeFileSync(dosePath, makeDoseFile());

  const db2 = new Database(TEST_DB);
  // two CT rows (metadata only — the couch generator does not parse files)
  for (const [idx, z] of [[1, -900], [2, -898]]) {
    db2.prepare(`
      INSERT INTO dicom_files (study_id, series_instance_uid, sop_instance_uid, modality, instance_number,
        file_path, file_name, image_position_x, image_position_y, image_position_z, pixel_spacing_x, pixel_spacing_y, rows, columns)
      VALUES (?, '1.2.840.ct', ?, 'CT', ?, ?, ?, 0, 0, ?, 3, 3, 6, 6)
    `).run(STUDY_ID, `1.2.840.ct.${idx}`, idx, `/tmp/ct${idx}.dcm`, `ct${idx}.dcm`, z);
  }
  const plan = db2.prepare(`
    INSERT INTO ebrt_plans (study_id, name, prescription_dose_gy, number_of_fractions, isocenter_x, isocenter_y, isocenter_z, reference_points)
    VALUES (?, 'Couch Plan', 60, 30, 2, 2, -898, ?)
  `).run(STUDY_ID, JSON.stringify([
    { name: 'iso point', type: 'POINT', x: 4, y: 4, z: -896 },        // in grid, voxel (2,2,1) = 1220 cGy
    { name: 'outside', type: 'POINT', x: 999, y: 999, z: -896 },      // outside
  ]));
  planId = plan.lastInsertRowid;

  const dosePath2 = join(TEST_FILES_DIR, 'dose.dcm');
  const info = db2.prepare(`
    INSERT INTO dicom_files (study_id, series_instance_uid, sop_instance_uid, modality, instance_number, file_path, file_name)
    VALUES (?, 's', '1.2.840.couch.dose', 'RTDOSE', 1, ?, ?)
  `).run(STUDY_ID, dosePath2, 'dose.dcm');
  doseFileId = info.lastInsertRowid;
  db2.close();
}

describe('couchService', () => {
  let svc;

  before(async () => {
    await setup();
    svc = await import('../src/services/couchService.js');
  });

  after(() => {
    for (const ext of ['', '-wal', '-shm']) {
      try { unlinkSync(TEST_DB + ext); } catch {}
    }
    try { rmSync(TEST_FILES_DIR, { recursive: true, force: true }); } catch {}
  });

  it('generates a couch structure ROI across all CT slices', async () => {
    const result = svc.generateCouchStructure({ studyId: STUDY_ID, topOffsetMm: 15, widthMm: 400, userId: 1, reqId: 't' });
    assert.ok(result.segmentationId > 0);
    assert.strictEqual(result.sliceCount, 2);
    const db = (await import('../src/db/init.js')).getDb();
    const seg = db.prepare('SELECT name, color FROM segmentations WHERE id = ?').get(result.segmentationId);
    assert.strictEqual(seg.name, 'Couch Surface');
    const slices = db.prepare('SELECT COUNT(*) as n FROM segmentation_slices WHERE segmentation_id = ?').get(result.segmentationId);
    assert.strictEqual(slices.n, 2);
  });

  it('rejects couch generation without a CT series', async () => {
    assert.throws(() => svc.generateCouchStructure({ studyId: 999, userId: 1, reqId: 't' }), e => e.status === 400);
  });

  it('reports reference point doses with per-fraction and % of Rx', async () => {
    const points = await svc.referencePointDoses({ planId, doseFileId, userId: 1, reqId: 't' });
    assert.strictEqual(points.length, 2);
    const iso = points.find(p => p.name === 'iso point');
    // voxel (2,2,1) = 10·2 + 100·2 + 1000·1 = 1220 cGy
    assert.ok(Math.abs(iso.totalDoseCgy - 1220) < 0.01, `iso ${iso.totalDoseCgy}`);
    assert.ok(Math.abs(iso.perFractionCgy - 1220 / 30) < 0.01);
    assert.ok(Math.abs(iso.pctOfRx - 1220 / 6000 * 100) < 0.01);
    const outside = points.find(p => p.name === 'outside');
    assert.strictEqual(outside.inGrid, false);
  });

  it('resolves the latest study dose when doseFileId omitted', async () => {
    const points = await svc.referencePointDoses({ planId, userId: 1, reqId: 't' });
    const iso = points.find(p => p.name === 'iso point');
    assert.ok(iso && iso.inGrid && Math.abs(iso.totalDoseCgy - 1220) < 0.01);
  });
});
