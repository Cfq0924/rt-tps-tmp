/**
 * External-beam geometry helpers (IEC 61217, coplanar couch=0, collimator=0).
 *
 * Patient coordinate system is LPS (+x left, +y posterior, +z head).
 * Gantry angle 0 = beam from ABOVE the patient (anterior):
 *   source(θ) = isocenter + SAD · [sin θ, −cos θ, 0]
 * so gantry 90° is a beam from the patient's left. With collimator 0 the
 * jaw-defined portal rectangle lies IN the isocenter plane (z = iso.z),
 * which is why axial-slice portal drawing is exact for this geometry.
 */

const toRad = (deg) => (deg * Math.PI) / 180;

/**
 * Position of the radiation source on the gantry.
 * @param {Object} isocenter - {x, y, z} in mm
 * @param {number} sadMm - source-axis distance in mm
 * @param {number} gantryAngleDeg
 * @returns {{x:number, y:number, z:number}}
 */
export function beamSourcePosition(isocenter, sadMm, gantryAngleDeg) {
  const t = toRad(gantryAngleDeg);
  return {
    x: isocenter.x + sadMm * Math.sin(t),
    y: isocenter.y - sadMm * Math.cos(t),
    z: isocenter.z,
  };
}

/**
 * The four corners of the jaw-defined portal rectangle at the isocenter
 * plane (coplanar, collimator 0). Returned in draw order so the polygon
 * can be stroked as a closed loop.
 * @param {Object} isocenter - {x, y, z}
 * @param {{x1:number,x2:number,y1:number,y2:number}} jaw - jaw positions in mm (iso plane, beam-local = patient x/y for collimator 0)
 * @returns {Array<{x:number,y:number,z:number}>} 4 corners
 */
export function beamPortalCorners(isocenter, jaw) {
  return [
    { x: isocenter.x + jaw.x1, y: isocenter.y + jaw.y1, z: isocenter.z },
    { x: isocenter.x + jaw.x2, y: isocenter.y + jaw.y1, z: isocenter.z },
    { x: isocenter.x + jaw.x2, y: isocenter.y + jaw.y2, z: isocenter.z },
    { x: isocenter.x + jaw.x1, y: isocenter.y + jaw.y2, z: isocenter.z },
  ];
}

/**
 * The two endpoints of the central axis through the isocenter: the source
 * side (at the source, i.e. SAD upstream) and the distal side (SAD beyond
 * the isocenter, entrance → exit).
 * @returns {{sourceSide:{x,y,z}, distalSide:{x,y,z}}}
 */
export function beamCentralAxisEnds(isocenter, sadMm, gantryAngleDeg) {
  const t = toRad(gantryAngleDeg);
  const dx = Math.sin(t);
  const dy = -Math.cos(t);
  return {
    sourceSide: {
      x: isocenter.x - sadMm * dx,
      y: isocenter.y - sadMm * dy,
      z: isocenter.z,
    },
    distalSide: {
      x: isocenter.x + sadMm * dx,
      y: isocenter.y + sadMm * dy,
      z: isocenter.z,
    },
  };
}
