import pkg from 'dcmjs';
import { unlink, readFile } from 'fs/promises';

const { DicomMessage } = pkg.data;

// dcmjs DicomMessage.readFile returns { meta, dict }
// dict elements are keyed by tag WITHOUT 'x' prefix (e.g., '00080018')
// Element.Value is an array of values.
// For string VRs (UI, PN, LO, SH etc.): Value[0] is a string
// For PN (Person Name): Value[0] is an object { Alphabetic: 'Name^First' } or a string
function getTag(dict, tag) {
  // tag format: 'x00080018' or '00080018'
  const key = (tag.startsWith('x') ? tag.slice(1) : tag).toUpperCase();
  const el = dict[key];
  if (!el || !el.Value) return null;
  const val = el.Value[0];
  // Handle PN (Person Name) which is an object { Alphabetic: '...', ... }
  if (val && typeof val === 'object' && val.Alphabetic) return val.Alphabetic;
  if (Buffer.isBuffer(val)) return val.toString('binary');
  if (typeof val === 'string') return val;
  return null;
}

// Get numeric tag value (returns array of numbers for multi-value tags)
function getNumericTag(dict, tag) {
  const key = (tag.startsWith('x') ? tag.slice(1) : tag).toUpperCase();
  const el = dict[key];
  if (!el || !el.Value) return null;
  const val = el.Value[0];
  // Value can be:
  // 1. Array of numbers already parsed (dcmjs parses DS into numbers)
  // 2. String that needs parsing (e.g., "-249.5\\-446.5\\-931.3" or "-249.5,-446.5,-931.3")
  if (typeof val === 'number') {
    // Already a number - check if it's a multi-value array
    if (el.Value.length > 1) {
      return el.Value.every(v => typeof v === 'number') ? el.Value : val;
    }
    return val;
  }
  if (typeof val === 'string') {
    let separator = '\\';
    if (!val.includes('\\') && val.includes(',')) {
      separator = ',';
    }
    const parts = val.split(separator).map(v => parseFloat(v.trim()));
    return parts.length > 1 ? parts : parts[0];
  }
  return null;
}

// DICOM strings may have weird whitespace/formatting
function cleanDicomString(str) {
  if (!str) return '';
  return str.trim().replace(/\^/g, ' ');
}

// Parse DICOM metadata from a buffer
function parseDicomMetadata(buffer, originalname) {
  const byteArray = new Uint8Array(buffer);
  const { dict } = DicomMessage.readFile(byteArray);

  const sopClassUid = getTag(dict, 'x00080016');
  const sopInstanceUid = getTag(dict, 'x00080018');
  const seriesInstanceUid = getTag(dict, 'x0020000e');
  const studyInstanceUid = getTag(dict, 'x0020000d');
  const modality = getTag(dict, 'x00080060');
  const patientName = getTag(dict, 'x00100010');
  const patientId = getTag(dict, 'x00100020');
  const instanceNumberStr = getTag(dict, 'x00200013');
  const instanceNumber = instanceNumberStr ? parseInt(instanceNumberStr, 10) : null;

  // Extract image position and spacing for coordinate transformation
  // ImagePositionPatient (0020,0032) - world coordinates of first pixel
  const imagePositionPatient = getNumericTag(dict, 'x00200032');
  // PixelSpacing (0028,0030) - mm per pixel [rowSpacing, columnSpacing]
  const pixelSpacing = getNumericTag(dict, 'x00280030');
  // Rows and Columns
  const rows = getNumericTag(dict, 'x00280010');
  const columns = getNumericTag(dict, 'x00280011');

  if (!sopInstanceUid || !seriesInstanceUid || !studyInstanceUid) {
    throw new Error('Missing required DICOM tags: SOPInstanceUID, SeriesInstanceUID, or StudyInstanceUID');
  }

  return {
    sopClassUid: sopClassUid || '',
    sopInstanceUid,
    seriesInstanceUid,
    studyInstanceUid,
    modality: modality || 'OT',
    patientName: cleanDicomString(patientName),
    patientId: cleanDicomString(patientId),
    instanceNumber,
    fileName: originalname,
    // Image positioning for coordinate transformation
    imagePositionPatient: imagePositionPatient || null,
    pixelSpacing: pixelSpacing || null,
    rows: rows || null,
    columns: columns || null,
  };
}

export async function validateDicom(req, res, next) {
  if (!req.file) {
    return res.status(400).json({ error: 'No file provided' });
  }

  try {
    const buffer = await readFile(req.file.path);
    const metadata = parseDicomMetadata(buffer, req.file.originalname);
    metadata.fileSize = req.file.size;
    req.dicomMetadata = metadata;
    next();
  } catch (err) {
    try {
      await unlink(req.file.path);
    } catch {
      // ignore unlink errors
    }
    return res.status(422).json({
      error: 'Invalid DICOM file',
      detail: err.message
    });
  }
}

export async function validateDicomBatch(req, res, next) {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: 'No files provided' });
  }

  const filesWithMetadata = [];
  const errors = [];

  // Process all files in parallel
  await Promise.all(req.files.map(async (file) => {
    try {
      const buffer = await readFile(file.path);
      const metadata = parseDicomMetadata(buffer, file.originalname);
      metadata.fileSize = file.size;
      filesWithMetadata.push({ file, metadata });
    } catch (err) {
      // Delete invalid file
      try {
        await unlink(file.path);
      } catch {
        // ignore
      }
      errors.push({
        filename: file.originalname,
        error: err.message
      });
    }
  }));

  // If all files failed validation, reject
  if (filesWithMetadata.length === 0) {
    return res.status(422).json({
      error: 'No valid DICOM files provided',
      details: errors
    });
  }

  // Attach results to request
  req.filesWithMetadata = filesWithMetadata;
  req.batchErrors = errors;
  next();
}
