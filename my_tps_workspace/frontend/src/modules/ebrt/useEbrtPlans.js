import { useState, useCallback, useEffect, useRef } from 'react';

/**
 * EBRT workspace state: plan list, selected plan, plan/beam CRUD.
 *
 * @param {Object} params
 * @param {number} params.studyId
 * @param {boolean} params.enabled - fetch when the EBRT module is opened
 */
export function useEbrtPlans({ studyId, enabled }) {
  const [plans, setPlans] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [courses, setCourses] = useState([]);
  const [selectedPlanId, setSelectedPlanId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const loadedRef = useRef(false);
  const selectPlanRef = useRef(null);

  // ---------- EBRT backend wiring (PLAN-EBRT-BACKEND B2–B6) ----------

  const postJson = useCallback(async (url, body, method = 'POST', errorMsg = null) => {
    const res = await fetch(url, {
      method,
      credentials: 'include',
      cache: 'no-store', // approval/dose views must never serve stale GETs
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      throw new Error(d.error || errorMsg || `${method} ${url} failed`);
    }
    return res.json();
  }, []);

  // List rows carry beamCount only; the selected plan is hydrated with its
  // full beams array via selectPlan()
  const selectedPlan = plans.find(p => p.id === selectedPlanId) ?? null;

  const selectPlan = useCallback(async (planId, { force = false } = {}) => {
    setSelectedPlanId(planId);
    const current = plans.find(p => p.id === planId);
    if (current?.beams && !force) return; // already hydrated
    const { plan } = await postJson(`/api/ebrt/plans/${planId}`, undefined, 'GET', 'Failed to load plan');
    setPlans(prev => prev.map(p => (p.id === plan.id ? plan : p)));
  }, [plans, postJson]);

  const refreshList = useCallback(async () => {
    const { plans: rows } = await postJson(`/api/ebrt/study/${studyId}/plans`, undefined, 'GET', 'Failed to list EBRT plans');
    setPlans(rows);
    return rows;
  }, [studyId, postJson]);

  /** Load once when the module opens; auto-select the first plan. */
  useEffect(() => {
    if (!enabled || loadedRef.current) return;
    loadedRef.current = true;
    setLoading(true);
    refreshList()
      .then(async rows => {
        if (rows.length > 0) await selectPlanRef.current(rows[0].id);
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [enabled, refreshList]);

  const createPlan = useCallback(async (payload) => {
    const { plan } = await postJson(`/api/ebrt/study/${studyId}/plans`, payload, 'POST', 'Failed to create plan');
    await refreshList();
    setSelectedPlanId(plan.id);
    return plan;
  }, [studyId, refreshList, postJson]);

  const importFromRTPlan = useCallback(async (fileId) => {
    const { plan } = await postJson(`/api/ebrt/study/${studyId}/plans/from-rtplan/${fileId}`, undefined, 'POST', 'Failed to import RTPLAN');
    await refreshList();
    setSelectedPlanId(plan.id);
    return plan;
  }, [studyId, refreshList, postJson]);

  const updatePlan = useCallback(async (planId, patch) => {
    const { plan } = await postJson(`/api/ebrt/plans/${planId}`, patch, 'PATCH', 'Failed to update plan');
    setPlans(prev => prev.map(p => (p.id === plan.id ? plan : p)));
    return plan;
  }, [postJson]);

  const deletePlan = useCallback(async (planId) => {
    await postJson(`/api/ebrt/plans/${planId}`, undefined, 'DELETE', 'Failed to delete plan');
    await refreshList();
    setSelectedPlanId(prev => (prev === planId ? null : prev));
  }, [refreshList, postJson]);

  const addBeam = useCallback(async (planId, payload) => {
    const { plan } = await postJson(`/api/ebrt/plans/${planId}/beams`, payload, 'POST', 'Failed to add beam');
    setPlans(prev => prev.map(p => (p.id === plan.id ? plan : p)));
    return plan;
  }, [postJson]);

  const updateBeam = useCallback(async (beamId, patch) => {
    const { plan } = await postJson(`/api/ebrt/beams/${beamId}`, patch, 'PATCH', 'Failed to update beam');
    setPlans(prev => prev.map(p => (p.id === plan.id ? plan : p)));
    return plan;
  }, [postJson]);

  selectPlanRef.current = selectPlan;

  const deleteBeam = useCallback(async (beamId) => {
    const { plan } = await postJson(`/api/ebrt/beams/${beamId}`, undefined, 'DELETE', 'Failed to delete beam');
    setPlans(prev => prev.map(p => (p.id === plan.id ? plan : p)));
  }, [postJson]);

  const refreshCourses = useCallback(async () => {
    const { courses: rows } = await postJson(`/api/courses/study/${studyId}`, undefined, 'GET', 'Failed to load courses');
    setCourses(rows);
    return rows;
  }, [studyId, postJson]);

  const createCourse = useCallback(async (name, intent) => {
    const { course } = await postJson(`/api/courses/study/${studyId}`, { name, intent }, 'POST', 'Failed to create course');
    await refreshCourses();
    return course;
  }, [studyId, refreshCourses, postJson]);

  const refreshTemplates = useCallback(async () => {
    const { templates: rows } = await postJson('/api/ebrt/templates', undefined, 'GET', 'Failed to list templates');
    setTemplates(rows);
    return rows;
  }, [postJson]);

  const saveAsTemplate = useCallback(async (planId, name) => {
    const { template } = await postJson(`/api/ebrt/plans/${planId}/save-as-template`, name ? { name } : {}, 'POST', 'Failed to save template');
    await refreshTemplates();
    return template;
  }, [refreshTemplates, postJson]);

  const instantiateTemplate = useCallback(async (templateId, name) => {
    const { plan } = await postJson(`/api/ebrt/templates/${templateId}/instantiate`, { studyId, name }, 'POST', 'Failed to create plan from template');
    await refreshList();
    setSelectedPlanId(plan.id);
    return plan;
  }, [studyId, refreshList, postJson]);


  /** Eclipse Plan Normalization — rescale the plan's dose grid. */
  const normalizePlan = useCallback(async (planId, mode, value) => {
    const data = await postJson(`/api/ebrt-normalize/plans/${planId}/normalize`, { mode, value });
    await selectPlan(planId);
    return data;
  }, [postJson, selectPlan]);

  /** Create the 180° opposing field from a source beam number. */
  const addOpposingField = useCallback(async (planId, sourceBeamNumber, name) => {
    const data = await postJson(`/api/ebrt/plans/${planId}/opposing-field`, { sourceBeamNumber, name });
    await selectPlan(planId, { force: true }); // rehydrate the plan with the new beam
    return data.beam ?? data;
  }, [postJson, selectPlan]);

  const listSubfields = useCallback(async (beamId) => {
    const data = await postJson(`/api/ebrt/beams/${beamId}/subfields`, undefined, 'GET');
    return data.subfields ?? [];
  }, [postJson]);

  const addSubfield = useCallback(async (beamId, payload) => {
    return postJson(`/api/ebrt/beams/${beamId}/subfields`, payload);
  }, [postJson]);

  const removeSubfield = useCallback(async (beamId, subfieldId) => {
    return postJson(`/api/ebrt/beams/${beamId}/subfields/${subfieldId}`, undefined, 'DELETE');
  }, [postJson]);

  const updateSubfield = useCallback(async (beamId, subfieldId, patch) => {
    return postJson(`/api/ebrt/beams/${beamId}/subfields/${subfieldId}`, patch, 'PATCH');
  }, [postJson]);

  const getControlPoints = useCallback(async (beamId) => {
    const data = await postJson(`/api/ebrt/beams/${beamId}/control-points`, undefined, 'GET');
    return data.controlPoints ?? [];
  }, [postJson]);

  /** Replace all control points of a beam (PUT). */
  const saveControlPoints = useCallback(async (beamId, controlPoints) => {
    return postJson(`/api/ebrt/beams/${beamId}/control-points`, { controlPoints }, 'PUT');
  }, [postJson]);

  /** Generate couch structure into the study's segmentations. */
  const addCouchStructure = useCallback(async (payload = {}) => {
    return postJson(`/api/ebrt/studies/${studyId}/couch-structure`, payload);
  }, [postJson, studyId]);

  const getApprovalChecks = useCallback(async (planId) => {
    const data = await postJson(`/api/ebrt/plans/${planId}/approval-checks`, undefined, 'GET');
    return data.checks ?? data;
  }, [postJson]);

  /** Section 5: create the orthogonal no-dose imaging fields (AP + RT Lat). */
  const addSetupFields = useCallback(async (planId, presets) => {
    const data = await postJson(`/api/ebrt/plans/${planId}/setup-fields`, presets?.length ? { presets } : {});
    await selectPlan(planId, { force: true });
    return data;
  }, [postJson, selectPlan]);

  /** Section 9: delta couch shifts calculated from the user origin. */
  const getDeltaCouch = useCallback(async (planId) => {
    const data = await postJson(`/api/ebrt/plans/${planId}/delta-couch`, undefined, 'GET');
    return data;
  }, [postJson]);

  /** Section 9: Planning Approval — Dose Summary payload. */
  const getApprovalDoseSummary = useCallback(async (planId) => {
    const data = await postJson(`/api/ebrt/plans/${planId}/approval-dose-summary`, undefined, 'GET');
    return data.summary ?? data;
  }, [postJson]);

  const listRevisions = useCallback(async (planId) => {
    const data = await postJson(`/api/ebrt/plans/${planId}/revisions`, undefined, 'GET');
    return data.revisions ?? [];
  }, [postJson]);

  const captureRevision = useCallback(async (planId, note) => {
    return postJson(`/api/ebrt/plans/${planId}/revisions`, note ? { note } : {});
  }, [postJson]);

  const rollbackRevision = useCallback(async (planId, revisionNo) => {
    const data = await postJson(`/api/ebrt/plans/${planId}/revisions/rollback`, { revisionNo });
    await refreshList();
    await selectPlan(planId);
    return data;
  }, [postJson, refreshList, selectPlan]);

  const getPointDoses = useCallback(async (planId) => {
    const data = await postJson(`/api/ebrt/plans/${planId}/point-doses`, undefined, 'GET');
    return data.pointDoses ?? data.points ?? [];
  }, [postJson]);

  return {
    plans, templates, courses, refreshCourses, createCourse,
    selectedPlan, selectedPlanId, setSelectedPlanId, selectPlan,
    loading, error,
    createPlan, importFromRTPlan, updatePlan, deletePlan,
    addBeam, updateBeam, deleteBeam,
    refreshTemplates, saveAsTemplate, instantiateTemplate,
    refreshList,
    // backend wiring
    normalizePlan, addOpposingField,
    listSubfields, addSubfield, removeSubfield, updateSubfield,
    getControlPoints, saveControlPoints, addCouchStructure,
    getApprovalChecks, listRevisions, captureRevision, rollbackRevision,
    getPointDoses, addSetupFields, getDeltaCouch, getApprovalDoseSummary,
  };
}

export default useEbrtPlans;
