import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import {
  listPlans,
  getPlan,
  createPlan,
  updatePlan,
  deletePlan,
  addBeam,
  updateBeam,
  deleteBeam,
  createPlanFromRTPlan,
  savePlanAsTemplate,
  listTemplates,
  instantiateTemplate,
} from '../services/ebrtPlanService.js';
import {
  approvalChecks,
  captureRevision,
  listRevisions,
  getRevision,
  rollbackToRevision,
} from '../services/ebrtPlanService.js';
import {
  listControlPoints,
  replaceControlPoints,
  listSubfields,
  addSubfield,
  updateSubfield,
  deleteSubfield,
  createOpposingField,
} from '../services/beamModelService.js';
import { generateCouchStructure, referencePointDoses } from '../services/couchService.js';

const router = Router();

// GET /api/ebrt/study/:studyId/plans — list plans of a study
router.get('/study/:studyId/plans', authMiddleware, (req, res, next) => {
  try {
    const rows = listPlans({
      studyId: parseInt(req.params.studyId, 10),
      userId: req.user.userId,
      reqId: req.id,
    });
    res.json({ plans: rows });
  } catch (err) {
    next(err);
  }
});

// POST /api/ebrt/study/:studyId/plans — create a plan
router.post('/study/:studyId/plans', authMiddleware, (req, res, next) => {
  try {
    const plan = createPlan({
      studyId: parseInt(req.params.studyId, 10),
      payload: req.body ?? {},
      userId: req.user.userId,
      reqId: req.id,
    });
    res.status(201).json({ plan });
  } catch (err) {
    next(err);
  }
});

// POST /api/ebrt/study/:studyId/plans/from-rtplan/:fileId — import RTPLAN as an editable plan
router.post('/study/:studyId/plans/from-rtplan/:fileId', authMiddleware, async (req, res, next) => {
  try {
    const plan = await createPlanFromRTPlan({
      studyId: parseInt(req.params.studyId, 10),
      fileId: parseInt(req.params.fileId, 10),
      userId: req.user.userId,
      reqId: req.id,
    });
    res.status(201).json({ plan });
  } catch (err) {
    next(err);
  }
});

// GET /api/ebrt/plans/:id — plan with beams
router.get('/plans/:id', authMiddleware, (req, res, next) => {
  try {
    const plan = getPlan({
      id: parseInt(req.params.id, 10),
      userId: req.user.userId,
      reqId: req.id,
    });
    res.json({ plan });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/ebrt/plans/:id — update plan fields
router.patch('/plans/:id', authMiddleware, (req, res, next) => {
  try {
    const plan = updatePlan({
      id: parseInt(req.params.id, 10),
      payload: req.body ?? {},
      userId: req.user.userId,
      reqId: req.id,
    });
    res.json({ plan });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/ebrt/plans/:id
router.delete('/plans/:id', authMiddleware, (req, res, next) => {
  try {
    const result = deletePlan({
      id: parseInt(req.params.id, 10),
      userId: req.user.userId,
      reqId: req.id,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// POST /api/ebrt/plans/:id/beams — add a beam
router.post('/plans/:id/beams', authMiddleware, (req, res, next) => {
  try {
    const plan = addBeam({
      planId: parseInt(req.params.id, 10),
      payload: req.body ?? {},
      userId: req.user.userId,
      reqId: req.id,
    });
    res.status(201).json({ plan });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/ebrt/beams/:beamId — update a beam (returns the whole plan)
router.patch('/beams/:beamId', authMiddleware, (req, res, next) => {
  try {
    const plan = updateBeam({
      beamId: parseInt(req.params.beamId, 10),
      payload: req.body ?? {},
      userId: req.user.userId,
      reqId: req.id,
    });
    res.json({ plan });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/ebrt/beams/:beamId — delete a beam (returns the whole plan)
router.delete('/beams/:beamId', authMiddleware, (req, res, next) => {
  try {
    const plan = deleteBeam({
      beamId: parseInt(req.params.beamId, 10),
      userId: req.user.userId,
      reqId: req.id,
    });
    res.json({ plan });
  } catch (err) {
    next(err);
  }
});

// GET /api/ebrt/templates — list reusable plan templates
router.get('/templates', authMiddleware, (req, res, next) => {
  try {
    const rows = listTemplates({ userId: req.user.userId, reqId: req.id });
    res.json({ templates: rows });
  } catch (err) {
    next(err);
  }
});

// POST /api/ebrt/plans/:id/save-as-template — copy plan+beams into a template
router.post('/plans/:id/save-as-template', authMiddleware, (req, res, next) => {
  try {
    const template = savePlanAsTemplate({
      planId: parseInt(req.params.id, 10),
      name: req.body?.name,
      userId: req.user.userId,
      reqId: req.id,
    });
    res.status(201).json({ template });
  } catch (err) {
    next(err);
  }
});

// POST /api/ebrt/templates/:id/instantiate — create an editable plan from a template
router.post('/templates/:id/instantiate', authMiddleware, (req, res, next) => {
  try {
    const plan = instantiateTemplate({
      templateId: parseInt(req.params.id, 10),
      studyId: parseInt(req.body?.studyId, 10),
      name: req.body?.name,
      userId: req.user.userId,
      reqId: req.id,
    });
    res.status(201).json({ plan });
  } catch (err) {
    next(err);
  }
});

// GET /ebrt/beams/:beamId/control-points — per-CP delivery data (incl. MLC)
router.get('/beams/:beamId/control-points', authMiddleware, (req, res, next) => {
  try {
    const controlPoints = listControlPoints({
      beamId: parseInt(req.params.beamId, 10),
      userId: req.user.userId,
      reqId: req.id,
    });
    res.json({ controlPoints });
  } catch (err) {
    next(err);
  }
});

// PUT /ebrt/beams/:beamId/control-points — replace all control points
router.put('/beams/:beamId/control-points', authMiddleware, (req, res, next) => {
  try {
    const controlPoints = replaceControlPoints({
      beamId: parseInt(req.params.beamId, 10),
      controlPoints: req.body?.controlPoints ?? [],
      userId: req.user.userId,
      reqId: req.id,
    });
    res.json({ controlPoints });
  } catch (err) {
    next(err);
  }
});

// POST /ebrt/beams/:beamId/subfields — add a field-in-field subfield
router.post('/beams/:beamId/subfields', authMiddleware, (req, res, next) => {
  try {
    const subfield = addSubfield({
      beamId: parseInt(req.params.beamId, 10),
      name: req.body?.name,
      weight: req.body?.weight,
      mlc: req.body?.mlc,
      userId: req.user.userId,
      reqId: req.id,
    });
    res.status(201).json({ subfield });
  } catch (err) {
    next(err);
  }
});

// PATCH /ebrt/beams/:beamId/subfields/:subfieldId — update name/weight/mlc
router.patch('/beams/:beamId/subfields/:subfieldId', authMiddleware, (req, res, next) => {
  try {
    const subfield = updateSubfield({
      beamId: parseInt(req.params.beamId, 10),
      subfieldId: parseInt(req.params.subfieldId, 10),
      name: req.body?.name,
      weight: req.body?.weight,
      mlc: req.body?.mlc,
      userId: req.user.userId,
      reqId: req.id,
    });
    res.json({ subfield });
  } catch (err) {
    next(err);
  }
});

// GET /ebrt/beams/:beamId/subfields
router.get('/beams/:beamId/subfields', authMiddleware, (req, res, next) => {
  try {
    const subfields = listSubfields({
      beamId: parseInt(req.params.beamId, 10),
      userId: req.user.userId,
      reqId: req.id,
    });
    res.json({ subfields });
  } catch (err) {
    next(err);
  }
});

// DELETE /ebrt/beams/:beamId/subfields/:subfieldId
router.delete('/beams/:beamId/subfields/:subfieldId', authMiddleware, (req, res, next) => {
  try {
    const result = deleteSubfield({
      beamId: parseInt(req.params.beamId, 10),
      subfieldId: parseInt(req.params.subfieldId, 10),
      userId: req.user.userId,
      reqId: req.id,
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /ebrt/plans/:planId/point-doses — reference point dose report
router.get('/plans/:planId/point-doses', authMiddleware, async (req, res, next) => {
  try {
    const points = await referencePointDoses({
      planId: parseInt(req.params.planId, 10),
      doseFileId: req.query.doseFileId != null ? parseInt(req.query.doseFileId, 10) : null,
      userId: req.user.userId,
      reqId: req.id,
    });
    res.json({ points });
  } catch (err) {
    next(err);
  }
});

// POST /studies/:studyId/couch-structure — generate a couch ROI
// body: { topOffsetMm?, widthMm?, thicknessMm?, name? }
router.post('/studies/:studyId/couch-structure', authMiddleware, (req, res, next) => {
  try {
    const result = generateCouchStructure({
      studyId: parseInt(req.params.studyId, 10),
      topOffsetMm: req.body?.topOffsetMm != null ? Number(req.body.topOffsetMm) : 20,
      widthMm: req.body?.widthMm != null ? Number(req.body.widthMm) : 400,
      thicknessMm: req.body?.thicknessMm != null ? Number(req.body.thicknessMm) : 40,
      name: req.body?.name ?? 'Couch Surface',
      userId: req.user.userId,
      reqId: req.id,
    });
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

// GET /ebrt/plans/:planId/approval-checks — pre-approval validation
router.get('/plans/:planId/approval-checks', authMiddleware, (req, res, next) => {
  try {
    const checks = approvalChecks({
      planId: parseInt(req.params.planId, 10),
      userId: req.user.userId,
      reqId: req.id,
    });
    res.json(checks);
  } catch (err) {
    next(err);
  }
});

// GET /ebrt/plans/:planId/revisions — revision history (metadata)
router.get('/plans/:planId/revisions', authMiddleware, (req, res, next) => {
  try {
    const revisions = listRevisions({
      planId: parseInt(req.params.planId, 10),
      userId: req.user.userId,
      reqId: req.id,
    });
    res.json({ revisions });
  } catch (err) {
    next(err);
  }
});

// GET /ebrt/plans/:planId/revisions/:revisionNo — full snapshot
router.get('/plans/:planId/revisions/:revisionNo', authMiddleware, (req, res, next) => {
  try {
    const revision = getRevision({
      planId: parseInt(req.params.planId, 10),
      revisionNo: parseInt(req.params.revisionNo, 10),
      userId: req.user.userId,
      reqId: req.id,
    });
    res.json({ revision });
  } catch (err) {
    next(err);
  }
});

// POST /ebrt/plans/:planId/revisions — manual snapshot
router.post('/plans/:planId/revisions', authMiddleware, (req, res, next) => {
  try {
    const revisionNo = captureRevision({
      planId: parseInt(req.params.planId, 10),
      userId: req.user.userId,
      reqId: req.id,
    });
    res.status(201).json({ revisionNo });
  } catch (err) {
    next(err);
  }
});

// POST /ebrt/plans/:planId/revisions/rollback — { revisionNo }
router.post('/plans/:planId/revisions/rollback', authMiddleware, (req, res, next) => {
  try {
    const plan = rollbackToRevision({
      planId: parseInt(req.params.planId, 10),
      revisionNo: parseInt(req.body?.revisionNo, 10),
      userId: req.user.userId,
      reqId: req.id,
    });
    res.json({ plan });
  } catch (err) {
    next(err);
  }
});

// POST /ebrt/plans/:planId/opposing-field — create the 180° opposing field
router.post('/plans/:planId/opposing-field', authMiddleware, (req, res, next) => {
  try {
    const beam = createOpposingField({
      planId: parseInt(req.params.planId, 10),
      sourceBeamNumber: parseInt(req.body?.sourceBeamNumber, 10),
      name: req.body?.name,
      userId: req.user.userId,
      reqId: req.id,
    });
    res.status(201).json({ beam });
  } catch (err) {
    next(err);
  }
});

export default router;
