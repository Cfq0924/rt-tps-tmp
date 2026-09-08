import { randomUUID } from 'crypto';
import { readFileSync } from 'fs';
import dcmjs from 'dcmjs';
import { getDb } from '../db/init.js';
import { auditLog } from '../logging/index.js';
import { getPlan } from './ebrtPlanService.js';

const { datasetToBuffer, DicomMessage, DicomMetaDictionary } = dcmjs.data;

const RTSTRUCT_SOP_CLASS = '1.2.840.10008.5.1.4.1.481.3';
const RTPLAN_SOP_CLASS = '1.2.840.10008.5.1.4.1.481.5';
const CT_SOP_CLASS = '1.2.840.10008.5.1.4.1.1.2';
const STUDY_SOP_CLASS = '1.2.840.10008.3.1.2.3.1'; // Detached Study Management

/**
 * DICOM RT export: painted segmentations → RTSTRUCT, workspace plans →
 * minimal RTPLAN, imported files → byte-level passthrough (see routes/export.js).
 *
 * dcmjs forces SpecificCharacterSet ISO_IR 192 (UTF-8) on write, so free-text
 * patient names survive the round trip.
 */

const MAX_UID_LENGTH = 64;

/** DICOM UID from a UUID v4: 2.25.{decimal}, unique and ≤ 64 chars. */
export function generateDicomUid() {
  const hex = randomUUID().replaceAll('-', '');
  const uid = `2.25.${BigInt('0x' + hex)}`;
  if (uid.length > MAX_UID_LENGTH) {
    // cannot happen with v4 UUIDs (max 2.25. + 39 digits), guard anyway
    throw new Error('generated UID exceeds 64 characters');
  }
  return uid;
}

/** Remove undefined/null/empty-array keys — dcmjs denaturalize chokes on them. */
function pruneEmpty(obj) {
  for (const k of Object.keys(obj)) {
    const v = obj[k];
    if (v === undefined || v === null || (Array.isArray(v) && v.length === 0)) {
      delete obj[k];
    } else if (Array.isArray(v)) {
      v.forEach(item => {
        if (item && typeof item === 'object') pruneEmpty(item);
      });
    } else if (typeof v === 'object') {
      pruneEmpty(v);
    }
  }
  return obj;
}

function dicomDate(value) {
  const s = String(value ?? '').replaceAll(/[^0-9]/g, '');
  return s || null;
}

function dicomSex(gender) {
  const g = String(gender ?? '').trim().toUpperCase();
  return ['M', 'F', 'O'].includes(g) ? g : null;
}

function dicomTimeNow() {
  const d = new Date();
  const p = (n, w = 2) => String(n).padStart(w, '0');
  return `${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

function patientLevelDataset(study) {
  return {
    PatientName: study.patient_name ?? '',
    PatientID: study.patient_external_id ?? '',
    PatientBirthDate: dicomDate(study.patient_birth_date),
    PatientSex: dicomSex(study.patient_gender),
    StudyInstanceUID: study.study_instance_uid,
    StudyDate: dicomDate(study.study_date),
    StudyID: String(study.id),
    StudyDescription: study.description ?? undefined,
    AccessionNumber: null,
    ReferringPhysicianName: '',
  };
}

function loadStudyMeta(db, studyId) {
  const study = db.prepare(`
    SELECT s.id, s.study_instance_uid, s.study_date, s.description,
           p.name as patient_name, p.external_id as patient_external_id,
           p.birth_date as patient_birth_date, p.gender as patient_gender
    FROM studies s JOIN patients p ON p.id = s.patient_id
    WHERE s.id = ?
  `).get(studyId);
  if (!study) {
    throw Object.assign(new Error('Study not found'), { status: 404 });
  }
  return study;
}

// FrameOfReferenceUID lives inside the CT files; parse on demand, cache per study.
const frameOfReferenceCache = new Map(); // studyId -> uid|null

/**
 * dcmjs abbreviates UI values in `Value` for readability and keeps the
 * lossless bytes in `_rawValue`. Overwrite Value with _rawValue for every UI
 * element (recursing into sequences) BEFORE naturalizing, or UIDs come out
 * truncated (e.g. "1.2.840...").
 */
function restoreRawUiValues(dict) {
  for (const el of Object.values(dict)) {
    if (!el || typeof el !== 'object' || !el.vr) continue;
    if (el.vr === 'UI' && Array.isArray(el._rawValue)) {
      el.Value = el._rawValue;
    } else if (el.vr === 'SQ' && Array.isArray(el.Value)) {
      for (const item of el.Value) {
        if (item && typeof item === 'object') restoreRawUiValues(item);
      }
    }
  }
}

function readFrameOfReferenceFromFile(filePath) {
  const buf = readFileSync(filePath);
  const dicomDict = DicomMessage.readFile(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
  restoreRawUiValues(dicomDict.dict);
  const ds = DicomMetaDictionary.naturalizeDataset(dicomDict.dict);
  return ds.FrameOfReferenceUID ?? null;
}

function studyFrameOfReference(db, studyId) {
  if (frameOfReferenceCache.has(studyId)) return frameOfReferenceCache.get(studyId);
  const ct = db.prepare(`
    SELECT file_path FROM dicom_files
    WHERE study_id = ? AND modality = 'CT'
    ORDER BY instance_number LIMIT 1
  `).get(studyId);
  let uid = null;
  try {
    uid = ct ? readFrameOfReferenceFromFile(ct.file_path) : null;
  } catch {
    uid = null; // unreadable file → export continues without FoR
  }
  frameOfReferenceCache.set(studyId, uid);
  return uid;
}

function ctSeriesInfo(db, studyId) {
  const rows = db.prepare(`
    SELECT series_instance_uid as seriesUID, sop_instance_uid as sopUID
    FROM dicom_files
    WHERE study_id = ? AND modality = 'CT'
    ORDER BY instance_number, id
  `).all(studyId);
  if (rows.length === 0) return null;
  return {
    seriesUID: rows[0].seriesUID,
    contourImages: rows.map(r => ({
      ReferencedSOPClassUID: CT_SOP_CLASS,
      ReferencedSOPInstanceUID: r.sopUID,
    })),
  };
}

/** InterpretedType from segment naming convention (PTV/GTV/CTV prefix, else ORGAN). */
function inferROIType(name) {
  const n = String(name).trim().toUpperCase();
  if (n.startsWith('PTV')) return 'PTV';
  if (n.startsWith('GTV')) return 'GTV';
  if (n.startsWith('CTV')) return 'CTV';
  if (n.includes('BOLUS')) return 'EXTERNAL';
  return 'ORGAN';
}

/**
 * Build an RT Structure Set dataset from painted segmentations.
 * @returns {Buffer} complete DICOM file bytes
 */
export function buildRTStructDataset({ study, segmentationRows, contourRows, ctSeries, frameOfReferenceUid, seriesUid, sopInstanceUid, date }) {
  const dataset = {
    _meta: {},
    SpecificCharacterSet: 'ISO_IR 192',
    SOPClassUID: RTSTRUCT_SOP_CLASS,
    SOPInstanceUID: sopInstanceUid,
    Modality: 'RTSTRUCT',
    ...patientLevelDataset(study),
    SeriesInstanceUID: seriesUid,
    SeriesNumber: 1,
    SeriesDescription: 'TPS export',
    StructureSetLabel: String(`study${study.id}`).slice(0, 16),
    StructureSetName: `TPS study ${study.id}`,
    StructureSetDate: date,
    StructureSetTime: dicomTimeNow(),
    InstanceCreationDate: date,
    InstanceCreationTime: dicomTimeNow(),
    Manufacturer: 'myTPS',
    ReferencedFrameOfReferenceSequence: [{
      FrameOfReferenceUID: frameOfReferenceUid ?? generateDicomUid(),
      RTReferencedStudySequence: [{
        ReferencedSOPClassUID: STUDY_SOP_CLASS,
        ReferencedSOPInstanceUID: study.study_instance_uid,
        RTReferencedSeriesSequence: ctSeries ? [{
          SeriesInstanceUID: ctSeries.seriesUID,
          ContourImageSequence: ctSeries.contourImages,
        }] : [],
      }],
    }],
    StructureSetROISequence: segmentationRows.map((seg, idx) => ({
      ROINumber: idx + 1,
      ReferencedFrameOfReferenceUID: frameOfReferenceUid ?? generateDicomUid(),
      ROIName: seg.name,
      ROIDescription: `painted segmentation #${seg.id}`,
      ROIGenerationAlgorithm: 'MANUAL',
    })),
    RTROIObservationsSequence: segmentationRows.map((seg, idx) => ({
      ObservationNumber: idx + 1,
      ReferencedROINumber: idx + 1,
      ObservationLabel: seg.name,
      RTROIInterpretedType: inferROIType(seg.name),
    })),
    ROIContourSequence: segmentationRows.map((seg, idx) => {
      const contours = (contourRows[seg.id] ?? []).map(row => ({
        ContourGeometricType: 'CLOSED_PLANAR',
        NumberOfContourPoints: row.points.length / 3,
        ContourData: row.points,
        ContourImageSequence: row.sopUID ? [{
          ReferencedSOPClassUID: CT_SOP_CLASS,
          ReferencedSOPInstanceUID: row.sopUID,
        }] : undefined,
      }));
      return {
        ReferencedROINumber: idx + 1,
        ContourSequence: contours,
      };
    }),
  };
  return datasetToBuffer(pruneEmpty(dataset));
}

/**
 * Export painted segmentations of a study as an RTSTRUCT.
 * @param {{studyId:number, segmentationIds?:number[]}} params
 * @returns {{buffer: Buffer, filename: string, roiCount: number}}
 */
export function rtStructFromSegmentations({ studyId, segmentationIds, userId, reqId }) {
  const db = getDb();
  const study = loadStudyMeta(db, studyId);

  let segs = db.prepare(`
    SELECT id, name, color FROM segmentations
    WHERE study_id = ?
    ORDER BY id
  `).all(studyId);
  if (segmentationIds?.length) {
    const wanted = new Set(segmentationIds);
    segs = segs.filter(s => wanted.has(s.id));
  }
  if (segs.length === 0) {
    throw Object.assign(new Error('No segmentations to export'), { status: 400 });
  }

  const selectSlices = db.prepare(`
    SELECT sop_instance_uid as sopUID, points_json
    FROM segmentation_slices WHERE segmentation_id = ?
    ORDER BY instance_number, id
  `);
  const contourRows = {};
  for (const seg of segs) {
    contourRows[seg.id] = selectSlices.all(seg.id).map(row => ({
      sopUID: row.sopUID,
      points: JSON.parse(row.points_json).flat(),
    }));
  }
  // empty segments would produce ROIContour items without ContourSequence — skip
  segs = segs.filter(seg => (contourRows[seg.id] ?? []).length > 0);
  if (segs.length === 0) {
    throw Object.assign(new Error('No painted slices to export'), { status: 400 });
  }

  const sopInstanceUid = generateDicomUid();
  const date = new Date().toISOString().slice(0, 10).replaceAll('-', '');
  const buffer = buildRTStructDataset({
    study,
    segmentationRows: segs,
    contourRows,
    ctSeries: ctSeriesInfo(db, studyId),
    frameOfReferenceUid: studyFrameOfReference(db, studyId),
    seriesUid: generateDicomUid(),
    sopInstanceUid,
    date,
  });

  auditLog(db, {
    reqId, userId,
    action: 'export_rtstruct',
    resourceType: 'study', resourceId: studyId,
    metadata: { segmentationIds: segs.map(s => s.id), sopInstanceUid },
  });
  return { buffer, filename: `rtstruct-study${studyId}-${date}.dcm`, roiCount: segs.length };
}

/**
 * Build a minimal RTPLAN dataset from a workspace EBRT plan.
 * Honest limitation: no MLC leaf positions / meterset exist in the workspace
 * model — jaws-only geometry, STATIC beams (VMAT arcs as DYNAMIC with
 * start/stop control points), meterset fields fixed at 0/1.
 * @returns {Buffer}
 */
export function buildRTPlanDataset({ study, plan, seriesUid, sopInstanceUid, date }) {
  const beamDataset = (b) => {
    const beam = {
      BeamNumber: b.beamNumber,
      BeamName: b.name ?? `Beam ${b.beamNumber}`,
      BeamDescription: b.bolus ?? undefined,
      RadiationType: 'PHOTON',
      BeamType: b.beamType === 'STATIC' ? 'STATIC' : 'DYNAMIC',
      TreatmentDeliveryType: 'TREATMENT',
      TreatmentMachineName: plan.machineName ?? '',
      SourceAxisDistance: 1000,
      NumberOfWedges: b.wedgeAngle != null ? 1 : 0,
      WedgeSequence: b.wedgeAngle != null ? [{
        WedgeNumber: 1,
        WedgeID: `W${b.beamNumber}`,
        WedgeType: 'STANDARD',
        WedgeAngle: b.wedgeAngle,
        WedgeOrientation: 0,
      }] : undefined,
      NumberOfCompensators: 0,
      NumberOfBoli: 0,
      NumberOfBlocks: 0,
      FinalCumulativeMetersetWeight: 1,
      CumulativeMetersetWeight: undefined,
      NumberOfControlPoints: b.beamType === 'VMAT' && b.gantryAngleStop != null ? 2 : 1,
      ControlPointSequence: [{
        ControlPointIndex: 0,
        NominalBeamEnergy: b.energyMv ?? 6,
        GantryAngle: b.gantryAngle ?? 0,
        GantryRotationDirection: 'CW',
        BeamLimitingDeviceAngle: b.collimatorAngle ?? 0,
        BeamLimitingDeviceRotationDirection: 'CW',
        PatientSupportAngle: b.couchAngle ?? 0,
        PatientSupportRotationDirection: 'CW',
        CumulativeMetersetWeight: 0,
        IsocenterPosition: [plan.isocenterX, plan.isocenterY, plan.isocenterZ],
        BeamLimitingDevicePositionSequence: [
          { RTBeamLimitingDeviceType: 'X', LeafJawPositions: [b.jawX1 ?? -50, b.jawX2 ?? 50] },
          { RTBeamLimitingDeviceType: 'Y', LeafJawPositions: [b.jawY1 ?? -50, b.jawY2 ?? 50] },
        ],
      }],
    };
    if (b.beamType === 'VMAT' && b.gantryAngleStop != null) {
      beam.ControlPointSequence.push({
        ControlPointIndex: 1,
        GantryAngle: b.gantryAngleStop,
        GantryRotationDirection: 'CW',
        CumulativeMetersetWeight: 1,
      });
    }
    return beam;
  };

  const beams = plan.beams ?? [];
  const dataset = {
    _meta: {},
    SpecificCharacterSet: 'ISO_IR 192',
    SOPClassUID: RTPLAN_SOP_CLASS,
    SOPInstanceUID: sopInstanceUid,
    Modality: 'RTPLAN',
    ...patientLevelDataset(study),
    SeriesInstanceUID: seriesUid,
    SeriesNumber: 1,
    SeriesDescription: 'TPS export',
    RTPlanLabel: String(plan.name).slice(0, 16),
    RTPlanName: plan.name,
    RTPlanDate: date,
    RTPlanTime: dicomTimeNow(),
    ApprovalStatus: plan.approvalStatus ?? 'UNAPPROVED',
    RTPlanGeometry: 'SNC',
    Manufacturer: 'myTPS',
    InstanceCreationDate: date,
    InstanceCreationTime: dicomTimeNow(),
    FractionGroupSequence: [{
      FractionGroupNumber: 1,
      NumberOfFractionsPlanned: plan.numberOfFractions ?? 1,
      NumberOfBeams: beams.length,
      NumberOfBrachyApplicationSetups: 0,
      ReferencedBeamSequence: beams.map(b => ({
        ReferencedBeamNumber: b.beamNumber,
        BeamMeterset: 0,
        BeamDose: 0,
      })),
    }],
    BeamSequence: beams.map(beamDataset),
  };
  return datasetToBuffer(pruneEmpty(dataset));
}

/**
 * Export a workspace EBRT plan as a minimal RTPLAN.
 * @returns {{buffer: Buffer, filename: string}}
 */
export function rtPlanFromEbrtPlan({ planId, userId, reqId }) {
  const db = getDb();
  const plan = getPlan({ id: planId, userId, reqId });
  const study = loadStudyMeta(db, plan.studyId);

  const sopInstanceUid = generateDicomUid();
  const date = new Date().toISOString().slice(0, 10).replaceAll('-', '');
  const buffer = buildRTPlanDataset({
    study,
    plan,
    seriesUid: generateDicomUid(),
    sopInstanceUid,
    date,
  });

  auditLog(db, {
    reqId, userId,
    action: 'export_rtplan',
    resourceType: 'ebrt_plan', resourceId: planId,
    metadata: { sopInstanceUid, beamCount: plan.beams?.length ?? 0 },
  });
  return { buffer, filename: `rtplan-${planId}-${date}.dcm` };
}

/** Byte-level passthrough of an imported DICOM file row. */
export function rawFileBytes({ fileId, userId, reqId }) {
  const db = getDb();
  const file = db.prepare(`
    SELECT f.id, f.file_name, f.file_path, f.study_id
    FROM dicom_files f WHERE f.id = ?
  `).get(fileId);
  if (!file) {
    throw Object.assign(new Error('File not found'), { status: 404 });
  }
  let buffer;
  try {
    buffer = readFileSync(file.file_path);
  } catch (err) {
    throw Object.assign(new Error('Stored file is missing on disk'), { status: 410 });
  }
  auditLog(db, {
    reqId, userId,
    action: 'export_raw_file',
    resourceType: 'dicom_file', resourceId: fileId,
    metadata: { bytes: buffer.length },
  });
  return { buffer, filename: file.file_name || `dicom-file-${fileId}.dcm` };
}
