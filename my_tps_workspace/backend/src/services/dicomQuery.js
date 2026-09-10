/**
 * Shared DICOM file / dose-grid query helpers.
 *
 * These used to be duplicated per service (normalization, couch report,
 * plan import) with subtly different column picks — keep one definition.
 */

/** Most recent file of a modality within a study (id DESC). */
export function latestFileByModality(db, studyId, modality) {
  return db.prepare(`
    SELECT id, file_path FROM dicom_files
    WHERE study_id = ? AND modality = ?
    ORDER BY id DESC LIMIT 1
  `).get(studyId, modality);
}

/**
 * Nearest-voxel dose (cGy) at a patient-space point, or null when the point
 * is outside the grid or has no coordinates (e.g. a volume-only DPV).
 */
export function sampleDoseAtPoint(grid, doseMeta, pt) {
  if (!pt || pt.x == null || pt.y == null || pt.z == null) return null;
  const { rows, columns, numberOfFrames, imagePosition, pixelSpacing, gridFrameOffsetVector } = doseMeta;
  const i = Math.round((pt.x - imagePosition.x) / pixelSpacing.j);
  const j = Math.round((pt.y - imagePosition.y) / pixelSpacing.i);
  let k = 0, best = Infinity;
  for (let f = 0; f < gridFrameOffsetVector.length; f++) {
    const d = Math.abs(gridFrameOffsetVector[f] - (pt.z - imagePosition.z));
    if (d < best) { best = d; k = f; }
  }
  if (i < 0 || i >= columns || j < 0 || j >= rows || k >= numberOfFrames) return null;
  return grid[k * rows * columns + j * columns + i];
}
