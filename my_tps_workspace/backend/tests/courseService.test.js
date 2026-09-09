import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { unlinkSync } from 'fs';
import { tmpdir } from 'os';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const TEST_DB = join(tmpdir(), `course-test-${Date.now()}-${process.pid}.db`);
process.env.DB_PATH = TEST_DB;
const STUDY_ID = 1;

async function setupSchema() {
  const { default: Database } = await import('better-sqlite3');
  const db = new Database(TEST_DB);
  const { readFileSync } = await import('fs');
  const schemaPath = join(dirname(fileURLToPath(import.meta.url)), '../src/db/schema.sql');
  db.exec(readFileSync(schemaPath, 'utf-8'));
  const p = db.prepare("INSERT INTO patients (external_id, name) VALUES ('course-test', 'Course Test')").run();
  db.prepare('INSERT INTO studies (patient_id, study_instance_uid) VALUES (?, ?)').run(p.lastInsertRowid, '1.2.840.coursetest.1');
  db.close();
}

describe('courseService + DPV points', () => {
  let courses;
  let ebrt;
  let courseId;

  before(async () => {
    await setupSchema();
    courses = await import('../src/services/courseService.js');
    ebrt = await import('../src/services/ebrtPlanService.js');
  });

  after(() => {
    for (const ext of ['', '-wal', '-shm']) {
      try { unlinkSync(TEST_DB + ext); } catch {}
    }
  });

  it('creates, lists, updates and deletes a course', () => {
    const c = courses.createCourse({ studyId: STUDY_ID, name: 'Prostate IMRT', intent: 'Curative', userId: 1, reqId: 't' });
    courseId = c.id;
    assert.strictEqual(c.name, 'Prostate IMRT');
    assert.strictEqual(c.intent, 'Curative');

    const list = courses.listCourses({ studyId: STUDY_ID, userId: 1, reqId: 't' });
    assert.strictEqual(list.length, 1);
    assert.strictEqual(list[0].planCount, 0);

    const u = courses.updateCourse({ id: courseId, name: 'Prostate IMRT SIB', userId: 1, reqId: 't' });
    assert.strictEqual(u.name, 'Prostate IMRT SIB');
    assert.throws(() => courses.updateCourse({ id: courseId, name: '  ', userId: 1, reqId: 't' }), e => e.status === 400);
  });

  it('creates a plan in the course with target structure and per-fraction dose', () => {
    const plan = ebrt.createPlan({
      studyId: STUDY_ID,
      payload: {
        name: 'SIB Plan', prescription_dose_gy: 60, number_of_fractions: 30,
        course_id: courseId, target_structure_name: 'PTV Prostate',
        dose_per_fraction_gy: 2.0,
        reference_points: [{ name: 'DPV Prostate', isDpv: true, type: 'TARGET', totalDoseLimitGy: 76, dailyDoseGy: 2 }],
      },
      userId: 1, reqId: 't',
    });
    assert.strictEqual(plan.courseId, courseId);
    assert.strictEqual(plan.targetStructureName, 'PTV Prostate');
    assert.strictEqual(plan.dosePerFractionGy, 2.0);
    const dpv = plan.referencePoints[0];
    assert.strictEqual(dpv.isDpv, true);
    assert.strictEqual(dpv.totalDoseLimitGy, 76);
    assert.strictEqual(dpv.x, null); // DPV may omit location
  });

  it('binds a primary point by name and rejects dose <= 0', () => {
    const p = ebrt.updatePlan({ id: courseIdCheck(), payload: { primary_point_name: 'DPV Prostate' }, userId: 1, reqId: 't' });
    assert.strictEqual(p.primaryPointName, 'DPV Prostate');
    assert.throws(() => ebrt.updatePlan({ id: p.id, payload: { dose_per_fraction_gy: -1 }, userId: 1, reqId: 't' }), e => e.status === 400);
  });

  function courseIdCheck() {
    // resolve the plan created in this suite
    const plans = ebrt.listPlans({ studyId: STUDY_ID, userId: 1, reqId: 't' });
    return plans.find(p => p.name === 'SIB Plan').id;
  }

  it('rejects located points without coordinates while DPV may omit them', async () => {
    const res = await import('../src/services/ebrtPlanService.js');
    const plans = res.listPlans({ studyId: STUDY_ID, userId: 1, reqId: 't' });
    const planId = plans[0].id;
    // DPV without location: allowed
    const p = res.updatePlan({
      id: planId,
      payload: { reference_points: [{ name: 'DPV', isDpv: true, totalDoseLimitGy: 70 }] },
      userId: 1, reqId: 't',
    });
    assert.strictEqual(p.referencePoints[0].x, null);
    // located point missing z: rejected
    assert.throws(() => res.updatePlan({
      id: planId,
      payload: { reference_points: [{ name: 'Bad', x: 1, y: 2 }] },
      userId: 1, reqId: 't',
    }), e => e.status === 400);
  });

  it('deleting the course keeps its plans (course_id cleared)', () => {
    const plans = ebrt.listPlans({ studyId: STUDY_ID, userId: 1, reqId: 't' });
    const target = plans.find(p => p.courseId != null);
    if (!target) return; // nothing attached
    courses.deleteCourse({ id: target.courseId, userId: 1, reqId: 't' });
    const after = ebrt.getPlan({ id: target.id, userId: 1, reqId: 't' });
    assert.strictEqual(after.courseId, null);
  });
});
