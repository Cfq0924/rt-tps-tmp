import { describe, it, expect } from 'vitest';
import {
  stampBrush,
  stampLine,
  fillRect,
  fillEllipse,
  maskToPolygons,
  chainSegments,
  polygonsToMask,
  patientToImagePixel,
  imagePixelToPatient,
  createHistory,
  pushSnapshot,
  undo,
  redo,
} from './paintCore.js';

const COLS = 20;
const ROWS = 20;

describe('stampBrush / fill helpers', () => {
  it('fills a circle of the requested radius', () => {
    const mask = new Uint8Array(COLS * ROWS);
    stampBrush(mask, COLS, ROWS, 10, 10, 3, 1);
    let count = 0;
    for (let j = 7; j <= 13; j++) {
      for (let i = 7; i <= 13; i++) {
        const inside = (i - 10) ** 2 + (j - 10) ** 2 <= 9;
        expect(mask[j * COLS + i] === 1).toBe(inside);
        if (mask[j * COLS + i] === 1) count++;
      }
    }
    expect(count).toBeGreaterThan(20);
  });

  it('erases with value 0', () => {
    const mask = new Uint8Array(COLS * ROWS).fill(1);
    stampBrush(mask, COLS, ROWS, 10, 10, 3, 0);
    expect(mask[10 * COLS + 10]).toBe(0);
    expect(mask[0]).toBe(1); // outside brush untouched
  });

  it('stampLine interpolates stamps along the segment', () => {
    const mask = new Uint8Array(COLS * ROWS);
    stampLine(mask, COLS, ROWS, 2, 2, 16, 2, 1.5, 1);
    // endpoints painted
    expect(mask[2 * COLS + 2]).toBe(1);
    expect(mask[2 * COLS + 16]).toBe(1);
    // middle painted (no gaps)
    expect(mask[2 * COLS + 9]).toBe(1);
    // a row away from the stroke is not painted (radius 1.5 < 1px away)
    expect(mask[5 * COLS + 9]).toBe(0);
  });

  it('fillRect normalizes drag direction', () => {
    const mask = new Uint8Array(COLS * ROWS);
    fillRect(mask, COLS, ROWS, 15, 15, 5, 5, 1); // reversed corners
    expect(mask[5 * COLS + 5]).toBe(1);
    expect(mask[15 * COLS + 15]).toBe(1);
    expect(mask[10 * COLS + 10]).toBe(1);
    expect(mask[4 * COLS + 10]).toBe(0);
    expect(mask[16 * COLS + 10]).toBe(0);
  });

  it('fillEllipse fills an axis-aligned ellipse', () => {
    const mask = new Uint8Array(COLS * ROWS);
    fillEllipse(mask, COLS, ROWS, 4, 4, 16, 10, 1);
    expect(mask[7 * COLS + 10]).toBe(1);  // center
    expect(mask[7 * COLS + 4]).toBe(1);   // left tip (bbox corner, on curve)
    expect(mask[7 * COLS + 16]).toBe(1);  // right tip
    expect(mask[4 * COLS + 10]).toBe(1);  // top tip (on curve)
    expect(mask[3 * COLS + 10]).toBe(0);  // one above → outside
    expect(mask[11 * COLS + 10]).toBe(0); // one below → outside
  });
});

describe('mask ↔ polygon roundtrip', () => {
  it('filled rect → polygons → mask roundtrips (same filled area)', () => {
    const mask = new Uint8Array(COLS * ROWS);
    fillRect(mask, COLS, ROWS, 5, 5, 14, 12, 1);
    const polys = maskToPolygons(mask, COLS, ROWS, 1);
    expect(polys.length).toBe(1);
    expect(polys[0].length % 2).toBe(0);

    const remask = new Uint8Array(COLS * ROWS);
    polygonsToMask(remask, COLS, ROWS, polys, 1);
    for (let j = 0; j < ROWS; j++) {
      for (let i = 0; i < COLS; i++) {
        // marching squares interpolation shrinks the region by ~1px at the
        // border of the rectangle — compare interior + boundary tolerance
        const interior = i >= 6 && i <= 13 && j >= 6 && j <= 11;
        if (interior) {
          expect(remask[j * COLS + i]).toBe(1);
        }
      }
    }
    // border pixels excluded by interpolation are absent, but corners of the
    // original rect land exactly on grid points — check at least one corner
    expect(remask[5 * COLS + 5]).toBe(1);
    expect(remask[12 * COLS + 14]).toBe(1);
  });

  it('two separate blobs yield two polygons', () => {
    const mask = new Uint8Array(COLS * ROWS);
    fillRect(mask, COLS, ROWS, 2, 2, 6, 6, 1);
    fillRect(mask, COLS, ROWS, 12, 12, 16, 16, 1);
    const polys = maskToPolygons(mask, COLS, ROWS, 1);
    expect(polys.length).toBe(2);
  });
});

describe('chainSegments', () => {
  it('chains collinear segments into one polyline (keeping interior vertices)', () => {
    const segs = [
      { x1: 0, y1: 0, x2: 1, y2: 0 },
      { x1: 1, y1: 0, x2: 2, y2: 0 },
      { x1: 2, y1: 0, x2: 3, y2: 0 },
    ];
    const polys = chainSegments(segs);
    expect(polys.length).toBe(1);
    expect(polys[0]).toEqual([0, 0, 1, 0, 2, 0, 3, 0]);
  });

  it('keeps disjoint segments separate', () => {
    const segs = [
      { x1: 0, y1: 0, x2: 1, y2: 0 },
      { x1: 5, y1: 5, x2: 6, y2: 5 },
    ];
    expect(chainSegments(segs)).toHaveLength(2);
  });
});

describe('patient ↔ image pixel transforms', () => {
  const CT = {
    imagePosition: { x: -249.51171875, y: -446.51171875, z: -931.3 },
    imageOrientation: { x: [1, 0, 0], y: [0, 1, 0] },
    pixelSpacing: { i: 0.9765625, j: 0.9765625 },
  };

  it('roundtrips patient → image → patient', () => {
    const p0 = imagePixelToPatient(100.5, 200.25, CT.imagePosition.z, CT);
    const { i, j } = patientToImagePixel(p0, CT);
    expect(i).toBeCloseTo(100.5, 6);
    expect(j).toBeCloseTo(200.25, 6);
  });

  it('maps the grid origin to (0, 0)', () => {
    const { i, j } = patientToImagePixel(
      [CT.imagePosition.x, CT.imagePosition.y, CT.imagePosition.z], CT
    );
    expect(i).toBeCloseTo(0, 6);
    expect(j).toBeCloseTo(0, 6);
  });

  it('increasing i moves along +x with 0.9765625mm spacing', () => {
    const p = imagePixelToPatient(1, 0, CT.imagePosition.z, CT);
    expect(p[0] - CT.imagePosition.x).toBeCloseTo(0.9765625, 9);
  });
});

describe('undo/redo history', () => {
  it('undoes and redoes snapshots with depth limit', () => {
    const h = createHistory(3);
    let mask = new Uint8Array(100); // v0
    const get = () => mask;

    // edit 4 times, snapshotting before each stroke
    for (let v = 1; v <= 4; v++) {
      pushSnapshot(h, 0, mask);
      mask = new Uint8Array(100);
      mask[0] = v;
    }
    expect(h.past.length).toBe(3); // depth-limited

    // undo → back to v3
    const undone = undo(h, get);
    expect(undone.sliceIdx).toBe(0);
    expect(undone.data[0]).toBe(3);
    mask = undone.data;

    // redo → forward to v4
    const redone = redo(h, get);
    expect(redone.data[0]).toBe(4);
    mask = redone.data;

    // undo again → v3
    expect(undo(h, get).data[0]).toBe(3);
  });

  it('clears the redo stack on a new snapshot', () => {
    const h = createHistory(20);
    const cur = new Uint8Array(10).fill(1);
    pushSnapshot(h, 0, new Uint8Array(10));
    expect(undo(h, () => cur)).not.toBeNull();
    expect(h.future.length).toBe(1);
    pushSnapshot(h, 0, cur); // new edit after undo
    expect(h.future.length).toBe(0);
  });
});
