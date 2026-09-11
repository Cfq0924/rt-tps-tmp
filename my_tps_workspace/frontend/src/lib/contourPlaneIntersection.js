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
 * Structure silhouette segments for one MPR pane, in pane index space.
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
  const segs = [];
  for (const poly of polygons) {
    for (const s of intersectPolygonPlane(poly, axis, value)) {
      const a = isCoronal
        ? [(s.a[0] - geom.originX) / geom.spacingX, sliceIndexAt(geom.zPositions, s.a[2])]
        : [(s.a[1] - geom.originY) / geom.spacingY, sliceIndexAt(geom.zPositions, s.a[2])];
      const b = isCoronal
        ? [(s.b[0] - geom.originX) / geom.spacingX, sliceIndexAt(geom.zPositions, s.b[2])]
        : [(s.b[1] - geom.originY) / geom.spacingY, sliceIndexAt(geom.zPositions, s.b[2])];
      segs.push({ a, b });
    }
  }
  return segs;
}
