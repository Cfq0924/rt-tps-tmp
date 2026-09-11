/**
 * Rigid volume resampling (Phase 4 M1).
 *
 * Resamples a moving CT volume (Int16 HU, mprVolume layout) onto the fixed
 * grid under a rigid patient-space transform M (moving patient coords →
 * fixed patient coords, the same convention as series_registrations).
 * For every fixed voxel the source is sampled at M⁻¹ · p_fixed (trilinear);
 * voxels outside the source become `fillValue`.
 *
 * Volume layout matches lib/mprVolume.js: frame-major [z][y][x], index
 * (z * rows + y) * cols + x. Geometry: { cols, rows, numSlices, spacingX,
 * spacingY, originX, originY, zPositions[] }.
 */

import { identity4 } from './registrationMath.js';

/**
 * Invert a 4×4 affine matrix (general Gauss-Jordan; source matrices are
 * rigid so a closed-form inverse would do, but stay safe for arbitrary
 * user-entered values).
 * @param {number[][]} m - 4 rows × 4 numbers
 * @returns {number[][]} inverse (null when singular)
 */
export function invert4(m) {
  const a = m.map((row, i) => [...row, i === 0 ? 1 : 0]);
  // build augmented [m | I]
  for (let r = 0; r < 4; r++) {
    a[r] = [...m[r]];
    for (let c = 0; c < 4; c++) a[r].push(r === c ? 1 : 0);
  }
  for (let col = 0; col < 4; col++) {
    let piv = col;
    for (let r = col + 1; r < 4; r++) {
      if (Math.abs(a[r][col]) > Math.abs(a[piv][col])) piv = r;
    }
    if (Math.abs(a[piv][col]) < 1e-12) return null;
    [a[col], a[piv]] = [a[piv], a[col]];
    const d = a[col][col];
    for (let c = 0; c < 8; c++) a[col][c] /= d;
    for (let r = 0; r < 4; r++) {
      if (r === col) continue;
      const f = a[r][col];
      if (f === 0) continue;
      for (let c = 0; c < 8; c++) a[r][c] -= f * a[col][c];
    }
  }
  return a.map(row => row.slice(4));
}

/** Apply a 4×4 to a patient point [x,y,z] (homogeneous w=1). */
export function applyMatrix4(m, p) {
  return [
    m[0][0] * p[0] + m[0][1] * p[1] + m[0][2] * p[2] + m[0][3],
    m[1][0] * p[0] + m[1][1] * p[1] + m[1][2] * p[2] + m[1][3],
    m[2][0] * p[0] + m[2][1] * p[1] + m[2][2] * p[2] + m[2][3],
  ];
}

/** Voxel → patient (mm) in mprVolume geometry conventions. */
export function voxelToPatientMpr(geom, i, j, kIdx) {
  const z = geom.zPositions[Math.max(0, Math.min(geom.numSlices - 1, kIdx))];
  return [geom.originX + i * geom.spacingX, geom.originY + j * geom.spacingY, z];
}

/**
 * Patient → fractional voxel in mprVolume geometry. Slice index k is
 * linearly interpolated over zPositions (handles ascending or descending
 * slice order; clamps outside).
 */
export function patientToVoxelMpr(geom, p) {
  const i = (p[0] - geom.originX) / geom.spacingX;
  const j = (p[1] - geom.originY) / geom.spacingY;
  const z = geom.zPositions;
  const n = z.length;
  if (n === 1) return { i, j, k: 0 };
  const asc = z[n - 1] >= z[0];
  // bracket the point on the monotone slice axis; linear extrapolation past
  // the ends (so out-of-range k goes to the fill value instead of clamping)
  let k;
  if (asc) {
    if (p[2] <= z[0]) k = (p[2] - z[0]) / (z[1] - z[0]);
    else if (p[2] >= z[n - 1]) k = (n - 1) + (p[2] - z[n - 1]) / (z[n - 1] - z[n - 2]);
    else {
      let u = 0;
      while (u + 1 < n - 1 && z[u + 1] < p[2]) u++;
      k = u + (p[2] - z[u]) / (z[u + 1] - z[u]);
    }
  } else {
    if (p[2] >= z[0]) k = (p[2] - z[0]) / (z[1] - z[0]);
    else if (p[2] <= z[n - 1]) k = (n - 1) + (p[2] - z[n - 1]) / (z[n - 1] - z[n - 2]);
    else {
      let u = 0;
      while (u + 1 < n - 1 && z[u + 1] > p[2]) u++;
      k = u + (p[2] - z[u]) / (z[u + 1] - z[u]);
    }
  }
  return { i, j, k };
}

/** Trilinear HU sample at fractional voxel coords, `fill` outside. */
export function sampleVolumeTrilinear(volume, geom, i, j, k, fill = -1000) {
  const { cols, rows, numSlices } = geom;
  if (i < -1 || j < -1 || k < -1 || i > cols || j > rows || k > numSlices - 1) return fill;
  const i0 = Math.floor(i), j0 = Math.floor(j), k0 = Math.floor(k);
  const fi = i - i0, fj = j - j0, fk = k - k0;
  const v = (ii, jj, kk) => {
    const ci = Math.max(0, Math.min(cols - 1, ii));
    const cj = Math.max(0, Math.min(rows - 1, jj));
    const ck = Math.max(0, Math.min(numSlices - 1, kk));
    return volume[(ck * rows + cj) * cols + ci];
  };
  const lerp = (a, b, t) => a + (b - a) * t;
  const v00 = lerp(v(i0, j0, k0), v(i0 + 1, j0, k0), fi);
  const v10 = lerp(v(i0, j0 + 1, k0), v(i0 + 1, j0 + 1, k0), fi);
  const v01 = lerp(v(i0, j0, k0 + 1), v(i0 + 1, j0, k0 + 1), fi);
  const v11 = lerp(v(i0, j0 + 1, k0 + 1), v(i0 + 1, j0 + 1, k0 + 1), fi);
  return lerp(lerp(v00, v10, fj), lerp(v01, v11, fj), fk);
}

/**
 * Resample the moving volume onto the fixed grid.
 * @param {Object} params
 * @param {Int16Array} params.srcVolume - moving volume (HU)
 * @param {Object} params.srcGeom - moving geometry (mprVolume shape)
 * @param {Object} params.dstGeom - fixed (target) geometry
 * @param {number[][]} [params.matrix] - moving→fixed patient transform
 *   (identity resamples same-grid / unregistered data)
 * @param {number} [params.fillValue] - HU for voxels outside the source
 * @returns {Int16Array} resampled volume sized for dstGeom
 */
export function resampleRigid({ srcVolume, srcGeom, dstGeom, matrix = identity4(), fillValue = -1000 }) {
  const inv = invert4(matrix);
  if (!inv) throw new Error('resampleRigid: matrix is singular');
  const out = new Int16Array(dstGeom.cols * dstGeom.rows * dstGeom.numSlices);
  for (let k = 0; k < dstGeom.numSlices; k++) {
    for (let j = 0; j < dstGeom.rows; j++) {
      const rowOff = (k * dstGeom.rows + j) * dstGeom.cols;
      for (let i = 0; i < dstGeom.cols; i++) {
        const pFixed = voxelToPatientMpr(dstGeom, i, j, k);
        const pMoving = applyMatrix4(inv, pFixed);
        const { i: si, j: sj, k: sk } = patientToVoxelMpr(srcGeom, pMoving);
        out[rowOff + i] = Math.round(sampleVolumeTrilinear(srcVolume, srcGeom, si, sj, sk, fillValue));
      }
    }
  }
  return out;
}

/**
 * Build mprVolume-style geometry from a sorted DICOM file row list
 * (dicom_files rows carry image_position_*, pixel_spacing_*, columns/rows).
 */
export function geomFromFiles(files) {
  const f0 = files[0] ?? {};
  return {
    cols: Number(f0.columns) || 512,
    rows: Number(f0.rows) || 512,
    numSlices: files.length,
    spacingX: Number(f0.pixel_spacing_y) || 1,
    spacingY: Number(f0.pixel_spacing_x) || 1,
    originX: Number(f0.image_position_x) || 0,
    originY: Number(f0.image_position_y) || 0,
    zPositions: files.map(f => Number(f.image_position_z) || 0),
  };
}
