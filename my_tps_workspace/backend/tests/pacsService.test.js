import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { mkdirSync, unlinkSync, writeFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import dcmjs from 'dcmjs';

const { datasetToBuffer } = dcmjs.data;

const TEST_DB = join(tmpdir(), `pacs-test-${Date.now()}-${process.pid}.db`);
const TEST_FILES_DIR = join(tmpdir(), `pacs-files-${process.pid}`);
process.env.DB_PATH = TEST_DB;
process.env.UPLOAD_DIR = TEST_FILES_DIR;

const STUDY_ID = 1;
let fileId;
let scp;
let scpPort;

function makeDoseFile(sopUid) {
  const pixels = new Int32Array(12).fill(500);
  const ds = {
    _meta: {},
    SOPClassUID: '1.2.840.10008.5.1.4.1.481.2',
    SOPInstanceUID: sopUid,
    StudyInstanceUID: '1.2.840.pacs.1',
    SeriesInstanceUID: '1.2.840.pacs.series',
    Modality: 'RTDOSE',
    PatientName: 'Pacs Test',
    SamplesPerPixel: 1,
    PhotometricInterpretation: 'MONOCHROME2',
    Rows: 3,
    Columns: 4,
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
    DoseGridScaling: 1e-3,
    PixelData: new Uint8Array(pixels.buffer),
  };
  return datasetToBuffer(ds);
}

async function setup() {
  const { default: Database } = await import('better-sqlite3');
  const db = new Database(TEST_DB);
  const schemaPath = join(dirname(fileURLToPath(import.meta.url)), '../src/db/schema.sql');
  db.exec(await (await import('fs')).readFileSync(schemaPath, 'utf-8'));
  db.prepare("INSERT INTO patients (external_id, name) VALUES ('pacs-test', 'Pacs Test')").run();
  db.prepare("INSERT INTO studies (patient_id, study_instance_uid) VALUES (1, '1.2.840.pacs.1')").run();
  db.close();

  mkdirSync(TEST_FILES_DIR, { recursive: true });
  const path = join(TEST_FILES_DIR, 'dose.dcm');
  writeFileSync(path, makeDoseFile('1.2.840.pacs.dose.1'));

  const db2 = new Database(TEST_DB);
  db2.prepare(`
    INSERT INTO dicom_files (study_id, series_instance_uid, sop_instance_uid, modality, instance_number, file_path, file_name)
    VALUES (?, '1.2.840.pacs.series', '1.2.840.pacs.dose.1', 'RTDOSE', 1, ?, 'dose.dcm')
  `).run(STUDY_ID, path);
  fileId = db2.prepare("SELECT id FROM dicom_files WHERE sop_instance_uid = '1.2.840.pacs.dose.1'").get().id;
  db2.close();

  const { MiniStoreScp } = await import('../src/dicomnet/scp.js');
  scp = new MiniStoreScp({ aet: 'TESTPACS' });
  scpPort = await scp.listen();
}

describe('pacsService', () => {
  let svc;

  before(async () => {
    await setup();
    svc = await import('../src/services/pacsService.js');
  });

  after(async () => {
    await scp.close();
    for (const ext of ['', '-wal', '-shm']) {
      try { unlinkSync(TEST_DB + ext); } catch {}
    }
    try { rmSync(TEST_FILES_DIR, { recursive: true, force: true }); } catch {}
  });

  it('creates and lists destinations with validation', () => {
    const dest = svc.createDestination({
      name: 'Clinic PACS', aet: 'CLINICPACS', host: '127.0.0.1', port: scpPort,
      description: 'test target', userId: 1, reqId: 't',
    });
    assert.ok(dest.id > 0);
    assert.throws(
      () => svc.createDestination({ name: 'Clinic PACS', aet: 'X', host: 'h', port: 104, userId: 1, reqId: 't' }),
      e => e.status === 409,
    );
    assert.throws(
      () => svc.createDestination({ name: 'bad port', aet: 'X', host: 'h', port: 99999, userId: 1, reqId: 't' }),
      e => e.status === 400,
    );
    const list = svc.listDestinations({ userId: 1, reqId: 't' });
    assert.ok(list.some(d => d.name === 'Clinic PACS'));
  });

  it('sends a stored file to the destination via C-STORE', async () => {
    const list = svc.listDestinations({ userId: 1, reqId: 't' });
    const dest = list.find(d => d.name === 'Clinic PACS');
    const result = await svc.sendToPacs({
      destinationId: dest.id, fileIds: [fileId], userId: 1, reqId: 't',
    });
    assert.strictEqual(result.sent, 1);
    assert.strictEqual(result.failed, 0);
    assert.strictEqual(result.results[0].ok, true, result.results[0].detail);
    assert.strictEqual(scp.received.length, 1);
    assert.strictEqual(scp.received[0].sopInstanceUid, '1.2.840.pacs.dose.1');
  });

  it('reports per-file failures without aborting the batch', async () => {
    const list = svc.listDestinations({ userId: 1, reqId: 't' });
    const dest = list.find(d => d.name === 'Clinic PACS');
    const result = await svc.sendToPacs({
      destinationId: dest.id, fileIds: [fileId, 999999], userId: 1, reqId: 't',
    });
    assert.strictEqual(result.sent, 1);
    assert.strictEqual(result.failed, 1);
    assert.strictEqual(result.results[1].ok, false);
    assert.match(result.results[1].detail, /not found/);
  });

  it('updates patient demographics with validation (M5 患者编辑)', async () => {
    const patients = await import('../src/services/patientService.js');
    const updated = patients.updatePatient({
      id: 1, name: 'Pacs Test Renamed', birthDate: '1970-01-01', gender: 'F', userId: 1, reqId: 't',
    });
    assert.strictEqual(updated.name, 'Pacs Test Renamed');
    assert.strictEqual(updated.birth_date, '1970-01-01');
    assert.throws(
      () => patients.updatePatient({ id: 1, name: '', userId: 1, reqId: 't' }),
      e => e.status === 400,
    );
    assert.throws(
      () => patients.updatePatient({ id: 1, birthDate: 'not-a-date', userId: 1, reqId: 't' }),
      e => e.status === 400,
    );
    assert.throws(
      () => patients.updatePatient({ id: 999, name: 'x', userId: 1, reqId: 't' }),
      e => e.status === 404,
    );
  });
});
