import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { getDicomFile } from '../services/dicomService.js';
import { parseRTPlan } from '../services/rtPlanService.js';

const router = Router();

// Parsed-plan cache: RTPLAN parsing walks ~1500 control points; repeated
// panel refreshes shouldn't re-parse the file. Small LRU (plans are rare).
const planCache = new Map();
const PLAN_CACHE_MAX = 4;

// GET /api/rtplan/:fileId — parse an RTPLAN file and return the plan JSON
router.get('/:fileId', authMiddleware, async (req, res, next) => {
  try {
    const fileId = parseInt(req.params.fileId, 10);
    if (planCache.has(fileId)) {
      return res.json(planCache.get(fileId));
    }

    const file = getDicomFile({ fileId, userId: req.user.userId, reqId: req.id });
    if (file.modality !== 'RTPLAN') {
      return res.status(400).json({ error: 'File is not an RTPLAN' });
    }

    const plan = await parseRTPlan(file.file_path);
    const payload = { fileId, fileName: file.file_name, ...plan };

    if (planCache.size >= PLAN_CACHE_MAX) {
      planCache.delete(planCache.keys().next().value);
    }
    planCache.set(fileId, payload);

    res.json(payload);
  } catch (err) {
    next(err);
  }
});

export default router;
