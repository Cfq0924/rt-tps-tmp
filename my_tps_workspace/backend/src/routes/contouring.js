import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { getDicomFile } from '../services/dicomService.js';
import { autoSegment } from '../services/contouringService.js';

const router = Router();

// POST /api/contouring/auto — trigger AI auto-segmentation
// Only accepts a registered fileId; the server resolves the file path itself
// (never trust client-supplied filesystem paths)
router.post('/auto', authMiddleware, async (req, res, next) => {
  try {
    const { fileId, organName } = req.body;
    if (!fileId || !organName) {
      return res.status(400).json({ error: 'fileId and organName are required' });
    }

    const file = getDicomFile({
      fileId: parseInt(fileId, 10),
      userId: req.user.userId,
      reqId: req.id,
    });
    if (file.modality !== 'RTSTRUCT') {
      return res.status(400).json({ error: 'File is not an RTSTRUCT' });
    }

    const result = await autoSegment({
      dicomFilePath: file.file_path,
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
