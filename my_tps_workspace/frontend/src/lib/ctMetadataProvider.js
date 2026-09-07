/**
 * Fallback metadata provider for the CT stack.
 *
 * Cornerstone's contour-segmentation renderer needs imagePlaneModule
 * metadata for EVERY imageId in the stack (getClosestImageIdForStackViewport
 * destructures imagePositionPatient). That metadata normally comes from the
 * wadouri provider once a slice's dataset has been downloaded — but slices
 * that are not (yet) cached make the lookup return undefined, which aborts
 * contour mapping for the WHOLE representation.
 *
 * The DICOM import pipeline already stores each slice's geometry
 * (image position / spacing / rows / columns) in the dicom_files table, so
 * we can answer imagePlaneModule queries for any registered slice without
 * downloading it.
 */

let registered = false;
let byFileId = new Map();

/**
 * Register (once) a low-priority imagePlaneModule provider backed by the
 * study's CT file geometry. Safe to call again with newer data — it replaces
 * the lookup table.
 * @param {Array} ctFiles - CT files of the study: { id, image_position_x,
 *   image_position_y, image_position_z, pixel_spacing_x, pixel_spacing_y,
 *   rows, columns }
 */
export function registerCTPlaneMetadataProvider(ctFiles) {
  byFileId = new Map(ctFiles.map(f => [f.id, f]));
  if (registered) return;
  registered = true;

  const provider = (type, imageId) => {
    if (type !== 'imagePlaneModule') return;
    const match = imageId.match(/\/download\/(\d+)\?/);
    if (!match) return;
    const f = byFileId.get(Number(match[1]));
    if (!f || f.image_position_x == null) return;
    const rowSpacing = f.pixel_spacing_x ?? 1;
    const colSpacing = f.pixel_spacing_y ?? 1;
    return {
      imagePositionPatient: [f.image_position_x, f.image_position_y, f.image_position_z],
      imageOrientationPatient: [1, 0, 0, 0, 1, 0],
      rowCosine: [1, 0, 0],
      columnCosine: [0, 1, 0],
      rowSpacing,
      columnSpacing: colSpacing,
      sliceThickness: rowSpacing,
      rows: f.rows ?? 512,
      columns: f.columns ?? 512,
    };
  };

  // Priority: consulted after the wadouri provider (which has higher
  // priority) — this only answers when no dataset is cached.
  window.cornerstone.metaData.addProvider(provider, 1);
}
