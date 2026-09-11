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

// ---------- derived series (Phase 4 M1) ----------

const DERIVED_SELECT = `
  SELECT id, study_id as studyId, registration_id as registrationId, kind,
         fixed_series_uid as fixedSeriesUid, moving_series_uid as movingSeriesUid,
         series_uid as seriesUid, description, geometry_json as geometryJson,
         matrix_json as matrixJson, created_by as createdBy, created_at as createdAt
  FROM derived_series
`;

function hydrateDerived(row) {
  if (!row) return null;
  return {
    ...row,
    geometry: row.geometryJson ? JSON.parse(row.geometryJson) : null,
    matrix: row.matrixJson ? JSON.parse(row.matrixJson) : null,
    geometryJson: undefined,
    matrixJson: undefined,
  };
}

/**
 * Persist the provenance of a derived series generated in-browser (e.g. the
 * rigidly resampled moving volume on the fixed grid). v1 stores metadata
 * only — the pixels live in the browser cache until the DICOM write-out
 * step.
 */
export function createDerivedSeries({
  studyId, registrationId, fixedSeriesUid, movingSeriesUid,
  seriesUid, description, geometry, matrix, userId, reqId,
}) {
  const db = getDb();
  if (!seriesUid || !String(seriesUid).trim()) {
    throw Object.assign(new Error('seriesUid is required'), { status: 400 });
  }
  const gError = validateMatrix(matrix);
  if (gError) throw Object.assign(new Error(gError), { status: 400 });
  if (!geometry || !Number.isFinite(Number(geometry.cols)) || !Number.isFinite(Number(geometry.rows))) {
    throw Object.assign(new Error('geometry with numeric cols/rows is required'), { status: 400 });
  }

  const info = db.prepare(`
    INSERT INTO derived_series (study_id, registration_id, kind, fixed_series_uid, moving_series_uid,
      series_uid, description, geometry_json, matrix_json, created_by)
    VALUES (?, ?, 'REGISTERED_SERIES', ?, ?, ?, ?, ?, ?, ?)
  `).run(
    studyId,
    registrationId ?? null,
    fixedSeriesUid ? String(fixedSeriesUid) : null,
    movingSeriesUid ? String(movingSeriesUid) : null,
    String(seriesUid),
    description ?? 'Registered',
    JSON.stringify(geometry),
    JSON.stringify(matrix),
    userId ?? null,
  );

  auditLog(db, {
    reqId, userId,
    action: 'create_derived_series',
    resourceType: 'derived_series', resourceId: info.lastInsertRowid,
    metadata: { studyId, registrationId, seriesUid },
  });
  return getDerivedSeries({ id: info.lastInsertRowid, userId, reqId });
}

export function getDerivedSeries({ id, userId, reqId }) {
  const db = getDb();
  const row = db.prepare(`${DERIVED_SELECT} WHERE id = ?`).get(id);
  if (!row) throw Object.assign(new Error('Derived series not found'), { status: 404 });
  return hydrateDerived(row);
}

export function listDerivedSeries({ studyId, userId, reqId }) {
  const db = getDb();
  const rows = db.prepare(`${DERIVED_SELECT} WHERE study_id = ? ORDER BY id DESC`).all(studyId);
  auditLog(db, {
    reqId, userId,
    action: 'list_derived_series', resourceType: 'derived_series',
    metadata: { studyId, count: rows.length },
  });
  return rows.map(hydrateDerived);
}
