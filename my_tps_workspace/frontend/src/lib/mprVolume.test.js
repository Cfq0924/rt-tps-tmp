import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@cornerstonejs/core', () => ({
  imageLoader: { loadAndCacheImage: vi.fn() },
}));

import {
  loadVolume,
  sampleCoronal,
  sampleSagittal,
  huToRGBA,
  doseToRGBA,
  zExtentMm,
  sliceSpacing,
  voiToWL,
} from './mprVolume.js';

// synthetic 4-slice, 3-row, 5-col volume:
// HU value = 1000*z + 10*y + x  (each voxel value is unique and decodable)
const COLS = 5, ROWS = 3, SLICES = 4;
const volume = new Int16Array(SLICES * ROWS * COLS);
for (let z = 0; z < SLICES; z++)
  for (let y = 0; y < ROWS; y++)
    for (let x = 0; x < COLS; x++)
      volume[(z * ROWS + y) * COLS + x] = 1000 * z + 10 * y + x;

const geom = {
  cols: COLS, rows: ROWS, numSlices: SLICES,
  spacingX: 1, spacingY: 2,
  originX: 0, originY: 0,
  zPositions: [-90, -88, -86, -84],
};

describe('sampleCoronal', () => {
  // 3-slice slab average: interior rows return the centre value for this
  // linear-in-z phantom; edge rows average the clamped neighbour.
  it('extracts the y-plane with decodable values', () => {
    const { pixels, width, height } = sampleCoronal(volume, geom, 1);
    expect(width).toBe(COLS);
    expect(height).toBe(SLICES);
    // row k=2 (slice 2), col x=4 → 2000 + 10 + 4
    expect(pixels[2 * COLS + 4]).toBe(2014);
    // row k=0 (edge: (2·v[0] + v[1])/3), col x=0 → (2·10 + 1010)/3
    expect(pixels[0]).toBeCloseTo(343.33, 1);
  });

  it('clamps the plane index', () => {
    const { pixels } = sampleCoronal(volume, geom, 99);
    expect(pixels[0]).toBeCloseTo(353.33, 1); // yIdx clamped to row 2, edge row
    expect(pixels[2 * COLS]).toBe(2020);      // interior row k=2, col x=0
  });
});

describe('sampleSagittal', () => {
  it('extracts the x-plane with decodable values', () => {
    const { pixels, width, height } = sampleSagittal(volume, geom, 4);
    expect(width).toBe(ROWS);
    expect(height).toBe(SLICES);
    // row k=3 (last slice, edge: (v[2] + 2·v[3])/3), col j=2 → (2024 + 2·3024)/3
    expect(pixels[3 * ROWS + 2]).toBeCloseTo(2690.67, 1);
    // row k=0 (edge: (2·v[0] + v[1])/3), col j=0 → (2·4 + 1004)/3
    expect(pixels[0]).toBeCloseTo(337.33, 1);
  });
});

describe('huToRGBA', () => {
  it('maps window range to gray levels', () => {
    const hu = Float32Array.from([-1000, 0, 1000]);
    const rgba = huToRGBA(hu, 40, 400); // lo = -160
    expect(rgba[0]).toBe(0);                    // below window
    expect(rgba[4]).toBe(Math.round((0 + 160) * 255 / 400));
    expect(rgba[8]).toBe(255);                  // above window
    expect(rgba[3]).toBe(255);                  // opaque
  });
});

describe('doseToRGBA', () => {
  it('alpha ramps with dose and global opacity', () => {
    const dose = Float32Array.from([0, 50, 100]);
    const rgba = doseToRGBA(dose, 100, 0.5);
    expect(rgba[3]).toBe(0);                                   // zero dose → transparent
    expect(rgba[7]).toBe(Math.round(0.5 * 255 * 0.5));         // half
    expect(rgba[11]).toBe(Math.round(255 * 0.5));              // full, half opacity
    expect(rgba[8]).toBeGreaterThan(200);                      // near-white at full dose
  });
});

describe('voiToWL', () => {
  it('normalizes number VOIs', () => {
    expect(voiToWL({ windowCenter: 40, windowWidth: 400 })).toEqual({ wc: 40, ww: 400 });
  });

  it('averages {lower, upper} range VOIs', () => {
    expect(voiToWL({ windowCenter: { lower: 30, upper: 50 }, windowWidth: { lower: 380, upper: 420 } }))
      .toEqual({ wc: 40, ww: 400 });
  });

  it('rejects unusable VOIs', () => {
    expect(voiToWL(undefined)).toBeNull();
    expect(voiToWL({})).toBeNull();
    expect(voiToWL({ windowCenter: 40 })).toBeNull();
    expect(voiToWL({ windowCenter: 40, windowWidth: 0 })).toBeNull();
    expect(voiToWL({ windowCenter: '40', windowWidth: 400 })).toBeNull();
  });
});

describe('loadVolume', () => {
  it('loads slices through the image loader into the volume', async () => {
    const { imageLoader } = await import('@cornerstonejs/core');
    const slices = [
      new Int16Array(15).fill(1),
      new Int16Array(15).fill(2),
    ];
    let n = 0;
    imageLoader.loadAndCacheImage.mockImplementation(async () => {
      const hu = slices[n++];
      return { getPixelData: () => hu, slope: 1, intercept: 0 };
    });
    const files = [
      { id: 1, columns: COLS, rows: ROWS, pixel_spacing_x: 2, pixel_spacing_y: 1, image_position_x: 0, image_position_y: 0, image_position_z: -10 },
      { id: 2, columns: COLS, rows: ROWS, pixel_spacing_x: 2, pixel_spacing_y: 1, image_position_x: 0, image_position_y: 0, image_position_z: -8 },
    ];
    const progress = vi.fn();
    const { volume, geom } = await loadVolume({
      imageIds: ['a', 'b'],
      files,
      getSignedUrl: async (id) => `url-${id}`,
      onProgress: progress,
    });
    expect(progress).toHaveBeenCalledWith(2, 2);
    expect(geom.numSlices).toBe(2);
    expect(geom.spacingY).toBe(2);
    expect(volume[0]).toBe(1);          // slice 0 filled with 1
    expect(volume[15]).toBe(2); // slice 1 filled with 2     // slice 1 filled with 2
    expect(zExtentMm(geom)).toBeCloseTo(4);
    expect(sliceSpacing(geom)).toBeCloseTo(2);
  });

  it('does not re-apply rescale to loader-pre-scaled pixel data', async () => {
    const { imageLoader } = await import('@cornerstonejs/core');
    // CS3D preScale: pixel data is already HU (air −1000), yet slope/intercept
    // metadata still carry the DICOM tags
    imageLoader.loadAndCacheImage.mockImplementation(async () => ({
      getPixelData: () => new Int16Array(15).fill(-1000),
      slope: 1,
      intercept: -1000,
      preScale: { enabled: true, scaled: true, scalingParameters: { rescaleSlope: 1, rescaleIntercept: -1000, modality: 'CT' } },
    }));
    const files = [
      { id: 1, columns: COLS, rows: ROWS, pixel_spacing_x: 1, pixel_spacing_y: 1, image_position_x: 0, image_position_y: 0, image_position_z: -10 },
    ];
    const { volume } = await loadVolume({
      imageIds: ['a'],
      files,
      getSignedUrl: async (id) => `url-${id}`,
    });
    expect(volume[0]).toBe(-1000); // stays air −1000, not −2000
  });
});
