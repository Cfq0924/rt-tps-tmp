import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { createDoseSum, listDoseSums, getDoseSum } from '../services/doseSumService.js';

const router = Router();

// POST /api/dose-sums/study/:studyId — sum dose grids
// body: { doseFileIds: number[], name }
router.post('/study/:studyId', authMiddleware, async (req, res, next) => {
  try {
    const sum = await createDoseSum({
      studyId: parseInt(req.params.studyId, 10),
      doseFileIds: req.body?.doseFileIds,
      name: req.body?.name,
      userId: req.user.userId,
      reqId: req.id,
    });
    res.status(201).json({ doseSum: sum });
  } catch (err) {
    next(err);
  }
});

// GET /api/dose-sums/study/:studyId — list sums of a study
router.get('/study/:studyId', authMiddleware, (req, res, next) => {
  try {
    const sums = listDoseSums({
      studyId: parseInt(req.params.studyId, 10),
      userId: req.user.userId,
      reqId: req.id,
    });
    res.json({ doseSums: sums });
  } catch (err) {
    next(err);
  }
});

// GET /api/dose-sums/:id
router.get('/:id', authMiddleware, (req, res, next) => {
  try {
    const sum = getDoseSum({
      id: parseInt(req.params.id, 10),
      userId: req.user.userId,
      reqId: req.id,
    });
    res.json({ doseSum: sum });
  } catch (err) {
    next(err);
  }
});

export default router;
