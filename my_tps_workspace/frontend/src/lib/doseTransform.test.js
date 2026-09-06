import { describe, it, expect } from 'vitest';
import {
  doseFrameIndexForZ,
  doseVoxelToPatient,
  computeDoseCanvasTransform,
  projectWorldToCanvas,
  applyAffineTransform,
  applyColormapLUT,
  extractIsolineSegments,
  DEFAULT_ISODOSE_LEVELS,
  ISODOSE_PALETTE,
} from './doseTransform.js';

// Geometry mirroring the real test RD file (Varian, HFS axial):
// IPP (-227.54, -310.03, -1060.3), 2.5mm in-plane, 3mm frames, 94x182x87
const GEOM = {
  imagePosition: { x: -227.5364719, y: -310.0257677, z: -1060.3 },
  imageOrientation: {
    x: [1, 0, 0],
    y: [0, 1, 0],
    z: [0, 0, 1],
  },
  pixelSpacing: { i: 2.5, j: 2.5 },
  gridFrameOffsetVector: Array.from({ length: 87 }, (_, k) => k * 3),
  _cols: 182,
  _rows: 94,
};

describe('doseFrameIndexForZ', () => {
  it('returns the exact frame for a z on a dose plane', () => {
    // frame 5 z = -1060.3 + 15 = -1045.3
    expect(doseFrameIndexForZ(GEOM.gridFrameOffsetVector, GEOM.imagePosition.z, -1045.3)).toBe(5);
  });

  it('returns the nearest frame between planes', () => {
    // z = -1044.4 is closer to frame 5 (-1045.3) than frame 6 (-1042.3)
    expect(doseFrameIndexForZ(GEOM.gridFrameOffsetVector, GEOM.imagePosition.z, -1044.4)).toBe(5);
  });

  it('returns null outside the dose z range', () => {
    const below = GEOM.imagePosition.z - 10;
    const above = GEOM.imagePosition.z + 87 * 3 + 10;
    expect(doseFrameIndexForZ(GEOM.gridFrameOffsetVector, GEOM.imagePosition.z, below, 1.5)).toBeNull();
    expect(doseFrameIndexForZ(GEOM.gridFrameOffsetVector, GEOM.imagePosition.z, above, 1.5)).toBeNull();
  });

  it('returns null for empty/absent GFOV', () => {
    expect(doseFrameIndexForZ([], 0, 0)).toBeNull();
    expect(doseFrameIndexForZ(null, 0, 0)).toBeNull();
  });
});

describe('doseVoxelToPatient', () => {
  it('maps the grid origin to IPP', () => {
    const p = doseVoxelToPatient(0, 0, 0, GEOM);
    expect(p[0]).toBeCloseTo(GEOM.imagePosition.x, 6);
    expect(p[1]).toBeCloseTo(GEOM.imagePosition.y, 6);
    expect(p[2]).toBeCloseTo(GEOM.imagePosition.z, 6);
  });

  it('applies column spacing along x for i', () => {
    const p = doseVoxelToPatient(10, 0, 0, GEOM);
    expect(p[0]).toBeCloseTo(GEOM.imagePosition.x + 25, 6);
    expect(p[1]).toBeCloseTo(GEOM.imagePosition.y, 6);
  });

  it('applies row spacing along y for j', () => {
    const p = doseVoxelToPatient(0, 4, 0, GEOM);
    expect(p[1]).toBeCloseTo(GEOM.imagePosition.y + 10, 6);
  });

  it('applies the frame offset along z for k', () => {
    const p = doseVoxelToPatient(0, 0, 20, GEOM);
    expect(p[2]).toBeCloseTo(GEOM.imagePosition.z + 60, 6);
  });
});

describe('computeDoseCanvasTransform', () => {
  // Minimal viewport double: parallel camera + canvas element, mirroring the
  // camera projection projectWorldToCanvas implements.
  const makeVp = (scale = 1, ox = 0, oy = 0) => {
    const cam = {
      focalPoint: [0, 0, 0],
      viewPlaneNormal: [0, 0, -1],
      viewUp: [0, 1, 0],
      parallelScale: 250 / scale,
    };
    return {
      getCamera: () => cam,
      element: {
        querySelector: () => ({
          clientWidth: 1000 + ox,
          clientHeight: 800 + oy,
        }),
      },
    };
  };

  it('solves an affine transform consistent with the camera projection at the corners', () => {
    const vp = makeVp();
    const t = computeDoseCanvasTransform(vp, GEOM, GEOM.imagePosition.z);
    expect(t).not.toBeNull();
    expect(t.cols).toBe(182);
    expect(t.rows).toBe(94);

    // Cross-check all three solved reference points through the projection
    const check = (i, j) => {
      const p = doseVoxelToPatient(i, j, 0, GEOM);
      p[2] = GEOM.imagePosition.z;
      const expected = projectWorldToCanvas(vp, p);
      const got = applyAffineTransform(t, i, j);
      expect(got.x).toBeCloseTo(expected.x, 6);
      expect(got.y).toBeCloseTo(expected.y, 6);
    };
    check(0, 0);
    check(182, 0);
    check(0, 94);
  });

  it('returns null when the CT z is outside the dose range', () => {
    const vp = makeVp();
    const far = GEOM.imagePosition.z + 87 * 3 + 50;
    expect(computeDoseCanvasTransform(vp, GEOM, far, 1.5)).toBeNull();
  });

  it('returns null for a viewport without getCamera', () => {
    expect(computeDoseCanvasTransform({}, GEOM, 0)).toBeNull();
    expect(computeDoseCanvasTransform(null, GEOM, 0)).toBeNull();
  });
});

describe('applyColormapLUT', () => {
  it('produces transparent pixels below the threshold', () => {
    const frame = new Float32Array([0, 10, 50]);
    const rgba = applyColormapLUT(frame, { maxDose: 100, thresholdPct: 20 });
    expect(rgba[3]).toBe(0);      // 0 < 20 → transparent
    expect(rgba[7]).toBe(0);      // 10 < 20 → transparent
    expect(rgba[11]).toBeGreaterThan(0); // 50 ≥ 20 → visible
  });

  it('ramps alpha and color up with dose', () => {
    const frame = new Float32Array([25, 100]);
    const rgba = applyColormapLUT(frame, { maxDose: 100, thresholdPct: 20 });
    const alphaLow = rgba[3];
    const alphaHigh = rgba[7];
    expect(alphaHigh).toBeGreaterThan(alphaLow);
    expect(alphaHigh).toBeLessThanOrEqual(255);
  });

  it('handles maxDose <= 0 gracefully', () => {
    const rgba = applyColormapLUT(new Float32Array([1, 2]), { maxDose: 0, thresholdPct: 20 });
    expect(rgba.every(v => v === 0)).toBe(true);
  });

  it('clamps values above maxDose', () => {
    const rgba = applyColormapLUT(new Float32Array([150]), { maxDose: 100, thresholdPct: 0 });
    expect(rgba[3]).toBe(255);
  });
});

describe('extractIsolineSegments (marching squares)', () => {
  // helper: build a frame from a value function
  const makeFrame = (cols, rows, fn) => {
    const f = new Float32Array(cols * rows);
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) f[j * cols + i] = fn(i, j);
    }
    return f;
  };

  it('returns empty arrays for trivial cases', () => {
    const flat0 = new Float32Array(10 * 10);
    const flatMax = new Float32Array(10 * 10).fill(100);
    expect(extractIsolineSegments(flat0, 10, 10, 50)).toEqual([]);
    expect(extractIsolineSegments(flatMax, 10, 10, 50)).toEqual([]);
    expect(extractIsolineSegments(new Float32Array(0), 10, 10, 50)).toEqual([]);
    expect(extractIsolineSegments(flat0, 1, 10, 50)).toEqual([]); // degenerate grid
  });

  it('vertical ramp produces segments at the interpolated x', () => {
    // value = column index (cols 0..9), rows = 3 (y spans 0..2, 2 cell rows)
    const frame = makeFrame(10, 3, (i) => i);
    const segs = extractIsolineSegments(frame, 10, 3, 5.5);
    expect(segs.length).toBe(2);
    for (const s of segs) {
      expect(s.x1).toBeCloseTo(5.5, 6);
      expect(s.x2).toBeCloseTo(5.5, 6);
    }
    // y endpoints span the full height [0, 2]
    const ys = segs.flatMap(s => [s.y1, s.y2]).sort((a, b) => a - b);
    expect(ys[0]).toBe(0);
    expect(ys[ys.length - 1]).toBe(2);
  });

  it('single peak produces a closed-ish ring around the peak', () => {
    const cols = 40, rows = 40;
    const frame = makeFrame(cols, rows, (i, j) => {
      const d = Math.hypot(i - 20, j - 20);
      return Math.max(0, 100 - d * 10);
    });
    const segs = extractIsolineSegments(frame, cols, rows, 50);
    expect(segs.length).toBeGreaterThan(0);

    // Every endpoint's neighbouring corner values must straddle the level:
    // endpoints lie on cell edges, so the two adjacent corners bracket it.
    // (weaker but robust check: endpoints are inside grid bounds)
    for (const s of segs) {
      for (const p of [[s.x1, s.y1], [s.x2, s.y2]]) {
        expect(p[0]).toBeGreaterThanOrEqual(0);
        expect(p[0]).toBeLessThanOrEqual(cols);
        expect(p[1]).toBeGreaterThanOrEqual(0);
        expect(p[1]).toBeLessThanOrEqual(rows);
      }
    }

    // The ring's bounding box must enclose the peak (20, 20)
    const xs = segs.flatMap(s => [s.x1, s.x2]);
    const ys = segs.flatMap(s => [s.y1, s.y2]);
    expect(Math.min(...xs)).toBeLessThan(20);
    expect(Math.max(...xs)).toBeGreaterThan(20);
    expect(Math.min(...ys)).toBeLessThan(20);
    expect(Math.max(...ys)).toBeGreaterThan(20);

    // The ring must not extend beyond where dose hits 0 (distance 10 → ring
    // radius ~5 at level 50)
    for (const x of xs) {
      expect(x).toBeGreaterThan(20 - 8);
      expect(x).toBeLessThan(20 + 8);
    }
  });

  it('every segment edge straddles the level (interpolation invariant)', () => {
    const cols = 20, rows = 20;
    // level 27 avoids corners exactly on the iso value (√27 is irrational)
    const frame = makeFrame(cols, rows, (i, j) => (i - 10) ** 2 + (j - 10) ** 2);
    const level = 27;
    const segs = extractIsolineSegments(frame, cols, rows, level);
    expect(segs.length).toBeGreaterThan(0);
    // Each segment lies on a cell edge whose two corner values bracket level.
    // Reconstruct corner values by nearest lookup and verify bracketing.
    for (const s of segs) {
      const vals = [];
      for (const p of [[s.x1, s.y1], [s.x2, s.y2]]) {
        // the point is on an edge between two integer corners; test both
        const i0 = Math.floor(p[0]), j0 = Math.floor(p[1]);
        const i1 = Math.min(cols - 1, i0 + 1), j1 = Math.min(rows - 1, j0 + 1);
        vals.push(frame[j0 * cols + i0], frame[j0 * cols + i1], frame[j1 * cols + i0], frame[j1 * cols + i1]);
      }
      // at least one corner below and one above (or exactly at) the level
      const below = vals.some(v => v < level);
      const above = vals.some(v => v >= level);
      expect(below && above).toBe(true);
    }
  });

  it('two peaks produce segments near each peak', () => {
    const cols = 60, rows = 40;
    const frame = makeFrame(cols, rows, (i, j) => {
      const d1 = Math.hypot(i - 15, j - 20);
      const d2 = Math.hypot(i - 45, j - 20);
      return Math.max(Math.max(0, 100 - d1 * 10), Math.max(0, 100 - d2 * 10));
    });
    const segs = extractIsolineSegments(frame, cols, rows, 50);
    expect(segs.length).toBeGreaterThan(0);
    const near = (cx) => segs.some(s => [s.x1, s.x2].some(x => Math.abs(x - cx) < 8));
    expect(near(15)).toBe(true);
    expect(near(45)).toBe(true);
  });

  it('level above frame max / below frame min yields no segments', () => {
    const frame = makeFrame(10, 10, (i, j) => 50);
    expect(extractIsolineSegments(frame, 10, 10, 60)).toEqual([]);
    expect(extractIsolineSegments(frame, 10, 10, 40)).toEqual([]);
  });
});

describe('DEFAULT_ISODOSE_LEVELS', () => {
  it('provides 5 sensible default levels with palette colors', () => {
    expect(DEFAULT_ISODOSE_LEVELS).toHaveLength(5);
    const pcts = DEFAULT_ISODOSE_LEVELS.map(l => l.pct);
    expect(pcts).toEqual([95, 90, 70, 50, 30]);
    for (const l of DEFAULT_ISODOSE_LEVELS) {
      expect(l.visible).toBe(true);
      expect(ISODOSE_PALETTE).toContain(l.color);
    }
  });
});
