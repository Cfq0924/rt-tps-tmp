import { Box, Typography, Slider, Switch, FormControlLabel, Divider, CircularProgress,
  Checkbox, TextField, IconButton, Button, Tooltip } from '@mui/material';
import { Add, Delete } from '@mui/icons-material';
import { useState } from 'react';
import { ISODOSE_PALETTE } from '../lib/doseTransform.js';

const MAX_ISODOSE_LEVELS = 12;

/**
 * One editable isodose level row. Keeps the % as a local string while typing
 * so clearing/re-typing works, committing valid values immediately.
 */
function IsodoseLevelRow({ level, onChange, onDelete, prescriptionCgy = null }) {
  const [draft, setDraft] = useState(String(level.pct));

  const commit = (raw) => {
    setDraft(raw);
    const n = Number(raw);
    if (Number.isFinite(n) && n > 0 && n <= 100) {
      onChange({ ...level, pct: n });
    }
  };

  const cycleColor = () => {
    const i = ISODOSE_PALETTE.indexOf(level.color);
    onChange({ ...level, color: ISODOSE_PALETTE[(i + 1) % ISODOSE_PALETTE.length] });
  };

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
      <Checkbox
        checked={level.visible}
        onChange={(e) => onChange({ ...level, visible: e.target.checked })}
        size="small"
        sx={{ p: 0.25 }}
        inputProps={{ 'aria-label': `isodose-visible-${level.pct}` }}
      />
      <Tooltip title="Click to change color">
        <Box
          onClick={cycleColor}
          sx={{
            width: 12,
            height: 12,
            borderRadius: '2px',
            bgcolor: level.color,
            cursor: 'pointer',
            flexShrink: 0,
            border: '1px solid rgba(255,255,255,0.25)',
          }}
        />
      </Tooltip>
      <TextField
        value={draft}
        onChange={(e) => commit(e.target.value)}
        size="small"
        inputProps={{
          inputMode: 'decimal',
          'aria-label': `isodose-value-${level.pct}`,
          style: { fontSize: '0.7rem', fontFamily: 'mono', padding: '1px 4px' },
        }}
        sx={{ width: 58, '& .MuiOutlinedInput-root': { fontSize: '0.7rem' } }}
      />
      <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.6rem', flex: 1 }}>
        %{prescriptionCgy ? ` · ${(level.pct / 100 * prescriptionCgy).toFixed(0)}cGy` : ''}
      </Typography>
      <IconButton
        size="small"
        sx={{ p: 0.25 }}
        onClick={onDelete}
        aria-label={`isodose-delete-${level.pct}`}
      >
        <Delete sx={{ fontSize: 13, color: 'text.secondary' }} />
      </IconButton>
    </Box>
  );
}

/**
 * DosePanel - RT Dose overlay controls and dose summary.
 *
 * @param {Object} props
 * @param {Object|null} props.doseData - dose metadata from /api/rtdose/:fileId (maxDose in cGy)
 * @param {boolean} props.visible - overlay visibility
 * @param {number} props.opacity - overlay opacity 0-1
 * @param {number} props.threshold - display threshold, percent of maxDose
 * @param {boolean} props.gridLoading - true while the dose grid is downloading
 * @param {Array<{id:number,pct:number,visible:boolean,color:string}>} props.isodoseLevels
 * @param {Function} props.onVisibleChange - (visible: boolean) => void
 * @param {Function} props.onOpacityChange - (opacity: number 0-1) => void
 * @param {Function} props.onThresholdChange - (threshold: number 0-100) => void
 * @param {Function} props.onLevelsChange - (nextLevels: Array) => void
 * @param {number|null} props.prescriptionCgy - prescription dose in cGy (from RTPLAN), if available
 */
export default function DosePanel({
  doseData,
  visible,
  opacity,
  threshold,
  gridLoading,
  isodoseLevels = [],
  prescriptionCgy = null,
  onVisibleChange,
  onOpacityChange,
  onThresholdChange,
  onLevelsChange,
}) {
  if (!doseData) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography variant="caption" color="text.secondary">
          No dose loaded
        </Typography>
      </Box>
    );
  }

  // maxDose comes from the backend already converted to cGy
  const unit = 'cGy';

  const handleOpacityChange = (_, value) => {
    onOpacityChange(value / 100);
  };

  const handleThresholdChange = (_, value) => {
    onThresholdChange(value);
  };

  return (
    <Box sx={{ width: '100%', overflow: 'auto' }}>
      <Typography
        variant="caption"
        sx={{
          px: 1,
          py: 0.5,
          display: 'block',
          color: 'text.secondary',
          fontFamily: 'mono',
          borderBottom: '1px solid rgba(88,196,220,0.12)',
        }}
      >
        DOSE
      </Typography>

      <Box sx={{ px: 2, py: 1 }}>
        <FormControlLabel
          control={
            <Switch
              checked={visible}
              onChange={(e) => onVisibleChange(e.target.checked)}
              size="small"
            />
          }
          label={
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Typography variant="caption" sx={{ fontFamily: 'mono', fontSize: '0.7rem' }}>
                Show Dose
              </Typography>
              {gridLoading && <CircularProgress size={10} sx={{ color: '#f6c177' }} />}
            </Box>
          }
          sx={{ mb: 1 }}
        />

        <Typography
          variant="caption"
          sx={{ display: 'block', color: 'text.secondary', fontFamily: 'mono', fontSize: '0.65rem', mb: 1 }}
        >
          Max: {doseData.maxDose?.toFixed(2) || '0'} {unit}
          {doseData.doseSummationType ? ` · ${doseData.doseSummationType}` : ''}
        </Typography>

        <Divider sx={{ my: 1 }} />

        <Typography
          variant="caption"
          sx={{ display: 'block', color: 'text.secondary', fontFamily: 'mono', fontSize: '0.65rem', mb: 1 }}
        >
          Opacity: {Math.round(opacity * 100)}%
        </Typography>
        <Slider
          value={opacity * 100}
          onChange={handleOpacityChange}
          disabled={!visible}
          size="small"
          min={0}
          max={100}
          sx={{
            color: '#f6c177',
            '&.Mui-disabled': {
              color: 'rgba(246, 193, 119, 0.3)',
            },
          }}
        />

        <Typography
          variant="caption"
          sx={{ display: 'block', color: 'text.secondary', fontFamily: 'mono', fontSize: '0.65rem', mb: 1, mt: 2 }}
        >
          Threshold: {threshold}% ({((threshold / 100) * (doseData.maxDose || 0)).toFixed(0)} {unit})
        </Typography>
        <Slider
          value={threshold}
          onChange={handleThresholdChange}
          disabled={!visible}
          size="small"
          min={0}
          max={100}
          sx={{
            color: '#f6c177',
            '&.Mui-disabled': {
              color: 'rgba(246, 193, 119, 0.3)',
            },
          }}
        />

        <Box
          sx={{
            mt: 2,
            height: 12,
            borderRadius: 1,
            background: 'linear-gradient(to right, rgba(122,80,20,0.3), rgba(214,156,62,0.7), rgba(246,193,119,1))',
            border: '1px solid rgba(246,193,119,0.3)',
          }}
        />
        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
          <Typography variant="caption" sx={{ fontFamily: 'mono', fontSize: '0.6rem', color: 'text.disabled' }}>
            {threshold}%
          </Typography>
          <Typography variant="caption" sx={{ fontFamily: 'mono', fontSize: '0.6rem', color: 'text.disabled' }}>
            MAX
          </Typography>
        </Box>

        <Divider sx={{ my: 1.5 }} />

        {/* Isodose lines editor */}
        <Typography
          variant="caption"
          sx={{ display: 'block', color: 'text.secondary', fontFamily: 'mono', fontSize: '0.65rem', mb: 0.5 }}
        >
          ISODOSE LINES ({isodoseLevels.length})
        </Typography>
        <Typography variant="caption" sx={{ display: 'block', fontSize: '0.6rem', color: 'text.disabled', mb: 0.5 }}>
          % of max dose{prescriptionCgy ? ` — Rx ${prescriptionCgy} cGy` : ''} — edits apply live
        </Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
          {[...isodoseLevels]
            .sort((a, b) => b.pct - a.pct)
            .map(level => (
              <IsodoseLevelRow
                key={level.id}
                level={level}
                onChange={(next) => onLevelsChange(isodoseLevels.map(l => (l.id === next.id ? next : l)))}
                onDelete={() => onLevelsChange(isodoseLevels.filter(l => l.id !== level.id))}
              />
            ))}
        </Box>
        <Button
          size="small"
          startIcon={<Add />}
          disabled={isodoseLevels.length >= MAX_ISODOSE_LEVELS}
          onClick={() => {
            const nextId = isodoseLevels.reduce((m, l) => Math.max(m, l.id), 0) + 1;
            const usedColors = new Set(isodoseLevels.map(l => l.color));
            const color = ISODOSE_PALETTE.find(c => !usedColors.has(c)) ?? ISODOSE_PALETTE[nextId % ISODOSE_PALETTE.length];
            onLevelsChange([...isodoseLevels, { id: nextId, pct: 40, visible: true, color }]);
          }}
          sx={{ mt: 0.5, fontSize: '0.65rem', color: 'text.secondary', borderColor: 'rgba(88,196,220,0.3)' }}
          fullWidth
          variant="outlined"
        >
          Add Level
        </Button>
      </Box>
    </Box>
  );
}
