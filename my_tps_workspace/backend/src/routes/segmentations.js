import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import {
  listSegmentations,
  createSegmentation,
  getSegmentationMeta,
  updateSegmentationMeta,
  deleteSegmentation,
  getContours,
  saveContours,
} from '../services/segmentationService.js';

const router = Router();

// GET /api/segmentations/study/:studyId — list segmentations of a study
router.get('/study/:studyId', authMiddleware, (req, res, next) => {
  try {
    const rows = listSegmentations({
      studyId: parseInt(req.params.studyId, 10),
      userId: req.user.userId,
      reqId: req.id,
    });
    res.json({ segmentations: rows });
  } catch (err) {
    next(err);
  }
});

// POST /api/segmentations/study/:studyId — create a segmentation
router.post('/study/:studyId', authMiddleware, (req, res, next) => {
  try {
    const { name, color, interpretedType } = req.body;
    const row = createSegmentation({
      studyId: parseInt(req.params.studyId, 10),
      name,
      color,
      interpretedType,
      userId: req.user.userId,
      reqId: req.id,
    });
    res.status(201).json({ segmentation: row });
  } catch (err) {
    next(err);
  }
});

// GET /api/segmentations/:id — metadata
router.get('/:id', authMiddleware, (req, res, next) => {
  try {
    const row = getSegmentationMeta({
      id: parseInt(req.params.id, 10),
      userId: req.user.userId,
      reqId: req.id,
    });
    res.json({ segmentation: row });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/segmentations/:id — rename / recolor / approve / interpreted type
router.patch('/:id', authMiddleware, (req, res, next) => {
  try {
    const { name, color, approved, interpretedType } = req.body;
    const row = updateSegmentationMeta({
      id: parseInt(req.params.id, 10),
      name,
      color,
      approved,
      interpretedType,
      userId: req.user.userId,
      reqId: req.id,
    });
    res.json({ segmentation: row });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/segmentations/:id
router.delete('/:id', authMiddleware, (req, res, next) => {
  try {
    const result = deleteSegmentation({
      id: parseInt(req.params.id, 10),
      userId: req.user.userId,
      reqId: req.id,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /api/segmentations/:id/contours — all contours of a segmentation
router.get('/:id/contours', authMiddleware, (req, res, next) => {
  try {
    const data = getContours({
      id: parseInt(req.params.id, 10),
      userId: req.user.userId,
      reqId: req.id,
    });
    res.json(data);
  } catch (err) {
    next(err);
  }
});

// PUT /api/segmentations/:id/contours — replace all contours (whole save).
// Payload validation happens in the service (throws 400).
router.put('/:id/contours', authMiddleware, (req, res, next) => {
  try {
    const result = saveContours({
      id: parseInt(req.params.id, 10),
      slices: req.body?.slices,
      userId: req.user.userId,
      reqId: req.id,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
