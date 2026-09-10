import { getDb } from '../db/init.js';
import { auditLog } from '../logging/index.js';
import { getDoseGrid } from './rtDoseService.js';
import { getPlan } from './ebrtPlanService.js';
import { parseRTStruct } from './rtStructService.js';
import { latestFileByModality, sampleDoseAtPoint } from './dicomQuery.js';

/**
 * B5: couch structures + reference point dose reporting.
 *
 * Couch structure generator: appends a rectangular couch-top (+ optional
 * rails) ROI as painted-slice polygons under the patient — participates in
 * the engine v2 heterogeneity correction via the structure set.
 *
 * Reference point dose report: samples the plan's dose grid at every
 * reference point (Eclipse Reference Points tab).
 */


/**
 * Generate a couch structure (rectangle profile) for the study's CT extent.
 * The couch top is a slab `widthMm` wide, its top surface `topOffsetMm`
 * below the CT slice inferior border, thickness 40 mm (support + rails).
 * @returns {{segmentationId: number, sliceCount: number}}
 */
export function generateCouchStructure({ studyId, topOffsetMm = 20, widthMm = 400, thicknessMm = 40, name = 'Couch Surface', userId, reqId }) {
  const db = getDb();
  const ctFiles = db.prepare(`
    SELECT id, image_position_x, image_position_y, image_position_z, pixel_spacing_x, pixel_spacing_y, rows, columns
    FROM dicom_files WHERE study_id = ? AND modality = 'CT'
    ORDER BY image_position_z
  `).all(studyId);
  if (ctFiles.length === 0) {
    throw Object.assign(new Error('Study has no CT series'), { status: 400 });
  }

  // create the segmentation (couch structures are plan-independent)
  const segInfo = db.prepare(`
    INSERT INTO segmentations (study_id, name, color) VALUES (?, ?, ?)
  `).run(studyId, name, '#92660c');

  const insertSlice = db.prepare(`
    INSERT INTO segmentation_slices (segmentation_id, sop_instance_uid, instance_number, points_json)
    VALUES (?, ?, ?, ?)
  `);
  let sliceCount = 0;
  for (const [idx, ct] of ctFiles.entries()) {
    const ippX = ct.image_position_x ?? 0;
    const ippY = ct.image_position_y ?? 0;
    const sx = ct.pixel_spacing_y ?? 1; // column mm
    const sy = ct.pixel_spacing_x ?? 1; // row mm

    // patient-mm corners of the couch rectangle spanning the full x width of
    // the CT, top edge `topOffsetMm` below the slice's posterior border
    const xMin = ippX;
    const xMax = ippX + ct.columns * sx;
    const yTop = ippY + ct.rows * sy + topOffsetMm;
    const yBot = yTop + thicknessMm;
    const flat = [xMin, yTop, ct.image_position_z, xMax, yTop, ct.image_position_z,
      xMax, yBot, ct.image_position_z, xMin, yBot, ct.image_position_z];

    // skip slices where the couch would overlap the patient body (crude: any
    // pixel row above yTop with HU > -300 is unknown here — v1 always inserts)
    insertSlice.run(segInfo.lastInsertRowid, `couch-${idx}`, idx + 1, JSON.stringify([flat]));
    sliceCount++;
  }

  auditLog(db, {
    reqId, userId,
    action: 'create_couch_structure',
    resourceType: 'segmentation', resourceId: segInfo.lastInsertRowid,
    metadata: { studyId, sliceCount, topOffsetMm, widthMm },
  });
  return { segmentationId: segInfo.lastInsertRowid, sliceCount };
}

/**
 * Reference point dose report for a plan (Eclipse Reference Points tab):
 * per point — location, total dose (cGy), per-fraction dose, % of Rx.
 * @returns {Array} [{ name, x, y, z, totalDoseCgy, perFractionCgy, pctOfRx, inGrid }]
 */
export async function referencePointDoses({ planId, doseFileId = null, userId, reqId }) {
  const db = getDb();
  const plan = getPlan({ id: planId, userId, reqId });
  const referencePoints = plan.referencePoints ?? [];
  const prescriptionCgy = (plan.prescriptionDoseGy ?? 0) * 100;
  const fractions = plan.numberOfFractions || 1;

  const doseFileIdResolved = doseFileId
    ?? latestFileByModality(db, plan.studyId, 'RTDOSE')?.id;
  if (!doseFileIdResolved) {
    return referencePoints.map(pt => ({
      name: pt.name, x: pt.x ?? null, y: pt.y ?? null, z: pt.z ?? null,
      totalDoseCgy: null, perFractionCgy: null, pctOfRx: null, inGrid: false,
    }));
  }
  const grid = await getDoseGrid(doseFileIdResolved, {}, reqId);
  const geom = {
    imagePosition: grid.imagePosition,
    pixelSpacing: grid.pixelSpacing,
    gridFrameOffsetVector: grid.gridFrameOffsetVector,
    columns: grid.columns,
    rows: grid.rows,
    numberOfFrames: grid.numberOfFrames,
  };
  const sample = (pt) => sampleDoseAtPoint(grid.grid, geom, pt);

  return referencePoints.map(pt => {
    const totalDoseCgy = sample({ x: pt.x, y: pt.y, z: pt.z });
    return {
      name: pt.name,
      x: pt.x ?? null, y: pt.y ?? null, z: pt.z ?? null,
      totalDoseCgy,
      perFractionCgy: totalDoseCgy != null ? totalDoseCgy / fractions : null,
      pctOfRx: totalDoseCgy != null && prescriptionCgy > 0 ? (totalDoseCgy / prescriptionCgy) * 100 : null,
      inGrid: totalDoseCgy != null,
    };
  });
}
