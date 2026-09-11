import { useEffect, useMemo, useRef, useState } from 'react';
import { Box, Typography, TextField, MenuItem, Button, Chip, LinearProgress } from '@mui/material';
import { PlayArrow, Add, Delete, Save } from '@mui/icons-material';
import DVHChart from '../evaluation/DVHChart.jsx';

const OBJECTIVE_TYPES = [
  { id: 'TARGET_UPPER', label: '靶区上限', needsVolume: false },
  { id: 'TARGET_LOWER', label: '靶区下限', needsVolume: true },
  { id: 'MAX_DOSE', label: '最大剂量', needsVolume: true },
  { id: 'MEAN_DOSE', label: '平均剂量', needsVolume: false },
];

/**
 * OptimizationPanel - Phase 4 workflow S4: IMRT/VMAT-style optimization
 * surface. Objectives are persisted on the plan; the optimization run is a
 * clearly-labelled prototype (no inverse optimizer yet) that animates the
 * iteration/DVO flow and renders a live DVH from the loaded reference dose
 * grid — the real dose is produced afterwards by the dose calculation step.
 *
 * @param {Object} props
 * @param {Object} props.plan - selected plan (optimizationObjectives)
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
    setDraft(plan?.optimizationObjectives ?? []);
    setDirty(false);
  }, [plan?.id, plan?.optimizationObjectives]);

  const structuresList = useMemo(
    () => structures.map(s => s.roiName ?? s.name).filter(Boolean),
    [structures],
  );

  const addObjective = () => {
    setDraft(prev => [...prev, {
      structureName: structuresList[0] ?? 'PTV',
      type: 'TARGET_LOWER',
      dosePct: 95,
      volumePct: 100,
    }]);
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
    if (running || draft.length === 0) return;
    setRunning(true);
    setIteration(0);
    setAchieved({});
    let i = 0;
    timerRef.current = setInterval(() => {
      i += 1;
      setIteration(i);
      const progress = 1 - Math.exp(-i / 7); // ease toward the objectives
      const next = {};
      for (const o of draft) {
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
      <Typography variant="caption" sx={{ fontSize: '0.6rem', color: 'text.secondary', fontFamily: 'mono' }}>
        OPTIMIZATION（优化目标值 + 过程）
      </Typography>

      {/* objectives table */}
      {draft.map((o, idx) => {
        const type = OBJECTIVE_TYPES.find(t => t.id === o.type) ?? OBJECTIVE_TYPES[0];
        const achievedKey = `${o.structureName}:${o.type}`;
        return (
          <Box key={idx} sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
            <TextField size="small" select value={o.structureName}
                       onChange={e => updateObjective(idx, { structureName: e.target.value })}
                       sx={{ flex: 1.2 }} inputProps={{ 'aria-label': `objective-structure-${idx}`, style: { fontSize: '0.6rem' } }}>
              {structuresList.map(name => <MenuItem key={name} value={name} sx={{ fontSize: '0.65rem' }}>{name}</MenuItem>)}
            </TextField>
            <TextField size="small" select value={o.type}
                       onChange={e => updateObjective(idx, { type: e.target.value })}
                       sx={{ flex: 1 }} inputProps={{ 'aria-label': `objective-type-${idx}`, style: { fontSize: '0.6rem' } }}>
              {OBJECTIVE_TYPES.map(t => <MenuItem key={t.id} value={t.id} sx={{ fontSize: '0.65rem' }}>{t.label}</MenuItem>)}
            </TextField>
            <TextField size="small" label="%" type="number" value={o.dosePct ?? ''}
                       onChange={e => updateObjective(idx, { dosePct: Number(e.target.value) })}
                       sx={{ width: 56 }} inputProps={{ 'aria-label': `objective-dose-${idx}`, style: { fontSize: '0.6rem' } }} />
            {type.needsVolume && (
              <TextField size="small" label="V%" type="number" value={o.volumePct ?? ''}
                         onChange={e => updateObjective(idx, { volumePct: Number(e.target.value) })}
                         sx={{ width: 56 }} inputProps={{ style: { fontSize: '0.6rem' } }} />
            )}
            <Button size="small" sx={{ minWidth: 0, px: 0.4, fontSize: '0.6rem' }}
                    onClick={() => removeObjective(idx)}>
              <Delete fontSize="small" sx={{ fontSize: 13 }} />
            </Button>
          </Box>
        );
      })}
      <Box sx={{ display: 'flex', gap: 0.5 }}>
        <Button size="small" variant="outlined" startIcon={<Add fontSize="small" />}
                onClick={addObjective}
                sx={{ fontSize: '0.6rem', color: 'text.secondary', borderColor: 'rgba(88,196,220,0.3)' }}>
          添加目标值
        </Button>
        <Button size="small" variant="outlined" startIcon={<Save fontSize="small" />}
                disabled={!dirty}
                onClick={save}
                sx={{ fontSize: '0.6rem', color: 'text.secondary', borderColor: 'rgba(88,196,220,0.3)' }}>
          保存
        </Button>
        {saveNote && <Chip size="small" label={saveNote} sx={{ height: 18, fontSize: '0.55rem' }} />}
      </Box>

      {/* optimization run (prototype) */}
      <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
        {!running ? (
          <Button size="small" variant="contained" startIcon={<PlayArrow fontSize="small" />}
                  disabled={draft.length === 0}
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
      {(running || iteration >= TOTAL_ITERATIONS) && draft.length > 0 && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
          {draft.map((o, idx) => {
            const target = (o.dosePct ?? 100);
            const cur = achieved[`${o.structureName}:${o.type}`];
            const curPct = cur != null ? (cur * 100).toFixed(1) : '—';
            return (
              <Typography key={idx} variant="caption" sx={{ fontSize: '0.58rem', fontFamily: 'mono', color: 'text.secondary' }}>
                {o.structureName} · {OBJECTIVE_TYPES.find(t => t.id === o.type)?.label}:
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
