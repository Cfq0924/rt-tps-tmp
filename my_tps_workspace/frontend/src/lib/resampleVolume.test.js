import { describe, it, expect } from 'vitest';
import {
  invert4,
  applyMatrix4,
  resampleRigid,
  geomFromFiles,
  patientToVoxelMpr,
} from './resampleVolume.js';
import { identity4, axialTransform } from './registrationMath.js';

function makeGeom({ cols = 32, rows = 32, numSlices = 8, spacing = 2, originX = -32, originY = -32, z0 = -100, dz = 2 } = {}) {
  return {
    cols, rows, numSlices,
    spacingX: spacing, spacingY: spacing,
    originX, originY,
    zPositions: Array.from({ length: numSlices }, (_, k) => z0 + k * dz),
  };
}

/** Sphere of value 100 centred at voxel (cx, cy, cz), else -1000. */
function sphereVolume(geom, cx, cy, cz, r = 5) {
  const v = new Int16Array(geom.cols * geom.rows * geom.numSlices).fill(-1000);
  for (let k = 0; k < geom.numSlices; k++) {
    for (let j = 0; j < geom.rows; j++) {
      for (let i = 0; i < geom.cols; i++) {
        const d2 = (i - cx) ** 2 + (j - cy) ** 2 + ((k - cz) * 1) ** 2;
        if (d2 <= r * r) v[(k * geom.rows + j) * geom.cols + i] = 100;
      }
    }
  }
  return v;
}

function centroidOf(volume, geom, threshold = 0) {
  let sx = 0, sy = 0, sk = 0, n = 0;
  for (let k = 0; k < geom.numSlices; k++) {
    for (let j = 0; j < geom.rows; j++) {
      for (let i = 0; i < geom.cols; i++) {
        if (volume[(k * geom.rows + j) * geom.cols + i] > threshold) {
          sx += i; sy += j; sk += k; n++;
        }
      }
    }
  }
  return n ? { x: sx / n, y: sy / n, k: sk / n, n } : null;
}

describe('invert4', () => {
  it('inverts a rigid axial transform', () => {
    const m = axialTransform(25, 12, -7, [0, 0]);
    const inv = invert4(m);
    const p = [10, 20, 30];
    const back = applyMatrix4(inv, applyMatrix4(m, p));
    back.forEach((v, i) => expect(Math.abs(v - p[i])).toBeLessThan(1e-9));
  });

  it('returns null for a singular matrix', () => {
    expect(invert4([[1, 0, 0, 0], [2, 0, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1]])).toBeNull();
  });
});

describe('resampleRigid', () => {
  it('identity matrix reproduces the source exactly', () => {
    const geom = makeGeom();
    const vol = sphereVolume(geom, 16, 16, 4);
    const out = resampleRigid({ srcVolume: vol, srcGeom: geom, dstGeom: geom, matrix: identity4() });
    let maxDiff = 0;
    for (let i = 0; i < vol.length; i++) maxDiff = Math.max(maxDiff, Math.abs(vol[i] - out[i]));
    expect(maxDiff).toBe(0);
  });

  it('pure translation: resampled sphere centroid lands within 0.5 voxel', () => {
    const geom = makeGeom({ numSlices: 16 });
    const cx = 20, cy = 12, cz = 8;
    const vol = sphereVolume(geom, cx, cy, cz, 4);
    // object in the moving volume sits 3 voxels right, 1 up (patient +y) and
    // one slice lower vs the fixed frame — matrix undoes that shift
    const vx = geom.spacingX, vy = geom.spacingY, vz = 2;
    const translation = [
      [1, 0, 0, -3 * vx],
      [0, 1, 0, 1 * vy],
      [0, 0, 1, 1 * vz],
      [0, 0, 0, 1],
    ];
    const out = resampleRigid({ srcVolume: vol, srcGeom: geom, dstGeom: geom, matrix: translation });
    const c0 = centroidOf(vol, geom);
    const c1 = centroidOf(out, geom);
    expect(c1).not.toBeNull();
    // the object must land where the matrix maps it: (−3, +1, +1) voxels
    expect(Math.abs(c1.x - (c0.x - 3))).toBeLessThan(0.5);
    expect(Math.abs(c1.y - (c0.y + 1))).toBeLessThan(0.5);
    expect(Math.abs(c1.k - (c0.k + 1))).toBeLessThan(0.5);
  });

  it('resampling onto a shifted grid keeps interior values (grid change, identity matrix)', () => {
    const srcGeom = makeGeom();
    const vol = sphereVolume(srcGeom, 16, 16, 4);
    // destination grid shifted +3 voxels along x, same spacing/extension
    const dstGeom = { ...makeGeom(), originX: srcGeom.originX + 3 * srcGeom.spacingX };
    const out = resampleRigid({ srcVolume: vol, srcGeom, dstGeom, matrix: identity4() });
    // centre patient point of the sphere: sample must stay ≈ 100
    const ci = Math.round((srcGeom.originX + 16 * srcGeom.spacingX - dstGeom.originX) / dstGeom.spacingX);
    const centre = out[(4 * dstGeom.rows + 16) * dstGeom.cols + ci];
    expect(centre).toBeGreaterThan(90);
  });

  it('fills voxels outside the source with the fill value', () => {
    const srcGeom = makeGeom({ numSlices: 4 });
    const dstGeom = makeGeom({ numSlices: 10, z0: srcGeom.zPositions[0] + 100 });
    const vol = new Int16Array(srcGeom.cols * srcGeom.rows * srcGeom.numSlices).fill(5);
    const out = resampleRigid({ srcVolume: vol, srcGeom, dstGeom, matrix: identity4(), fillValue: -1000 });
    expect([...out].every(v => v === -1000)).toBe(true);
  });
});

describe('patientToVoxelMpr', () => {
  it('handles descending slice order (CT instance order)', () => {
    const geom = makeGeom({ z0: -80, dz: -2 }); // descending z
    const { k } = patientToVoxelMpr(geom, [0, 0, -86]);
    expect(k).toBeCloseTo(3, 6);
  });

  it('interpolates fractional k between slices', () => {
    const geom = makeGeom({ z0: -100, dz: 2 });
    expect(patientToVoxelMpr(geom, [0, 0, -99]).k).toBeCloseTo(0.5, 6);
  });
});

describe('geomFromFiles', () => {
  it('maps dicom_files rows onto the volume geometry', () => {
    const files = [
      { columns: 64, rows: 64, pixel_spacing_y: 1.5, pixel_spacing_x: 1.5, image_position_x: -48, image_position_y: -48, image_position_z: -10 },
      { image_position_z: -8 },
    ];
    const g = geomFromFiles(files);
    expect(g).toMatchObject({ cols: 64, rows: 64, numSlices: 2, spacingX: 1.5, originX: -48 });
    expect(g.zPositions).toEqual([-10, -8]);
  });
});
