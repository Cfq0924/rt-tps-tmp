import { Box, Typography, Checkbox, Button, Tooltip } from '@mui/material';
import { Colorize, TrendingUp } from '@mui/icons-material';

/**
 * EvaluationPanel (sidebar, compact) - point dose controls and the
 * structure show/hide list. The large DVH chart and the full statistics
 * table live in EvaluationPane (main area) — both share the `dvh` state.
 *
 * @param {Object} props
 * @param {Object} props.dvh - useDvh() hook result
 * @param {boolean} props.doseReady - dose grid available
 * @param {Object|null} props.doseProbe - { point, doseCgy, pctRx } last sampled point
 * @param {boolean} props.probeEnabled - point dose click-capture active
 * @param {Function} props.onToggleProbe - toggle point dose click capture
 * @param {Function} props.onJumpToGlobalMax - jump to the global max dose point
 */
export default function EvaluationPanel({
  dvh,
  doseReady = false,
  doseProbe = null,
  probeEnabled = false,
  onToggleProbe,
  onJumpToGlobalMax,
}) {
  const { allSources, selected, toggle } = dvh;

  return (
    <Box sx={{ width: '100%', overflow: 'auto' }}>
      <Typography
        variant="caption"
        sx={{ px: 1, py: 0.5, display: 'flex', alignItems: 'center', gap: 0.5,
              color: 'text.secondary', fontFamily: 'mono',
              borderBottom: '1px solid rgba(88,196,220,0.12)' }}
      >
        PLAN EVALUATION
      </Typography>

      <Box sx={{ px: 1, py: 1, display: 'flex', flexDirection: 'column', gap: 0.75 }}>
        {/* point dose probe (Eclipse Ch6.7) + global max jump (Ch6.6) */}
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <Tooltip title="Toggle point dose: click the CT to sample dose at a point">
            <Button
              size="small"
              variant={probeEnabled ? 'contained' : 'outlined'}
              startIcon={<Colorize />}
              onClick={onToggleProbe}
              sx={{ fontSize: '0.6rem', flex: 1 }}
            >
              Point Dose
            </Button>
          </Tooltip>
          <Tooltip title="Jump to the slice with the global maximum dose">
            <Button
              size="small"
              variant="outlined"
              startIcon={<TrendingUp />}
              disabled={!doseReady}
              onClick={onJumpToGlobalMax}
              sx={{ fontSize: '0.6rem', flex: 1, color: 'text.secondary', borderColor: 'rgba(88,196,220,0.3)' }}
            >
              Global Max
            </Button>
          </Tooltip>
        </Box>
        <Typography variant="caption" sx={{ display: 'block', fontSize: '0.58rem', color: 'text.secondary', fontFamily: 'mono' }}>
          {doseProbe == null && 'Point dose off — enable and click the CT to sample.'}
          {doseProbe != null && doseProbe.doseCgy == null && 'Picked point is outside the dose grid.'}
          {doseProbe != null && doseProbe.doseCgy != null && (
            <>
              {doseProbe.doseCgy.toFixed(1)} cGy
              {doseProbe.pctRx != null ? ` · ${doseProbe.pctRx.toFixed(1)}% Rx` : ''}
            </>
          )}
        </Typography>
      </Box>

      <Box sx={{ px: 1, py: 1 }}>
        <Typography variant="caption" sx={{ display: 'block', fontSize: '0.62rem', color: 'text.secondary', fontFamily: 'mono', mb: 0.5 }}>
          STRUCTURES ({allSources.length})
        </Typography>
        {!doseReady && (
          <Typography variant="caption" sx={{ display: 'block', fontSize: '0.58rem', color: 'text.disabled', mb: 0.5 }}>
            Enable dose display (Dose tab → Show Dose) once to load the dose grid.
          </Typography>
        )}
        {allSources.length === 0 && (
          <Typography variant="caption" sx={{ fontSize: '0.58rem', color: 'text.disabled' }}>
            No structures found.
          </Typography>
        )}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
          {allSources.map(src => {
            const isSel = selected.includes(src.key);
            return (
              <Box
                key={src.key}
                onClick={() => toggle(src.key)}
                sx={{ display: 'flex', alignItems: 'center', gap: 0.5, px: 0.5, py: 0.2, cursor: 'pointer',
                      borderRadius: 0.5,
                      bgcolor: isSel ? 'rgba(88,196,220,0.08)' : 'transparent' }}
              >
                <Checkbox size="small" checked={isSel} sx={{ p: 0.2 }}
                          inputProps={{ 'aria-label': `dvh-${src.name}` }} />
                <Box sx={{ width: 8, height: 8, borderRadius: '2px', bgcolor: src.color, flexShrink: 0 }} />
                <Typography variant="caption" sx={{ fontSize: '0.62rem', flex: 1, noWrap: true }}>
                  {src.name}
                </Typography>
              </Box>
            );
          })}
        </Box>
        <Typography variant="caption" sx={{ display: 'block', fontSize: '0.55rem', color: 'text.disabled', mt: 1 }}>
          Tick structures to compute their DVH — the chart and statistics are
          in the main pane.
        </Typography>
      </Box>
    </Box>
  );
}
