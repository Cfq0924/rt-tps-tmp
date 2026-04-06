import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { getStudy, getStudiesByPatient } from '../services/studyService.js';
import { getDicomFilesByStudy, getRtStructForStudy } from '../services/dicomService.js';

const router = Router();

// GET /api/studies/:id — get study with files
router.get('/:id', authMiddleware, (req, res, next) => {
  try {
    const study = getStudy({
      id: parseInt(req.params.id, 10),
      userId: req.user.userId,
      reqId: req.id,
    });
    res.json({ study });
  } catch (err) {
    next(err);
  }
});

// GET /api/studies/patient/:patientId — list studies for a patient
router.get('/patient/:patientId', authMiddleware, (req, res, next) => {
  try {
    const studies = getStudiesByPatient({
      patientId: parseInt(req.params.patientId, 10),
      userId: req.user.userId,
      reqId: req.id,
    });
    res.json({ studies });
  } catch (err) {
    next(err);
  }
});

// GET /api/studies/:id/files — get all DICOM files for a study
router.get('/:id/files', authMiddleware, (req, res, next) => {
  try {
    const files = getDicomFilesByStudy({
      studyId: parseInt(req.params.id, 10),
      userId: req.user.userId,
      reqId: req.id,
    });
    res.json({ files });
  } catch (err) {
    next(err);
  }
});

// GET /api/studies/:id/rtstruct — get RTSTRUCT files for a study (for contouring)
router.get('/:id/rtstruct', authMiddleware, (req, res, next) => {
  try {
    const files = getRtStructForStudy({
      studyId: parseInt(req.params.id, 10),
      userId: req.user.userId,
      reqId: req.id,
    });
    res.json({ files });
  } catch (err) {
    next(err);
  }
});

export default router;
