import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { listPatients, getPatient, createPatient } from '../services/patientService.js';

const router = Router();

// GET /api/patients — list all patients
router.get('/', authMiddleware, (req, res, next) => {
  try {
    const patients = listPatients({ userId: req.user.userId, reqId: req.id });
    res.json({ patients });
  } catch (err) {
    next(err);
  }
});

// GET /api/patients/:id — get patient with studies
router.get('/:id', authMiddleware, (req, res, next) => {
  try {
    const patient = getPatient({
      id: parseInt(req.params.id, 10),
      userId: req.user.userId,
      reqId: req.id,
    });
    res.json({ patient });
  } catch (err) {
    next(err);
  }
});

// POST /api/patients — create a new patient
router.post('/', authMiddleware, (req, res, next) => {
  try {
    const { externalId, name, birthDate, gender } = req.body;
    if (!externalId || !name) {
      return res.status(400).json({ error: 'externalId and name are required' });
    }
    const patient = createPatient({
      externalId,
      name,
      birthDate,
      gender,
      userId: req.user.userId,
      reqId: req.id,
    });
    res.status(201).json({ patient });
  } catch (err) {
    next(err);
  }
});

export default router;
