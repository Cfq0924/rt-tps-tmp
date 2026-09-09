import { getDb } from '../db/init.js';
import { auditLog } from '../logging/index.js';

/**
 * Beam model deepening (Eclipse EBPT B2): control points with MLC leaf
 * positions, field-in-field subfields, and the opposing field helper.
 *
 * MLC json shape per control point: { type: 'MLCX', leafPairs: [{x1, x2}] }.
 * Leaf travel bounds follow the common ±200 mm convention; crossed leaves
 * (x1 > x2) are valid DICOM and allowed.
 */

const LEAF_TRAVEL_MM = 200;
const KNOWN_LEAF_COUNTS = [26, 40, 60, 80, 96, 110, 120];

function beamRow(db, beamId) {
  const row = db.prepare('SELECT id, plan_id as planId, beam_number as beamNumber, leaf_pair_count as leafPairCount FROM ebrt_beams WHERE id = ?').get(beamId);
  if (!row) {
    throw Object.assign(new Error('Beam not found'), { status: 404 });
  }
  return row;
}

// ---------- control points ----------

function cpsToJson(mlc) {
  if (mlc == null) return null;
  if (typeof mlc === 'string') {
    try { return JSON.stringify(JSON.parse(mlc)); } catch { throw Object.assign(new Error('mlc_json is not valid JSON'), { status: 400 }); }
  }
  if (typeof mlc === 'object') return JSON.stringify(mlc);
  return null;
}

/** Validate a control-point array (structure + leaf geometry). */
export function validateControlPoints(cps, leafPairCount = null) {
  if (!Array.isArray(cps) || cps.length === 0) {
    return 'control points must be a non-empty array';
  }
  let lastWeight = -Infinity;
  for (const [idx, cp] of cps.entries()) {
    if (typeof cp !== 'object' || cp == null) return `control point ${idx} must be an object`;
    for (const k of ['gantryAngle', 'collimatorAngle', 'couchAngle', 'cumulativeMetersetWeight']) {
      if (cp[k] !== undefined && cp[k] !== null && !Number.isFinite(Number(cp[k]))) {
        return `control point ${idx}: ${k} must be numeric`;
      }
    }
    if (cp.mlc != null) {
      const mlc = cp.mlc;
      if (typeof mlc !== 'object' || !Array.isArray(mlc.leafPairs) || mlc.leafPairs.length === 0) {
        return `control point ${idx}: mlc.leafPairs must be a non-empty array`;
      }
      if (leafPairCount && mlc.leafPairs.length !== leafPairCount) {
        return `control point ${idx}: expected ${leafPairCount} leaf pairs, got ${mlc.leafPairs.length}`;
      }
      if (!KNOWN_LEAF_COUNTS.includes(mlc.leafPairs.length)) {
        return `control point ${idx}: unusual leaf pair count ${mlc.leafPairs.length}`;
      }
      for (const [li, pair] of mlc.leafPairs.entries()) {
        if (!Number.isFinite(Number(pair.x1)) || !Number.isFinite(Number(pair.x2))) {
          return `control point ${idx} leaf ${li}: leaf positions must be numeric`;
        }
        if (Math.abs(Number(pair.x1)) > LEAF_TRAVEL_MM || Math.abs(Number(pair.x2)) > LEAF_TRAVEL_MM) {
          return `control point ${idx} leaf ${li}: leaf position beyond ±${LEAF_TRAVEL_MM} mm`;
        }
      }
    }
    const w = Number(cp.cumulativeMetersetWeight);
    if (Number.isFinite(w)) {
      if (w < lastWeight) return `control point ${idx}: cumulative meterset weight must be non-decreasing`;
      lastWeight = w;
    }
  }
  return null;
}

export function listControlPoints({ beamId, userId, reqId }) {
  const db = getDb();
  beamRow(db, beamId);
  const rows = db.prepare(`
    SELECT cp_index as cpIndex, gantry_angle as gantryAngle, collimator_angle as collimatorAngle,
           couch_angle as couchAngle, cumulative_meterset_weight as cumulativeMetersetWeight, mlc_json as mlcJson
    FROM beam_control_points WHERE beam_id = ? ORDER BY cp_index
  `).all(beamId);
  auditLog(db, { reqId, userId, action: 'list_control_points', resourceType: 'ebrt_beam', resourceId: beamId, metadata: { count: rows.length } });
  return rows.map(r => ({
    cpIndex: r.cpIndex,
    gantryAngle: r.gantryAngle,
    collimatorAngle: r.collimatorAngle,
    couchAngle: r.couchAngle,
    cumulativeMetersetWeight: r.cumulativeMetersetWeight,
    mlc: r.mlcJson ? JSON.parse(r.mlcJson) : null,
  }));
}

/** Replace all control points of a beam (validated). */
export function replaceControlPoints({ beamId, controlPoints, userId, reqId }) {
  const db = getDb();
  const beam = beamRow(db, beamId);
  const error = validateControlPoints(controlPoints, beam.leafPairCount);
  if (error) throw Object.assign(new Error(error), { status: 400 });

  const replace = db.transaction(() => {
    db.prepare('DELETE FROM beam_control_points WHERE beam_id = ?').run(beamId);
    const ins = db.prepare(`
      INSERT INTO beam_control_points (beam_id, cp_index, gantry_angle, collimator_angle,
        couch_angle, cumulative_meterset_weight, mlc_json)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    controlPoints.forEach((cp, idx) => {
      ins.run(beamId, cp.cpIndex ?? idx, cp.gantryAngle ?? null, cp.collimatorAngle ?? null,
        cp.couchAngle ?? null, cp.cumulativeMetersetWeight ?? null,
        cp.mlc ? JSON.stringify(cp.mlc) : null);
    });
  });
  replace();

  auditLog(db, { reqId, userId, action: 'replace_control_points', resourceType: 'ebrt_beam', resourceId: beamId, metadata: { count: controlPoints.length } });
  return listControlPoints({ beamId, userId, reqId });
}

// ---------- subfields (Field in Field) ----------

export function listSubfields({ beamId, userId, reqId }) {
  const db = getDb();
  beamRow(db, beamId);
  return db.prepare(`
    SELECT id, beam_id as beamId, name, weight, mlc_json as mlcJson, created_at as createdAt
    FROM beam_subfields WHERE beam_id = ? ORDER BY id
  `).all(beamId).map(r => ({ ...r, mlc: r.mlcJson ? JSON.parse(r.mlcJson) : null, mlcJson: undefined }));
}

export function addSubfield({ beamId, name, weight, mlc, userId, reqId }) {
  const db = getDb();
  beamRow(db, beamId);
  if (!name || !String(name).trim()) {
    throw Object.assign(new Error('subfield name is required'), { status: 400 });
  }
  if (weight != null && (!Number.isFinite(Number(weight)) || Number(weight) < 0)) {
    throw Object.assign(new Error('weight must be a non-negative number'), { status: 400 });
  }
  const info = db.prepare(`
    INSERT INTO beam_subfields (beam_id, name, weight, mlc_json) VALUES (?, ?, ?, ?)
  `).run(beamId, String(name).trim(), Number(weight) || 1, mlc ? JSON.stringify(mlc) : null);
  auditLog(db, { reqId, userId, action: 'add_beam_subfield', resourceType: 'ebrt_beam', resourceId: beamId, metadata: { subfieldId: info.lastInsertRowid } });
  return { id: info.lastInsertRowid, beamId, name: String(name).trim(), weight: Number(weight) || 1, mlc: mlc ?? null };
}

export function deleteSubfield({ beamId, subfieldId, userId, reqId }) {
  const db = getDb();
  const info = db.prepare('DELETE FROM beam_subfields WHERE beam_id = ? AND id = ?').run(beamId, subfieldId);
  if (info.changes === 0) {
    throw Object.assign(new Error('Subfield not found'), { status: 404 });
  }
  auditLog(db, { reqId, userId, action: 'delete_beam_subfield', resourceType: 'ebrt_beam', resourceId: beamId, metadata: { subfieldId } });
  return { ok: true };
}

// ---------- opposing field helper ----------

/** Normalize an angle into (−180, 180]. */
function normalizeAngle(a) {
  let x = ((a % 360) + 360) % 360;
  if (x > 180) x -= 360;
  return x;
}

/**
 * Create an opposing field: copy of the source beam with the gantry rotated
 * 180° (normalized), same geometry/energy/wedge — inserted as the next
 * beam number of the same plan.
 */
export function createOpposingField({ planId, sourceBeamNumber, name, userId, reqId }) {
  const db = getDb();
  const plan = db.prepare('SELECT * FROM ebrt_plans WHERE id = ?').get(planId);
  if (!plan) {
    throw Object.assign(new Error('EBRT plan not found'), { status: 404 });
  }
  const src = db.prepare('SELECT * FROM ebrt_beams WHERE plan_id = ? AND beam_number = ?').get(planId, sourceBeamNumber);
  if (!src) {
    throw Object.assign(new Error('Source beam not found'), { status: 404 });
  }
  const nextNumber = Number(db.prepare('SELECT COALESCE(MAX(beam_number), 0) + 1 AS n FROM ebrt_beams WHERE plan_id = ?').get(planId).n);
  const opposingGantry = normalizeAngle((src.gantry_angle ?? 0) + 180);

  const info = db.prepare(`
    INSERT INTO ebrt_beams (plan_id, beam_number, name, beam_type, energy_mv, gantry_angle,
      gantry_angle_stop, collimator_angle, couch_angle, jaw_x1, jaw_x2, jaw_y1, jaw_y2, weight,
      wedge_angle, bolus)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    planId, nextNumber,
    name ?? `Opp of ${src.name ?? `Field ${src.beam_number}`}`,
    src.beam_type, src.energy_mv,
    opposingGantry,
    src.gantry_angle_stop != null ? normalizeAngle((src.gantry_angle_stop ?? 0) + 180) : null,
    src.collimator_angle, src.couch_angle,
    src.jaw_x1, src.jaw_x2, src.jaw_y1, src.jaw_y2,
    src.weight, src.wedge_angle, src.bolus,
  );

  // copy control points (gantry angles rotated, meterset weights mirrored)
  const cps = db.prepare('SELECT * FROM beam_control_points WHERE beam_id = ? ORDER BY cp_index').all(src.id);
  if (cps.length) {
    const ins = db.prepare(`
      INSERT INTO beam_control_points (beam_id, cp_index, gantry_angle, collimator_angle,
        couch_angle, cumulative_meterset_weight, mlc_json)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    const total = cps.length;
    cps.forEach((cp, i) => {
      const ga = cp.gantry_angle != null ? normalizeAngle(cp.gantry_angle + 180) : null;
      const cpy = { ...JSON.parse(cp.mlc_json || 'null') };
      ins.run(info.lastInsertRowid, i, ga, cp.collimator_angle, cp.couch_angle,
        cp.cumulative_meterset_weight != null
          ? (cp.cumulative_meterset_weight ?? 0)
          : (i / Math.max(1, total - 1)),
        cpy ? JSON.stringify(cpy) : null);
    });
  }

  auditLog(db, {
    reqId, userId,
    action: 'create_opposing_field',
    resourceType: 'ebrt_beam', resourceId: info.lastInsertRowid,
    metadata: { planId, sourceBeamNumber, opposingBeamNumber: nextNumber },
  });

  const beams = db.prepare(`
    SELECT id, plan_id as planId, beam_number as beamNumber, name, beam_type as beamType,
           energy_mv as energyMv, gantry_angle as gantryAngle, gantry_angle_stop as gantryAngleStop,
           collimator_angle as collimatorAngle, couch_angle as couchAngle,
           jaw_x1 as jawX1, jaw_x2 as jawX2, jaw_y1 as jawY1, jaw_y2 as jawY2,
           weight, wedge_angle as wedgeAngle, bolus
    FROM ebrt_beams WHERE id = ?
  `).get(info.lastInsertRowid);
  return beams;
}
