import { readFileSync } from 'fs';
import pkg from 'dcmjs';

const { data: { DicomMessage } } = pkg;

/**
 * Parse RT Structure DICOM file and extract ROI and contour data.
 * @param {string} filePath - Path to RTSTRUCT DICOM file
 * @returns {Object} ROI sequence and contour sequence
 */
export async function parseRTStruct(filePath) {
  let buffer;

  try {
    buffer = readFileSync(filePath);
  } catch (err) {
    throw new Error(`Failed to read DICOM file: ${err.message}`);
  }

  const byteArray = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  const { dict } = DicomMessage.readFile(byteArray);

  // Structure Set ROI Sequence (3006,0020) - contains ROI Number, Name
  const roiSequence = extractROISequence(dict);

  // ROI Contour Sequence (3006,0039) - contains Contour Data with Referenced ROI Number
  const contourSequence = extractContourSequence(dict);

  return {
    roiSequence,
    contourSequence
  };
}

/**
 * Get string value from a DICOM element
 * @param {Object} element - DICOM element
 * @returns {string|null} String value
 */
function getStringValue(element) {
  if (!element || !element.Value) return null;
  const val = element.Value[0];
  if (Buffer.isBuffer(val)) return val.toString('binary');
  if (typeof val === 'string') return val;
  return null;
}

/**
 * Get numeric value from a DICOM element
 * @param {Object} element - DICOM element
 * @returns {number|null} Numeric value
 */
function getNumericValue(element) {
  if (!element || !element.Value) return null;
  const val = element.Value[0];
  if (typeof val === 'number') return val;
  if (typeof val === 'string') return parseFloat(val);
  return null;
}

/**
 * Extract ROI Sequence from Structure Set ROI Sequence tag
 * @param {Object} dict - Raw DICOM dictionary
 * @returns {Array} Array of ROI objects
 */
function extractROISequence(dict) {
  const roiSequence = [];

  // Structure Set ROI Sequence (3006,0020)
  const structureSetROISequence = dict['30060020'];

  if (!structureSetROISequence || !structureSetROISequence.Value || !Array.isArray(structureSetROISequence.Value)) {
    return roiSequence;
  }

  for (const roiItem of structureSetROISequence.Value) {
    // Extract ROI Number (3006,0022)
    const roiNumber = getNumericValue(roiItem['30060022']);
    // Extract ROI Name (3006,0026)
    const roiName = getStringValue(roiItem['30060026']);
    // ROI Display Color is in the contour sequence, not here
    // Default to white, will be overridden by contour data
    const displayColor = { r: 255, g: 255, b: 255 };

    if (roiNumber !== null && roiName) {
      roiSequence.push({
        roiNumber,
        roiName,
        displayColor
      });
    }
  }

  return roiSequence;
}

/**
 * Extract Contour Sequence with contour data
 * @param {Object} dict - Raw DICOM dictionary
 * @returns {Array} Array of contour objects
 */
function extractContourSequence(dict) {
  const contourSequence = [];

  // ROI Contour Sequence (3006,0039)
  const roiContourSequence = dict['30060039'];

  if (!roiContourSequence || !roiContourSequence.Value || !Array.isArray(roiContourSequence.Value)) {
    return contourSequence;
  }

  for (const roiContour of roiContourSequence.Value) {
    // Referenced ROI Number (3006,0084)
    const referencedROINumber = getNumericValue(roiContour['30060084']);

    // ROI Display Color (3006,002A)
    const displayColorRaw = roiContour['3006002A'];
    const displayColor = normalizeColor(displayColorRaw);

    // Contour Sequence (3006,0040)
    const contourSequenceItems = roiContour['30060040'];
    if (!contourSequenceItems || !contourSequenceItems.Value || !Array.isArray(contourSequenceItems.Value)) {
      continue;
    }

    for (const contourItem of contourSequenceItems.Value) {
      // Contour Data (3006,0050)
      const contourDataElement = contourItem['30060050'];
      let contourData = [];

      if (contourDataElement && contourDataElement.Value) {
        // Contour data is stored as a flat array of numbers (x,y,z triplets)
        contourData = contourDataElement.Value.map(v => Number(v)).filter(v => !isNaN(v));
      }

      // Contour Image Sequence (3006,0016) - contains Referenced SOP Instance UID
      let referencedSOPInstanceUID = null;
      const contourImageSequence = contourItem['30060016'];
      if (contourImageSequence && contourImageSequence.Value && Array.isArray(contourImageSequence.Value)) {
        for (const imgSeq of contourImageSequence.Value) {
          referencedSOPInstanceUID = getStringValue(imgSeq['00081155']);
          if (referencedSOPInstanceUID) break;
        }
      }

      if (contourData.length > 0) {
        contourSequence.push({
          referencedSOPInstanceUID: referencedSOPInstanceUID || '',
          referencedROINumber: referencedROINumber || 0,
          contourData,
          displayColor
        });
      }
    }
  }

  return contourSequence;
}

/**
 * Normalize color to {r, g, b} format
 * @param {Object} colorElement - DICOM color element
 * @returns {Object} Normalized color object
 */
function normalizeColor(colorElement) {
  // Default color is white
  const defaultColor = { r: 255, g: 255, b: 255 };

  if (!colorElement || !colorElement.Value) {
    return defaultColor;
  }

  const value = colorElement.Value;

  // If it's an array [r, g, b] or [r, g, b, a]
  if (Array.isArray(value) && value.length >= 3) {
    return {
      r: Math.round(Number(value[0]) || 255),
      g: Math.round(Number(value[1]) || 255),
      b: Math.round(Number(value[2]) || 255)
    };
  }

  return defaultColor;
}

/**
 * Get contours for a specific CT slice by SOP Instance UID
 * @param {Array} contourSequence - Array of contour objects
 * @param {string} sopInstanceUID - SOP Instance UID of CT slice
 * @returns {Array} Contours for the specified slice
 */
export function getContoursForSlice(contourSequence, sopInstanceUID) {
  if (!Array.isArray(contourSequence) || !sopInstanceUID) {
    return [];
  }

  return contourSequence.filter(contour => {
    return contour.referencedSOPInstanceUID === sopInstanceUID;
  });
}
