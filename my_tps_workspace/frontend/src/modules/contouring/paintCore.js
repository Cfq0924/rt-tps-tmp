/**
 * Contouring paint core — pure functions for the manual contouring module.
 *
 * Data model: one binary mask per (segment, slice): Uint8Array(cols*rows),
 * values 0/1, row-major. Contours are polylines; persisted polygons are flat
 * [x,y,z,...] arrays in patient mm (RTSTRUCT-compatible).
 *
 * All functions are pure (no DOM) so they run in node tests.
 */

import { extractIsolineSegments } from '../../lib/doseTransform.js';

/**
 * Stamp a filled circle into the mask (brush). Coordinates are in image
 * pixel space (float, center of pixel i = i, j = j).
 */
export function stampBrush(mask, cols, rows, cx, cy, rPx, value) {
  if (rPx <= 0) return;
  const x0 = Math.max(0, Math.floor(cx - rPx));
  const x1 = Math.min(cols - 1, Math.ceil(cx + rPx));
  const y0 = Math.max(0, Math.floor(cy - rPx));
  const y1 = Math.min(rows - 1, Math.ceil(cy + rPx));
  const r2 = rPx * rPx;
  for (let j = y0; j <= y1; j++) {
    for (let i = x0; i <= x1; i++) {
      const dx = i - cx;
      const dy = j - cy;
      if (dx * dx + dy * dy <= r2) {
        mask[j * cols + i] = value;
      }
    }
  }
}

/**
 * Stamp a brush along a pointer segment (interpolated so fast strokes don't
 * leave gaps). Step is rPx/2 (max half a brush diameter per stamp).
 */
export function stampLine(mask, cols, rows, x0, y0, x1, y1, rPx, value) {
  const dist = Math.hypot(x1 - x0, y1 - y0);
  const steps = Math.max(1, Math.ceil(dist / Math.max(1, rPx / 2)));
  for (let s = 0; s <= steps; s++) {
    const t = s / steps;
    stampBrush(mask, cols, rows, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, rPx, value);
  }
}

/**
 * Fill an axis-aligned rectangle (scissors-rect). Coordinates normalized to
 * min/max so any drag direction works.
 */
export function fillRect(mask, cols, rows, x0, y0, x1, y1, value) {
  const xa = Math.max(0, Math.floor(Math.min(x0, x1)));
  const xb = Math.min(cols - 1, Math.ceil(Math.max(x0, x1)));
  const ya = Math.max(0, Math.floor(Math.min(y0, y1)));
  const yb = Math.min(rows - 1, Math.ceil(Math.max(y0, y1)));
  for (let j = ya; j <= yb; j++) {
    for (let i = xa; i <= xb; i++) {
      mask[j * cols + i] = value;
    }
  }
}

/**
 * Fill an axis-aligned ellipse (scissors-circle). Coordinates are the two
 * corners of the bounding box.
 */
export function fillEllipse(mask, cols, rows, x0, y0, x1, y1, value) {
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  const rx = Math.abs(x1 - x0) / 2;
  const ry = Math.abs(y1 - y0) / 2;
  if (rx <= 0 || ry <= 0) return;
  const xa = Math.max(0, Math.floor(Math.min(x0, x1)));
  const xb = Math.min(cols - 1, Math.ceil(Math.max(x0, x1)));
  const ya = Math.max(0, Math.floor(Math.min(y0, y1)));
  const yb = Math.min(rows - 1, Math.ceil(Math.max(y0, y1)));
  for (let j = ya; j <= yb; j++) {
    for (let i = xa; i <= xb; i++) {
      const nx = (i - cx) / rx;
      const ny = (j - cy) / ry;
      if (nx * nx + ny * ny <= 1) {
        mask[j * cols + i] = value;
      }
    }
  }
}

/**
 * Extract contours of one segment value from a mask as pixel-space polylines.
 * Thin wrapper over marching squares (level = value - 0.5 so values equal to
 * the segment index count as inside).
 * @returns {Array<Array<number>>} polylines, each a flat [x,y, x,y, ...] array
 */
export function maskToPolygons(mask, cols, rows, segmentValue) {
  const level = segmentValue - 0.5;
  const segments = extractIsolineSegments(mask, cols, rows, level);
  return chainSegments(segments);
}

/**
 * Chain free segments into polylines by matching endpoints (rounded key).
 * Open polylines (mask touching the grid border) are kept open.
 * @param {Array<{x1,y1,x2,y2}>} segments
 * @returns {Array<Array<number>>} flat [x,y, x,y, ...] polylines
 */
export function chainSegments(segments, tol = 1e-4) {
  const key = (x, y) => `${Math.round(x / tol)}:${Math.round(y / tol)}`;
  const endpointMap = new Map(); // key -> [{segIdx, end}] ('a' = x1/y1, 'b' = x2/y2)
  segments.forEach((s, i) => {
    for (const [k, x, y] of [['a', s.x1, s.y1], ['b', s.x2, s.y2]]) {
      const keyS = key(x, y);
      if (!endpointMap.has(keyS)) endpointMap.set(keyS, []);
      endpointMap.get(keyS).push([i, k]);
    }
  });

  const used = new Array(segments.length).fill(false);
  const polys = [];

  const takeFrom = (startSeg, startEndKey) => {
    const pts = [];
    let segIdx = startSeg;
    let entryKey = startEndKey; // the free end we continue FROM
    while (segIdx !== -1 && !used[segIdx]) {
      used[segIdx] = true;
      const s = segments[segIdx];
      const aKey = key(s.x1, s.y1);
      const bKey = key(s.x2, s.y2);
      // append the far end relative to the entry side
      let farKey;
      if (entryKey === aKey) { pts.push(s.x2, s.y2); farKey = bKey; }
      else { pts.push(s.x1, s.y1); farKey = aKey; }
      // find the next unused segment sharing the far endpoint
      const cands = endpointMap.get(farKey) || [];
      segIdx = -1;
      for (const [ni, nk] of cands) {
        if (!used[ni]) {
          // continue from the endpoint that matches farKey
          segIdx = ni;
          entryKey = nk === 'a' ? key(segments[ni].x1, segments[ni].y1) : key(segments[ni].x2, segments[ni].y2);
          entryKey = farKey;
          break;
        }
      }
    }
    return pts;
  };

  for (let i = 0; i < segments.length; i++) {
    if (used[i]) continue;
    used[i] = true;
    const s = segments[i];
    const pts = [s.x1, s.y1, s.x2, s.y2];
    // extend forward from the far (b) end
    let cursor = key(s.x2, s.y2);
    let guard = segments.length + 1;
    while (guard-- > 0) {
      const cands = (endpointMap.get(cursor) || []).filter(([ni]) => !used[ni]);
      if (cands.length === 0) break;
      const [ni, nk] = cands[0];
      used[ni] = true;
      const ns = segments[ni];
      const naKey = key(ns.x1, ns.y1);
      if (naKey === cursor) {
        pts.push(ns.x2, ns.y2);
        cursor = key(ns.x2, ns.y2);
      } else {
        pts.push(ns.x1, ns.y1);
        cursor = key(ns.x1, ns.y1);
      }
    }
    // extend backward from the near (a) end
    cursor = key(s.x1, s.y1);
    guard = segments.length + 1;
    while (guard-- > 0) {
      const cands = (endpointMap.get(cursor) || []).filter(([ni]) => !used[ni]);
      if (cands.length === 0) break;
      const [ni, nk] = cands[0];
      used[ni] = true;
      const ns = segments[ni];
      const naKey = key(ns.x1, ns.y1);
      if (naKey === cursor) {
        pts.unshift(ns.x2, ns.y2);
        cursor = key(ns.x2, ns.y2);
      } else {
        pts.unshift(ns.x1, ns.y1);
        cursor = key(ns.x1, ns.y1);
      }
    }
    polys.push(pts);
  }

  return polys;
}

/**
 * Fill polygons (image pixel space) into a mask — inverse of
 * maskToPolygons, used when loading persisted contours for editing.
 * Even-odd scanline fill, pure JS (no DOM canvas needed).
 * @param {Uint8Array} mask - target mask (mutated)
 * @param {number} cols
 * @param {number} rows
 * @param {Array<Array<number>>} polygons - flat [x,y, ...] arrays
 * @param {number} value - fill value
 */
export function polygonsToMask(mask, cols, rows, polygons, value) {
  // Even-odd across ALL polygons of the slice (RTSTRUCT semantics): the
  // crossings of every contour are pooled per scanline, so a nested contour
  // carves a hole instead of being filled over. Single-polygon calls are
  // unaffected.
  const allEdges = [];
  let yMin = Infinity, yMax = -Infinity;
  for (const poly of polygons) {
    const n = poly.length / 2;
    if (n < 3) continue;
    allEdges.push(poly);
    for (let e = 0; e < n; e++) {
      const ya = poly[e * 2 + 1];
      if (ya < yMin) yMin = ya;
      if (ya > yMax) yMax = ya;
    }
  }
  if (allEdges.length === 0) return;
  const jMin = Math.max(0, Math.ceil(yMin));
  const jMax = Math.min(rows - 1, Math.floor(yMax));
  for (let j = jMin; j <= jMax; j++) {
    const yc = j; // sample at pixel center row
    const xs = [];
    for (const poly of allEdges) {
      const n = poly.length / 2;
      for (let e = 0; e < n; e++) {
        const xa = poly[e * 2];
        const ya = poly[e * 2 + 1];
        const xb = poly[((e + 1) % n) * 2];
        const yb = poly[((e + 1) % n) * 2 + 1];
        if ((ya <= yc && yb > yc) || (yb <= yc && ya > yc)) {
          xs.push(xa + ((yc - ya) / (yb - ya)) * (xb - xa));
        }
      }
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const xa = Math.max(0, Math.ceil(xs[k]));
      const xb = Math.min(cols - 1, Math.floor(xs[k + 1]));
      for (let i = xa; i <= xb; i++) {
        mask[j * cols + i] = value;
      }
    }
  }
}

/**
 * Patient (mm) → CT image pixel coordinates for a point on the CT slice.
 * Solves the in-plane 2D system [dx,dy] = i·colSpacing·X̂ + j·rowSpacing·Ŷ.
 * Assumes an in-plane orientation (axial HFS: z maps directly to the slice).
 * @param {number[]} p - patient coordinates [x, y, z]
 * @param {Object} ctGeom - { imagePosition:{x,y,z}, imageOrientation:{x:[],y:[]}, pixelSpacing:{i,j} }
 * @returns {{i:number, j:number}} continuous image pixel coordinates
 */
export function patientToImagePixel(p, ctGeom) {
  const { imagePosition: ipp, imageOrientation: iop, pixelSpacing: ps } = ctGeom;
  const dx = p[0] - ipp.x;
  const dy = p[1] - ipp.y;
  const a = ps.j * iop.x[0];
  const b = ps.i * iop.y[0];
  const c = ps.j * iop.x[1];
  const d = ps.i * iop.y[1];
  const det = a * d - b * c;
  if (Math.abs(det) < 1e-9) return { i: NaN, j: NaN };
  return {
    i: (dx * d - dy * b) / det,
    j: (dy * a - dx * c) / det,
  };
}

/**
 * CT image pixel (i, j) on slice z → patient coordinates (mm).
 * @param {number} i - column index
 * @param {number} j - row index
 * @param {number} z - slice z in mm
 * @param {Object} ctGeom - same shape as patientToImagePixel
 * @returns {number[]} [x, y, z]
 */
export function imagePixelToPatient(i, j, z, ctGeom) {
  const { imagePosition: ipp, imageOrientation: iop, pixelSpacing: ps } = ctGeom;
  return [
    ipp.x + i * ps.j * iop.x[0] + j * ps.i * iop.y[0],
    ipp.y + i * ps.j * iop.x[1] + j * ps.i * iop.y[1],
    z,
  ];
}

/**
 * Undo/redo stacks for slice masks (per-segment simple history).
 * Snapshots are {sliceIdx, data: Uint8Array copy}.
 */
export function createHistory(maxDepth = 20) {
  return { past: [], future: [], maxDepth };
}

export function pushSnapshot(history, sliceIdx, mask) {
  history.past.push({ sliceIdx, data: mask.slice() });
  if (history.past.length > history.maxDepth) history.past.shift();
  history.future.length = 0;
}

/**
 * Undo: restore the most recent snapshot. Returns {sliceIdx, data} or null.
 * The current (pre-undo) state is pushed onto the redo stack.
 */
export function undo(history, currentGetter) {
  const snap = history.past.pop();
  if (!snap) return null;
  history.future.push({ sliceIdx: snap.sliceIdx, data: currentGetter(snap.sliceIdx).slice() });
  return snap;
}

/**
 * Redo: reapply the most recent undone state. Returns {sliceIdx, data} or null.
 */
export function redo(history, currentGetter) {
  const snap = history.future.pop();
  if (!snap) return null;
  history.past.push({ sliceIdx: snap.sliceIdx, data: currentGetter(snap.sliceIdx).slice() });
  return snap;
}

/**
 * Flood fill a connected region of similar intensity (HU) starting from a
 * seed point, writing `value` into the mask. Tolerance is absolute HU.
 * Uses a stack-based flood fill over 4-connected neighbors.
 *
 * @param {Int16Array} ctPixels - CT voxel values (HU), row-major
 * @param {Uint8Array} mask - target mask (mutated)
 * @param {number} cols
 * @param {number} rows
 * @param {number} si - seed column
 * @param {number} sj - seed row
 * @param {number} huTolerance - absolute HU tolerance around the seed value
 * @param {number} value - mask value to write
 * @returns {number} number of voxels written
 */
export function floodFillHU(ctPixels, mask, cols, rows, si, sj, huTolerance, value) {
  if (si < 0 || sj < 0 || si >= cols || sj >= rows) return 0;
  const seedHU = ctPixels[sj * cols + si];
  const lo = seedHU - huTolerance;
  const hi = seedHU + huTolerance;
  const visited = new Uint8Array(cols * rows);
  const stack = [[si, sj]];
  let count = 0;
  while (stack.length) {
    const [i, j] = stack.pop();
    if (i < 0 || j < 0 || i >= cols || j >= rows) continue;
    const idx = j * cols + i;
    if (visited[idx]) continue;
    visited[idx] = 1;
    const hu = ctPixels[idx];
    if (hu < lo || hu > hi) continue;
    mask[idx] = value;
    count++;
    stack.push([i + 1, j], [i - 1, j], [i, j + 1], [i, j - 1]);
  }
  return count;
}

/**
 * Binary mask operation between two same-size masks, writing into maskA.
 * @param {'union'|'subtract'|'intersect'} op
 */
export function booleanOp(maskA, maskB, op) {
  for (let i = 0; i < maskA.length; i++) {
    const a = maskA[i], b = maskB[i];
    if (op === 'union') maskA[i] = a || b ? 1 : 0;
    else if (op === 'subtract') maskA[i] = a && !b ? 1 : 0;
    else if (op === 'intersect') maskA[i] = a && b ? 1 : 0;
  }
}

/**
 * Expand (dilate) a mask by a circular structuring element in-plane, and
 * copy/dilate across ±zLayers neighboring slices. Used for CTV→PTV margin
 * growth. Works in image pixel space; marginPx derived from mm by caller.
 *
 * @param {Uint8Array} mask - mutated in place
 * @param {number} cols
 * @param {number} rows
 * @param {number} marginPx - dilation radius in pixels
 * @param {number} zLayers - number of slices to extend above/below (0 = in-plane only)
 * @param {Function} getSlice - (sliceOffset) => Uint8Array mask of the neighbor slice
 * @param {Function} setSlice - (sliceOffset, mask) => void
 */
export function expandMask3D(mask, cols, rows, marginPx, zLayers, getSlice, setSlice) {
  // in-plane dilation: any voxel within marginPx of a set voxel becomes set
  const dilated = new Uint8Array(mask.length);
  const r2 = marginPx * marginPx;
  const offsets = [];
  for (let dj = -Math.ceil(marginPx); dj <= Math.ceil(marginPx); dj++) {
    for (let di = -Math.ceil(marginPx); di <= Math.ceil(marginPx); di++) {
      if (di * di + dj * dj <= r2) offsets.push([di, dj]);
    }
  }
  for (let idx = 0; idx < mask.length; idx++) {
    if (!mask[idx]) continue;
    const j = Math.floor(idx / cols), i = idx % cols;
    for (const [di, dj] of offsets) {
      const ni = i + di, nj = j + dj;
      if (ni >= 0 && ni < cols && nj >= 0 && nj < rows) dilated[nj * cols + ni] = 1;
    }
  }
  mask.set(dilated);

  // z propagation: dilate the in-plane result onto neighbor slices
  for (let dz = 1; dz <= zLayers; dz++) {
    for (const dir of [-1, 1]) {
      const neighbor = getSlice(dir * dz);
      if (!neighbor) continue;
      for (let idx = 0; idx < mask.length; idx++) {
        if (mask[idx]) neighbor[idx] = 1;
      }
      setSlice(dir * dz, neighbor);
    }
  }
}

/**
 * Convert a cornerstone image's raw pixel data to HU by applying
 * rescale slope/intercept. getPixelData() returns *stored* values — for CT
 * these are shifted (typically intercept −1024), so absolute-HU operations
 * (flood fill tolerance, body threshold −300) must go through this.
 * @param {Object} image - cornerstone image (cache.getImage result)
 * @returns {Float32Array} HU values
 */
export function imageToHU(image) {
  const px = image.getPixelData();
  const slope = image.slope ?? 1;
  const intercept = image.intercept ?? 0;
  return Float32Array.from(px, v => v * slope + intercept);
}

/**
 * Keep only the largest 4-connected component of a mask (in place).
 * @returns {number} size of the kept component
 */
export function keepLargestComponent(mask, cols, rows) {
  const visited = new Uint8Array(mask.length);
  const labels = new Int32Array(mask.length).fill(-1);
  const sizes = [];
  let labelCount = 0;
  const stack = [];
  // label all 4-connected components
  for (let start = 0; start < mask.length; start++) {
    if (!mask[start] || visited[start]) continue;
    const myLabel = labelCount++;
    let size = 0;
    stack.push(start);
    visited[start] = 1;
    while (stack.length) {
      const idx = stack.pop();
      labels[idx] = myLabel;
      size++;
      const j = Math.floor(idx / cols), i = idx % cols;
      for (const [ni, nj] of [[i+1,j],[i-1,j],[i,j+1],[i,j-1]]) {
        if (ni < 0 || nj < 0 || ni >= cols || nj >= rows) continue;
        const nIdx = nj * cols + ni;
        if (mask[nIdx] && !visited[nIdx]) { visited[nIdx] = 1; stack.push(nIdx); }
      }
    }
    sizes.push(size);
  }
  if (labelCount <= 1) return sizes[0] ?? 0;
  // keep only the largest component
  const keepLabel = sizes.indexOf(Math.max(...sizes));
  for (let i = 0; i < mask.length; i++) {
    if (mask[i] && labels[i] !== keepLabel) mask[i] = 0;
  }
  return sizes[keepLabel];
}

/**
 * Auto body contour: threshold CT HU, keep the largest connected component,
 * and (optionally) close the table area — v1 keeps only the patient body
 * (largest component above threshold). Returns the body mask as a new array.
 *
 * @param {Int16Array} ctPixels - HU values
 * @param {number} cols
 * @param {number} rows
 * @param {number} huThreshold - HU threshold separating body from air (default -300)
 * @returns {Uint8Array} binary body mask
 */
export function autoBodyMask(ctPixels, cols, rows, huThreshold = -300) {
  const mask = new Uint8Array(cols * rows);
  for (let i = 0; i < mask.length; i++) {
    if (ctPixels[i] > huThreshold) mask[i] = 1;
  }
  keepLargestComponent(mask, cols, rows);
  return mask;
}

/** 4-connected offsets (shared by morphology helpers). */
const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];

/**
 * Label 4-connected components of a binary mask.
 * @returns {{labels: Int32Array, sizes: number[]}} labels[i]=-1 when empty
 */
export function labelComponents4(mask, cols, rows) {
  const labels = new Int32Array(mask.length).fill(-1);
  const sizes = [];
  const stack = [];
  let next = 0;
  for (let start = 0; start < mask.length; start++) {
    if (!mask[start] || labels[start] !== -1) continue;
    const id = next++;
    let size = 0;
    stack.push(start);
    labels[start] = id;
    while (stack.length) {
      const idx = stack.pop();
      size++;
      const j = Math.floor(idx / cols);
      const i = idx % cols;
      for (const [di, dj] of N4) {
        const ni = i + di, nj = j + dj;
        if (ni < 0 || nj < 0 || ni >= cols || nj >= rows) continue;
        const nIdx = nj * cols + ni;
        if (mask[nIdx] && labels[nIdx] === -1) {
          labels[nIdx] = id;
          stack.push(nIdx);
        }
      }
    }
    sizes.push(size);
  }
  return { labels, sizes };
}

/**
 * Eclipse Post Processing Clean-up (MVP): remove 4-connected components
 * smaller than minAreaPx. Mutates mask in place.
 * @returns {{removed: number, kept: number}}
 */
export function cleanupSmallComponents(mask, cols, rows, minAreaPx) {
  const threshold = Math.max(1, Math.floor(minAreaPx));
  const { labels, sizes } = labelComponents4(mask, cols, rows);
  let removed = 0;
  let kept = 0;
  for (let i = 0; i < mask.length; i++) {
    const lab = labels[i];
    if (lab < 0) continue;
    if (sizes[lab] < threshold) {
      mask[i] = 0;
      removed++;
    } else {
      kept++;
    }
  }
  return { removed, kept };
}

/**
 * Morphological erode of a binary mask with a circular SE (4-connected disk
 * approximated by square for speed at small radii; radius 0 is identity).
 * @returns {Uint8Array} new mask
 */
export function erodeMask(mask, cols, rows, radiusPx) {
  if (radiusPx <= 0) return mask.slice();
  const r = Math.ceil(radiusPx);
  const out = new Uint8Array(mask.length);
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      if (!mask[j * cols + i]) continue;
      let inside = true;
      for (let dj = -r; dj <= r && inside; dj++) {
        for (let di = -r; di <= r; di++) {
          if (di * di + dj * dj > radiusPx * radiusPx) continue;
          const ni = i + di, nj = j + dj;
          if (ni < 0 || nj < 0 || ni >= cols || nj >= rows || !mask[nj * cols + ni]) {
            inside = false;
            break;
          }
        }
      }
      if (inside) out[j * cols + i] = 1;
    }
  }
  return out;
}

/**
 * Morphological dilate of a binary mask with a circular SE.
 * @returns {Uint8Array} new mask
 */
export function dilateMask(mask, cols, rows, radiusPx) {
  if (radiusPx <= 0) return mask.slice();
  const r = Math.ceil(radiusPx);
  const out = new Uint8Array(mask.length);
  const r2 = radiusPx * radiusPx;
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      if (!mask[j * cols + i]) continue;
      for (let dj = -r; dj <= r; dj++) {
        for (let di = -r; di <= r; di++) {
          if (di * di + dj * dj > r2) continue;
          const ni = i + di, nj = j + dj;
          if (ni >= 0 && nj >= 0 && ni < cols && nj < rows) out[nj * cols + ni] = 1;
        }
      }
    }
  }
  return out;
}

/**
 * Crop a mask by an axis-aligned pixel rect (Eclipse Crop Structure MVP).
 * Normalizes the two corners so any drag direction works.
 * @param {Uint8Array} mask - mutated in place
 * @param {{x0:number,y0:number,x1:number,y1:number}} rect - continuous image pixels
 * @param {'keepInside'|'keepOutside'} mode
 * @returns {number} voxels cleared
 */
export function cropMask(mask, cols, rows, rect, mode = 'keepInside') {
  const xa = Math.max(0, Math.floor(Math.min(rect.x0, rect.x1)));
  const xb = Math.min(cols - 1, Math.ceil(Math.max(rect.x0, rect.x1)));
  const ya = Math.max(0, Math.floor(Math.min(rect.y0, rect.y1)));
  const yb = Math.min(rows - 1, Math.ceil(Math.max(rect.y0, rect.y1)));
  let cleared = 0;
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const idx = j * cols + i;
      if (!mask[idx]) continue;
      const inBox = i >= xa && i <= xb && j >= ya && j <= yb;
      const shouldClear = mode === 'keepInside' ? !inBox : inBox;
      if (shouldClear) {
        mask[idx] = 0;
        cleared++;
      }
    }
  }
  return cleared;
}

/**
 * Extract Wall (Eclipse): ring = dilate(source, outerPx) − erode(source, innerPx).
 * Outer margin grows outward; inner margin hollows the interior.
 * @returns {Uint8Array} new mask (does not mutate source)
 */
export function extractWallMask(mask, cols, rows, outerPx, innerPx) {
  const outer = dilateMask(mask, cols, rows, outerPx);
  const inner = erodeMask(mask, cols, rows, innerPx);
  const wall = new Uint8Array(mask.length);
  for (let i = 0; i < mask.length; i++) {
    wall[i] = outer[i] && !inner[i] ? 1 : 0;
  }
  return wall;
}

/**
 * Sample a 2D coronal mask (width=cols along x, height=numSlices along z)
 * from the axial per-slice mask map of one segment.
 * @param {Function} getSlice - (sliceIdx) => Uint8Array|null
 */
export function sampleCoronalMask(getSlice, numSlices, cols, rows, yIdx) {
  const y = Math.max(0, Math.min(rows - 1, Math.round(yIdx)));
  const out = new Uint8Array(cols * numSlices);
  for (let k = 0; k < numSlices; k++) {
    const src = getSlice(k);
    if (!src) continue;
    const off = y * cols;
    for (let i = 0; i < cols; i++) out[k * cols + i] = src[off + i];
  }
  return out;
}

/**
 * Sample a 2D sagittal mask (width=rows along y, height=numSlices along z).
 */
export function sampleSagittalMask(getSlice, numSlices, cols, rows, xIdx) {
  const x = Math.max(0, Math.min(cols - 1, Math.round(xIdx)));
  const out = new Uint8Array(rows * numSlices);
  for (let k = 0; k < numSlices; k++) {
    const src = getSlice(k);
    if (!src) continue;
    for (let j = 0; j < rows; j++) out[k * rows + j] = src[j * cols + x];
  }
  return out;
}

/**
 * Stamp a circular brush on a CORONAL plane (y = yIdx) into the axial mask map.
 * Plane coords: u = x column, v = slice index.
 * @param {Function} getSlice - (sliceIdx) => Uint8Array
 * @param {Function} setSlice - (sliceIdx, mask) => void  (optional if mutating in place)
 */
export function stampBrushCoronal(getSlice, setSlice, cols, rows, numSlices, yIdx, cu, cv, rPx, value) {
  if (rPx <= 0) return 0;
  const y = Math.max(0, Math.min(rows - 1, Math.round(yIdx)));
  const r2 = rPx * rPx;
  let n = 0;
  const u0 = Math.max(0, Math.floor(cu - rPx));
  const u1 = Math.min(cols - 1, Math.ceil(cu + rPx));
  const v0 = Math.max(0, Math.floor(cv - rPx));
  const v1 = Math.min(numSlices - 1, Math.ceil(cv + rPx));
  for (let v = v0; v <= v1; v++) {
    const mask = getSlice(v);
    if (!mask) continue;
    let touched = false;
    for (let u = u0; u <= u1; u++) {
      const du = u - cu;
      const dv = v - cv;
      if (du * du + dv * dv <= r2) {
        const idx = y * cols + u;
        if (mask[idx] !== value) n++;
        mask[idx] = value;
        touched = true;
      }
    }
    if (touched && setSlice) setSlice(v, mask);
  }
  return n;
}

/**
 * Stamp a circular brush on a SAGITTAL plane (x = xIdx).
 * Plane coords: u = y row, v = slice index.
 */
export function stampBrushSagittal(getSlice, setSlice, cols, rows, numSlices, xIdx, cu, cv, rPx, value) {
  if (rPx <= 0) return 0;
  const x = Math.max(0, Math.min(cols - 1, Math.round(xIdx)));
  const r2 = rPx * rPx;
  let n = 0;
  const u0 = Math.max(0, Math.floor(cu - rPx));
  const u1 = Math.min(rows - 1, Math.ceil(cu + rPx));
  const v0 = Math.max(0, Math.floor(cv - rPx));
  const v1 = Math.min(numSlices - 1, Math.ceil(cv + rPx));
  for (let v = v0; v <= v1; v++) {
    const mask = getSlice(v);
    if (!mask) continue;
    let touched = false;
    for (let u = u0; u <= u1; u++) {
      const du = u - cu;
      const dv = v - cv;
      if (du * du + dv * dv <= r2) {
        const idx = u * cols + x;
        if (mask[idx] !== value) n++;
        mask[idx] = value;
        touched = true;
      }
    }
    if (touched && setSlice) setSlice(v, mask);
  }
  return n;
}

/** Interpolate a brush stamp along a segment on the coronal plane. */
export function stampLineCoronal(getSlice, setSlice, cols, rows, numSlices, yIdx, u0, v0, u1, v1, rPx, value) {
  const dist = Math.hypot(u1 - u0, v1 - v0);
  const steps = Math.max(1, Math.ceil(dist / Math.max(1, rPx / 2)));
  for (let s = 0; s <= steps; s++) {
    const t = s / steps;
    stampBrushCoronal(getSlice, setSlice, cols, rows, numSlices, yIdx, u0 + (u1 - u0) * t, v0 + (v1 - v0) * t, rPx, value);
  }
}

/** Interpolate a brush stamp along a segment on the sagittal plane. */
export function stampLineSagittal(getSlice, setSlice, cols, rows, numSlices, xIdx, u0, v0, u1, v1, rPx, value) {
  const dist = Math.hypot(u1 - u0, v1 - v0);
  const steps = Math.max(1, Math.ceil(dist / Math.max(1, rPx / 2)));
  for (let s = 0; s <= steps; s++) {
    const t = s / steps;
    stampBrushSagittal(getSlice, setSlice, cols, rows, numSlices, xIdx, u0 + (u1 - u0) * t, v0 + (v1 - v0) * t, rPx, value);
  }
}

/**
 * Apply a 2D plane mask change back into the axial slice map.
 * planeMask is width×height (coronal: cols×numSlices, sagittal: rows×numSlices).
 */
export function writePlaneMaskCoronal(planeMask, getSlice, setSlice, cols, rows, numSlices, yIdx) {
  const y = Math.max(0, Math.min(rows - 1, Math.round(yIdx)));
  for (let k = 0; k < numSlices; k++) {
    const mask = getSlice(k);
    if (!mask) continue;
    let touched = false;
    for (let i = 0; i < cols; i++) {
      const v = planeMask[k * cols + i] ? 1 : 0;
      const idx = y * cols + i;
      if (mask[idx] !== v) {
        mask[idx] = v;
        touched = true;
      }
    }
    if (touched && setSlice) setSlice(k, mask);
  }
}

export function writePlaneMaskSagittal(planeMask, getSlice, setSlice, cols, rows, numSlices, xIdx) {
  const x = Math.max(0, Math.min(cols - 1, Math.round(xIdx)));
  for (let k = 0; k < numSlices; k++) {
    const mask = getSlice(k);
    if (!mask) continue;
    let touched = false;
    for (let j = 0; j < rows; j++) {
      const v = planeMask[k * rows + j] ? 1 : 0;
      const idx = j * cols + x;
      if (mask[idx] !== v) {
        mask[idx] = v;
        touched = true;
      }
    }
    if (touched && setSlice) setSlice(k, mask);
  }
}

/**
 * Fill a rectangle on the CORONAL plane (writes through to axial masks).
 * rect: {u0,v0,u1,v1} continuous plane pixels.
 */
export function fillRectCoronal(getSlice, setSlice, cols, rows, numSlices, yIdx, rect, value = 1) {
  const y = Math.max(0, Math.min(rows - 1, Math.round(yIdx)));
  const ua = Math.max(0, Math.floor(Math.min(rect.u0, rect.u1)));
  const ub = Math.min(cols - 1, Math.ceil(Math.max(rect.u0, rect.u1)));
  const va = Math.max(0, Math.floor(Math.min(rect.v0, rect.v1)));
  const vb = Math.min(numSlices - 1, Math.ceil(Math.max(rect.v0, rect.v1)));
  for (let k = va; k <= vb; k++) {
    const mask = getSlice(k);
    if (!mask) continue;
    let touched = false;
    for (let u = ua; u <= ub; u++) {
      const idx = y * cols + u;
      if (mask[idx] !== value) { mask[idx] = value; touched = true; }
    }
    if (touched && setSlice) setSlice(k, mask);
  }
}

/** Fill a rectangle on the SAGITTAL plane. */
export function fillRectSagittal(getSlice, setSlice, cols, rows, numSlices, xIdx, rect, value = 1) {
  const x = Math.max(0, Math.min(cols - 1, Math.round(xIdx)));
  const ua = Math.max(0, Math.floor(Math.min(rect.u0, rect.u1)));
  const ub = Math.min(rows - 1, Math.ceil(Math.max(rect.u0, rect.u1)));
  const va = Math.max(0, Math.floor(Math.min(rect.v0, rect.v1)));
  const vb = Math.min(numSlices - 1, Math.ceil(Math.max(rect.v0, rect.v1)));
  for (let k = va; k <= vb; k++) {
    const mask = getSlice(k);
    if (!mask) continue;
    let touched = false;
    for (let u = ua; u <= ub; u++) {
      const idx = u * cols + x;
      if (mask[idx] !== value) { mask[idx] = value; touched = true; }
    }
    if (touched && setSlice) setSlice(k, mask);
  }
}

/**
 * Crop on a plane: keepInside/keepOutside the rect, writing back to axial masks.
 * For coronal, the crop applies only to voxels on planeCoord (that y column).
 */
export function cropCoronal(getSlice, setSlice, cols, rows, numSlices, yIdx, rect, mode = 'keepInside') {
  const y = Math.max(0, Math.min(rows - 1, Math.round(yIdx)));
  const ua = Math.max(0, Math.floor(Math.min(rect.u0, rect.u1)));
  const ub = Math.min(cols - 1, Math.ceil(Math.max(rect.u0, rect.u1)));
  const va = Math.max(0, Math.floor(Math.min(rect.v0, rect.v1)));
  const vb = Math.min(numSlices - 1, Math.ceil(Math.max(rect.v0, rect.v1)));
  let cleared = 0;
  for (let k = 0; k < numSlices; k++) {
    const mask = getSlice(k);
    if (!mask) continue;
    let touched = false;
    for (let u = 0; u < cols; u++) {
      const idx = y * cols + u;
      if (!mask[idx]) continue;
      const inBox = u >= ua && u <= ub && k >= va && k <= vb;
      const shouldClear = mode === 'keepInside' ? !inBox : inBox;
      if (shouldClear) { mask[idx] = 0; cleared++; touched = true; }
    }
    if (touched && setSlice) setSlice(k, mask);
  }
  return cleared;
}

export function cropSagittal(getSlice, setSlice, cols, rows, numSlices, xIdx, rect, mode = 'keepInside') {
  const x = Math.max(0, Math.min(cols - 1, Math.round(xIdx)));
  const ua = Math.max(0, Math.floor(Math.min(rect.u0, rect.u1)));
  const ub = Math.min(rows - 1, Math.ceil(Math.max(rect.u0, rect.u1)));
  const va = Math.max(0, Math.floor(Math.min(rect.v0, rect.v1)));
  const vb = Math.min(numSlices - 1, Math.ceil(Math.max(rect.v0, rect.v1)));
  let cleared = 0;
  for (let k = 0; k < numSlices; k++) {
    const mask = getSlice(k);
    if (!mask) continue;
    let touched = false;
    for (let j = 0; j < rows; j++) {
      const idx = j * cols + x;
      if (!mask[idx]) continue;
      const inBox = j >= ua && j <= ub && k >= va && k <= vb;
      const shouldClear = mode === 'keepInside' ? !inBox : inBox;
      if (shouldClear) { mask[idx] = 0; cleared++; touched = true; }
    }
    if (touched && setSlice) setSlice(k, mask);
  }
  return cleared;
}

/**
 * Flood fill on a CORONAL plane from plane HU pixels, writing into axial masks.
 * @param {Float32Array} planeHu - width=cols, height=numSlices
 */
export function floodFillCoronal(planeHu, getSlice, setSlice, cols, rows, numSlices, yIdx, su, sv, huTolerance, value = 1) {
  const y = Math.max(0, Math.min(rows - 1, Math.round(yIdx)));
  const planeMask = new Uint8Array(cols * numSlices);
  const n = floodFillHU(planeHu, planeMask, cols, numSlices, Math.floor(su), Math.floor(sv), huTolerance, 1);
  if (n === 0) return 0;
  for (let k = 0; k < numSlices; k++) {
    const mask = getSlice(k);
    if (!mask) continue;
    let touched = false;
    for (let u = 0; u < cols; u++) {
      if (!planeMask[k * cols + u]) continue;
      const idx = y * cols + u;
      if (mask[idx] !== value) { mask[idx] = value; touched = true; }
    }
    if (touched && setSlice) setSlice(k, mask);
  }
  return n;
}

/** Flood fill on a SAGITTAL plane (planeHu width=rows, height=numSlices). */
export function floodFillSagittal(planeHu, getSlice, setSlice, cols, rows, numSlices, xIdx, su, sv, huTolerance, value = 1) {
  const x = Math.max(0, Math.min(cols - 1, Math.round(xIdx)));
  const planeMask = new Uint8Array(rows * numSlices);
  const n = floodFillHU(planeHu, planeMask, rows, numSlices, Math.floor(su), Math.floor(sv), huTolerance, 1);
  if (n === 0) return 0;
  for (let k = 0; k < numSlices; k++) {
    const mask = getSlice(k);
    if (!mask) continue;
    let touched = false;
    for (let j = 0; j < rows; j++) {
      if (!planeMask[k * rows + j]) continue;
      const idx = j * cols + x;
      if (mask[idx] !== value) { mask[idx] = value; touched = true; }
    }
    if (touched && setSlice) setSlice(k, mask);
  }
  return n;
}
