/**
 * CPU-based MPR (multi-planar reformat) support.
 *
 * The CT volume is cached in the browser as Int16 HU (≈45 MB for
 * 87×512×512) and coronal/sagittal planes are resampled on demand —
 * sidestepping the cornerstone VolumeViewport GPU issue (WISSEN §9)
 * entirely with the same custom-canvas approach as the other overlays.
 *
 * Volume layout: Int16Array, frame-major [z][y][x] — index
 * (z * rows + y) * cols + x. Frames follow the CT file order (sorted by
 * instance number, same as imageIds).
 */

import { imageToHU } from '../modules/contouring/paintCore.js';
import * as cornerstone from '@cornerstonejs/core';

/**
 * Load the whole CT series into an Int16 HU volume.
 * @param {Object} params
 * @param {string[]} params.imageIds - wadouri imageIds (slice order)
 * @param {Function} params.getSignedUrl - async (fileId) => url
 * @param {Array} params.files - CT file rows (same order as imageIds)
 * @param {Function} [params.onProgress] - (loaded, total) => void
 * @returns {Promise<{volume: Int16Array, geom: Object}>}
 */
export async function loadVolume({ imageIds, files, getSignedUrl, onProgress }) {
  const numSlices = imageIds.length;
  const first = files[0] ?? {};
  const cols = Number(first.columns) || 512;
  const rows = Number(first.rows) || 512;
  const volume = new Int16Array(numSlices * rows * cols);
  const zPositions = new Float64Array(numSlices);

  for (let k = 0; k < numSlices; k++) {
    const url = await getSignedUrl(files[k].id);
    const image = await cornerstone.imageLoader.loadAndCacheImage(
      `wadouri:${window.location.origin}${url}`,
    );
    const hu = imageToHU(image);
    volume.set(hu, k * rows * cols);
    zPositions[k] = files[k].image_position_z ?? 0;
    onProgress?.(k + 1, numSlices);
  }

  const geom = {
    cols,
    rows,
    numSlices,
    spacingX: Number(first.pixel_spacing_y) || 1, // column spacing (mm)
    spacingY: Number(first.pixel_spacing_x) || 1, // row spacing (mm)
    originX: Number(first.image_position_x) || 0,
    originY: Number(first.image_position_y) || 0,
    zPositions: [...zPositions],
  };
  return { volume, geom };
}

/** Total z extent (mm) spanned by the slices. */
export function zExtentMm(geom) {
  const z = geom.zPositions;
  if (z.length < 2) return geom.numSlices * 1;
  return Math.abs(z[z.length - 1] - z[0]) + Math.abs(z[1] - z[0]);
}

/** Mean signed slice spacing (mm); negative for descending z order. */
export function sliceSpacing(geom) {
  const z = geom.zPositions;
  return z.length > 1 ? (z[z.length - 1] - z[0]) / (z.length - 1) : 1;
}

/**
 * Coronal plane at row index yIdx: output (width = cols along x,
 * height = numSlices along z). Row k of the output is slice k.
 */
export function sampleCoronal(volume, geom, yIdx) {
  const { cols, numSlices, rows } = geom;
  const y = Math.max(0, Math.min(rows - 1, yIdx));
  const out = new Float32Array(cols * numSlices);
  for (let k = 0; k < numSlices; k++) {
    const sliceOff = k * rows * cols + y * cols;
    for (let i = 0; i < cols; i++) {
      out[k * cols + i] = volume[sliceOff + i];
    }
  }
  return { pixels: out, width: cols, height: numSlices };
}

/**
 * Sagittal plane at column index xIdx: output (width = rows along y,
 * height = numSlices along z).
 */
export function sampleSagittal(volume, geom, xIdx) {
  const { cols, numSlices, rows } = geom;
  const x = Math.max(0, Math.min(cols - 1, xIdx));
  const out = new Float32Array(rows * numSlices);
  for (let k = 0; k < numSlices; k++) {
    const sliceOff = k * rows * cols;
    for (let j = 0; j < rows; j++) {
      out[k * rows + j] = volume[sliceOff + j * cols + x];
    }
  }
  return { pixels: out, width: rows, height: numSlices };
}

/**
 * Map HU values to RGBA pixels with window width/centre.
 * @returns {Uint8ClampedArray} length = n * 4
 */
export function huToRGBA(hu, wc, ww) {
  const lo = wc - ww / 2;
  const scale = 255 / (ww || 1);
  const out = new Uint8ClampedArray(hu.length * 4);
  for (let i = 0; i < hu.length; i++) {
    const g = (hu[i] - lo) * scale;
    const v = g < 0 ? 0 : g > 255 ? 255 : g;
    out[i * 4] = v;
    out[i * 4 + 1] = v;
    out[i * 4 + 2] = v;
    out[i * 4 + 3] = 255;
  }
  return out;
}

/**
 * Colour-map dose values (cGy) onto an RGBA overlay with a simple
 * amber → red → white ramp; alpha ramps to `maxAlpha` at `doseAtFull`.
 * @param {Float32Array} dose - per-output-pixel dose samples (cGy)
 * @param {number} doseAtFull - dose (cGy) at which the overlay reaches full alpha
 * @param {number} opacity - global opacity multiplier (0..1)
 */
export function doseToRGBA(dose, doseAtFull, opacity) {
  const out = new Uint8ClampedArray(dose.length * 4);
  for (let i = 0; i < dose.length; i++) {
    const t = Math.max(0, Math.min(1, dose[i] / (doseAtFull || 1)));
    if (t <= 0) continue;
    // amber (246,193,119) → red (229,57,53) → white (255,255,255)
    let r, g, b;
    if (t < 0.5) {
      const u = t / 0.5;
      r = 246 + (229 - 246) * u;
      g = 193 + (57 - 193) * u;
      b = 119 + (53 - 119) * u;
    } else {
      const u = (t - 0.5) / 0.5;
      r = 229 + (255 - 229) * u;
      g = 57 + (255 - 57) * u;
      b = 53 + (255 - 53) * u;
    }
    out[i * 4] = r;
    out[i * 4 + 1] = g;
    out[i * 4 + 2] = b;
    out[i * 4 + 3] = Math.min(255, t * 255) * opacity;
  }
  return out;
}
