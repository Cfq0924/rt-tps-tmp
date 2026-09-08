import { describe, it, expect } from 'vitest';
import {
  patientToVoxel,
  trilinearSample,
  findGlobalMax,
  voxelToPatient,
} from './doseSampling.js';

// Synthetic 3-frame 4x4 grid, spacing 2mm, frames at z-offsets 0/5/10.
// Voxel value = k*100 + j*10 + i so every hand-computed sample is unique.
const GEOM = {
  imagePosition: { x: 0, y: 0, z: 0 },
  imageOrientation: { x: [1, 0, 0], y: [0, 1, 0] },
  pixelSpacing: { i: 2, j: 2 },
  gridFrameOffsetVector: [0, 5, 10],
  cols: 4,
  rows: 4,
};
const GRID = new Float32Array(3 * 4 * 4);
for (let k = 0; k < 3; k++) {
  for (let j = 0; j < 4; j++) {
    for (let i = 0; i < 4; i++) {
      GRID[k * 16 + j * 4 + i] = k * 100 + j * 10 + i;
    }
  }
}

describe('patientToVoxel', () => {
  it('maps a voxel centre to fractional indices', () => {
    // voxel (i=1, j=2) centre in patient mm = (2, 4)
    expect(patientToVoxel([2, 4, 0], GEOM)).toEqual({ i: 1, j: 2, k: 0 });
  });

  it('picks the nearest GFOV frame', () => {
    expect(patientToVoxel([0, 0, 9], GEOM).k).toBe(2);
    expect(patientToVoxel([0, 0, 2], GEOM).k).toBe(0);
  });
});

describe('trilinearSample', () => {
  it('returns the exact value at a voxel centre', () => {
    // voxel (i=2, j=1, k=0) → 0*100 + 1*10 + 2
    expect(trilinearSample(GRID, GEOM, [4, 2, 0])).toBeCloseTo(12);
  });

  it('interpolates between columns', () => {
    // halfway between voxel (0,0) and (1,0) on frame 0
    expect(trilinearSample(GRID, GEOM, [1, 0, 0])).toBeCloseTo(0.5);
  });

  it('interpolates between frames (k axis)', () => {
    // halfway between frame 0 (value 0) and frame 1 (value 100)
    expect(trilinearSample(GRID, GEOM, [0, 0, 2.5])).toBeCloseTo(50);
  });

  it('returns null outside the grid', () => {
    expect(trilinearSample(GRID, GEOM, [10, 10, 0])).toBeNull();
    expect(trilinearSample(GRID, GEOM, [-10, -10, 0])).toBeNull();
  });

  it('accepts doseMeta-style (columns) and overlay-style (_cols) geoms', () => {
    const metaStyle = { ...GEOM, columns: 4, rows: 4 };
    delete metaStyle.cols;
    const overlayStyle = { ...GEOM, _cols: 4, _rows: 4 };
    delete overlayStyle.cols;
    expect(trilinearSample(GRID, metaStyle, [4, 2, 0])).toBeCloseTo(12);
    expect(trilinearSample(GRID, overlayStyle, [4, 2, 0])).toBeCloseTo(12);
  });
});

describe('findGlobalMax', () => {
  it('finds the last voxel of the last frame', () => {
    // max = k2/j3/i3 = 233, flat index 3*16 + 3*4 + 3 = 47
    const { value, flatIndex } = findGlobalMax(GRID);
    expect(value).toBe(233);
    expect(flatIndex).toBe(47);
  });
});

describe('voxelToPatient', () => {
  it('decomposes a flat index to patient coordinates', () => {
    // flat 47 → k=2, j=3, i=3 → (6, 6, 10)
    expect(voxelToPatient(47, GEOM)).toEqual([6, 6, 10]);
  });

  it('round-trips through patientToVoxel', () => {
    const flat = 20; // k=1, j=1, i=0
    const p = voxelToPatient(flat, GEOM);
    const { i, j, k } = patientToVoxel(p, GEOM);
    expect(i).toBe(0);
    expect(j).toBe(1);
    expect(k).toBe(1);
  });
});
