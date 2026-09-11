import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import {
  saveRegistration,
  listRegistrations,
  getRegistration,
  getLatestRegistration,
  createDerivedSeries,
  listDerivedSeries,
} from '../services/registrationService.js';

const router = Router();

// POST /api/registration/study/:studyId — save a registration
// body: { fixedSeriesUid, movingSeriesUid, matrix (4x4), method?, notes? }
router.post('/study/:studyId', authMiddleware, (req, res, next) => {
  try {
    const registration = saveRegistration({
      studyId: parseInt(req.params.studyId, 10),
      fixedSeriesUid: req.body?.fixedSeriesUid,
      movingSeriesUid: req.body?.movingSeriesUid,
      matrix: req.body?.matrix,
      method: req.body?.method,
      notes: req.body?.notes,
      userId: req.user.userId,
      reqId: req.id,
    });
    res.status(201).json({ registration });
  } catch (err) {
    next(err);
  }
});

// GET /api/registration/study/:studyId — all registrations of a study
router.get('/study/:studyId', authMiddleware, (req, res, next) => {
  try {
    const registrations = listRegistrations({
      studyId: parseInt(req.params.studyId, 10),
      userId: req.user.userId,
      reqId: req.id,
    });
    res.json({ registrations });
  } catch (err) {
    next(err);
  }
});

// GET /api/registration/study/:studyId/latest?fixed=&moving= — current one for a pair
router.get('/study/:studyId/latest', authMiddleware, (req, res, next) => {
  try {
    const registration = getLatestRegistration({
      studyId: parseInt(req.params.studyId, 10),
      fixedSeriesUid: req.query.fixed,
      movingSeriesUid: req.query.moving,
      userId: req.user.userId,
      reqId: req.id,
    });
    res.json({ registration });
  } catch (err) {
    next(err);
  }
});

// POST /api/registration/study/:studyId/derived-series — register the
// provenance of a browser-generated resampled volume (v1 metadata only)
// body: { registrationId?, fixedSeriesUid?, movingSeriesUid?, seriesUid,
//         description?, geometry, matrix }
router.post('/study/:studyId/derived-series', authMiddleware, (req, res, next) => {
  try {
    const derived = createDerivedSeries({
      studyId: parseInt(req.params.studyId, 10),
      registrationId: req.body?.registrationId,
      fixedSeriesUid: req.body?.fixedSeriesUid,
      movingSeriesUid: req.body?.movingSeriesUid,
      seriesUid: req.body?.seriesUid,
      description: req.body?.description,
      geometry: req.body?.geometry,
      matrix: req.body?.matrix,
      userId: req.user.userId,
      reqId: req.id,
    });
    res.status(201).json({ derivedSeries: derived });
  } catch (err) {
    next(err);
  }
});

// GET /api/registration/study/:studyId/derived-series — provenance list
router.get('/study/:studyId/derived-series', authMiddleware, (req, res, next) => {
  try {
    const derivedSeries = listDerivedSeries({
      studyId: parseInt(req.params.studyId, 10),
      userId: req.user.userId,
      reqId: req.id,
    });
    res.json({ derivedSeries });
  } catch (err) {
    next(err);
  }
});

// GET /api/registration/:id
router.get('/:id', authMiddleware, (req, res, next) => {
  try {
    const registration = getRegistration({
      id: parseInt(req.params.id, 10),
      userId: req.user.userId,
      reqId: req.id,
    });
    res.json({ registration });
  } catch (err) {
    next(err);
  }
});

export default router;
