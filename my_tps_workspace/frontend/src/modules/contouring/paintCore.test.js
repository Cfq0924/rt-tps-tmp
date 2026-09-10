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
  floodFillHU,
  booleanOp,
  expandMask3D,
  keepLargestComponent,
  autoBodyMask,
  imageToHU,
  labelComponents4,
  cleanupSmallComponents,
  dilateMask,
  erodeMask,
  cropMask,
  extractWallMask,
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


describe('floodFillHU', () => {
  it('fills a connected region of similar HU', () => {
    const ct = new Int16Array(100).fill(-1000);
    // an air pocket atHU 0
    [12, 13, 14, 22, 23, 24, 32, 33, 34].forEach(i => ct[i] = 0);
    const mask = new Uint8Array(100);
    const n = floodFillHU(ct, mask, 10, 10, 2, 1, 50, 1);
    expect(n).toBe(9);
    expect(mask[13]).toBe(1);
    expect(mask[0]).toBe(0);
  });

  it('stops at an intensity wall (HU tolerance)', () => {
    const ct = new Int16Array(100).fill(-1000);
    // zero-HU wall down column 3: fill from the left cannot cross it
    for (let j = 0; j < 10; j++) ct[j * 10 + 3] = 0;
    const mask = new Uint8Array(100);
    const n = floodFillHU(ct, mask, 10, 10, 1, 1, 50, 1);
    // left region: columns 0-2 → 30 voxels
    expect(n).toBe(30);
    expect(mask[1]).toBe(1);
    expect(mask[5]).toBe(0); // right of the wall stays unfilled
  });
});

describe('booleanOp', () => {
  it('union / subtract / intersect', () => {
    const a = new Uint8Array(10), b = new Uint8Array(10);
    [0, 1, 2, 3].forEach(i => a[i] = 1);
    [2, 3, 4].forEach(i => b[i] = 1);
    const u = a.slice(); booleanOp(u, b, 'union');
    expect([...u].filter(Boolean).length).toBe(5);
    const s = a.slice(); booleanOp(s, b, 'subtract');
    expect([s[0], s[1], s[2], s[3]]).toEqual([1, 1, 0, 0]);
    const x = a.slice(); booleanOp(x, b, 'intersect');
    expect([x[2], x[3]]).toEqual([1, 1]);
    expect([x[0], x[4]]).toEqual([0, 0]);
  });
});

describe('expandMask3D', () => {
  it('dilates in-plane and propagates to neighbor slices', () => {
    const cols = 10, rows = 10;
    const slice = new Uint8Array(100);
    slice[5 * cols + 5] = 1;
    const slices = { '-1': new Uint8Array(100), '0': slice, '1': new Uint8Array(100) };
    expandMask3D(
      slice, cols, rows, 2, 1,
      (dz) => slices[dz] ?? null,
      (dz, m) => { slices[dz] = m; }
    );
    // in-plane dilation radius 2 around (5,5)
    expect(slice[5 * cols + 7]).toBe(1);
    expect(slice[3 * cols + 5]).toBe(1);
    expect(slice[5 * cols + 3]).toBe(1);
    // z propagation: neighbor slices got the dilated shape
    expect(slices['1'][5 * cols + 5]).toBe(1);
    expect(slices['-1'][5 * cols + 5]).toBe(1);
  });
});

describe('keepLargestComponent', () => {
  it('keeps only the largest connected blob', () => {
    const mask = new Uint8Array(100);
    [0, 1, 10, 11].forEach(i => mask[i] = 1);        // blob A: 4 voxels
    [55, 56, 57, 65, 66, 67, 75, 76, 77].forEach(i => mask[i] = 1); // blob B: 9
    const kept = keepLargestComponent(mask, 10, 10);
    expect(kept).toBe(9);
    expect(mask[0]).toBe(0);
    expect(mask[55]).toBe(1);
  });

  it('handles a single component', () => {
    const mask = new Uint8Array(100);
    [0, 1, 2].forEach(i => mask[i] = 1);
    keepLargestComponent(mask, 10, 10);
    expect(mask[0]).toBe(1);
  });
});

describe('autoBodyMask', () => {
  it('thresholds HU and keeps the patient body', () => {
    const ct = new Int16Array(100).fill(-1000); // air
    // body blob at HU 0
    [34, 35, 36, 44, 45, 46, 54, 55, 56].forEach(i => ct[i] = 0);
    // a separate high-density speck (bone fragment) — removed by largest CC
    ct[2] = 500;
    const mask = autoBodyMask(ct, 10, 10);
    expect(mask[45]).toBe(1);
    expect(mask[2]).toBe(0); // isolated speck dropped
    expect(mask[0]).toBe(0);
  });
});
describe('imageToHU', () => {
  it('applies rescale slope and intercept', () => {
    const stored = new Uint16Array([0, 1024, 2048]);
    const img = { getPixelData: () => stored, slope: 1, intercept: -1024 };
    const hu = imageToHU(img);
    expect(hu[0]).toBe(-1024); // air
    expect(hu[1]).toBe(0);     // water
    expect(hu[2]).toBe(1024);  // dense bone
  });

  it('defaults to slope 1 / intercept 0 when missing', () => {
    const img = { getPixelData: () => new Float32Array([7, -3]) };
    const hu = imageToHU(img);
    expect(hu[0]).toBe(7);
    expect(hu[1]).toBe(-3);
  });

  it('handles fractional slope', () => {
    const img = { getPixelData: () => new Uint16Array([100]), slope: 0.5, intercept: -1024 };
    expect(imageToHU(img)[0]).toBeCloseTo(-974);
  });
});

describe('labelComponents4 / cleanupSmallComponents', () => {
  it('labels two separate blobs', () => {
    const mask = new Uint8Array(100);
    [0, 1].forEach(i => mask[i] = 1);
    [55, 56, 57].forEach(i => mask[i] = 1);
    const { sizes } = labelComponents4(mask, 10, 10);
    expect(sizes.sort((a, b) => a - b)).toEqual([2, 3]);
  });

  it('removes components smaller than minAreaPx', () => {
    const mask = new Uint8Array(100);
    [0, 1].forEach(i => mask[i] = 1); // 2-voxel speck
    [55, 56, 57, 65, 66, 67].forEach(i => mask[i] = 1); // 6-voxel keep
    const stats = cleanupSmallComponents(mask, 10, 10, 4);
    expect(stats.removed).toBe(2);
    expect(stats.kept).toBe(6);
    expect(mask[0]).toBe(0);
    expect(mask[55]).toBe(1);
  });
});

describe('dilateMask / erodeMask', () => {
  it('dilate grows a single voxel into a diamond-ish disk', () => {
    const mask = new Uint8Array(25);
    mask[12] = 1; // (2,2)
    const out = dilateMask(mask, 5, 5, 1);
    expect(out[12]).toBe(1);
    expect(out[7]).toBe(1);  // (2,1)
    expect(out[17]).toBe(1); // (2,3)
    expect(out[11]).toBe(1); // (1,2)
    expect(out[13]).toBe(1); // (3,2)
    expect(out[0]).toBe(0);
  });

  it('erode shrinks a thick blob and empties a thin line', () => {
    const thick = new Uint8Array(100);
    for (let j = 3; j <= 6; j++) for (let i = 3; i <= 6; i++) thick[j * 10 + i] = 1;
    const eroded = erodeMask(thick, 10, 10, 1);
    expect(eroded[5 * 10 + 5]).toBe(1); // center survives
    expect(eroded[3 * 10 + 5]).toBe(0); // border gone

    const line = new Uint8Array(100);
    for (let i = 2; i <= 7; i++) line[5 * 10 + i] = 1;
    const lineE = erodeMask(line, 10, 10, 1);
    expect(lineE.some(v => v === 1)).toBe(false);
  });

  it('radius 0 is identity', () => {
    const mask = new Uint8Array([1, 0, 1]);
    expect([...erodeMask(mask, 3, 1, 0)]).toEqual([1, 0, 1]);
    expect([...dilateMask(mask, 3, 1, 0)]).toEqual([1, 0, 1]);
  });
});

describe('cropMask', () => {
  it('keepInside clears voxels outside the rect', () => {
    const mask = new Uint8Array(100).fill(1);
    const cleared = cropMask(mask, 10, 10, { x0: 2, y0: 2, x1: 7, y1: 7 }, 'keepInside');
    expect(mask[5 * 10 + 5]).toBe(1);
    expect(mask[0]).toBe(0);
    expect(mask[9 * 10 + 9]).toBe(0);
    expect(cleared).toBe(100 - 36);
  });

  it('keepOutside clears voxels inside the rect', () => {
    const mask = new Uint8Array(100).fill(1);
    cropMask(mask, 10, 10, { x0: 2, y0: 2, x1: 7, y1: 7 }, 'keepOutside');
    expect(mask[5 * 10 + 5]).toBe(0);
    expect(mask[0]).toBe(1);
  });

  it('normalizes reversed corners', () => {
    const mask = new Uint8Array(100).fill(1);
    cropMask(mask, 10, 10, { x0: 7, y0: 7, x1: 2, y1: 2 }, 'keepInside');
    expect(mask[5 * 10 + 5]).toBe(1);
    expect(mask[0]).toBe(0);
  });
});

describe('extractWallMask', () => {
  it('creates a ring: outer dilate minus inner erode', () => {
    const mask = new Uint8Array(100);
    for (let j = 4; j <= 5; j++) for (let i = 4; i <= 5; i++) mask[j * 10 + i] = 1;
    // 2×2 erode(r=1) is empty → wall collapses to the dilated outer shell
    const wall = extractWallMask(mask, 10, 10, 1, 1);
    expect(wall[5 * 10 + 5]).toBe(1); // original core still in dilate
    expect(wall[3 * 10 + 5]).toBe(1); // outer rim
    expect(wall[0]).toBe(0);
  });

  it('hollows a solid disk when inner radius is large enough', () => {
    const cols = 15, rows = 15;
    const mask = new Uint8Array(cols * rows);
    for (let j = 3; j <= 11; j++) {
      for (let i = 3; i <= 11; i++) {
        const dx = i - 7, dy = j - 7;
        if (dx * dx + dy * dy <= 16) mask[j * cols + i] = 1;
      }
    }
    const wall = extractWallMask(mask, cols, rows, 1, 3);
    // center should be hollow
    expect(wall[7 * cols + 7]).toBe(0);
    // rim should remain
    expect(wall[7 * cols + 3]).toBe(1);
  });
});
