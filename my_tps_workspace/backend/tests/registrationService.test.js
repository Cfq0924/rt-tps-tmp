import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { unlinkSync } from 'fs';
import { tmpdir } from 'os';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const TEST_DB = join(tmpdir(), `registration-test-${Date.now()}-${process.pid}.db`);
process.env.DB_PATH = TEST_DB;

const STUDY_ID = 1;
const FIXED = '1.2.840.fixed.series';
const MOVING = '1.2.840.moving.series';
const IDENTITY = [[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1]];
const SHIFTED = [[1, 0, 0, 2.5], [0, 1, 0, -1.25], [0, 0, 1, 0], [0, 0, 0, 1]];

async function setupSchema() {
  const { default: Database } = await import('better-sqlite3');
  const db = new Database(TEST_DB);
  const { readFileSync } = await import('fs');
  const schemaPath = join(dirname(fileURLToPath(import.meta.url)), '../src/db/schema.sql');
  db.exec(readFileSync(schemaPath, 'utf-8'));
  const p = db.prepare("INSERT INTO patients (external_id, name) VALUES ('reg-test', 'Registration Test')").run();
  db.prepare('INSERT INTO studies (patient_id, study_instance_uid) VALUES (?, ?)').run(p.lastInsertRowid, '1.2.840.regtest.1');
  db.close();
}

describe('registrationService', () => {
  let svc;

  before(async () => {
    await setupSchema();
    svc = await import('../src/services/registrationService.js');
  });

  after(() => {
    for (const ext of ['', '-wal', '-shm']) {
      try { unlinkSync(TEST_DB + ext); } catch {}
    }
  });

  it('saves and reads back a registration with the matrix intact', () => {
    const reg = svc.saveRegistration({
      studyId: STUDY_ID, fixedSeriesUid: FIXED, movingSeriesUid: MOVING,
      matrix: SHIFTED, method: 'MANUAL', notes: 'manual slide', userId: 1, reqId: 't',
    });
    assert.ok(reg.id > 0);
    assert.deepStrictEqual(reg.matrix, SHIFTED);
    assert.strictEqual(reg.method, 'MANUAL');
    const fetched = svc.getRegistration({ id: reg.id, userId: 1, reqId: 't' });
    assert.deepStrictEqual(fetched.matrix, SHIFTED);
  });

  it('returns the latest row for a pair', () => {
    svc.saveRegistration({
      studyId: STUDY_ID, fixedSeriesUid: FIXED, movingSeriesUid: MOVING,
      matrix: IDENTITY, method: 'AUTO_CENTROID', userId: 1, reqId: 't',
    });
    const latest = svc.getLatestRegistration({
      studyId: STUDY_ID, fixedSeriesUid: FIXED, movingSeriesUid: MOVING, userId: 1, reqId: 't',
    });
    assert.deepStrictEqual(latest.matrix, IDENTITY);
    assert.strictEqual(latest.method, 'AUTO_CENTROID');
  });

  it('returns null when a pair has no registration', () => {
    const none = svc.getLatestRegistration({
      studyId: STUDY_ID, fixedSeriesUid: 'a', movingSeriesUid: 'b', userId: 1, reqId: 't',
    });
    assert.strictEqual(none, null);
  });

  it('lists all registrations of a study newest first', () => {
    const rows = svc.listRegistrations({ studyId: STUDY_ID, userId: 1, reqId: 't' });
    assert.strictEqual(rows.length, 2);
    assert.strictEqual(rows[0].method, 'AUTO_CENTROID');
    assert.ok(rows[0].id > rows[1].id);
  });

  it('persists derived-series provenance (Phase 4 M1)', () => {
    const geometry = { cols: 64, rows: 64, numSlices: 8, spacingX: 2, spacingY: 2, originX: -64, originY: -64, zPositions: [0, -2, -4] };
    const derived = svc.createDerivedSeries({
      studyId: STUDY_ID, registrationId: 1, fixedSeriesUid: FIXED, movingSeriesUid: MOVING,
      seriesUid: '2.25.1234', description: 'Registered',
      geometry, matrix: SHIFTED, userId: 1, reqId: 't',
    });
    assert.ok(derived.id > 0);
    assert.strictEqual(derived.seriesUid, '2.25.1234');
    assert.strictEqual(derived.kind, 'REGISTERED_SERIES');
    assert.deepStrictEqual(derived.matrix, SHIFTED);
    assert.strictEqual(derived.geometry.cols, 64);
    const list = svc.listDerivedSeries({ studyId: STUDY_ID, userId: 1, reqId: 't' });
    assert.strictEqual(list.length, 1);
    assert.throws(
      () => svc.createDerivedSeries({ studyId: STUDY_ID, seriesUid: '', matrix: SHIFTED, geometry, userId: 1, reqId: 't' }),
      e => e.status === 400,
    );
    assert.throws(
      () => svc.createDerivedSeries({ studyId: STUDY_ID, seriesUid: 'x', matrix: [[1, 0], [0, 1]], geometry, userId: 1, reqId: 't' }),
      e => e.status === 400,
    );
  });

  it('validates matrix shape, values and method', () => {
    const base = { studyId: STUDY_ID, fixedSeriesUid: FIXED, movingSeriesUid: MOVING, userId: 1, reqId: 't' };
    assert.throws(() => svc.saveRegistration({ ...base, matrix: [[1, 0], [0, 1]] }), e => e.status === 400);
    assert.throws(() => svc.saveRegistration({ ...base, matrix: [[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0, NaN]] }), e => e.status === 400);
    assert.throws(() => svc.saveRegistration({ ...base, matrix: 'identity' }), e => e.status === 400);
    assert.throws(() => svc.saveRegistration({ ...base, matrix: IDENTITY, method: 'MAGIC' }), e => e.status === 400);
    assert.throws(() => svc.saveRegistration({ ...base, matrix: IDENTITY, fixedSeriesUid: '' }), e => e.status === 400);
  });
});
