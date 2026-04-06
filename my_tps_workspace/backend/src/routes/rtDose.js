import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { getDicomFile } from '../services/dicomService.js';
import { parseRTDose, calculateDoseValue } from '../services/rtDoseService.js';

const router = Router();

// GET /api/rtstruct/:fileId - Parse RTSTRUCT and return ROI/contour data
// Note: For RT Dose, use /api/rtdose/:fileId
router.get('/:fileId', authMiddleware, async (req, res, next) => {
  try {
    const fileId = parseInt(req.params.fileId, 10);
    const file = getDicomFile({
      fileId,
      userId: req.user.userId,
      reqId: req.id,
    });

    if (file.modality !== 'RTDOSE') {
      return res.status(400).json({ error: 'File is not an RTDOSE' });
    }

    const result = await parseRTDose(file.file_path);

    // Calculate dose values
    const doseValues = calculateDoseValue(result.pixelData, result.doseGridScaling);

    // Find max dose
    let maxDose = 0;
    for (let i = 0; i < doseValues.length; i++) {
      if (doseValues[i] > maxDose) maxDose = doseValues[i];
    }

    res.json({
      fileId,
      doseGridScaling: result.doseGridScaling,
      doseType: result.doseType,
      doseUnits: result.doseUnits,
      rows: result.rows,
      columns: result.columns,
      numberOfFrames: result.numberOfFrames,
      imagePosition: result.imagePosition,
      imageOrientation: result.imageOrientation,
      pixelSpacing: result.pixelSpacing,
      maxDose,
      // Return grid dimensions for frontend coordinate transformation
      gridSize: {
        rows: result.rows,
        columns: result.columns,
        frames: result.numberOfFrames,
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
