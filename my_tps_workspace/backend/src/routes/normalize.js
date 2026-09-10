import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { normalizePlanDose } from '../services/normalizationService.js';

const router = Router();

// POST /ebrt/plans/:id/normalize — rescale the plan's dose grid
// body: { mode, value? } — see PLAN-EBRT-BACKEND.md for modes
router.post('/plans/:id/normalize', authMiddleware, async (req, res, next) => {
  try {
    // value passes through raw: PERCENT_COVERS sends { cover, ofVolume } and
    // REFERENCE_POINT sends a point name — the service validates each shape
    const result = await normalizePlanDose({
      planId: parseInt(req.params.id, 10),
      mode: req.body?.mode,
      value: req.body?.value,
      userId: req.user.userId,
      reqId: req.id,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
