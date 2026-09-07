import { getDb } from '../db/init.js';
import { auditLog } from '../logging/index.js';
import { parseRTPlan } from './rtPlanService.js';
import { getDicomFile } from './dicomService.js';

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
  return null;
}

const PLAN_SELECT = `
  SELECT id, study_id as studyId, name, machine_name as machineName, energy_mv as energyMv,
         prescription_dose_gy as prescriptionDoseGy, number_of_fractions as numberOfFractions,
         normalization, optimization_algorithm as optimizationAlgorithm, dose_algorithm as doseAlgorithm,
         grid_size_mm as gridSizeMm, heterogeneity_correction as heterogeneityCorrection,
         approval_status as approvalStatus, isocenter_x as isocenterX, isocenter_y as isocenterY, isocenter_z as isocenterZ,
         source_rtplan_file_id as sourceRtplanFileId, created_at as createdAt
  FROM ebrt_plans`;

function getPlanWithBeams(db, id) {
  const plan = db.prepare(`${PLAN_SELECT} WHERE id = ?`).get(id);
  if (!plan) {
    throw Object.assign(new Error('EBRT plan not found'), { status: 404 });
  }
  plan.beams = db.prepare(`
    SELECT id, plan_id as planId, beam_number as beamNumber, name, beam_type as beamType,
           energy_mv as energyMv, gantry_angle as gantryAngle, gantry_angle_stop as gantryAngleStop,
           collimator_angle as collimatorAngle, couch_angle as couchAngle,
           jaw_x1 as jawX1, jaw_x2 as jawX2, jaw_y1 as jawY1, jaw_y2 as jawY2, weight
    FROM ebrt_beams WHERE plan_id = ? ORDER BY beam_number
  `).all(id);
  return plan;
}

export function listPlans({ studyId, userId, reqId }) {
  const db = getDb();
  const rows = db.prepare(`
    SELECT id, study_id as studyId, name, machine_name as machineName, energy_mv as energyMv,
           prescription_dose_gy as prescriptionDoseGy, number_of_fractions as numberOfFractions,
           normalization, optimization_algorithm as optimizationAlgorithm, dose_algorithm as doseAlgorithm,
           grid_size_mm as gridSizeMm, heterogeneity_correction as heterogeneityCorrection,
           approval_status as approvalStatus, isocenter_x as isocenterX, isocenter_y as isocenterY, isocenter_z as isocenterZ,
           source_rtplan_file_id as sourceRtplanFileId, created_at as createdAt,
           (SELECT COUNT(*) FROM ebrt_beams b WHERE b.plan_id = ebrt_plans.id) as beamCount
    FROM ebrt_plans WHERE study_id = ? ORDER BY created_at DESC, id DESC
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

  const db = getDb();
  const info = db.prepare(`
    INSERT INTO ebrt_plans (study_id, name, machine_name, energy_mv, prescription_dose_gy,
      number_of_fractions, normalization, optimization_algorithm, dose_algorithm,
      grid_size_mm, heterogeneity_correction, isocenter_x, isocenter_y, isocenter_z)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
    num(payload.isocenter_z, 0)
  );

  auditLog(db, { reqId, userId, action: 'create_ebrt_plan', resourceType: 'ebrt_plan', resourceId: info.lastInsertRowid, metadata: { studyId, name: payload.name } });

  const db2 = getDb();
  return getPlanWithBeams(db2, info.lastInsertRowid);
}

const UPDATABLE_PLAN_FIELDS = new Set([
  'name', 'machine_name', 'energy_mv', 'prescription_dose_gy', 'number_of_fractions',
  'normalization', 'optimization_algorithm', 'dose_algorithm', 'grid_size_mm',
  'heterogeneity_correction', 'approval_status', 'isocenter_x', 'isocenter_y', 'isocenter_z',
]);

export function updatePlan({ id, payload = {}, userId, reqId }) {
  const db = getDb();
  const updates = [];
  const values = [];
  for (const [k, v] of Object.entries(payload)) {
    if (!UPDATABLE_PLAN_FIELDS.has(k)) continue;
    if (k === 'name' && !str(v)) throw Object.assign(new Error('name cannot be empty'), { status: 400 });
    if (k === 'approval_status' && !['UNAPPROVED', 'REVIEWED', 'APPROVED'].includes(v)) {
      throw Object.assign(new Error('invalid approval_status'), { status: 400 });
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
      gantry_angle_stop, collimator_angle, couch_angle, jaw_x1, jaw_x2, jaw_y1, jaw_y2, weight)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
    num(payload.weight, 1)
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
    'collimator_angle', 'couch_angle', 'jaw_x1', 'jaw_x2', 'jaw_y1', 'jaw_y2', 'weight'];
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

  auditLog(db, { reqId, userId, action: 'import_ebrt_plan_from_rtplan', resourceType: 'ebrt_plan', resourceId: planId, metadata: { studyId, fileId, beamCount: parsed.beams.length } });

  return getPlanWithBeams(db, planId);
}

function fractionDoseForBeam(parsed, beamNumber) {
  const i = parsed.beams.findIndex(b => b.beamNumber === beamNumber);
  return parsed.fractionation.beamDosesGy[i] ?? null;
}
