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
  for (const poly of polygons) {
    const n = poly.length / 2;
    if (n < 3) continue;
    // per-row scanline crossings
    const jMin = Math.max(0, Math.ceil(Math.min(...poly.filter((_, i) => i % 2 === 1))));
    const jMax = Math.min(rows - 1, Math.floor(Math.max(...poly.filter((_, i) => i % 2 === 1))));
    for (let j = jMin; j <= jMax; j++) {
      const yc = j; // sample at pixel center row
      const xs = [];
      for (let e = 0; e < n; e++) {
        const xa = poly[e * 2];
        const ya = poly[e * 2 + 1];
        const xb = poly[((e + 1) % n) * 2];
        const yb = poly[((e + 1) % n) * 2 + 1];
        if ((ya <= yc && yb > yc) || (yb <= yc && ya > yc)) {
          xs.push(xa + ((yc - ya) / (yb - ya)) * (xb - xa));
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
