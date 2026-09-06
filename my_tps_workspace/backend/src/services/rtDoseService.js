import { readFile } from 'fs/promises';
import pkg from 'dcmjs';

const { data: { DicomMessage, DicomMetaDictionary } } = pkg;

/**
 * Parse RT Dose DICOM file and extract dose grid data.
 * @param {string} filePath - Path to RTDOSE DICOM file
 * @returns {Object} Dose data including pixel data and metadata
 */
export async function parseRTDose(filePath) {
  let buffer;

  try {
    buffer = await readFile(filePath);
  } catch (err) {
    throw new Error(`Failed to read DICOM file: ${err.message}`);
  }

  const byteArray = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  const dicomData = DicomMessage.readFile(byteArray);
  const dataSet = DicomMetaDictionary.naturalizeDataset(dicomData.dict);

  // Extract dose grid scaling (3004,000e)
  const doseGridScaling = parseFloat(dataSet.DoseGridScaling) || 0;

  // Extract dose type (3004,0004)
  const doseType = String(dataSet.DoseType || '');

  // Extract dose units (3004,0002)
  const doseUnits = String(dataSet.DoseUnits || '');

  // Extract dose summation type (3004,000a)
  const doseSummationType = String(dataSet.DoseSummationType || '');

  // Extract grid dimensions
  const rows = Number(dataSet.Rows) || 0;
  const columns = Number(dataSet.Columns) || 0;
  const numberOfFrames = Number(dataSet.NumberOfFrames) || 1;
  const bitsAllocated = Number(dataSet.BitsAllocated) || 16;
  const pixelRepresentation = Number(dataSet.PixelRepresentation) || 0;

  // Extract image position (0020,0032)
  const imagePosition = parseImagePosition(dataSet.ImagePositionPatient);

  // Extract image orientation (0020,0037)
  const imageOrientation = parseImageOrientation(dataSet.ImageOrientationPatient);

  // Extract pixel spacing (0028,0030)
  const pixelSpacing = parsePixelSpacing(dataSet.PixelSpacing);

  // Extract grid frame offset vector (3004,000c) — per-frame z offsets from
  // ImagePositionPatient. Required to align dose frames with CT slice z.
  const gridFrameOffsetVector = parseGridFrameOffsetVector(dataSet.GridFrameOffsetVector, numberOfFrames);

  // Extract pixel data (7fe0,0010)
  const { data: pixelData, bitsAllocated: pixelBits } = extractPixelData(
    dataSet, rows, columns, numberOfFrames, bitsAllocated, pixelRepresentation
  );

  return {
    doseGridScaling,
    doseType,
    doseUnits,
    doseSummationType,
    rows,
    columns,
    numberOfFrames,
    bitsAllocated: pixelBits,
    imagePosition,
    imageOrientation,
    pixelSpacing,
    gridFrameOffsetVector,
    pixelData
  };
}

/**
 * Parse image position patient to {x, y, z} object
 * @param {Array|string} imagePosition - Image position value
 * @returns {Object} Parsed image position
 */
function parseImagePosition(imagePosition) {
  const defaultPosition = { x: 0, y: 0, z: 0 };

  if (!imagePosition) {
    return defaultPosition;
  }

  if (typeof imagePosition === 'object' && !Array.isArray(imagePosition)) {
    return {
      x: Number(imagePosition.x || imagePosition.X || 0),
      y: Number(imagePosition.y || imagePosition.Y || 0),
      z: Number(imagePosition.z || imagePosition.Z || 0)
    };
  }

  let parts;
  if (Array.isArray(imagePosition)) {
    parts = imagePosition;
  } else if (typeof imagePosition === 'string') {
    parts = imagePosition.split('\\');
  } else {
    return defaultPosition;
  }

  return {
    x: Number(parts[0]) || 0,
    y: Number(parts[1]) || 0,
    z: Number(parts[2]) || 0
  };
}

/**
 * Parse image orientation patient to {x, y, z} components
 * @param {Array|string} imageOrientation - Image orientation value
 * @returns {Object} Parsed image orientation
 */
function parseImageOrientation(imageOrientation) {
  const defaultOrientation = {
    x: [1, 0, 0],
    y: [0, 1, 0],
    z: [0, 0, 1]
  };

  if (!imageOrientation) {
    return defaultOrientation;
  }

  let parts;
  if (Array.isArray(imageOrientation)) {
    parts = imageOrientation;
  } else if (typeof imageOrientation === 'string') {
    parts = imageOrientation.split('\\');
  } else {
    return defaultOrientation;
  }

  if (parts.length < 6) {
    return defaultOrientation;
  }

  return {
    x: [Number(parts[0]) || 1, Number(parts[1]) || 0, Number(parts[2]) || 0],
    y: [Number(parts[3]) || 0, Number(parts[4]) || 1, Number(parts[5]) || 0],
    z: [0, 0, 1]
  };
}

/**
 * Parse pixel spacing to {i, j} object
 * @param {Array|string} pixelSpacing - Pixel spacing value
 * @returns {Object} Parsed pixel spacing
 */
function parsePixelSpacing(pixelSpacing) {
  const defaultSpacing = { i: 1, j: 1 };

  if (!pixelSpacing) {
    return defaultSpacing;
  }

  let parts;
  if (Array.isArray(pixelSpacing)) {
    parts = pixelSpacing;
  } else if (typeof pixelSpacing === 'string') {
    parts = pixelSpacing.split('\\');
  } else {
    return defaultSpacing;
  }

  return {
    i: Number(parts[0]) || 1,
    j: Number(parts[1]) || 1
  };
}

/**
 * Parse GridFrameOffsetVector (3004,000c). Values are z offsets (for the
 * axial HFS case) of each dose frame relative to ImagePositionPatient.
 * @param {Array|string} gfov - Raw tag value
 * @param {number} numberOfFrames - Expected frame count
 * @returns {number[]} Array of per-frame offsets; empty when absent
 */
function parseGridFrameOffsetVector(gfov, numberOfFrames) {
  if (!gfov) return [];

  let parts;
  if (Array.isArray(gfov)) {
    parts = gfov;
  } else if (typeof gfov === 'string') {
    parts = gfov.split('\\');
  } else {
    return [];
  }

  const values = parts.map(v => Number(v)).filter(v => !Number.isNaN(v));
  // A single offset with >1 frame means uniform frame spacing (DICOM allows
  // the compact form [0, spacing]); expand it
  if (values.length === 1 && numberOfFrames > 1) {
    return Array.from({ length: numberOfFrames }, (_, i) => values[0] * i);
  }
  return values;
}

/**
 * Extract pixel data from DICOM dataset into a Float32Array of raw stored values.
 *
 * dcmjs quirk: after DicomMetaDictionary.naturalizeDataset, PixelData for
 * binary data is typically `[ArrayBuffer]` (a 1-element array wrapping the
 * buffer), not a typed array. Handle that plus ArrayBuffer/Uint8Array forms,
 * and select the element view by BitsAllocated (dose grids are 16- or 32-bit
 * unsigned in practice; signed when PixelRepresentation=1).
 *
 * @param {Object} dataSet - Naturalized DICOM dataset
 * @param {number} rows
 * @param {number} columns
 * @param {number} numberOfFrames
 * @param {number} bitsAllocated - BitsAllocated tag value
 * @param {number} pixelRepresentation - 0 = unsigned, 1 = signed
 * @returns {{data: Float32Array, bitsAllocated: number}} Raw values and the bits actually used
 */
function extractPixelData(dataSet, rows, columns, numberOfFrames, bitsAllocated, pixelRepresentation) {
  let pixelData = dataSet.PixelData || dataSet['7fe00010'];

  if (!pixelData) {
    return { data: new Float32Array(0), bitsAllocated };
  }

  // Unwrap dcmjs forms down to an ArrayBuffer view over the raw bytes
  let bytes;
  if (Array.isArray(pixelData) && pixelData.length > 0) {
    const first = pixelData[0];
    if (first instanceof ArrayBuffer) {
      bytes = new Uint8Array(first);
    } else if (ArrayBuffer.isView(first)) {
      bytes = new Uint8Array(first.buffer, first.byteOffset, first.byteLength);
    } else {
      // Element-value array (rare): convert element-wise
      const out = new Float32Array(pixelData.length);
      for (let i = 0; i < pixelData.length; i++) out[i] = Number(pixelData[i]) || 0;
      return { data: out, bitsAllocated };
    }
  } else if (pixelData instanceof ArrayBuffer) {
    bytes = new Uint8Array(pixelData);
  } else if (pixelData instanceof Uint8Array) {
    bytes = pixelData;
  } else if (ArrayBuffer.isView(pixelData)) {
    bytes = new Uint8Array(pixelData.buffer, pixelData.byteOffset, pixelData.byteLength);
  } else {
    return { data: new Float32Array(0), bitsAllocated };
  }

  const expectedLength = rows * columns * numberOfFrames;

  // Select the element view matching BitsAllocated
  let view;
  if (bitsAllocated === 32) {
    view = pixelRepresentation === 1
      ? new Int32Array(bytes.buffer, bytes.byteOffset, Math.floor(bytes.byteLength / 4))
      : new Uint32Array(bytes.buffer, bytes.byteOffset, Math.floor(bytes.byteLength / 4));
  } else if (bitsAllocated === 8) {
    view = pixelRepresentation === 1
      ? new Int8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength)
      : bytes;
  } else { // 16 (default)
    view = pixelRepresentation === 1
      ? new Int16Array(bytes.buffer, bytes.byteOffset, Math.floor(bytes.byteLength / 2))
      : new Uint16Array(bytes.buffer, bytes.byteOffset, Math.floor(bytes.byteLength / 2));
  }

  const result = new Float32Array(expectedLength);
  const copyLength = Math.min(view.length, expectedLength);
  for (let i = 0; i < copyLength; i++) {
    result[i] = view[i];
  }

  return { data: result, bitsAllocated };
}

/**
 * Extract a single frame (z index) from a scaled dose grid as a copy.
 * @param {Float32Array} grid - Scaled dose values (cGy), frame-major [k][j][i]
 * @param {number} frameIndex - z index of the frame
 * @param {number} voxelsPerFrame - rows * columns
 * @returns {Float32Array} Copy of the frame's values
 */
export function extractDoseFrame(grid, frameIndex, voxelsPerFrame) {
  if (!grid || grid.length === 0 || frameIndex < 0) {
    return new Float32Array(0);
  }
  const start = frameIndex * voxelsPerFrame;
  if (start + voxelsPerFrame > grid.length) {
    return new Float32Array(0);
  }
  return grid.slice(start, start + voxelsPerFrame);
}

/**
 * Calculate dose values from pixel data and dose grid scaling
 * @param {Uint16Array|Uint32Array|Float32Array|Array} pixelData - Raw pixel data
 * @param {number} doseGridScaling - Dose grid scaling factor
 * @param {string} doseUnits - Dose Units (3004,0002): 'GY' or 'CGY'; unknown units are treated as GY
 * @returns {Float32Array} Calculated dose values in cGy (pixel * scaling, converted to cGy)
 */
export function calculateDoseValue(pixelData, doseGridScaling, doseUnits = 'GY') {
  if (!pixelData || pixelData.length === 0) {
    return new Float32Array(0);
  }

  const unitFactor = String(doseUnits).toUpperCase() === 'CGY' ? 1 : 100; // Convert GY to cGy
  const scalingFactor = doseGridScaling * unitFactor;
  const result = new Float32Array(pixelData.length);

  for (let i = 0; i < pixelData.length; i++) {
    result[i] = Number(pixelData[i]) * scalingFactor;
  }

  return result;
}
