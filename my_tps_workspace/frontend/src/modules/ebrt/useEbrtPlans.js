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
  const [selectedPlanId, setSelectedPlanId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const loadedRef = useRef(false);
  const selectPlanRef = useRef(null);

  // List rows carry beamCount only; the selected plan is hydrated with its
  // full beams array via selectPlan()
  const selectedPlan = plans.find(p => p.id === selectedPlanId) ?? null;

  const selectPlan = useCallback(async (planId) => {
    setSelectedPlanId(planId);
    const current = plans.find(p => p.id === planId);
    if (current?.beams) return; // already hydrated
    const res = await fetch(`/api/ebrt/plans/${planId}`, { credentials: 'include' });
    if (!res.ok) throw new Error('Failed to load plan');
    const { plan } = await res.json();
    setPlans(prev => prev.map(p => (p.id === plan.id ? plan : p)));
  }, [plans]);

  const refreshList = useCallback(async () => {
    const res = await fetch(`/api/ebrt/study/${studyId}/plans`, { credentials: 'include' });
    if (!res.ok) throw new Error('Failed to list EBRT plans');
    const { plans: rows } = await res.json();
    setPlans(rows);
    return rows;
  }, [studyId]);

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
    const res = await fetch(`/api/ebrt/study/${studyId}/plans`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      throw new Error(d.error || 'Failed to create plan');
    }
    const { plan } = await res.json();
    await refreshList();
    setSelectedPlanId(plan.id);
    return plan;
  }, [studyId, refreshList]);

  const importFromRTPlan = useCallback(async (fileId) => {
    const res = await fetch(`/api/ebrt/study/${studyId}/plans/from-rtplan/${fileId}`, {
      method: 'POST',
      credentials: 'include',
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      throw new Error(d.error || 'Failed to import RTPLAN');
    }
    const { plan } = await res.json();
    await refreshList();
    setSelectedPlanId(plan.id);
    return plan;
  }, [studyId, refreshList]);

  const updatePlan = useCallback(async (planId, patch) => {
    const res = await fetch(`/api/ebrt/plans/${planId}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      throw new Error(d.error || 'Failed to update plan');
    }
    const { plan } = await res.json();
    setPlans(prev => prev.map(p => (p.id === plan.id ? plan : p)));
    return plan;
  }, []);

  const deletePlan = useCallback(async (planId) => {
    const res = await fetch(`/api/ebrt/plans/${planId}`, { method: 'DELETE', credentials: 'include' });
    if (!res.ok) throw new Error('Failed to delete plan');
    await refreshList();
    setSelectedPlanId(prev => (prev === planId ? null : prev));
  }, [refreshList]);

  const addBeam = useCallback(async (planId, payload) => {
    const res = await fetch(`/api/ebrt/plans/${planId}/beams`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      throw new Error(d.error || 'Failed to add beam');
    }
    const { plan } = await res.json();
    setPlans(prev => prev.map(p => (p.id === plan.id ? plan : p)));
    return plan;
  }, []);

  const updateBeam = useCallback(async (beamId, patch) => {
    const res = await fetch(`/api/ebrt/beams/${beamId}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      throw new Error(d.error || 'Failed to update beam');
    }
    const { plan } = await res.json();
    setPlans(prev => prev.map(p => (p.id === plan.id ? plan : p)));
    return plan;
  }, []);

  selectPlanRef.current = selectPlan;

  const deleteBeam = useCallback(async (beamId) => {
    const res = await fetch(`/api/ebrt/beams/${beamId}`, { method: 'DELETE', credentials: 'include' });
    if (!res.ok) throw new Error('Failed to delete beam');
    const { plan } = await res.json();
    setPlans(prev => prev.map(p => (p.id === plan.id ? plan : p)));
  }, []);

  const refreshTemplates = useCallback(async () => {
    const res = await fetch('/api/ebrt/templates', { credentials: 'include' });
    if (!res.ok) throw new Error('Failed to list templates');
    const { templates: rows } = await res.json();
    setTemplates(rows);
    return rows;
  }, []);

  const saveAsTemplate = useCallback(async (planId, name) => {
    const res = await fetch(`/api/ebrt/plans/${planId}/save-as-template`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(name ? { name } : {}),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      throw new Error(d.error || 'Failed to save template');
    }
    const { template } = await res.json();
    await refreshTemplates();
    return template;
  }, [refreshTemplates]);

  const instantiateTemplate = useCallback(async (templateId, name) => {
    const res = await fetch(`/api/ebrt/templates/${templateId}/instantiate`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studyId, name }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      throw new Error(d.error || 'Failed to create plan from template');
    }
    const { plan } = await res.json();
    await refreshList();
    setSelectedPlanId(plan.id);
    return plan;
  }, [studyId, refreshList]);

  // ---------- EBRT backend wiring (PLAN-EBRT-BACKEND B2–B6) ----------

  const postJson = useCallback(async (url, body, method = 'POST') => {
    const res = await fetch(url, {
      method,
      credentials: 'include',
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      throw new Error(d.error || `${method} ${url} failed`);
    }
    return res.json();
  }, []);

  /** Eclipse Plan Normalization — rescale the plan's dose grid. */
  const normalizePlan = useCallback(async (planId, mode, value) => {
    const data = await postJson(`/api/ebrt-normalize/plans/${planId}/normalize`, { mode, value });
    await selectPlan(planId);
    return data;
  }, [postJson, selectPlan]);

  /** Create the 180° opposing field from a source beam number. */
  const addOpposingField = useCallback(async (planId, sourceBeamNumber, name) => {
    const data = await postJson(`/api/ebrt/plans/${planId}/opposing-field`, { sourceBeamNumber, name });
    const res = await fetch(`/api/ebrt/plans/${planId}`, { credentials: 'include' });
    if (res.ok) {
      const { plan } = await res.json();
      setPlans(prev => prev.map(p => (p.id === plan.id ? plan : p)));
    }
    return data.beam ?? data;
  }, [postJson]);

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
    plans, templates, selectedPlan, selectedPlanId, setSelectedPlanId, selectPlan,
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
    getPointDoses,
  };
}

export default useEbrtPlans;
