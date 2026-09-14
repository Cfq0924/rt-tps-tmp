import { getDb } from '../db/init.js';
import { parseCTHU, computeDepthMapV2 } from './doseEngineService.js';
import { beamAxes, tprParams, tpr, inverseSquare, projectToBEV, huToRho } from './doseV2Math.js';
import { getPlan } from './ebrtPlanService.js';
import { getDoseGrid } from './rtDoseService.js';
import { parseRTStruct } from './rtStructService.js';
import { latestFileByModality } from './dicomQuery.js';
import { auditLog } from '../logging/index.js';

/**
 * P4-M3 MVP — inverse fluence optimizer for static-field IMRT.
 *
 * Physics: the influence of one beamlet on one voxel is the v2 engine's
 * open-field kernel restricted to that beamlet's BEV cell —
 *   D(v, b) = TPR(d_rad(v)) · ISF(v)   if v projects into beamlet b, else 0.
 * The total dose is linear in the beamlet fluence weights, so objectives are
 * quadratic with exact gradients and a projected-gradient solver (x ≥ 0)
 * converges in a few dozen cheap iterations.
 *
 * Voxels: only voxels inside the objective structures plus a sampled normal
 * tissue (body) set are kept — outside them the MVP has no objective, which
 * mirrors the Eclipse MVP boundary (NTO is §K UI-only for now).
 *
 * Delivery: each beam's optimized fluence map is converted to unidirectional
 * sliding-window MLC control points (Bortfeld sweep, quantized intensity
 * levels) and written to beam_control_points, so the existing v2 dose
 * calculation produces the final dose.
 */

const SAD = 1000;
const BEAMLET_MM = 5;
const LEAF_PAIRS = 60;
const LEAF_WIDTH_MM = 5;
const MAX_STORED_ITERATIONS = 100; // runtime cap — settings.maxIterations may be 999

const runs = new Map(); // planId -> run state (single run per plan)

// ---------- structures → voxel masks on the dose grid ----------

function pointInPolygon(x, y, poly) {
  let inside = false;
  const n = poly.length / 2;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = poly[i * 2], yi = poly[i * 2 + 1];
    const xj = poly[j * 2], yj = poly[j * 2 + 1];
    if (((yi > y) !== (yj > y)) && (x < ((xj - xi) * (y - yi)) / (yj - yi) + xi)) inside = !inside;
  }
  return inside;
}

/**
 * Rasterize RTSTRUCT structures onto the dose grid.
 * @returns {Map<string, Set<number>>} structure name → set of global voxel
 *   indices (k * rows * columns + j * columns + i) inside that structure.
 */
async function structureMasks(studyId, structureNames, grid) {
  const masks = new Map(structureNames.map(n => [n, new Set()]));
  const rt = latestFileByModality(getDb(), studyId, 'RTSTRUCT');
  if (!rt) return masks;
  const { roiSequence, contourSequence } = await parseRTStruct(rt.file_path);
  const numberByName = new Map(roiSequence.map(r => [r.roiName, r.roiNumber]));
  const { rows, columns, numberOfFrames, imagePosition, pixelSpacing, gridFrameOffsetVector } = grid;

  // group polygon contours by referenced ROI: z → array of flat polygons
  const byRoi = new Map();
  for (const c of contourSequence) {
    const name = [...numberByName.entries()].find(([, num]) => num === c.referencedROINumber)?.[0];
    if (!name || !masks.has(name)) continue;
    let list = byRoi.get(c.referencedROINumber);
    if (!list) { list = []; byRoi.set(c.referencedROINumber, list); }
    const z = c.contourData[2];
    let zs = list.find(e => e.z === z);
    if (!zs) { zs = { z, polys: [] }; list.push(zs); }
    const flat = [];
    for (let p = 0; p + 2 < c.contourData.length; p += 3) flat.push(c.contourData[p], c.contourData[p + 1]);
    if (flat.length >= 6) zs.polys.push(flat);
  }

  const zTol = Math.abs((gridFrameOffsetVector[1] ?? 0) - (gridFrameOffsetVector[0] ?? 0)) || 1.5;
  for (const [, zsList] of byRoi) {
    for (const { z, polys } of zsList) {
      // nearest dose frame for this contour slice
      let k = -1, bestD = Infinity;
      for (let f = 0; f < numberOfFrames; f++) {
        const d = Math.abs(imagePosition.z + (gridFrameOffsetVector[f] ?? 0) - z);
        if (d < bestD) { bestD = d; k = f; }
      }
      if (k < 0 || bestD > zTol) continue;
      const zFrame = imagePosition.z + (gridFrameOffsetVector[k] ?? 0);
      for (const name of masks.keys()) {
        const zs = (byRoi.get(numberByName.get(name)) ?? []).find(e => Math.abs(e.z - zFrame) <= zTol);
        if (!zs) continue;
        const mask = masks.get(name);
        const off = k * rows * columns;
        for (const poly of zs.polys) {
          let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
          for (let p = 0; p < poly.length; p += 2) {
            if (poly[p] < minX) minX = poly[p];
            if (poly[p] > maxX) maxX = poly[p];
            if (poly[p + 1] < minY) minY = poly[p + 1];
            if (poly[p + 1] > maxY) maxY = poly[p + 1];
          }
          const j0 = Math.max(0, Math.ceil((minY - imagePosition.y) / pixelSpacing.i));
          const j1 = Math.min(rows - 1, Math.floor((maxY - imagePosition.y) / pixelSpacing.i));
          const i0 = Math.max(0, Math.ceil((minX - imagePosition.x) / pixelSpacing.j));
          const i1 = Math.min(columns - 1, Math.floor((maxX - imagePosition.x) / pixelSpacing.j));
          for (let j = j0; j <= j1; j++) {
            const y = imagePosition.y + j * pixelSpacing.i;
            for (let i = i0; i <= i1; i++) {
              const x = imagePosition.x + i * pixelSpacing.j;
              if (pointInPolygon(x, y, poly)) mask.add(off + j * columns + i);
            }
          }
        }
      }
    }
  }
  return masks;
}

// ---------- per-beam beamlet influence ----------

/**
 * Build the sparse beamlet influence for one beam over the optimization
 * voxel set. Reuses the v2 engine physics: radiological depth per voxel
 * (in-plane sweep), BEV projection, TPR and inverse square.
 */
function beamInfluence({ beam, grid, ctSlices, voxelSet }) {
  const { rows, columns, numberOfFrames, imagePosition, pixelSpacing, gridFrameOffsetVector } = grid;
  const iso = { x: beam.isocenterX, y: beam.isocenterY, z: beam.isocenterZ };
  const gantry = beam.gantryAngle ?? 0;
  const axes = beamAxes(gantry);
  const source = [iso.x - SAD * axes.dir[0], iso.y - SAD * axes.dir[1], iso.z - SAD * axes.dir[2]];
  const tp = tprParams(beam.energyMv ?? 6);

  const x1 = beam.jaw_x1 ?? -50, x2 = beam.jaw_x2 ?? 50;
  const y1 = beam.jaw_y1 ?? -50, y2 = beam.jaw_y2 ?? 50;
  const cols = Math.max(1, Math.ceil((x2 - x1) / BEAMLET_MM));
  const nRows = Math.max(1, Math.ceil((y2 - y1) / BEAMLET_MM));

  // bucket[beamletIndex] = { locals: [], factors: [] } (union-voxel local ids)
  const buckets = new Map();

  const ctByZ = [...ctSlices].sort((a, b) => a.z - b.z);
  const nearestSlice = (z) => ctByZ.reduce((best, s) => (Math.abs(s.z - z) < Math.abs(best.z - z) ? s : best), ctByZ[0]);
  const sliceRho = new Map();

  for (let k = 0; k < numberOfFrames; k++) {
    const z = imagePosition.z + (gridFrameOffsetVector[k] ?? 0);
    const slice = nearestSlice(z);
    let rho = sliceRho.get(slice.z);
    if (!rho) {
      rho = new Float32Array(slice.hu.length);
      for (let i = 0; i < slice.hu.length; i++) rho[i] = huToRho(slice.hu[i]);
      sliceRho.set(slice.z, rho);
    }
    const depth = computeDepthMapV2(rho, slice.cols, slice.rows, slice.imagePosition.x, slice.imagePosition.y,
      slice.spacingX, slice.spacingY, axes.dir[0], axes.dir[1]);
    const off = k * rows * columns;
    for (let j = 0; j < rows; j++) {
      const py = imagePosition.y + j * pixelSpacing.i;
      for (let i = 0; i < columns; i++) {
        const pxx = imagePosition.x + i * pixelSpacing.j;
        const gIdx = off + j * columns + i;
        if (!voxelSet.has(gIdx)) continue;
        const ci = Math.round((pxx - slice.imagePosition.x) / slice.spacingX);
        const cj = Math.round((py - slice.imagePosition.y) / slice.spacingY);
        if (ci < 0 || ci >= slice.cols || cj < 0 || cj >= slice.rows) continue;
        const dv = depth[cj * slice.cols + ci];
        if (dv <= 0) continue;
        const bev = projectToBEV([pxx, py, z], source, SAD, axes);
        if (!bev) continue;
        if (bev.x < x1 || bev.x > x2 || bev.y < y1 || bev.y > y2) continue;
        const col = Math.min(cols - 1, Math.max(0, Math.floor((bev.x - x1) / BEAMLET_MM)));
        const row = Math.min(nRows - 1, Math.max(0, Math.floor((bev.y - y1) / BEAMLET_MM)));
        const bIdx = row * cols + col;
        const f = tpr(dv / 10, tp) * inverseSquare(bev.distFromSource, SAD);
        let bucket = buckets.get(bIdx);
        if (!bucket) { bucket = { locals: [], factors: [] }; buckets.set(bIdx, bucket); }
        bucket.locals.push(gIdx);
        bucket.factors.push(f);
      }
    }
  }

  return { beamletCols: cols, beamletRows: nRows, x0: x1, y0: y1, buckets };
}

// ---------- objectives (penalty + gradient on the union voxels) ----------

/**
 * Quantile helper: return the dose threshold such that exactly `allowedPct`
 * percent of the voxels may exceed it (sorted descending, top fraction kept).
 */
function upperThreshold(sortedDesc, allowedPct) {
  const keep = Math.max(1, Math.round((sortedDesc.length * Math.min(100, Math.max(0, allowedPct))) / 100));
  return sortedDesc[Math.min(keep - 1, sortedDesc.length - 1)];
}

function lowerThreshold(sortedAsc, allowedPct) {
  // allowedPct of the volume must REACH the dose → ignore the coldest (100-allowed)%
  const cold = 100 - Math.min(100, Math.max(0, allowedPct));
  const ignore = Math.round((sortedAsc.length * cold) / 100);
  return sortedAsc[Math.min(ignore, sortedAsc.length - 1)];
}

/** Per-voxel dose over one structure's voxels for the current fluence. */
function structureDose(structure, bucketsPerBeam, x) {
  const d = new Float64Array(structure.locals.length);
  for (let bi = 0; bi < bucketsPerBeam.length; bi++) {
    const { beamletOffsets, beamletLocals, beamletFactors } = bucketsPerBeam[bi];
    for (let b = 0; b < beamletOffsets.length - 1; b++) {
      const w = x[beamletOffsets[b]];
      if (w <= 0) continue;
      for (let e = beamletOffsets[b]; e < beamletOffsets[b + 1]; e++) {
        d[beamletLocals[e]] += w * beamletFactors[e];
      }
    }
  }
  return d;
}

// ---------- fluence → sliding-window MLC control points ----------

/**
 * Convert one beam's fluence map (beamlet rows × cols, non-negative) into
 * unidirectional sliding-window control points. Rows map onto MLC leaf
 * pairs; all other pairs are closed. Cumulative meterset weights ascend
 * with the intensity level.
 * @returns {Array<{cpIndex, cumulativeWeight, leafPairs: Array<{x1, x2}>}>}
 */
export function fluenceToSlidingWindowMLC({ fluence, x0, y0, levels = 32,
  beamletMm = BEAMLET_MM, leafPairs = LEAF_PAIRS, leafWidthMm = LEAF_WIDTH_MM }) {
  const nRows = fluence.length;
  const nCols = fluence[0]?.length ?? 0;
  let maxF = 0;
  for (const row of fluence) for (const v of row) if (v > maxF) maxF = v;
  if (maxF <= 0 || nCols === 0) return [];
  const K = Math.max(1, Math.min(levels, Math.ceil(maxF)));
  const scale = K / maxF;

  const closed = { x1: 0, x2: 0 };
  const cps = [];
  for (let k = 0; k < K; k++) {
    const leafPairsOut = new Array(leafPairs).fill(null).map(() => ({ ...closed }));
    for (let r = 0; r < nRows; r++) {
      // bin j is open at level k while cum[j-1] <= k < cum[j]
      let first = -1, last = -1;
      let cum = 0;
      for (let j = 0; j < nCols; j++) {
        const cPrev = cum;
        cum += fluence[r][j] * scale;
        const open = cum > k && cPrev <= k;
        if (open) {
          if (first < 0) first = j;
          last = j;
        }
        if (cum > k + 1) break; // this bin stays open past level k+1 — sweep moved on
      }
      if (first < 0) continue;
      const pairIdx = Math.floor((y0 + (r + 0.5) * beamletMm + (leafPairs * leafWidthMm) / 2) / leafWidthMm);
      if (pairIdx < 0 || pairIdx >= leafPairs) continue;
      leafPairsOut[pairIdx] = { x1: x0 + first * beamletMm, x2: x0 + (last + 1) * beamletMm };
    }
    cps.push({
      cpIndex: k,
      cumulativeWeight: Number(((k + 1) / K).toFixed(4)),
      leafPairs: leafPairsOut,
    });
  }
  return cps;
}

// ---------- run orchestration ----------

function sendProgress(planId, patch) {
  const run = runs.get(planId);
  if (run) Object.assign(run, patch);
}

/**
 * Start an optimization run for a plan. One active run per plan.
 * @param {Object} params
 * @param {number} params.planId
 * @param {Array} params.objectives - Eclipse-shaped objectives (doseCgy…)
 * @param {Object|null} params.nto
 * @param {Object} params.settings - { maxIterations, maxTimeMin, resolutionMm }
 * @returns {{ started: boolean, runId: number }}
 */
export function startOptimizationRun({ planId, objectives = [], settings = {}, userId = null, reqId = null }) {
  if (runs.has(planId) && runs.get(planId).running) {
    throw Object.assign(new Error('An optimization run is already active for this plan'), { status: 409 });
  }
  const usable = objectives.filter(o => o.doseCgy != null && o.enabled !== false);
  if (usable.length === 0) {
    throw Object.assign(new Error('No usable objectives (need at least one with an absolute dose)'), { status: 400 });
  }
  const run = {
    planId, running: true, phase: 'influence', iteration: 0,
    maxIterations: Math.min(Math.max(1, settings.maxIterations ?? 60), MAX_STORED_ITERATIONS),
    elapsedS: 0, penalty: null, converged: false, done: false, error: null,
    readouts: [], history: [],
    startedAt: Date.now(), userId, reqId,
    stopRequested: false,
  };
  runs.set(planId, run);

  (async () => {
    try {
      const plan = getPlan({ id: planId, userId, reqId });
      if (!plan.beams?.length) throw new Error('Plan has no beams');
      const db = getDb();
      const doseFile = db.prepare(`
        SELECT id FROM dicom_files WHERE study_id = ? AND modality = 'RTDOSE' ORDER BY id DESC LIMIT 1
      `).get(plan.studyId);
      if (!doseFile) throw new Error('No RTDOSE in the study — create the reference dose geometry first');
      const grid = await getDoseGrid(doseFile.id, {}, reqId);
      sendProgress(planId, { phase: 'structures' });

      const names = [...new Set(usable.map(o => o.structureName))];
      const masks = await structureMasks(plan.studyId, [...names, 'BODY'], grid);

      // union voxel set: objective structures + sampled BODY (normal tissue)
      const union = [];
      const unionIndex = new Map();
      const structures = [];
      const pushStructure = (name) => {
        const locals = [];
        for (const g of masks.get(name) ?? []) {
          if (!unionIndex.has(g)) { unionIndex.set(g, union.length); union.push(g); }
          locals.push(unionIndex.get(g));
        }
        if (locals.length > 0) structures.push({ name, locals });
      };
      for (const n of names) pushStructure(n);
      // sampled normal tissue: every 7th BODY voxel not already claimed
      const body = masks.get('BODY');
      if (body) {
        const locals = [];
        let stride = 0;
        for (const g of body) {
          if (unionIndex.has(g)) continue;
          if (stride++ % 7 !== 0) continue;
          unionIndex.set(g, union.length);
          union.push(g);
          locals.push(union.length - 1);
          if (locals.length >= 20000) break;
        }
        if (locals.length > 0) structures.push({ name: '__normal__', locals });
      }
      if (union.length === 0) throw new Error('No optimization voxels — check the objective structures against the RTSTRUCT');

      // per-structure bookkeeping
      const structureObjs = structures.map(st => {
        const objs = usable.filter(o => o.structureName === st.name)
          .map(o => ({ ...o, type: o.type.includes('geud') ? (o.type === 'upper_geud' ? 'upper' : 'lower') : o.type }));
        return { name: st.name, locals: st.locals, objectives: objs };
      }).filter(s => s.objectives.length > 0);

      // build beamlet influence per beam over the union voxels
      sendProgress(planId, { phase: 'influence' });
      const ctFiles = db.prepare(`
        SELECT id, file_path, image_position_x, image_position_y, image_position_z, pixel_spacing_x, pixel_spacing_y, rows, columns
        FROM dicom_files WHERE study_id = ? AND modality = 'CT' ORDER BY image_position_z
      `).all(plan.studyId);
      const ctSlices = ctFiles.map(f => ({
        z: f.image_position_z,
        ...parseCTHU(f.file_path),
        imagePosition: { x: f.image_position_x ?? 0, y: f.image_position_y ?? 0, z: f.image_position_z ?? 0 },
        spacingX: f.pixel_spacing_y ?? 1,
        spacingY: f.pixel_spacing_x ?? 1,
      }));

      const beamPlans = [];
      const iso = { x: plan.isocenterX ?? 0, y: plan.isocenterY ?? 0, z: plan.isocenterZ ?? 0 };
      let isoRaw = 0;
      for (const beam of plan.beams) {
        if ((beam.purpose ?? 'TREATMENT') === 'SETUP') continue;
        if (beam.useInOpt === 0) continue;
        const inf = beamInfluence({
          beam: {
            gantryAngle: beam.gantryAngle ?? 0, energyMv: beam.energyMv ?? 6,
            jaw_x1: beam.jawX1 ?? -50, jaw_x2: beam.jawX2 ?? 50,
            jaw_y1: beam.jawY1 ?? -50, jaw_y2: beam.jawY2 ?? 50,
            isocenterX: iso.x, isocenterY: iso.y, isocenterZ: iso.z,
          },
          grid, ctSlices, voxelSet: unionIndex,
        });
        // raw dose per unit fluence at the isocentre voxel (for cGy scaling)
        const kIso = grid.numberOfFrames > 1
          ? grid.gridFrameOffsetVector.reduce((best, off, f) =>
              (Math.abs(grid.imagePosition.z + off - iso.z) < Math.abs(grid.imagePosition.z + grid.gridFrameOffsetVector[best] - iso.z) ? f : best), 0)
          : 0;
        const isoI = Math.round((iso.x - grid.imagePosition.x) / grid.pixelSpacing.j);
        const isoJ = Math.round((iso.y - grid.imagePosition.y) / grid.pixelSpacing.i);
        const isoGlobal = kIso * grid.rows * grid.columns + isoJ * grid.columns + isoI;
        for (const [, bucket] of inf.buckets) {
          for (let e = 0; e < bucket.locals.length; e++) {
            if (bucket.locals[e] === isoGlobal) isoRaw += bucket.factors[e];
          }
        }
        // CSR-ify the buckets for fast A·x
        const nB = inf.beamletCols * inf.beamletRows;
        const beamletOffsets = new Array(nB + 1).fill(0);
        const beamletLocals = [];
        const beamletFactors = [];
        for (let b = 0; b < nB; b++) {
          const bucket = inf.buckets.get(b);
          beamletOffsets[b] = beamletLocals.length;
          if (!bucket) continue;
          for (let e = 0; e < bucket.locals.length; e++) {
            beamletLocals.push(unionIndex.get(bucket.locals[e]));
            beamletFactors.push(bucket.factors[e]);
          }
        }
        beamletOffsets[nB] = beamletLocals.length;
        beamPlans.push({ beam, inf, beamletOffsets, beamletLocals, beamletFactors, nB });
      }
      if (isoRaw <= 0) throw new Error('Isocentre receives no raw dose — check beams/jaws/isocenter');
      // scale: raw units → cGy at the isocentre (mirrors the engine normalization)
      const rxCgy = plan.prescriptionDoseGy != null ? plan.prescriptionDoseGy * 100 : 100;
      const rawToCgy = rxCgy / isoRaw;
      // fold the raw→cGy scaling into the influence factors so the whole
      // optimization runs in prescription-consistent units
      for (const bp of beamPlans) {
        for (let e = 0; e < bp.beamletFactors.length; e++) bp.beamletFactors[e] *= rawToCgy;
      }

      // ---- solve: projected gradient on x ≥ 0 ----
      const nBeamlets = beamPlans.reduce((a, bp) => a + bp.nB, 0);
      const x = new Float64Array(nBeamlets);
      const beamletBase = [];
      let base = 0;
      for (const bp of beamPlans) { beamletBase.push(base); base += bp.nB; }

      const totalDose = () => {
        const d = new Float64Array(union.length);
        beamPlans.forEach((bp, bi2) => {
          const off = beamletBase[bi2];
          for (let b = 0; b < bp.nB; b++) {
            const wv = x[off + b];
            if (wv <= 0) continue;
            for (let e = bp.beamletOffsets[b]; e < bp.beamletOffsets[b + 1]; e++) {
              d[bp.beamletLocals[e]] += wv * bp.beamletFactors[e];
            }
          }
        });
        return d;
      };

      // volume-aware evaluation set: Upper keeps the hottest (100−V)% voxels,
      // Lower keeps the coldest (100−V)% (Eclipse volume objective semantics)
      const evaluatedIdx = (d, type, volumePct) => {
        const isUpper = type === 'upper' || type === 'upper_geud';
        const keepPct = isUpper ? (100 - (volumePct ?? 0)) : (volumePct ?? 100);
        const n = d.length;
        const keep = Math.min(n, Math.max(1, Math.round((n * Math.min(100, Math.max(1, keepPct))) / 100)));
        const idx = [...d.keys()].sort((a, b) => (isUpper ? d[b] - d[a] : d[a] - d[b]));
        return idx.slice(0, keep);
      };

      let readouts = [];
      const evalObjectives = (doseRaw) => {
        let F = 0;
        const rows = [];
        for (const st of structureObjs) {
          const d = st.locals.map(l => doseRaw[l]);
          for (const o of st.objectives) {
            const D = o.doseRaw != null ? o.doseRaw * rawToCgy : o.doseCgy;
            const w = (o.priority ?? 100) / 100;
            if (o.type === 'mean') {
              let sum = 0;
              for (const v of d) sum += v;
              const mean = sum / d.length;
              F += w * (mean - D) ** 2;
              rows.push({ structureName: st.name, type: o.type, doseCgy: D,
                achievedCgy: Math.round(mean), met: Math.abs(mean - D) <= Math.abs(D) * 0.02 });
            } else {
              const isUpper = o.type === 'upper' || o.type === 'upper_geud';
              const evd = evaluatedIdx(d, o.type, o.volumePct);
              let pen = 0, worst = isUpper ? -Infinity : Infinity;
              for (const i of evd) {
                const diff = isUpper ? d[i] - D : D - d[i];
                if (diff > 0) {
                  pen += w * diff * diff;
                  worst = isUpper ? Math.max(worst, d[i]) : Math.min(worst, d[i]);
                }
              }
              F += pen;
              const achieved = isUpper
                ? (evd.length ? Math.round(Math.max(...evd.map(i => d[i]))) : '—')
                : (evd.length ? Math.round(Math.min(...evd.map(i => d[i]))) : '—');
              rows.push({ structureName: st.name, type: o.type, doseCgy: D,
                achievedCgy: achieved, met: pen <= 1e-6 });
            }
          }
        }
        return { F, rows };
      };

      sendProgress(planId, { phase: 'optimize', maxIterations: run.maxIterations });
      const startT = Date.now();
      let prevF = Infinity;
      let lr = 1e-2;
      for (let it = 1; it <= run.maxIterations; it++) {
        if (run.stopRequested) break;
        const doseRaw = totalDose();
        let F = 0;
        const gVoxel = new Float64Array(union.length);
        for (const st of structureObjs) {
          const d = st.locals.map(l => doseRaw[l]);
          for (const o of st.objectives) {
            const D = o.doseRaw != null ? o.doseRaw * rawToCgy : o.doseCgy;
            const w = (o.priority ?? 100) / 100;
            if (o.type === 'mean') {
              let sum = 0;
              for (const v of d) sum += v;
              const diff = sum / d.length - D;
              F += w * diff * diff;
              const coef = (2 * w * diff) / d.length;
              for (const l of st.locals) gVoxel[l] += coef;
            } else {
              const isUpper = o.type === 'upper' || o.type === 'upper_geud';
              const evd = evaluatedIdx(d, o.type, o.volumePct);
              for (const i of evd) {
                // signed ∂F/∂d: Upper penalises d > D (positive slope),
                // Lower penalises d < D (negative slope — dose must rise)
                const diff = isUpper ? d[i] - D : D - d[i];
                if (diff > 0) {
                  F += w * diff * diff;
                  gVoxel[st.locals[i]] += (isUpper ? 2 : -2) * w * diff;
                }
              }
            }
          }
        }
        // ∇x from ∇voxel through the sparse influence
        const grad = new Float64Array(nBeamlets);
        beamPlans.forEach((bp, bi2) => {
          const off = beamletBase[bi2];
          for (let b = 0; b < bp.nB; b++) {
            let g = 0;
            for (let e = bp.beamletOffsets[b]; e < bp.beamletOffsets[b + 1]; e++) {
              g += gVoxel[bp.beamletLocals[e]] * bp.beamletFactors[e];
            }
            grad[off + b] = g;
          }
        });

        // backtracking line search (objective in raw units)
        const evalRaw = (xx) => {
          const dRaw = new Float64Array(union.length);
          beamPlans.forEach((bp, bi2) => {
            const off = beamletBase[bi2];
            for (let b = 0; b < bp.nB; b++) {
              const wv = xx[off + b];
              if (wv <= 0) continue;
              for (let e = bp.beamletOffsets[b]; e < bp.beamletOffsets[b + 1]; e++) {
                dRaw[bp.beamletLocals[e]] += wv * bp.beamletFactors[e];
              }
            }
          });
          let Fr = 0;
          for (const st of structureObjs) {
            const d = st.locals.map(l => dRaw[l]);
            for (const o of st.objectives) {
              const D = o.doseRaw != null ? o.doseRaw * rawToCgy : o.doseCgy;
              const w = (o.priority ?? 100) / 100;
              if (o.type === 'mean') {
                let sum = 0;
                for (const v of d) sum += v;
                Fr += w * (sum / d.length - D) ** 2;
              } else {
                const isUpper = o.type === 'upper' || o.type === 'upper_geud';
                const evd = evaluatedIdx(d, o.type, o.volumePct);
                for (const i of evd) {
                  const diff = isUpper ? d[i] - D : D - d[i];
                  if (diff > 0) Fr += w * diff * diff;
                }
              }
            }
          }
          return Fr;
        };

        // scale-aware initial step: the steepest beamlet moves ~one
        // prescription's worth of dose, then backtracks (24 halvings)
        let maxG = 0;
        for (let b = 0; b < nBeamlets; b++) maxG = Math.max(maxG, Math.abs(grad[b]));
        let step = maxG > 0 ? rxCgy / maxG : lr * 10;
        const xTry = new Float64Array(x.length);
        for (let ls = 0; ls < 24; ls++) {
          for (let b = 0; b < x.length; b++) xTry[b] = Math.max(0, x[b] - step * grad[b]);
          if (evalRaw(xTry) <= F + 1e-9) break;
          step *= 0.5;
        }
        for (let b = 0; b < x.length; b++) x[b] = Math.max(0, xTry[b]);
        lr = step;

        const doseRaw2 = totalDose();
        const { F: Fcgy, rows } = evalObjectives(doseRaw2);
        readouts = rows;
        const convergedNow = it > 4 && Math.abs(prevF - Fcgy) < 1e-6 * Math.max(1, Math.abs(prevF));
        prevF = Fcgy;
        sendProgress(planId, {
          phase: 'optimize', iteration: it, elapsedS: Math.round((Date.now() - startT) / 1000),
          penalty: Math.round(Fcgy * 100) / 100, readouts: rows,
          converged: convergedNow,
        });
        run.history.push(Math.round(Fcgy * 100) / 100);

        // yield to the event loop so HTTP keeps serving
        await new Promise(res => setImmediate(res));
        if (Date.now() - startT > (settings.maxTimeMin ?? 30) * 60000) break;
      }
      // discard the placeholder objective doses used for raw→cGy scaling
      for (const st of structureObjs) for (const o of st.objectives) delete o.doseRaw;

      // ---- fluence → sliding-window MLC, written to the plan ----
      sendProgress(planId, { phase: 'mlc' });
      for (let bi = 0; bi < beamPlans.length; bi++) {
        const bp = beamPlans[bi];
        const off = beamletBase[bi];
        const fluence = [];
        for (let r = 0; r < bp.inf.beamletRows; r++) {
          const row = [];
          for (let c = 0; c < bp.inf.beamletCols; c++) row.push(x[off + r * bp.inf.beamletCols + c]);
          fluence.push(row);
        }
        const cps = fluenceToSlidingWindowMLC({
          fluence, x0: bp.inf.x0, y0: bp.inf.y0,
        });
        if (cps.length === 0) continue;
        const db = getDb();
        db.prepare('DELETE FROM beam_control_points WHERE beam_id = ?').run(bp.beam.id);
        const ins = db.prepare(`
          INSERT INTO beam_control_points (beam_id, cp_index, cumulative_meterset_weight, mlc_json)
          VALUES (?, ?, ?, ?)
        `);
        for (const cp of cps) {
          ins.run(bp.beam.id, cp.cpIndex, cp.cumulativeWeight, JSON.stringify({ type: 'MLCX', leafPairs: cp.leafPairs }));
        }
        db.prepare('UPDATE ebrt_beams SET meterset = ? WHERE id = ?').run(cps.length, bp.beam.id);
      }

      auditLog(getDb(), { reqId, userId, action: 'optimize_plan', resourceType: 'ebrt_plan', resourceId: planId, metadata: { iterations: run.iteration } });
      sendProgress(planId, { running: false, phase: 'done', done: true });
    } catch (err) {
      sendProgress(planId, { running: false, done: true, error: err.message });
    }
  })();

  return { started: true };
}

function stopOptimizationRun(planId) {
  const run = runs.get(planId);
  if (run && run.running) run.stopRequested = true;
  return { stopped: true };
}

function optimizationStatus(planId) {
  const run = runs.get(planId);
  if (!run) return { exists: false, running: false, done: false };
  const { running, phase, iteration, maxIterations, elapsedS, penalty, readouts, converged, done, error, history } = run;
  return {
    exists: true, running, phase, iteration, maxIterations, elapsedS,
    penalty, readouts: readouts ?? [], converged, done, error: error ?? null,
    history: (history ?? []).slice(-60),
  };
}

export function requestStop(planId) {
  return stopOptimizationRun(planId);
}

export function getStatus(planId) {
  return optimizationStatus(planId);
}
