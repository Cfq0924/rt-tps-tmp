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
    fileName: originalname,
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
