import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { unlinkSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

// Isolated DB for this test run — must be set before importing db/init.js
const TEST_DB = join(tmpdir(), `seg-test-${Date.now()}-${process.pid}.db`);
process.env.DB_PATH = TEST_DB;

const STUDY_ID = 1;

async function setupStudy() {
  const { getDb } = await import('../src/db/init.js');
  const db = getDb();
  db.prepare(`
    INSERT INTO studies (patient_id, study_instance_uid)
    VALUES ((INSERT OR IGNORE INTO patients (external_id, name) VALUES ('seg-test', 'Seg Test');
             SELECT last_insert_rowid()), '1.2.840.segtest.1')
  `).run?.();
  db.close();
}

describe('segmentationService CRUD', () => {
  let svc;
  let segId;

  before(async () => {
    try {
      const { default: Database } = await import('better-sqlite3');
      const db = new Database(TEST_DB);
      db.exec(`
        CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, name TEXT NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
        CREATE TABLE IF NOT EXISTS patients (id INTEGER PRIMARY KEY AUTOINCREMENT, external_id TEXT UNIQUE NOT NULL, name TEXT NOT NULL, birth_date TEXT, gender TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
        CREATE TABLE IF NOT EXISTS studies (id INTEGER PRIMARY KEY AUTOINCREMENT, patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE, study_instance_uid TEXT UNIQUE NOT NULL, study_date TEXT, description TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
        CREATE TABLE IF NOT EXISTS dicom_files (id INTEGER PRIMARY KEY AUTOINCREMENT, study_id INTEGER NOT NULL REFERENCES studies(id) ON DELETE CASCADE, series_instance_uid TEXT NOT NULL, sop_instance_uid TEXT UNIQUE NOT NULL, modality TEXT, instance_number INTEGER, file_path TEXT NOT NULL, file_name TEXT, file_size INTEGER, image_position_x REAL, image_position_y REAL, image_position_z REAL, pixel_spacing_x REAL, pixel_spacing_y REAL, rows INTEGER, columns INTEGER, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
        CREATE TABLE IF NOT EXISTS audit_log (id INTEGER PRIMARY KEY AUTOINCREMENT, req_id TEXT, user_id INTEGER, action TEXT NOT NULL, resource_type TEXT, resource_id INTEGER, metadata TEXT, ip_address TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
        CREATE TABLE IF NOT EXISTS segmentations (id INTEGER PRIMARY KEY AUTOINCREMENT, study_id INTEGER NOT NULL REFERENCES studies(id) ON DELETE CASCADE, name TEXT NOT NULL, color TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
        CREATE TABLE IF NOT EXISTS segmentation_slices (id INTEGER PRIMARY KEY AUTOINCREMENT, segmentation_id INTEGER NOT NULL REFERENCES segmentations(id) ON DELETE CASCADE, sop_instance_uid TEXT NOT NULL, instance_number INTEGER, points_json TEXT NOT NULL, UNIQUE(segmentation_id, sop_instance_uid));
      `);
      const p = db.prepare("INSERT INTO patients (external_id, name) VALUES ('seg-test', 'Seg Test')").run();
      db.prepare('INSERT INTO studies (patient_id, study_instance_uid) VALUES (?, ?)').run(p.lastInsertRowid, '1.2.840.segtest.1');
      db.close();
    } catch (err) {
      console.error('before-hook failed:', err);
      throw err;
    }
    svc = await import('../src/services/segmentationService.js');
  });

  after(() => {
    try { unlinkSync(TEST_DB); } catch {}
    try { unlinkSync(TEST_DB + '-wal'); } catch {}
    try { unlinkSync(TEST_DB + '-shm'); } catch {}
  });

  it('creates a segmentation', () => {
    const row = svc.createSegmentation({ studyId: STUDY_ID, name: 'GTV', color: '#ff5c5c', userId: 1, reqId: 't' });
    assert.ok(row.id > 0);
    assert.strictEqual(row.name, 'GTV');
    assert.strictEqual(row.studyId, STUDY_ID);
    assert.strictEqual(row.sliceCount, 0);
    segId = row.id;
  });

  it('lists segmentations of a study', () => {
    svc.createSegmentation({ studyId: STUDY_ID, name: 'CTV', color: '#5cc8ff', userId: 1, reqId: 't' });
    const rows = svc.listSegmentations({ studyId: STUDY_ID, userId: 1, reqId: 't' });
    assert.strictEqual(rows.length, 2);
  });

  it('saves and loads contours (replace-all roundtrip)', () => {
    const slices = [
      {
        sopInstanceUID: '1.2.840.sop.1',
        instanceNumber: 43,
        contours: [[-227.5, -310.0, -931.3, -225.0, -310.0, -931.3, -222.5, -310.0, -931.3]],
      },
      {
        sopInstanceUID: '1.2.840.sop.2',
        instanceNumber: 44,
        contours: [
          [-220.0, -308.0, -928.3],
          [-218.0, -306.0, -928.3, -216.0, -304.0, -928.3],
        ],
      },
    ];
    const saved = svc.saveContours({ id: segId, slices, userId: 1, reqId: 't' });
    assert.strictEqual(saved.sliceCount, 2);

    const loaded = svc.getContours({ id: segId, userId: 1, reqId: 't' });
    assert.strictEqual(loaded.slices.length, 2);
    assert.strictEqual(loaded.slices[0].sopInstanceUID, '1.2.840.sop.1');
    assert.strictEqual(loaded.slices[0].instanceNumber, 43);
    assert.deepStrictEqual(loaded.slices[0].contours, slices[0].contours);
    assert.deepStrictEqual(loaded.slices[1].contours, slices[1].contours);
  });

  it('replace-all clears previous slices before writing', () => {
    const saved = svc.saveContours({
      id: segId,
      slices: [{ sopInstanceUID: '1.2.840.sop.9', instanceNumber: 1, contours: [[0, 0, 0]] }],
      userId: 1,
      reqId: 't',
    });
    assert.strictEqual(saved.sliceCount, 1);
    const loaded = svc.getContours({ id: segId, userId: 1, reqId: 't' });
    assert.strictEqual(loaded.slices.length, 1);
    assert.strictEqual(loaded.slices[0].sopInstanceUID, '1.2.840.sop.9');
  });

  it('renames via updateSegmentationMeta', () => {
    const row = svc.updateSegmentationMeta({ id: segId, name: 'GTV-primary', color: '#00ff00', userId: 1, reqId: 't' });
    assert.strictEqual(row.name, 'GTV-primary');
    assert.strictEqual(row.color, '#00ff00');
  });

  it('rejects invalid contour payloads', () => {
    assert.match(svc.validateSlicesPayload('nope').error, /must be an array/);
    assert.match(svc.validateSlicesPayload([{ sopInstanceUID: 'x', contours: [[1, 2, 3, 4]] }]).error, /length % 3/);
    assert.match(svc.validateSlicesPayload([{ sopInstanceUID: '', contours: [] }]).error, /sopInstanceUID/);
    assert.match(svc.validateSlicesPayload([{ sopInstanceUID: 'x', contours: [['a', 'b', 'c']] }]).error, /finite numbers/);
  });

  it('throws 404 for unknown segmentation', () => {
    assert.throws(
      () => svc.getContours({ id: 999999, userId: 1, reqId: 't' }),
      (err) => err.status === 404
    );
  });

  it('deletes a segmentation (slices cascade)', () => {
    const result = svc.deleteSegmentation({ id: segId, userId: 1, reqId: 't' });
    assert.strictEqual(result.ok, true);
    const rows = svc.listSegmentations({ studyId: STUDY_ID, userId: 1, reqId: 't' });
    assert.strictEqual(rows.length, 1);
  });
});
