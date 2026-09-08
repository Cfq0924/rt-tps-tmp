import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { unlinkSync } from 'fs';
import { tmpdir } from 'os';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// Isolated DB for this test run — set before importing db/init.js
const TEST_DB = join(tmpdir(), `peer-review-test-${Date.now()}-${process.pid}.db`);
process.env.DB_PATH = TEST_DB;

const STUDY_ID = 1;

async function setupSchema() {
  const { default: Database } = await import('better-sqlite3');
  const db = new Database(TEST_DB);
  const { readFileSync } = await import('fs');
  const schemaPath = join(dirname(fileURLToPath(import.meta.url)), '../src/db/schema.sql');
  db.exec(readFileSync(schemaPath, 'utf-8'));

  const p = db.prepare("INSERT INTO patients (external_id, name) VALUES ('PR-test', 'Peer Review Test')").run();
  db.prepare('INSERT INTO studies (patient_id, study_instance_uid) VALUES (?, ?)').run(p.lastInsertRowid, '1.2.840.prtest.1');

  // three plans: REVIEWED (reviewable), UNAPPROVED (blocked), APPROVED (blocked)
  db.prepare(`
    INSERT INTO ebrt_plans (study_id, name, prescription_dose_gy, number_of_fractions, approval_status)
    VALUES (?, 'Reviewed Plan', 60, 30, 'REVIEWED')
  `).run(STUDY_ID);
  db.prepare(`
    INSERT INTO ebrt_plans (study_id, name, prescription_dose_gy, number_of_fractions, approval_status)
    VALUES (?, 'Draft Plan', 60, 30, 'UNAPPROVED')
  `).run(STUDY_ID);
  db.prepare(`
    INSERT INTO ebrt_plans (study_id, name, prescription_dose_gy, number_of_fractions, approval_status)
    VALUES (?, 'Approved Plan', 60, 30, 'APPROVED')
  `).run(STUDY_ID);

  // a user for author-name resolution
  db.prepare("INSERT INTO users (email, password_hash, name) VALUES ('reviewer@tps.local', 'x', 'Dr. Reviewer')").run();

  db.close();
}

describe('peerReviewService', () => {
  let svc;
  let ebrt;
  let reviewedPlanId;
  let sessionId;

  before(async () => {
    await setupSchema();
    svc = await import('../src/services/peerReviewService.js');
    ebrt = await import('../src/services/ebrtPlanService.js');
    const db = (await import('../src/db/init.js')).getDb();
    reviewedPlanId = db.prepare("SELECT id FROM ebrt_plans WHERE name = 'Reviewed Plan'").get().id;
  });

  after(() => {
    for (const ext of ['', '-wal', '-shm']) {
      try { unlinkSync(TEST_DB + ext); } catch {}
    }
  });

  it('opens a session on a REVIEWED plan', () => {
    const session = svc.createSession({ planId: reviewedPlanId, userId: 1, userEmail: 'reviewer@tps.local', reqId: 't' });
    assert.strictEqual(session.status, 'OPEN');
    assert.strictEqual(session.planApprovalStatus, 'REVIEWED');
    assert.strictEqual(session.comments.length, 0);
    sessionId = session.id;
  });

  it('rejects sessions on non-REVIEWED plans and duplicate OPEN sessions', async () => {
    const db = (await import('../src/db/init.js')).getDb();
    const draft = db.prepare("SELECT id FROM ebrt_plans WHERE name = 'Draft Plan'").get().id;
    const approved = db.prepare("SELECT id FROM ebrt_plans WHERE name = 'Approved Plan'").get().id;
    assert.throws(() => svc.createSession({ planId: draft, userId: 1, reqId: 't' }), e => e.status === 400);
    assert.throws(() => svc.createSession({ planId: approved, userId: 1, reqId: 't' }), e => e.status === 400);
    assert.throws(() => svc.createSession({ planId: reviewedPlanId, userId: 1, reqId: 't' }), e => e.status === 409);
  });

  it('adds comments with optional location pins', () => {
    const s1 = svc.addComment({
      sessionId, userId: 1, userEmail: 'reviewer@tps.local', reqId: 't',
      text: 'Cord dose looks too hot on slice 40',
      location: { sliceIdx: 40, beamNumber: 2 },
    });
    const s2 = svc.addComment({
      sessionId, userId: 1, userEmail: 'reviewer@tps.local', reqId: 't',
      text: 'Parotid contour spills into PTV on slice 52',
      location: { sliceIdx: 52, structureId: 7 },
    });
    assert.strictEqual(s2.comments.length, 2);
    assert.strictEqual(s2.comments[0].authorName, 'Dr. Reviewer');
    assert.deepStrictEqual(s2.comments[0].location, { sliceIdx: 40, beamNumber: 2 });

    assert.throws(() => svc.addComment({ sessionId, userId: 1, reqId: 't', text: '   ' }), e => e.status === 400);
    assert.throws(() => svc.addComment({ sessionId, userId: 1, reqId: 't', text: 'x', location: { sliceIdx: -1 } }), e => e.status === 400);
    assert.throws(() => svc.addComment({ sessionId, userId: 1, reqId: 't', text: 'x', location: { evil: 1 } }), e => e.status === 400);
  });

  it('lists and fetches sessions', () => {
    const open = svc.listSessions({ status: 'OPEN', userId: 1, reqId: 't' });
    assert.ok(open.some(s => s.id === sessionId && s.commentCount === 2));
    const byPlan = svc.listSessions({ planId: reviewedPlanId, userId: 1, reqId: 't' });
    assert.strictEqual(byPlan.length, 1);
    const fetched = svc.getSession({ id: sessionId, userId: 1, reqId: 't' });
    assert.strictEqual(fetched.comments[1].location.structureId, 7);
  });

  it('closes with APPROVED and updates the plan approval status', () => {
    const session = svc.closeSession({ sessionId, decision: 'APPROVED', userId: 1, userEmail: 'reviewer@tps.local', reqId: 't' });
    assert.strictEqual(session.status, 'CLOSED');
    assert.strictEqual(session.decision, 'APPROVED');
    assert.strictEqual(session.planApprovalStatus, 'APPROVED');
    const plan = ebrt.getPlan({ id: reviewedPlanId, userId: 1, reqId: 't' });
    assert.strictEqual(plan.approvalStatus, 'APPROVED');
    assert.throws(() => svc.closeSession({ sessionId, decision: 'APPROVED', userId: 1, reqId: 't' }), e => e.status === 400);
  });

  it('reject flow: reopen (after re-review), close UNAPPROVED puts the plan back', () => {
    // simulate re-review: plan was re-edited and set back to REVIEWED
    ebrt.updatePlan({ id: reviewedPlanId, payload: { approval_status: 'REVIEWED' }, userId: 1, reqId: 't' });
    const session = svc.createSession({ planId: reviewedPlanId, userId: 1, userEmail: 'reviewer@tps.local', reqId: 't' });
    svc.addComment({ sessionId: session.id, userId: 1, userEmail: 'reviewer@tps.local', reqId: 't', text: 'Still hot — reject' });
    const closed = svc.closeSession({ sessionId: session.id, decision: 'UNAPPROVED', userId: 1, userEmail: 'reviewer@tps.local', reqId: 't' });
    assert.strictEqual(closed.decision, 'UNAPPROVED');
    const plan = ebrt.getPlan({ id: reviewedPlanId, userId: 1, reqId: 't' });
    assert.strictEqual(plan.approvalStatus, 'UNAPPROVED');
  });

  it('rejects invalid decisions and unknown sessions', () => {
    assert.throws(() => svc.closeSession({ sessionId, decision: 'MAYBE', userId: 1, reqId: 't' }), e => e.status === 400);
    assert.throws(() => svc.getSession({ id: 99999, userId: 1, reqId: 't' }), e => e.status === 404);
    assert.throws(() => svc.addComment({ sessionId: 99999, userId: 1, reqId: 't', text: 'x' }), e => e.status === 404);
  });
});
