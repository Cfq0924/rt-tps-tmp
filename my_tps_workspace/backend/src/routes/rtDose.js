import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { getDicomFile } from '../services/dicomService.js';
import { parseRTDose, calculateDoseValue, extractDoseFrame } from '../services/rtDoseService.js';

const router = Router();

// In-memory grid cache: fileId -> { grid, rows, columns, numberOfFrames, ... }
// The dose grid parse allocates ~30MB (32-bit source + Float32 copy); avoid
// re-parsing the 11MB file on every request.
const gridCache = new Map();
const GRID_CACHE_MAX = 4;

async function getDoseGrid(fileId, req) {
  if (gridCache.has(fileId)) {
    return gridCache.get(fileId);
  }

  const file = getDicomFile({ fileId, userId: req.user.userId, reqId: req.id });
  if (file.modality !== 'RTDOSE') {
    throw Object.assign(new Error('File is not an RTDOSE'), { status: 400 });
  }

  const parsed = await parseRTDose(file.file_path);
  const doseUnits = parsed.doseUnits;
  const grid = calculateDoseValue(parsed.pixelData, parsed.doseGridScaling, doseUnits);

  const entry = {
    grid,
    rows: parsed.rows,
    columns: parsed.columns,
    numberOfFrames: parsed.numberOfFrames,
    imagePosition: parsed.imagePosition,
    imageOrientation: parsed.imageOrientation,
    pixelSpacing: parsed.pixelSpacing,
    gridFrameOffsetVector: parsed.gridFrameOffsetVector,
    doseUnits,
    doseType: parsed.doseType,
    doseSummationType: parsed.doseSummationType,
    maxDose: computeMaxDose(grid),
  };

  if (gridCache.size >= GRID_CACHE_MAX) {
    const oldest = gridCache.keys().next().value;
    gridCache.delete(oldest);
  }
  gridCache.set(fileId, entry);
  return entry;
}

function computeMaxDose(grid) {
  let maxDose = 0;
  for (let i = 0; i < grid.length; i++) {
    if (grid[i] > maxDose) maxDose = grid[i];
  }
  return maxDose;
}

// GET /api/rtdose/:fileId - Parse RTDOSE and return dose grid metadata
router.get('/:fileId', authMiddleware, async (req, res, next) => {
  try {
    const fileId = parseInt(req.params.fileId, 10);
    const dose = await getDoseGrid(fileId, req);

    res.json({
      fileId,
      doseGridScalingPresent: dose.grid.length > 0,
      doseType: dose.doseType,
      doseUnits: dose.doseUnits,
      doseSummationType: dose.doseSummationType,
      rows: dose.rows,
      columns: dose.columns,
      numberOfFrames: dose.numberOfFrames,
      imagePosition: dose.imagePosition,
      imageOrientation: dose.imageOrientation,
      pixelSpacing: dose.pixelSpacing,
      gridFrameOffsetVector: dose.gridFrameOffsetVector,
      // cGy — the grid endpoint serves the actual dose values
      maxDose: dose.maxDose,
      gridSize: {
        rows: dose.rows,
        columns: dose.columns,
        frames: dose.numberOfFrames,
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/rtdose/:fileId/grid - Binary dose grid (Float32, cGy, frame-major)
// Optional ?frame=k returns a single frame. Format: little-endian Float32,
// row-major within each frame (x fastest), frames ordered by GridFrameOffsetVector.
router.get('/:fileId/grid', authMiddleware, async (req, res, next) => {
  try {
    const fileId = parseInt(req.params.fileId, 10);
    const dose = await getDoseGrid(fileId, req);

    let payload = dose.grid;
    if (req.query.frame !== undefined) {
      const frame = parseInt(req.query.frame, 10);
      const voxelsPerFrame = dose.rows * dose.columns;
      if (Number.isNaN(frame) || frame < 0 || frame >= dose.numberOfFrames) {
        return res.status(400).json({
          error: 'Invalid frame index',
          detail: `frame must be an integer in [0, ${dose.numberOfFrames - 1}]`,
        });
      }
      payload = extractDoseFrame(dose.grid, frame, voxelsPerFrame);
    }

    const body = Buffer.from(payload.buffer, payload.byteOffset, payload.byteLength);
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Length', body.byteLength);
    res.setHeader('X-Dose-Rows', String(dose.rows));
    res.setHeader('X-Dose-Columns', String(dose.columns));
    res.setHeader('X-Dose-Frames', String(dose.numberOfFrames));
    res.setHeader('X-Dose-Units', 'cGy');
    res.send(body);
  } catch (err) {
    next(err);
  }
});

export default router;
