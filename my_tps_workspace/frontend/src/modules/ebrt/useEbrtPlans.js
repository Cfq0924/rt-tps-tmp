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

  return {
    plans, selectedPlan, selectedPlanId, setSelectedPlanId,
    loading, error,
    createPlan, importFromRTPlan, updatePlan, deletePlan,
    addBeam, updateBeam, deleteBeam,
  };
}

export default useEbrtPlans;
