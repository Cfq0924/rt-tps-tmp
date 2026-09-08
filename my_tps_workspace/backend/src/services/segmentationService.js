import { getDb } from '../db/init.js';
import { auditLog } from '../logging/index.js';

/**
 * User-painted segmentation persistence (contouring module).
 *
 * One `segmentations` row = one painted structure (ROI) with name/color.
 * Its contours live in `segmentation_slices`: one row per painted slice,
 * points_json = JSON array of polygons, each polygon a flat [x,y,z,...]
 * array in patient mm — structurally identical to RTSTRUCT contour data.
 */

const MAX_SLICES = 1000;
const MAX_POINTS_PER_CONTOUR = 20000;

/**
 * Validate and normalize a save payload.
 * @param {Array} slices - [{ sopInstanceUID, instanceNumber, contours: number[][] }]
 * @returns {{slices: Array, error: null} | {slices: null, error: string}}
 */
export function validateSlicesPayload(slices) {
  if (!Array.isArray(slices)) {
    return { slices: null, error: 'slices must be an array' };
  }
  if (slices.length > MAX_SLICES) {
    return { slices: null, error: `too many slices (max ${MAX_SLICES})` };
  }
  const normalized = [];
  for (const s of slices) {
    if (!s || typeof s.sopInstanceUID !== 'string' || !s.sopInstanceUID.trim()) {
      return { slices: null, error: 'each slice needs a non-empty sopInstanceUID' };
    }
    if (!Array.isArray(s.contours)) {
      return { slices: null, error: 'each slice needs a contours array' };
    }
    for (const poly of s.contours) {
      if (!Array.isArray(poly) || poly.length === 0 || poly.length % 3 !== 0) {
        return { slices: null, error: 'each contour must be a flat [x,y,z,...] array with length % 3 === 0' };
      }
      if (poly.length > MAX_POINTS_PER_CONTOUR * 3) {
        return { slices: null, error: `contour too large (max ${MAX_POINTS_PER_CONTOUR} points)` };
      }
      for (const v of poly) {
        if (typeof v !== 'number' || !Number.isFinite(v)) {
          return { slices: null, error: 'contour coordinates must be finite numbers' };
        }
      }
    }
    normalized.push({
      sopInstanceUID: s.sopInstanceUID.trim(),
      instanceNumber: Number.isInteger(s.instanceNumber) ? s.instanceNumber : null,
      contours: s.contours,
    });
  }
  return { slices: normalized, error: null };
}

export function listSegmentations({ studyId, userId, reqId }) {
  const db = getDb();
  const rows = db.prepare(`
    SELECT id, study_id as studyId, name, color, approved, created_at as createdAt,
           (SELECT COUNT(*) FROM segmentation_slices s WHERE s.segmentation_id = segmentations.id) as sliceCount
    FROM segmentations
    WHERE study_id = ?
    ORDER BY created_at DESC, id DESC
  `).all(studyId);

  auditLog(db, { reqId, userId, action: 'list_segmentations', resourceType: 'segmentation', metadata: { studyId, count: rows.length } });
  return rows;
}

export function createSegmentation({ studyId, name, color, userId, reqId }) {
  const db = getDb();
  if (!name || !String(name).trim()) {
    throw Object.assign(new Error('name is required'), { status: 400 });
  }
  const result = db.prepare(
    'INSERT INTO segmentations (study_id, name, color) VALUES (?, ?, ?)'
  ).run(studyId, String(name).trim(), color || null);

  auditLog(db, { reqId, userId, action: 'create_segmentation', resourceType: 'segmentation', resourceId: result.lastInsertRowid, metadata: { studyId, name } });

  const row = db.prepare(`
    SELECT id, study_id as studyId, name, color, approved, created_at as createdAt, 0 as sliceCount
    FROM segmentations WHERE id = ?
  `).get(result.lastInsertRowid);
  return row;
}

export function getSegmentationMeta({ id, userId, reqId }) {
  const db = getDb();
  const row = db.prepare(`
    SELECT id, study_id as studyId, name, color, approved, created_at as createdAt,
           (SELECT COUNT(*) FROM segmentation_slices s WHERE s.segmentation_id = segmentations.id) as sliceCount
    FROM segmentations WHERE id = ?
  `).get(id);
  if (!row) {
    throw Object.assign(new Error('Segmentation not found'), { status: 404 });
  }
  auditLog(db, { reqId, userId, action: 'get_segmentation', resourceType: 'segmentation', resourceId: id });
  return row;
}

export function updateSegmentationMeta({ id, name, color, approved, userId, reqId }) {
  const db = getDb();
  const existing = db.prepare('SELECT id FROM segmentations WHERE id = ?').get(id);
  if (!existing) {
    throw Object.assign(new Error('Segmentation not found'), { status: 404 });
  }
  if (name !== undefined) {
    if (!String(name).trim()) {
      throw Object.assign(new Error('name cannot be empty'), { status: 400 });
    }
    db.prepare('UPDATE segmentations SET name = ? WHERE id = ?').run(String(name).trim(), id);
  }
  if (color !== undefined) {
    db.prepare('UPDATE segmentations SET color = ? WHERE id = ?').run(color, id);
  }
  if (approved !== undefined) {
    db.prepare('UPDATE segmentations SET approved = ? WHERE id = ?').run(approved ? 1 : 0, id);
  }
  auditLog(db, { reqId, userId, action: 'update_segmentation', resourceType: 'segmentation', resourceId: id, metadata: { name, color, approved } });
  return getSegmentationMeta({ id, userId, reqId });
}

export function deleteSegmentation({ id, userId, reqId }) {
  const db = getDb();
  const info = db.prepare('DELETE FROM segmentations WHERE id = ?').run(id);
  if (info.changes === 0) {
    throw Object.assign(new Error('Segmentation not found'), { status: 404 });
  }
  auditLog(db, { reqId, userId, action: 'delete_segmentation', resourceType: 'segmentation', resourceId: id });
  return { ok: true };
}

/**
 * Load all contours of a segmentation.
 * @returns {{segmentationId: number, name: string, color: string|null, slices: Array}}
 */
export function getContours({ id, userId, reqId }) {
  const db = getDb();
  const meta = getSegmentationMeta({ id, userId, reqId });
  const rows = db.prepare(`
    SELECT sop_instance_uid as sopInstanceUID, instance_number as instanceNumber, points_json
    FROM segmentation_slices
    WHERE segmentation_id = ?
    ORDER BY instance_number, id
  `).all(id);

  const slices = rows.map(r => ({
    sopInstanceUID: r.sopInstanceUID,
    instanceNumber: r.instanceNumber,
    contours: JSON.parse(r.points_json),
  }));

  return { segmentationId: id, name: meta.name, color: meta.color, slices };
}

/**
 * Replace all contours of a segmentation (whole-document save).
 * Validates the payload; throws 400 on invalid input.
 * @param {Object} params
 * @param {Array} params.slices - [{ sopInstanceUID, instanceNumber, contours: number[][] }]
 */
export function saveContours({ id, slices: rawSlices, userId, reqId }) {
  const { slices, error } = validateSlicesPayload(rawSlices);
  if (error) {
    throw Object.assign(new Error(error), { status: 400 });
  }
  const db = getDb();
  const meta = getSegmentationMeta({ id, userId, reqId });

  const save = db.transaction(() => {
    db.prepare('DELETE FROM segmentation_slices WHERE segmentation_id = ?').run(id);
    const insert = db.prepare(`
      INSERT INTO segmentation_slices (segmentation_id, sop_instance_uid, instance_number, points_json)
      VALUES (?, ?, ?, ?)
    `);
    for (const s of slices) {
      insert.run(id, s.sopInstanceUID, s.instanceNumber, JSON.stringify(s.contours));
    }
  });
  save();

  auditLog(db, { reqId, userId, action: 'save_segmentation_contours', resourceType: 'segmentation', resourceId: id, metadata: { sliceCount: slices.length, prevName: meta.name } });

  return { segmentationId: id, sliceCount: slices.length };
}
