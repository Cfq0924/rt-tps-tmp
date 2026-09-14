import { useEffect, useMemo, useRef, useState } from 'react';
import { Box, Typography, TextField, MenuItem, Button, Chip, LinearProgress,
         Checkbox, Tooltip, Select, IconButton, Dialog, DialogTitle, DialogContent,
         DialogActions } from '@mui/material';
import { PlayArrow, Pause, Delete, Save, AutoFixHigh, Undo,
         CheckCircleOutline, Stop as StopIcon } from '@mui/icons-material';
import DVHChart from '../evaluation/DVHChart.jsx';

// ---- Eclipse Photon Optimization window (Eclipse 15.5 使用说明 §优化, p151-167) ----
// Planning > Optimization > Optimize… (F7) opens this window: three panes
// (Structures & Objectives | DVO | Plan Information) with the process
// control bar at the bottom (§P).

const OBJECTIVE_TYPES = [
  { id: 'upper', label: 'Upper' },
  { id: 'lower', label: 'Lower' },
  { id: 'mean', label: 'Mean' },
  { id: 'upper_geud', label: 'Upper gEUD', geud: true },
  { id: 'target_geud', label: 'Target gEUD', geud: true },
  { id: 'lower_geud', label: 'Lower gEUD', geud: true },
];

const MLC_MODELS = ['Millennium 120', 'HD 120 MLC'];
const DEFAULT_SETTINGS = { maxIterations: 999, maxTimeMin: 30, resolutionMm: 2.5 };
const DEFAULT_PRIORITY = 100;

function normalizeOptState(plan, prescriptionCgy) {
  const rx = prescriptionCgy ?? 0;
  const raw = plan?.optimizationObjectives;
  const LEGACY = { TARGET_LOWER: 'lower', TARGET_UPPER: 'upper', MAX_DOSE: 'upper', MIN_DOSE: 'lower', MEAN_DOSE: 'mean' };
  let objectives;
  if (Array.isArray(raw)) {
    objectives = raw.map(o => ({
      structureName: o.structureName,
      type: LEGACY[o.type] ?? 'upper',
      doseCgy: o.doseCgy ?? (o.dosePct != null && rx ? Math.round((o.dosePct / 100) * rx) : null),
      volumePct: o.volumePct ?? null,
      priority: o.priority ?? o.weight ?? DEFAULT_PRIORITY,
      paramA: null,
      enabled: o.enabled !== false,
    }));
  } else if (raw && typeof raw === 'object' && Array.isArray(raw.objectives)) {
    objectives = raw.objectives;
  } else {
    objectives = [];
  }
  const nto = (raw && typeof raw === 'object' && raw.nto) || null;
  const settings = { ...DEFAULT_SETTINGS, ...(plan?.optimizationSettings ?? {}) };
  return { objectives, nto, settings };
}

function suggestObjectives(structuresList, prescriptionCgy) {
  const rx = prescriptionCgy ?? 0;
  const dose = (pct) => (rx ? Math.round((pct / 100) * rx) : null);
  const gen = [];
  for (const name of structuresList) {
    if (/PTV/i.test(name)) {
      gen.push({ structureName: name, type: 'lower', doseCgy: dose(95), volumePct: 100, priority: 300, enabled: true });
      gen.push({ structureName: name, type: 'upper', doseCgy: dose(107), volumePct: 0, priority: 200, enabled: true });
    } else if (/CORD|BRAIN ?STEM|CHIASM|LENS|EYE/i.test(name)) {
      gen.push({ structureName: name, type: 'upper', doseCgy: dose(60), volumePct: 0.1, priority: 150, enabled: true });
    } else if (/PAROTID/i.test(name)) {
      gen.push({ structureName: name, type: 'mean', doseCgy: dose(40), volumePct: null, priority: 120, enabled: true });
    }
  }
  return gen;
}

function Pane({ title, right = null, children, flex = 1 }) {
  return (
    <Box sx={{ border: '1px solid rgba(88,196,220,0.2)', borderRadius: 1, display: 'flex',
          flexDirection: 'column', minHeight: 0, flex, overflow: 'hidden', background: 'rgba(13,24,40,0.6)' }}>
      <Typography variant="caption" sx={{ px: 1, py: 0.4, fontSize: '0.58rem', color: 'text.secondary',
            fontFamily: 'mono', borderBottom: '1px solid rgba(88,196,220,0.15)', flexShrink: 0 }}>
        {title}
      </Typography>
      <Box sx={{ flex: 1, overflow: 'auto', p: 0.75, display: 'flex', flexDirection: 'column', gap: 0.5 }}>{children}</Box>
    </Box>
  );
}

function MicroLabel({ children, width = null }) {
  return (
    <Typography variant="caption" sx={{ fontSize: '0.55rem', color: 'text.secondary',
          fontFamily: 'mono', whiteSpace: 'nowrap', flexShrink: 0, width, display: 'inline-block' }}>
      {children}
    </Typography>
  );
}

function NumField({ width = 52, inputProps: inProps, ...rest }) {
  return (
    <TextField
      size="small"
      {...rest}
      sx={{ width, flexShrink: 0, '& .MuiOutlinedInput-root': { fontSize: '0.62rem' } }}
      inputProps={{ style: { fontSize: '0.62rem', padding: '2px 5px' }, ...inProps }}
    />
  );
}

/**
 * OptimizationWindow - Eclipse Planning > Optimization > Optimize… (F7).
 *
 * @param {Object} props
 * @param {boolean} props.open
 * @param {Object} props.plan - hydrated selected plan
 * @param {Array} props.structures
 * @param {Array} props.dvhResults
 * @param {number|null} props.prescriptionCgy
 * @param {Function} props.onClose
 * @param {Function} props.onSaveOptimization - async ({objectives, nto, settings, mlcModel}) => void
 * @param {Function} props.onSaveBeam - async (beamId, patch) => void
 * @param {Function} props.onLoadDose - load the reference dose grid (DVH pane)
 */
export default function OptimizationWindow({
  open, plan, structures = [], dvhResults = [], prescriptionCgy = null,
  onClose, onSaveOptimization, onSaveBeam, onLoadDose,
}) {
  const derived = useMemo(
    () => normalizeOptState(plan, prescriptionCgy),
    [open, plan?.id, plan?.optimizationObjectives, plan?.optimizationSettings, prescriptionCgy], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const [objectives, setObjectives] = useState(derived.objectives);
  const [nto, setNto] = useState(derived.nto);
  const [settings, setSettings] = useState(derived.settings);
  const [mlcModel, setMlcModel] = useState(plan?.mlcModel ?? MLC_MODELS[0]);
  const [dirty, setDirty] = useState(false);
  const [running, setRunning] = useState(false);
  const [iteration, setIteration] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [converged, setConverged] = useState(false);
  const [runStatus, setRunStatus] = useState(null);
  const [runError, setRunError] = useState('');
  const pollRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    setObjectives(derived.objectives);
    setNto(derived.nto);
    setSettings(derived.settings);
    setMlcModel(plan?.mlcModel ?? MLC_MODELS[0]);
    setDirty(false);
    setRunning(false);
    setIteration(0);
    setConverged(false);
    setRunStatus(null);
    setRunError('');
    onLoadDose?.(); // the DVO pane shows the live DVH from the reference grid
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const structuresList = useMemo(
    () => structures.map(s => s.roiName ?? s.name).filter(Boolean),
    [structures],
  );
  const colorOf = useMemo(() => {
    const m = new Map();
    for (const s of structures) m.set(s.roiName ?? s.name, s.color ?? s.displayColor ?? null);
    return m;
  }, [structures]);

  const grouped = useMemo(() => {
    const groups = [];
    for (const o of objectives) {
      let g = groups.find(x => x.structureName === o.structureName);
      if (!g) { g = { structureName: o.structureName, rows: [] }; groups.push(g); }
      g.rows.push(o);
    }
    return groups;
  }, [objectives]);

  const maxIter = settings.maxIterations ?? 999;
  const enabledObjectives = objectives.filter(o => o.enabled !== false);

  const touch = () => setDirty(true);

  const addObjective = (structureName, type) => {
    setObjectives(prev => [...prev, {
      structureName, type,
      doseCgy: null, volumePct: type === 'lower' ? 100 : (type === 'upper' ? 0 : null),
      priority: DEFAULT_PRIORITY, paramA: type.includes('geud') ? 1 : null, enabled: true,
    }]);
    touch();
  };

  const autoFromRx = () => {
    const suggested = suggestObjectives(structuresList, prescriptionCgy);
    setObjectives(prev => {
      const seen = new Set(prev.map(o => `${o.structureName}:${o.type}`));
      return [...prev, ...suggested.filter(o => !seen.has(`${o.structureName}:${o.type}`))];
    });
    touch();
  };

  const removeObjective = (structureName, type) => {
    setObjectives(prev => prev.filter(o => !(o.structureName === structureName && o.type === type)));
    touch();
  };

  const updateObjective = (structureName, type, patch) => {
    setObjectives(prev => prev.map(o =>
      (o.structureName === structureName && o.type === type ? { ...o, ...patch } : o)));
    touch();
  };

  const save = async () => {
    await onSaveOptimization?.({ objectives, nto, settings, mlcModel });
    setDirty(false);
  };

  const revert = () => {
    setObjectives(derived.objectives);
    setNto(derived.nto);
    setSettings(derived.settings);
    setMlcModel(plan?.mlcModel ?? MLC_MODELS[0]);
    setDirty(false);
  };

  // ---- optimization run (§P): start → poll → MLC written ----
  const startRun = async () => {
    if (running) return;
    setRunError('');
    try {
      await save();
      const res = await fetch(`/api/ebrt/plans/${plan.id}/optimization/start`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ objectives: enabledObjectives, nto, settings }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || `Failed to start (${res.status})`);
      }
      setRunning(true);
      setConverged(false);
      setIteration(0);
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = setInterval(async () => {
        try {
          const st = await fetch(`/api/ebrt/plans/${plan.id}/optimization/status`,
            { credentials: 'include', cache: 'no-store' }).then(r => r.json());
          setRunStatus(st);
          setIteration(st.iteration ?? 0);
          setElapsed(st.elapsedS ?? 0);
          setConverged(!!st.converged);
          if (!st.running && st.exists) {
            clearInterval(pollRef.current);
            setRunning(false);
          }
        } catch { /* transient */ }
      }, 600);
    } catch (e) {
      setRunError(e.message);
    }
  };

  const stopRun = async () => {
    await fetch(`/api/ebrt/plans/${plan.id}/optimization/stop`,
      { method: 'POST', credentials: 'include' }).catch(() => {});
  };

  const beamRows = (plan?.beams ?? []).filter(b => (b.purpose ?? 'TREATMENT') !== 'SETUP').map(b => ({
    ...b,
    useInOpt: b.useInOpt === undefined ? true : !!b.useInOpt,
    xSmooth: b.xSmooth ?? 40,
    ySmooth: b.ySmooth ?? 30,
    fixedJaw: !!b.fixedJaw,
  }));

  const controlBar = (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, px: 1, py: 0.5,
          borderTop: '1px solid rgba(88,196,220,0.15)', flexShrink: 0 }}>
      {!running ? (
        <Button size="small" variant="contained" startIcon={<PlayArrow fontSize="small" />}
                disabled={enabledObjectives.length === 0 || enabledObjectives.every(o => !o.doseCgy)}
                onClick={startRun} sx={{ fontSize: '0.65rem' }}>
          Start
        </Button>
      ) : (
        <Button size="small" variant="outlined" startIcon={<StopIcon fontSize="small" />} onClick={stopRun}
                sx={{ fontSize: '0.65rem', color: 'text.secondary', borderColor: 'rgba(88,196,220,0.3)' }}>
          Stop
        </Button>
      )}
      {converged && (
        <Chip size="small" icon={<CheckCircleOutline sx={{ fontSize: 12, color: '#4fd1a5' }} />}
              label="Converged" sx={{ height: 16, fontSize: '0.55rem', fontFamily: 'mono' }} variant="outlined" />
      )}
      <Typography variant="caption" sx={{ fontSize: '0.6rem', fontFamily: 'mono', color: 'text.secondary' }}>
        {(running || iteration > 0) ? `Iteration ${iteration}/${maxIter} · ${elapsed}s` : 'Ready'}
      </Typography>
      {(running || (runStatus && !runStatus.done && runStatus.phase)) && (
        <LinearProgress variant="determinate"
          value={Math.min(100, (iteration / maxIter) * 100)} sx={{ flex: 1, height: 4 }} />
      )}
      <Box sx={{ flex: running ? 0 : 1 }} />
      <Button size="small" variant="contained" startIcon={<Save fontSize="small" />}
              disabled={!dirty || running} onClick={save} sx={{ fontSize: '0.65rem' }}>
        OK
      </Button>
      <Button size="small" variant="outlined" startIcon={<Undo fontSize="small" />}
              disabled={!dirty || running} onClick={revert}
              sx={{ fontSize: '0.65rem', color: 'text.secondary', borderColor: 'rgba(88,196,220,0.3)' }}>
        Cancel
      </Button>
    </Box>
  );

  return (
    <Dialog open={open} fullWidth maxWidth={false}
            PaperProps={{ sx: { width: '96vw', maxWidth: '96vw', height: '92vh' } }}
            onClose={(e, reason) => { if (!running || reason === 'escapeKeyDown') onClose?.(); }}>
      <DialogTitle sx={{ fontSize: '0.85rem', fontFamily: 'mono', py: 0.75, display: 'flex', alignItems: 'center', gap: 1 }}>
        Optimization — {plan?.name ?? ''}
        <Chip size="small" label={plan?.optimizationAlgorithm ?? 'IMRT'} sx={{ height: 15, fontSize: '0.55rem', fontFamily: 'mono' }} variant="outlined" />
        <Chip size="small" label={`${beamRows.length} beams in optimization`} sx={{ height: 15, fontSize: '0.55rem', fontFamily: 'mono' }} variant="outlined" />
        {prescriptionCgy != null && (
          <Chip size="small" label={`Rx ${prescriptionCgy} cGy`} sx={{ height: 15, fontSize: '0.55rem', fontFamily: 'mono' }} variant="outlined" />
        )}
        {dirty && <Chip size="small" label="unsaved" sx={{ height: 15, fontSize: '0.55rem' }} color="warning" variant="outlined" />}
      </DialogTitle>
      <DialogContent sx={{ p: 1, display: 'grid', gridTemplateColumns: '1.15fr 1fr 0.95fr', gap: 1, minHeight: 0 }}>
        {/* ---- Structures & Objectives (§I/§J/§K) ---- */}
        <Pane title="STRUCTURES & OBJECTIVES — ID/Type · Dose [cGy] · Vol [%] · Priority · gEUD a">
          <Tooltip title="Eclipse-style suggestion from structure names">
            <Button size="small" variant="outlined" startIcon={<AutoFixHigh sx={{ fontSize: 12 }} />}
                    disabled={structuresList.length === 0} onClick={autoFromRx}
                    sx={{ fontSize: '0.6rem', color: 'text.secondary', borderColor: 'rgba(88,196,220,0.3)', alignSelf: 'flex-start' }}>
              Suggest objectives from structures
            </Button>
          </Tooltip>
          {grouped.length === 0 && (
            <Typography variant="caption" sx={{ fontSize: '0.6rem', color: 'text.disabled' }}>
              No objectives yet — Suggest from structures, or add per structure with +.
            </Typography>
          )}
          {grouped.map(g => {
            const color = colorOf.get(g.structureName);
            return (
              <Box key={g.structureName} sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  {color && <Box sx={{ width: 10, height: 10, borderRadius: '2px', bgcolor: color, flexShrink: 0 }} />}
                  <Typography variant="caption" sx={{ fontSize: '0.65rem', fontFamily: 'mono', flex: 1,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {g.structureName}
                  </Typography>
                  <Tooltip title={`Add Upper objective to ${g.structureName}`}>
                    <Button size="small" variant="outlined" aria-label={`add-upper-${g.structureName}`}
                            onClick={() => addObjective(g.structureName, 'upper')}
                            sx={{ minWidth: 0, px: 0.5, fontSize: '0.6rem',
                                  color: 'text.secondary', borderColor: 'rgba(88,196,220,0.3)' }}>+ Upper</Button>
                  </Tooltip>
                  <Tooltip title={`Add Lower objective to ${g.structureName}`}>
                    <Button size="small" variant="outlined" aria-label={`add-lower-${g.structureName}`}
                            onClick={() => addObjective(g.structureName, 'lower')}
                            sx={{ minWidth: 0, px: 0.5, fontSize: '0.6rem',
                                  color: 'text.secondary', borderColor: 'rgba(88,196,220,0.3)' }}>+ Lower</Button>
                  </Tooltip>
                  <Tooltip title={`Add Mean objective to ${g.structureName}`}>
                    <Button size="small" variant="outlined" aria-label={`add-mean-${g.structureName}`}
                            onClick={() => addObjective(g.structureName, 'mean')}
                            sx={{ minWidth: 0, px: 0.5, fontSize: '0.6rem',
                                  color: 'text.secondary', borderColor: 'rgba(88,196,220,0.3)' }}>+ Mean</Button>
                  </Tooltip>
                </Box>
                {g.rows.map(o => {
                  const isGeud = o.type.includes('geud');
                  const key = `${o.structureName}:${o.type}`;
                  return (
                    <Box key={key} sx={{ display: 'flex', alignItems: 'center', gap: 0.4, pl: 1.5,
                          opacity: o.enabled === false ? 0.45 : 1 }}>
                      <Select size="small" value={o.type}
                              onChange={e => updateObjective(o.structureName, o.type, { type: e.target.value })}
                              sx={{ width: 96, '& .MuiSelect-select': { fontSize: '0.62rem', py: 0.25 } }}
                              inputProps={{ 'aria-label': `objective-type-${key}` }}>
                        {OBJECTIVE_TYPES.map(t => <MenuItem key={t.id} value={t.id} sx={{ fontSize: '0.62rem' }}>{t.label}</MenuItem>)}
                      </Select>
                      <NumField type="number" width={64} value={o.doseCgy ?? ''}
                                onChange={e => updateObjective(o.structureName, o.type, { doseCgy: Number(e.target.value) })}
                                inputProps={{ 'aria-label': `objective-dose-${key}`, placeholder: 'cGy' }} />
                      <NumField type="number" width={56} value={o.volumePct ?? ''}
                                onChange={e => updateObjective(o.structureName, o.type, { volumePct: Number(e.target.value) })}
                                inputProps={{ 'aria-label': `objective-volume-${key}`, placeholder: 'Vol%', step: 0.1 }} />
                      <NumField type="number" width={52} value={o.priority ?? DEFAULT_PRIORITY}
                                onChange={e => updateObjective(o.structureName, o.type, { priority: Number(e.target.value) || 0 })}
                                inputProps={{ min: 0, max: 1000, 'aria-label': `objective-priority-${key}` }} />
                      {isGeud && (
                        <NumField type="number" width={48} value={o.paramA ?? 1}
                                  onChange={e => updateObjective(o.structureName, o.type, { paramA: Number(e.target.value) })}
                                  inputProps={{ 'aria-label': `objective-geud-a-${key}`, step: 0.1 }} />
                      )}
                      <IconButton size="small" sx={{ p: 0.2, flexShrink: 0 }} aria-label={`objective-delete-${key}`}
                                  onClick={() => removeObjective(o.structureName, o.type)}>
                        <Delete sx={{ fontSize: 13, color: 'text.secondary' }} />
                      </IconButton>
                    </Box>
                  );
                })}
              </Box>
            );
          })}

          <Box sx={{ borderTop: '1px solid rgba(88,196,220,0.15)', my: 0.25 }} />
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <MicroLabel width={86}>NTO (§K)</MicroLabel>
            <Select size="small" value={nto?.mode ?? 'off'}
                    onChange={e => {
                      const mode = e.target.value;
                      setNto(mode === 'off' ? null : { mode, distanceMm: 10, startDosePct: 100, endDosePct: 25, falloff: 0.05, priority: 200 });
                      touch();
                    }}
                    sx={{ flex: 1, '& .MuiSelect-select': { fontSize: '0.62rem', py: 0.25 } }}
                    inputProps={{ 'aria-label': 'nto-mode' }}>
              <MenuItem value="off" sx={{ fontSize: '0.62rem' }}>Off</MenuItem>
              <MenuItem value="manual" sx={{ fontSize: '0.62rem' }}>Manual NTO</MenuItem>
              <MenuItem value="auto" sx={{ fontSize: '0.62rem' }}>Automatic NTO</MenuItem>
            </Select>
          </Box>
          {nto?.mode === 'manual' && (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, pl: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4 }}>
                <MicroLabel width={96}>Distance border</MicroLabel>
                <NumField type="number" width={52} value={nto.distanceMm ?? 10}
                          onChange={e => { setNto({ ...nto, distanceMm: Number(e.target.value) || 0 }); touch(); }}
                          inputProps={{ min: 0, 'aria-label': 'nto-distance' }} />
                <MicroLabel>mm</MicroLabel>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4 }}>
                <MicroLabel width={60}>Start dose</MicroLabel>
                <NumField type="number" width={52} value={nto.startDosePct ?? 100}
                          onChange={e => { setNto({ ...nto, startDosePct: Number(e.target.value) || 0 }); touch(); }}
                          inputProps={{ 'aria-label': 'nto-start-dose' }} />
                <MicroLabel>%</MicroLabel>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4 }}>
                <MicroLabel width={60}>End dose</MicroLabel>
                <NumField type="number" width={52} value={nto.endDosePct ?? 25}
                          onChange={e => { setNto({ ...nto, endDosePct: Number(e.target.value) || 0 }); touch(); }}
                          inputProps={{ 'aria-label': 'nto-end-dose' }} />
                <MicroLabel>%</MicroLabel>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4 }}>
                <MicroLabel width={60}>Fall off</MicroLabel>
                <NumField type="number" width={52} value={nto.falloff ?? 0.05}
                          onChange={e => { setNto({ ...nto, falloff: Number(e.target.value) || 0 }); touch(); }}
                          inputProps={{ step: 0.01, 'aria-label': 'nto-falloff' }} />
              </Box>
            </Box>
          )}
          {nto?.mode === 'auto' && (
            <Typography variant="caption" sx={{ fontSize: '0.58rem', color: 'text.disabled', pl: 2 }}>
              Automatic NTO — only the priority is adjustable.
            </Typography>
          )}
        </Pane>

        {/* ---- DVO (§O): live DVH + objective readouts ---- */}
        <Pane title="DVO — OBJECTIVES · DVH · PROGRESS">
          <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
            {!running ? (
              <Button size="small" variant="contained" startIcon={<PlayArrow fontSize="small" />}
                      disabled={enabledObjectives.length === 0 || enabledObjectives.every(o => !o.doseCgy)}
                      onClick={startRun} sx={{ fontSize: '0.65rem' }}>
                Start optimization
              </Button>
            ) : (
              <Button size="small" variant="outlined" startIcon={<StopIcon fontSize="small" />} onClick={stopRun}
                      sx={{ fontSize: '0.65rem', color: 'text.secondary', borderColor: 'rgba(88,196,220,0.3)' }}>
                Stop
              </Button>
            )}
            {converged && (
              <Chip size="small" icon={<CheckCircleOutline sx={{ fontSize: 12, color: '#4fd1a5' }} />}
                    label="Converged" sx={{ height: 16, fontSize: '0.55rem', fontFamily: 'mono' }} variant="outlined" />
            )}
            <Typography variant="caption" sx={{ fontSize: '0.6rem', fontFamily: 'mono', color: 'text.secondary' }}>
              {(running || iteration > 0) ? `Iteration ${iteration}/${maxIter} · ${elapsed}s` : ''}
            </Typography>
          </Box>
          {(running || iteration > 0) && (
            <LinearProgress variant="determinate"
              value={Math.min(100, (iteration / maxIter) * 100)} sx={{ height: 4 }} />
          )}
          {runError && (
            <Typography variant="caption" color="error" sx={{ fontSize: '0.62rem' }}>{runError}</Typography>
          )}

          {runStatus?.readouts?.length > 0 && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
              <Typography variant="caption" sx={{ fontSize: '0.55rem', color: 'text.disabled', fontFamily: 'mono' }}>
                TOP OBJECTIVES — current vs target
              </Typography>
              {runStatus.readouts.map(ro => (
                <Box key={`${ro.structureName}:${ro.type}`} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  {ro.met
                    ? <CheckCircleOutline sx={{ fontSize: 12, color: '#4fd1a5' }} />
                    : <Box sx={{ width: 10, height: 10, bgcolor: '#e06c75', flexShrink: 0,
                                clipPath: 'polygon(50% 0, 100% 100%, 0 100%)' }} />}
                  <Typography variant="caption" sx={{ fontSize: '0.6rem', fontFamily: 'mono', flex: 1 }}>
                    {ro.structureName} · {ro.type}: {ro.achievedCgy} cGy / {ro.doseCgy} cGy
                  </Typography>
                </Box>
              ))}
            </Box>
          )}

          {dvhResults.length > 0 ? (
            <Box sx={{ border: '1px solid rgba(88,196,220,0.12)', borderRadius: 0.5, p: 0.5 }}>
              <DVHChart results={dvhResults} prescriptionCgy={prescriptionCgy} />
              <Typography variant="caption" sx={{ fontSize: '0.55rem', color: 'text.disabled' }}>
                DVH — reference dose grid
              </Typography>
            </Box>
          ) : (
            <Typography variant="caption" sx={{ fontSize: '0.58rem', color: 'text.disabled' }}>
              Tick structures in the left tree to display their DVH.
            </Typography>
          )}
        </Pane>

        {/* ---- Plan Information + Settings (§H/§N) ---- */}
        <Pane title="PLAN INFORMATION (§H) — MLC · FIELDS · SETTINGS (§N)">
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            <MicroLabel width={96}>Dose Prescription</MicroLabel>
            <Typography variant="caption" sx={{ fontSize: '0.62rem', fontFamily: 'mono' }}>
              {prescriptionCgy != null ? `${prescriptionCgy} cGy` : '—'}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            <MicroLabel width={96}>Treatment Unit</MicroLabel>
            <Typography variant="caption" sx={{ fontSize: '0.62rem', fontFamily: 'mono' }}>
              {plan?.machineName ?? '—'} · {plan?.energyMv ?? '—'} MV
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <MicroLabel width={96}>MLC</MicroLabel>
            <Select size="small" value={mlcModel}
                    onChange={e => { setMlcModel(e.target.value); touch(); }}
                    sx={{ flex: 1, '& .MuiSelect-select': { fontSize: '0.62rem', py: 0.25 } }}
                    inputProps={{ 'aria-label': 'mlc-model' }}>
              {MLC_MODELS.map(m => <MenuItem key={m} value={m} sx={{ fontSize: '0.65rem' }}>{m}</MenuItem>)}
            </Select>
          </Box>

          <Typography variant="caption" sx={{ fontSize: '0.55rem', color: 'text.disabled', fontFamily: 'mono' }}>
            FIELDS — Scale: IEC 61217 · Use in Optimization · X/Y Smooth · Fixed Jaws
          </Typography>
          {beamRows.map(b => (
            <Box key={b.id} sx={{ display: 'flex', alignItems: 'center', gap: 0.4 }}>
              <Typography variant="caption" sx={{ fontSize: '0.58rem', fontFamily: 'mono', width: 30, flexShrink: 0 }}>
                F{b.beamNumber}
              </Typography>
              <Typography variant="caption" sx={{ fontSize: '0.55rem', fontFamily: 'mono', color: 'text.secondary', width: 32, flexShrink: 0 }}>
                {b.gantryAngle}°
              </Typography>
              <Tooltip title="Use in Optimization">
                <Checkbox checked={b.useInOpt} size="small" sx={{ p: 0.25 }}
                          onChange={e => onSaveBeam?.(b.id, { use_in_opt: e.target.checked })}
                          inputProps={{ 'aria-label': `beam-use-in-opt-${b.beamNumber}` }} />
              </Tooltip>
              <MicroLabel width={10}>X</MicroLabel>
              <NumField type="number" width={40} value={b.xSmooth}
                        onChange={e => onSaveBeam?.(b.id, { x_smooth: Number(e.target.value) || 0 })}
                        inputProps={{ min: 0, max: 500, 'aria-label': `beam-x-smooth-${b.beamNumber}` }} />
              <MicroLabel width={10}>Y</MicroLabel>
              <NumField type="number" width={40} value={b.ySmooth}
                        onChange={e => onSaveBeam?.(b.id, { y_smooth: Number(e.target.value) || 0 })}
                        inputProps={{ min: 0, max: 500, 'aria-label': `beam-y-smooth-${b.beamNumber}` }} />
              <Tooltip title="Fixed Jaws">
                <Checkbox checked={b.fixedJaw} size="small" sx={{ p: 0.25 }}
                          onChange={e => onSaveBeam?.(b.id, { fixed_jaw: e.target.checked })}
                          inputProps={{ 'aria-label': `beam-fixed-jaw-${b.beamNumber}` }} />
              </Tooltip>
            </Box>
          ))}

          <Box sx={{ borderTop: '1px solid rgba(88,196,220,0.15)', my: 0.25 }} />
          <Typography variant="caption" sx={{ fontSize: '0.55rem', color: 'text.disabled', fontFamily: 'mono' }}>
            SETTINGS (§N)
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4 }}>
            <MicroLabel width={96}>Max iterations</MicroLabel>
            <NumField type="number" width={56} value={settings.maxIterations ?? 999}
                      onChange={e => { setSettings({ ...settings, maxIterations: Number(e.target.value) || 1 }); touch(); }}
                      inputProps={{ min: 1, 'aria-label': 'opt-max-iterations' }} />
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4 }}>
            <MicroLabel width={96}>Max time (min)</MicroLabel>
            <NumField type="number" width={56} value={settings.maxTimeMin ?? 30}
                      onChange={e => { setSettings({ ...settings, maxTimeMin: Number(e.target.value) || 1 }); touch(); }}
                      inputProps={{ min: 1, 'aria-label': 'opt-max-time' }} />
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4 }}>
            <MicroLabel width={96}>Resolution</MicroLabel>
            <Select size="small" value={String(settings.resolutionMm ?? 2.5)}
                    onChange={e => { setSettings({ ...settings, resolutionMm: Number(e.target.value) }); touch(); }}
                    sx={{ flex: 1, '& .MuiSelect-select': { fontSize: '0.62rem', py: 0.25 } }}
                    inputProps={{ 'aria-label': 'opt-resolution' }}>
              <MenuItem value="2.5" sx={{ fontSize: '0.62rem' }}>2.5 mm</MenuItem>
              <MenuItem value="1.25" sx={{ fontSize: '0.62rem' }}>1.25 mm (SRS)</MenuItem>
            </Select>
          </Box>
          <Typography variant="caption" sx={{ fontSize: '0.55rem', color: 'text.disabled' }}>
            After optimization: run Dose Calculation (Planning ▸ Dose Calculation, F5) to
            compute the final dose from the optimized MLC control points.
          </Typography>
        </Pane>
      </DialogContent>

      {/* ---- process control bar (§P) ---- */}
      {controlBar}
    </Dialog>
  );
}
