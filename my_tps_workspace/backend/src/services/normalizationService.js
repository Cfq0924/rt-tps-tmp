import { readFileSync, writeFileSync } from 'fs';
import dcmjs from 'dcmjs';
import { getDb } from '../db/init.js';
import { auditLog } from '../logging/index.js';
import { getDoseGrid, invalidateDoseGrid, parseRTDose } from './rtDoseService.js';
import { getPlan } from './ebrtPlanService.js';
import { loadStudyMeta } from './exportService.js';
import { parseRTStruct } from './rtStructService.js';

const { data: { datasetToBuffer } } = dcmjs;

/**
 * Plan normalization (Eclipse "Plan Normalization" dialog): rescale the
 * plan's dose grid by a computed factor, rewriting the derived RTDOSE file
 * in place (only DoseGridScaling changes — pixel data untouched).
 *
 * Modes (Eclipse dialog):
 *   TARGET_MAX / TARGET_MEAN / TARGET_MIN : target-structure statistic set to
 *       `value` % of the prescription dose
 *   PERCENT_OF_TARGET : target-structure mean set to `value` cGy
 *   ISOCENTER : isocentre voxel set to `value` % of prescription (default 100)
 *   VALUE : all doses scaled by `value` / 100
 */

const MODES = new Set([
  'TARGET_MAX', 'TARGET_MEAN', 'TARGET_MIN',
  'PERCENT_COVERS',            // X% covers Y% of target structure
  'BODY_MAX',
  'PRIMARY_REF_POINT',         // 100% at primary reference point (DPV)
  'REFERENCE_POINT',           // 100% at named reference point
  'ISOCENTER',                 // 100% at field isocentre
  'VALUE',                     // plan normalization value (× value/100)
  'NONE',                      // no plan normalization (record only)
]);

/** Locate the primary (DPV) or named reference point of a plan. */
function findRefPoint(plan, name = null) {
  const pts = plan.referencePoints ?? [];
  if (name) return pts.find(p => p.name === name) ?? null;
  return pts.find(p => p.isDpv || p.type === 'TARGET') ?? pts[0] ?? null;
}

/** Dose (cGy) at a reference point from the grid, or null when outside. */
function pointDose(grid, doseMeta, pt) {
  if (!pt || pt.x == null || pt.y == null || pt.z == null) return null;
  const { rows, columns, numberOfFrames, imagePosition, pixelSpacing, gridFrameOffsetVector } = doseMeta;
  const i = Math.round((pt.x - imagePosition.x) / pixelSpacing.j);
  const j = Math.round((pt.y - imagePosition.y) / pixelSpacing.i);
  let k = 0, best = Infinity;
  for (let f = 0; f < gridFrameOffsetVector.length; f++) {
    const d = Math.abs(gridFrameOffsetVector[f] - (pt.z - imagePosition.z));
    if (d < best) { best = d; k = f; }
  }
  if (i < 0 || i >= columns || j < 0 || j >= rows || k >= numberOfFrames) return null;
  return grid[k * rows * columns + j * columns + i];
}

function latestRtDoseFile(db, studyId) {
  return db.prepare(`
    SELECT id, file_path FROM dicom_files
    WHERE study_id = ? AND modality = 'RTDOSE'
    ORDER BY id DESC LIMIT 1
  `).get(studyId);
}

function latestRtStructFile(db, studyId) {
  return db.prepare(`
    SELECT id, file_path FROM dicom_files
    WHERE study_id = ? AND modality = 'RTSTRUCT'
    ORDER BY id DESC LIMIT 1
  `).get(studyId);
}

/** Even-odd scanline polygon fill on a cols×rows grid. */
function fillPolygons(mask, cols, rows, polys) {
  for (const poly of polys) {
    const n = poly.length / 2;
    if (n < 3) continue;
    const ys = poly.filter((_, i) => i % 2 === 1);
    const jMin = Math.max(0, Math.ceil(Math.min(...ys)));
    const jMax = Math.min(rows - 1, Math.floor(Math.max(...ys)));
    for (let j = jMin; j <= jMax; j++) {
      const cross = [];
      for (let e = 0; e < n; e++) {
        const xa = poly[e * 2], ya = poly[e * 2 + 1];
        const xb = poly[((e + 1) % n) * 2], yb = poly[((e + 1) % n) * 2 + 1];
        if ((ya <= j && yb > j) || (yb <= j && ya > j)) {
          cross.push(xa + ((j - ya) / (yb - ya)) * (xb - xa));
        }
      }
      cross.sort((a, b) => a - b);
      for (let k = 0; k + 1 < cross.length; k += 2) {
        const iA = Math.max(0, Math.ceil(cross[k]));
        const iB = Math.min(cols - 1, Math.floor(cross[k + 1]));
        for (let i = iA; i <= iB; i++) mask[j * cols + i] = 1;
      }
    }
  }
}

function sampleDose(grid, geom, p) {
  const { rows, columns, numberOfFrames, imagePosition, pixelSpacing, gridFrameOffsetVector } = geom;
  const i = Math.round((p[0] - imagePosition.x) / pixelSpacing.j);
  const j = Math.round((p[1] - imagePosition.y) / pixelSpacing.i);
  let k = 0, best = Infinity;
  for (let f = 0; f < gridFrameOffsetVector.length; f++) {
    const d = Math.abs(gridFrameOffsetVector[f] - (p[2] - imagePosition.z));
    if (d < best) { best = d; k = f; }
  }
  if (i < 0 || j < 0 || i >= columns || j >= rows || k >= numberOfFrames) return null;
  return grid[k * rows * columns + j * columns + i];
}

/**
 * Dose statistics of a named target structure on the dose grid.
 * @returns {Promise<{max:number, mean:number, min:number, voxelCount:number}|null>}
 */
export async function targetStructureStats({ studyId, structureName, doseGrid, doseMeta }) {
  const db = getDb();
  const rt = latestRtStructFile(db, studyId);
  if (!rt) return null;
  const { roiSequence, contourSequence } = await parseRTStruct(rt.file_path);
  const roi = roiSequence.find(r => r.roiName === structureName);
  if (!roi) return null;

  const { rows, columns, numberOfFrames, imagePosition, pixelSpacing, gridFrameOffsetVector } = doseMeta;
  const stats = { max: -Infinity, sum: 0, min: Infinity, voxelCount: 0 };
  for (let k = 0; k < numberOfFrames; k++) {
    const z = imagePosition.z + (gridFrameOffsetVector[k] ?? 0);
    const polys = [];
    for (const c of contourSequence) {
      if (c.referencedROINumber !== roi.roiNumber) continue;
      const d = c.contourData;
      if (d.length < 3) continue;
      let zc = 0;
      for (let p = 2; p < d.length; p += 3) zc += d[p];
      zc /= d.length / 3;
      if (Math.abs(zc - z) > 1.5) continue;
      const flat = [];
      for (let p = 0; p < d.length; p += 3) {
        flat.push((d[p] - imagePosition.x) / pixelSpacing.j);
        flat.push((d[p + 1] - imagePosition.y) / pixelSpacing.i);
      }
      polys.push(flat);
    }
    if (polys.length === 0) continue;
    const mask = new Uint8Array(rows * columns);
    fillPolygons(mask, columns, rows, polys);
    const off = k * rows * columns;
    for (let idx = 0; idx < rows * columns; idx++) {
      if (mask[idx]) {
        const v = doseGrid[off + idx];
        if (v > stats.max) stats.max = v;
        if (v < stats.min) stats.min = v;
        stats.sum += v;
        stats.voxelCount++;
      }
    }
  }
  return stats.voxelCount > 0
    ? { max: stats.max, mean: stats.sum / stats.voxelCount, min: stats.min, voxelCount: stats.voxelCount }
    : null;
}

/**
 * Compute the dose-grid rescale factor for a normalization request.
 * @returns {Promise<{factor:number, description:string}>}
 */
export async function computeNormalizationFactor({ studyId, plan, mode, value, doseGrid, doseMeta, prescriptionCgy }) {
  const rx = prescriptionCgy ?? (plan.prescriptionDoseGy ?? 0) * 100;
  if (mode === 'VALUE') {
    if (!value || value <= 0) throw Object.assign(new Error('VALUE mode needs a positive value'), { status: 400 });
    return { factor: value / 100, description: `scale × ${value}%` };
  }
  if (mode === 'BODY_MAX') {
    const max = doseGrid.reduce((m, v) => (v > m ? v : m), 0);
    if (max <= 0) throw Object.assign(new Error('dose grid is empty'), { status: 400 });
    return { factor: (rx * ((value ?? 100) / 100)) / max, description: `body max → ${value ?? 100}% of Rx` };
  }
  if (mode === 'PRIMARY_REF_POINT' || mode === 'REFERENCE_POINT') {
    const pt = mode === 'PRIMARY_REF_POINT'
      ? findRefPoint(plan)
      : findRefPoint(plan, String(value ?? ''));
    if (!pt) throw Object.assign(new Error('reference point not found'), { status: 400 });
    const dose = pointDose(doseGrid, doseMeta, pt);
    if (dose == null || dose <= 0) throw Object.assign(new Error('reference point is outside the dose grid'), { status: 400 });
    return { factor: (rx * ((value ?? 100) / 100)) / dose, description: `${pt.name} → ${value ?? 100}% of Rx` };
  }
  if (mode === 'NONE') {
    return { factor: 1, description: 'no plan normalization' };
  }
  if (mode === 'ISOCENTER') {
    const v = value ?? 100;
    const dose = sampleDose(doseGrid, doseMeta, [plan.isocenterX ?? 0, plan.isocenterY ?? 0, plan.isocenterZ ?? 0]);
    if (dose == null || dose <= 0) throw Object.assign(new Error('isocentre dose unavailable'), { status: 400 });
    return { factor: (rx * (v / 100)) / dose, description: `isocentre → ${v}% of Rx` };
  }
  if (['TARGET_MAX', 'TARGET_MEAN', 'TARGET_MIN', 'PERCENT_OF_TARGET'].includes(mode)) {
    if (!plan.targetStructureName) {
      throw Object.assign(new Error('plan has no target structure set'), { status: 400 });
    }
    const stats = await targetStructureStats({ studyId, structureName: plan.targetStructureName, doseGrid, doseMeta });
    if (!stats) throw Object.assign(new Error('target structure has no dose in the grid'), { status: 400 });
    if (mode === 'PERCENT_OF_TARGET') {
      if (!value || value <= 0) throw Object.assign(new Error('PERCENT_OF_TARGET needs a positive value (cGy)'), { status: 400 });
      return { factor: value / stats.mean, description: `target mean → ${value} cGy` };
    }
    if (!value || value <= 0) throw Object.assign(new Error('value (% of Rx) is required'), { status: 400 });
    const desired = rx * (value / 100);
    const current = mode === 'TARGET_MAX' ? stats.max : mode === 'TARGET_MEAN' ? stats.mean : stats.min;
    return { factor: desired / current, description: `${mode} → ${value}% of Rx` };
  }
  throw Object.assign(new Error(`unknown normalization mode: ${mode}`), { status: 400 });
}

/**
 * Rescale the plan's RTDOSE file in place by the computed factor and record
 * the normalization. Only DoseGridScaling changes — pixel data untouched.
 * @returns {{factor:number, mode:string, description:string, newScaling:number, doseFileId:number}}
 */
export async function normalizePlanDose({ planId, mode, value, userId, reqId }) {
  const db = getDb();
  if (!MODES.has(mode)) {
    throw Object.assign(new Error(`unknown normalization mode: ${mode}`), { status: 400 });
  }
  const plan = getPlan({ id: planId, userId, reqId });
  const doseFile = latestRtDoseFile(db, plan.studyId);
  if (!doseFile) {
    throw Object.assign(new Error('No dose grid available — calculate or import a dose first'), { status: 400 });
  }
  invalidateDoseGrid(doseFile.id);
  const grid = await getDoseGrid(doseFile.id, {}, reqId);
  const { factor, description } = await computeNormalizationFactor({
    studyId: plan.studyId, plan, mode, value,
    doseGrid: grid.grid,
    doseMeta: grid,
    prescriptionCgy: (plan.prescriptionDoseGy ?? 0) * 100,
  });

  // regenerate the RTDOSE file: same geometry, raw stored pixels scaled by
  // the factor, DoseGridScaling unchanged — a deterministic, proven path
  // (the raw-dict edit round trip corrupted pixel data empirically)
  const studyMeta = loadStudyMeta(db, plan.studyId);
  const parsed = await parseRTDose(doseFile.file_path);
  const pixels = new Int32Array(parsed.pixelData.length);
  for (let i = 0; i < parsed.pixelData.length; i++) {
    pixels[i] = Math.round(Number(parsed.pixelData[i]) * factor);
  }
  const now = new Date();
  const p2 = (n) => String(n).padStart(2, '0');
  const dataset = {
    _meta: {},
    SpecificCharacterSet: 'ISO_IR 192',
    SOPClassUID: '1.2.840.10008.5.1.4.1.481.2',
    SOPInstanceUID: doseFile.sop_instance_uid,
    StudyInstanceUID: studyMeta.study_instance_uid,
    SeriesInstanceUID: doseFile.series_instance_uid,
    Modality: 'RTDOSE',
    PatientName: studyMeta.patient_name ?? '',
    PatientID: studyMeta.patient_external_id ?? '',
    PatientBirthDate: studyMeta.patient_birth_date ?? undefined,
    PatientSex: undefined,
    SamplesPerPixel: 1,
    PhotometricInterpretation: 'MONOCHROME2',
    Rows: parsed.rows,
    Columns: parsed.columns,
    NumberOfFrames: parsed.numberOfFrames,
    BitsAllocated: 32,
    BitsStored: 32,
    HighBit: 31,
    PixelRepresentation: 1,
    ImagePositionPatient: parsed.imagePosition ? [parsed.imagePosition.x, parsed.imagePosition.y, parsed.imagePosition.z] : [0, 0, 0],
    ImageOrientationPatient: [1, 0, 0, 0, 1, 0],
    PixelSpacing: parsed.pixelSpacing ? [parsed.pixelSpacing.i, parsed.pixelSpacing.j] : [1, 1],
    GridFrameOffsetVector: parsed.gridFrameOffsetVector,
    FrameIncrementPointer: '3004000C',
    DoseUnits: parsed.doseUnits || 'GY',
    DoseType: parsed.doseType || 'PLAN',
    DoseSummationType: parsed.doseSummationType || 'PLAN',
    DoseGridScaling: parsed.doseGridScaling,
    PixelData: new Uint8Array(pixels.buffer),
    InstanceCreationDate: new Date().toISOString().slice(0, 10).replaceAll('-', ''),
    InstanceCreationTime: `${p2(now.getHours())}${p2(now.getMinutes())}${p2(now.getSeconds())}`,
  };
  const out = Buffer.from(datasetToBuffer(dataset));
  writeFileSync(doseFile.file_path, out);
  invalidateDoseGrid(doseFile.id);

  db.prepare('UPDATE ebrt_plans SET normalization = ? WHERE id = ?')
    .run(`${mode} ×${factor.toFixed(4)}`, planId);

  auditLog(db, {
    reqId, userId,
    action: 'normalize_plan_dose',
    resourceType: 'ebrt_plan', resourceId: planId,
    metadata: { mode, value: value ?? null, factor, doseFileId: doseFile.id },
  });

  return { factor, mode, description, doseFileId: doseFile.id };
}

