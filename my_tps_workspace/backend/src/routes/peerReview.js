import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import {
  createSession,
  listSessions,
  getSession,
  addComment,
  closeSession,
} from '../services/peerReviewService.js';

const router = Router();

// POST /api/peer-review/plans/:planId/sessions — open a review session
// (plan must be in REVIEWED status)
router.post('/plans/:planId/sessions', authMiddleware, (req, res, next) => {
  try {
    const session = createSession({
      planId: parseInt(req.params.planId, 10),
      userId: req.user.userId,
      userEmail: req.user.email,
      reqId: req.id,
    });
    res.status(201).json({ session });
  } catch (err) {
    next(err);
  }
});

// GET /api/peer-review/sessions?planId=&status= — list sessions
router.get('/sessions', authMiddleware, (req, res, next) => {
  try {
    const sessions = listSessions({
      planId: req.query.planId != null ? parseInt(req.query.planId, 10) : undefined,
      status: req.query.status || undefined,
      userId: req.user.userId,
      reqId: req.id,
    });
    res.json({ sessions });
  } catch (err) {
    next(err);
  }
});

// GET /api/peer-review/sessions/:id — session with comments
router.get('/sessions/:id', authMiddleware, (req, res, next) => {
  try {
    const session = getSession({
      id: parseInt(req.params.id, 10),
      userId: req.user.userId,
      reqId: req.id,
    });
    res.json({ session });
  } catch (err) {
    next(err);
  }
});

// POST /api/peer-review/sessions/:id/comments — add a comment
// body: { text, location?: { sliceIdx?, structureId?, beamNumber? } }
router.post('/sessions/:id/comments', authMiddleware, (req, res, next) => {
  try {
    const session = addComment({
      sessionId: parseInt(req.params.id, 10),
      text: req.body?.text,
      location: req.body?.location,
      userId: req.user.userId,
      userEmail: req.user.email,
      reqId: req.id,
    });
    res.status(201).json({ session });
  } catch (err) {
    next(err);
  }
});

// POST /api/peer-review/sessions/:id/close — record decision (updates plan approval)
// body: { decision: 'APPROVED' | 'UNAPPROVED' }
router.post('/sessions/:id/close', authMiddleware, (req, res, next) => {
  try {
    const session = closeSession({
      sessionId: parseInt(req.params.id, 10),
      decision: req.body?.decision,
      deltaCouch: req.body?.deltaCouch,
      userId: req.user.userId,
      userEmail: req.user.email,
      reqId: req.id,
    });
    res.json({ session });
  } catch (err) {
    next(err);
  }
});

export default router;
