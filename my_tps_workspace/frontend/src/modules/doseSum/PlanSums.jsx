import { useEffect, useState, useCallback } from 'react';
import { Box, Typography, TextField, Button, Checkbox, Divider, Tooltip } from '@mui/material';
import { MergeType } from '@mui/icons-material';

/**
 * PlanSums - dose file switching + plan sums (Eclipse Ch4.16).
 *
 * Lists the study's RTDOSE files (imports + derived sums) so the viewer can
 * switch which grid feeds the dose overlay / DVH / point dose, and creates
 * sums by voxel-wise addition of two or more dose files; differing
 * geometries are trilinearly resampled onto the first grid (Phase 4 M1).
 *
 * @param {Object} props
 * @param {number} props.studyId
 * @param {Array} props.doseFiles - RTDOSE file rows of the study
 * @param {number|null} props.activeDoseFileId - dose file driving the viewer
 * @param {Function} props.onSelectDoseFile - (fileId) => void
 */
export default function PlanSums({ studyId, doseFiles = [], activeDoseFileId, onSelectDoseFile }) {
  const [sums, setSums] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const fetchSums = useCallback(async () => {
    try {
      const res = await fetch(`/api/dose-sums/study/${studyId}`, { credentials: 'include' });
      if (!res.ok) return;
      const { doseSums } = await res.json();
      setSums(doseSums);
    } catch { /* list refresh is best-effort */ }
  }, [studyId]);

  useEffect(() => {
    fetchSums();
  }, [fetchSums]);

  const toggle = (id) => {
    setSelectedIds(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
  };

  const create = async () => {
    setBusy(true); setError('');
    try {
      const res = await fetch(`/api/dose-sums/study/${studyId}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ doseFileIds: selectedIds, name: name.trim() }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'Failed to create dose sum');
      }
      const { doseSum } = await res.json();
      setSums(prev => [doseSum, ...prev]);
      setSelectedIds([]);
      setName('');
      onSelectDoseFile?.(doseSum.outputFileId);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const labelFor = (fileId) => {
    const sum = sums.find(s => s.outputFileId === fileId);
    if (sum) return `${sum.name} (sum)`;
    const f = doseFiles.find(d => d.id === fileId);
    return f ? (f.file_name || `dose #${f.id}`) : `dose #${fileId}`;
  };

  return (
    <Box sx={{ px: 1.5, py: 1 }}>
      <Typography variant="caption" sx={{ fontSize: '0.62rem', color: 'text.secondary', fontFamily: 'mono' }}>
        DOSE FILES
      </Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25, mt: 0.5 }}>
        {doseFiles.map(f => (
          <Box
            key={f.id}
            onClick={() => onSelectDoseFile?.(f.id)}
            sx={{ display: 'flex', alignItems: 'center', gap: 0.5, px: 0.5, py: 0.25, cursor: 'pointer',
                  borderRadius: 0.5, border: '1px solid',
                  borderColor: f.id === activeDoseFileId ? 'rgba(88,196,220,0.6)' : 'transparent',
                  bgcolor: f.id === activeDoseFileId ? 'rgba(88,196,220,0.08)' : 'transparent' }}
          >
            <Typography variant="caption" sx={{ fontSize: '0.62rem', flex: 1, noWrap: true }}>
              {labelFor(f.id)}
            </Typography>
            {f.id === activeDoseFileId && (
              <Chip2 label="active" />
            )}
          </Box>
        ))}
      </Box>

      <Divider sx={{ my: 1 }} />

      <Typography variant="caption" sx={{ fontSize: '0.62rem', color: 'text.secondary', fontFamily: 'mono' }}>
        PLAN SUMS
      </Typography>
      <Typography variant="caption" sx={{ display: 'block', fontSize: '0.55rem', color: 'text.disabled', mt: 0.25 }}>
        Add two or more dose files into a derived MULTI_PLAN dose. Differing geometries are resampled onto the first grid.
      </Typography>

      {error && <Typography variant="caption" color="error" sx={{ fontSize: '0.6rem' }}>{error}</Typography>}

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25, mt: 0.5 }}>
        {doseFiles.map(f => (
          <Box key={f.id} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Checkbox
              checked={selectedIds.includes(f.id)}
              onChange={() => toggle(f.id)}
              size="small"
              sx={{ p: 0.25 }}
              inputProps={{ 'aria-label': `sum-select-${f.id}` }}
            />
            <Typography variant="caption" sx={{ fontSize: '0.6rem' }}>
              {labelFor(f.id)}
            </Typography>
          </Box>
        ))}
      </Box>

      <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5 }}>
        <TextField
          size="small" fullWidth label="Sum name" value={name}
          onChange={e => setName(e.target.value)}
          inputProps={{ 'aria-label': 'dose-sum-name', style: { fontSize: '0.65rem' } }}
        />
        <Tooltip title="Create the summed dose (voxel-wise addition)">
          <span>
            <Button
              size="small" variant="contained" startIcon={<MergeType fontSize="small" />}
              disabled={busy || selectedIds.length < 2 || !name.trim()}
              onClick={create}
              aria-label="dose-sum-create"
              sx={{ fontSize: '0.62rem' }}
            >
              Sum
            </Button>
          </span>
        </Tooltip>
      </Box>

      {sums.length > 0 && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25, mt: 0.75 }}>
          <Typography variant="caption" sx={{ fontSize: '0.55rem', color: 'text.disabled' }}>
            Saved sums
          </Typography>
          {sums.map(s => (
            <Box
              key={s.id}
              onClick={() => onSelectDoseFile?.(s.outputFileId)}
              sx={{ display: 'flex', alignItems: 'center', gap: 0.5, px: 0.5, py: 0.25, cursor: 'pointer',
                    borderRadius: 0.5,
                    bgcolor: s.outputFileId === activeDoseFileId ? 'rgba(88,196,220,0.08)' : 'transparent' }}
            >
              <Typography variant="caption" sx={{ fontSize: '0.6rem', flex: 1, noWrap: true }}>
                {s.name} · {s.inputFileIds.length} inputs
              </Typography>
              <Typography component="span" sx={{ fontSize: '0.5rem', fontFamily: 'mono', color: 'primary.main' }}>
                USE
              </Typography>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
}

function Chip2({ label }) {
  return (
    <Box sx={{ px: 0.5, borderRadius: 0.5, border: '1px solid rgba(88,196,220,0.5)',
               fontFamily: 'mono', fontSize: '0.5rem', color: 'primary.main' }}>
      {label}
    </Box>
  );
}

