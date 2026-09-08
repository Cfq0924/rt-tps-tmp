import { randomUUID } from 'crypto';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import dcmjs from 'dcmjs';
import { getDb } from '../db/init.js';
import { auditLog } from '../logging/index.js';
import { getDoseGrid } from './rtDoseService.js';
import { loadStudyMeta, patientLevelDataset } from './exportService.js';

const { datasetToBuffer } = dcmjs.data;

const RTDOSE_SOP_CLASS = '1.2.840.10008.5.1.4.1.481.2';

/**
 * Plan sums (Eclipse Ch4.16): voxel-wise addition of two or more dose grids
 * with identical geometry, written out as a derived RTDOSE file
 * (DoseSummationType MULTI_PLAN) that is registered in dicom_files — so it
 * displays, feeds DVH, and exports like any other dose file.
 *
 * Phase 3 scope: same geometry only. Registered (resampled) sums are Phase 4.
 */

const GEOM_EPS = 1e-3; // mm

function geometryKey(g) {
  return JSON.stringify([
    g.rows, g.columns, g.numberOfFrames,
    g.imagePosition.x, g.imagePosition.y, g.imagePosition.z,
    g.pixelSpacing.i, g.pixelSpacing.j,
    g.gridFrameOffsetVector.map(v => Number(Number(v).toFixed(4))),
  ]);
}

function uploadDir() {
  return process.env.UPLOAD_DIR || join(new URL('.', import.meta.url).pathname, '../../uploads');
}

export async function createDoseSum({ studyId, doseFileIds, name, userId, reqId }) {
  const db = getDb();
  if (!Array.isArray(doseFileIds) || doseFileIds.length < 2) {
    throw Object.assign(new Error('a dose sum needs at least two dose file ids'), { status: 400 });
  }
  const uniqueIds = [...new Set(doseFileIds)];
  if (uniqueIds.length !== doseFileIds.length) {
    throw Object.assign(new Error('duplicate dose file ids in sum'), { status: 400 });
  }
  if (!name || !String(name).trim()) {
    throw Object.assign(new Error('name is required'), { status: 400 });
  }

  // load + validate geometry (identical, within tolerance)
  const grids = [];
  let reference = null;
  for (const fileId of doseFileIds) {
    const grid = await getDoseGrid(fileId, {}, reqId);
    if (reference == null) reference = grid;
    if (geometryKey(grid) !== geometryKey(reference)) {
      throw Object.assign(
        new Error('Dose grids have different geometry — registered sums are not supported yet'),
        { status: 400 },
      );
    }
    grids.push(grid);
  }

  // voxel-wise sum in cGy (Float64 accumulation via Number math, stored Float32)
  const sum = new Float32Array(reference.grid.length);
  for (const g of grids) {
    for (let i = 0; i < sum.length; i++) sum[i] += g.grid[i];
  }

  // encode as signed 32-bit pixel data with a fixed 1e-5 Gy (= 0.001 cGy)
  // step — a clean DS value that survives dcmjs write/read without the
  // precision loss scientific notation would introduce. Cap: 21474 cGy/voxel.
  const scalingGy = 1e-5;
  const maxCgy = sum.reduce((m, v) => (v > m ? v : m), 0);
  const pixels = new Int32Array(sum.length);
  for (let i = 0; i < sum.length; i++) pixels[i] = Math.round(sum[i] / 100 / scalingGy);
  const pixelBytes = new Uint8Array(pixels.buffer);

  const sopInstanceUid = `2.25.${BigInt('0x' + randomUUID().replaceAll('-', ''))}`;
  const seriesUid = `2.25.${BigInt('0x' + randomUUID().replaceAll('-', ''))}`;
  const date = new Date().toISOString().slice(0, 10).replaceAll('-', '');
  const now = new Date();
  const p = (n, w = 2) => String(n).padStart(w, '0');
  const time = `${p(now.getHours())}${p(now.getMinutes())}${p(now.getSeconds())}`;

  const dataset = {
    _meta: {},
    SpecificCharacterSet: 'ISO_IR 192',
    SOPClassUID: RTDOSE_SOP_CLASS,
    SOPInstanceUID: sopInstanceUid,
    Modality: 'RTDOSE',
    ...patientLevelDataset(loadStudyMeta(db, studyId)),
    SeriesInstanceUID: seriesUid,
    SeriesNumber: 1,
    SeriesDescription: `Dose sum: ${String(name).slice(0, 40)}`,
    InstanceCreationDate: date,
    InstanceCreationTime: time,
    Manufacturer: 'myTPS',
    SamplesPerPixel: 1,
    PhotometricInterpretation: 'MONOCHROME2',
    Rows: reference.rows,
    Columns: reference.columns,
    NumberOfFrames: reference.numberOfFrames,
    BitsAllocated: 32,
    BitsStored: 32,
    HighBit: 31,
    PixelRepresentation: 1,
    ImagePositionPatient: [
      reference.imagePosition.x, reference.imagePosition.y, reference.imagePosition.z,
    ],
    ImageOrientationPatient: [1, 0, 0, 0, 1, 0],
    PixelSpacing: [reference.pixelSpacing.i, reference.pixelSpacing.j],
    FrameIncrementPointer: '3004000C',
    GridFrameOffsetVector: reference.gridFrameOffsetVector,
    DoseUnits: 'GY',
    DoseType: 'PLAN',
    DoseSummationType: 'MULTI_PLAN',
    DoseGridScaling: '0.00001',
    TissueHeterogeneityCorrection: 'IMAGE',
    PixelData: pixelBytes,
  };
  const buffer = datasetToBuffer(dataset);

  // store the file and register it as a first-class RTDOSE
  const dir = join(uploadDir(), 'dose-sums');
  mkdirSync(dir, { recursive: true });
  const fileName = `dose-sum-${studyId}-${Date.now()}.dcm`;
  const filePath = join(dir, fileName);
  writeFileSync(filePath, buffer);

  const fileInfo = db.prepare(`
    INSERT INTO dicom_files (study_id, series_instance_uid, sop_instance_uid, modality, instance_number,
      file_path, file_name, file_size, image_position_x, image_position_y, image_position_z,
      pixel_spacing_x, pixel_spacing_y, rows, columns)
    VALUES (?, ?, ?, 'RTDOSE', 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    studyId, seriesUid, sopInstanceUid, filePath, fileName, buffer.length,
    reference.imagePosition.x, reference.imagePosition.y, reference.imagePosition.z,
    reference.pixelSpacing.i, reference.pixelSpacing.j, reference.rows, reference.columns,
  );

  const info = db.prepare(`
    INSERT INTO dose_sums (study_id, name, output_file_id, input_file_ids_json, created_by)
    VALUES (?, ?, ?, ?, ?)
  `).run(studyId, String(name).trim(), fileInfo.lastInsertRowid, JSON.stringify(doseFileIds), userId ?? null);

  auditLog(db, {
    reqId, userId,
    action: 'create_dose_sum',
    resourceType: 'dose_sum', resourceId: info.lastInsertRowid,
    metadata: { studyId, inputs: doseFileIds, outputFileId: fileInfo.lastInsertRowid, maxCgy },
  });

  return getDoseSum({ id: info.lastInsertRowid, userId, reqId });
}

export function getDoseSum({ id, userId, reqId }) {
  const db = getDb();
  const row = db.prepare(`
    SELECT id, study_id as studyId, name, output_file_id as outputFileId,
           input_file_ids_json as inputFileIdsJson, created_by as createdBy, created_at as createdAt
    FROM dose_sums WHERE id = ?
  `).get(id);
  if (!row) {
    throw Object.assign(new Error('Dose sum not found'), { status: 404 });
  }
  return { ...row, inputFileIds: JSON.parse(row.inputFileIdsJson), inputFileIdsJson: undefined };
}

export function listDoseSums({ studyId, userId, reqId }) {
  const db = getDb();
  const rows = db.prepare(`
    SELECT id, study_id as studyId, name, output_file_id as outputFileId,
           input_file_ids_json as inputFileIdsJson, created_by as createdBy, created_at as createdAt
    FROM dose_sums WHERE study_id = ? ORDER BY id DESC
  `).all(studyId).map(r => ({ ...r, inputFileIds: JSON.parse(r.inputFileIdsJson), inputFileIdsJson: undefined }));
  auditLog(db, {
    reqId, userId,
    action: 'list_dose_sums',
    resourceType: 'dose_sum',
    metadata: { studyId, count: rows.length },
  });
  return rows;
}
