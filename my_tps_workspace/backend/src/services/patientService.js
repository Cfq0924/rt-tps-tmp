import { getDb } from '../db/init.js';
import { v4 as uuidv4 } from 'uuid';
import { auditLog } from '../logging/index.js';

export function listPatients({ userId, reqId }) {
  const db = getDb();
  const patients = db.prepare(`
    SELECT p.id, p.external_id, p.name, p.birth_date, p.gender, p.created_at,
           COUNT(DISTINCT s.id) as study_count,
           COUNT(DISTINCT df.id) as file_count,
           SUM(CASE WHEN df.modality = 'RTSTRUCT' THEN 1 ELSE 0 END) as rtstruct_count,
           SUM(CASE WHEN df.modality = 'RTDOSE' THEN 1 ELSE 0 END) as rtdose_count,
           SUM(CASE WHEN df.modality = 'RTPLAN' THEN 1 ELSE 0 END) as rtplan_count,
           SUM(CASE WHEN df.modality = 'CT' THEN 1 ELSE 0 END) as ct_count,
           SUM(CASE WHEN df.modality = 'MR' THEN 1 ELSE 0 END) as mr_count,
           SUM(CASE WHEN df.modality = 'PT' THEN 1 ELSE 0 END) as pt_count,
           SUM(CASE WHEN df.modality = 'US' THEN 1 ELSE 0 END) as us_count,
           SUM(CASE WHEN df.modality = 'XA' THEN 1 ELSE 0 END) as xa_count,
           SUM(CASE WHEN df.modality = 'CR' THEN 1 ELSE 0 END) as cr_count
    FROM patients p
    LEFT JOIN studies s ON s.patient_id = p.id
    LEFT JOIN dicom_files df ON df.study_id = s.id
    GROUP BY p.id
    ORDER BY p.created_at DESC
  `).all();

  auditLog(db, { reqId, userId, action: 'list_patients', resourceType: 'patient', metadata: { count: patients.length } });

  return patients;
}

export function getPatient({ id, userId, reqId }) {
  const db = getDb();
  const patient = db.prepare('SELECT * FROM patients WHERE id = ?').get(id);
  if (!patient) {
    throw Object.assign(new Error('Patient not found'), { status: 404 });
  }

  const studies = db.prepare(`
    SELECT s.*, COUNT(df.id) as file_count
    FROM studies s
    LEFT JOIN dicom_files df ON df.study_id = s.id
    WHERE s.patient_id = ?
    GROUP BY s.id
    ORDER BY s.study_date DESC
  `).all(id);

  auditLog(db, { reqId, userId, action: 'get_patient', resourceType: 'patient', resourceId: id });

  return { ...patient, studies };
}

export function createPatient({ externalId, name, birthDate, gender, userId, reqId }) {
  const db = getDb();

  const existing = db.prepare('SELECT id FROM patients WHERE external_id = ?').get(externalId);
  if (existing) {
    throw Object.assign(new Error('Patient with this external ID already exists'), { status: 409 });
  }

  const result = db.prepare(`
    INSERT INTO patients (external_id, name, birth_date, gender)
    VALUES (?, ?, ?, ?)
  `).run(externalId, name, birthDate || null, gender || null);

  auditLog(db, { reqId, userId, action: 'create_patient', resourceType: 'patient', resourceId: result.lastInsertRowid, metadata: { externalId, name } });

  return db.prepare('SELECT * FROM patients WHERE id = ?').get(result.lastInsertRowid);
}

export function findOrCreatePatient({ externalId, name, userId, reqId }) {
  const db = getDb();

  let patient = db.prepare('SELECT * FROM patients WHERE external_id = ?').get(externalId);
  if (!patient) {
    const result = db.prepare(`
      INSERT INTO patients (external_id, name) VALUES (?, ?)
    `).run(externalId, name || 'Unknown');
    patient = db.prepare('SELECT * FROM patients WHERE id = ?').get(result.lastInsertRowid);
    auditLog(db, { reqId, userId, action: 'create_patient', resourceType: 'patient', resourceId: patient.id, metadata: { externalId } });
  }

  return patient;
}
