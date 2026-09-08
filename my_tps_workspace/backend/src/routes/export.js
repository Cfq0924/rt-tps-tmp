import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import {
  rtStructFromSegmentations,
  rtPlanFromEbrtPlan,
  rawFileBytes,
} from '../services/exportService.js';

const router = Router();

function sendDicom(res, { buffer, filename }) {
  res.setHeader('Content-Type', 'application/dicom');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Content-Length', buffer.length);
  res.status(200).end(buffer);
}

// GET /api/export/study/:studyId/rtstruct?segmentationIds=1,2,3
// Painted segmentations → DICOM RT Structure Set. Without segmentationIds,
// every segmentation of the study is included.
router.get('/study/:studyId/rtstruct', authMiddleware, (req, res, next) => {
  try {
    const ids = req.query.segmentationIds
      ? String(req.query.segmentationIds).split(',').map(v => parseInt(v, 10)).filter(Number.isInteger)
      : undefined;
    const result = rtStructFromSegmentations({
      studyId: parseInt(req.params.studyId, 10),
      segmentationIds: ids,
      userId: req.user.userId,
      reqId: req.id,
    });
    sendDicom(res, result);
  } catch (err) {
    next(err);
  }
});

// GET /api/export/ebrt/plan/:planId/rtplan — workspace plan → minimal RTPLAN
router.get('/ebrt/plan/:planId/rtplan', authMiddleware, (req, res, next) => {
  try {
    const result = rtPlanFromEbrtPlan({
      planId: parseInt(req.params.planId, 10),
      userId: req.user.userId,
      reqId: req.id,
    });
    sendDicom(res, result);
  } catch (err) {
    next(err);
  }
});

// GET /api/export/file/:fileId — byte-level passthrough of an imported file
router.get('/file/:fileId', authMiddleware, (req, res, next) => {
  try {
    const result = rawFileBytes({
      fileId: parseInt(req.params.fileId, 10),
      userId: req.user.userId,
      reqId: req.id,
    });
    sendDicom(res, result);
  } catch (err) {
    next(err);
  }
});

export default router;
