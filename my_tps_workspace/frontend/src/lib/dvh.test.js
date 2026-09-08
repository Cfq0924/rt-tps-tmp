import { describe, it, expect } from 'vitest';
import {
  buildSopToIndex,
  buildCtToDoseFrame,
  collectStructureDose,
  computeDVH,
  doseStats,
  volumeAtDose,
} from './dvh.js';

// small synthetic setup: dose grid 4x4x3 frames, 2mm spacing, 1cGy/frame offset
const DOSE_GEOM = {
  imagePosition: { x: -4, y: -4, z: -30 },
  pixelSpacing: { i: 2, j: 2 },
  gridFrameOffsetVector: [0, 2, 4],
  columns: 4,
  rows: 4,
  _cols: 4,
  _rows: 4,
};

// CT slices at z = -30, -28, -26 (aligned with dose frames), 4x4 px @1mm
const CT_FILES = [
  { sop_instance_uid: 'ct1', image_position_z: -30 },
  { sop_instance_uid: 'ct2', image_position_z: -28 },
  { sop_instance_uid: 'ct3', image_position_z: -26 },
];

function makeGrid() {
  // value = 10 per frame index (frame0=10, frame1=20, frame2=30)
  const g = new Float32Array(4 * 4 * 3);
  for (let k = 0; k < 3; k++) g.fill((k + 1) * 10, k * 16, (k + 1) * 16);
  return g;
}

describe('buildCtToDoseFrame', () => {
  it('maps aligned CT z to dose frames', () => {
    const m = buildCtToDoseFrame(CT_FILES, DOSE_GEOM);
    expect(m).toEqual([0, 1, 2]);
  });

  it('returns null outside the dose range', () => {
    const files = [{ sop_instance_uid: 'x', image_position_z: -100 }];
    expect(buildCtToDoseFrame(files, DOSE_GEOM, 1)).toEqual([null]);
  });
});

describe('collectStructureDose', () => {
  it('collects dose values inside a rectangular contour', () => {
    const grid = makeGrid();
    // rectangle covering dose voxels (1,1)-(2,2) on ct1's plane:
    // patient x from -4+1*2=-2 to -4+3*2=2 ... use dose voxel centers ±1mm
    const structure = {
      slices: [{
        sopInstanceUID: 'ct1',
        contours: [[-3, -3, -30, 3, -3, -30, 3, 3, -30, -3, 3, -30]],
      }],
    };
    // raster stub: fill a fixed square at voxel (i,j) in 1..2 — the real
    // polygon rasterization is tested in paintCore; this tests collection
    const raster = (mask, cols, rows, polys, v) => {
      // polys are in dose-voxel space (patient→voxel converted by the lib)
      expect(polys[0].length % 2).toBe(0);
      for (let j = 1; j <= 2; j++) for (let i = 1; i <= 2; i++) mask[j * cols + i] = v;
    };
    const toPx = () => ({ i: 0, j: 0 }); // unused by this raster
    const r = collectStructureDose(structure, grid, DOSE_GEOM, CT_FILES, {}, raster, toPx);
    // 4 dose voxels on frame 0, all at 10 cGy
    expect(r.voxelCount).toBe(4);
    expect(r.voxelVolumeMm3).toBe(2 * 2 * 2);
    for (let i = 0; i < r.values.length; i++) expect(r.values[i]).toBe(10);
  });

  it('skips slices whose CT has no dose frame', () => {
    const grid = new Float32Array(48);
    const structure = {
      slices: [{ sopInstanceUID: 'nope', contours: [[-3, -3, 0, 3, -3, 0, 3, 3, 0]] }],
    };
    const r = collectStructureDose(structure, grid, DOSE_GEOM, CT_FILES, {}, () => {});
    expect(r.voxelCount).toBe(0);
  });
});

describe('computeDVH', () => {
  it('builds cumulative and differential histograms', () => {
    const values = [5, 15, 15, 25];
    const dvh = computeDVH(values, 10);
    // bins: [0-10):1, [10-20):2, [20-30):1
    expect(dvh.differential).toEqual([1, 2, 1]);
    // cumulative: >=0:4, >=10:3, >=20:1
    expect(dvh.cumulative).toEqual([4, 3, 1]);
    expect(dvh.totalCount).toBe(4);
  });

  it('handles empty input', () => {
    const dvh = computeDVH(new Float32Array(0), 10);
    expect(dvh.cumulative).toEqual([]);
    expect(dvh.totalCount).toBe(0);
  });
});

describe('doseStats / volumeAtDose', () => {
  it('computes mean/max/min', () => {
    const s = doseStats([10, 20, 30, 40]);
    expect(s.mean).toBe(25);
    expect(s.max).toBe(40);
    expect(s.min).toBe(10);
  });

  it('dX returns dose received by at least p% of volume', () => {
    const s = doseStats([10, 20, 30, 40, 50]);
    // D50 = median = 30 (minimum dose received by 50% of the voxels)
    expect(s.dX(0.5)).toBe(30);
    // D95 with 20 voxels [1..20] → D95 = 2 (at least 95% receive ≥2)
    expect(doseStats(Array.from({length: 20}, (_, i) => i + 1)).dX(0.95)).toBe(2);
  });

  it('volumeAtDose returns percentage', () => {
    expect(volumeAtDose([10, 20, 30, 40], 25)).toBe(50);
    expect(volumeAtDose([10, 20], 100)).toBe(0);
  });
});
