import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { autoSegment } from '../services/contouringService.js';

const router = Router();

// POST /api/contouring/auto — trigger AI auto-segmentation
router.post('/auto', authMiddleware, async (req, res, next) => {
  try {
    const { dicomFilePath, organName } = req.body;
    if (!dicomFilePath || !organName) {
      return res.status(400).json({ error: 'dicomFilePath and organName are required' });
    }

    const result = await autoSegment({
      dicomFilePath,
      organName,
      userId: req.user.userId,
      reqId: req.id,
    });

    res.json({ result });
  } catch (err) {
    next(err);
  }
});

export default router;
