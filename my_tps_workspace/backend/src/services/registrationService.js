import { getDb } from '../db/init.js';
import { auditLog } from '../logging/index.js';

/**
 * Image registration persistence (Eclipse Ch7, rigid). A registration is a
 * 4x4 row-major transform mapping moving-series patient coordinates onto the
 * fixed series. The latest row per (fixed, moving) pair is current.
 */

const METHODS = new Set(['MANUAL', 'AUTO_CENTROID']);

export function validateMatrix(matrix) {
  if (!Array.isArray(matrix) || matrix.length !== 4) {
    return 'matrix must be 4 rows';
  }
  for (let r = 0; r < 4; r++) {
    const row = matrix[r];
    if (!Array.isArray(row) || row.length !== 4) {
      return `matrix row ${r} must have 4 numbers`;
    }
    for (let c = 0; c < 4; c++) {
      if (typeof row[c] !== 'number' || !Number.isFinite(row[c])) {
        return `matrix[${r}][${c}] must be a finite number`;
      }
    }
  }
  return null;
}

export function saveRegistration({ studyId, fixedSeriesUid, movingSeriesUid, matrix, method, notes, userId, reqId }) {
  const db = getDb();
  if (!fixedSeriesUid || !movingSeriesUid) {
    throw Object.assign(new Error('fixed and moving series UIDs are required'), { status: 400 });
  }
  const mError = validateMatrix(matrix);
  if (mError) throw Object.assign(new Error(mError), { status: 400 });
  const m = method ?? 'MANUAL';
  if (!METHODS.has(m)) {
    throw Object.assign(new Error(`method must be one of ${[...METHODS].join('/')}`), { status: 400 });
  }

  const info = db.prepare(`
    INSERT INTO series_registrations (study_id, fixed_series_uid, moving_series_uid, matrix_json, method, notes, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    studyId,
    String(fixedSeriesUid),
    String(movingSeriesUid),
    JSON.stringify(matrix),
    m,
    notes ?? null,
    userId ?? null,
  );

  auditLog(db, {
    reqId, userId,
    action: 'save_registration',
    resourceType: 'series_registration', resourceId: info.lastInsertRowid,
    metadata: { studyId, fixedSeriesUid, movingSeriesUid, method: m },
  });
  return getRegistration({ id: info.lastInsertRowid, userId, reqId });
}

const REG_SELECT = `
  SELECT id, study_id as studyId, fixed_series_uid as fixedSeriesUid,
         moving_series_uid as movingSeriesUid, matrix_json as matrixJson,
         method, notes, created_by as createdBy, created_at as createdAt
  FROM series_registrations
`;

function hydrate(row) {
  return row ? { ...row, matrix: JSON.parse(row.matrixJson), matrixJson: undefined } : null;
}

export function getRegistration({ id, userId, reqId }) {
  const db = getDb();
  const row = db.prepare(`${REG_SELECT} WHERE id = ?`).get(id);
  if (!row) {
    throw Object.assign(new Error('Registration not found'), { status: 404 });
  }
  auditLog(db, {
    reqId, userId,
    action: 'get_registration',
    resourceType: 'series_registration', resourceId: id,
  });
  return hydrate(row);
}

export function listRegistrations({ studyId, userId, reqId }) {
  const db = getDb();
  const rows = db.prepare(`
    ${REG_SELECT} WHERE study_id = ? ORDER BY id DESC
  `).all(studyId);
  auditLog(db, {
    reqId, userId,
    action: 'list_registrations',
    resourceType: 'series_registration',
    metadata: { studyId, count: rows.length },
  });
  return rows.map(hydrate);
}

/** Latest registration for a (fixed, moving) pair, or null. */
export function getLatestRegistration({ studyId, fixedSeriesUid, movingSeriesUid, userId, reqId }) {
  const db = getDb();
  const row = db.prepare(`
    ${REG_SELECT}
    WHERE study_id = ? AND fixed_series_uid = ? AND moving_series_uid = ?
    ORDER BY id DESC LIMIT 1
  `).get(studyId, String(fixedSeriesUid), String(movingSeriesUid));
  if (!row) return null;
  auditLog(db, {
    reqId, userId,
    action: 'get_latest_registration',
    resourceType: 'series_registration', resourceId: row.id,
  });
  return hydrate(row);
}
