import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { listDestinations, createDestination, sendToPacs } from '../services/pacsService.js';

const router = Router();

// GET /api/pacs/destinations — configured C-STORE targets
router.get('/destinations', authMiddleware, (req, res, next) => {
  try {
    const destinations = listDestinations({ userId: req.user.userId, reqId: req.id });
    res.json({ destinations });
  } catch (err) {
    next(err);
  }
});

// POST /api/pacs/destinations — add a destination
// body: { name, aet, host, port, description? }
router.post('/destinations', authMiddleware, (req, res, next) => {
  try {
    const destination = createDestination({
      name: req.body?.name,
      aet: req.body?.aet,
      host: req.body?.host,
      port: req.body?.port,
      description: req.body?.description,
      userId: req.user.userId,
      reqId: req.id,
    });
    res.status(201).json({ destination });
  } catch (err) {
    next(err);
  }
});

// POST /api/pacs/send — push files to a destination via C-STORE
// body: { destinationId, fileIds: number[] }
router.post('/send', authMiddleware, async (req, res, next) => {
  try {
    const result = await sendToPacs({
      destinationId: parseInt(req.body?.destinationId, 10),
      fileIds: req.body?.fileIds,
      userId: req.user.userId,
      reqId: req.id,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
