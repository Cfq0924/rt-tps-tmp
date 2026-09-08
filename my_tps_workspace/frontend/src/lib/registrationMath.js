/**
 * Rigid registration math for the registration module.
 *
 * A registration is a 4x4 row-major homogeneous transform mapping
 * moving-series patient coordinates onto the fixed series:
 *     p_fixed = M · p_moving
 * Manual in-plane matching (axial) edits rotation about z + translation in
 * x/y; tz stays 0 until out-of-plane matching exists.
 */

export function identity4() {
  return [
    [1, 0, 0, 0],
    [0, 1, 0, 0],
    [0, 0, 1, 0],
    [0, 0, 0, 1],
  ];
}

/** 4x4 matrix multiply: a · b */
export function multiply4(a, b) {
  const out = identity4();
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      out[r][c] = a[r][0] * b[0][c] + a[r][1] * b[1][c] + a[r][2] * b[2][c] + a[r][3] * b[3][c];
    }
  }
  return out;
}

/** Apply M to a patient point [x, y, z] (w = 1). Returns [x, y, z]. */
export function apply4(m, p) {
  const [x, y, z] = p;
  return [
    m[0][0] * x + m[0][1] * y + m[0][2] * z + m[0][3],
    m[1][0] * x + m[1][1] * y + m[1][2] * z + m[1][3],
    m[2][0] * x + m[2][1] * y + m[2][2] * z + m[2][3],
  ];
}

/**
 * In-plane (axial) rigid transform: rotation θ about the patient z axis
 * through the image centre + translation (tx, ty) in mm. tz = 0.
 * @param {number} thetaDeg
 * @param {number} tx
 * @param {number} ty
 * @param {[number, number]} centre - rotation centre in patient mm
 */
export function axialTransform(thetaDeg, tx, ty, centre = [0, 0]) {
  const t = (thetaDeg * Math.PI) / 180;
  const cos = Math.cos(t);
  const sin = Math.sin(t);
  const [cx, cy] = centre;
  // rotate about (cx, cy), then translate: T(tx,ty) · T(c) · R · T(-c)
  return [
    [cos, -sin, 0, cx - cos * cx + sin * cy + tx],
    [sin, cos, 0, cy - sin * cx - cos * cy + ty],
    [0, 0, 1, 0],
    [0, 0, 0, 1],
  ];
}

/** Extract (thetaDeg, tx, ty) back from an axialTransform result.
 * tx/ty are the centre displacement — the same parameters axialTransform
 * takes, so decompose(axial(t, tx, ty, c), c) round-trips exactly. */
export function decomposeAxial(m, centre = [0, 0]) {
  const thetaDeg = (Math.atan2(m[1][0], m[0][0]) * 180) / Math.PI;
  const t = (thetaDeg * Math.PI) / 180;
  const cos = Math.cos(t);
  const sin = Math.sin(t);
  const [cx, cy] = centre;
  return {
    thetaDeg,
    tx: m[0][3] - (cx - cos * cx + sin * cy),
    ty: m[1][3] - (cy - sin * cx - cos * cy),
  };
}

/**
 * Intensity centroid of a slice: mean patient position of voxels above a
 * HU threshold. Returns [x, y, z] or null when nothing passes.
 * @param {Float32Array} hu - HU values (cols × rows)
 * @param {Object} ctGeom - {imagePosition, pixelSpacing, cols, rows}
 * @param {number} z - slice z (patient mm)
 * @param {number} threshold - default -300 HU (body vs air)
 */
export function intensityCentroid(hu, ctGeom, z, threshold = -300) {
  const { cols, rows, pixelSpacing, imagePosition } = ctGeom;
  let sumI = 0, sumJ = 0, n = 0;
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      if (hu[j * cols + i] > threshold) {
        sumI += i;
        sumJ += j;
        n++;
      }
    }
  }
  if (n === 0) return null;
  return [
    imagePosition.x + (sumI / n) * pixelSpacing.j,
    imagePosition.y + (sumJ / n) * pixelSpacing.i,
    z,
  ];
}
