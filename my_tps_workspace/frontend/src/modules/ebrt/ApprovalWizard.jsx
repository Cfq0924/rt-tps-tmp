import { useEffect, useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, Typography,
  Table, TableHead, TableRow, TableCell, TableBody, Alert, LinearProgress,
} from '@mui/material';
import { CheckCircleOutline, ErrorOutline, WarningAmber } from '@mui/icons-material';

/**
 * ApprovalWizard - Eclipse "Plan Approval" flow (manual §9, p320–323):
 *   1. Dose Summary — course/plan prescription rows + 3D dose statistics for
 *      the plan target structure, and the plan approval warnings/errors.
 *   2. Delta Couch Shifts — per-field couch Vrt/Lng/Lat calculated from the
 *      user origin, with "Use values calculated from user origin" / Clear.
 *   3. Confirm — advance the approval status (REVIEWED / APPROVED).
 *
 * @param {Object} props
 * @param {boolean} props.open
 * @param {Object} props.plan - selected plan (id, name, approvalStatus, courseId, courseName)
 * @param {Function} props.onNextStatus - ("REVIEWED"|"APPROVED") => Promise<void> run after confirm
 * @param {Function} props.onDeltaCouch - (shifts|null) => Promise<void> persist/clear delta couch
 * @param {Function} props.getApprovalDoseSummary - (planId) => Promise<summary>
 * @param {Function} props.getDeltaCouch - (planId) => Promise<{shifts, fields, persisted}>
 * @param {Function} props.getApprovalChecks - (planId) => Promise<{errors, warnings}>
 */
export default function ApprovalWizard({
  open, plan, onClose, onNextStatus, onDeltaCouch,
  getApprovalDoseSummary, getDeltaCouch, getApprovalChecks,
}) {
  const [step, setStep] = useState(0);
  const [summary, setSummary] = useState(null);
  const [checks, setChecks] = useState(null);
  const [couch, setCouch] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open || !plan) return;
    setStep(0);
    setSummary(null);
    setChecks(null);
    setCouch(null);
    setError('');
    getApprovalDoseSummary(plan.id).then(setSummary).catch(e => setError(e.message));
    getApprovalChecks(plan.id).then(setChecks).catch(() => {});
    getDeltaCouch(plan.id).then(setCouch).catch(() => {});
  }, [open, plan?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!plan) return null;
  const nextStatus = plan.approvalStatus === 'UNAPPROVED' ? 'REVIEWED' : 'APPROVED';
  const errors = checks?.errors ?? [];
  const warnings = checks?.warnings ?? [];
  const stat = summary?.statistics;

  const persistShifts = async (shifts) => {
    setBusy(true);
    setError('');
    try {
      await onDeltaCouch(shifts);
      setCouch(prev => ({ ...prev, persisted: shifts }));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const confirm = async () => {
    setBusy(true);
    setError('');
    try {
      await onNextStatus(nextStatus);
      onClose?.();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const statCell = (v, key) => v ? (
    <>
      {v.cgy}
      {v.pct != null && <Box component="span" sx={{ color: 'text.disabled' }}> ({v.pct}%)</Box>}
    </>
  ) : '—';

  return (
    <Dialog open={open} onClose={() => { if (!busy) onClose?.(); }} fullWidth maxWidth="sm">
      <DialogTitle sx={{ fontSize: '0.85rem', fontFamily: 'mono', py: 1 }}>
        Planning Approval — {['Dose Summary', 'Delta Couch Shifts', 'Confirm'][step]}
        <Typography variant="caption" sx={{ display: 'block', color: 'text.disabled', fontSize: '0.6rem' }}>
          Course / Plan: {summary?.course ? `${summary.course.name} / ` : ''}{plan.name}
        </Typography>
      </DialogTitle>
      <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
        {busy && <LinearProgress sx={{ mb: 0.5 }} />}
        {error && <Alert severity="error" sx={{ py: 0.25, fontSize: '0.7rem' }}>{error}</Alert>}

        {step === 0 && (
          <>
            {!summary && !error && <Typography variant="caption" sx={{ color: 'text.disabled' }}>Loading dose summary…</Typography>}
            {summary && (
              <>
                <Box>
                  <Typography variant="caption" sx={{ fontSize: '0.6rem', color: 'text.secondary', fontFamily: 'mono', display: 'block', mb: 0.5 }}>
                    DOSE
                  </Typography>
                  <Table size="small" sx={{ '& .MuiTableCell-root': { fontSize: '0.62rem', px: 0.75, py: 0.25, fontFamily: 'mono', borderColor: 'rgba(88,196,220,0.08)' } }}>
                    <TableHead>
                      <TableRow>
                        <TableCell>Type</TableCell>
                        <TableCell>ID</TableCell>
                        <TableCell align="right">Dose/Fx [cGy]</TableCell>
                        <TableCell align="right">Fx</TableCell>
                        <TableCell align="right">Total [cGy]</TableCell>
                        <TableCell>Target Volume</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      <TableRow>
                        <TableCell>Plan</TableCell>
                        <TableCell>{summary.planName}</TableCell>
                        <TableCell rowSpan={2} align="right">{summary.dosePerFractionCgy ?? '—'}</TableCell>
                        <TableCell rowSpan={2} align="right">{summary.numberOfFractions ?? '—'}</TableCell>
                        <TableCell rowSpan={2} align="right">{summary.totalDoseCgy ?? '—'}</TableCell>
                        <TableCell rowSpan={2}>{summary.targetVolume ?? '—'}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell>Primary Reference Point</TableCell>
                        <TableCell>{summary.primaryReferencePoint ?? '—'}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>
                </Box>

                <Box>
                  <Typography variant="caption" sx={{ fontSize: '0.6rem', color: 'text.secondary', fontFamily: 'mono', display: 'block', mb: 0.5 }}>
                    3D DOSE STATISTICS {stat ? `FOR ${stat.structureId.toUpperCase()}` : ''}
                  </Typography>
                  {stat ? (
                    <Table size="small" sx={{ '& .MuiTableCell-root': { fontSize: '0.62rem', px: 0.75, py: 0.25, fontFamily: 'mono', borderColor: 'rgba(88,196,220,0.08)' } }}>
                      <TableHead>
                        <TableRow>
                          <TableCell>Structure ID</TableCell>
                          <TableCell align="right">Min [cGy]</TableCell>
                          <TableCell align="right">Mean [cGy]</TableCell>
                          <TableCell align="right">Max [cGy]</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        <TableRow>
                          <TableCell>{stat.structureId}</TableCell>
                          <TableCell align="right">{statCell(stat.min)}</TableCell>
                          <TableCell align="right">{statCell(stat.mean)}</TableCell>
                          <TableCell align="right">{statCell(stat.max)}</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell>3D Dose Max</TableCell>
                          <TableCell align="right">—</TableCell>
                          <TableCell align="right">—</TableCell>
                          <TableCell align="right">{statCell(stat.doseMax)}</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  ) : (
                    <Typography variant="caption" sx={{ fontSize: '0.6rem', color: 'text.disabled' }}>
                      No calculated dose / target structure — statistics unavailable.
                    </Typography>
                  )}
                </Box>

                {errors.length > 0 && (
                  <Alert severity="error" icon={<ErrorOutline fontSize="small" />} sx={{ py: 0.25, fontSize: '0.65rem' }}>
                    {errors.map((e, i) => <Box key={i}>• {e}</Box>)}
                  </Alert>
                )}
                {warnings.length > 0 && (
                  <Alert severity="warning" icon={<WarningAmber fontSize="small" />} sx={{ py: 0.25, fontSize: '0.65rem' }}>
                    {warnings.map((w, i) => <Box key={i}>• {w}</Box>)}
                  </Alert>
                )}
                {errors.length === 0 && warnings.length === 0 && (
                  <Alert severity="success" icon={<CheckCircleOutline fontSize="small" />} sx={{ py: 0.25, fontSize: '0.65rem' }}>
                    All plan approval checks pass.
                  </Alert>
                )}
              </>
            )}
          </>
        )}

        {step === 1 && (
          <>
            {couch ? (
              <>
                <Typography variant="caption" sx={{ fontSize: '0.6rem', color: 'text.disabled' }}>
                  Delta couch shift from the reference setup position — values calculated
                  from the user origin (DICOM 0, 0, 0).
                </Typography>
                <Table size="small" sx={{ '& .MuiTableCell-root': { fontSize: '0.62rem', px: 0.75, py: 0.25, fontFamily: 'mono', borderColor: 'rgba(88,196,220,0.08)' } }}>
                  <TableHead>
                    <TableRow>
                      <TableCell>Field ID</TableCell>
                      <TableCell>Group</TableCell>
                      <TableCell align="right">Couch Vrt [cm]</TableCell>
                      <TableCell align="right">Couch Lng [cm]</TableCell>
                      <TableCell align="right">Couch Lat [cm]</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(couch.fields?.length ? couch.fields : [{ fieldId: '—' }]).map((f, i) => (
                      <TableRow key={f.fieldId}>
                        <TableCell>{f.fieldId}</TableCell>
                        <TableCell>{i === 0 ? 'I' : ''}</TableCell>
                        <TableCell align="right">{fmtShift(shiftToUse(couch), 'couchVrtCm')}</TableCell>
                        <TableCell align="right">{fmtShift(shiftToUse(couch), 'couchLngCm')}</TableCell>
                        <TableCell align="right">{fmtShift(shiftToUse(couch), 'couchLatCm')}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <Box sx={{ display: 'flex', gap: 0.5 }}>
                  <Button size="small" variant="outlined" fullWidth
                          onClick={() => persistShifts(couch.shifts)}
                          sx={{ fontSize: '0.6rem', color: 'text.secondary', borderColor: 'rgba(88,196,220,0.3)' }}>
                    Use values calculated from user origin
                  </Button>
                  <Button size="small" variant="outlined" fullWidth
                          onClick={() => persistShifts(null)}
                          sx={{ fontSize: '0.6rem', color: 'text.secondary', borderColor: 'rgba(88,196,220,0.3)' }}>
                    Clear
                  </Button>
                </Box>
                {couch.persisted && (
                  <Typography variant="caption" sx={{ fontSize: '0.58rem', color: 'text.disabled', fontFamily: 'mono' }}>
                    Persisted: Vrt {couch.persisted.couchVrtCm} · Lng {couch.persisted.couchLngCm} · Lat {couch.persisted.couchLatCm} cm
                  </Typography>
                )}
              </>
            ) : (
              <Typography variant="caption" sx={{ color: 'text.disabled' }}>Loading couch shifts…</Typography>
            )}
          </>
        )}

        {step === 2 && (
          <>
            <Alert severity={errors.length > 0 ? 'error' : 'success'}
                   icon={errors.length > 0 ? <ErrorOutline fontSize="small" /> : <CheckCircleOutline fontSize="small" />}
                   sx={{ py: 0.25, fontSize: '0.7rem' }}>
              {errors.length > 0
                ? `Approval blocked: ${errors.length} error(s) — resolve them before approving.`
                : `All checks passed. Confirm to mark this plan as ${nextStatus}.`}
            </Alert>
            <Typography variant="caption" sx={{ fontSize: '0.65rem', color: 'text.secondary' }}>
              {plan.approvalStatus === 'UNAPPROVED'
                ? 'Eclipse: Plan Approval → Reviewed. A Planning Approved (APPROVED) plan can be exported for treatment.'
                : 'Eclipse: Plan Approval → Planning Approved (F4). The plan snapshot is captured for revisions.'}
            </Typography>
            {errors.length > 0 && (
              <Box sx={{ fontSize: '0.65rem' }}>
                {errors.map((e, i) => <Box key={i}>• {e}</Box>)}
              </Box>
            )}
          </>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 2, py: 0.75 }}>
        <Button size="small" disabled={step === 0 || busy} onClick={() => setStep(s => s - 1)}
                sx={{ fontSize: '0.65rem' }}>&lt; Back</Button>
        {step < 2 ? (
          <Button size="small" variant="contained" disabled={busy || (step === 0 && !summary)}
                  onClick={() => setStep(s => s + 1)}
                  sx={{ fontSize: '0.65rem' }}>Next &gt;</Button>
        ) : (
          <Button size="small" variant="contained" startIcon={<CheckCircleOutline sx={{ fontSize: 14 }} />}
                  disabled={busy || errors.length > 0}
                  onClick={confirm}
                  sx={{ fontSize: '0.65rem' }}>
            Mark as {nextStatus}
          </Button>
        )}
        <Button size="small" disabled={busy} onClick={() => onClose?.()} sx={{ fontSize: '0.65rem' }}>Cancel</Button>
      </DialogActions>
    </Dialog>
  );
}

function shiftToUse(couch) {
  return couch.persisted ?? couch.shifts ?? {};
}

function fmtShift(shifts, key) {
  const v = shifts?.[key];
  return typeof v === 'number' ? (v > 0 ? `+${v.toFixed(1)}` : v.toFixed(1)) : '—';
}
