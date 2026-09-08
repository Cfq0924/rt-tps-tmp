/**
 * Dose grid sampling utilities.
 *
 * Dose grid geometry (from /api/rtdose/:fileId metadata):
 * - voxel (i, j, k) → patient:
 *     P = IPP + i·colSpacing·X̂ + j·rowSpacing·Ŷ + GFOV[k]·Ẑ
 *   (PixelSpacing is [rowSpacing, colSpacing]; axial HFS assumed, matching
 *   doseTransform conventions in the rest of this codebase)
 * - grid is Float32 cGy, frame-major [k][j][i], row-major within a frame
 */

/**
 * Continuous voxel coordinates for a patient point.
 * @returns {{i:number, j:number, k:number}} fractional voxel indices
 */
export function patientToVoxel(p, geom) {
  const { imagePosition: ipp, imageOrientation: iop, pixelSpacing: ps, gridFrameOffsetVector: gfov } = geom;
  const dx = p[0] - ipp.x;
  const dy = p[1] - ipp.y;
  const i = dx * iop.x[0] / ps.j + dy * iop.x[1] / ps.j;
  const j = dx * iop.y[0] / ps.i + dy * iop.y[1] / ps.i;
  // k: nearest frame lookup along GFOV (frames may be non-uniform)
  const zOff = p[2] - ipp.z;
  let k = 0;
  let bestDist = Infinity;
  for (let f = 0; f < gfov.length; f++) {
    const d = Math.abs(gfov[f] - zOff);
    if (d < bestDist) { bestDist = d; k = f; }
  }
  return { i, j, k };
}

/**
 * Grid dimensions under any of the naming conventions in this codebase:
 * doseMeta uses columns/rows, RTDoseOverlay-built geoms use _cols/_rows,
 * dvh.js reads them tolerantly — sampling does the same.
 */
function gridDims(geom) {
  return {
    cols: geom.cols ?? geom.columns ?? geom._cols,
    rows: geom.rows ?? geom._rows,
  };
}

/**
 * Trilinear dose sample at a patient point. For the k axis the grid frames
 * are treated as point samples on the GFOV planes: the two neighbouring
 * frames are linearly interpolated when the point lies between them,
 * otherwise the nearest frame value is used (clamped).
 *
 * @param {Float32Array} grid - dose values (cGy)
 * @param {Object} geom - dose geometry {imagePosition, imageOrientation, pixelSpacing, gridFrameOffsetVector, cols, rows}
 * @param {number[]} p - patient coordinates [x, y, z] in mm
 * @returns {number|null} dose in cGy, or null when the point is outside the grid
 */
export function trilinearSample(grid, geom, p) {
  const { cols, rows } = gridDims(geom);
  const gfov = geom.gridFrameOffsetVector;
  const { i, j, k } = patientToVoxel(p, geom);
  if (i < -1 || j < -1 || i > cols || j > rows) return null;

  // z interpolation between neighbouring frames
  const zOff = p[2] - geom.imagePosition.z;
  let k0 = 0;
  while (k0 + 1 < gfov.length && gfov[k0 + 1] < zOff) k0++;
  const k1 = Math.min(k0 + 1, gfov.length - 1);
  const span = gfov[k1] - gfov[k0];
  const tz = span > 0 ? Math.min(1, Math.max(0, (zOff - gfov[k0]) / span)) : 0;

  const i0 = Math.floor(i), j0 = Math.floor(j);
  const fi = i - i0, fj = j - j0;
  if (i0 < -1 || j0 < -1 || i0 + 1 > cols || j0 + 1 > rows) return null;

  const voxel = (ii, jj, kk) => {
    const ci = Math.min(cols - 1, Math.max(0, ii));
    const cj = Math.min(rows - 1, Math.max(0, jj));
    const ck = Math.min(gfov.length - 1, Math.max(0, kk));
    return grid[ck * cols * rows + cj * cols + ci];
  };

  const lerp = (a, b, t) => a + (b - a) * t;
  const v00 = lerp(voxel(i0, j0, k0), voxel(i0 + 1, j0, k0), fi);
  const v10 = lerp(voxel(i0, j0 + 1, k0), voxel(i0 + 1, j0 + 1, k0), fi);
  const v0 = lerp(v00, v10, fj);
  const v01 = lerp(voxel(i0, j0, k1), voxel(i0 + 1, j0, k1), fi);
  const v11 = lerp(voxel(i0, j0 + 1, k1), voxel(i0 + 1, j0 + 1, k1), fi);
  const v1 = lerp(v01, v11, fj);

  const value = lerp(v0, v1, tz);
  return Number.isFinite(value) ? value : null;
}

/**
 * Global maximum of the grid.
 * @returns {{value:number, flatIndex:number}}
 */
export function findGlobalMax(grid) {
  let best = { value: -Infinity, flatIndex: -1 };
  for (let i = 0; i < grid.length; i++) {
    if (grid[i] > best.value) best = { value: grid[i], flatIndex: i };
  }
  return best;
}

/**
 * Flat voxel index → patient coordinates.
 */
export function voxelToPatient(flatIndex, geom) {
  const { cols, rows } = gridDims(geom);
  const k = Math.floor(flatIndex / (cols * rows));
  const rem = flatIndex % (cols * rows);
  const j = Math.floor(rem / cols);
  const i = rem % cols;
  const { imagePosition: ipp, imageOrientation: iop, pixelSpacing: ps, gridFrameOffsetVector: gfov } = geom;
  const zOff = gfov[Math.min(k, gfov.length - 1)] ?? 0;
  return [
    ipp.x + i * ps.j * iop.x[0] + j * ps.i * iop.y[0],
    ipp.y + i * ps.j * iop.x[1] + j * ps.i * iop.y[1],
    ipp.z + zOff,
  ];
}
