/**
 * DVH (Dose Volume Histogram) computation.
 *
 * Structure shape: { slices: [{ sopInstanceUID, contours: number[][] }] } —
 * the same shape persisted for painted segmentations and produced by
 * RTSTRUCT parsing (contours = flat [x,y,z,...] patient-mm polygons).
 *
 * The dose grid and the structure slices are aligned through the CT slice
 * list: each structure slice's SOP UID maps to a CT index, which maps to a
 * dose frame via the dose grid's GridFrameOffsetVector + z position.
 */

/**
 * Build a lookup from SOP UID → CT slice index.
 */
export function buildSopToIndex(ctFiles) {
  const m = new Map();
  (ctFiles || []).forEach((f, i) => {
    if (f?.sop_instance_uid != null) m.set(f.sop_instance_uid, i);
  });
  return m;
}

/**
 * Map CT slice index → dose frame index, using the CT slice z (mm) against
 * the dose grid's frame planes (GFOV[k] + doseZ). Returns null when the CT
 * z lies outside the dose z range by more than half the dose frame spacing.
 * @returns {Array<number|null>} per-CT-index frame index (null = no dose)
 */
export function buildCtToDoseFrame(ctFiles, doseGeom, maxDistance = Infinity) {
  const { gridFrameOffsetVector: gfov, imagePosition: ipp } = doseGeom;
  const out = [];
  for (let ci = 0; ci < (ctFiles || []).length; ci++) {
    const z = ctFiles[ci]?.image_position_z;
    if (z == null) { out.push(null); continue; }
    let best = null, bestDist = Infinity;
    for (let k = 0; k < gfov.length; k++) {
      const d = Math.abs(gfov[k] + ipp.z - z);
      if (d < bestDist) { bestDist = d; best = k; }
    }
    out.push(bestDist <= maxDistance ? best : null);
  }
  return out;
}

/**
 * Collect dose values inside a structure.
 *
 * Structure contours are defined on CT slices (patient-mm polygons). For
 * each CT slice that maps to a dose frame, the contours are rasterized into
 * a dose-resolution mask (nearest-CT-pixel scaling: the dose grid is coarser
 * than the CT, so each dose voxel samples the CT-resolution mask) and the
 * covered dose values are collected.
 *
 * @param {Object} structure - { slices: [{ sopInstanceUID, contours }] }
 * @param {Float32Array} doseGrid - cGy, frame-major [k][j][i]
 * @param {Object} doseGeom - {imagePosition, pixelSpacing:{i,j}, gridFrameOffsetVector, rows, columns}
 * @param {Array} ctFiles - CT files slice-ordered (sop_instance_uid, image_position_z)
 * @param {Object} ctGeom - CT geometry for contour → pixel conversion
 * @param {Function} polygonsToMaskFn - rasterizer (contoursPx, cols, rows, value) => mutates mask
 * @param {Function} patientToPixelFn - (patientP, ctGeom) => {i, j}
 * @returns {{values: Float32Array, voxelCount:number, voxelVolumeMm3:number}}
 */
export function collectStructureDose(structure, doseGrid, doseGeom, ctFiles, ctGeom, polygonsToMaskFn, patientToPixelFn) {
  const doseCols = doseGeom.columns ?? doseGeom._cols;
  const doseRows = doseGeom.rows ?? doseGeom._rows;
  const voxelsPerFrame = doseCols * doseRows;
  const sopToCt = buildSopToIndex(ctFiles);
  const ctToFrame = buildCtToDoseFrame(ctFiles, doseGeom);

  const values = [];
  for (const slice of structure.slices ?? []) {
    const ctIdx = sopToCt.get(slice.sopInstanceUID);
    if (ctIdx === undefined) continue;
    const k = ctToFrame[ctIdx];
    if (k == null) continue;

    // rasterize contours at DOSE grid resolution: convert patient → dose
    // voxel column/row directly (contours are on the dose plane z when the
    // CT slice maps to it)
    const mask = new Uint8Array(voxelsPerFrame);
    const contourPts = [];
    for (const poly of slice.contours ?? []) {
      const pts = [];
      for (let p = 0; p + 2 < poly.length; p += 3) {
        const dx = poly[p] - doseGeom.imagePosition.x;
        const dy = poly[p + 1] - doseGeom.imagePosition.y;
        // axial HFS: dose columns along +x, rows along +y
        const di = dx / doseGeom.pixelSpacing.j;
        const dj = dy / doseGeom.pixelSpacing.i;
        pts.push(di, dj);
      }
      if (pts.length >= 6) contourPts.push(pts);
    }
    polygonsToMaskFn(mask, doseCols, doseRows, contourPts, 1);

    const frame = k * voxelsPerFrame;
    for (let v = 0; v < voxelsPerFrame; v++) {
      if (mask[v]) values.push(doseGrid[frame + v]);
    }
  }

  const voxelVolumeMm3 =
    (doseGeom.pixelSpacing.i ?? 1) * (doseGeom.pixelSpacing.j ?? 1) *
    ((doseGeom.gridFrameOffsetVector?.[1] ?? 1) - (doseGeom.gridFrameOffsetVector?.[0] ?? 0));

  return { values: Float32Array.from(values), voxelCount: values.length, voxelVolumeMm3 };
}

/**
 * Compute cumulative + differential DVH from collected dose values.
 * Bins run 0..ceil(maxValue/binWidth)*binWidth.
 *
 * @param {Float32Array|number[]} values - dose values in cGy
 * @param {number} binWidth - cGy per bin
 * @returns {{binWidth:number, binCenters:number[], cumulative:number[], differential:number[], totalCount:number}}
 *   cumulative[c] = number of voxels with dose >= bin c's lower edge
 *   differential[d] = number of voxels in bin d
 */
export function computeDVH(values, binWidth = 10) {
  if (!values || values.length === 0 || binWidth <= 0) {
    return { binWidth, binCenters: [], cumulative: [], differential: [], totalCount: 0 };
  }
  let max = 0;
  for (let i = 0; i < values.length; i++) if (values[i] > max) max = values[i];
  const binCount = Math.max(1, Math.ceil(max / binWidth));

  const differential = new Array(binCount).fill(0);
  let totalCount = 0;
  for (let i = 0; i < values.length; i++) {
    const b = Math.floor(values[i] / binWidth);
    if (b >= 0 && b < binCount) { differential[b]++; totalCount++; }
  }

  // cumulative[c] = count of voxels with dose >= c*binWidth
  const cumulative = new Array(binCount).fill(0);
  let running = 0;
  for (let b = binCount - 1; b >= 0; b--) {
    running += differential[b];
    cumulative[b] = running;
  }

  const binCenters = differential.map((_, b) => (b + 0.5) * binWidth);
  return { binWidth, binCenters, cumulative, differential, totalCount };
}

/**
 * Dose statistics from a sorted-agnostic values array.
 */
export function doseStats(values) {
  if (!values || values.length === 0) {
    return { mean: 0, max: 0, min: 0, dX: () => 0 };
  }
  const sorted = Float32Array.from(values).sort();
  let sum = 0;
  for (let i = 0; i < sorted.length; i++) sum += sorted[i];
  const at = (p) => sorted[Math.min(sorted.length - 1, Math.floor((1 - p) * sorted.length))] ?? 0;
  return {
    mean: sum / sorted.length,
    max: sorted[sorted.length - 1],
    min: sorted[0],
    /** D95/D50/D2: dose received by at least p% of the volume (p in 0..1) */
    dX: at,
  };
}

/**
 * V-x metric: relative volume (%) receiving at least `dose` cGy.
 */
export function volumeAtDose(values, dose) {
  if (!values || values.length === 0) return 0;
  let n = 0;
  for (let i = 0; i < values.length; i++) if (values[i] >= dose) n++;
  return (n / values.length) * 100;
}
