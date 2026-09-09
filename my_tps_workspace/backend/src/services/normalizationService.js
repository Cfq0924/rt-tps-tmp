import { readFileSync, writeFileSync } from 'fs';
import dcmjs from 'dcmjs';
import { getDb } from '../db/init.js';
import { auditLog } from '../logging/index.js';
import { getDoseGrid, invalidateDoseGrid } from './rtDoseService.js';
import { getPlan } from './ebrtPlanService.js';
import { parseRTStruct } from './rtStructService.js';

const { data: { DicomMessage } } = dcmjs;

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

const MODES = new Set(['TARGET_MAX', 'TARGET_MEAN', 'TARGET_MIN', 'PERCENT_OF_TARGET', 'ISOCENTER', 'VALUE']);

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
  const grid = await getDoseGrid(doseFile.id, {}, reqId);
  const { factor, description } = await computeNormalizationFactor({
    studyId: plan.studyId, plan, mode, value,
    doseGrid: grid.grid,
    doseMeta: grid,
    prescriptionCgy: (plan.prescriptionDoseGy ?? 0) * 100,
  });

  // read the raw file, update DoseGridScaling (lossless round trip), rewrite
  const buf = readFileSync(doseFile.file_path);
  const dicomDict = DicomMessage.readFile(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
  const el = dicomDict.dict['3004000E'];
  if (!el) {
    throw Object.assign(new Error('dose file has no DoseGridScaling element'), { status: 400 });
  }
  const oldScaling = Number(Array.isArray(el._rawValue) ? el._rawValue[0] : (Array.isArray(el.Value) ? el.Value[0] : 1)) || 1;
  const newScaling = Number((oldScaling * factor).toPrecision(8));
  if (Array.isArray(el._rawValue)) el._rawValue = [String(newScaling)];
  el.Value = [newScaling];
  const out = Buffer.from(dicomDict.write());
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

  return { factor, mode, description, newScaling, doseFileId: doseFile.id };
}
