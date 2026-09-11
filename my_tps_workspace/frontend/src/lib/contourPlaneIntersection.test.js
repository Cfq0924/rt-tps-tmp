import { describe, it, expect } from 'vitest';
import { intersectPolygonPlane, structurePlaneSegments } from './contourPlaneIntersection.js';

// unit square in the z=5 plane
const SQUARE = [0, 0, 5, 4, 0, 5, 4, 4, 5, 0, 4, 5];

describe('intersectPolygonPlane', () => {
  it('triangle crossed by a plane yields one segment', () => {
    // right triangle A(0,0,5) B(6,0,5) C(0,6,5), plane y=5
    const tri = [0, 0, 5, 6, 0, 5, 0, 6, 5];
    const segs = intersectPolygonPlane(tri, 1, 5);
    expect(segs.length).toBe(1);
    // crossings at x=0 (edge CA) and x=1 (edge BC); endpoint order is arbitrary
    const xs = [segs[0].a[0], segs[0].b[0]].sort((p, q) => p - q);
    expect(xs[0]).toBeCloseTo(0, 6);
    expect(xs[1]).toBeCloseTo(1, 6);
    expect(segs[0].a[1]).toBe(5);
    expect(segs[0].a[2]).toBe(5);
  });

  it('square crossed by a sagittal plane yields a segment in y', () => {
    const segs = intersectPolygonPlane(SQUARE, 0, 2); // x=2
    expect(segs.length).toBe(1);
    // segment endpoints at y=0 and y=4 (z=5)
    const ys = [segs[0].a[1], segs[0].b[1]].sort();
    expect(ys[0]).toBeCloseTo(0, 6);
    expect(ys[1]).toBeCloseTo(4, 6);
  });

  it('polygon entirely on one side yields nothing', () => {
    expect(intersectPolygonPlane(SQUARE, 1, 10)).toEqual([]);
    expect(intersectPolygonPlane(SQUARE, 1, -5)).toEqual([]);
  });

  it('coplanar polygon returns its outline edges', () => {
    const segs = intersectPolygonPlane(SQUARE, 2, 5); // plane z=5 = polygon plane
    expect(segs.length).toBe(4);
  });

  it('plane through two vertices returns their shared edge', () => {
    // quad with an edge exactly on the plane y=6
    const quad = [0, 0, 5, 8, 0, 5, 8, 6, 5, 0, 6, 5];
    const segs = intersectPolygonPlane(quad, 1, 6);
    expect(segs.length).toBe(1);
    const pts = [segs[0].a, segs[0].b].map(p => `${p[0]},${p[1]}`).sort();
    expect(pts).toEqual(['0,6', '8,6']);
  });

  it('plane touching a single vertex yields no segment', () => {
    // triangle with apex exactly on the plane y=6: point contact only
    const tri = [0, 0, 5, 6, 0, 5, 0, 6, 5];
    expect(intersectPolygonPlane(tri, 1, 6)).toEqual([]);
  });
});

describe('structurePlaneSegments', () => {
  const geom = {
    originX: -60, originY: -60,
    spacingX: 1, spacingY: 1,
    zPositions: [-100, -98, -96], // ascending, 2 mm
  };

  const SQUARE_LOW = SQUARE.map((v, i) => (i % 3 === 2 ? -98 : v)); // z on a geom slice

  it('converts patient segments to coronal pane index space', () => {
    // square spans x 0..4, y 0..4 at z=-98; coronal pane at yIdx=61 → y=+1
    const segs = structurePlaneSegments([SQUARE_LOW], 'coronal', 61, geom);
    expect(segs.length).toBe(1);
    const [a, b] = [segs[0].a, segs[0].b];
    // u: patient x 0..4 → index (0-(-60))/1=60 .. 64; v: z=-98 → slice 1
    const us = [a[0], b[0]].sort((p, q) => p - q);
    expect(us[0]).toBeCloseTo(60, 6);
    expect(us[1]).toBeCloseTo(64, 6);
    expect(a[1]).toBeCloseTo(1, 6);
    expect(b[1]).toBeCloseTo(1, 6);
  });

  it('sagittal pane uses y as the in-plane axis', () => {
    const segs = structurePlaneSegments([SQUARE_LOW], 'sagittal', 62, geom); // x = -58
    expect(segs.length).toBe(1);
    const us = [segs[0].a[0], segs[0].b[0]].sort((p, q) => p - q);
    expect(us[0]).toBeCloseTo(60, 6); // patient y 0 → index 60
    expect(us[1]).toBeCloseTo(64, 6); // patient y 4 → index 64
  });
});
