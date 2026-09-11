import { getDb } from '../db/init.js';
import { auditLog } from '../logging/index.js';
import { parseRTPlan } from './rtPlanService.js';
import { getDicomFile } from './dicomService.js';
import { parseRTStruct } from './rtStructService.js';
import { latestFileByModality } from './dicomQuery.js';

/**
 * External-beam plan persistence (EBRT module).
 * One ebrt_plans row = one plan (single isocenter) with beams in ebrt_beams.
 * Plans are created manually or imported from a parsed RTPLAN file.
 */

const BEAM_TYPES = new Set(['STATIC', 'DMLC', 'VMAT']);
const MAX_BEAMS = 32;

function num(v, fallback = null) {
  if (v === undefined || v === null || v === '') return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function str(v, fallback = null) {
  if (v === undefined || v === null) return fallback;
  const s = String(v).trim();
  return s || fallback;
}

/**
 * Isocenter from the target structure: mean of the ROI's contour points
 * (Eclipse places the isocenter inside the target when the planner doesn't
 * pick one explicitly). Returns null when no RTSTRUCT/ROI is available.
 */
export async function computeTargetIsocenter(studyId, structureName) {
  if (!structureName) return null;
  try {
    const db = getDb();
    const rt = latestFileByModality(db, studyId, 'RTSTRUCT');
    if (!rt) return null;
    const { roiSequence, contourSequence } = await parseRTStruct(rt.file_path);
    const roi = roiSequence.find(r => r.roiName === structureName);
    if (!roi) return null;
    let sx = 0, sy = 0, sz = 0, n = 0;
    for (const c of contourSequence) {
      if (c.referencedROINumber !== roi.roiNumber) continue;
      for (let p = 0; p + 2 < c.contourData.length; p += 3) {
        sx += c.contourData[p]; sy += c.contourData[p + 1]; sz += c.contourData[p + 2]; n++;
      }
    }
    return n > 0 ? { x: sx / n, y: sy / n, z: sz / n } : null;
  } catch {
    return null;
  }
}

export function validatePlanPayload(p = {}) {
  if (!str(p.name)) return 'name is required';
  const dose = num(p.prescription_dose_gy);
  if (dose === null || dose <= 0) return 'prescription_dose_gy must be > 0';
  const fx = num(p.number_of_fractions);
  if (fx === null || fx < 1 || !Number.isInteger(fx)) return 'number_of_fractions must be an integer >= 1';
  const iso = [p.isocenter_x, p.isocenter_y, p.isocenter_z];
  for (const v of iso) {
    if (v !== undefined && v !== null && !Number.isFinite(Number(v))) return 'isocenter must be numeric';
  }
  return null;
}

export function validateBeamPayload(b = {}) {
  const type = str(b.beam_type, 'STATIC').toUpperCase();
  if (!BEAM_TYPES.has(type)) return `beam_type must be one of ${[...BEAM_TYPES].join('/')}`;
  for (const [k, max] of [['gantry_angle', 360], ['gantry_angle_stop', 360], ['collimator_angle', 360], ['couch_angle', 360]]) {
    const v = num(b[k]);
    if (v !== null && Math.abs(v) > max) return `${k} must be within ±${max}°`;
  }
  for (const k of ['jaw_x1', 'jaw_x2', 'jaw_y1', 'jaw_y2']) {
    const v = num(b[k]);
    if (v !== null && Math.abs(v) > 400) return `${k} must be within ±400mm`;
  }
  const w = num(b.weight, 1);
  if (w !== null && w < 0) return 'weight must be >= 0';
  const wedge = num(b.wedge_angle);
  if (wedge !== null && (wedge < 0 || wedge > 360)) return 'wedge_angle must be within 0..360°';
  if (b.bolus !== undefined && b.bolus !== null && typeof b.bolus !== 'string') return 'bolus must be a string';
  return null;
}

const MAX_REFERENCE_POINTS = 20;

/**
 * Validate a reference-points payload: array of {name, x, y, z} in patient mm.
 * @returns {error: string|null, value: string|null} normalized JSON or null
 */
export function validateReferencePoints(points) {
  if (points === undefined || points === null) return { error: null, value: null };
  if (!Array.isArray(points)) return { error: 'reference_points must be an array', value: null };
  if (points.length > MAX_REFERENCE_POINTS) {
    return { error: `too many reference points (max ${MAX_REFERENCE_POINTS})`, value: null };
  }
  const normalized = [];
  for (const pt of points) {
    if (!pt || !str(pt.name)) return { error: 'each reference point needs a name', value: null };
    const isDpv = !!pt.isDpv;
    // DPVs (dose prescription volumes) may omit the location; located points
    // must carry numeric coordinates
    const rawCoords = [pt.x, pt.y, pt.z];
    if (!isDpv && rawCoords.some(v => v === undefined || v === null || v === '')) {
      return { error: 'located reference point needs x/y/z', value: null };
    }
    if (rawCoords.some(v => v !== undefined && v !== null && v !== '' && !Number.isFinite(Number(v)))) {
      return { error: 'reference point x/y/z must be numeric', value: null };
    }
    const coords = rawCoords.map(v => (v === undefined || v === null || v === '' ? null : Number(v)));
    const type = str(pt.type, isDpv ? 'TARGET' : 'POINT').toUpperCase();
    if (!['POINT', 'TARGET'].includes(type)) {
      return { error: 'reference point type must be POINT or TARGET', value: null };
    }
    const entry = {
      name: str(pt.name),
      type,
      x: isDpv ? null : coords[0],
      y: isDpv ? null : coords[1],
      z: isDpv ? null : coords[2],
      isDpv,
    };
    const limit = num(pt.totalDoseLimitGy);
    if (limit !== null) entry.totalDoseLimitGy = limit;
    const daily = num(pt.dailyDoseGy);
    if (daily !== null) entry.dailyDoseGy = daily;
    normalized.push(entry);
  }
  return { error: null, value: JSON.stringify(normalized) };
}

const PLAN_SELECT = `
  SELECT id, study_id as studyId, name, machine_name as machineName, energy_mv as energyMv,
         prescription_dose_gy as prescriptionDoseGy, number_of_fractions as numberOfFractions,
         normalization, optimization_algorithm as optimizationAlgorithm, dose_algorithm as doseAlgorithm,
         grid_size_mm as gridSizeMm, heterogeneity_correction as heterogeneityCorrection,
         approval_status as approvalStatus, isocenter_x as isocenterX, isocenter_y as isocenterY, isocenter_z as isocenterZ,
         reference_points as referencePointsJson, is_template as isTemplate, source_plan_id as sourcePlanId,
         course_id as courseId, target_structure_name as targetStructureName,
         dose_per_fraction_gy as dosePerFractionGy, primary_point_name as primaryPointName,
         calc_models_json as calcModelsJson, delta_couch_json as deltaCouchJson,
         optimization_objectives_json as optimizationObjectivesJson,
         source_rtplan_file_id as sourceRtplanFileId, created_at as createdAt
  FROM ebrt_plans`;

function parseJsonField(v, fallback = null) {
  if (v == null) return fallback;
  try { return JSON.parse(v); } catch { return fallback; }
}

function getPlanWithBeams(db, id) {
  const plan = db.prepare(`${PLAN_SELECT} WHERE id = ?`).get(id);
  if (!plan) {
    throw Object.assign(new Error('EBRT plan not found'), { status: 404 });
  }
  plan.referencePoints = parseReferencePoints(plan.referencePointsJson);
  plan.calcModels = parseJsonField(plan.calcModelsJson);
  plan.deltaCouch = parseJsonField(plan.deltaCouchJson);
  plan.optimizationObjectives = parseJsonField(plan.optimizationObjectivesJson);
  plan.optimizationObjectivesJson = undefined;
  plan.calcModelsJson = undefined;
  plan.deltaCouchJson = undefined;
  delete plan.referencePointsJson;
  plan.beams = db.prepare(`
    SELECT id, plan_id as planId, beam_number as beamNumber, name, beam_type as beamType,
           energy_mv as energyMv, gantry_angle as gantryAngle, gantry_angle_stop as gantryAngleStop,
           collimator_angle as collimatorAngle, couch_angle as couchAngle,
           jaw_x1 as jawX1, jaw_x2 as jawX2, jaw_y1 as jawY1, jaw_y2 as jawY2, weight,
           wedge_angle as wedgeAngle, bolus,
           (SELECT COUNT(*) FROM beam_control_points bc WHERE bc.beam_id = ebrt_beams.id) as cpCount
    FROM ebrt_beams WHERE plan_id = ? ORDER BY beam_number
  `).all(id);
  return plan;
}

function parseReferencePoints(json) {
  if (!json) return [];
  try {
    const arr = JSON.parse(json);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function listPlans({ studyId, userId, reqId }) {
  const db = getDb();
  const rows = db.prepare(`
    SELECT id, study_id as studyId, name, machine_name as machineName, energy_mv as energyMv,
           prescription_dose_gy as prescriptionDoseGy, number_of_fractions as numberOfFractions,
           normalization, optimization_algorithm as optimizationAlgorithm, dose_algorithm as doseAlgorithm,
           grid_size_mm as gridSizeMm, heterogeneity_correction as heterogeneityCorrection,
           approval_status as approvalStatus, isocenter_x as isocenterX, isocenter_y as isocenterY, isocenter_z as isocenterZ,
           is_template as isTemplate, source_plan_id as sourcePlanId, course_id as courseId,
           target_structure_name as targetStructureName, dose_per_fraction_gy as dosePerFractionGy,
           source_rtplan_file_id as sourceRtplanFileId, created_at as createdAt,
           (SELECT COUNT(*) FROM ebrt_beams b WHERE b.plan_id = ebrt_plans.id) as beamCount
    FROM ebrt_plans WHERE study_id = ? AND is_template = 0 ORDER BY created_at DESC, id DESC
  `).all(studyId);

  auditLog(db, { reqId, userId, action: 'list_ebrt_plans', resourceType: 'ebrt_plan', metadata: { studyId, count: rows.length } });
  return rows;
}

export function getPlan({ id, userId, reqId }) {
  const db = getDb();
  const plan = getPlanWithBeams(db, id);
  auditLog(db, { reqId, userId, action: 'get_ebrt_plan', resourceType: 'ebrt_plan', resourceId: id });
  return plan;
}

export function createPlan({ studyId, payload = {}, userId, reqId }) {
  const error = validatePlanPayload(payload);
  if (error) throw Object.assign(new Error(error), { status: 400 });

  const refPts = validateReferencePoints(payload.reference_points);
  if (refPts.error) throw Object.assign(new Error(refPts.error), { status: 400 });

  const db = getDb();
  const info = db.prepare(`
    INSERT INTO ebrt_plans (study_id, name, machine_name, energy_mv, prescription_dose_gy,
      number_of_fractions, normalization, optimization_algorithm, dose_algorithm,
      grid_size_mm, heterogeneity_correction, isocenter_x, isocenter_y, isocenter_z, reference_points,
      course_id, target_structure_name, dose_per_fraction_gy, primary_point_name)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    studyId,
    str(payload.name),
    str(payload.machine_name, 'GenericLINAC'),
    num(payload.energy_mv, 6),
    num(payload.prescription_dose_gy),
    num(payload.number_of_fractions, 1),
    str(payload.normalization, 'ISOCENTER'),
    str(payload.optimization_algorithm, 'DMLC_IMRT'),
    str(payload.dose_algorithm, 'PENCIL_BEAM'),
    num(payload.grid_size_mm, 2),
    payload.heterogeneity_correction ? 1 : 0,
    num(payload.isocenter_x, 0),
    num(payload.isocenter_y, 0),
    num(payload.isocenter_z, 0),
    refPts.value,
    payload.course_id != null ? num(payload.course_id) : null,
    str(payload.target_structure_name),
    num(payload.dose_per_fraction_gy),
    str(payload.primary_point_name)
  );

  auditLog(db, { reqId, userId, action: 'create_ebrt_plan', resourceType: 'ebrt_plan', resourceId: info.lastInsertRowid, metadata: { studyId, name: payload.name } });

  const db2 = getDb();
  return getPlanWithBeams(db2, info.lastInsertRowid);
}

const UPDATABLE_PLAN_FIELDS = new Set([
  'name', 'machine_name', 'energy_mv', 'prescription_dose_gy', 'number_of_fractions',
  'normalization', 'optimization_algorithm', 'dose_algorithm', 'grid_size_mm',
  'heterogeneity_correction', 'approval_status', 'isocenter_x', 'isocenter_y', 'isocenter_z',
  'reference_points', 'course_id', 'target_structure_name', 'dose_per_fraction_gy',
  'primary_point_name', 'calc_models_json', 'delta_couch_json',
  'optimization_objectives_json',
]);

export function updatePlan({ id, payload = {}, userId, reqId }) {
  const db = getDb();
  // approval transition: run the pre-approval validation and snapshot the plan
  if (payload.approval_status === 'APPROVED') {
    const current = getPlan({ id, userId, reqId });
    if (current.approvalStatus !== 'APPROVED') {
      const checks = approvalChecks({ planId: id, userId, reqId });
      if (!checks.canApprove) {
        throw Object.assign(
          new Error(`Cannot approve: ${checks.errors.join('; ')}`),
          { status: 400, details: checks.errors },
        );
      }
      captureRevision({ planId: id, userId, reqId });
    }
  }
  const updates = [];
  const values = [];
  for (const [k, v] of Object.entries(payload)) {
    if (!UPDATABLE_PLAN_FIELDS.has(k)) continue;
    if (k === 'name' && !str(v)) throw Object.assign(new Error('name cannot be empty'), { status: 400 });
    if (k === 'approval_status' && !['UNAPPROVED', 'REVIEWED', 'APPROVED'].includes(v)) {
      throw Object.assign(new Error('invalid approval_status'), { status: 400 });
    }
    if (k === 'reference_points') {
      const refPts = validateReferencePoints(v);
      if (refPts.error) throw Object.assign(new Error(refPts.error), { status: 400 });
      updates.push(`${k} = ?`);
      values.push(refPts.value);
      continue;
    }
    if (k === 'calc_models_json' || k === 'delta_couch_json' || k === 'optimization_objectives_json') {
      // structured JSON fields: validate shapes, store the canonical form
      const parsed = parseJsonField(typeof v === 'string' ? v : JSON.stringify(v));
      if (parsed == null && v != null) throw Object.assign(new Error(`${k} must be valid JSON`), { status: 400 });
      updates.push(`${k} = ?`);
      values.push(v == null ? null : JSON.stringify(parsed));
      continue;
    }
    if (k === 'dose_per_fraction_gy') {
      const d = num(v);
      if (d !== null && d <= 0) throw Object.assign(new Error('dose_per_fraction_gy must be > 0'), { status: 400 });
      updates.push(`${k} = ?`);
      values.push(d);
      continue;
    }
    updates.push(`${k} = ?`);
    values.push(k === 'heterogeneity_correction' ? (v ? 1 : 0) : v);
  }
  if (updates.length === 0) {
    throw Object.assign(new Error('no updatable fields provided'), { status: 400 });
  }
  const info = db.prepare(`UPDATE ebrt_plans SET ${updates.join(', ')} WHERE id = ?`).run(...values, id);
  if (info.changes === 0) {
    throw Object.assign(new Error('EBRT plan not found'), { status: 404 });
  }
  auditLog(db, { reqId, userId, action: 'update_ebrt_plan', resourceType: 'ebrt_plan', resourceId: id, metadata: { fields: Object.keys(payload) } });
  return getPlan({ id, userId, reqId });
}

export function deletePlan({ id, userId, reqId }) {
  const db = getDb();
  const info = db.prepare('DELETE FROM ebrt_plans WHERE id = ?').run(id);
  if (info.changes === 0) {
    throw Object.assign(new Error('EBRT plan not found'), { status: 404 });
  }
  auditLog(db, { reqId, userId, action: 'delete_ebrt_plan', resourceType: 'ebrt_plan', resourceId: id });
  return { ok: true };
}

export function addBeam({ planId, payload = {}, userId, reqId }) {
  const db = getDb();
  const type = str(payload.beam_type, 'STATIC').toUpperCase();
  const error = validateBeamPayload({ ...payload, beam_type: type });
  if (error) throw Object.assign(new Error(error), { status: 400 });

  const plan = getPlanWithBeams(db, planId); // 404 if missing
  const nextNumber = plan.beams.reduce((m, b) => Math.max(m, b.beamNumber), 0) + 1;
  if (nextNumber > MAX_BEAMS) {
    throw Object.assign(new Error(`plan cannot exceed ${MAX_BEAMS} beams`), { status: 400 });
  }

  const info = db.prepare(`
    INSERT INTO ebrt_beams (plan_id, beam_number, name, beam_type, energy_mv, gantry_angle,
      gantry_angle_stop, collimator_angle, couch_angle, jaw_x1, jaw_x2, jaw_y1, jaw_y2, weight,
      wedge_angle, bolus)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    planId,
    nextNumber,
    str(payload.name, `Field ${nextNumber}`),
    type,
    num(payload.energy_mv, plan.energyMv ?? 6),
    num(payload.gantry_angle, 0),
    type === 'VMAT' ? num(payload.gantry_angle_stop, num(payload.gantry_angle, 0) + 180) : null,
    num(payload.collimator_angle, 0),
    num(payload.couch_angle, 0),
    num(payload.jaw_x1, -50), num(payload.jaw_x2, 50),
    num(payload.jaw_y1, -50), num(payload.jaw_y2, 50),
    num(payload.weight, 1),
    num(payload.wedge_angle),
    str(payload.bolus)
  );

  auditLog(db, { reqId, userId, action: 'add_ebrt_beam', resourceType: 'ebrt_beam', resourceId: info.lastInsertRowid, metadata: { planId, beamNumber: nextNumber } });

  return getPlan({ id: planId, userId, reqId });
}

export function updateBeam({ beamId, payload = {}, userId, reqId }) {
  const db = getDb();
  const existing = db.prepare('SELECT id, plan_id, beam_number FROM ebrt_beams WHERE id = ?').get(beamId);
  if (!existing) {
    throw Object.assign(new Error('Beam not found'), { status: 404 });
  }
  const error = validateBeamPayload(payload);
  if (error) throw Object.assign(new Error(error), { status: 400 });

  const allowed = ['name', 'beam_type', 'energy_mv', 'gantry_angle', 'gantry_angle_stop',
    'collimator_angle', 'couch_angle', 'jaw_x1', 'jaw_x2', 'jaw_y1', 'jaw_y2', 'weight',
    'wedge_angle', 'bolus'];
  const updates = [];
  const values = [];
  for (const k of allowed) {
    if (payload[k] === undefined) continue;
    updates.push(`${k} = ?`);
    values.push(k === 'beam_type' ? String(payload[k]).toUpperCase() : payload[k]);
  }
  if (updates.length === 0) {
    throw Object.assign(new Error('no updatable fields provided'), { status: 400 });
  }
  db.prepare(`UPDATE ebrt_beams SET ${updates.join(', ')} WHERE id = ?`).run(...values, beamId);

  auditLog(db, { reqId, userId, action: 'update_ebrt_beam', resourceType: 'ebrt_beam', resourceId: beamId, metadata: { planId: existing.plan_id, beamNumber: existing.beam_number } });

  return getPlan({ id: existing.plan_id, userId, reqId });
}

export function deleteBeam({ beamId, userId, reqId }) {
  const db = getDb();
  const existing = db.prepare('SELECT id, plan_id FROM ebrt_beams WHERE id = ?').get(beamId);
  if (!existing) {
    throw Object.assign(new Error('Beam not found'), { status: 404 });
  }
  db.prepare('DELETE FROM ebrt_beams WHERE id = ?').run(beamId);
  auditLog(db, { reqId, userId, action: 'delete_ebrt_beam', resourceType: 'ebrt_beam', resourceId: beamId, metadata: { planId: existing.plan_id } });
  return getPlan({ id: existing.plan_id, userId, reqId });
}

/**
 * Import a parsed RTPLAN file as an editable EBRT plan copy:
 * plan row (prescription/fractionation/isocenter) + one beam row per field.
 */
export async function createPlanFromRTPlan({ studyId, fileId, userId, reqId }) {
  const file = getDicomFile({ fileId, userId, reqId });
  if (file.modality !== 'RTPLAN') {
    throw Object.assign(new Error('File is not an RTPLAN'), { status: 400 });
  }
  const parsed = await parseRTPlan(file.file_path);

  const db = getDb();
  const isoBeam = parsed.beams.find(b => b.isocenterPosition) ?? parsed.beams[0];
  const iso = isoBeam?.isocenterPosition ?? { x: 0, y: 0, z: 0 };

  let planId;
  const insertPlan = db.transaction(() => {
    const info = db.prepare(`
      INSERT INTO ebrt_plans (study_id, name, machine_name, energy_mv, prescription_dose_gy,
        number_of_fractions, normalization, optimization_algorithm, dose_algorithm,
        grid_size_mm, heterogeneity_correction, approval_status, isocenter_x, isocenter_y, isocenter_z,
        source_rtplan_file_id)
      VALUES (?, ?, ?, ?, ?, ?, 'ISOCENTER', 'IMPORTED', 'IMPORTED_RTDOSE', 2, 0, ?, ?, ?, ?, ?)
    `).run(
      studyId,
      parsed.rtPlanLabel || `Imported plan ${fileId}`,
      parsed.beams[0]?.treatmentMachineName ?? null,
      parsed.beams[0]?.nominalBeamEnergyMV ?? null,
      parsed.prescription.targetPrescriptionDoseGy,
      parsed.fractionation.numberOfFractions,
      parsed.approvalStatus,
      iso.x, iso.y, iso.z,
      fileId
    );
    planId = info.lastInsertRowid;

    const insertBeam = db.prepare(`
      INSERT INTO ebrt_beams (plan_id, beam_number, name, beam_type, energy_mv, gantry_angle,
        gantry_angle_stop, collimator_angle, couch_angle, jaw_x1, jaw_x2, jaw_y1, jaw_y2, weight)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    parsed.beams.forEach(b => {
      if (!b.jawPosition || !b.isocenterPosition) return; // skip fields without geometry
      const beamType = b.beamType === 'DYNAMIC' ? 'DMLC' : str(b.beamType, 'STATIC').toUpperCase();
      // relative weight: beam's share of the prescription
      // (BeamDose is per-fraction → scale by the number of fractions)
      const fx = parsed.fractionation.numberOfFractions || 1;
      const beamDose = fractionDoseForBeam(parsed, b.beamNumber);
      const weight = beamDose != null && parsed.prescription.targetPrescriptionDoseGy > 0
        ? (beamDose * fx) / parsed.prescription.targetPrescriptionDoseGy
        : 1;
      insertBeam.run(
        planId, b.beamNumber, b.beamName ?? `Beam ${b.beamNumber}`,
        b.gantryArc ? 'VMAT' : beamType,
        b.nominalBeamEnergyMV,
        b.gantryAngleDeg,
        b.gantryArc ? b.gantryArc.end : null,
        b.beamLimitingDeviceAngleDeg, b.patientSupportAngleDeg,
        b.jawPosition.x1, b.jawPosition.x2, b.jawPosition.y1, b.jawPosition.y2,
        weight
      );
    });
  });
  insertPlan();

  // persist per-control-point delivery data (incl. MLC leaf positions) so
  // the beam model / engine v2 can consume real modulation
  const insertCP = db.prepare(`
    INSERT INTO beam_control_points (beam_id, cp_index, gantry_angle, collimator_angle,
      couch_angle, cumulative_meterset_weight, mlc_json)
    VALUES ((SELECT id FROM ebrt_beams WHERE plan_id = ? AND beam_number = ?), ?, ?, ?, ?, ?, ?)
  `);
  const insertCPs = db.transaction(() => {
    for (const b of parsed.beams) {
      for (const cp of (b.controlPoints ?? [])) {
        insertCP.run(
          planId, b.beamNumber, cp.cpIndex, cp.gantryAngle, cp.collimatorAngle,
          cp.couchAngle, cp.cumulativeMetersetWeight,
          cp.mlc ? JSON.stringify(cp.mlc) : null,
        );
      }
    }
  });
  insertCPs();

  auditLog(db, { reqId, userId, action: 'import_ebrt_plan_from_rtplan', resourceType: 'ebrt_plan', resourceId: planId, metadata: { studyId, fileId, beamCount: parsed.beams.length } });

  return getPlanWithBeams(db, planId);
}

function fractionDoseForBeam(parsed, beamNumber) {
  const i = parsed.beams.findIndex(b => b.beamNumber === beamNumber);
  return parsed.fractionation.beamDosesGy[i] ?? null;
}

/**
 * Copy a plan (with beams) into a reusable template: is_template=1.
 * The template keeps the origin study for audit purposes but is listed
 * study-independently.
 */
export function savePlanAsTemplate({ planId, name, userId, reqId }) {
  const db = getDb();
  const src = getPlanWithBeams(db, planId);
  const templateName = str(name) || `${src.name} template`;

  const info = db.prepare(`
    INSERT INTO ebrt_plans (study_id, name, machine_name, energy_mv, prescription_dose_gy,
      number_of_fractions, normalization, optimization_algorithm, dose_algorithm,
      grid_size_mm, heterogeneity_correction, approval_status, isocenter_x, isocenter_y, isocenter_z,
      reference_points, is_template, source_plan_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'UNAPPROVED', ?, ?, ?, ?, 1, ?)
  `).run(
    src.studyId, templateName, src.machineName, src.energyMv,
    src.prescriptionDoseGy, src.numberOfFractions,
    src.normalization, src.optimizationAlgorithm, src.doseAlgorithm,
    src.gridSizeMm, src.heterogeneityCorrection,
    src.isocenterX, src.isocenterY, src.isocenterZ,
    src.referencePoints.length > 0 ? JSON.stringify(src.referencePoints) : null,
    planId
  );
  const templateId = info.lastInsertRowid;

  const insertBeam = db.prepare(`
    INSERT INTO ebrt_beams (plan_id, beam_number, name, beam_type, energy_mv, gantry_angle,
      gantry_angle_stop, collimator_angle, couch_angle, jaw_x1, jaw_x2, jaw_y1, jaw_y2, weight,
      wedge_angle, bolus)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const copyBeams = db.transaction(() => {
    for (const b of src.beams) {
      insertBeam.run(
        templateId, b.beamNumber, b.name, b.beamType, b.energyMv,
        b.gantryAngle, b.gantryAngleStop, b.collimatorAngle, b.couchAngle,
        b.jawX1, b.jawX2, b.jawY1, b.jawY2, b.weight, b.wedgeAngle, b.bolus
      );
    }
  });
  copyBeams();

  auditLog(db, { reqId, userId, action: 'save_ebrt_plan_as_template', resourceType: 'ebrt_plan', resourceId: templateId, metadata: { sourcePlanId: planId, beamCount: src.beams.length } });
  return getPlanWithBeams(db, templateId);
}

/** List all plan templates (study-independent). */
export function listTemplates({ userId, reqId }) {
  const db = getDb();
  const rows = db.prepare(`
    SELECT id, study_id as studyId, name, machine_name as machineName, energy_mv as energyMv,
           prescription_dose_gy as prescriptionDoseGy, number_of_fractions as numberOfFractions,
           normalization, optimization_algorithm as optimizationAlgorithm, dose_algorithm as doseAlgorithm,
           grid_size_mm as gridSizeMm, heterogeneity_correction as heterogeneityCorrection,
           approval_status as approvalStatus, isocenter_x as isocenterX, isocenter_y as isocenterY, isocenter_z as isocenterZ,
           is_template as isTemplate, source_plan_id as sourcePlanId,
           created_at as createdAt,
           (SELECT COUNT(*) FROM ebrt_beams b WHERE b.plan_id = ebrt_plans.id) as beamCount
    FROM ebrt_plans WHERE is_template = 1 ORDER BY created_at DESC, id DESC
  `).all();
  auditLog(db, { reqId, userId, action: 'list_ebrt_templates', resourceType: 'ebrt_plan', metadata: { count: rows.length } });
  return rows;
}

/**
 * Instantiate a template into a study as a fresh editable plan
 * (is_template=0, source_plan_id=templateId) with all beams copied.
 */
export function instantiateTemplate({ templateId, studyId, name, userId, reqId }) {
  const db = getDb();
  const src = getPlanWithBeams(db, templateId);
  if (!src.isTemplate) {
    throw Object.assign(new Error('Plan is not a template'), { status: 400 });
  }
  const planName = str(name) || `${src.name.replace(/ template$/, '')} copy`;

  const info = db.prepare(`
    INSERT INTO ebrt_plans (study_id, name, machine_name, energy_mv, prescription_dose_gy,
      number_of_fractions, normalization, optimization_algorithm, dose_algorithm,
      grid_size_mm, heterogeneity_correction, approval_status, isocenter_x, isocenter_y, isocenter_z,
      reference_points, is_template, source_plan_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'UNAPPROVED', ?, ?, ?, ?, 0, ?)
  `).run(
    studyId, planName, src.machineName, src.energyMv,
    src.prescriptionDoseGy, src.numberOfFractions,
    src.normalization, src.optimizationAlgorithm, src.doseAlgorithm,
    src.gridSizeMm, src.heterogeneityCorrection,
    src.isocenterX, src.isocenterY, src.isocenterZ,
    src.referencePoints.length > 0 ? JSON.stringify(src.referencePoints) : null,
    templateId
  );
  const planId = info.lastInsertRowid;

  const insertBeam = db.prepare(`
    INSERT INTO ebrt_beams (plan_id, beam_number, name, beam_type, energy_mv, gantry_angle,
      gantry_angle_stop, collimator_angle, couch_angle, jaw_x1, jaw_x2, jaw_y1, jaw_y2, weight,
      wedge_angle, bolus)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const copyBeams = db.transaction(() => {
    for (const b of src.beams) {
      insertBeam.run(
        planId, b.beamNumber, b.name, b.beamType, b.energyMv,
        b.gantryAngle, b.gantryAngleStop, b.collimatorAngle, b.couchAngle,
        b.jawX1, b.jawX2, b.jawY1, b.jawY2, b.weight, b.wedgeAngle, b.bolus
      );
    }
  });
  copyBeams();

  auditLog(db, { reqId, userId, action: 'instantiate_ebrt_template', resourceType: 'ebrt_plan', resourceId: planId, metadata: { templateId, studyId, beamCount: src.beams.length } });
  return getPlanWithBeams(db, planId);
}

// ---------- B6: approval checks, delta couch, plan revisions ----------

/**
 * Pre-approval validation (Eclipse Plan Approval warnings & errors dialog):
 * errors block approval, warnings do not.
 * @returns {{planId:number, approvalStatus:string, errors:string[], warnings:string[], canApprove:boolean}}
 */
export function approvalChecks({ planId, userId, reqId }) {
  const plan = getPlan({ id: planId, userId, reqId });
  const errors = [];
  const warnings = [];
  const beams = plan.beams ?? [];

  if (beams.length === 0) errors.push('Plan has no beams');
  if (!plan.prescriptionDoseGy || plan.prescriptionDoseGy <= 0) errors.push('Plan has no prescription dose');
  if (plan.isocenterX == null && plan.isocenterY == null && plan.isocenterZ == null) {
    errors.push('Plan has no isocentre');
  }
  for (const b of beams) {
    if (b.jawX1 != null && b.jawX2 != null && b.jawX1 > b.jawX2) {
      errors.push(`Beam ${b.beamNumber}: jaw X1 > X2`);
    }
    if (b.jawY1 != null && b.jawY2 != null && b.jawY1 > b.jawY2) {
      errors.push(`Beam ${b.beamNumber}: jaw Y1 > Y2`);
    }
  }

  if (!plan.targetStructureName) warnings.push('No plan target structure set');
  if (!plan.referencePoints?.some(p => p.isDpv)) warnings.push('No dose prescription volume (DPV) point');
  const wSum = beams.reduce((a, b) => a + (b.weight ?? 0), 0);
  if (beams.length > 0 && Math.abs(wSum - 1) > 0.01) {
    warnings.push(`Beam weights sum to ${wSum.toFixed(3)} — Eclipse expects 1.0 for 100% at isocentre`);
  }
  for (const b of beams) {
    if (b.beamType === 'VMAT' && b.gantryAngleStop == null) {
      warnings.push(`Beam ${b.beamNumber}: VMAT arc has no stop angle`);
    }
    if (b.wedgeAngle != null && b.bolus) {
      warnings.push(`Beam ${b.beamNumber}: wedge and bolus combined — verify intent`);
    }
  }

  return {
    planId,
    approvalStatus: plan.approvalStatus,
    errors,
    warnings,
    canApprove: errors.length === 0,
  };
}

/** Append a snapshot of the plan (scalars + beams + reference points). */
export function captureRevision({ planId, userId, reqId }) {
  const db = getDb();
  const plan = getPlanWithBeams(db, planId);
  const last = db.prepare('SELECT MAX(revision_no) as n FROM plan_revisions WHERE plan_id = ?').get(planId);
  const revisionNo = (last?.n ?? 0) + 1;
  db.prepare(`
    INSERT INTO plan_revisions (plan_id, revision_no, snapshot_json, created_by)
    VALUES (?, ?, ?, ?)
  `).run(planId, revisionNo, JSON.stringify({
    plan,
    beams: plan.beams,
    referencePoints: plan.referencePoints,
  }), userId ?? null);
  auditLog(db, {
    reqId, userId,
    action: 'capture_plan_revision',
    resourceType: 'ebrt_plan', resourceId: planId,
    metadata: { revisionNo },
  });
  return revisionNo;
}

const REVISION_RESTORABLE = [
  'name', 'machine_name', 'energy_mv', 'prescription_dose_gy', 'number_of_fractions',
  'normalization', 'optimization_algorithm', 'dose_algorithm', 'grid_size_mm',
  'heterogeneity_correction', 'isocenter_x', 'isocenter_y', 'isocenter_z',
  'target_structure_name', 'dose_per_fraction_gy', 'reference_points',
];

/** List revisions of a plan (metadata only). */
export function listRevisions({ planId, userId, reqId }) {
  const db = getDb();
  const rows = db.prepare(`
    SELECT revision_no as revisionNo, created_by as createdBy, created_at as createdAt
    FROM plan_revisions WHERE plan_id = ? ORDER BY revision_no DESC
  `).all(planId);
  auditLog(db, { reqId, userId, action: 'list_plan_revisions', resourceType: 'ebrt_plan', resourceId: planId, metadata: { count: rows.length } });
  return rows;
}

/** Full snapshot of one revision. */
export function getRevision({ planId, revisionNo, userId, reqId }) {
  const db = getDb();
  const row = db.prepare(`
    SELECT revision_no as revisionNo, snapshot_json as snapshotJson, created_at as createdAt
    FROM plan_revisions WHERE plan_id = ? AND revision_no = ?
  `).get(planId, revisionNo);
  if (!row) throw Object.assign(new Error('Revision not found'), { status: 404 });
  return { revisionNo: row.revisionNo, createdAt: row.createdAt, snapshot: parseJsonField(row.snapshotJson) };
}

/** Restore a revision: plan scalars + beams + reference points, as a new
 *  head revision (history is never rewritten). */
export function rollbackToRevision({ planId, revisionNo, userId, reqId }) {
  const db = getDb();
  const rev = getRevision({ planId, revisionNo, userId, reqId });
  const snap = rev.snapshot;
  const plan = snap.plan;

  const cols = REVISION_RESTORABLE.map(k => `${k} = ?`).join(', ');
  const vals = REVISION_RESTORABLE.map(k => plan[k] ?? null);
  db.prepare(`UPDATE ebrt_plans SET ${cols} WHERE id = ?`).run(...vals, planId);

  db.prepare('DELETE FROM ebrt_beams WHERE plan_id = ?').run(planId);
  const insBeam = db.prepare(`
    INSERT INTO ebrt_beams (plan_id, beam_number, name, beam_type, energy_mv, gantry_angle,
      gantry_angle_stop, collimator_angle, couch_angle, jaw_x1, jaw_x2, jaw_y1, jaw_y2, weight,
      wedge_angle, bolus, meterset, leaf_pair_count)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const b of snap.beams ?? []) {
    insBeam.run(
      planId, b.beamNumber, b.name, b.beamType, b.energyMv, b.gantryAngle, b.gantryAngleStop,
      b.collimatorAngle, b.couchAngle, b.jawX1, b.jawX2, b.jawY1, b.jawY2, b.weight,
      b.wedgeAngle, b.bolus, b.meterset, b.leafPairCount,
    );
  }

  // rolling back replaces the plan content — an existing approval (and its
  // recorded couch shifts) no longer applies to the restored content
  db.prepare(`
    UPDATE ebrt_plans SET approval_status = 'UNAPPROVED', delta_couch_json = NULL
    WHERE id = ? AND approval_status != 'UNAPPROVED'
  `).run(planId);

  captureRevision({ planId: planId, userId, reqId }); // record the rollback as the new head
  auditLog(db, {
    reqId, userId,
    action: 'rollback_plan_revision',
    resourceType: 'ebrt_plan', resourceId: planId,
    metadata: { restoredRevisionNo: revisionNo },
  });
  return getPlan({ id: planId, userId, reqId });
}
