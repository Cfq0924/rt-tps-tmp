import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { getDicomFile } from '../services/dicomService.js';
import { parseRTStruct, getContoursForSlice } from '../services/rtStructService.js';

const router = Router();

// GET /api/rtstruct/:fileId - Parse RTSTRUCT and return ROI/contour data
router.get('/:fileId', authMiddleware, async (req, res, next) => {
  try {
    const fileId = parseInt(req.params.fileId, 10);
    const file = getDicomFile({
      fileId,
      userId: req.user.userId,
      reqId: req.id,
    });

    if (file.modality !== 'RTSTRUCT') {
      return res.status(400).json({ error: 'File is not an RTSTRUCT' });
    }

    const result = await parseRTStruct(file.file_path);

    res.json({
      fileId,
      roiSequence: result.roiSequence,
      contourSequence: result.contourSequence,
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/rtstruct/:fileId/slice/:sopInstanceUID - Get contours for a specific CT slice
router.get('/:fileId/slice/:sopInstanceUID', authMiddleware, async (req, res, next) => {
  try {
    const fileId = parseInt(req.params.fileId, 10);
    const { sopInstanceUID } = req.params;

    const file = getDicomFile({
      fileId,
      userId: req.user.userId,
      reqId: req.id,
    });

    if (file.modality !== 'RTSTRUCT') {
      return res.status(400).json({ error: 'File is not an RTSTRUCT' });
    }

    const result = await parseRTStruct(file.file_path);
    const contours = getContoursForSlice(result.contourSequence, sopInstanceUID);

    res.json({
      sopInstanceUID,
      contours,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
