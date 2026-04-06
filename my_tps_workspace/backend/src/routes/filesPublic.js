import { Router } from 'express';
import { verifySignedUrl } from '../services/dicomService.js';
import { createReadStream } from 'fs';
import { pipeline } from 'stream/promises';

const router = Router();

// GET /api/files/public/download/:fileId?expires=&sig= — HMAC-verified public download
router.get('/download/:fileId', async (req, res, next) => {
  try {
    const { fileId } = req.params;
    const { expires, sig } = req.query;

    if (!expires || !sig) {
      return res.status(403).json({ error: 'Missing signature parameters' });
    }

    // Verify HMAC signature
    const file = verifySignedUrl({ fileId, expires, sig });

    // Stream file to response
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${file.file_name || file.sop_instance_uid}.dcm"`);

    await pipeline(createReadStream(file.file_path), res);
  } catch (err) {
    next(err);
  }
});

export default router;
