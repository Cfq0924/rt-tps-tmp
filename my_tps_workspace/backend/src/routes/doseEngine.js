import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { computeAndStoreDose } from '../services/doseEngineService.js';

const router = Router();

// POST /api/dose-engine/study/:studyId/compute
// body: { referenceDoseFileId, planId, prescriptionCgy? }
// Water-equivalent analytical prototype (M5a): computes the plan dose on the
// reference dose geometry and stores it as a first-class RTDOSE.
router.post('/study/:studyId/compute', authMiddleware, async (req, res, next) => {
  try {
    const result = await computeAndStoreDose({
      studyId: parseInt(req.params.studyId, 10),
      referenceDoseFileId: parseInt(req.body?.referenceDoseFileId, 10),
      planId: parseInt(req.body?.planId, 10),
      prescriptionCgy: req.body?.prescriptionCgy != null ? Number(req.body.prescriptionCgy) : undefined,
      userId: req.user.userId,
      reqId: req.id,
    });
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
