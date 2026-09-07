import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { existsSync, readdirSync, unlinkSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { fileURLToPath } from 'url';

// Isolated DB for this test run — set before importing db/init.js
const TEST_DB = join(tmpdir(), `ebrt-test-${Date.now()}-${process.pid}.db`);
process.env.DB_PATH = TEST_DB;

const TEST_DATA_DIR = join(fileURLToPath(import.meta.url), '../../../../test_data/patient1');
function findTestFile(prefix) {
  if (!existsSync(TEST_DATA_DIR)) return null;
  const f = readdirSync(TEST_DATA_DIR).find(x => x.startsWith(prefix));
  return f ? join(TEST_DATA_DIR, f) : null;
}

const STUDY_ID = 1;

async function setupSchema() {
  const { default: Database } = await import('better-sqlite3');
  const db = new Database(TEST_DB);
  db.exec(`
    CREATE TABLE IF NOT EXISTS patients (id INTEGER PRIMARY KEY AUTOINCREMENT, external_id TEXT UNIQUE NOT NULL, name TEXT NOT NULL, birth_date TEXT, gender TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS studies (id INTEGER PRIMARY KEY AUTOINCREMENT, patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE, study_instance_uid TEXT UNIQUE NOT NULL, study_date TEXT, description TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS dicom_files (id INTEGER PRIMARY KEY AUTOINCREMENT, study_id INTEGER NOT NULL REFERENCES studies(id) ON DELETE CASCADE, series_instance_uid TEXT NOT NULL, sop_instance_uid TEXT UNIQUE NOT NULL, modality TEXT, instance_number INTEGER, file_path TEXT NOT NULL, file_name TEXT, file_size INTEGER, image_position_x REAL, image_position_y REAL, image_position_z REAL, pixel_spacing_x REAL, pixel_spacing_y REAL, rows INTEGER, columns INTEGER, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS audit_log (id INTEGER PRIMARY KEY AUTOINCREMENT, req_id TEXT, user_id INTEGER, action TEXT NOT NULL, resource_type TEXT, resource_id INTEGER, metadata TEXT, ip_address TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS segmentations (id INTEGER PRIMARY KEY AUTOINCREMENT, study_id INTEGER NOT NULL REFERENCES studies(id) ON DELETE CASCADE, name TEXT NOT NULL, color TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS segmentation_slices (id INTEGER PRIMARY KEY AUTOINCREMENT, segmentation_id INTEGER NOT NULL REFERENCES segmentations(id) ON DELETE CASCADE, sop_instance_uid TEXT NOT NULL, instance_number INTEGER, points_json TEXT NOT NULL, UNIQUE(segmentation_id, sop_instance_uid));
    CREATE TABLE IF NOT EXISTS ebrt_plans (id INTEGER PRIMARY KEY AUTOINCREMENT, study_id INTEGER NOT NULL REFERENCES studies(id) ON DELETE CASCADE, name TEXT NOT NULL, machine_name TEXT, energy_mv REAL, prescription_dose_gy REAL, number_of_fractions INTEGER, normalization TEXT, optimization_algorithm TEXT, dose_algorithm TEXT, grid_size_mm REAL, heterogeneity_correction INTEGER DEFAULT 0, approval_status TEXT DEFAULT 'UNAPPROVED', isocenter_x REAL, isocenter_y REAL, isocenter_z REAL, source_rtplan_file_id INTEGER REFERENCES dicom_files(id), created_at TEXT DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS ebrt_beams (id INTEGER PRIMARY KEY AUTOINCREMENT, plan_id INTEGER NOT NULL REFERENCES ebrt_plans(id) ON DELETE CASCADE, beam_number INTEGER NOT NULL, name TEXT, beam_type TEXT, energy_mv REAL, gantry_angle REAL, gantry_angle_stop REAL, collimator_angle REAL, couch_angle REAL, jaw_x1 REAL, jaw_x2 REAL, jaw_y1 REAL, jaw_y2 REAL, weight REAL DEFAULT 1, created_at TEXT DEFAULT CURRENT_TIMESTAMP, UNIQUE(plan_id, beam_number));
  `);
  const p = db.prepare("INSERT INTO patients (external_id, name) VALUES ('ebrt-test', 'EBRT Test')").run();
  db.prepare('INSERT INTO studies (patient_id, study_instance_uid) VALUES (?, ?)').run(p.lastInsertRowid, '1.2.840.ebrttest.1');
  db.close();
}

describe('ebrtPlanService', () => {
  let svc;
  let planId;
  const RP_FILE = findTestFile('RP.');

  before(async () => {
    try {
      await setupSchema();
    } catch (err) {
      console.error('setup failed:', err);
      throw err;
    }
    svc = await import('../src/services/ebrtPlanService.js');
  });

  after(() => {
    for (const ext of ['', '-wal', '-shm']) {
      try { unlinkSync(TEST_DB + ext); } catch {}
    }
  });

  it('creates a plan with defaults and validation', () => {
    const plan = svc.createPlan({
      studyId: STUDY_ID,
      payload: {
        name: 'Test IMRT',
        machine_name: 'EclipseCAP_TB',
        energy_mv: 6,
        prescription_dose_gy: 73.92,
        number_of_fractions: 33,
        optimization_algorithm: 'DMLC_IMRT',
        dose_algorithm: 'PENCIL_BEAM',
        grid_size_mm: 2,
        normalization: 'ISOCENTER',
        isocenter_x: -13.79, isocenter_y: -223.78, isocenter_z: -886.16,
      },
      userId: 1,
      reqId: 't',
    });
    assert.ok(plan.id > 0);
    assert.strictEqual(plan.name, 'Test IMRT');
    assert.strictEqual(plan.prescriptionDoseGy, 73.92);
    assert.strictEqual(plan.numberOfFractions, 33);
    assert.strictEqual(plan.approvalStatus, 'UNAPPROVED');
    assert.strictEqual(plan.beams.length, 0);
    planId = plan.id;
  });

  it('rejects invalid plan payloads', () => {
    assert.throws(() => svc.createPlan({ studyId: STUDY_ID, payload: { name: '' }, userId: 1, reqId: 't' }), e => e.status === 400);
    assert.throws(() => svc.createPlan({ studyId: STUDY_ID, payload: { name: 'x', prescription_dose_gy: -1, number_of_fractions: 1 }, userId: 1, reqId: 't' }), e => e.status === 400);
    assert.throws(() => svc.createPlan({ studyId: STUDY_ID, payload: { name: 'x', prescription_dose_gy: 1, number_of_fractions: 2.5 }, userId: 1, reqId: 't' }), e => e.status === 400);
  });

  it('adds beams with auto-incrementing numbers and validation', () => {
    const p = svc.addBeam({
      planId,
      payload: { beam_type: 'STATIC', gantry_angle: 0, jaw_x1: -50, jaw_x2: 50, jaw_y1: -50, jaw_y2: 50 },
      userId: 1, reqId: 't',
    });
    assert.strictEqual(p.beams.length, 1);
    assert.strictEqual(p.beams[0].beamNumber, 1);

    const p2 = svc.addBeam({
      planId,
      payload: { name: 'Arc 1', beam_type: 'VMAT', gantry_angle: 200, gantry_angle_stop: 160, weight: 0.5 },
      userId: 1, reqId: 't',
    });
    const arc = p2.beams.find(b => b.beamNumber === 2);
    assert.strictEqual(arc.beamType, 'VMAT');
    assert.strictEqual(arc.gantryAngle, 200);
    assert.strictEqual(arc.gantryAngleStop, 160);

    assert.throws(() => svc.addBeam({
      planId, payload: { beam_type: 'BADC', gantry_angle: 0 }, userId: 1, reqId: 't',
    }), e => e.status === 400);
    assert.throws(() => svc.addBeam({
      planId, payload: { beam_type: 'STATIC', jaw_x1: -999 }, userId: 1, reqId: 't',
    }), e => e.status === 400);
  });

  it('updates plan and beam fields', () => {
    const p = svc.updatePlan({ id: planId, payload: { approval_status: 'APPROVED' }, userId: 1, reqId: 't' });
    assert.strictEqual(p.approvalStatus, 'APPROVED');
    assert.throws(() => svc.updatePlan({ id: planId, payload: { approval_status: 'NOPE' }, userId: 1, reqId: 't' }), e => e.status === 400);
  });

  it('deletes a beam and a plan', () => {
    const p = svc.deleteBeam({ beamId: (svc.getPlan({ id: planId, userId: 1, reqId: 't' }).beams[1].id), userId: 1, reqId: 't' });
    assert.strictEqual(p.beams.length, 1);
    const result = svc.deletePlan({ id: planId, userId: 1, reqId: 't' });
    assert.strictEqual(result.ok, true);
    assert.throws(() => svc.getPlan({ id: planId, userId: 1, reqId: 't' }), e => e.status === 404);
  });

  describe('import from real RTPLAN', () => {
    before(async () => {
      if (!RP_FILE) return;
      // register the RP file as a dicom_files row pointing at the real file
      const { default: Database } = await import('better-sqlite3');
      const db = new Database(TEST_DB);
      db.prepare(`
        INSERT INTO dicom_files (study_id, series_instance_uid, sop_instance_uid, modality, file_path, file_name)
        VALUES (?, '1.2.840.rtplan.series', '1.2.246.352.71.5.891085747523.430.20240606031847', 'RTPLAN', ?, 'RP.test.dcm')
      `).run(STUDY_ID, RP_FILE);
      db.close();
    });

    it('imports the 9-field IMRT plan as an editable copy', async (ctx) => {
      if (!RP_FILE) return ctx.skip('test_data RTPLAN not available');
      // the RTPLAN file id is the row we just inserted (id 1 in the fresh DB)
      const { default: Database } = await import('better-sqlite3');
      const db = new Database(TEST_DB, { readonly: true });
      const rpRow = db.prepare("SELECT id FROM dicom_files WHERE modality = 'RTPLAN'").get();
      db.close();

      const plan = await svc.createPlanFromRTPlan({ studyId: STUDY_ID, fileId: rpRow.id, userId: 1, reqId: 't' });
      assert.strictEqual(plan.name, 'test 9f');
      assert.ok(Math.abs(plan.prescriptionDoseGy - 73.92) < 1e-6);
      assert.strictEqual(plan.numberOfFractions, 33);
      assert.strictEqual(plan.beams.length, 9);
      assert.deepStrictEqual(plan.beams.map(b => b.gantryAngle), [0, 40, 80, 120, 160, 200, 240, 280, 320]);
      assert.ok(Math.abs(plan.isocenterX - (-13.786471902499)) < 1e-6);
      // weights sum to ~1 (fraction of prescription)
      const wSum = plan.beams.reduce((a, b) => a + b.weight, 0);
      assert.ok(Math.abs(wSum - 1) < 0.01, `weights should sum to ~1, got ${wSum}`);
      // jaws migrated
      assert.ok(Math.abs(plan.beams[0].jawX1 - (-111.125)) < 1e-3);
    });

    it('rejects import from non-RTPLAN files', async () => {
      const { default: Database } = await import('better-sqlite3');
      const db = new Database(TEST_DB);
      db.prepare(`
        INSERT INTO dicom_files (study_id, series_instance_uid, sop_instance_uid, modality, file_path, file_name)
        VALUES (?, 's', 'sop-notplan', 'CT', '/tmp/none.dcm', 'x.dcm')
      `).run(STUDY_ID);
      const ctRow = db.prepare("SELECT id FROM dicom_files WHERE sop_instance_uid = 'sop-notplan'").get();
      db.close();
      await assert.rejects(
        svc.createPlanFromRTPlan({ studyId: STUDY_ID, fileId: ctRow.id, userId: 1, reqId: 't' }),
        e => e.status === 400
      );
    });
  });
});
