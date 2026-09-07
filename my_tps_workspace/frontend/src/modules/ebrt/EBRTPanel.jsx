import { Box, Typography, Table, TableBody, TableCell, TableHead, TableRow, Button, Chip } from '@mui/material';

/**
 * EBRTPanel - right panel of the EBRT module: plan summary and the beam
 * table. Selecting a beam highlights its geometry in the viewport overlay.
 *
 * @param {Object} props
 * @param {Object|null} props.plan - parsed RTPLAN (useRTPlan result)
 * @param {boolean} props.loading
 * @param {string} props.error
 * @param {number|null} props.selectedBeamNumber
 * @param {Function} props.onSelectBeam - (beamNumber) => void
 * @param {Function} props.onGoToIsocenter
 */
export default function EBRTPanel({
  plan,
  loading,
  error,
  selectedBeamNumber,
  onSelectBeam,
  onGoToIsocenter,
}) {
  if (loading) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography variant="caption" color="text.secondary">Loading plan…</Typography>
      </Box>
    );
  }
  if (error) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography variant="caption" color="error">{error}</Typography>
      </Box>
    );
  }
  if (!plan) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography variant="caption" color="text.secondary">
          No RTPLAN in this study
        </Typography>
      </Box>
    );
  }

  const { prescription, fractionation } = plan;
  const rx = prescription.targetPrescriptionDoseGy;
  const fx = fractionation.numberOfFractions;

  return (
    <Box sx={{ width: '100%', overflow: 'auto' }}>
      <Typography
        variant="caption"
        sx={{ px: 1, py: 0.5, display: 'flex', alignItems: 'center', gap: 0.5, color: 'text.secondary',
              fontFamily: 'mono', borderBottom: '1px solid rgba(88,196,220,0.12)' }}
      >
        EBRT PLAN
        <Chip
          label={plan.approvalStatus}
          size="small"
          sx={{ height: 14, fontSize: '0.55rem' }}
          color={plan.approvalStatus === 'APPROVED' ? 'success' : 'warning'}
          variant="outlined"
        />
      </Typography>

      {/* plan header */}
      <Box sx={{ px: 1.5, py: 1, display: 'flex', flexDirection: 'column', gap: 0.4,
                 borderBottom: '1px solid rgba(88,196,220,0.12)' }}>
        <Typography variant="caption" sx={{ fontSize: '0.8rem', fontWeight: 600 }}>
          {plan.rtPlanLabel}
        </Typography>
        <Typography variant="caption" sx={{ fontSize: '0.65rem', color: 'text.secondary', fontFamily: 'mono' }}>
          Rx: {rx.toFixed(2)} Gy / {fx} fx = {(rx / fx).toFixed(2)} Gy per fx
        </Typography>
        <Typography variant="caption" sx={{ fontSize: '0.65rem', color: 'text.secondary' }}>
          Target: {prescription.description || '—'} · {plan.beams[0]?.treatmentMachineName || '—'} · {plan.beams[0]?.nominalBeamEnergyMV} MV
        </Typography>
        <Button
          size="small"
          variant="outlined"
          onClick={onGoToIsocenter}
          sx={{ fontSize: '0.65rem', mt: 0.5, color: 'primary.main', borderColor: 'rgba(88,196,220,0.3)' }}
        >
          Go to Isocenter
        </Button>
      </Box>

      {/* beam table */}
      <Typography
        variant="caption"
        sx={{ px: 1, py: 0.5, display: 'block', color: 'text.secondary', fontFamily: 'mono',
              borderBottom: '1px solid rgba(88,196,220,0.12)' }}
      >
        BEAMS ({plan.beams.length}) — click to visualize
      </Typography>
      <Table size="small" sx={{ '& .MuiTableCell-root': { py: 0.3, px: 0.75, fontSize: '0.62rem', fontFamily: 'mono', borderColor: 'rgba(88,196,220,0.08)' } }}>
        <TableHead>
          <TableRow>
            <TableCell>Beam</TableCell>
            <TableCell align="right">Gantry°</TableCell>
            <TableCell align="right">MU</TableCell>
            <TableCell align="right">Dose/fx Gy</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {plan.beams.map(beam => {
            const i = plan.beams.indexOf(beam);
            const dose = fractionation.beamDosesGy[i];
            const mu = fractionation.beamMetersetsMU[i];
            const selected = beam.beamNumber === selectedBeamNumber;
            return (
              <TableRow
                key={beam.beamNumber}
                onClick={() => onSelectBeam(beam.beamNumber)}
                hover
                selected={selected}
                sx={{ cursor: 'pointer', '&.Mui-selected': { bgcolor: 'rgba(88,196,220,0.1)' } }}
              >
                <TableCell>{beam.beamName || `Beam ${beam.beamNumber}`}</TableCell>
                <TableCell align="right">{beam.gantryAngleDeg}</TableCell>
                <TableCell align="right">{mu ? mu.toFixed(0) : '—'}</TableCell>
                <TableCell align="right">{dose != null ? dose.toFixed(3) : '—'}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <Box sx={{ px: 1, pt: 1 }}>
        <Typography variant="caption" sx={{ fontSize: '0.6rem', color: 'text.disabled' }}>
          {plan.beams[0]?.beamType === 'DYNAMIC'
            ? 'DMLC IMRT fields — portal rectangle & central axis shown on the isocenter slice.'
            : 'Static fields — portal rectangle shown on the isocenter slice.'}
        </Typography>
      </Box>
    </Box>
  );
}
