/**
 * RT Dose → CT slice coordinate transformation and colormap utilities.
 *
 * All functions are pure and testable. DICOM semantics:
 * - Dose voxel (i, j, k) → patient (mm):
 *     P = IPP + i·colSpacing·X̂ + j·rowSpacing·Ŷ + gfov[k]·Ẑ
 *   where X̂/Ŷ are the first/second triplets of ImageOrientationPatient and
 *   Ẑ is the slice normal (cross product) — for the axial HFS case Ẑ=[0,0,1]
 *   and gfov[k] is the z offset of frame k relative to IPP.
 * - PixelSpacing is [rowSpacing, colSpacing] = [between rows (y), between cols (x)].
 */

/**
 * Find the dose frame index whose z plane is closest to a CT slice z.
 * @param {number[]} gridFrameOffsetVector - per-frame z offsets (mm) relative to dose IPP.z
 * @param {number} doseZ - dose grid origin z (ImagePositionPatient.z)
 * @param {number} ctZ - CT slice ImagePositionPatient.z
 * @param {number} [maxDistance] - max allowed |zDose - zCT| in mm
 * @returns {number|null} frame index, or null when the CT slice is outside the dose z range
 */
export function doseFrameIndexForZ(gridFrameOffsetVector, doseZ, ctZ, maxDistance = Infinity) {
  if (!Array.isArray(gridFrameOffsetVector) || gridFrameOffsetVector.length === 0) {
    return null;
  }
  let bestIdx = null;
  let bestDist = Infinity;
  for (let k = 0; k < gridFrameOffsetVector.length; k++) {
    const dist = Math.abs(gridFrameOffsetVector[k] + doseZ - ctZ);
    if (dist < bestDist) {
      bestDist = dist;
      bestIdx = k;
    }
  }
  return bestDist <= maxDistance ? bestIdx : null;
}

/**
 * Convert a dose grid voxel index to patient coordinates (mm).
 * @param {number} i - column index (x, fastest)
 * @param {number} j - row index (y)
 * @param {number} k - frame index (z)
 * @param {Object} geom - dose geometry
 * @param {{x:number,y:number,z:number}} geom.imagePosition - dose IPP
 * @param {{x:number[],y:number[],z:number[]}} geom.imageOrientation - dose IOP
 * @param {{i:number,j:number}} geom.pixelSpacing - {i: rowSpacing, j: colSpacing}
 * @param {number[]} geom.gridFrameOffsetVector - per-frame z offsets
 * @returns {number[]} [x, y, z] patient coordinates in mm
 */
export function doseVoxelToPatient(i, j, k, geom) {
  const { imagePosition: ipp, imageOrientation: iop, pixelSpacing: ps, gridFrameOffsetVector: gfov } = geom;
  const colSpacing = ps.j;
  const rowSpacing = ps.i;
  const zOff = gfov[k] ?? 0;
  return [
    ipp.x + i * colSpacing * iop.x[0] + j * rowSpacing * iop.y[0] + zOff * iop.z[0],
    ipp.y + i * colSpacing * iop.x[1] + j * rowSpacing * iop.y[1] + zOff * iop.z[1],
    ipp.z + i * colSpacing * iop.x[2] + j * rowSpacing * iop.y[2] + zOff * iop.z[2],
  ];
}

/**
 * Project a patient-space point to viewport canvas CSS coordinates using the
 * cornerstone parallel (orthographic) camera. Implemented manually because
 * StackViewport.worldToCanvas/CPU variants are state-dependent outside the
 * render loop in cornerstone 4.22 (verified: first call OK, later calls
 * return garbage/throw). getCamera() is pure data and version-stable.
 *
 * @param {Object} vp - cornerstone viewport exposing getCamera() and .element
 * @param {number[]} p - patient coordinates [x, y, z] in mm
 * @returns {{x:number, y:number}} canvas CSS coordinates
 */
export function projectWorldToCanvas(vp, p) {
  const cam = vp.getCamera();
  const n = cam.viewPlaneNormal;
  const up = cam.viewUp;
  const right = [up[1] * n[2] - up[2] * n[1], up[2] * n[0] - up[0] * n[2], up[0] * n[1] - up[1] * n[0]];
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
 * Compute the 2D affine transform mapping dose-grid pixel coordinates to the
 * viewport canvas for a given CT slice z. Solves a similarity transform from
 * three dose-grid corner points mapped through patient space and the
 * viewport camera projection. Re-derive per draw so pan/zoom are tracked.
 *
 * Assumes an axial-ish dose orientation (IOP z ≈ [0,0,1]); the general
 * oblique case is out of scope for the 2D overlay.
 *
 * @param {Object} vp - cornerstone viewport (see projectWorldToCanvas)
 * @param {Object} geom - dose geometry (see doseVoxelToPatient)
 * @param {number} ctZ - the CT slice z currently displayed
 * @param {number} [maxFrameDistance] - max |zDose - zCT| in mm; beyond it the
 *   slice is considered outside the dose grid and null is returned
 * @returns {{a:number,b:number,c:number,d:number,e:number,f:number, cols:number, rows:number} | null}
 *   Canvas transform: x_c = a*i + c*j + e, y_c = b*i + d*j + f. null when the
 *   plane cannot be resolved.
 */
export function computeDoseCanvasTransform(vp, geom, ctZ, maxFrameDistance = Infinity) {
  if (!vp || typeof vp.getCamera !== 'function' || !geom?.gridFrameOffsetVector?.length) {
    return null;
  }

  const k = doseFrameIndexForZ(geom.gridFrameOffsetVector, geom.imagePosition.z, ctZ, maxFrameDistance);
  if (k === null) return null;

  // Three reference points suffice for an affine solve; use (0,0), (cols,0), (0,rows)
  const cols = geom._cols ?? 0;
  const rows = geom._rows ?? 0;
  if (!cols || !rows) return null;

  const patientPoints = [
    doseVoxelToPatient(0, 0, k, geom),
    doseVoxelToPatient(cols, 0, k, geom),
    doseVoxelToPatient(0, rows, k, geom),
  ];
  // Project the grid plane onto the CT slice plane so points land exactly on
  // the displayed plane
  for (const p of patientPoints) p[2] = ctZ;

  const canvasPoints = patientPoints.map(p => projectWorldToCanvas(vp, p));
  if (canvasPoints.some(c => !Number.isFinite(c.x) || !Number.isFinite(c.y))) return null;

  // Solve affine: x_c = a*i + c*j + e; y_c = b*i + d*j + f
  // P0=(0,0) → (e, f); P1=(cols,0) → (a,b); P2=(0,rows) → (c,d)
  const [p0, p1, p2] = canvasPoints;
  const e = p0.x, f = p0.y;
  const a = (p1.x - e) / cols;
  const b = (p1.y - f) / cols;
  const c = (p2.x - e) / rows;
  const d = (p2.y - f) / rows;

  if (![a, b, c, d, e, f].every(Number.isFinite)) return null;

  return { a, b, c, d, e, f, cols, rows };
}

/**
 * Apply the affine transform to a grid (i, j) point → canvas coordinates.
 */
export function applyAffineTransform(t, i, j) {
  return {
    x: t.a * i + t.c * j + t.e,
    y: t.b * i + t.d * j + t.f,
  };
}

/**
 * Map dose values (cGy) of one frame to RGBA pixels with an amber colormap.
 * Values below the threshold are transparent; from threshold to maxDose the
 * color ramps from deep amber to bright #f6c177 (design system dose accent).
 *
 * @param {Float32Array} frame - dose frame values in cGy (row-major, length rows*cols)
 * @param {Object} opts
 * @param {number} opts.maxDose - grid max dose in cGy (color ramp end)
 * @param {number} opts.thresholdPct - display threshold in percent of maxDose (0-100)
 * @returns {Uint8ClampedArray} RGBA bytes (length rows*cols*4)
 */
export function applyColormapLUT(frame, { maxDose, thresholdPct }) {
  const rgba = new Uint8ClampedArray(frame.length * 4);
  if (!(maxDose > 0)) return rgba;

  const threshold = (thresholdPct / 100) * maxDose;
  // Color ramp stops (deep amber → dose accent): [r, g, b]
  const stops = [
    [0.0, [122, 80, 20]],
    [0.5, [214, 156, 62]],
    [1.0, [246, 193, 119]],
  ];

  for (let p = 0; p < frame.length; p++) {
    const v = frame[p];
    if (v < threshold) {
      rgba[p * 4 + 3] = 0;
      continue;
    }
    let t = (v - threshold) / (maxDose - threshold);
    t = t > 1 ? 1 : t;

    // Find ramp segment
    let s0 = stops[0], s1 = stops[stops.length - 1];
    for (let s = 0; s < stops.length - 1; s++) {
      if (t >= stops[s][0] && t <= stops[s + 1][0]) {
        s0 = stops[s];
        s1 = stops[s + 1];
        break;
      }
    }
    const seg = s1[0] === s0[0] ? 0 : (t - s0[0]) / (s1[0] - s0[0]);
    const r = s0[1][0] + seg * (s1[1][0] - s0[1][0]);
    const g = s0[1][1] + seg * (s1[1][1] - s0[1][1]);
    const b = s0[1][2] + seg * (s1[1][2] - s0[1][2]);

    rgba[p * 4] = r;
    rgba[p * 4 + 1] = g;
    rgba[p * 4 + 2] = b;
    // Scale alpha with intensity ramp so hot cores are more opaque
    rgba[p * 4 + 3] = Math.round(255 * (0.25 + 0.75 * t));
  }

  return rgba;
}

/**
 * Default isodose levels (% of maxDose) and the cycling palette.
 * Colors are chosen to read on the dark navy background and to stay
 * distinguishable from the amber heat map and the teal-ish structure contours.
 */
export const ISODOSE_PALETTE = [
  '#ff5c5c', '#ff9f43', '#f6c177', '#9ae66e', '#5cc8ff',
  '#c792ea', '#7fdbff', '#ff8fab', '#b8e986', '#ffd166',
  '#6cd4c4', '#e0aaff',
];

export const DEFAULT_ISODOSE_LEVELS = [
  { id: 1, pct: 95, visible: true, color: '#ff5c5c' },
  { id: 2, pct: 90, visible: true, color: '#ff9f43' },
  { id: 3, pct: 70, visible: true, color: '#f6c177' },
  { id: 4, pct: 50, visible: true, color: '#9ae66e' },
  { id: 5, pct: 30, visible: true, color: '#5cc8ff' },
];

/**
 * Extract isodose line segments from one dose frame with marching squares.
 *
 * Pure function. Grid coordinates: x along columns (i), y along rows (j);
 * corner values >= level count as "inside". Output segments are individual
 * (not chained) — the renderer strokes them all in a single path, which is
 * visually equivalent for line display and avoids chaining complexity.
 * Saddle cases (5/10) are resolved by the cell-center average.
 *
 * @param {Float32Array} frame - dose values (row-major, length rows*cols)
 * @param {number} cols
 * @param {number} rows
 * @param {number} level - absolute dose value of the iso line (cGy)
 * @returns {Array<{x1:number,y1:number,x2:number,y2:number}>} segments in grid coordinates
 */
export function extractIsolineSegments(frame, cols, rows, level) {
  const segments = [];
  if (!frame || frame.length < cols * rows || cols < 2 || rows < 2) {
    return segments;
  }

  // Linear interpolation parameter along an edge, clamped to [0, 1]
  const edgeT = (v0, v1) => {
    if (v1 === v0) return 0.5;
    const t = (level - v0) / (v1 - v0);
    return t < 0 ? 0 : t > 1 ? 1 : t;
  };

  for (let cj = 0; cj < rows - 1; cj++) {
    for (let ci = 0; ci < cols - 1; ci++) {
      const tl = frame[cj * cols + ci];
      const tr = frame[cj * cols + ci + 1];
      const br = frame[(cj + 1) * cols + ci + 1];
      const bl = frame[(cj + 1) * cols + ci];

      let idx = 0;
      if (tl >= level) idx |= 1;
      if (tr >= level) idx |= 2;
      if (br >= level) idx |= 4;
      if (bl >= level) idx |= 8;
      if (idx === 0 || idx === 15) continue;

      // Edge crossing points (only computed when the edge is actually crossed)
      const T = (tl >= level) !== (tr >= level)
        ? { x: ci + edgeT(tl, tr), y: cj } : null;
      const R = (tr >= level) !== (br >= level)
        ? { x: ci + 1, y: cj + edgeT(tr, br) } : null;
      const B = (bl >= level) !== (br >= level)
        ? { x: ci + edgeT(bl, br), y: cj + 1 } : null;
      const L = (tl >= level) !== (bl >= level)
        ? { x: ci, y: cj + edgeT(tl, bl) } : null;

      const push = (p, q) => {
        if (p && q) segments.push({ x1: p.x, y1: p.y, x2: q.x, y2: q.y });
      };

      const centerInside = (tl + tr + br + bl) / 4 >= level;

      switch (idx) {
        case 1: case 14: push(L, T); break;             // TL corner alone / alone-out
        case 2: case 13: push(T, R); break;             // TR
        case 3: case 12: push(L, R); break;             // top or bottom half
        case 4: case 11: push(R, B); break;             // BR
        case 6: case 9: push(T, B); break;              // left or right half
        case 7: case 8: push(L, B); break;              // BL
        // Saddles: resolve via the cell-center average
        case 5: // TL & BR inside
          if (centerInside) { push(L, B); push(T, R); }
          else { push(L, T); push(R, B); }
          break;
        case 10: // TR & BL inside
          if (centerInside) { push(L, T); push(R, B); }
          else { push(L, B); push(T, R); }
          break;
      }
    }
  }

  return segments;
}
