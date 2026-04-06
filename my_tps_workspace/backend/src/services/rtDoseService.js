import { readFileSync } from 'fs';
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
    buffer = readFileSync(filePath);
  } catch (err) {
    throw new Error(`Failed to read DICOM file: ${err.message}`);
  }

  const byteArray = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  const dicomData = DicomMessage.readFile(byteArray);
  const dataSet = DicomMetaDictionary.naturalizeDataset(dicomData.dict);

  // Extract dose grid scaling (3004,000e)
  const doseGridScaling = parseFloat(dataSet['3004000e'] || dataSet.DoseGridScaling) || 0;

  // Extract dose type (3004,0004)
  const doseType = String(dataSet['30040004'] || dataSet.DoseType || '');

  // Extract dose units (3004,0008)
  const doseUnits = String(dataSet['30040008'] || dataSet.DoseUnits || '');

  // Extract grid dimensions
  const rows = Number(dataSet['00280010'] || dataSet.Rows) || 0;
  const columns = Number(dataSet['00280011'] || dataSet.Columns) || 0;
  const numberOfFrames = Number(dataSet['00280008'] || dataSet.NumberOfFrames) || 1;

  // Extract image position (0020,0032)
  const imagePositionPatient = dataSet['00200032'] || dataSet.ImagePositionPatient;
  const imagePosition = parseImagePosition(imagePositionPatient);

  // Extract image orientation (0020,0037)
  const imageOrientationPatient = dataSet['00200037'] || dataSet.ImageOrientationPatient;
  const imageOrientation = parseImageOrientation(imageOrientationPatient);

  // Extract pixel spacing (0028,0030)
  const pixelSpacing = dataSet['00280030'] || dataSet.PixelSpacing;
  const parsedPixelSpacing = parsePixelSpacing(pixelSpacing);

  // Extract pixel data (7fe0,0010)
  const pixelData = extractPixelData(dataSet, rows, columns, numberOfFrames);

  return {
    doseGridScaling,
    doseType,
    doseUnits,
    rows,
    columns,
    numberOfFrames,
    imagePosition,
    imageOrientation,
    pixelSpacing: parsedPixelSpacing,
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
 * Extract pixel data from DICOM dataset
 * @param {Object} dataSet - Naturalized DICOM dataset
 * @param {number} rows - Number of rows
 * @param {number} columns - Number of columns
 * @param {number} numberOfFrames - Number of frames
 * @returns {Float32Array} Pixel data as Float32Array
 */
function extractPixelData(dataSet, rows, columns, numberOfFrames) {
  let pixelData = dataSet['7fe00010'] || dataSet.PixelData;

  if (!pixelData) {
    // Return empty array if no pixel data
    return new Float32Array(0);
  }

  // Convert to proper typed array
  // Handle both Uint16Array and Float32Array depending on bits allocated
  let rawData;
  if (pixelData instanceof Uint8Array) {
    rawData = new Uint16Array(pixelData.buffer, pixelData.byteOffset, pixelData.byteLength / 2);
  } else if (pixelData instanceof Uint16Array) {
    rawData = pixelData;
  } else if (Array.isArray(pixelData)) {
    rawData = new Uint16Array(pixelData);
  } else {
    rawData = new Uint16Array(0);
  }

  // Calculate expected length
  const expectedLength = rows * columns * numberOfFrames;

  // Create Float32Array for result
  const result = new Float32Array(expectedLength);

  // Copy and convert to float (actual conversion with scaling done in calculateDoseValue)
  const copyLength = Math.min(rawData.length, expectedLength);
  for (let i = 0; i < copyLength; i++) {
    result[i] = rawData[i];
  }

  return result;
}

/**
 * Calculate dose values from pixel data and dose grid scaling
 * @param {Uint16Array|Float32Array|Array} pixelData - Raw pixel data
 * @param {number} doseGridScaling - Dose grid scaling factor
 * @returns {Float32Array} Calculated dose values in cGy (pixel * scaling * 100)
 */
export function calculateDoseValue(pixelData, doseGridScaling) {
  if (!pixelData || pixelData.length === 0) {
    return new Float32Array(0);
  }

  const scalingFactor = doseGridScaling * 100; // Convert to cGy
  const result = new Float32Array(pixelData.length);

  for (let i = 0; i < pixelData.length; i++) {
    result[i] = Number(pixelData[i]) * scalingFactor;
  }

  return result;
}
