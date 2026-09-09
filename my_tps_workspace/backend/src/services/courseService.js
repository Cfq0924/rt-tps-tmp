import { getDb } from '../db/init.js';
import { auditLog } from '../logging/index.js';

/**
 * Treatment courses (Eclipse: a course groups one or more plans).
 * Deleting a course keeps its plans — their course_id is cleared.
 */

export function listCourses({ studyId, userId, reqId }) {
  const db = getDb();
  const rows = db.prepare(`
    SELECT c.id, c.study_id as studyId, c.name, c.intent, c.created_at as createdAt,
           (SELECT COUNT(*) FROM ebrt_plans p WHERE p.course_id = c.id) as planCount
    FROM courses c WHERE c.study_id = ? ORDER BY c.id DESC
  `).all(studyId);
  auditLog(db, { reqId, userId, action: 'list_courses', resourceType: 'course', metadata: { studyId, count: rows.length } });
  return rows;
}

export function createCourse({ studyId, name, intent, userId, reqId }) {
  const db = getDb();
  if (!name || !String(name).trim()) {
    throw Object.assign(new Error('name is required'), { status: 400 });
  }
  const info = db.prepare('INSERT INTO courses (study_id, name, intent) VALUES (?, ?, ?)')
    .run(studyId, String(name).trim(), intent ?? null);
  auditLog(db, { reqId, userId, action: 'create_course', resourceType: 'course', resourceId: info.lastInsertRowid, metadata: { studyId, name } });
  const row = db.prepare('SELECT id, study_id as studyId, name, intent, created_at as createdAt FROM courses WHERE id = ?')
    .get(info.lastInsertRowid);
  return row;
}

export function updateCourse({ id, name, intent, userId, reqId }) {
  const db = getDb();
  const existing = db.prepare('SELECT id FROM courses WHERE id = ?').get(id);
  if (!existing) {
    throw Object.assign(new Error('Course not found'), { status: 404 });
  }
  if (name !== undefined) {
    if (!String(name).trim()) throw Object.assign(new Error('name cannot be empty'), { status: 400 });
    db.prepare('UPDATE courses SET name = ? WHERE id = ?').run(String(name).trim(), id);
  }
  if (intent !== undefined) {
    db.prepare('UPDATE courses SET intent = ? WHERE id = ?').run(intent, id);
  }
  auditLog(db, { reqId, userId, action: 'update_course', resourceType: 'course', resourceId: id, metadata: { name, intent } });
  const row = db.prepare('SELECT id, study_id as studyId, name, intent, created_at as createdAt FROM courses WHERE id = ?').get(id);
  return row;
}

/** Delete a course; its plans survive with course_id cleared. */
export function deleteCourse({ id, userId, reqId }) {
  const db = getDb();
  const existing = db.prepare('SELECT id FROM courses WHERE id = ?').get(id);
  if (!existing) {
    throw Object.assign(new Error('Course not found'), { status: 404 });
  }
  db.prepare('UPDATE ebrt_plans SET course_id = NULL WHERE course_id = ?').run(id);
  db.prepare('DELETE FROM courses WHERE id = ?').run(id);
  auditLog(db, { reqId, userId, action: 'delete_course', resourceType: 'course', resourceId: id });
  return { ok: true };
}
