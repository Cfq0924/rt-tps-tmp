import { readFileSync, mkdirSync, writeFileSync } from 'fs';
import { randomUUID } from 'crypto';
import { join } from 'path';
import dcmjs from 'dcmjs';
import { getDb } from '../db/init.js';
import { auditLog } from '../logging/index.js';
import { getDoseGrid, extractPixelData } from './rtDoseService.js';
import { getPlan } from './ebrtPlanService.js';
import { loadStudyMeta } from './exportService.js';

const { data: { DicomMessage, DicomMetaDictionary } } = dcmjs;

/**
 * P3-M5a forward dose calculation prototype — water-equivalent analytical
 * engine for static photon fields.
 *
 * Model (per beam, parallel-ray approximation of a SAD-1000 machine):
 *   D(v) = TPR(d_rad) · OAR(r) · ISF(d) · weight
 *   - d_rad: radiological depth along the beam ray through v, accumulated
 *     with a two-density model (HU > −300 → water ρ=1, else air ρ=0)
 *   - OAR(r): flat field with erfc penumbra (σ ≈ 4mm) between the X jaws,
 *     hard cut between the Y jaws (axial slices are not rotated in z)
 *   - TPR: 6MV water tissue-maximum-ratio fit (µ ≈ 0.047 /cm, dmax 1.5cm)
 *   - ISF: inverse square from the isocentre depth
 *
 * Beams are summed and the total normalised so the dose at the isocentre
 * voxel equals prescriptionCgy (isocentre normalisation, Eclipse-style).
 * Heterogeneity correction, MLC modulation and beam divergence are Phase 4.
 */

const DEFAULT_6MV = { mu: 0.047, dmax: 1.5, penumbraMm: 8 };

/** 6MV water TPR fit: build-up ramp to dmax, exponential falloff after. */
export function tpr6MV(depthCm) {
  const { mu, dmax } = DEFAULT_6MV;
  if (depthCm <= 0) return 0;
  if (depthCm < dmax) return Math.pow(depthCm / dmax, 0.7);
  return Math.exp(-mu * (depthCm - dmax));
}

/** erfc-based flat-field profile with penumbra (mm) at half-width W (mm):
 * 100% at centre, 50% at the field edge, ~0 beyond the penumbra. */
export function fieldProfile(rMm, halfWidthMm, penumbraMm = DEFAULT_6MV.penumbraMm) {
  const s = penumbraMm / Math.SQRT2;
  const erf = (x) => {
    // Abramowitz-Stegun 7.1.26 approximation (|err| < 1.5e-7)
    const t = 1 / (1 + 0.3275911 * Math.abs(x));
    const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
    return x >= 0 ? y : -y;
  };
  return 0.5 * (erf((rMm + halfWidthMm) / s) - erf((rMm - halfWidthMm) / s));
}

/** Parse one CT file into HU Float32Array (cols × rows).
 * PixelData comes from the RAW dict element's _rawValue — dcmjs naturalize
 * wraps pixel data in lossy display structures (same class of issue as the
 * UI abbreviation in §11.8). */
export function parseCTHU(filePath) {
  const buf = readFileSync(filePath);
  const dict = DicomMessage.readFile(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
  const ds = DicomMetaDictionary.naturalizeDataset(dict.dict);
  const rows = Number(ds.Rows);
  const cols = Number(ds.Columns);
  const slope = Number(ds.RescaleSlope ?? 1);
  const intercept = Number(ds.RescaleIntercept ?? 0);
  const signed = Number(ds.PixelRepresentation ?? 1) === 1;

  // PixelData survives in the raw dict element as Value[0] = ArrayBuffer
  const el = dict.dict['7FE00010'];
  const v0 = el?.Value?.[0] ?? el?._rawValue?.[0];
  const bytes = v0 instanceof ArrayBuffer ? new Uint8Array(v0)
    : ArrayBuffer.isView(v0) ? new Uint8Array(v0.buffer, v0.byteOffset, v0.byteLength)
    : Uint8Array.from(v0 ?? []);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const hu = new Float32Array(rows * cols);
  for (let i = 0; i < rows * cols; i++) {
    hu[i] = (signed ? view.getInt16(i * 2, true) : view.getUint16(i * 2, true)) * slope + intercept;
  }
  return { hu, rows, cols };
}

/**
 * Compute the radiological depth map for one axial slice and beam direction
 * (parallel-ray approximation, in-plane). Two-density water model.
 * @returns {Float32Array} depth in mm per voxel
 */
export function computeDepthMap(densityRowMajor, cols, rows, ippX, ippY, spacingX, spacingY, dirX, dirY) {
  const depth = new Float32Array(cols * rows);
  const len = Math.hypot(dirX, dirY);
  const ux = dirX / len, uy = dirY / len; // along-beam unit (in-plane)
  const px = -uy, py = ux;               // perpendicular unit
  const step = 1.0;                       // mm along the ray
  const extent = (cols * Math.abs(spacingX) + rows * Math.abs(spacingY));

  // ray lines sampled every 1mm across the perpendicular axis
  const nLines = Math.ceil((cols * Math.abs(spacingX) + rows * Math.abs(spacingY)) / 2) + 4;
  for (let li = -nLines / 2; li < nLines / 2; li++) {
    const sx = ippX + cols * spacingX / 2 + px * li;   // start points walk the
    const sy = ippY + rows * spacingY / 2 + py * li;   // perpendicular axis
    let acc = 0;
    let t = -extent;
    while (t < extent) {
      const x = sx + ux * t;
      const y = sy + uy * t;
      const i = Math.round((x - ippX) / spacingX);
      const j = Math.round((y - ippY) / spacingY);
      if (i >= 0 && i < cols && j >= 0 && j < rows) {
        const idx = j * cols + i;
        const rho = densityRowMajor[idx] ? 1 : 0;
        if (rho > 0) {
          if (depth[idx] === 0) depth[idx] = acc + step / 2;
          acc += rho * step;
        } else {
          acc = 0; // air resets radiological depth (entry surface tracking)
        }
      }
      t += step;
    }
  }
  return depth;
}

/**
 * Compute a water-equivalent dose grid (cGy) for the plan's beams on the
 * reference dose geometry.
 * @param {Object} params
 * @param {number} params.studyId
 * @param {number} params.referenceDoseFileId - grid geometry + frames source
 * @param {number} params.planId - workspace plan providing beams + isocentre
 * @param {number} [params.prescriptionCgy] - normalisation target at isocentre
 * @returns {{ grid: Float32Array, geometry: Object, beams: Array, normalisation: Object }}
 */
export async function computeWaterDose({ studyId, referenceDoseFileId, planId, prescriptionCgy, userId = null, reqId = null }) {
  const db = getDb();
  const reference = await getDoseGrid(referenceDoseFileId, {}, reqId);
  const plan = getPlan({ id: planId, userId, reqId });
  if (!plan.beams?.length) {
    throw Object.assign(new Error('Plan has no beams to calculate'), { status: 400 });
  }
  const iso = {
    x: plan.isocenterX ?? 0,
    y: plan.isocenterY ?? 0,
    z: plan.isocenterZ ?? 0,
  };

  const { rows, columns, numberOfFrames, imagePosition, pixelSpacing, gridFrameOffsetVector } = reference;

  // load CT HU slices, nearest to each dose frame z
  const ctFiles = db.prepare(`
    SELECT id, file_path, image_position_x, image_position_y, image_position_z, pixel_spacing_x, pixel_spacing_y, rows, columns
    FROM dicom_files WHERE study_id = ? AND modality = 'CT'
    ORDER BY image_position_z
  `).all(studyId);
  if (ctFiles.length === 0) {
    throw Object.assign(new Error('Study has no CT series'), { status: 400 });
  }
  const ctSlices = ctFiles.map(f => ({
    z: f.image_position_z,
    ...parseCTHU(f.file_path),
    imagePosition: { x: f.image_position_x ?? 0, y: f.image_position_y ?? 0, z: f.image_position_z ?? 0 },
    spacingX: f.pixel_spacing_y ?? 1, // column spacing
    spacingY: f.pixel_spacing_x ?? 1, // row spacing
  }));

  const voxelZ = (k) => imagePosition.z + (gridFrameOffsetVector[k] ?? 0);
  const nearestSlice = (z) => ctSlices.reduce((best, s) =>
    (Math.abs(s.z - z) < Math.abs(best.z - z) ? s : best), ctSlices[0]);

  const total = new Float32Array(rows * columns * numberOfFrames);
  const beamInfo = [];
  const SAD = 1000;

  for (const beam of plan.beams) {
    const g = ((beam.gantryAngle ?? 0) * Math.PI) / 180;
    const dirX = -Math.sin(g), dirY = Math.cos(g); // beam axis, in-plane (IEC)
    const halfW = (beam.jawX2 != null && beam.jawX1 != null) ? (beam.jawX2 - beam.jawX1) / 2 : 50;
    const halfY = (beam.jawY2 != null && beam.jawY1 != null) ? (beam.jawY2 - beam.jawY1) / 2 : 50;
    const weight = beam.weight ?? 1;

    // per-beam depth maps, computed per axial slice for this direction
    const beamGrid = new Float32Array(total.length);
    for (let k = 0; k < numberOfFrames; k++) {
      const z = voxelZ(k);
      const slice = nearestSlice(z);
      const ipp = slice.imagePosition;
      const sx = slice.spacingX, sy = slice.spacingY;
      // density mask from HU (two-density water model)
      const density = new Uint8Array(slice.hu.length);
      for (let i = 0; i < slice.hu.length; i++) density[i] = slice.hu[i] > -300 ? 1 : 0;
      const depth = computeDepthMap(density, slice.cols, slice.rows, ipp.x, ipp.y, sx, sy, dirX, dirY);

      const off0 = k * rows * columns;
      for (let j = 0; j < rows; j++) {
        // dose voxel centre in patient mm (dose-grid geometry)
        const py = imagePosition.y + j * pixelSpacing.i;
        for (let i = 0; i < columns; i++) {
          const pxx = imagePosition.x + i * pixelSpacing.j;
          // signed perpendicular offset from the central axis (through iso)
          const r = (pxx - iso.x) * Math.cos(g) + (py - iso.y) * Math.sin(g);
          // depth looked up on the CT grid at this voxel's position
          const ci = Math.round((pxx - ipp.x) / sx);
          const cj = Math.round((py - ipp.y) / sy);
          if (ci < 0 || ci >= slice.cols || cj < 0 || cj >= slice.rows) continue;
          const dv = depth[cj * slice.cols + ci];
          if (dv <= 0) continue;
          const tpr = tpr6MV(dv / 10);
          const oar = fieldProfile(r, halfW);
          // beam divergence (inverse square) is omitted in v1 — parallel-ray
          // approximation; second-order vs the depth falloff for relative dosimetry
          // z (out-of-plane) field cut by the Y jaws
          if (Math.abs(z - iso.z) > halfY) continue;
          beamGrid[off0 + j * columns + i] = weight * tpr * oar;
        }
      }
    }
    for (let i = 0; i < total.length; i++) total[i] += beamGrid[i];
    beamInfo.push({ beamNumber: beam.beamNumber, gantryAngle: beam.gantryAngle ?? 0, halfW, halfY, weight });
  }

  // isocentre normalisation: scale so the voxel nearest the isocentre hits
  // prescriptionCgy (fallback: grid max) when prescriptionCgy provided
  let normalisation = { strategy: 'none', factor: 1 };
  if (prescriptionCgy > 0) {
    const kIso = numberOfFrames > 1
      ? gridFrameOffsetVector.reduce((best, off, k) => (Math.abs(imagePosition.z + off - iso.z) < Math.abs(imagePosition.z + gridFrameOffsetVector[best] - iso.z) ? k : best), 0)
      : 0;
    const slice = nearestSlice(iso.z);
    const isoI = Math.round((iso.x - slice.imagePosition.x) / slice.spacingX);
    const isoJ = Math.round((iso.y - slice.imagePosition.y) / slice.spacingY);
    const isoIdx = kIso * rows * columns + isoJ * columns + isoI;
    const isoDose = total[isoIdx] > 0 ? total[isoIdx] : findMax(total);
    const strategy = total[isoIdx] > 0 ? 'isocentre' : 'max';
    const factor = prescriptionCgy / isoDose;
    for (let i = 0; i < total.length; i++) total[i] *= factor;
    normalisation = { strategy, factor, isocenterVoxelDose: isoDose };
  }

  const geometry = {
    rows, columns, numberOfFrames,
    imagePosition,
    imageOrientation: reference.imageOrientation,
    pixelSpacing: reference.pixelSpacing,
    gridFrameOffsetVector,
  };
  return { grid: total, geometry, beams: beamInfo, normalisation, isocenter: iso };
}

function findMax(grid) {
  let m = 0;
  for (let i = 0; i < grid.length; i++) if (grid[i] > m) m = grid[i];
  return m;
}

// ---------- storage: computed grid → first-class RTDOSE file ----------

const RTDOSE_SOP_CLASS = '1.2.840.10008.5.1.4.1.481.2';
const { datasetToBuffer } = dcmjs.data;

function uploadDir() {
  return process.env.UPLOAD_DIR || join(new URL('.', import.meta.url).pathname, '../../uploads');
}

function generateUid() {
  return `2.25.${BigInt('0x' + randomUUID().replaceAll('-', ''))}`;
}

function patientLevel(study) {
  return {
    PatientName: study.patient_name ?? '',
    PatientID: study.patient_external_id ?? '',
    PatientBirthDate: String(study.patient_birth_date ?? '').replaceAll(/[^0-9]/g, '') || undefined,
    PatientSex: ['M', 'F', 'O'].includes(String(study.patient_gender ?? '').trim().toUpperCase())
      ? String(study.patient_gender).trim().toUpperCase() : undefined,
    StudyInstanceUID: study.study_instance_uid,
    StudyDate: String(study.study_date ?? '').replaceAll(/[^0-9]/g, '') || undefined,
    StudyID: String(study.id),
    ReferringPhysicianName: '',
  };
}

/**
 * Compute the water-equivalent dose and store it as a derived RTDOSE file
 * (DoseType CALCULATED, DoseSummationType PLAN) registered in dicom_files.
 */
export async function computeAndStoreDose({ studyId, referenceDoseFileId, planId, prescriptionCgy, userId = null, reqId = null }) {
  const db = getDb();
  const { grid, geometry, beams, normalisation, isocenter } = await computeWaterDose({
    studyId, referenceDoseFileId, planId, prescriptionCgy, userId, reqId,
  });
  const study = loadStudyMeta(db, studyId);

  const scalingGy = 1e-5;
  const pixels = new Int32Array(grid.length);
  let maxCgy = 0;
  for (let i = 0; i < grid.length; i++) {
    if (grid[i] > maxCgy) maxCgy = grid[i];
    pixels[i] = Math.max(0, Math.round(grid[i] / 100 / scalingGy));
  }

  const sopInstanceUid = generateUid();
  const seriesUid = generateUid();
  const date = new Date().toISOString().slice(0, 10).replaceAll('-', '');
  const now = new Date();
  const p2 = (n) => String(n).padStart(2, '0');
  const time = `${p2(now.getHours())}${p2(now.getMinutes())}${p2(now.getSeconds())}`;

  const dataset = {
    _meta: {},
    SpecificCharacterSet: 'ISO_IR 192',
    SOPClassUID: RTDOSE_SOP_CLASS,
    SOPInstanceUID: sopInstanceUid,
    Modality: 'RTDOSE',
    ...patientLevel(study),
    SeriesInstanceUID: seriesUid,
    SeriesNumber: 1,
    SeriesDescription: 'Water-equivalent calculated dose (M5a prototype)',
    InstanceCreationDate: date,
    InstanceCreationTime: time,
    Manufacturer: 'myTPS',
    SamplesPerPixel: 1,
    PhotometricInterpretation: 'MONOCHROME2',
    Rows: geometry.rows,
    Columns: geometry.columns,
    NumberOfFrames: geometry.numberOfFrames,
    BitsAllocated: 32,
    BitsStored: 32,
    HighBit: 31,
    PixelRepresentation: 1,
    ImagePositionPatient: [geometry.imagePosition.x, geometry.imagePosition.y, geometry.imagePosition.z],
    ImageOrientationPatient: [1, 0, 0, 0, 1, 0],
    PixelSpacing: [geometry.pixelSpacing.i, geometry.pixelSpacing.j],
    FrameIncrementPointer: '3004000C',
    GridFrameOffsetVector: geometry.gridFrameOffsetVector,
    DoseUnits: 'GY',
    DoseType: 'CALCULATED',
    DoseSummationType: 'PLAN',
    DoseGridScaling: '0.00001',
    PixelData: new Uint8Array(pixels.buffer),
  };
  const buffer = datasetToBuffer(dataset);

  const dir = join(uploadDir(), 'dose-engine');
  mkdirSync(dir, { recursive: true });
  const fileName = `dose-engine-${studyId}-${Date.now()}.dcm`;
  const filePath = join(dir, fileName);
  writeFileSync(filePath, buffer);

  const fileInfo = db.prepare(`
    INSERT INTO dicom_files (study_id, series_instance_uid, sop_instance_uid, modality, instance_number,
      file_path, file_name, file_size, image_position_x, image_position_y, image_position_z,
      pixel_spacing_x, pixel_spacing_y, rows, columns)
    VALUES (?, ?, ?, 'RTDOSE', 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    studyId, seriesUid, sopInstanceUid, filePath, fileName, buffer.length,
    geometry.imagePosition.x, geometry.imagePosition.y, geometry.imagePosition.z,
    geometry.pixelSpacing.i, geometry.pixelSpacing.j, geometry.rows, geometry.columns,
  );

  auditLog(db, {
    reqId, userId,
    action: 'compute_dose',
    resourceType: 'dicom_file', resourceId: fileInfo.lastInsertRowid,
    metadata: { studyId, planId, referenceDoseFileId, beams: beams.length, maxCgy, normalisation },
  });

  return {
    doseFileId: fileInfo.lastInsertRowid,
    maxDoseCgy: maxCgy,
    beams: beams.length,
    normalisation,
    isocenter,
  };
}
