import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { unlinkSync } from 'fs';
import { tmpdir } from 'os';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const TEST_DB = join(tmpdir(), `approval-test-${Date.now()}-${process.pid}.db`);
process.env.DB_PATH = TEST_DB;
const STUDY_ID = 1;

async function setupSchema() {
  const { default: Database } = await import('better-sqlite3');
  const db = new Database(TEST_DB);
  const { readFileSync } = await import('fs');
  const schemaPath = join(dirname(fileURLToPath(import.meta.url)), '../src/db/schema.sql');
  db.exec(readFileSync(schemaPath, 'utf-8'));
  const p = db.prepare("INSERT INTO patients (external_id, name) VALUES ('appr-test', 'Approval Test')").run();
  db.prepare('INSERT INTO studies (patient_id, study_instance_uid) VALUES (?, ?)').run(p.lastInsertRowid, '1.2.840.apprtest.1');
}

describe('approval hardening + revisions (B6)', () => {
  let ebrt;
  let planId;

  before(async () => {
    await setupSchema();
    ebrt = await import('../src/services/ebrtPlanService.js');
  });

  after(() => {
    for (const ext of ['', '-wal', '-shm']) {
      try { unlinkSync(TEST_DB + ext); } catch {}
    }
  });


  it('approvalChecks flag a plan without beams as error', async () => {
    const db = (await import('../src/db/init.js')).getDb();
    const info = db.prepare(`
      INSERT INTO ebrt_plans (study_id, name, prescription_dose_gy, number_of_fractions, approval_status)
      VALUES (?, 'No Beams', 60, 30, 'REVIEWED')
    `).run(STUDY_ID);
    const checks = ebrt.approvalChecks({ planId: info.lastInsertRowid, userId: 1, reqId: 't' });
    assert.ok(checks.errors.some(e => /no beams/i.test(e)));
    assert.strictEqual(checks.canApprove, false);
  });

  it('blocks the approval transition when errors exist', async () => {
    const db = (await import('../src/db/init.js')).getDb();
    const info = db.prepare(`
      INSERT INTO ebrt_plans (study_id, name, prescription_dose_gy, number_of_fractions, approval_status, isocenter_x, isocenter_y, isocenter_z)
      VALUES (?, 'NoIso Plan', 60, 30, 'REVIEWED', NULL, NULL, NULL)
    `).run(STUDY_ID);
    await assert.rejects(
      async () => ebrt.updatePlan({ id: info.lastInsertRowid, payload: { approval_status: 'APPROVED' }, userId: 1, reqId: 't' }),
      e => e.status === 400 && /Cannot approve/.test(e.message),
    );
  });

  it('captures a revision snapshot when approving', async () => {
    const db = (await import('../src/db/init.js')).getDb();
    const info = db.prepare(`
      INSERT INTO ebrt_plans (study_id, name, prescription_dose_gy, number_of_fractions, approval_status, isocenter_x, isocenter_y, isocenter_z)
      VALUES (?, 'Snap Plan', 60, 30, 'REVIEWED', 1, 2, 3)
    `).run(STUDY_ID);
    db.prepare(`
      INSERT INTO ebrt_beams (plan_id, beam_number, name, beam_type, gantry_angle, jaw_x1, jaw_x2, jaw_y1, jaw_y2, weight)
      VALUES (?, 1, 'AP', 'STATIC', 0, -50, 50, -50, 50, 1)
    `).run(info.lastInsertRowid);

    const snapPlanId = info.lastInsertRowid;
    const revNo = ebrt.captureRevision({ planId: snapPlanId, userId: 1, reqId: 't' });
    assert.strictEqual(revNo, 1);
    const rev = ebrt.getRevision({ planId: snapPlanId, revisionNo: revNo, userId: 1, reqId: 't' });
    assert.strictEqual(rev.snapshot.plan.name, 'Snap Plan');
    assert.strictEqual(rev.snapshot.beams.length, 1);
    void snapPlanId;
  });

  it('rolls a plan back to a revision and records the rollback', async () => {
    const db = (await import('../src/db/init.js')).getDb();
    const info = db.prepare(`
      INSERT INTO ebrt_plans (study_id, name, prescription_dose_gy, number_of_fractions, isocenter_x, isocenter_y, isocenter_z)
      VALUES (?, 'Rollback Plan', 60, 30, 1, 2, 3)
    `).run(STUDY_ID);
    db.prepare(`
      INSERT INTO ebrt_beams (plan_id, beam_number, name, beam_type, gantry_angle, jaw_x1, jaw_x2, jaw_y1, jaw_y2, weight)
      VALUES (?, 1, 'Original', 'STATIC', 0, -50, 50, -50, 50, 1)
    `).run(info.lastInsertRowid);
    const rbPlanId = info.lastInsertRowid;

    const revNo = ebrt.captureRevision({ planId: rbPlanId, userId: 1, reqId: 't' });

    // mutate: rename + replace the beam
    ebrt.updatePlan({ id: rbPlanId, payload: { name: 'Mutated' }, userId: 1, reqId: 't' });
    const mutated = ebrt.getPlan({ id: rbPlanId, userId: 1, reqId: 't' });
    assert.strictEqual(mutated.name, 'Mutated');
    ebrt.deleteBeam({ beamId: mutated.beams[0].id, userId: 1, reqId: 't' });
    assert.strictEqual(ebrt.getPlan({ id: rbPlanId, userId: 1, reqId: 't' }).beams.length, 0);

    const plan = ebrt.rollbackToRevision({ planId: rbPlanId, revisionNo: revNo, userId: 1, reqId: 't' });
    assert.strictEqual(plan.name, 'Rollback Plan');
    assert.strictEqual(plan.beams.length, 1);
    assert.strictEqual(plan.beams[0].name, 'Original');

    const revs = ebrt.listRevisions({ planId: rbPlanId, userId: 1, reqId: 't' });
    assert.strictEqual(revs.length, 2); // snapshot + rollback head
  });

  it('delta couch patch stores the shift as JSON', async () => {
    const db = (await import('../src/db/init.js')).getDb();
    const info = db.prepare(`
      INSERT INTO ebrt_plans (study_id, name, prescription_dose_gy, number_of_fractions)
      VALUES (?, 'Delta Plan', 60, 30)
    `).run(STUDY_ID);
    const p = ebrt.updatePlan({
      id: info.lastInsertRowid,
      payload: { delta_couch_json: { x: 0.4, y: -1.2, z: 0, rotation: 0 } },
      userId: 1, reqId: 't',
    });
    assert.deepStrictEqual(p.deltaCouch, { x: 0.4, y: -1.2, z: 0, rotation: 0 });
  });
});
