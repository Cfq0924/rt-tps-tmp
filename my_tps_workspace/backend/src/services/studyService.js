import { getDb } from '../db/init.js';
import { auditLog } from '../logging/index.js';

export function getStudiesByPatient({ patientId, userId, reqId }) {
  const db = getDb();

  const studies = db.prepare(`
    SELECT s.*,
           COUNT(df.id) as file_count,
           GROUP_CONCAT(DISTINCT df.modality) as modalities
    FROM studies s
    LEFT JOIN dicom_files df ON df.study_id = s.id
    WHERE s.patient_id = ?
    GROUP BY s.id
    ORDER BY s.study_date DESC
  `).all(patientId);

  auditLog(db, { reqId, userId, action: 'list_studies', resourceType: 'study', metadata: { patientId, count: studies.length } });

  return studies;
}

export function findOrCreateStudy({ patientId, studyInstanceUid, studyDate, description, userId, reqId }) {
  const db = getDb();

  let study = db.prepare('SELECT * FROM studies WHERE study_instance_uid = ?').get(studyInstanceUid);
  if (!study) {
    const result = db.prepare(`
      INSERT INTO studies (patient_id, study_instance_uid, study_date, description)
      VALUES (?, ?, ?, ?)
    `).run(patientId, studyInstanceUid, studyDate || null, description || null);
    study = db.prepare('SELECT * FROM studies WHERE id = ?').get(result.lastInsertRowid);
    auditLog(db, { reqId, userId, action: 'create_study', resourceType: 'study', resourceId: study.id, metadata: { studyInstanceUid, patientId } });
  }

  return study;
}

export function getStudy({ id, userId, reqId }) {
  const db = getDb();

  const study = db.prepare(`
    SELECT s.*, p.name as patient_name, p.external_id as patient_external_id
    FROM studies s
    JOIN patients p ON p.id = s.patient_id
    WHERE s.id = ?
  `).get(id);

  if (!study) {
    throw Object.assign(new Error('Study not found'), { status: 404 });
  }

  const files = db.prepare(`
    SELECT id, series_instance_uid, sop_instance_uid, modality, file_name, file_size, created_at
    FROM dicom_files
    WHERE study_id = ?
    ORDER BY modality, created_at
  `).all(id);

  auditLog(db, { reqId, userId, action: 'get_study', resourceType: 'study', resourceId: id });

  return { ...study, files };
}
