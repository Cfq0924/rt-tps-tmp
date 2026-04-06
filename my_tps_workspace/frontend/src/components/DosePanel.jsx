import { Box, Typography, Slider, Switch, FormControlLabel, Divider } from '@mui/material';

/**
 * DosePanel - Controls for RT Dose overlay
 *
 * @param {Object} props
 * @param {Object|null} props.doseData - RT Dose data object
 * @param {boolean} props.visible - Dose visibility state
 * @param {number} props.opacity - Dose opacity (0-1)
 * @param {number} props.threshold - Dose threshold percentage (0-100)
 * @param {Function} props.onVisibleChange - Callback when visibility changes
 * @param {Function} props.onOpacityChange - Callback when opacity changes
 * @param {Function} props.onThresholdChange - Callback when threshold changes
 */
export default function DosePanel({
  doseData,
  visible,
  opacity,
  threshold,
  onVisibleChange,
  onOpacityChange,
  onThresholdChange,
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
            <Typography variant="caption" sx={{ fontFamily: 'mono', fontSize: '0.7rem' }}>
              Show Dose
            </Typography>
          }
          sx={{ mb: 1 }}
        />

        <Typography
          variant="caption"
          sx={{ display: 'block', color: 'text.secondary', fontFamily: 'mono', fontSize: '0.65rem', mb: 1 }}
        >
          Max: {doseData.maxDose?.toFixed(2) || '0'} {doseData.doseUnits || 'cGy'}
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
          Threshold: {threshold}%
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
            background: 'linear-gradient(to right, rgba(246,193,119,0.1), rgba(246,193,119,1))',
            border: '1px solid rgba(246,193,119,0.3)',
          }}
        />
        <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
          <Typography variant="caption" sx={{ fontFamily: 'mono', fontSize: '0.6rem', color: 'text.disabled' }}>
            0%
          </Typography>
          <Typography variant="caption" sx={{ fontFamily: 'mono', fontSize: '0.6rem', color: 'text.disabled' }}>
            100%
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}
