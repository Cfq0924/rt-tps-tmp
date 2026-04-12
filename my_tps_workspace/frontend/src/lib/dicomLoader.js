import * as cornerstone from '@cornerstonejs/core';
import dcmjs from 'dcmjs';

/**
 * @file dicomLoader.js
 * Custom DICOM file loader using dcmjs for parsing
 * This bypasses the need for @cornerstonejs/dicom-image-loader WASM codecs
 */

/**
 * Load and parse a DICOM file, then create a Cornerstone image
 * @param {string} url - URL to the DICOM file (should return raw DICOM bytes)
 * @returns {Promise<Object>} Cornerstone image object
 */
export async function loadDicomImage(url) {
  // Fetch the DICOM file
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch DICOM file: ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const byteArray = new Uint8Array(arrayBuffer);

  // Parse DICOM using dcmjs
  const parsedDicom = dcmjs.data.DicomMessage.readFile(byteArray.buffer);
  const dataset = dcmjs.data.DicomMetaDictionary.naturalizeDataset(parsedDicom.dict);

  // Get pixel data info
  const rows = dataset.Rows;
  const columns = dataset.Columns;
  const bitsAllocated = dataset.BitsAllocated;
  const photometricInterpretation = dataset.PhotometricInterpretation;

  // Get the pixel data element
  const pixelDataElement = findPixelDataElement(parsedDicom);
  if (!pixelDataElement) {
    throw new Error('No pixel data found in DICOM file');
  }

  // Extract pixel data
  const pixelData = extractPixelData(pixelDataElement, bitsAllocated);

  // Calculate window center/width if available
  const windowCenter = dataset.WindowCenter || dataset.WindowCenter || 40;
  const windowWidth = dataset.WindowWidth || dataset.WindowWidth || 400;

  // Get rescale parameters if available
  const rescaleSlope = dataset.RescaleSlope || 1;
  const rescaleIntercept = dataset.RescaleIntercept || 0;

  // Get spatial resolution
  const pixelSpacing = dataset.PixelSpacing || [1, 1];

  // Create Cornerstone image
  const image = {
    imageId: url,
    studyInstanceUid: dataset.StudyInstanceUID,
    seriesInstanceUid: dataset.SeriesInstanceUID,
    sopInstanceUid: dataset.SOPInstanceUID,
    rows,
    columns,
    bitsAllocated,
    bitsStored: dataset.BitsStored || bitsAllocated,
    highBit: dataset.HighBit || bitsAllocated - 1,
    pixelRepresentation: dataset.PixelRepresentation || 0,
    photometricInterpretation,
    pixelData,
    windowCenter,
    windowWidth,
    rescaleSlope,
    rescaleIntercept,
    pixelSpacing,
    minPixelValue: dataset SmallestPixelValue || 0,
    maxPixelValue: dataset LargestPixelValue || 4095,
  };

  return image;
}

/**
 * Find the pixel data element in the DICOM file
 * @param {Object} parsedDicom - Parsed DICOM message
 * @returns {Object|null} Pixel data element
 */
function findPixelDataElement(parsedDicom) {
  // The pixel data tag is (7FE0, 0010)
  const pixelDataTag = dcmjs.data.Tag.fromString('x7FE00010');

  // Walk through the dataset to find pixel data
  const elements = parsedDicom.elements;
  for (const tag in elements) {
    if (elements[tag].tag === pixelDataTag) {
      return elements[tag];
    }
  }

  // Try alternative: walk the tree
  function findInElement(element) {
    if (!element) return null;
    if (element.tag === pixelDataTag) return element;
    if (element.items) {
      for (const item of element.items) {
        const found = findInElement(item);
        if (found) return found;
      }
    }
    return null;
  }

  return findInElement(parsedDicom);
}

/**
 * Extract pixel data from the pixel data element
 * @param {Object} pixelDataElement - Pixel data element
 * @param {number} bitsAllocated - Bits allocated
 * @returns {Uint8Array|Uint16Array|Int16Array} Pixel data
 */
function extractPixelData(pixelDataElement, bitsAllocated) {
  const pixelData = pixelDataElement.value;

  if (pixelData instanceof Uint8Array) {
    return pixelData;
  }

  if (pixelData instanceof ArrayBuffer) {
    if (bitsAllocated === 16) {
      return new Uint16Array(pixelData);
    }
    return new Uint8Array(pixelData);
  }

  if (Array.isArray(pixelData)) {
    if (bitsAllocated === 16) {
      return new Uint16Array(pixelData);
    }
    return new Uint8Array(pixelData);
  }

  // Handle other cases
  return new Uint8Array(pixelData);
}

/**
 * Naturalize a dataset - convert raw DICOM tags to JS-friendly names
 * @param {Object} dataset - DICOM dataset
 */
function naturalizeDataset(dataset) {
  return dcmjs.data.DicomMetaDictionary.naturalizeDataset(dataset);
}

export default {
  loadDicomImage,
};
