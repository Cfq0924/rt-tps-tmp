import { Box, Typography, TextField, MenuItem, Button, Table, TableBody, TableCell,
  TableHead, TableRow, IconButton, Switch, Chip, Divider, Tooltip, Alert, Slider } from '@mui/material';
import {
  Add, Delete, CloudDownload, Settings, BookmarkAdded, Bookmark, GppGood, RateReview,
  CallSplit, ContentCopy, Hotel, History, FactCheck, Straighten, Calculate, PinDrop,
} from '@mui/icons-material';
import { useState, useCallback, useRef, useEffect } from 'react';
import { MACHINES, DOSE_ALGORITHMS, OPTIMIZATION_ALGORITHMS, NORMALIZATIONS, getMachine } from '../../lib/machines.js';
import PeerReviewPanel from './PeerReviewPanel.jsx';
import MlcLeafEditor from './MlcLeafEditor.jsx';
import SubfieldEditor from './SubfieldEditor.jsx';

const numOrNull = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && v !== '' ? n : null;
};

// Approval flow: UNAPPROVED → REVIEWED → APPROVED (per Eclipse plan approval)
const NEXT_APPROVAL = { UNAPPROVED: 'REVIEWED', REVIEWED: 'APPROVED' };

/**
 * EbrtWorkspace - right panel of the EBRT module: plan list/selection,
 * new-plan form (machine / prescription / algorithms), plan approval and
 * beam management with live viewport visualization.
 *
 * @param {Object} props
 * @param {number} props.studyId
 * @param {Object} props.ebrt - useEbrtPlans() hook result
 * @param {number|null} props.rtPlanFileId - imported RTPLAN file id (for import)
 */
export default function EbrtWorkspace({ studyId, ebrt, rtPlanFileId, currentSliceIdx, onJumpToSlice }) {
  const { plans, selectedPlan, selectedPlanId, setSelectedPlanId, selectPlan } = ebrt;
  const [showNewPlan, setShowNewPlan] = useState(plans.length === 0);
  const [formError, setFormError] = useState('');
  const [showReview, setShowReview] = useState(false);

  // new-plan form state
  const [name, setName] = useState('');
  const [machineId, setMachineId] = useState(MACHINES[0].id);
  const [energyMv, setEnergyMv] = useState(MACHINES[0].energies[0]);
  const [doseGy, setDoseGy] = useState('');
  const [fx, setFx] = useState('');
  const [normalization, setNormalization] = useState('ISOCENTER');
  const [optAlgorithm, setOptAlgorithm] = useState('DMLC_IMRT');
  const [doseAlgorithm, setDoseAlgorithm] = useState('PENCIL_BEAM');
  const [gridSize, setGridSize] = useState('2');
  const [heterogeneity, setHeterogeneity] = useState(false);
  const [courseId, setCourseId] = useState('');
  const [targetStructure, setTargetStructure] = useState('');

  // add-beam form state
  const [beamType, setBeamType] = useState('STATIC');
  const [gantry, setGantry] = useState('0');
  const [gantryStop, setGantryStop] = useState('180');
  const [collimator, setCollimator] = useState('0');
  const [couch, setCouch] = useState('0');
  const [jawX, setJawX] = useState('100');
  const [jawY, setJawY] = useState('100');
  const [wedgeAngle, setWedgeAngle] = useState('');
  const [bolus, setBolus] = useState('');
  const machine = getMachine(machineId);

  // reference-points editor state (loaded from the selected plan)
  const [refPoints, setRefPoints] = useState([]);
  const [refPointsDirty, setRefPointsDirty] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);

  // load courses once when the workspace opens
  useEffect(() => {
    ebrt.refreshCourses?.().catch(() => {});
  }, []);

  // backend wiring state (B2–B6)
  const [selectedBeamId, setSelectedBeamId] = useState(null);
  const [normMode, setNormMode] = useState('ISOCENTER');
  const [normValue, setNormValue] = useState('');
  const [coversDose, setCoversDose] = useState('');
  const [coversVol, setCoversVol] = useState('');
  const [opNote, setOpNote] = useState('');
  const [revisions, setRevisions] = useState([]);
  const [showRevisions, setShowRevisions] = useState(false);
  const [doseBusy, setDoseBusy] = useState(false);
  const [pointDoses, setPointDoses] = useState(null);
  const [showPointDoses, setShowPointDoses] = useState(false);
  const [checks, setChecks] = useState(null);
  const [cps, setCps] = useState(null); // control points of selected beam
  const [subfields, setSubfields] = useState([]);
  const [cpIndex, setCpIndex] = useState(0);
  const [draftLeaves, setDraftLeaves] = useState(null);

  const selectedBeam = (selectedPlan?.beams ?? []).find(b => b.id === selectedBeamId)
    ?? (selectedPlan?.beams ?? [])[0]
    ?? null;

  // sync the editor when switching plans
  const [loadedRefPointsFor, setLoadedRefPointsFor] = useState(null);
  if (selectedPlan && loadedRefPointsFor !== selectedPlan.id) {
    setLoadedRefPointsFor(selectedPlan.id);
    setRefPoints(selectedPlan.referencePoints ?? []);
    setRefPointsDirty(false);
  }

  const [newCourseName, setNewCourseName] = useState('');

  const handleCreateCourse = async () => {
    if (!newCourseName.trim()) return;
    setFormError('');
    try {
      const course = await ebrt.createCourse(newCourseName.trim());
      setCourseId(course.id);
      setNewCourseName('');
    } catch (err) {
      setFormError(err.message);
    }
  };

  const handleCreatePlan = async () => {
    setFormError('');
    try {
      await ebrt.createPlan({
        name: name.trim(),
        machine_name: machineId,
        energy_mv: numOrNull(energyMv),
        prescription_dose_gy: numOrNull(doseGy),
        number_of_fractions: numOrNull(fx),
        normalization,
        optimization_algorithm: optAlgorithm,
        dose_algorithm: doseAlgorithm,
        grid_size_mm: numOrNull(gridSize) ?? 2,
        heterogeneity_correction: heterogeneity,
        course_id: courseId ? Number(courseId) : undefined,
        target_structure_name: targetStructure.trim() || undefined,
        dose_per_fraction_gy: numOrNull(doseGy) && numOrNull(fx) ? numOrNull(doseGy) / numOrNull(fx) : undefined,
        reference_points: targetStructure.trim() ? [{
          name: `${targetStructure.trim()} Rx`, isDpv: true, type: 'TARGET',
          totalDoseLimitGy: numOrNull(doseGy) ?? 0,
        }] : undefined,
      });
      setName('');
      setDoseGy('');
      setFx('');
      setTargetStructure('');
      setShowNewPlan(false);
    } catch (err) {
      setFormError(err.message);
    }
  };

  const handleImportRTPlan = async () => {
    setFormError('');
    if (!rtPlanFileId) {
      setFormError('No RTPLAN file in this study to import');
      return;
    }
    try {
      await ebrt.importFromRTPlan(rtPlanFileId);
    } catch (err) {
      setFormError(err.message);
    }
  };

  const handleAddBeam = async () => {
    if (!selectedPlanId) return;
    setFormError('');
    try {
      const half = (Number(jawX) || 0) / 2;
      const halfY = (Number(jawY) || 0) / 2;
      await ebrt.addBeam(selectedPlanId, {
        beam_type: beamType,
        energy_mv: selectedPlan?.energyMv ?? 6,
        gantry_angle: Number(gantry),
        gantry_angle_stop: beamType === 'VMAT' ? Number(gantryStop) : null,
        collimator_angle: Number(collimator),
        couch_angle: Number(couch),
        jaw_x1: -half, jaw_x2: half,
        jaw_y1: -halfY, jaw_y2: halfY,
        wedge_angle: numOrNull(wedgeAngle),
        bolus: bolus.trim() || null,
      });
      setWedgeAngle('');
      setBolus('');
    } catch (err) {
      setFormError(err.message);
    }
  };

  const handleApprovalAdvance = async () => {
    if (!selectedPlan) return;
    setFormError('');
    setChecks(null);
    const next = NEXT_APPROVAL[selectedPlan.approvalStatus];
    if (!next) return;
    try {
      // Eclipse Plan Approval Warnings & Errors — block APPROVED on errors
      if (next === 'APPROVED' && ebrt.getApprovalChecks) {
        const c = await ebrt.getApprovalChecks(selectedPlan.id);
        setChecks(c);
        const errors = c.errors ?? [];
        if (errors.length > 0) {
          setFormError(`Approval blocked (${errors.length} error${errors.length > 1 ? 's' : ''}): ${errors[0]}`);
          return;
        }
      }
      await ebrt.updatePlan(selectedPlan.id, { approval_status: next });
      if (next === 'APPROVED' && ebrt.captureRevision) {
        await ebrt.captureRevision(selectedPlan.id, 'auto: approved').catch(() => {});
      }
    } catch (err) {
      setFormError(err.message);
    }
  };

  const handleApprovalReset = async () => {
    if (!selectedPlan) return;
    setFormError('');
    try {
      await ebrt.updatePlan(selectedPlan.id, { approval_status: 'UNAPPROVED' });
    } catch (err) {
      setFormError(err.message);
    }
  };

  const updateRefPoint = (idx, patch) => {
    setRefPoints(prev => prev.map((pt, i) => (i === idx ? { ...pt, ...patch } : pt)));
    setRefPointsDirty(true);
  };

  const saveRefPoints = async () => {
    if (!selectedPlan) return;
    setFormError('');
    try {
      await ebrt.updatePlan(selectedPlan.id, { reference_points: refPoints });
      setRefPointsDirty(false);
    } catch (err) {
      setFormError(err.message);
    }
  };

  const handleSaveAsTemplate = async () => {
    if (!selectedPlan) return;
    setFormError('');
    try {
      await ebrt.saveAsTemplate(selectedPlan.id);
      setFormError(''); // saved
    } catch (err) {
      setFormError(err.message);
    }
  };

  const handleNormalize = async () => {
    if (!selectedPlan) return;
    setFormError('');
    setOpNote('');
    try {
      const payload = normMode === 'PERCENT_COVERS'
        ? { cover: numOrNull(coversDose), ofVolume: numOrNull(coversVol) }
        : normMode === 'REFERENCE_POINT'
          ? (normValue.trim() || undefined)
          : ['TARGET_MAX', 'TARGET_MEAN', 'TARGET_MIN', 'NONE'].includes(normMode)
            ? (normMode === 'NONE' ? undefined : (normValue === '' ? undefined : Number(normValue)))
            : (normValue === '' ? undefined : Number(normValue));
      const r = await ebrt.normalizePlan(selectedPlan.id, normMode, payload);
      setOpNote(`Normalized (${normMode}) ×${r?.factor?.toFixed?.(4) ?? r?.factor ?? '?'}`);
    } catch (err) {
      setFormError(err.message);
    }
  };

  // Reference RTDOSE for the dose engine: first RTDOSE file of the study
  // (fetched once and cached — the engine only borrows its geometry).
  const referenceDoseFileIdRef = useRef(null);
  const resolveReferenceDoseFileId = async () => {
    if (referenceDoseFileIdRef.current) return referenceDoseFileIdRef.current;
    const res = await fetch(`/api/studies/${studyId}`, { credentials: 'include' });
    if (!res.ok) throw new Error('Failed to load study files');
    const { study } = await res.json();
    const doseFile = (study.files ?? []).find(f => f.modality === 'RTDOSE');
    if (!doseFile) throw new Error('No RTDOSE in this study to borrow geometry from');
    referenceDoseFileIdRef.current = doseFile.id;
    return doseFile.id;
  };

  const handleCalculateDose = async () => {
    if (!selectedPlan) return;
    setFormError('');
    setOpNote('');
    setDoseBusy(true);
    try {
      const referenceDoseFileId = await resolveReferenceDoseFileId();
      const res = await fetch(`/api/dose-engine/study/${studyId}/compute`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planId: selectedPlan.id,
          referenceDoseFileId,
          prescriptionCgy: selectedPlan.prescriptionDoseGy != null
            ? Math.round(selectedPlan.prescriptionDoseGy * 100) : undefined,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || `Dose calculation failed (${res.status})`);
      }
      const r = await res.json();
      referenceDoseFileIdRef.current = r.doseFileId ?? referenceDoseFileIdRef.current;
      setOpNote(`Dose computed → RTDOSE file #${r.doseFileId ?? '?'}`);
    } catch (err) {
      setFormError(err.message);
    } finally {
      setDoseBusy(false);
    }
  };

  const handleLoadPointDoses = async () => {
    if (!selectedPlan) return;
    setFormError('');
    try {
      const rows = await ebrt.getPointDoses(selectedPlan.id);
      setPointDoses(rows);
      setShowPointDoses(true);
    } catch (err) {
      setFormError(err.message);
    }
  };

  const handleOpposing = async () => {
    if (!selectedPlan || !selectedBeam) return;
    setFormError('');
    setOpNote('');
    try {
      await ebrt.addOpposingField(selectedPlan.id, selectedBeam.beamNumber);
      setOpNote(`Opposing field created from beam ${selectedBeam.beamNumber}`);
    } catch (err) {
      setFormError(err.message);
    }
  };

  const handleAddCouch = async () => {
    setFormError('');
    setOpNote('');
    try {
      const r = await ebrt.addCouchStructure({});
      setOpNote(`Couch structure created (${r?.sliceCount ?? '?'} slices)`);
    } catch (err) {
      setFormError(err.message);
    }
  };

  const handleLoadChecks = async () => {
    if (!selectedPlan) return;
    setFormError('');
    try {
      const c = await ebrt.getApprovalChecks(selectedPlan.id);
      setChecks(c);
    } catch (err) {
      setFormError(err.message);
    }
  };

  const handleShowRevisions = async () => {
    if (!selectedPlan) return;
    setFormError('');
    try {
      const rows = await ebrt.listRevisions(selectedPlan.id);
      setRevisions(rows);
      setShowRevisions(true);
    } catch (err) {
      setFormError(err.message);
    }
  };

  const handleCaptureRevision = async () => {
    if (!selectedPlan) return;
    try {
      await ebrt.captureRevision(selectedPlan.id, 'manual');
      const rows = await ebrt.listRevisions(selectedPlan.id);
      setRevisions(rows);
      setOpNote('Revision snapshot captured');
    } catch (err) {
      setFormError(err.message);
    }
  };

  const handleLoadBeamDetail = useCallback(async (beam) => {
    if (!beam || !ebrt.getControlPoints) return;
    setSelectedBeamId(beam.id);
    setCpIndex(0);
    setDraftLeaves(null);
    try {
      const [cp, sf] = await Promise.all([
        ebrt.getControlPoints(beam.id).catch(() => []),
        ebrt.listSubfields(beam.id).catch(() => []),
      ]);
      setCps(cp);
      setSubfields(sf);
    } catch (err) {
      setFormError(err.message);
    }
  }, [ebrt]);

  const activeCp = cps && cps.length > 0 ? cps[Math.min(cpIndex, cps.length - 1)] : null;

  const handleSaveCpMlc = async () => {
    if (!selectedBeam || !cps || !draftLeaves) return;
    setFormError('');
    try {
      const next = cps.map((cp, i) => {
        if (i !== Math.min(cpIndex, cps.length - 1)) return cp;
        return { ...cp, mlc: { ...(cp.mlc ?? { type: 'MLCX' }), leafPairs: draftLeaves } };
      });
      const updated = await ebrt.saveControlPoints(selectedBeam.id, next);
      setCps(updated);
      setDraftLeaves(null);
      setOpNote(`CP${Math.min(cpIndex, cps.length - 1)} MLC saved`);
    } catch (err) {
      setFormError(err.message);
    }
  };

  const handleAddSubfield = async (payload) => {
    if (!selectedBeam) return;
    try {
      await ebrt.addSubfield(selectedBeam.id, payload);
      const sf = await ebrt.listSubfields(selectedBeam.id);
      setSubfields(sf);
    } catch (err) {
      setFormError(err.message);
    }
  };

  const handleDeleteSubfield = async (subfieldId) => {
    if (!selectedBeam) return;
    try {
      await ebrt.removeSubfield(selectedBeam.id, subfieldId);
      setSubfields(prev => prev.filter(s => s.id !== subfieldId));
    } catch (err) {
      setFormError(err.message);
    }
  };

  const handleUpdateSubfield = async (subfieldId, patch) => {
    if (!selectedBeam) return;
    try {
      await ebrt.updateSubfield(selectedBeam.id, subfieldId, patch);
      const sf = await ebrt.listSubfields(selectedBeam.id);
      setSubfields(sf);
      setOpNote('Subfield MLC updated');
    } catch (err) {
      setFormError(err.message);
    }
  };

  const handleInstantiate = async (templateId) => {
    setFormError('');
    try {
      await ebrt.instantiateTemplate(templateId);
      setShowTemplates(false);
    } catch (err) {
      setFormError(err.message);
    }
  };

  const dosePerFx = Number(doseGy) > 0 && Number(fx) > 0
    ? (Number(doseGy) / Number(fx)).toFixed(2)
    : null;

  return (
    <Box sx={{ width: '100%', overflow: 'auto' }}>
      <Typography
        variant="caption"
        sx={{ px: 1, py: 0.5, display: 'flex', alignItems: 'center', gap: 0.5,
              color: 'text.secondary', fontFamily: 'mono',
              borderBottom: '1px solid rgba(88,196,220,0.12)' }}
      >
        EBRT PLANS ({plans.length})
        <Box sx={{ flex: 1 }} />
        <Chip
          label={selectedPlan?.approvalStatus ?? '—'}
          size="small"
          sx={{ height: 14, fontSize: '0.55rem' }}
          color={selectedPlan?.approvalStatus === 'APPROVED' ? 'success' : 'warning'}
          variant="outlined"
        />
      </Typography>

      {/* plan list */}
      <Box sx={{ px: 1, py: 0.75, display: 'flex', flexDirection: 'column', gap: 0.25 }}>
        {plans.length === 0 && !showNewPlan && (
          <Typography variant="caption" sx={{ fontSize: '0.65rem', color: 'text.disabled' }}>
            No plans yet.
          </Typography>
        )}
        {plans.map(p => (
          <Box
            key={p.id}
            onClick={() => { setSelectedPlanId(p.id); selectPlan(p.id).catch(err => setFormError(err.message)); }}
            sx={{
              display: 'flex', alignItems: 'center', gap: 0.75, px: 0.75, py: 0.4,
              borderRadius: 0.5, cursor: 'pointer',
              border: '1px solid',
              borderColor: p.id === selectedPlanId ? 'rgba(88,196,220,0.6)' : 'transparent',
              bgcolor: p.id === selectedPlanId ? 'rgba(88,196,220,0.08)' : 'transparent',
            }}
          >
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="caption" sx={{ fontSize: '0.7rem', display: 'block', noWrap: true }}>
                {p.name}
              </Typography>
              <Typography variant="caption" sx={{ fontSize: '0.58rem', color: 'text.secondary', fontFamily: 'mono' }}>
                {p.prescriptionDoseGy?.toFixed(2)} Gy / {p.numberOfFractions} fx · {p.beamCount ?? p.beams?.length ?? 0} beams
              </Typography>
            </Box>
            <IconButton
              size="small" sx={{ p: 0.25 }}
              aria-label={`plan-delete-${p.name}`}
              onClick={(e) => { e.stopPropagation(); ebrt.deletePlan(p.id).catch(err => setFormError(err.message)); }}
            >
              <Delete sx={{ fontSize: 13, color: 'text.secondary' }} />
            </IconButton>
          </Box>
        ))}
        <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5 }}>
          <Button size="small" fullWidth variant="outlined" startIcon={<Add />}
                  onClick={() => setShowNewPlan(v => !v)}
                  sx={{ fontSize: '0.62rem', color: 'text.secondary', borderColor: 'rgba(88,196,220,0.3)' }}>
            New Plan
          </Button>
          <Button size="small" fullWidth variant="outlined" startIcon={<CloudDownload />}
                  onClick={handleImportRTPlan} disabled={!rtPlanFileId}
                  sx={{ fontSize: '0.62rem', color: 'text.secondary', borderColor: 'rgba(88,196,220,0.3)' }}>
            Import RTPLAN
          </Button>
          <Button size="small" fullWidth variant="outlined" startIcon={<Bookmark />}
                  onClick={() => {
                    setShowTemplates(v => !v);
                    if (!showTemplates) ebrt.refreshTemplates().catch(err => setFormError(err.message));
                  }}
                  sx={{ fontSize: '0.62rem', color: 'text.secondary', borderColor: 'rgba(88,196,220,0.3)' }}>
            Templates
          </Button>
        </Box>

        {showTemplates && (
          <Box sx={{ px: 0.75, py: 0.5, display: 'flex', flexDirection: 'column', gap: 0.25 }}>
            <Typography variant="caption" sx={{ fontSize: '0.6rem', color: 'text.secondary', fontFamily: 'mono' }}>
              PLAN TEMPLATES ({ebrt.templates.length})
            </Typography>
            {ebrt.templates.length === 0 && (
              <Typography variant="caption" sx={{ fontSize: '0.6rem', color: 'text.disabled' }}>
                No templates yet — select a plan and save it as one.
              </Typography>
            )}
            {ebrt.templates.map(t => (
              <Box key={t.id} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="caption" sx={{ fontSize: '0.65rem', display: 'block', noWrap: true }}>
                    {t.name}
                  </Typography>
                  <Typography variant="caption" sx={{ fontSize: '0.55rem', color: 'text.secondary', fontFamily: 'mono' }}>
                    {t.prescriptionDoseGy?.toFixed(1)} Gy / {t.numberOfFractions} fx · {t.beamCount} beams
                  </Typography>
                </Box>
                <Button size="small" variant="outlined"
                        onClick={() => handleInstantiate(t.id)}
                        sx={{ fontSize: '0.55rem', py: 0.1, color: 'primary.main', borderColor: 'rgba(88,196,220,0.3)' }}>
                  Use
                </Button>
              </Box>
            ))}
          </Box>
        )}
      </Box>

      {formError && (
        <Typography variant="caption" color="error" sx={{ px: 1.5, fontSize: '0.62rem' }}>
          {formError}
        </Typography>
      )}

      {/* new plan form */}
      {showNewPlan && (
        <Box sx={{ px: 1.5, py: 1, display: 'flex', flexDirection: 'column', gap: 0.75,
                   borderBottom: '1px solid rgba(88,196,220,0.12)' }}>
          <Typography variant="caption" sx={{ fontSize: '0.62rem', color: 'text.secondary', fontFamily: 'mono' }}>
            NEW PLAN
          </Typography>
          <TextField size="small" label="Plan name" value={name} onChange={e => setName(e.target.value)}
                     inputProps={{ style: { fontSize: '0.7rem' } }} />
          <TextField size="small" select label="Course" value={courseId}
                     onChange={e => setCourseId(e.target.value)}
                     inputProps={{ style: { fontSize: '0.7rem' } }}>
            <MenuItem value="" sx={{ fontSize: '0.7rem' }}>— none —</MenuItem>
            {(ebrt.courses ?? []).map(c => <MenuItem key={c.id} value={c.id} sx={{ fontSize: '0.7rem' }}>{c.name}</MenuItem>)}
          </TextField>
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            <TextField size="small" label="New course" value={newCourseName}
                       onChange={e => setNewCourseName(e.target.value)}
                       inputProps={{ style: { fontSize: '0.7rem' } }} />
            <Button size="small" onClick={handleCreateCourse} disabled={!newCourseName.trim()}
                    sx={{ fontSize: '0.6rem', whiteSpace: 'nowrap' }}>Add</Button>
          </Box>
          <TextField size="small" select label="Machine" value={machineId}
                     onChange={e => { setMachineId(e.target.value); setEnergyMv(getMachine(e.target.value).energies[0]); }}
                     inputProps={{ style: { fontSize: '0.7rem' } }}>
            {MACHINES.map(m => <MenuItem key={m.id} value={m.id}>{m.label}</MenuItem>)}
          </TextField>
          <TextField size="small" label="Target structure" value={targetStructure}
                     onChange={e => setTargetStructure(e.target.value)}
                     inputProps={{ style: { fontSize: '0.7rem' } }} />
          <TextField size="small" select label="Energy (MV)" value={energyMv}
                     onChange={e => setEnergyMv(Number(e.target.value))}
                     inputProps={{ style: { fontSize: '0.7rem' } }}>
            {machine.energies.map(e => <MenuItem key={e} value={e}>{e} MV</MenuItem>)}
          </TextField>
          <Box sx={{ display: 'flex', gap: 0.75 }}>
            <TextField size="small" label="Dose (Gy)" value={doseGy}
                       onChange={e => setDoseGy(e.target.value)} inputProps={{ style: { fontSize: '0.7rem' } }} />
            <TextField size="small" label="Fractions" value={fx}
                       onChange={e => setFx(e.target.value)} inputProps={{ style: { fontSize: '0.7rem' } }} />
          </Box>
          {dosePerFx && (
            <Typography variant="caption" sx={{ fontSize: '0.6rem', color: 'text.disabled' }}>
              {dosePerFx} Gy per fraction
            </Typography>
          )}
          <TextField size="small" select label="Normalization" value={normalization}
                     onChange={e => setNormalization(e.target.value)}
                     inputProps={{ style: { fontSize: '0.7rem' } }}>
            {NORMALIZATIONS.map(n => <MenuItem key={n.id} value={n.id}>{n.label}</MenuItem>)}
          </TextField>
          <TextField size="small" select label="Optimization algorithm" value={optAlgorithm}
                     onChange={e => setOptAlgorithm(e.target.value)}
                     inputProps={{ style: { fontSize: '0.7rem' } }}>
            {OPTIMIZATION_ALGORITHMS.map(a => <MenuItem key={a.id} value={a.id}>{a.label}</MenuItem>)}
          </TextField>
          <TextField size="small" select label="Dose algorithm" value={doseAlgorithm}
                     onChange={e => setDoseAlgorithm(e.target.value)}
                     inputProps={{ style: { fontSize: '0.7rem' } }}>
            {DOSE_ALGORITHMS.map(a => <MenuItem key={a.id} value={a.id}>{a.label}</MenuItem>)}
          </TextField>
          <Box sx={{ display: 'flex', gap: 0.75, alignItems: 'center' }}>
            <TextField size="small" label="Grid (mm)" value={gridSize}
                       onChange={e => setGridSize(e.target.value)} inputProps={{ style: { fontSize: '0.7rem' } }} />
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 1 }}>
              <Settings sx={{ fontSize: 13, color: 'text.secondary' }} />
              <Typography variant="caption" sx={{ fontSize: '0.6rem', color: 'text.secondary' }}>
                Heterogeneity
              </Typography>
              <Switch size="small" checked={heterogeneity} onChange={e => setHeterogeneity(e.target.checked)} />
            </Box>
          </Box>
          <Button size="small" variant="contained" onClick={handleCreatePlan}
                  disabled={!name.trim() || !doseGy || !fx}
                  sx={{ fontSize: '0.65rem' }}>
            Create Plan
          </Button>
        </Box>
      )}

      {/* beam management for the selected plan */}
      {selectedPlan && (
        <>
          {/* approval flow + template actions */}
          <Box sx={{ px: 1, py: 0.6, display: 'flex', alignItems: 'center', gap: 0.5,
                     borderBottom: '1px solid rgba(88,196,220,0.12)' }}>
            <Chip
              label={selectedPlan.approvalStatus}
              size="small"
              sx={{ height: 16, fontSize: '0.55rem', fontFamily: 'mono' }}
              color={selectedPlan.approvalStatus === 'APPROVED' ? 'success'
                : selectedPlan.approvalStatus === 'REVIEWED' ? 'info' : 'warning'}
              variant="outlined"
            />
            {NEXT_APPROVAL[selectedPlan.approvalStatus] && (
              <Tooltip title={`Mark as ${NEXT_APPROVAL[selectedPlan.approvalStatus]}`}>
                <Button size="small" variant="outlined" startIcon={<GppGood />}
                        onClick={handleApprovalAdvance}
                        sx={{ fontSize: '0.55rem', py: 0.1, color: 'primary.main', borderColor: 'rgba(88,196,220,0.3)' }}>
                  {NEXT_APPROVAL[selectedPlan.approvalStatus]}
                </Button>
              </Tooltip>
            )}
            {selectedPlan.approvalStatus !== 'UNAPPROVED' && (
              <Button size="small" variant="text"
                      onClick={handleApprovalReset}
                      sx={{ fontSize: '0.55rem', py: 0.1, color: 'text.secondary', minWidth: 0 }}>
                Reset
              </Button>
            )}
            <Tooltip title="Peer review this plan (comments + approve/reject)">
              <Button size="small" variant={showReview ? 'contained' : 'outlined'} startIcon={<RateReview />}
                      onClick={() => setShowReview(v => !v)}
                      sx={{ fontSize: '0.55rem', py: 0.1, color: 'text.secondary', borderColor: 'rgba(88,196,220,0.3)' }}>
                Review
              </Button>
            </Tooltip>
            <Box sx={{ flex: 1 }} />
            <Tooltip title="Save this plan as a reusable template">
              <IconButton size="small" sx={{ p: 0.25 }} aria-label="plan-save-as-template"
                          onClick={handleSaveAsTemplate}>
                <BookmarkAdded sx={{ fontSize: 14, color: 'text.secondary' }} />
              </IconButton>
            </Tooltip>
          </Box>

          {/* peer review session panel (Ch5) */}
          {showReview && (
            <PeerReviewPanel
              plan={selectedPlan}
              currentSliceIdx={currentSliceIdx}
              onJumpToSlice={onJumpToSlice}
              onPlanUpdated={() => ebrt.refreshList?.()}
            />
          )}

          <Typography
            variant="caption"
            sx={{ px: 1, py: 0.5, display: 'block', color: 'text.secondary', fontFamily: 'mono',
                  borderBottom: '1px solid rgba(88,196,220,0.12)' }}
          >
            BEAMS ({selectedPlan.beams?.length ?? 0}) — click row to visualize
          </Typography>
          <Table size="small" sx={{ '& .MuiTableCell-root': { py: 0.25, px: 0.6, fontSize: '0.6rem', fontFamily: 'mono', borderColor: 'rgba(88,196,220,0.08)' } }}>
            <TableHead>
              <TableRow>
                <TableCell>#</TableCell>
                <TableCell>Type</TableCell>
                <TableCell align="right">Gantry°</TableCell>
                <TableCell align="right">Wdg°</TableCell>
                <TableCell align="right">W</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {(selectedPlan.beams ?? []).map(b => (
                <TableRow
                  key={b.id}
                  hover
                  selected={selectedBeam?.id === b.id}
                  onClick={() => handleLoadBeamDetail(b)}
                  sx={{ cursor: 'pointer' }}
                >
                  <TableCell>{b.beamNumber}</TableCell>
                  <TableCell>{b.beamType}</TableCell>
                  <TableCell align="right">
                    {b.gantryAngle}{b.beamType === 'VMAT' && b.gantryAngleStop != null ? `→${b.gantryAngleStop}` : ''}
                  </TableCell>
                  <TableCell align="right">{b.wedgeAngle ?? '—'}</TableCell>
                  <TableCell align="right">{b.weight != null ? b.weight.toFixed(2) : '—'}</TableCell>
                  <TableCell align="right">
                    <IconButton
                      size="small" sx={{ p: 0.2 }}
                      aria-label={`beam-delete-${b.beamNumber}`}
                      onClick={(e) => { e.stopPropagation(); ebrt.deleteBeam(b.id).catch(err => setFormError(err.message)); }}
                    >
                      <Delete sx={{ fontSize: 12, color: 'text.secondary' }} />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {/* selected-beam detail: control points + MLC + subfields + opposing */}
          {selectedBeam && (
            <Box sx={{ px: 1, py: 0.75, display: 'flex', flexDirection: 'column', gap: 0.5,
                       borderBottom: '1px solid rgba(88,196,220,0.12)' }}>
              <Typography variant="caption" sx={{ fontSize: '0.6rem', color: 'text.secondary', fontFamily: 'mono' }}>
                BEAM {selectedBeam.beamNumber} · {selectedBeam.beamType}
              </Typography>
              <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                <Tooltip title="Create the 180° opposing field (Eclipse Opposing Field)">
                  <Button size="small" variant="outlined" startIcon={<CallSplit fontSize="small" />}
                          onClick={handleOpposing}
                          sx={{ fontSize: '0.6rem', color: 'text.secondary', borderColor: 'rgba(88,196,220,0.3)' }}>
                    Opposing
                  </Button>
                </Tooltip>
                {cps && cps.length > 0 && (
                  <Chip size="small" label={`${cps.length} CPs`}
                        sx={{ height: 18, fontSize: '0.55rem', fontFamily: 'mono' }} />
                )}
                {subfields.length > 0 && (
                  <Chip size="small" label={`${subfields.length} FiF`}
                        sx={{ height: 18, fontSize: '0.55rem', fontFamily: 'mono' }} />
                )}
              </Box>

              {/* MLC leaf editor for the selected control point */}
              {cps && cps.length > 0 && (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.4 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Typography variant="caption" sx={{ fontSize: '0.58rem', color: 'text.secondary', fontFamily: 'mono' }}>
                      CP
                    </Typography>
                    <Slider
                      size="small" min={0} max={cps.length - 1} value={Math.min(cpIndex, cps.length - 1)}
                      onChange={(_, v) => { setCpIndex(v); setDraftLeaves(null); }}
                      sx={{ flex: 1, color: '#58c4dc', py: 0.25 }}
                      aria-label="control-point-index"
                    />
                    <Typography variant="caption" sx={{ fontSize: '0.58rem', fontFamily: 'mono', color: 'text.secondary' }}>
                      {Math.min(cpIndex, cps.length - 1)}/{cps.length - 1}
                    </Typography>
                  </Box>
                  {activeCp?.mlc?.leafPairs?.length > 0 ? (
                    <>
                      <MlcLeafEditor
                        leafPairs={draftLeaves ?? activeCp.mlc.leafPairs}
                        label={`CP${Math.min(cpIndex, cps.length - 1)} ${activeCp.mlc.type ?? 'MLCX'}`}
                        onChange={(leafPairs) => setDraftLeaves(leafPairs)}
                      />
                      <Button size="small" variant="outlined" disabled={!draftLeaves}
                              onClick={handleSaveCpMlc}
                              sx={{ fontSize: '0.58rem', alignSelf: 'flex-start' }}>
                        Save CP MLC
                      </Button>
                    </>
                  ) : (
                    <Typography variant="caption" sx={{ fontSize: '0.55rem', color: 'text.disabled' }}>
                      This control point has no MLC data
                      {activeCp?.gantryAngle != null ? ` · gantry ${activeCp.gantryAngle}°` : ''}
                    </Typography>
                  )}
                </Box>
              )}

              <SubfieldEditor
                beam={selectedBeam}
                subfields={subfields}
                onAdd={handleAddSubfield}
                onDelete={handleDeleteSubfield}
                onChange={handleUpdateSubfield}
              />
            </Box>
          )}

          {/* plan ops: normalize / couch / checks / revisions */}
          <Box sx={{ px: 1, py: 0.75, display: 'flex', flexDirection: 'column', gap: 0.6,
                     borderBottom: '1px solid rgba(88,196,220,0.12)' }}>
            <Typography variant="caption" sx={{ fontSize: '0.6rem', color: 'text.secondary', fontFamily: 'mono' }}>
              PLAN OPS
            </Typography>
            <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center', flexWrap: 'wrap' }}>
              <TextField size="small" select label="Normalize" value={normMode}
                         onChange={e => setNormMode(e.target.value)}
                         sx={{ minWidth: 130 }}
                         inputProps={{ style: { fontSize: '0.65rem' } }}>
                <MenuItem value="NONE" sx={{ fontSize: '0.7rem' }}>None</MenuItem>
                <MenuItem value="TARGET_MAX" sx={{ fontSize: '0.7rem' }}>Target Max</MenuItem>
                <MenuItem value="TARGET_MEAN" sx={{ fontSize: '0.7rem' }}>Target Mean</MenuItem>
                <MenuItem value="TARGET_MIN" sx={{ fontSize: '0.7rem' }}>Target Min</MenuItem>
                <MenuItem value="PERCENT_OF_TARGET" sx={{ fontSize: '0.7rem' }}>% of Target (cGy)</MenuItem>
                <MenuItem value="PERCENT_COVERS" sx={{ fontSize: '0.7rem' }}>% covers % of Target</MenuItem>
                <MenuItem value="BODY_MAX" sx={{ fontSize: '0.7rem' }}>Body Max %</MenuItem>
                <MenuItem value="PRIMARY_REF_POINT" sx={{ fontSize: '0.7rem' }}>Primary Ref Point %</MenuItem>
                <MenuItem value="REFERENCE_POINT" sx={{ fontSize: '0.7rem' }}>Reference Point…</MenuItem>
                <MenuItem value="ISOCENTER" sx={{ fontSize: '0.7rem' }}>Isocenter %</MenuItem>
                <MenuItem value="VALUE" sx={{ fontSize: '0.7rem' }}>Normalization Value %</MenuItem>
              </TextField>
              {['ISOCENTER', 'VALUE', 'BODY_MAX', 'PRIMARY_REF_POINT', 'TARGET_MAX', 'TARGET_MEAN', 'TARGET_MIN'].includes(normMode) ? (
                <TextField size="small" label="%" value={normValue} onChange={e => setNormValue(e.target.value)}
                           sx={{ width: 64 }}
                           inputProps={{ style: { fontSize: '0.65rem' } }} />
              ) : null}
              {normMode === 'PERCENT_OF_TARGET' ? (
                <TextField size="small" label="cGy" value={normValue} onChange={e => setNormValue(e.target.value)}
                           sx={{ width: 70 }}
                           inputProps={{ style: { fontSize: '0.65rem' } }} />
              ) : null}
              {normMode === 'REFERENCE_POINT' ? (
                <TextField size="small" label="Point name" value={normValue} onChange={e => setNormValue(e.target.value)}
                           sx={{ width: 110 }}
                           inputProps={{ style: { fontSize: '0.65rem' } }} />
              ) : null}
              {normMode === 'PERCENT_COVERS' ? (
                <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center', width: '100%' }}>
                  <TextField size="small" label="Dose %" value={coversDose}
                             onChange={e => setCoversDose(e.target.value)}
                             sx={{ width: 80 }} inputProps={{ style: { fontSize: '0.65rem' } }} />
                  <Typography variant="caption" sx={{ fontSize: '0.6rem', color: 'text.secondary' }}>% covers</Typography>
                  <TextField size="small" label="Vol %" value={coversVol}
                             onChange={e => setCoversVol(e.target.value)}
                             sx={{ width: 80 }} inputProps={{ style: { fontSize: '0.65rem' } }} />
                  <Typography variant="caption" sx={{ fontSize: '0.6rem', color: 'text.secondary' }}>% of target</Typography>
                </Box>
              ) : null}
              <Tooltip title="Rescale the plan dose grid (requires an associated dose file)">
                <Button size="small" variant="outlined" startIcon={<Straighten fontSize="small" />}
                        onClick={handleNormalize}
                        sx={{ fontSize: '0.6rem', color: 'text.secondary', borderColor: 'rgba(88,196,220,0.3)' }}>
                  Apply
                </Button>
              </Tooltip>
            </Box>
            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
              <Tooltip title="Calculate the plan dose on the study's dose geometry (Eclipse Dose Calculation)">
                <Button size="small" variant="outlined" startIcon={<Calculate fontSize="small" />}
                        disabled={doseBusy}
                        onClick={handleCalculateDose}
                        sx={{ fontSize: '0.6rem', color: 'text.secondary', borderColor: 'rgba(88,196,220,0.3)' }}>
                  {doseBusy ? 'Calculating…' : 'Calc Dose'}
                </Button>
              </Tooltip>
              <Tooltip title="Reference point dose report (Eclipse Reference Points tab)">
                <Button size="small" variant={showPointDoses ? 'contained' : 'outlined'}
                        startIcon={<PinDrop fontSize="small" />}
                        onClick={handleLoadPointDoses}
                        sx={{ fontSize: '0.6rem', color: 'text.secondary', borderColor: 'rgba(88,196,220,0.3)' }}>
                  Point Doses
                </Button>
              </Tooltip>
              <Tooltip title="Generate a couch structure ROI for this study (Eclipse Couch Structures)">
                <Button size="small" variant="outlined" startIcon={<Hotel fontSize="small" />}
                        onClick={handleAddCouch}
                        sx={{ fontSize: '0.6rem', color: 'text.secondary', borderColor: 'rgba(88,196,220,0.3)' }}>
                  Couch
                </Button>
              </Tooltip>
              <Tooltip title="Run plan approval checks (errors/warnings)">
                <Button size="small" variant="outlined" startIcon={<FactCheck fontSize="small" />}
                        onClick={handleLoadChecks}
                        sx={{ fontSize: '0.6rem', color: 'text.secondary', borderColor: 'rgba(88,196,220,0.3)' }}>
                  Checks
                </Button>
              </Tooltip>
              <Tooltip title="Plan revisions history (Eclipse Revisions to Plans)">
                <Button size="small" variant={showRevisions ? 'contained' : 'outlined'}
                        startIcon={<History fontSize="small" />}
                        onClick={handleShowRevisions}
                        sx={{ fontSize: '0.6rem', color: 'text.secondary', borderColor: 'rgba(88,196,220,0.3)' }}>
                  Revisions
                </Button>
              </Tooltip>
              <Button size="small" variant="text" onClick={handleCaptureRevision}
                      sx={{ fontSize: '0.6rem', color: 'text.secondary', minWidth: 0 }}>
                Snapshot
              </Button>
            </Box>

            {checks && (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
                {(checks.errors ?? []).map((e, i) => (
                  <Alert key={`e${i}`} severity="error" sx={{ py: 0, fontSize: '0.6rem' }}>{e}</Alert>
                ))}
                {(checks.warnings ?? []).map((w, i) => (
                  <Alert key={`w${i}`} severity="warning" sx={{ py: 0, fontSize: '0.6rem' }}>{w}</Alert>
                ))}
                {(checks.errors ?? []).length === 0 && (checks.warnings ?? []).length === 0 && (
                  <Alert severity="success" sx={{ py: 0, fontSize: '0.6rem' }}>No issues</Alert>
                )}
              </Box>
            )}

            {showPointDoses && (
              <Box sx={{ border: '1px solid rgba(88,196,220,0.12)', borderRadius: 0.5, maxHeight: 160, overflow: 'auto' }}>
                {(pointDoses ?? []).length === 0 && (
                  <Typography variant="caption" sx={{ display: 'block', px: 1, py: 0.5, fontSize: '0.6rem', color: 'text.disabled' }}>
                    No reference points on this plan
                  </Typography>
                )}
                {(pointDoses ?? []).length > 0 && (
                  <Table size="small" sx={{ '& .MuiTableCell-root': { fontSize: '0.58rem', py: 0.15, px: 0.75, fontFamily: 'IBM Plex Mono, monospace' } }}>
                    <TableHead>
                      <TableRow>
                        <TableCell>Point</TableCell>
                        <TableCell>Type</TableCell>
                        <TableCell align="right">Dose (cGy)</TableCell>
                        <TableCell align="right">Per fx</TableCell>
                        <TableCell align="right">% Rx</TableCell>
                        <TableCell align="right">Limit</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {(pointDoses ?? []).map((p, i) => (
                        <TableRow key={`${p.name}-${i}`}>
                          <TableCell>{p.inGrid === false ? `${p.name} (off-grid)` : p.name}</TableCell>
                          <TableCell>{p.type ?? (p.x == null ? 'DPV' : 'POINT')}</TableCell>
                          <TableCell align="right">{p.totalDoseCgy != null ? p.totalDoseCgy.toFixed(1) : '—'}</TableCell>
                          <TableCell align="right">{p.perFractionCgy != null ? p.perFractionCgy.toFixed(1) : '—'}</TableCell>
                          <TableCell align="right">{p.pctOfRx != null ? `${p.pctOfRx.toFixed(0)}%` : '—'}</TableCell>
                          <TableCell align="right">{p.totalDoseLimitGy != null ? `${p.totalDoseLimitGy} Gy` : '—'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </Box>
            )}

            {showRevisions && (
              <Box sx={{ border: '1px solid rgba(88,196,220,0.12)', borderRadius: 0.5, maxHeight: 140, overflow: 'auto' }}>
                {revisions.length === 0 && (
                  <Typography variant="caption" sx={{ display: 'block', px: 1, py: 0.5, fontSize: '0.6rem', color: 'text.disabled' }}>
                    No revisions yet
                  </Typography>
                )}
                {revisions.map(r => (
                  <Box key={r.revisionNo ?? r.id} sx={{ display: 'flex', alignItems: 'center', gap: 0.5, px: 1, py: 0.25 }}>
                    <Typography sx={{ flex: 1, fontSize: '0.6rem', fontFamily: 'mono' }}>
                      v{r.revisionNo} · {r.createdAt ?? r.created_at ?? ''}
                    </Typography>
                    <Button size="small" sx={{ fontSize: '0.55rem', minWidth: 0 }}
                            onClick={() => ebrt.rollbackRevision(selectedPlan.id, r.revisionNo)
                              .then(() => setOpNote(`Rolled back to v${r.revisionNo}`))
                              .catch(err => setFormError(err.message))}>
                      Rollback
                    </Button>
                  </Box>
                ))}
              </Box>
            )}

            {opNote && (
              <Typography variant="caption" sx={{ fontSize: '0.58rem', color: 'text.disabled' }}>
                {opNote}
              </Typography>
            )}
          </Box>

          {/* add beam form */}
          <Box sx={{ px: 1.5, py: 1, display: 'flex', flexDirection: 'column', gap: 0.75 }}>
            <Typography variant="caption" sx={{ fontSize: '0.62rem', color: 'text.secondary', fontFamily: 'mono' }}>
              ADD BEAM
            </Typography>
            <Box sx={{ display: 'flex', gap: 0.75 }}>
              <TextField size="small" select label="Type" value={beamType}
                         onChange={e => setBeamType(e.target.value)} sx={{ flex: 1 }}
                         inputProps={{ style: { fontSize: '0.7rem' } }}>
                <MenuItem value="STATIC">Static</MenuItem>
                <MenuItem value="DMLC">DMLC IMRT</MenuItem>
                <MenuItem value="VMAT">VMAT arc</MenuItem>
              </TextField>
              {beamType === 'VMAT' ? (
                <Box sx={{ display: 'flex', gap: 0.75, flex: 1 }}>
                  <TextField size="small" label="From°" value={gantry}
                             onChange={e => setGantry(e.target.value)} inputProps={{ style: { fontSize: '0.7rem' } }} />
                  <TextField size="small" label="To°" value={gantryStop}
                             onChange={e => setGantryStop(e.target.value)} inputProps={{ style: { fontSize: '0.7rem' } }} />
                </Box>
              ) : (
                <TextField size="small" label="Gantry°" value={gantry}
                           onChange={e => setGantry(e.target.value)} sx={{ flex: 1 }}
                           inputProps={{ style: { fontSize: '0.7rem' } }} />
              )}
            </Box>
            <Box sx={{ display: 'flex', gap: 0.75 }}>
              <TextField size="small" label="Collimator°" value={collimator}
                         onChange={e => setCollimator(e.target.value)} inputProps={{ style: { fontSize: '0.7rem' } }} />
              <TextField size="small" label="Couch°" value={couch}
                         onChange={e => setCouch(e.target.value)} inputProps={{ style: { fontSize: '0.7rem' } }} />
            </Box>
            <Box sx={{ display: 'flex', gap: 0.75 }}>
              <TextField size="small" label="Field X (mm)" value={jawX}
                         onChange={e => setJawX(e.target.value)} inputProps={{ style: { fontSize: '0.7rem' } }} />
              <TextField size="small" label="Field Y (mm)" value={jawY}
                         onChange={e => setJawY(e.target.value)} inputProps={{ style: { fontSize: '0.7rem' } }} />
            </Box>
            <Box sx={{ display: 'flex', gap: 0.75 }}>
              <TextField size="small" label="Wedge° (opt.)" value={wedgeAngle}
                         onChange={e => setWedgeAngle(e.target.value)} inputProps={{ style: { fontSize: '0.7rem' } }} />
              <TextField size="small" label="Bolus (opt.)" value={bolus}
                         onChange={e => setBolus(e.target.value)} inputProps={{ style: { fontSize: '0.7rem' } }} />
            </Box>
            <Button size="small" variant="contained" startIcon={<Add />}
                    onClick={handleAddBeam} sx={{ fontSize: '0.65rem' }}>
              Add Beam
            </Button>
          </Box>

          {/* reference points */}
          <Box sx={{ px: 1.5, py: 1, display: 'flex', flexDirection: 'column', gap: 0.5,
                     borderTop: '1px solid rgba(88,196,220,0.12)' }}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <Typography variant="caption" sx={{ fontSize: '0.62rem', color: 'text.secondary', fontFamily: 'mono' }}>
                REFERENCE POINTS ({refPoints.length})
              </Typography>
              <Box sx={{ flex: 1 }} />
              {refPointsDirty && (
                <Button size="small" variant="contained" onClick={saveRefPoints}
                        sx={{ fontSize: '0.55rem', py: 0.1 }}>
                  Save
                </Button>
              )}
            </Box>
            <Typography variant="caption" sx={{ fontSize: '0.55rem', color: 'text.disabled' }}>
              Patient-space points (mm) shown in the viewport — dose is reported here.
            </Typography>
            {refPoints.map((pt, idx) => (
              <Box key={idx} sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
                <TextField size="small" value={pt.name} label="name"
                           onChange={e => updateRefPoint(idx, { name: e.target.value })}
                           sx={{ flex: 1.4 }}
                           inputProps={{ style: { fontSize: '0.62rem' } }} />
                <TextField size="small" value={pt.x} label="x"
                           onChange={e => updateRefPoint(idx, { x: numOrNull(e.target.value) ?? 0 })}
                           sx={{ flex: 0.8 }}
                           inputProps={{ style: { fontSize: '0.62rem' } }} />
                <TextField size="small" value={pt.y} label="y"
                           onChange={e => updateRefPoint(idx, { y: numOrNull(e.target.value) ?? 0 })}
                           sx={{ flex: 0.8 }}
                           inputProps={{ style: { fontSize: '0.62rem' } }} />
                <TextField size="small" value={pt.z} label="z"
                           onChange={e => updateRefPoint(idx, { z: numOrNull(e.target.value) ?? 0 })}
                           sx={{ flex: 0.8 }}
                           inputProps={{ style: { fontSize: '0.62rem' } }} />
                <IconButton size="small" sx={{ p: 0.2 }} aria-label={`refpoint-delete-${pt.name}`}
                            onClick={() => { setRefPoints(prev => prev.filter((_, i) => i !== idx)); setRefPointsDirty(true); }}>
                  <Delete sx={{ fontSize: 12, color: 'text.secondary' }} />
                </IconButton>
              </Box>
            ))}
            <Button size="small" variant="outlined" startIcon={<Add />}
                    onClick={() => { setRefPoints(prev => [...prev, { name: `Point ${prev.length + 1}`, x: 0, y: 0, z: 0 }]); setRefPointsDirty(true); }}
                    sx={{ fontSize: '0.6rem', color: 'text.secondary', borderColor: 'rgba(88,196,220,0.3)' }}>
              Add Reference Point
            </Button>
          </Box>
        </>
      )}
    </Box>
  );
}
