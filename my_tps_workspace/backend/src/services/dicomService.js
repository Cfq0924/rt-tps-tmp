import { getDb } from '../db/init.js';
import { auditLog } from '../logging/index.js';
import { createHmac } from 'crypto';
import { join } from 'path';

const HMAC_SECRET = process.env.HMAC_SECRET || 'dev-hmac-secret-change-in-production';
const DOWNLOAD_EXPIRY_SECONDS = 900; // 15 minutes

export function registerDicomFile({ studyId, metadata, filePath, userId, reqId }) {
  const db = getDb();

  // Upsert: update if SOP Instance UID already exists (re-upload of same file)
  const existing = db.prepare('SELECT id FROM dicom_files WHERE sop_instance_uid = ?').get(metadata.sopInstanceUid);

  let result;
  if (existing) {
    db.prepare(`
      UPDATE dicom_files
      SET series_instance_uid = ?, modality = ?, file_path = ?, file_name = ?, file_size = ?
      WHERE id = ?
    `).run(metadata.seriesInstanceUid, metadata.modality, filePath, metadata.fileName, metadata.fileSize, existing.id);
    result = { id: existing.id, updated: true };
  } else {
    const runResult = db.prepare(`
      INSERT INTO dicom_files (study_id, series_instance_uid, sop_instance_uid, modality, file_path, file_name, file_size)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(studyId, metadata.seriesInstanceUid, metadata.sopInstanceUid, metadata.modality, filePath, metadata.fileName, metadata.fileSize);
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
    SELECT id, series_instance_uid, sop_instance_uid, modality, file_name, file_size, created_at
    FROM dicom_files
    WHERE study_id = ?
    ORDER BY modality, series_instance_uid, created_at
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
 * Format: /api/files/download/{fileId}?expires={expires}&sig={sig}
 */
export function generateSignedUrl({ fileId, reqId }) {
  const expires = Math.floor(Date.now() / 1000) + DOWNLOAD_EXPIRY_SECONDS;
  const payload = `${fileId}:${expires}`;
  const sig = createHmac('sha256', HMAC_SECRET).update(payload).digest('hex');
  return `/api/files/download/${fileId}?expires=${expires}&sig=${sig}`;
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
    SELECT * FROM dicom_files
    WHERE study_id = ? AND modality = ?
    ORDER BY series_instance_uid, created_at
  `).all(studyId, modality);

  return files;
}

export function getRtStructForStudy({ studyId, userId, reqId }) {
  return getFilesByModality({ studyId, modality: 'RTSTRUCT', userId, reqId });
}
