import { getDb } from '../db/init.js';
import { auditLog } from '../logging/index.js';
import { getPlan, updatePlan } from './ebrtPlanService.js';

/**
 * RT Peer Review (Eclipse Ch5): review sessions on workspace plans.
 *
 * Flow: a REVIEWED plan is brought into an OPEN review session; reviewers
 * comment (optionally pinned to a slice / structure / beam); closing the
 * session records the decision APPROVED (pass) or UNAPPROVED (reject) and
 * updates the plan's approval status accordingly. One OPEN session per plan.
 * Everything is audit-logged.
 */

const DECISIONS = new Set(['APPROVED', 'UNAPPROVED']);
const LOCATION_KEYS = new Set(['sliceIdx', 'structureId', 'beamNumber']);
const MAX_COMMENT_LENGTH = 4000;

function sessionRow(db, id) {
  const row = db.prepare(`
    SELECT s.id, s.plan_id as planId, s.status, s.decision,
           s.opened_by as openedBy, s.opened_at as openedAt,
           s.closed_by as closedBy, s.closed_at as closedAt,
           (SELECT COUNT(*) FROM review_comments c WHERE c.session_id = s.id) as commentCount,
           p.name as planName, p.approval_status as planApprovalStatus
    FROM peer_review_sessions s
    JOIN ebrt_plans p ON p.id = s.plan_id
    WHERE s.id = ?
  `).get(id);
  if (!row) {
    throw Object.assign(new Error('Peer review session not found'), { status: 404 });
  }
  return row;
}

function commentRows(db, sessionId) {
  return db.prepare(`
    SELECT id, author_user_id as authorUserId, author_name as authorName,
           comment_text as text, location_json as locationJson, created_at as createdAt
    FROM review_comments WHERE session_id = ? ORDER BY id
  `).all(sessionId).map(c => ({
    ...c,
    location: c.locationJson ? JSON.parse(c.locationJson) : null,
    locationJson: undefined,
  }));
}

function getSessionWithComments(db, id) {
  const session = sessionRow(db, id);
  session.comments = commentRows(db, id);
  return session;
}

function reviewerName(db, userId, email) {
  const row = userId != null
    ? db.prepare('SELECT name FROM users WHERE id = ?').get(userId)
    : null;
  return row?.name ?? email ?? 'reviewer';
}

export function createSession({ planId, userId, userEmail, reqId }) {
  const db = getDb();
  const plan = getPlan({ id: planId, userId, reqId });
  if (plan.approvalStatus !== 'REVIEWED') {
    throw Object.assign(
      new Error(`Plan must be in REVIEWED status to enter peer review (current: ${plan.approvalStatus})`),
      { status: 400 },
    );
  }
  const open = db.prepare("SELECT id FROM peer_review_sessions WHERE plan_id = ? AND status = 'OPEN'").get(planId);
  if (open) {
    throw Object.assign(new Error('A peer review session is already open for this plan'), { status: 409 });
  }

  const info = db.prepare(`
    INSERT INTO peer_review_sessions (plan_id, status, opened_by) VALUES (?, 'OPEN', ?)
  `).run(planId, userId ?? null);

  auditLog(db, {
    reqId, userId,
    action: 'peer_review_open',
    resourceType: 'peer_review_session', resourceId: info.lastInsertRowid,
    metadata: { planId },
  });
  return getSessionWithComments(db, info.lastInsertRowid);
}

export function listSessions({ planId, status, userId, reqId }) {
  const db = getDb();
  const clauses = [];
  const values = [];
  if (planId != null) { clauses.push('s.plan_id = ?'); values.push(planId); }
  if (status) { clauses.push('s.status = ?'); values.push(status); }
  const rows = db.prepare(`
    SELECT s.id, s.plan_id as planId, s.status, s.decision,
           s.opened_by as openedBy, s.opened_at as openedAt,
           s.closed_by as closedBy, s.closed_at as closedAt,
           (SELECT COUNT(*) FROM review_comments c WHERE c.session_id = s.id) as commentCount,
           p.name as planName, p.approval_status as planApprovalStatus
    FROM peer_review_sessions s
    JOIN ebrt_plans p ON p.id = s.plan_id
    ${clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''}
    ORDER BY s.id DESC
  `).all(...values);
  auditLog(db, {
    reqId, userId,
    action: 'list_peer_review_sessions',
    resourceType: 'peer_review_session',
    metadata: { count: rows.length, planId: planId ?? null },
  });
  return rows;
}

export function getSession({ id, userId, reqId }) {
  const db = getDb();
  const session = getSessionWithComments(db, id);
  auditLog(db, {
    reqId, userId,
    action: 'get_peer_review_session',
    resourceType: 'peer_review_session', resourceId: id,
  });
  return session;
}

export function addComment({ sessionId, text, location, userId, userEmail, reqId }) {
  const db = getDb();
  if (!text || !String(text).trim()) {
    throw Object.assign(new Error('comment text is required'), { status: 400 });
  }
  if (String(text).length > MAX_COMMENT_LENGTH) {
    throw Object.assign(new Error(`comment too long (max ${MAX_COMMENT_LENGTH})`), { status: 400 });
  }
  let locationJson = null;
  if (location != null) {
    if (typeof location !== 'object' || Array.isArray(location)) {
      throw Object.assign(new Error('location must be an object'), { status: 400 });
    }
    const clean = {};
    for (const [k, v] of Object.entries(location)) {
      if (v === undefined || v === null) continue;
      if (!LOCATION_KEYS.has(k)) {
        throw Object.assign(new Error(`unknown location key: ${k}`), { status: 400 });
      }
      if (!Number.isInteger(v) || v < 0) {
        throw Object.assign(new Error(`location.${k} must be a non-negative integer`), { status: 400 });
      }
      clean[k] = v;
    }
    locationJson = Object.keys(clean).length > 0 ? JSON.stringify(clean) : null;
  }

  const session = sessionRow(db, sessionId);
  if (session.status !== 'OPEN') {
    throw Object.assign(new Error('Session is closed — comments are read-only'), { status: 400 });
  }

  const info = db.prepare(`
    INSERT INTO review_comments (session_id, author_user_id, author_name, comment_text, location_json)
    VALUES (?, ?, ?, ?, ?)
  `).run(sessionId, userId ?? null, reviewerName(db, userId, userEmail), String(text).trim(), locationJson);

  auditLog(db, {
    reqId, userId,
    action: 'peer_review_comment',
    resourceType: 'peer_review_session', resourceId: sessionId,
    metadata: { commentId: info.lastInsertRowid, pinned: locationJson != null },
  });
  return getSessionWithComments(db, sessionId);
}

export function closeSession({ sessionId, decision, userId, userEmail, reqId }) {
  const db = getDb();
  if (!DECISIONS.has(decision)) {
    throw Object.assign(new Error('decision must be APPROVED or UNAPPROVED'), { status: 400 });
  }
  const session = sessionRow(db, sessionId);
  if (session.status !== 'OPEN') {
    throw Object.assign(new Error('Session is already closed'), { status: 400 });
  }

  // decision also becomes the plan's approval status (validated + audited there)
  updatePlan({ id: session.planId, payload: { approval_status: decision }, userId, reqId });

  db.prepare(`
    UPDATE peer_review_sessions SET status = 'CLOSED', decision = ?, closed_by = ?, closed_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(decision, userId ?? null, sessionId);

  auditLog(db, {
    reqId, userId: userId ?? null,
    action: 'peer_review_close',
    resourceType: 'peer_review_session', resourceId: sessionId,
    metadata: { decision, reviewer: reviewerName(db, userId, userEmail), planId: session.planId },
  });
  return getSessionWithComments(db, sessionId);
}
