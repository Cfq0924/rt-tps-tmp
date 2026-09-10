import assert from 'node:assert/strict';
import {
  labelComponents4,
  cleanupSmallComponents,
  dilateMask,
  erodeMask,
  cropMask,
  extractWallMask,
  sampleCoronalMask,
  sampleSagittalMask,
  stampBrushCoronal,
  stampBrushSagittal,
  fillRectCoronal,
  cropCoronal,
  floodFillCoronal,
} from './paintCore.js';
import {
  STRUCTURE_DICTIONARY,
  ROI_TYPES,
  inferTypeFromName,
  findDictionaryEntry,
} from './structureDictionary.js';

// --- label / cleanup ---
{
  const mask = new Uint8Array(100);
  mask[0] = 1; mask[1] = 1;
  mask[55] = 1; mask[56] = 1; mask[57] = 1;
  const { sizes } = labelComponents4(mask, 10, 10);
  assert.deepEqual([...sizes].sort((a, b) => a - b), [2, 3]);
}

{
  const mask = new Uint8Array(100);
  mask[0] = 1; mask[1] = 1;
  [55, 56, 57, 65, 66, 67].forEach(i => mask[i] = 1);
  const stats = cleanupSmallComponents(mask, 10, 10, 4);
  assert.equal(stats.removed, 2);
  assert.equal(stats.kept, 6);
  assert.equal(mask[0], 0);
  assert.equal(mask[55], 1);
}

// --- dilate / erode ---
{
  const mask = new Uint8Array(25);
  mask[12] = 1;
  const out = dilateMask(mask, 5, 5, 1);
  assert.equal(out[12], 1);
  assert.equal(out[7], 1);
  assert.equal(out[17], 1);
  assert.equal(out[0], 0);
}

{
  const thick = new Uint8Array(100);
  for (let j = 3; j <= 6; j++) for (let i = 3; i <= 6; i++) thick[j * 10 + i] = 1;
  const eroded = erodeMask(thick, 10, 10, 1);
  assert.equal(eroded[5 * 10 + 5], 1);
  assert.equal(eroded[3 * 10 + 5], 0);

  const line = new Uint8Array(100);
  for (let i = 2; i <= 7; i++) line[5 * 10 + i] = 1;
  const lineE = erodeMask(line, 10, 10, 1);
  assert.equal(lineE.some(v => v === 1), false);
}

// --- crop ---
{
  const mask = new Uint8Array(100).fill(1);
  cropMask(mask, 10, 10, { x0: 2, y0: 2, x1: 7, y1: 7 }, 'keepInside');
  assert.equal(mask[5 * 10 + 5], 1);
  assert.equal(mask[0], 0);
}

{
  const mask = new Uint8Array(100).fill(1);
  cropMask(mask, 10, 10, { x0: 7, y0: 7, x1: 2, y1: 2 }, 'keepOutside');
  assert.equal(mask[5 * 10 + 5], 0);
  assert.equal(mask[0], 1);
}

// --- extract wall ---
{
  const cols = 15, rows = 15;
  const mask = new Uint8Array(cols * rows);
  for (let j = 3; j <= 11; j++) {
    for (let i = 3; i <= 11; i++) {
      const dx = i - 7, dy = j - 7;
      if (dx * dx + dy * dy <= 16) mask[j * cols + i] = 1;
    }
  }
  const wall = extractWallMask(mask, cols, rows, 1, 3);
  assert.equal(wall[7 * cols + 7], 0, 'center hollow');
  assert.equal(wall[7 * cols + 3], 1, 'rim kept');
}

// --- dictionary ---
{
  const names = STRUCTURE_DICTIONARY.map(e => e.name);
  for (const n of ['GTV', 'CTV', 'PTV', 'Body', 'SpinalCord', 'Lung_L', 'Heart']) {
    assert.ok(names.includes(n), `missing ${n}`);
  }
  for (const e of STRUCTURE_DICTIONARY) {
    assert.ok(ROI_TYPES.includes(e.type), `bad type ${e.type}`);
    assert.match(e.color, /^#[0-9a-fA-F]{6}$/);
  }
  assert.equal(inferTypeFromName('PTV_High'), 'PTV');
  assert.equal(inferTypeFromName('Body'), 'EXTERNAL');
  assert.equal(inferTypeFromName('SpinalCord_PRV03'), 'AVOIDANCE');
  assert.equal(findDictionaryEntry('Heart')?.type, 'ORGAN');
  assert.equal(findDictionaryEntry('heart'), null);
}

console.log('OK: paintCore post-process + structure dictionary assertions passed');

// --- multi-plane stamp / sample ---
{
  const cols = 8, rows = 8, numSlices = 4;
  const slices = Array.from({ length: numSlices }, () => new Uint8Array(cols * rows));
  const getSlice = (k) => slices[k];
  const setSlice = (k, m) => { slices[k] = m; };

  stampBrushCoronal(getSlice, setSlice, cols, rows, numSlices, 3, 2, 1, 1.2, 1);
  assert.equal(slices[1][3 * cols + 2], 1, 'coronal center');
  assert.equal(slices[0][3 * cols + 2], 1, 'coronal z-1');
  assert.equal(slices[1][3 * cols + 5], 0, 'coronal far x');

  const cor = sampleCoronalMask(getSlice, numSlices, cols, rows, 3);
  assert.equal(cor[1 * cols + 2], 1);

  stampBrushSagittal(getSlice, setSlice, cols, rows, numSlices, 4, 5, 2, 1.2, 1);
  assert.equal(slices[2][5 * cols + 4], 1, 'sagittal center');
  assert.equal(slices[2][5 * cols + 0], 0, 'sagittal far');

  const sag = sampleSagittalMask(getSlice, numSlices, cols, rows, 4);
  assert.equal(sag[2 * rows + 5], 1);
}

console.log('OK: multi-plane stamp/sample assertions passed');

// --- multi-plane rect / crop / flood ---
{
  const cols = 10, rows = 10, numSlices = 5;
  const slices = Array.from({ length: numSlices }, () => new Uint8Array(cols * rows));
  const getSlice = (k) => slices[k];
  const setSlice = (k, m) => { slices[k] = m; };

  fillRectCoronal(getSlice, setSlice, cols, rows, numSlices, 4, { u0: 2, v0: 1, u1: 5, v1: 3 }, 1);
  assert.equal(slices[2][4 * cols + 3], 1, 'rect coronal fill');
  assert.equal(slices[2][4 * cols + 8], 0, 'rect outside');
  assert.equal(slices[0][4 * cols + 3], 0, 'rect v below');

  const cleared = cropCoronal(getSlice, setSlice, cols, rows, numSlices, 4,
    { u0: 2, v0: 1, u1: 5, v1: 3 }, 'keepOutside');
  assert.ok(cleared > 0, 'crop cleared some');
  assert.equal(slices[2][4 * cols + 3], 0, 'crop inside cleared');

  // flood on coronal plane: two HU regions
  const planeHu = new Float32Array(cols * numSlices).fill(-1000);
  for (let k = 1; k <= 2; k++) for (let u = 1; u <= 3; u++) planeHu[k * cols + u] = 0;
  const n = floodFillCoronal(planeHu, getSlice, setSlice, cols, rows, numSlices, 4, 2, 1, 50, 1);
  assert.equal(n, 6, 'flood filled 2x3 region');
  assert.equal(slices[1][4 * cols + 2], 1, 'flood wrote to slice 1');
  assert.equal(slices[2][4 * cols + 3], 1, 'flood wrote to slice 2');
}

console.log('OK: multi-plane rect/crop/flood assertions passed');
