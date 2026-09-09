import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import {
  listCourses,
  createCourse,
  updateCourse,
  deleteCourse,
} from '../services/courseService.js';

const router = Router();

// GET /api/courses/study/:studyId
router.get('/study/:studyId', authMiddleware, (req, res, next) => {
  try {
    const courses = listCourses({
      studyId: parseInt(req.params.studyId, 10),
      userId: req.user.userId,
      reqId: req.id,
    });
    res.json({ courses });
  } catch (err) {
    next(err);
  }
});

// POST /api/courses/study/:studyId — { name, intent? }
router.post('/study/:studyId', authMiddleware, (req, res, next) => {
  try {
    const course = createCourse({
      studyId: parseInt(req.params.studyId, 10),
      name: req.body?.name,
      intent: req.body?.intent,
      userId: req.user.userId,
      reqId: req.id,
    });
    res.status(201).json({ course });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/courses/:id — { name?, intent? }
router.patch('/:id', authMiddleware, (req, res, next) => {
  try {
    const course = updateCourse({
      id: parseInt(req.params.id, 10),
      name: req.body?.name,
      intent: req.body?.intent,
      userId: req.user.userId,
      reqId: req.id,
    });
    res.json({ course });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/courses/:id — plans survive with course_id cleared
router.delete('/:id', authMiddleware, (req, res, next) => {
  try {
    const result = deleteCourse({
      id: parseInt(req.params.id, 10),
      userId: req.user.userId,
      reqId: req.id,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
