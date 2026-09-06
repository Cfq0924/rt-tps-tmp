import { Box, Typography, Divider } from '@mui/material';

/**
 * DosePanel - RT Dose information
 *
 * The backend currently exposes dose grid metadata only (no pixel data), so
 * dose overlay rendering is not implemented yet. This panel shows what is
 * available instead of controls that do nothing.
 *
 * @param {Object} props
 * @param {Object|null} props.doseData - RT Dose metadata object from /api/rtdose/:fileId
 */
export default function DosePanel({ doseData }) {
  if (!doseData) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography variant="caption" color="text.secondary">
          No dose loaded
        </Typography>
      </Box>
    );
  }

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

      <Box sx={{ px: 2, py: 1, display: 'flex', flexDirection: 'column', gap: 0.75 }}>
        <Typography variant="caption" sx={{ fontFamily: 'mono', fontSize: '0.7rem' }}>
          Max: {doseData.maxDose?.toFixed(2) || '0'} {doseData.doseUnits || 'cGy'}
        </Typography>
        {doseData.doseType && (
          <Typography variant="caption" sx={{ fontFamily: 'mono', fontSize: '0.65rem', color: 'text.secondary' }}>
            Type: {doseData.doseType}
          </Typography>
        )}
        <Typography variant="caption" sx={{ fontFamily: 'mono', fontSize: '0.65rem', color: 'text.secondary' }}>
          Grid: {doseData.columns} × {doseData.rows} × {doseData.numberOfFrames} frames
        </Typography>

        <Divider sx={{ my: 0.5 }} />

        <Typography variant="caption" sx={{ fontSize: '0.65rem', color: 'text.secondary', fontStyle: 'italic' }}>
          Dose overlay rendering is not implemented yet — metadata only.
        </Typography>
      </Box>
    </Box>
  );
}
