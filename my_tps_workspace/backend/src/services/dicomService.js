import { getDb } from '../db/init.js';
import { auditLog } from '../logging/index.js';
import { createHmac } from 'crypto';
import { join } from 'path';

const HMAC_SECRET = process.env.HMAC_SECRET || 'dev-hmac-secret-change-in-production';
const DOWNLOAD_EXPIRY_SECONDS = 900; // 15 minutes

export function registerDicomFile({ studyId, metadata, filePath, userId, reqId }) {
  const db = getDb();

  // Extract positioning data from metadata
  let imagePositionX = null, imagePositionY = null, imagePositionZ = null;
  let pixelSpacingX = null, pixelSpacingY = null;
  let rows = null, columns = null;

  if (metadata.imagePositionPatient) {
    if (Array.isArray(metadata.imagePositionPatient)) {
      imagePositionX = metadata.imagePositionPatient[0];
      imagePositionY = metadata.imagePositionPatient[1];
      imagePositionZ = metadata.imagePositionPatient[2];
    } else if (typeof metadata.imagePositionPatient === 'number') {
      imagePositionX = metadata.imagePositionPatient;
    }
  }

  if (metadata.pixelSpacing) {
    if (Array.isArray(metadata.pixelSpacing)) {
      pixelSpacingX = metadata.pixelSpacing[0];
      pixelSpacingY = metadata.pixelSpacing[1];
    } else if (typeof metadata.pixelSpacing === 'number') {
      pixelSpacingX = metadata.pixelSpacing;
    }
  }

  if (metadata.rows) rows = metadata.rows;
  if (metadata.columns) columns = metadata.columns;

  // Upsert: update if SOP Instance UID already exists (re-upload of same file)
  const existing = db.prepare('SELECT id FROM dicom_files WHERE sop_instance_uid = ?').get(metadata.sopInstanceUid);

  let result;
  if (existing) {
    db.prepare(`
      UPDATE dicom_files
      SET series_instance_uid = ?, modality = ?, instance_number = ?, file_path = ?, file_name = ?, file_size = ?,
          image_position_x = ?, image_position_y = ?, image_position_z = ?,
          pixel_spacing_x = ?, pixel_spacing_y = ?, rows = ?, columns = ?
      WHERE id = ?
    `).run(
      metadata.seriesInstanceUid, metadata.modality, metadata.instanceNumber, filePath, metadata.fileName, metadata.fileSize,
      imagePositionX, imagePositionY, imagePositionZ,
      pixelSpacingX, pixelSpacingY, rows, columns,
      existing.id
    );
    result = { id: existing.id, updated: true };
  } else {
    const runResult = db.prepare(`
      INSERT INTO dicom_files (study_id, series_instance_uid, sop_instance_uid, modality, instance_number, file_path, file_name, file_size,
          image_position_x, image_position_y, image_position_z, pixel_spacing_x, pixel_spacing_y, rows, columns)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      studyId, metadata.seriesInstanceUid, metadata.sopInstanceUid, metadata.modality, metadata.instanceNumber,
      filePath, metadata.fileName, metadata.fileSize,
      imagePositionX, imagePositionY, imagePositionZ,
      pixelSpacingX, pixelSpacingY, rows, columns
    );
    result = { id: runResult.lastInsertRowid, updated: false };
  }

  auditLog(db, {
    reqId, userId,
    action: 'register_dicom_file',
    resourceType: 'dicom_file',
    resourceId: result.id,
    metadata: { studyId, sopInstanceUid: metadata.sopInstanceUid, modality: metadata.modality }
  });

  return result;
}

export function getDicomFilesByStudy({ studyId, userId, reqId }) {
  const db = getDb();

  const files = db.prepare(`
    SELECT id, series_instance_uid, sop_instance_uid, modality, instance_number, file_name, file_size, created_at,
           image_position_x, image_position_y, image_position_z, pixel_spacing_x, pixel_spacing_y, rows, columns
    FROM dicom_files
    WHERE study_id = ?
    ORDER BY modality, series_instance_uid, instance_number, created_at
  `).all(studyId);

  auditLog(db, { reqId, userId, action: 'list_dicom_files', resourceType: 'dicom_file', metadata: { studyId, count: files.length } });

  return files;
}

export function getDicomFile({ fileId, userId, reqId }) {
  const db = getDb();

  const file = db.prepare('SELECT * FROM dicom_files WHERE id = ?').get(fileId);
  if (!file) {
    throw Object.assign(new Error('DICOM file not found'), { status: 404 });
  }

  auditLog(db, { reqId, userId, action: 'get_dicom_file', resourceType: 'dicom_file', resourceId: fileId });

  return file;
}

/**
 * Generate HMAC-signed download URL valid for 15 minutes.
 * Format: /api/files/public/download/{fileId}?expires={expires}&sig={sig}
 */
export function generateSignedUrl({ fileId, reqId }) {
  const expires = Math.floor(Date.now() / 1000) + DOWNLOAD_EXPIRY_SECONDS;
  const payload = `${fileId}:${expires}`;
  const sig = createHmac('sha256', HMAC_SECRET).update(payload).digest('hex');
  return `/api/files/public/download/${fileId}?expires=${expires}&sig=${sig}`;
}

/**
 * Verify HMAC-signed download URL.
 * Returns the file record if valid, throws 403 if tampered/expired.
 */
export function verifySignedUrl({ fileId, expires, sig }) {
  const expiresNum = parseInt(expires, 10);
  if (isNaN(expiresNum)) {
    throw Object.assign(new Error('Invalid expiry'), { status: 403 });
  }
  if (Date.now() / 1000 > expiresNum) {
    throw Object.assign(new Error('URL expired'), { status: 403 });
  }

  const expectedSig = createHmac('sha256', HMAC_SECRET)
    .update(`${fileId}:${expiresNum}`)
    .digest('hex');

  if (!compareSigs(sig, expectedSig)) {
    throw Object.assign(new Error('Invalid signature'), { status: 403 });
  }

  return getDicomFile({ fileId });
}

// Constant-time signature comparison to prevent timing attacks
function compareSigs(a, b) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

export function getFilesByModality({ studyId, modality, userId, reqId }) {
  const db = getDb();

  const files = db.prepare(`
    SELECT id, series_instance_uid, sop_instance_uid, modality, instance_number, file_name, file_size, created_at,
           image_position_x, image_position_y, image_position_z, pixel_spacing_x, pixel_spacing_y, rows, columns
    FROM dicom_files
    WHERE study_id = ? AND modality = ?
    ORDER BY series_instance_uid, instance_number, created_at
  `).all(studyId, modality);

  return files;
}

export function getRtStructForStudy({ studyId, userId, reqId }) {
  return getFilesByModality({ studyId, modality: 'RTSTRUCT', userId, reqId });
}
