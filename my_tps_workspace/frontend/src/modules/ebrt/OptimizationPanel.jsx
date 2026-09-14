import { useEffect, useMemo, useRef, useState } from 'react';
import { Box, Typography, TextField, MenuItem, Button, Chip, LinearProgress,
         Checkbox, Tooltip, Select, IconButton } from '@mui/material';
import { PlayArrow, Pause, Add, Delete, Save, AutoFixHigh, Undo,
         CheckCircleOutline, ExpandMore, ChevronRight } from '@mui/icons-material';
import DVHChart from '../evaluation/DVHChart.jsx';

// ---- Eclipse Photon Optimization vocabulary (Eclipse 15.5 使用说明 §优化, p151-167) ----

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

/** Legacy DVO-style ids → Eclipse types. */
const LEGACY_TYPE_MAP = {
  TARGET_LOWER: 'lower', TARGET_UPPER: 'upper', MAX_DOSE: 'upper',
  MIN_DOSE: 'lower', MEAN_DOSE: 'mean',
};

/**
 * Normalize the persisted optimization state. Legacy plans store a flat
 * objective array with %-of-prescription doses and DVO-style type ids; the
 * Eclipse-aligned shape is { objectives: [...], nto: {...}|null } with
 * absolute cGy doses.
 */
function normalizeOptState(plan, prescriptionCgy) {
  const rx = prescriptionCgy ?? 0;
  const raw = plan?.optimizationObjectives;
  let objectives;
  if (Array.isArray(raw)) {
    objectives = raw.map(o => ({
      structureName: o.structureName,
      type: LEGACY_TYPE_MAP[o.type] ?? 'upper',
      doseCgy: o.doseCgy ?? (o.dosePct != null && rx ? Math.round((o.dosePct / 100) * rx) : null),
      volumePct: o.volumePct ?? null,
      priority: o.weight ?? DEFAULT_PRIORITY,
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

/** Heuristic Eclipse-style objective suggestion from structure names (cGy). */
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

function Section({ title, defaultOpen = false, right = null, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Box sx={{ borderBottom: '1px solid rgba(88,196,220,0.12)' }}>
      <Box onClick={() => setOpen(v => !v)} sx={{ px: 0.75, py: 0.4, display: 'flex', alignItems: 'center', gap: 0.5, cursor: 'pointer' }}>
        {open ? <ExpandMore sx={{ fontSize: 13, color: 'text.secondary' }} /> : <ChevronRight sx={{ fontSize: 13, color: 'text.secondary' }} />}
        <Typography variant="caption" sx={{ fontSize: '0.6rem', color: 'text.secondary', fontFamily: 'mono', flex: 1 }}>
          {title}
        </Typography>
        {right}
      </Box>
      {open && <Box sx={{ px: 0.75, pb: 0.75, display: 'flex', flexDirection: 'column', gap: 0.5 }}>{children}</Box>}
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

function NumField({ width = 46, inputProps: inProps, ...rest }) {
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
 * OptimizationPanel - Eclipse Photon Optimization window (Eclipse 15.5
 * 使用说明, 优化概览 p151-167), adapted to the planning panel:
 *
 *   PLAN INFORMATION          — Dose Prescription / Treatment Unit / MLC
 *                               model / Fields table with the per-beam
 *                               Use-in-Optimization toggle, X/Y Smooth
 *                               weights (defaults 40/30) and Fixed Jaws (§H)
 *   STRUCTURES & OBJECTIVES   — objectives grouped per structure with the
 *                               Eclipse columns (Dose [cGy] · Vol [%] ·
 *                               Priority 0-1000 · gEUD a) + NTO (§I/§J/§K)
 *   SETTINGS                  — max iterations / max time / 2.5 or 1.25mm
 *                               resolution (§N)
 *   RUN                       — start/pause/stop, iteration + elapsed time,
 *                               target dose DVO lines (§O/§P); the run is
 *                               still the clearly labelled prototype until
 *                               the M3 inverse optimizer lands.
 *
 * @param {Object} props
 * @param {Object} props.plan - hydrated selected plan
 * @param {Array} props.structures - [{roiNumber, roiName, color?}]
 * @param {Array} props.dvhResults - useDvh results for the live DVH
 * @param {number|null} props.prescriptionCgy
 * @param {Function} props.onSaveOptimization - async ({objectives, nto, settings, mlcModel}) => void
 * @param {Function} props.onSaveBeam - async (beamId, patch) => void
 * @param {Function} props.onLoadDose - ask the page to load the reference dose grid
 * @param {boolean} props.doseLoading
 */
export default function OptimizationPanel({
  plan, structures = [], dvhResults = [], prescriptionCgy = null,
  onSaveOptimization, onSaveBeam, onLoadDose, doseLoading = false,
}) {
  const derived = useMemo(
    () => normalizeOptState(plan, prescriptionCgy),
    // plan object identity changes on every hook refresh — recompute then
    [plan?.id, plan?.optimizationObjectives, plan?.optimizationSettings, prescriptionCgy], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const [objectives, setObjectives] = useState(derived.objectives);
  const [nto, setNto] = useState(derived.nto);
  const [settings, setSettings] = useState(derived.settings);
  const [mlcModel, setMlcModel] = useState(plan?.mlcModel ?? MLC_MODELS[0]);
  const [dirty, setDirty] = useState(false);
  const [saveNote, setSaveNote] = useState('');
  const [running, setRunning] = useState(false);
  const [iteration, setIteration] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [converged, setConverged] = useState(false);
  const [runStatus, setRunStatus] = useState(null);
  const [runError, setRunError] = useState('');
  const pollRef = useRef(null);

  useEffect(() => {
    setObjectives(derived.objectives);
    setNto(derived.nto);
    setSettings(derived.settings);
    setMlcModel(plan?.mlcModel ?? MLC_MODELS[0]);
    setDirty(false);
  }, [derived, plan?.mlcModel]);

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

  const optType = useMemo(() => {
    const beams = plan?.beams ?? [];
    if (beams.some(b => b.beamType === 'VMAT')) return 'VMAT';
    return /STATIC_3D/i.test(plan?.optimizationAlgorithm ?? '') ? '3DCRT' : 'IMRT';
  }, [plan?.beams, plan?.optimizationAlgorithm]);

  const maxIter = settings.maxIterations ?? 999;
  const enabledObjectives = objectives.filter(o => o.enabled !== false);

  const touch = () => setDirty(true);

  const addObjective = (structureName, type) => {
    const target = structureName ?? structuresList.find(n => /PTV/i.test(n)) ?? structuresList[0];
    if (!target) return;
    setObjectives(prev => [...prev, {
      structureName: target, type,
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
    setSaveNote('Saved');
    setTimeout(() => setSaveNote(''), 2000);
  };

  const revert = () => {
    setObjectives(derived.objectives);
    setNto(derived.nto);
    setSettings(derived.settings);
    setMlcModel(plan?.mlcModel ?? MLC_MODELS[0]);
    setDirty(false);
  };

  // real inverse optimization run (M3 MVP): start → poll → MLC written
  const startRun = async () => {
    if (running) return;
    setRunError('');
    try {
      await save(); // persist objectives + settings before optimizing
      const res = await fetch(`/api/ebrt/plans/${plan.id}/optimization/start`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          objectives: objectives.filter(o => o.enabled !== false),
          nto, settings,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || `Failed to start (${res.status})`);
      }
      setRunning(true);
      setConverged(false);
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
        } catch { /* transient poll failure */ }
      }, 600);
    } catch (e) {
      setRunError(e.message);
    }
  };

  const stopRun = async () => {
    await fetch(`/api/ebrt/plans/${plan.id}/optimization/stop`,
      { method: 'POST', credentials: 'include' }).catch(() => {});
  };

  const beamRows = (plan?.beams ?? []).map(b => ({
    ...b,
    useInOpt: b.useInOpt === undefined ? true : !!b.useInOpt,
    xSmooth: b.xSmooth ?? 40,
    ySmooth: b.ySmooth ?? 30,
    fixedJaw: !!b.fixedJaw,
  }));

  return (
    <Box sx={{ borderTop: '1px solid rgba(88,196,220,0.12)' }}>
      <Box sx={{ px: 0.75, py: 0.4, display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <Typography variant="caption" sx={{ fontSize: '0.6rem', color: 'text.secondary', fontFamily: 'mono' }}>
          OPTIMIZATION
        </Typography>
        <Box sx={{ flex: 1 }} />
        <Chip size="small" label={optType} sx={{ height: 14, fontSize: '0.52rem', fontFamily: 'mono' }} variant="outlined" />
        <Chip size="small" label={`${beamRows.length} beams`} sx={{ height: 14, fontSize: '0.52rem', fontFamily: 'mono' }} variant="outlined" />
      </Box>

      {/* ---- Plan Information (§H) ---- */}
      <Section title="PLAN INFORMATION">
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <MicroLabel width={86}>Dose Prescription</MicroLabel>
          <Typography variant="caption" sx={{ fontSize: '0.62rem', fontFamily: 'mono' }}>
            {prescriptionCgy != null ? `${prescriptionCgy} cGy` : '—'}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <MicroLabel width={86}>Treatment Unit</MicroLabel>
          <Typography variant="caption" sx={{ fontSize: '0.62rem', fontFamily: 'mono' }}>
            {plan?.machineName ?? '—'} · {plan?.energyMv ?? '—'} MV
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
          <MicroLabel width={86}>MLC</MicroLabel>
          <Select size="small" value={mlcModel}
                  onChange={e => { setMlcModel(e.target.value); touch(); }}
                  sx={{ flex: 1, '& .MuiSelect-select': { fontSize: '0.62rem', py: 0.25 } }}
                  inputProps={{ 'aria-label': 'mlc-model' }}>
            {MLC_MODELS.map(m => <MenuItem key={m} value={m} sx={{ fontSize: '0.65rem' }}>{m}</MenuItem>)}
          </Select>
        </Box>

        <Typography variant="caption" sx={{ fontSize: '0.55rem', color: 'text.disabled', fontFamily: 'mono' }}>
          FIELDS — Scale: IEC 61217
        </Typography>
        {beamRows.map(b => (
          <Box key={b.id} sx={{ display: 'flex', alignItems: 'center', gap: 0.4 }}>
            <Typography variant="caption" sx={{ fontSize: '0.58rem', fontFamily: 'mono', width: 26, flexShrink: 0 }}>
              F{b.beamNumber}
            </Typography>
            <Typography variant="caption" sx={{ fontSize: '0.55rem', fontFamily: 'mono', color: 'text.secondary', width: 28, flexShrink: 0 }}>
              {b.gantryAngle}°
            </Typography>
            <Tooltip title="Use in Optimization">
              <Checkbox checked={b.useInOpt} size="small" sx={{ p: 0.25 }}
                        onChange={e => onSaveBeam?.(b.id, { use_in_opt: e.target.checked })}
                        inputProps={{ 'aria-label': `beam-use-in-opt-${b.beamNumber}` }} />
            </Tooltip>
            <MicroLabel width={10}>X</MicroLabel>
            <NumField type="number" width={38} value={b.xSmooth}
                      onChange={e => onSaveBeam?.(b.id, { x_smooth: Number(e.target.value) || 0 })}
                      inputProps={{ min: 0, max: 500, 'aria-label': `beam-x-smooth-${b.beamNumber}` }} />
            <MicroLabel width={10}>Y</MicroLabel>
            <NumField type="number" width={38} value={b.ySmooth}
                      onChange={e => onSaveBeam?.(b.id, { y_smooth: Number(e.target.value) || 0 })}
                      inputProps={{ min: 0, max: 500, 'aria-label': `beam-y-smooth-${b.beamNumber}` }} />
            <Tooltip title="Fixed Jaws">
              <Checkbox checked={b.fixedJaw} size="small" sx={{ p: 0.25 }}
                        onChange={e => onSaveBeam?.(b.id, { fixed_jaw: e.target.checked })}
                        inputProps={{ 'aria-label': `beam-fixed-jaw-${b.beamNumber}` }} />
            </Tooltip>
          </Box>
        ))}
      </Section>

      {/* ---- Structures & Objectives (§I/§J) ---- */}
      <Section title="STRUCTURES & OBJECTIVES" defaultOpen
               right={<Tooltip title="Eclipse-style suggestion from structure names">
                 <Button size="small" variant="outlined"
                   startIcon={<AutoFixHigh sx={{ fontSize: 12 }} />} disabled={structuresList.length === 0}
                   onClick={(e) => { e.stopPropagation(); autoFromRx(); }}
                   sx={{ fontSize: '0.55rem', py: 0, px: 0.5, minWidth: 0, color: 'text.secondary', borderColor: 'rgba(88,196,220,0.3)' }}>
                   Auto
                 </Button>
               </Tooltip>}>
        {grouped.length === 0 && (
          <Typography variant="caption" sx={{ fontSize: '0.58rem', color: 'text.disabled' }}>
            No objectives — add per structure with +, or press Auto.
          </Typography>
        )}
        {grouped.map(g => {
          const color = colorOf.get(g.structureName);
          return (
            <Box key={g.structureName} sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                {color && <Box sx={{ width: 10, height: 10, borderRadius: '2px', bgcolor: color, flexShrink: 0 }} />}
                <Typography variant="caption" sx={{ fontSize: '0.62rem', fontFamily: 'mono',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                  {g.structureName}
                </Typography>
                <Tooltip title={`Add Upper objective to ${g.structureName}`}>
                  <Button size="small" variant="outlined"
                          onClick={(e) => { e.stopPropagation(); addObjective(g.structureName, 'upper'); }}
                          aria-label={`add-upper-${g.structureName}`}
                          sx={{ minWidth: 0, px: 0.4, fontSize: '0.55rem', ml: 'auto',
                                color: 'text.secondary', borderColor: 'rgba(88,196,220,0.3)' }}>+</Button>
                </Tooltip>
              </Box>
              {g.rows.map(o => {
                const isGeud = o.type.includes('geud');
                const key = `${o.structureName}:${o.type}`;
                return (
                  <Box key={key} sx={{ display: 'flex', alignItems: 'center', gap: 0.3, pl: 1.5,
                        opacity: o.enabled === false ? 0.45 : 1 }}>
                    <Select size="small" value={o.type}
                            onChange={e => updateObjective(o.structureName, o.type, { type: e.target.value })}
                            sx={{ flex: 1, minWidth: 0, '& .MuiSelect-select': { fontSize: '0.6rem', py: 0.25 } }}
                            inputProps={{ 'aria-label': `objective-type-${key}` }}>
                      {OBJECTIVE_TYPES.map(t => <MenuItem key={t.id} value={t.id} sx={{ fontSize: '0.62rem' }}>{t.label}</MenuItem>)}
                    </Select>
                    <NumField type="number" width={46} value={o.doseCgy ?? ''}
                              onChange={e => updateObjective(o.structureName, o.type, { doseCgy: Number(e.target.value) })}
                              inputProps={{ 'aria-label': `objective-dose-${key}`, placeholder: 'cGy' }} />
                    <NumField type="number" width={40} value={o.volumePct ?? ''}
                              onChange={e => updateObjective(o.structureName, o.type, { volumePct: Number(e.target.value) })}
                              inputProps={{ 'aria-label': `objective-volume-${key}`, placeholder: 'Vol%', step: 0.1 }} />
                    <NumField type="number" width={40} value={o.priority ?? DEFAULT_PRIORITY}
                              onChange={e => updateObjective(o.structureName, o.type, { priority: Number(e.target.value) || 0 })}
                              inputProps={{ min: 0, max: 1000, 'aria-label': `objective-priority-${key}` }} />
                    {isGeud && (
                      <NumField type="number" width={40} value={o.paramA ?? 1}
                                onChange={e => updateObjective(o.structureName, o.type, { paramA: Number(e.target.value) })}
                                inputProps={{ 'aria-label': `objective-geud-a-${key}`, step: 0.1 }} />
                    )}
                    <IconButton size="small" sx={{ p: 0.2, flexShrink: 0 }} aria-label={`objective-delete-${key}`}
                                onClick={() => removeObjective(o.structureName, o.type)}>
                      <Delete sx={{ fontSize: 12, color: 'text.secondary' }} />
                    </IconButton>
                  </Box>
                );
              })}
            </Box>
          );
        })}

        <Box sx={{ borderTop: '1px solid rgba(88,196,220,0.12)', my: 0.25 }} />

        {/* NTO (§K) */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <MicroLabel width={86}>NTO</MicroLabel>
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
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.3, pl: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4 }}>
              <MicroLabel width={110}>Distance border</MicroLabel>
              <NumField type="number" width={48} value={nto.distanceMm ?? 10}
                        onChange={e => { setNto({ ...nto, distanceMm: Number(e.target.value) || 0 }); touch(); }}
                        inputProps={{ min: 0, 'aria-label': 'nto-distance' }} />
              <MicroLabel>mm</MicroLabel>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4 }}>
              <MicroLabel width={110}>Start dose</MicroLabel>
              <NumField type="number" width={48} value={nto.startDosePct ?? 100}
                        onChange={e => { setNto({ ...nto, startDosePct: Number(e.target.value) || 0 }); touch(); }}
                        inputProps={{ 'aria-label': 'nto-start-dose' }} />
              <MicroLabel>%</MicroLabel>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4 }}>
              <MicroLabel width={110}>End dose</MicroLabel>
              <NumField type="number" width={48} value={nto.endDosePct ?? 25}
                        onChange={e => { setNto({ ...nto, endDosePct: Number(e.target.value) || 0 }); touch(); }}
                        inputProps={{ 'aria-label': 'nto-end-dose' }} />
              <MicroLabel>%</MicroLabel>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4 }}>
              <MicroLabel width={110}>Fall off</MicroLabel>
              <NumField type="number" width={48} value={nto.falloff ?? 0.05}
                        onChange={e => { setNto({ ...nto, falloff: Number(e.target.value) || 0 }); touch(); }}
                        inputProps={{ step: 0.01, 'aria-label': 'nto-falloff' }} />
            </Box>
          </Box>
        )}
        {nto?.mode === 'auto' && (
          <Typography variant="caption" sx={{ fontSize: '0.55rem', color: 'text.disabled', pl: 2 }}>
            Automatic NTO — only the priority is adjustable.
          </Typography>
        )}
      </Section>

      {/* ---- Settings (§N) ---- */}
      <Section title="SETTINGS">
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4 }}>
          <MicroLabel width={86}>Max iterations</MicroLabel>
          <NumField type="number" width={52} value={settings.maxIterations ?? 999}
                    onChange={e => { setSettings({ ...settings, maxIterations: Number(e.target.value) || 1 }); touch(); }}
                    inputProps={{ min: 1, 'aria-label': 'opt-max-iterations' }} />
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4 }}>
          <MicroLabel width={86}>Max time (min)</MicroLabel>
          <NumField type="number" width={52} value={settings.maxTimeMin ?? 30}
                    onChange={e => { setSettings({ ...settings, maxTimeMin: Number(e.target.value) || 1 }); touch(); }}
                    inputProps={{ min: 1, 'aria-label': 'opt-max-time' }} />
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4 }}>
          <MicroLabel width={86}>Resolution</MicroLabel>
          <Select size="small" value={String(settings.resolutionMm ?? 2.5)}
                  onChange={e => { setSettings({ ...settings, resolutionMm: Number(e.target.value) }); touch(); }}
                  sx={{ flex: 1, '& .MuiSelect-select': { fontSize: '0.62rem', py: 0.25 } }}
                  inputProps={{ 'aria-label': 'opt-resolution' }}>
            <MenuItem value="2.5" sx={{ fontSize: '0.62rem' }}>2.5 mm</MenuItem>
            <MenuItem value="1.25" sx={{ fontSize: '0.62rem' }}>1.25 mm (SRS)</MenuItem>
          </Select>
        </Box>
      </Section>

      {/* ---- Run (§O/§P — M3 MVP inverse optimizer) ---- */}
      <Section title="RUN — INVERSE OPTIMIZATION" defaultOpen>
        <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
          {!running ? (
            <Button size="small" variant="contained" startIcon={<PlayArrow fontSize="small" />}
                    disabled={enabledObjectives.length === 0 || enabledObjectives.every(o => !o.doseCgy)}
                    onClick={startRun}
                    sx={{ fontSize: '0.6rem' }}>
              Start
            </Button>
          ) : (
            <Button size="small" variant="outlined" startIcon={<Pause fontSize="small" />} onClick={stopRun}
                    sx={{ fontSize: '0.6rem', color: 'text.secondary', borderColor: 'rgba(88,196,220,0.3)' }}>
              Stop
            </Button>
          )}
          {converged && (
            <Chip size="small" icon={<CheckCircleOutline sx={{ fontSize: 12, color: '#4fd1a5' }} />}
                  label="Converged" sx={{ height: 16, fontSize: '0.55rem', fontFamily: 'mono' }} variant="outlined" />
          )}
          <Typography variant="caption" sx={{ fontSize: '0.58rem', color: 'text.disabled', fontFamily: 'mono' }}>
            {(running || iteration > 0)
              ? `Iter ${iteration}/${maxIter} · ${elapsed}s`
              : '简化解析物理 · 完成后写入 MLC 控制点'}
          </Typography>
        </Box>
        {(running || (runStatus?.phase && runStatus.phase !== 'done')) && (
          <LinearProgress variant="determinate"
            value={Math.min(100, (iteration / maxIter) * 100)} sx={{ height: 4 }} />)}

        {runError && (
          <Typography variant="caption" color="error" sx={{ fontSize: '0.6rem' }}>{runError}</Typography>
        )}

        {runStatus?.readouts?.length > 0 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
            {runStatus.readouts.map(ro => (
              <Box key={`${ro.structureName}:${ro.type}`} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                {ro.met
                  ? <CheckCircleOutline sx={{ fontSize: 11, color: '#4fd1a5' }} />
                  : <Box sx={{ width: 9, height: 9, bgcolor: '#e06c75', flexShrink: 0,
                              clipPath: 'polygon(50% 0, 100% 100%, 0 100%)' }} />}
                <Typography variant="caption" sx={{ fontSize: '0.55rem', fontFamily: 'mono', color: 'text.secondary', flex: 1 }}>
                  {ro.structureName} · {ro.type}: {ro.achievedCgy} cGy / {ro.doseCgy} cGy
                </Typography>
              </Box>
            ))}
          </Box>
        )}
        {runStatus?.done && !runStatus?.error && (
          <Typography variant="caption" sx={{ fontSize: '0.58rem', color: '#4fd1a5' }}>
            优化完成：MLC 控制点已写入 — 请执行剂量计算。
          </Typography>
        )}
        {runStatus?.error && (
          <Typography variant="caption" color="error" sx={{ fontSize: '0.6rem' }}>{runStatus.error}</Typography>
        )}
        {dvhResults.length > 0 && (
          <Box sx={{ border: '1px solid rgba(88,196,220,0.12)', borderRadius: 0.5, p: 0.5 }}>
            <DVHChart results={dvhResults} prescriptionCgy={prescriptionCgy} />
            <Typography variant="caption" sx={{ fontSize: '0.55rem', color: 'text.disabled' }}>
              DVH 基于参考剂量网格
            </Typography>
          </Box>
        )}
      </Section>

      {/* ---- control bar (§P: OK = save, Revert = discard) ---- */}
      <Box sx={{ px: 0.75, py: 0.6, display: 'flex', gap: 0.5, alignItems: 'center',
                 borderTop: '1px solid rgba(88,196,220,0.12)' }}>
        <Button size="small" variant="contained" startIcon={<Save fontSize="small" />}
                disabled={!dirty} onClick={save} sx={{ fontSize: '0.62rem' }}>
          OK
        </Button>
        <Button size="small" variant="outlined" startIcon={<Undo fontSize="small" />}
                disabled={!dirty} onClick={revert}
                sx={{ fontSize: '0.62rem', color: 'text.secondary', borderColor: 'rgba(88,196,220,0.3)' }}>
          Revert
        </Button>
        {dirty && <Typography variant="caption" sx={{ fontSize: '0.58rem', color: 'text.disabled' }}>unsaved changes</Typography>}
        {saveNote && <Chip size="small" label={saveNote} sx={{ height: 18, fontSize: '0.55rem' }} />}
      </Box>
    </Box>
  );
}
