import { useEffect, useMemo, useRef, useState } from 'react';
import { Box, Typography, TextField, MenuItem, Button, Chip, LinearProgress,
         Checkbox, Tooltip } from '@mui/material';
import { PlayArrow, Add, Delete, Save, AutoFixHigh } from '@mui/icons-material';
import DVHChart from '../evaluation/DVHChart.jsx';

// Eclipse DVO objective vocabulary (Photon Optimization window)
const OBJECTIVE_TYPES = [
  { id: 'TARGET_LOWER', label: 'Lower Limit', needsVolume: true },
  { id: 'TARGET_UPPER', label: 'Upper Limit', needsVolume: false },
  { id: 'MAX_DOSE', label: 'Max Dose', needsVolume: true },
  { id: 'MIN_DOSE', label: 'Min Dose', needsVolume: false },
  { id: 'MEAN_DOSE', label: 'Mean Dose', needsVolume: false },
];

const DEFAULT_WEIGHT = 100;

/** Normalise stored objectives: weight/enabled defaults for legacy rows. */
const normalizeObjectives = (objs) =>
  (objs ?? []).map(o => ({
    volumePct: null,
    weight: DEFAULT_WEIGHT,
    enabled: true,
    ...o,
  }));

/** Heuristic Eclipse-style objective suggestion from structure names. */
function suggestObjectives(structuresList) {
  const gen = [];
  for (const name of structuresList) {
    if (/PTV/i.test(name)) {
      gen.push({ structureName: name, type: 'TARGET_LOWER', dosePct: 95, volumePct: 100, weight: 100, enabled: true });
      gen.push({ structureName: name, type: 'TARGET_UPPER', dosePct: 107, weight: 60, enabled: true });
    } else if (/CORD|BRAIN ?STEM|CHIASM|LENS|EYE/i.test(name)) {
      gen.push({ structureName: name, type: 'MAX_DOSE', dosePct: 60, volumePct: 0.1, weight: 50, enabled: true });
    } else if (/PAROTID/i.test(name)) {
      gen.push({ structureName: name, type: 'MEAN_DOSE', dosePct: 40, weight: 40, enabled: true });
    }
  }
  return gen;
}

/**
 * OptimizationPanel - Phase 4 workflow S4: Eclipse-style optimization
 * surface. Objectives (structure / type / dose% / volume% / weight /
 * enabled) are persisted on the plan; "Auto from Rx" suggests objectives
 * from the structure names like Eclipse's prescription-based generation.
 *
 * The optimization run itself is still the clearly-labelled prototype (no
 * inverse optimizer yet — P4-M3): it animates the iteration/DVO flow and
 * renders a live DVH from the loaded reference dose grid; the real dose is
 * produced afterwards by the dose calculation step.
 *
 * @param {Object} props
 * @param {Object} props.plan - selected plan (optimizationObjectives, beams, optimizationAlgorithm)
 * @param {Array} props.structures - [{roiNumber, roiName}] for objective picks
 * @param {Array} props.dvhResults - useDvh results for the live DVH
 * @param {number|null} props.prescriptionCgy
 * @param {Function} props.onSaveObjectives - async (objectives) => void
 * @param {Function} props.onLoadDose - ask the page to load the reference dose grid
 * @param {boolean} props.doseLoading
 */
export default function OptimizationPanel({
  plan, structures = [], dvhResults = [], prescriptionCgy = null,
  onSaveObjectives, onLoadDose, doseLoading = false,
}) {
  const [draft, setDraft] = useState([]);
  const [dirty, setDirty] = useState(false);
  const [saveNote, setSaveNote] = useState('');
  const [running, setRunning] = useState(false);
  const [iteration, setIteration] = useState(0);
  const [achieved, setAchieved] = useState({});
  const timerRef = useRef(null);
  const TOTAL_ITERATIONS = 30;

  useEffect(() => {
    setDraft(normalizeObjectives(plan?.optimizationObjectives));
    setDirty(false);
  }, [plan?.id, plan?.optimizationObjectives]);

  const structuresList = useMemo(
    () => structures.map(s => s.roiName ?? s.name).filter(Boolean),
    [structures],
  );

  const optType = useMemo(() => {
    const beams = plan?.beams ?? [];
    if (beams.some(b => b.beamType === 'VMAT')) return 'VMAT';
    const algo = plan?.optimizationAlgorithm ?? '';
    if (/STATIC_3D/i.test(algo)) return '3DCRT';
    return 'IMRT';
  }, [plan?.beams, plan?.optimizationAlgorithm]);

  const activeObjectives = draft.filter(o => o.enabled !== false);

  const addObjective = () => {
    setDraft(prev => [...prev, {
      structureName: structuresList[0] ?? 'PTV',
      type: 'TARGET_LOWER',
      dosePct: 95,
      volumePct: 100,
      weight: DEFAULT_WEIGHT,
      enabled: true,
    }]);
    setDirty(true);
  };

  /** Eclipse-style prescription-based objective generation (idempotent). */
  const autoFromRx = () => {
    const suggested = suggestObjectives(structuresList);
    setDraft(prev => {
      const seen = new Set(prev.map(o => `${o.structureName}:${o.type}`));
      return [...prev, ...suggested.filter(o => !seen.has(`${o.structureName}:${o.type}`))];
    });
    setDirty(true);
  };

  const updateObjective = (idx, patch) => {
    setDraft(prev => prev.map((o, i) => (i === idx ? { ...o, ...patch } : o)));
    setDirty(true);
  };

  const removeObjective = (idx) => {
    setDraft(prev => prev.filter((_, i) => i !== idx));
    setDirty(true);
  };

  const save = async () => {
    await onSaveObjectives?.(draft);
    setDirty(false);
    setSaveNote('目标值已保存');
    setTimeout(() => setSaveNote(''), 2500);
  };

  // prototype optimization loop: converging DVO readout, labelled as such
  const startRun = () => {
    if (running || activeObjectives.length === 0) return;
    setRunning(true);
    setIteration(0);
    setAchieved({});
    let i = 0;
    timerRef.current = setInterval(() => {
      i += 1;
      setIteration(i);
      const progress = 1 - Math.exp(-i / 7); // ease toward the objectives
      const next = {};
      for (const o of activeObjectives) {
        const target = (o.dosePct ?? 100) / 100;
        const gap = 0.35 * (1 - progress);
        const noise = running ? (Math.random() - 0.5) * 0.04 * (1 - progress) : 0;
        next[`${o.structureName}:${o.type}`] = Math.max(0, target * (1 - gap) + target * noise);
      }
      setAchieved(next);
      if (i >= TOTAL_ITERATIONS) {
        clearInterval(timerRef.current);
        setRunning(false);
      }
    }, 220);
  };

  const stopRun = () => {
    clearInterval(timerRef.current);
    setRunning(false);
  };

  return (
    <Box sx={{ px: 1, py: 0.75, display: 'flex', flexDirection: 'column', gap: 0.6,
               borderTop: '1px solid rgba(88,196,220,0.12)' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <Typography variant="caption" sx={{ fontSize: '0.6rem', color: 'text.secondary', fontFamily: 'mono' }}>
          OPTIMIZATION
        </Typography>
        <Box sx={{ flex: 1 }} />
        <Chip size="small" label={optType}
              sx={{ height: 14, fontSize: '0.52rem', fontFamily: 'mono' }} variant="outlined" />
        <Chip size="small"
              label={`${plan?.beams?.length ?? 0} beams`}
              sx={{ height: 14, fontSize: '0.52rem', fontFamily: 'mono' }} variant="outlined" />
      </Box>

      {/* objectives table */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4, px: 0.25 }}>
            <Typography variant="caption" sx={{ fontSize: '0.52rem', color: 'text.disabled', fontFamily: 'mono', width: 24, textAlign: 'center' }}>on</Typography>
            <Typography variant="caption" sx={{ fontSize: '0.52rem', color: 'text.disabled', fontFamily: 'mono', flex: 1 }}>Structure</Typography>
            <Typography variant="caption" sx={{ fontSize: '0.52rem', color: 'text.disabled', fontFamily: 'mono', width: 92 }}>Type</Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4, px: 0.25, pl: 3.75 }}>
            <Typography variant="caption" sx={{ fontSize: '0.52rem', color: 'text.disabled', fontFamily: 'mono', width: 50 }}>Dose%</Typography>
            <Typography variant="caption" sx={{ fontSize: '0.52rem', color: 'text.disabled', fontFamily: 'mono', width: 50 }}>Vol%</Typography>
            <Typography variant="caption" sx={{ fontSize: '0.52rem', color: 'text.disabled', fontFamily: 'mono', width: 46 }}>Weight</Typography>
          </Box>
        </Box>
      {draft.map((o, idx) => {
        const type = OBJECTIVE_TYPES.find(t => t.id === o.type) ?? OBJECTIVE_TYPES[0];
        const off = o.enabled === false;
        return (
          <Box key={idx} sx={{ display: 'flex', flexDirection: 'column', gap: 0.25,
                               opacity: off ? 0.45 : 1 }}>
            <Box sx={{ display: 'flex', gap: 0.4, alignItems: 'center' }}>
              <Checkbox checked={o.enabled !== false} size="small"
                        onChange={e => updateObjective(idx, { enabled: e.target.checked })}
                        sx={{ p: 0.25, width: 24, boxSizing: 'border-box' }}
                        inputProps={{ 'aria-label': `objective-enabled-${idx}` }} />
              <TextField size="small" select value={o.structureName}
                         onChange={e => updateObjective(idx, { structureName: e.target.value })}
                         sx={{ flex: 1, minWidth: 0 }}
                         inputProps={{ 'aria-label': `objective-structure-${idx}`, style: { fontSize: '0.6rem' } }}>
                {structuresList.map(name => <MenuItem key={name} value={name} sx={{ fontSize: '0.65rem' }}>{name}</MenuItem>)}
              </TextField>
              <TextField size="small" select value={o.type}
                         onChange={e => updateObjective(idx, { type: e.target.value })}
                         sx={{ width: 92, flexShrink: 0 }}
                         inputProps={{ 'aria-label': `objective-type-${idx}`, style: { fontSize: '0.6rem' } }}>
                {OBJECTIVE_TYPES.map(t => <MenuItem key={t.id} value={t.id} sx={{ fontSize: '0.65rem' }}>{t.label}</MenuItem>)}
              </TextField>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4, pl: 3.75 }}>
              <TextField size="small" type="number" value={o.dosePct ?? ''}
                         onChange={e => updateObjective(idx, { dosePct: Number(e.target.value) })}
                         sx={{ width: 50 }} inputProps={{ 'aria-label': `objective-dose-${idx}`, style: { fontSize: '0.6rem' } }} />
              <TextField size="small" type="number" value={type.needsVolume ? (o.volumePct ?? '') : ''}
                         disabled={!type.needsVolume}
                         onChange={e => updateObjective(idx, { volumePct: Number(e.target.value) })}
                         sx={{ width: 50 }} inputProps={{ 'aria-label': `objective-volume-${idx}`, style: { fontSize: '0.6rem' } }} />
              <TextField size="small" type="number" value={o.weight ?? DEFAULT_WEIGHT}
                         onChange={e => updateObjective(idx, { weight: Number(e.target.value) || 1 })}
                         sx={{ width: 46 }} inputProps={{ 'aria-label': `objective-weight-${idx}`, min: 1, max: 1000, style: { fontSize: '0.6rem' } }} />
              <Box sx={{ flex: 1 }} />
              <Button size="small" sx={{ minWidth: 0, px: 0.4, fontSize: '0.6rem', width: 24 }}
                      aria-label={`objective-delete-${idx}`}
                      onClick={() => removeObjective(idx)}>
                <Delete fontSize="small" sx={{ fontSize: 13 }} />
              </Button>
            </Box>
          </Box>
        );
      })}
      </Box>

      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
        <Button size="small" variant="outlined" startIcon={<Add fontSize="small" />}
                onClick={addObjective}
                sx={{ fontSize: '0.6rem', color: 'text.secondary', borderColor: 'rgba(88,196,220,0.3)' }}>
          Add
        </Button>
        <Tooltip title="Eclipse-style suggestion: PTV lower/upper limits, serial OAR max dose, parotid mean dose">
          <Button size="small" variant="outlined" startIcon={<AutoFixHigh fontSize="small" />}
                  disabled={structuresList.length === 0}
                  onClick={autoFromRx}
                  sx={{ fontSize: '0.6rem', color: 'text.secondary', borderColor: 'rgba(88,196,220,0.3)' }}>
            Auto from Rx
          </Button>
        </Tooltip>
        <Button size="small" variant="outlined" startIcon={<Save fontSize="small" />}
                disabled={!dirty}
                onClick={save}
                sx={{ fontSize: '0.6rem', color: 'text.secondary', borderColor: 'rgba(88,196,220,0.3)' }}>
          Save
        </Button>
        {saveNote && <Chip size="small" label={saveNote} sx={{ height: 18, fontSize: '0.55rem' }} />}
      </Box>

      {/* optimization run (prototype) */}
      <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
        {!running ? (
          <Button size="small" variant="contained" startIcon={<PlayArrow fontSize="small" />}
                  disabled={activeObjectives.length === 0}
                  onClick={() => { onLoadDose?.(); startRun(); }}
                  sx={{ fontSize: '0.6rem' }}>
            开始优化（原型）
          </Button>
        ) : (
          <Button size="small" variant="outlined" onClick={stopRun}
                  sx={{ fontSize: '0.6rem', color: 'text.secondary', borderColor: 'rgba(88,196,220,0.3)' }}>
            停止
          </Button>
        )}
        <Typography variant="caption" sx={{ fontSize: '0.58rem', color: 'text.disabled', fontFamily: 'mono' }}>
          {running
            ? `迭代 ${iteration}/${TOTAL_ITERATIONS} · MU ≈ ${(iteration * 33).toFixed(0)}`
            : (iteration >= TOTAL_ITERATIONS ? '优化完成 → 下一步：剂量计算' : '原型模拟：未接入逆向优化器')}
        </Typography>
      </Box>
      {running && <LinearProgress variant="determinate" value={(iteration / TOTAL_ITERATIONS) * 100} sx={{ height: 4 }} />}

      {/* DVO readout during/after the run */}
      {(running || iteration >= TOTAL_ITERATIONS) && activeObjectives.length > 0 && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
          {activeObjectives.map((o, idx) => {
            const target = (o.dosePct ?? 100);
            const cur = achieved[`${o.structureName}:${o.type}`];
            const curPct = cur != null ? (cur * 100).toFixed(1) : '—';
            const typeLabel = OBJECTIVE_TYPES.find(t => t.id === o.type)?.label ?? o.type;
            return (
              <Typography key={idx} variant="caption" sx={{ fontSize: '0.58rem', fontFamily: 'mono', color: 'text.secondary' }}>
                {o.structureName} · {typeLabel}
                {o.weight != null && o.weight !== DEFAULT_WEIGHT ? ` (w${o.weight})` : ''}:
                目标 {target}% → 当前 {curPct}%
              </Typography>
            );
          })}
        </Box>
      )}

      {/* live DVH from the loaded reference dose */}
      {dvhResults.length > 0 && (
        <Box sx={{ border: '1px solid rgba(88,196,220,0.12)', borderRadius: 0.5, p: 0.5 }}>
          <DVHChart results={dvhResults} prescriptionCgy={prescriptionCgy} />
          <Typography variant="caption" sx={{ fontSize: '0.55rem', color: 'text.disabled' }}>
            DVH 基于参考剂量网格{running ? '（优化迭代实时刷新目标线）' : ''}
          </Typography>
        </Box>
      )}
      {dvhResults.length === 0 && (
        <Typography variant="caption" sx={{ fontSize: '0.58rem', color: 'text.disabled' }}>
          {doseLoading ? '参考剂量加载中…' : '开始优化将自动加载参考剂量并显示实时 DVH'}
        </Typography>
      )}
    </Box>
  );
}
