/**
 * Cornerstone viewport camera projection helpers.
 *
 * StackViewport.worldToCanvas / worldToCanvasCPU are state-dependent outside
 * the render loop in cornerstone 4.22 (first call may work, later calls
 * return garbage or throw — see WISSEN.md §10). These pure-math equivalents
 * use getCamera() (stable data) and reproduce cornerstone's orthographic
 * projection exactly (verified to 1e-12 against worldToCanvas output).
 *
 * Both directions assume the point lies on the plane currently displayed
 * (z along the view normal).
 */

/**
 * Project a patient-space point to viewport canvas CSS coordinates.
 * @param {Object} vp - cornerstone viewport exposing getCamera() and .element
 * @param {number[]} p - patient coordinates [x, y, z] in mm
 * @returns {{x:number, y:number}} canvas CSS coordinates
 */
export function projectWorldToCanvas(vp, p) {
  const cam = vp.getCamera();
  const n = cam.viewPlaneNormal;
  const up = cam.viewUp;
  const right = [
    up[1] * n[2] - up[2] * n[1],
    up[2] * n[0] - up[0] * n[2],
    up[0] * n[1] - up[1] * n[0],
  ];
  const d = [p[0] - cam.focalPoint[0], p[1] - cam.focalPoint[1], p[2] - cam.focalPoint[2]];

  const canvas = vp.element?.querySelector('canvas');
  const cssW = canvas?.clientWidth ?? 0;
  const cssH = canvas?.clientHeight ?? 0;
  const scale = cam.parallelScale; // half-height of the view in world mm

  return {
    x: cssW / 2 + (d[0] * right[0] + d[1] * right[1] + d[2] * right[2]) / scale * (cssH / 2),
    y: cssH / 2 - (d[0] * up[0] + d[1] * up[1] + d[2] * up[2]) / scale * (cssH / 2),
  };
}

/**
 * Inverse of projectWorldToCanvas for points on the displayed plane:
 * canvas CSS coordinates → patient coordinates, with the out-of-plane
 * component pinned to zPlane.
 * @param {Object} vp - cornerstone viewport exposing getCamera() and .element
 * @param {number} x - canvas x (CSS px)
 * @param {number} y - canvas y (CSS px)
 * @param {number} zPlane - patient z of the displayed plane
 * @returns {number[]} [x, y, z] patient coordinates in mm
 */
export function canvasToPlanePoint(vp, x, y, zPlane) {
  const cam = vp.getCamera();
  const n = cam.viewPlaneNormal;
  const up = cam.viewUp;
  const right = [
    up[1] * n[2] - up[2] * n[1],
    up[2] * n[0] - up[0] * n[2],
    up[0] * n[1] - up[1] * n[0],
  ];

  const canvas = vp.element?.querySelector('canvas');
  const cssW = canvas?.clientWidth ?? 0;
  const cssH = canvas?.clientHeight ?? 0;
  const scale = cam.parallelScale;
  if (!cssW || !cssH || !scale) {
    return [0, 0, zPlane];
  }

  // Offsets along the camera's right/up axes (same normalization as forward)
  const du = ((cssH / 2 - y) / (cssH / 2)) * scale;
  const dr = ((x - cssW / 2) / (cssH / 2)) * scale;

  // Base point on the camera focal plane
  let px = cam.focalPoint[0] + dr * right[0] + du * up[0];
  let py = cam.focalPoint[1] + dr * right[1] + du * up[1];
  let pz = cam.focalPoint[2] + dr * right[2] + du * up[2];

  // Slide along the view normal until we hit the displayed image plane
  // { q : dot(q - q0, n) = 0 } with q0 = [0, 0, zPlane]
  const dn = (0 - px) * n[0] + (0 - py) * n[1] + (zPlane - pz) * n[2];
  return [px + dn * n[0], py + dn * n[1], pz + dn * n[2]];
}
