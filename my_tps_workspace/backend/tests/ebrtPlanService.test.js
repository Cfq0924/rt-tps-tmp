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
  const { readFileSync } = await import('fs');
  const { dirname } = await import('path');
  const schemaPath = join(dirname(fileURLToPath(import.meta.url)), '../src/db/schema.sql');
  db.exec(readFileSync(schemaPath, 'utf-8'));
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

  it('stores optimization objectives (workflow bridge)', () => {
    const objectives = [
      { structureName: 'PTV', type: 'TARGET_UPPER', dosePct: 102, volumePct: 0 },
      { structureName: 'PTV', type: 'TARGET_LOWER', dosePct: 95, volumePct: 100 },
      { structureName: 'Cord', type: 'MAX_DOSE', dosePct: 45, volumePct: 0 },
    ];
    const updated = svc.updatePlan({
      id: planId, payload: { optimization_objectives_json: objectives }, userId: 1, reqId: 't',
    });
    assert.deepStrictEqual(updated.optimizationObjectives, objectives);
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

  describe('reference points', () => {
    let refPlanId;

    it('creates a plan with reference points and returns them parsed', () => {
      const p = svc.createPlan({
        studyId: STUDY_ID,
        payload: {
          name: 'RefPt Plan', prescription_dose_gy: 60, number_of_fractions: 30,
          reference_points: [
            { name: 'cord', x: 1.5, y: -220, z: -880 },
            { name: 'parotid L', x: 60, y: -210, z: -882 },
          ],
        },
        userId: 1, reqId: 't',
      });
      assert.strictEqual(p.referencePoints.length, 2);
      assert.strictEqual(p.referencePoints[0].name, 'cord');
      assert.ok(Math.abs(p.referencePoints[0].x - 1.5) < 1e-9);
      refPlanId = p.id;
    });

    it('rejects invalid reference points', () => {
      assert.throws(() => svc.updatePlan({
        id: refPlanId, payload: { reference_points: [{ x: 1, y: 2, z: 3 }] }, userId: 1, reqId: 't',
      }), e => e.status === 400); // missing name
      assert.throws(() => svc.updatePlan({
        id: refPlanId, payload: { reference_points: [{ name: 'x', y: 2, z: 3 }] }, userId: 1, reqId: 't',
      }), e => e.status === 400); // missing x
      assert.throws(() => svc.updatePlan({
        id: refPlanId, payload: { reference_points: 'nope' }, userId: 1, reqId: 't',
      }), e => e.status === 400);
    });

    it('updates and clears reference points via PATCH', () => {
      const p = svc.updatePlan({
        id: refPlanId,
        payload: { reference_points: [{ name: 'new pt', x: 0, y: 0, z: 0 }] },
        userId: 1, reqId: 't',
      });
      assert.strictEqual(p.referencePoints.length, 1);
      const cleared = svc.updatePlan({ id: refPlanId, payload: { reference_points: [] }, userId: 1, reqId: 't' });
      assert.strictEqual(cleared.referencePoints.length, 0);
    });
  });

  describe('wedge and bolus beam fields', () => {
    let wedgePlanId;

    it('stores wedge_angle and bolus on a beam', () => {
      const created = svc.createPlan({
        studyId: STUDY_ID,
        payload: { name: 'Wedge Plan', prescription_dose_gy: 50, number_of_fractions: 25 },
        userId: 1, reqId: 't',
      });
      wedgePlanId = created.id;
      const p = svc.addBeam({
        planId: wedgePlanId,
        payload: { beam_type: 'STATIC', gantry_angle: 90, wedge_angle: 45, bolus: '5mm gel' },
        userId: 1, reqId: 't',
      });
      const beam = p.beams.find(b => b.gantryAngle === 90);
      assert.strictEqual(beam.wedgeAngle, 45);
      assert.strictEqual(beam.bolus, '5mm gel');
    });

    it('rejects out-of-range wedge angles', () => {
      assert.throws(() => svc.addBeam({
        planId: wedgePlanId, payload: { beam_type: 'STATIC', wedge_angle: 400 }, userId: 1, reqId: 't',
      }), e => e.status === 400);
    });

    it('updates wedge/bolus via beam PATCH', () => {
      const plan = svc.getPlan({ id: wedgePlanId, userId: 1, reqId: 't' });
      const beam = plan.beams[0];
      const p = svc.updateBeam({ beamId: beam.id, payload: { wedge_angle: 30, bolus: null }, userId: 1, reqId: 't' });
      const updated = p.beams.find(b => b.id === beam.id);
      assert.strictEqual(updated.wedgeAngle, 30);
      assert.strictEqual(updated.bolus, null);
    });
  });

  describe('plan templates', () => {
    let template;

    it('saves a plan as a template with beams, then instantiates it into a study', () => {
      const created = svc.createPlan({
        studyId: STUDY_ID,
        payload: { name: 'Template source', prescription_dose_gy: 70, number_of_fractions: 35 },
        userId: 1, reqId: 't',
      });
      svc.addBeam({ planId: created.id, payload: { beam_type: 'STATIC', gantry_angle: 0 }, userId: 1, reqId: 't' });
      svc.addBeam({ planId: created.id, payload: { beam_type: 'STATIC', gantry_angle: 180 }, userId: 1, reqId: 't' });

      template = svc.savePlanAsTemplate({ planId: created.id, name: 'Head & Neck basic', userId: 1, reqId: 't' });
      assert.strictEqual(template.isTemplate, 1);
      assert.strictEqual(template.name, 'Head & Neck basic');
      assert.strictEqual(template.approvalStatus, 'UNAPPROVED');
      assert.strictEqual(template.beams.length, 2);

      const templates = svc.listTemplates({ userId: 1, reqId: 't' });
      assert.ok(templates.some(t => t.id === template.id));

      const plan = svc.instantiateTemplate({ templateId: template.id, studyId: STUDY_ID, userId: 1, reqId: 't' });
      assert.strictEqual(plan.isTemplate, 0);
      assert.strictEqual(plan.name, 'Head & Neck basic copy');
      assert.strictEqual(plan.sourcePlanId, template.id);
      assert.strictEqual(plan.beams.length, 2);
      assert.deepStrictEqual(plan.beams.map(b => b.beamNumber), [1, 2]);
    });

    it('rejects instantiation from a non-template plan', () => {
      assert.throws(() => svc.instantiateTemplate({ templateId: planId, studyId: STUDY_ID, userId: 1, reqId: 't' }), e => e.status === 400);
    });

    it('hides templates from the study plan list', () => {
      const plans = svc.listPlans({ studyId: STUDY_ID, userId: 1, reqId: 't' });
      assert.ok(plans.every(p => !p.isTemplate));
    });
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

    it('persists per-control-point delivery data (incl. MLC) on import', async () => {
      if (!RP_FILE) return; // same skip condition as above
      const { default: Database } = await import('better-sqlite3');
      const db = new Database(TEST_DB, { readonly: true });
      const rpRow = db.prepare("SELECT id FROM dicom_files WHERE sop_instance_uid = '1.2.246.352.71.5.891085747523.430.20240606031847'").get();
      const plan = db.prepare(`
        SELECT p.id FROM ebrt_plans p
        JOIN dicom_files f ON f.id = p.source_rtplan_file_id
        WHERE f.sop_instance_uid = '1.2.246.352.71.5.891085747523.430.20240606031847'
      `).get();
      const cpCounts = db.prepare(`
        SELECT b.beam_number as n, COUNT(c.id) as cps,
               SUM(CASE WHEN c.mlc_json IS NOT NULL THEN 1 ELSE 0 END) as withMlc
        FROM ebrt_beams b LEFT JOIN beam_control_points c ON c.beam_id = b.id
        WHERE b.plan_id = ? GROUP BY b.id ORDER BY b.beam_number
      `).all(plan.id);
      db.close();
      assert.strictEqual(cpCounts.length, 9);
      assert.ok(cpCounts.every(c => c.cps > 0), 'every beam has control points');
      assert.ok(cpCounts.some(c => c.withMlc > 0), 'IMRT beams carry MLC positions');
      void rpRow;
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
