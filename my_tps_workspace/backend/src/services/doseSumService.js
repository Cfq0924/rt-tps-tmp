import { randomUUID } from 'crypto';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import dcmjs from 'dcmjs';
import { getDb } from '../db/init.js';
import { auditLog } from '../logging/index.js';
import { getDoseGrid } from './rtDoseService.js';
import { loadStudyMeta, patientLevelDataset, withMediaStorageMeta } from './exportService.js';

const { datasetToBuffer } = dcmjs.data;

const RTDOSE_SOP_CLASS = '1.2.840.10008.5.1.4.1.481.2';

/**
 * Plan sums (Eclipse Ch4.16): voxel-wise addition of two or more dose grids,
 * written out as a derived RTDOSE file (DoseSummationType MULTI_PLAN) that is
 * registered in dicom_files — so it displays, feeds DVH, and exports like any
 * other dose file.
 *
 * Phase 4 M1: grids with differing geometry are trilinearly resampled onto
 * the first input's grid (outside-source voxels contribute 0).
 */

const GEOM_EPS = 1e-3; // mm

/**
 * Trilinearly resample a dose grid onto another geometry (axial HFS).
 * Voxels outside the source grid become 0 cGy (no dose information).
 * Pure function — exported for unit tests.
 * @param {Object} src - getDoseGrid entry {grid, rows, columns, imagePosition, pixelSpacing, gridFrameOffsetVector}
 * @param {Object} dstMeta - target geometry (same shape)
 * @returns {Float32Array} dst-geometry dose grid (cGy)
 */
export function resampleDoseGrid(src, dstMeta) {
  const gfov = src.gridFrameOffsetVector;
  const zLast = gfov[gfov.length - 1];
  const dst = new Float32Array(dstMeta.rows * dstMeta.columns * dstMeta.numberOfFrames);
  const zLo = Math.min(gfov[0], zLast) - 1e-6;
  const zHi = Math.max(gfov[0], zLast) + 1e-6;
  const sample = (kk, ii, jj) => src.grid[kk * src.rows * src.columns + jj * src.columns + ii];
  for (let k = 0; k < dstMeta.numberOfFrames; k++) {
    const zOff = (dstMeta.imagePosition.z + (dstMeta.gridFrameOffsetVector[k] ?? 0)) - src.imagePosition.z;
    if (zOff < zLo || zOff > zHi) continue;
    let k0 = 0;
    while (k0 + 1 < gfov.length && gfov[k0 + 1] < zOff) k0++;
    const k1 = Math.min(k0 + 1, gfov.length - 1);
    const zSpan = gfov[k1] - gfov[k0];
    const tz = zSpan > 0 ? (zOff - gfov[k0]) / zSpan : 0;
    for (let j = 0; j < dstMeta.rows; j++) {
      const y = dstMeta.imagePosition.y + j * dstMeta.pixelSpacing.i;
      const sj = (y - src.imagePosition.y) / src.pixelSpacing.i;
      if (sj < 0 || sj > src.rows - 1) continue;
      const j0 = Math.floor(sj), j1 = Math.min(j0 + 1, src.rows - 1);
      const fj = sj - j0;
      for (let i = 0; i < dstMeta.columns; i++) {
        const x = dstMeta.imagePosition.x + i * dstMeta.pixelSpacing.j;
        const si = (x - src.imagePosition.x) / src.pixelSpacing.j;
        if (si < 0 || si > src.columns - 1) continue;
        const i0 = Math.floor(si), i1 = Math.min(i0 + 1, src.columns - 1);
        const fi = si - i0;
        const v000 = sample(k0, i0, j0), v100 = sample(k1, i0, j0);
        const v010 = sample(k0, i1, j0), v110 = sample(k1, i1, j0);
        const v001 = sample(k0, i0, j1), v101 = sample(k1, i0, j1);
        const v011 = sample(k0, i1, j1), v111 = sample(k1, i1, j1);
        const lerp = (a, b, t) => a + (b - a) * t;
        const v = lerp(
          lerp(lerp(v000, v010, fi), lerp(v001, v011, fi), fj),
          lerp(lerp(v100, v110, fi), lerp(v101, v111, fi), fj),
          tz,
        );
        dst[(k * dstMeta.rows + j) * dstMeta.columns + i] = v;
      }
    }
  }
  return dst;
}

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

  // load grids; inputs with differing geometry are trilinearly resampled
  // onto the first input's grid (M1 cross-geometry sums)
  let reference = null;
  const grids = [];
  for (const fileId of doseFileIds) {
    const grid = await getDoseGrid(fileId, {}, reqId);
    if (reference == null) reference = grid;
    grids.push(
      geometryKey(grid) === geometryKey(reference)
        ? grid.grid
        : resampleDoseGrid(grid, reference),
    );
  }

  // voxel-wise sum in cGy (Float64 accumulation via Number math, stored Float32)
  const sum = new Float32Array(reference.grid.length);
  for (const g of grids) {
    for (let i = 0; i < sum.length; i++) sum[i] += g[i];
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
  const buffer = datasetToBuffer(withMediaStorageMeta(dataset));

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
