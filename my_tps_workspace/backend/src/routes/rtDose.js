import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { getDoseGrid } from '../services/rtDoseService.js';

const router = Router();


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
