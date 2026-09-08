import { describe, it, expect } from 'vitest';
import {
  identity4,
  multiply4,
  apply4,
  axialTransform,
  decomposeAxial,
  intensityCentroid,
} from './registrationMath.js';

describe('matrix basics', () => {
  it('identity applies unchanged', () => {
    expect(apply4(identity4(), [1.5, -2, 300])).toEqual([1.5, -2, 300]);
  });

  it('multiplies translation matrices', () => {
    const a = identity4(); a[0][3] = 5;
    const b = identity4(); b[0][3] = -2;
    const m = multiply4(a, b);
    expect(m[0][3]).toBeCloseTo(3);
    expect(apply4(m, [0, 0, 0])[0]).toBeCloseTo(3);
  });
});

describe('axialTransform', () => {
  it('translates', () => {
    const m = axialTransform(0, 10, -5);
    const p = apply4(m, [1, 2, 7]);
    expect(p[0]).toBeCloseTo(11);
    expect(p[1]).toBeCloseTo(-3);
    expect(p[2]).toBeCloseTo(7);
  });

  it('rotates 90° about the origin', () => {
    const m = axialTransform(90, 0, 0);
    const p = apply4(m, [1, 0, 0]);
    expect(p[0]).toBeCloseTo(0);
    expect(p[1]).toBeCloseTo(1);
  });

  it('rotates about a centre point and round-trips via decomposeAxial', () => {
    const centre = [100, -200];
    const m = axialTransform(12.5, 3, -4, centre);
    const { thetaDeg, tx, ty } = decomposeAxial(m, centre);
    expect(thetaDeg).toBeCloseTo(12.5);
    expect(tx).toBeCloseTo(3);
    expect(ty).toBeCloseTo(-4);
    // decomposed params rebuild the identical matrix
    const m2 = axialTransform(thetaDeg, tx, ty, centre);
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) expect(m2[r][c]).toBeCloseTo(m[r][c]);
    }
  });
});

describe('intensityCentroid', () => {
  const geom = {
    imagePosition: { x: 0, y: 0, z: -100 },
    pixelSpacing: { i: 2, j: 2 },
    cols: 4,
    rows: 4,
  };

  it('returns null when nothing passes the threshold', () => {
    const hu = new Float32Array(16).fill(-1000);
    expect(intensityCentroid(hu, geom, -100)).toBeNull();
  });

  it('returns the mean position of passing voxels', () => {
    const hu = new Float32Array(16).fill(-1000);
    // voxels (1,1) and (2,2) at tissue HU
    hu[1 * 4 + 1] = 0;
    hu[2 * 4 + 2] = 100;
    const c = intensityCentroid(hu, geom, -100);
    // mean i = 1.5 → x = 3mm, mean j = 1.5 → y = 3mm
    expect(c[0]).toBeCloseTo(3);
    expect(c[1]).toBeCloseTo(3);
    expect(c[2]).toBeCloseTo(-100);
  });
});
