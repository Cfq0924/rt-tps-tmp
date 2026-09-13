/**
 * RTSTRUCT contour ↔ MPR plane intersection (Phase 4 M4).
 *
 * RTSTRUCT contours are closed polygons, one per referenced axial slice
 * (flat patient-mm triplets). To draw structure outlines on coronal/sagittal
 * MPR panes we intersect every polygon with the pane's axis-aligned plane
 * (y = const for coronal, x = const for sagittal): each polygon contributes
 * zero or more straight crossing segments, which together form the familiar
 * structure silhouette lines.
 */

/**
 * Intersect a closed 3D polygon with an axis-aligned plane.
 * @param {number[]} flat - polygon vertices, flat [x,y,z, ...] patient mm
 * @param {number} axis - 0 = x (sagittal), 1 = y (coronal), 2 = z (axial)
 * @param {number} value - plane position on that axis (patient mm)
 * @returns {Array<{a:number[], b:number[]}>} crossing segments (patient mm);
 *   a polygon lying entirely in the plane returns its edges
 */
export function intersectPolygonPlane(flat, axis, value) {
  const n = flat.length / 3;
  if (n < 3) return [];
  const at = (i) => [flat[(i % n) * 3], flat[(i % n) * 3 + 1], flat[(i % n) * 3 + 2]];

  // signed distance of each vertex to the plane
  const d = Array.from({ length: n }, (_, i) => at(i)[axis] - value);
  if (d.every(v => Math.abs(v) < 1e-9)) {
    // polygon is coplanar with the plane: return its outline
    const segs = [];
    for (let i = 0; i < n; i++) segs.push({ a: at(i), b: at(i + 1) });
    return segs;
  }

  // collect edge crossings with their parametric position for stable pairing
  const crossings = [];
  for (let i = 0; i < n; i++) {
    const p = at(i), q = at(i + 1);
    const d0 = d[i], d1 = d[i + 1 === n ? 0 : i + 1];
    if (d0 === 0) {
      crossings.push({ t: i, p: [...p] }); // vertex exactly on the plane
      continue;
    }
    if ((d0 < 0 && d1 > 0) || (d0 > 0 && d1 < 0)) {
      const t = d0 / (d0 - d1);
      crossings.push({
        t: i + t,
        p: [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, p[2] + (q[2] - p[2]) * t],
      });
    }
  }
  // deduplicate vertices-on-plane counted twice by adjacent edges
  const unique = crossings.filter((c, i) =>
    !crossings.some((o, j) => j < i && Math.hypot(o.p[0] - c.p[0], o.p[1] - c.p[1], o.p[2] - c.p[2]) < 1e-6));
  unique.sort((a, b) => a.t - b.t);

  const segs = [];
  for (let i = 0; i + 1 < unique.length; i += 2) {
    segs.push({ a: unique[i].p, b: unique[i + 1].p });
  }
  return segs;
}

/**
 * Fractional slice index for a z value over a (monotone) zPositions list.
 * Same extrapolating convention as patientToVoxelMpr.
 */
function sliceIndexAt(zPositions, z) {
  const n = zPositions.length;
  if (n === 1) return 0;
  const asc = zPositions[n - 1] >= zPositions[0];
  if (asc) {
    if (z <= zPositions[0]) return (z - zPositions[0]) / (zPositions[1] - zPositions[0]);
    if (z >= zPositions[n - 1]) return (n - 1) + (z - zPositions[n - 1]) / (zPositions[n - 1] - zPositions[n - 2]);
    let u = 0;
    while (u + 1 < n - 1 && zPositions[u + 1] < z) u++;
    return u + (z - zPositions[u]) / (zPositions[u + 1] - zPositions[u]);
  }
  if (z >= zPositions[0]) return (z - zPositions[0]) / (zPositions[1] - zPositions[0]);
  if (z <= zPositions[n - 1]) return (n - 1) + (z - zPositions[n - 1]) / (zPositions[n - 1] - zPositions[n - 2]);
  let u = 0;
  while (u + 1 < n - 1 && zPositions[u + 1] > z) u++;
  return u + (z - zPositions[u]) / (zPositions[u + 1] - zPositions[u]);
}

/**
 * Crossing points of a closed polygon with an axis-aligned plane, sorted
 * along the in-plane axis. Axial RTSTRUCT rings have constant z, so every
 * crossing shares the ring's slice position.
 * @returns {Array<number[]>} [x,y,z] points; empty when the ring does not
 *   cross the plane (coplanar rings included — they carry no wall info)
 */
function ringPlaneCrossings(flat, axis, value) {
  const n = flat.length / 3;
  if (n < 3) return [];
  const at = (i) => [flat[(i % n) * 3], flat[(i % n) * 3 + 1], flat[(i % n) * 3 + 2]];

  const d = Array.from({ length: n }, (_, i) => at(i)[axis] - value);
  if (d.every(v => Math.abs(v) < 1e-9)) return [];

  const crossings = [];
  for (let i = 0; i < n; i++) {
    const p = at(i), q = at(i + 1);
    const d0 = d[i], d1 = d[i + 1 === n ? 0 : i + 1];
    if (d0 === 0) {
      crossings.push([...p]);
      continue;
    }
    if ((d0 < 0 && d1 > 0) || (d0 > 0 && d1 < 0)) {
      const t = d0 / (d0 - d1);
      crossings.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t, p[2] + (q[2] - p[2]) * t]);
    }
  }
  return crossings.filter((c, i) =>
    !crossings.some((o, j) => j < i && Math.hypot(o[0] - c[0], o[1] - c[1], o[2] - c[2]) < 1e-6));
}

/**
 * Structure silhouette for one MPR pane, in pane index space.
 *
 * Axial RTSTRUCT rings never lie in a coronal/sagittal plane, so each ring
 * crosses the plane at an even set of boundary points (2 for convex rings).
 * Pairing the points *within* a slice would paint one chord across the
 * structure on every slice — a striped, filled look. The silhouette walls
 * instead connect each crossing to the matching crossing on the adjacent
 * ring, rendering the familiar structure outline.
 * @param {Array<number[]>} polygons - flat patient-mm vertex arrays
 * @param {'coronal'|'sagittal'} orientation
 * @param {number} planeIndex - crosshair index on the plane axis (yIdx/xIdx)
 * @param {Object} geom - mprVolume geometry ({originX, originY, spacingX, spacingY, zPositions})
 * @returns {Array<{a:[u,v], b:[u,v]}>} u = in-plane column index, v = slice index
 */
export function structurePlaneSegments(polygons, orientation, planeIndex, geom) {
  const isCoronal = orientation === 'coronal';
  const axis = isCoronal ? 1 : 0;
  const value = isCoronal
    ? geom.originY + planeIndex * geom.spacingY
    : geom.originX + planeIndex * geom.spacingX;

  const toPaneU = (p) => isCoronal
    ? (p[0] - geom.originX) / geom.spacingX
    : (p[1] - geom.originY) / geom.spacingY;

  // crossings per ring, u-sorted; rings grouped into slice levels by v
  const rings = [];
  for (const poly of polygons) {
    const pts = ringPlaneCrossings(poly, axis, value);
    if (pts.length < 2) continue;
    const v = sliceIndexAt(geom.zPositions, pts[0][2]);
    const us = pts.map(toPaneU).sort((a, b) => a - b);
    rings.push({ v, us });
  }
  if (rings.length === 0) return [];
  rings.sort((A, B) => (A.v - B.v) || (A.us[0] - B.us[0]));

  const levels = [];
  for (const r of rings) {
    const last = levels[levels.length - 1];
    if (last && Math.abs(last.v - r.v) < 1e-6) last.rings.push(r);
    else levels.push({ v: r.v, rings: [r] });
  }

  const centre = (us) => (us[0] + us[us.length - 1]) / 2;
  const segs = [];
  for (let i = 0; i + 1 < levels.length; i++) {
    const used = new Set();
    for (const ra of levels[i].rings) {
      const ca = centre(ra.us);
      let best = null, bestD = Infinity;
      for (const rb of levels[i + 1].rings) {
        if (used.has(rb)) continue;
        const d = Math.abs(centre(rb.us) - ca);
        if (d < bestD) { bestD = d; best = rb; }
      }
      if (best) used.add(best);
      else continue;
      // pair u-sorted crossings; tangencies can leave an odd count
      const n = Math.min(ra.us.length, best.us.length) & ~1;
      for (let j = 0; j < n; j += 2) {
        segs.push({ a: [ra.us[j], ra.v], b: [best.us[j], best.v] });
        segs.push({ a: [ra.us[j + 1], ra.v], b: [best.us[j + 1], best.v] });
      }
    }
  }
  return segs;
}
