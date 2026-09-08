import { Box, Typography, TextField, MenuItem, Button, Table, TableBody, TableCell,
  TableHead, TableRow, IconButton, Switch, Chip, Divider, Tooltip } from '@mui/material';
import { Add, Delete, CloudDownload, Settings, BookmarkAdded, Bookmark, GppGood } from '@mui/icons-material';
import { useState } from 'react';
import { MACHINES, DOSE_ALGORITHMS, OPTIMIZATION_ALGORITHMS, NORMALIZATIONS, getMachine } from '../../lib/machines.js';

const numOrNull = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && v !== '' ? n : null;
};

// Approval flow: UNAPPROVED → REVIEWED → APPROVED (per Eclipse plan approval)
const NEXT_APPROVAL = { UNAPPROVED: 'REVIEWED', REVIEWED: 'APPROVED' };

/**
 * EbrtWorkspace - right panel of the EBRT module: plan list/selection,
 * new-plan form (machine / prescription / algorithms), plan approval and
 * beam management with live viewport visualization.
 *
 * @param {Object} props
 * @param {number} props.studyId
 * @param {Object} props.ebrt - useEbrtPlans() hook result
 * @param {number|null} props.rtPlanFileId - imported RTPLAN file id (for import)
 */
export default function EbrtWorkspace({ studyId, ebrt, rtPlanFileId }) {
  const { plans, selectedPlan, selectedPlanId, setSelectedPlanId, selectPlan } = ebrt;
  const [showNewPlan, setShowNewPlan] = useState(plans.length === 0);
  const [formError, setFormError] = useState('');

  // new-plan form state
  const [name, setName] = useState('');
  const [machineId, setMachineId] = useState(MACHINES[0].id);
  const [energyMv, setEnergyMv] = useState(MACHINES[0].energies[0]);
  const [doseGy, setDoseGy] = useState('');
  const [fx, setFx] = useState('');
  const [normalization, setNormalization] = useState('ISOCENTER');
  const [optAlgorithm, setOptAlgorithm] = useState('DMLC_IMRT');
  const [doseAlgorithm, setDoseAlgorithm] = useState('PENCIL_BEAM');
  const [gridSize, setGridSize] = useState('2');
  const [heterogeneity, setHeterogeneity] = useState(false);

  // add-beam form state
  const [beamType, setBeamType] = useState('STATIC');
  const [gantry, setGantry] = useState('0');
  const [gantryStop, setGantryStop] = useState('180');
  const [collimator, setCollimator] = useState('0');
  const [couch, setCouch] = useState('0');
  const [jawX, setJawX] = useState('100');
  const [jawY, setJawY] = useState('100');
  const [wedgeAngle, setWedgeAngle] = useState('');
  const [bolus, setBolus] = useState('');
  const machine = getMachine(machineId);

  // reference-points editor state (loaded from the selected plan)
  const [refPoints, setRefPoints] = useState([]);
  const [refPointsDirty, setRefPointsDirty] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);

  // sync the editor when switching plans
  const [loadedRefPointsFor, setLoadedRefPointsFor] = useState(null);
  if (selectedPlan && loadedRefPointsFor !== selectedPlan.id) {
    setLoadedRefPointsFor(selectedPlan.id);
    setRefPoints(selectedPlan.referencePoints ?? []);
    setRefPointsDirty(false);
  }

  const handleCreatePlan = async () => {
    setFormError('');
    try {
      await ebrt.createPlan({
        name: name.trim(),
        machine_name: machineId,
        energy_mv: numOrNull(energyMv),
        prescription_dose_gy: numOrNull(doseGy),
        number_of_fractions: numOrNull(fx),
        normalization,
        optimization_algorithm: optAlgorithm,
        dose_algorithm: doseAlgorithm,
        grid_size_mm: numOrNull(gridSize) ?? 2,
        heterogeneity_correction: heterogeneity,
      });
      setName('');
      setDoseGy('');
      setFx('');
      setShowNewPlan(false);
    } catch (err) {
      setFormError(err.message);
    }
  };

  const handleImportRTPlan = async () => {
    setFormError('');
    if (!rtPlanFileId) {
      setFormError('No RTPLAN file in this study to import');
      return;
    }
    try {
      await ebrt.importFromRTPlan(rtPlanFileId);
    } catch (err) {
      setFormError(err.message);
    }
  };

  const handleAddBeam = async () => {
    if (!selectedPlanId) return;
    setFormError('');
    try {
      const half = (Number(jawX) || 0) / 2;
      const halfY = (Number(jawY) || 0) / 2;
      await ebrt.addBeam(selectedPlanId, {
        beam_type: beamType,
        energy_mv: selectedPlan?.energyMv ?? 6,
        gantry_angle: Number(gantry),
        gantry_angle_stop: beamType === 'VMAT' ? Number(gantryStop) : null,
        collimator_angle: Number(collimator),
        couch_angle: Number(couch),
        jaw_x1: -half, jaw_x2: half,
        jaw_y1: -halfY, jaw_y2: halfY,
        wedge_angle: numOrNull(wedgeAngle),
        bolus: bolus.trim() || null,
      });
      setWedgeAngle('');
      setBolus('');
    } catch (err) {
      setFormError(err.message);
    }
  };

  const handleApprovalAdvance = async () => {
    if (!selectedPlan) return;
    setFormError('');
    const next = NEXT_APPROVAL[selectedPlan.approvalStatus];
    if (!next) return;
    try {
      await ebrt.updatePlan(selectedPlan.id, { approval_status: next });
    } catch (err) {
      setFormError(err.message);
    }
  };

  const handleApprovalReset = async () => {
    if (!selectedPlan) return;
    setFormError('');
    try {
      await ebrt.updatePlan(selectedPlan.id, { approval_status: 'UNAPPROVED' });
    } catch (err) {
      setFormError(err.message);
    }
  };

  const updateRefPoint = (idx, patch) => {
    setRefPoints(prev => prev.map((pt, i) => (i === idx ? { ...pt, ...patch } : pt)));
    setRefPointsDirty(true);
  };

  const saveRefPoints = async () => {
    if (!selectedPlan) return;
    setFormError('');
    try {
      await ebrt.updatePlan(selectedPlan.id, { reference_points: refPoints });
      setRefPointsDirty(false);
    } catch (err) {
      setFormError(err.message);
    }
  };

  const handleSaveAsTemplate = async () => {
    if (!selectedPlan) return;
    setFormError('');
    try {
      await ebrt.saveAsTemplate(selectedPlan.id);
      setFormError(''); // saved
    } catch (err) {
      setFormError(err.message);
    }
  };

  const handleInstantiate = async (templateId) => {
    setFormError('');
    try {
      await ebrt.instantiateTemplate(templateId);
      setShowTemplates(false);
    } catch (err) {
      setFormError(err.message);
    }
  };

  const dosePerFx = Number(doseGy) > 0 && Number(fx) > 0
    ? (Number(doseGy) / Number(fx)).toFixed(2)
    : null;

  return (
    <Box sx={{ width: '100%', overflow: 'auto' }}>
      <Typography
        variant="caption"
        sx={{ px: 1, py: 0.5, display: 'flex', alignItems: 'center', gap: 0.5,
              color: 'text.secondary', fontFamily: 'mono',
              borderBottom: '1px solid rgba(88,196,220,0.12)' }}
      >
        EBRT PLANS ({plans.length})
        <Box sx={{ flex: 1 }} />
        <Chip
          label={selectedPlan?.approvalStatus ?? '—'}
          size="small"
          sx={{ height: 14, fontSize: '0.55rem' }}
          color={selectedPlan?.approvalStatus === 'APPROVED' ? 'success' : 'warning'}
          variant="outlined"
        />
      </Typography>

      {/* plan list */}
      <Box sx={{ px: 1, py: 0.75, display: 'flex', flexDirection: 'column', gap: 0.25 }}>
        {plans.length === 0 && !showNewPlan && (
          <Typography variant="caption" sx={{ fontSize: '0.65rem', color: 'text.disabled' }}>
            No plans yet.
          </Typography>
        )}
        {plans.map(p => (
          <Box
            key={p.id}
            onClick={() => { setSelectedPlanId(p.id); selectPlan(p.id).catch(err => setFormError(err.message)); }}
            sx={{
              display: 'flex', alignItems: 'center', gap: 0.75, px: 0.75, py: 0.4,
              borderRadius: 0.5, cursor: 'pointer',
              border: '1px solid',
              borderColor: p.id === selectedPlanId ? 'rgba(88,196,220,0.6)' : 'transparent',
              bgcolor: p.id === selectedPlanId ? 'rgba(88,196,220,0.08)' : 'transparent',
            }}
          >
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="caption" sx={{ fontSize: '0.7rem', display: 'block', noWrap: true }}>
                {p.name}
              </Typography>
              <Typography variant="caption" sx={{ fontSize: '0.58rem', color: 'text.secondary', fontFamily: 'mono' }}>
                {p.prescriptionDoseGy?.toFixed(2)} Gy / {p.numberOfFractions} fx · {p.beamCount ?? p.beams?.length ?? 0} beams
              </Typography>
            </Box>
            <IconButton
              size="small" sx={{ p: 0.25 }}
              aria-label={`plan-delete-${p.name}`}
              onClick={(e) => { e.stopPropagation(); ebrt.deletePlan(p.id).catch(err => setFormError(err.message)); }}
            >
              <Delete sx={{ fontSize: 13, color: 'text.secondary' }} />
            </IconButton>
          </Box>
        ))}
        <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5 }}>
          <Button size="small" fullWidth variant="outlined" startIcon={<Add />}
                  onClick={() => setShowNewPlan(v => !v)}
                  sx={{ fontSize: '0.62rem', color: 'text.secondary', borderColor: 'rgba(88,196,220,0.3)' }}>
            New Plan
          </Button>
          <Button size="small" fullWidth variant="outlined" startIcon={<CloudDownload />}
                  onClick={handleImportRTPlan} disabled={!rtPlanFileId}
                  sx={{ fontSize: '0.62rem', color: 'text.secondary', borderColor: 'rgba(88,196,220,0.3)' }}>
            Import RTPLAN
          </Button>
          <Button size="small" fullWidth variant="outlined" startIcon={<Bookmark />}
                  onClick={() => {
                    setShowTemplates(v => !v);
                    if (!showTemplates) ebrt.refreshTemplates().catch(err => setFormError(err.message));
                  }}
                  sx={{ fontSize: '0.62rem', color: 'text.secondary', borderColor: 'rgba(88,196,220,0.3)' }}>
            Templates
          </Button>
        </Box>

        {showTemplates && (
          <Box sx={{ px: 0.75, py: 0.5, display: 'flex', flexDirection: 'column', gap: 0.25 }}>
            <Typography variant="caption" sx={{ fontSize: '0.6rem', color: 'text.secondary', fontFamily: 'mono' }}>
              PLAN TEMPLATES ({ebrt.templates.length})
            </Typography>
            {ebrt.templates.length === 0 && (
              <Typography variant="caption" sx={{ fontSize: '0.6rem', color: 'text.disabled' }}>
                No templates yet — select a plan and save it as one.
              </Typography>
            )}
            {ebrt.templates.map(t => (
              <Box key={t.id} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="caption" sx={{ fontSize: '0.65rem', display: 'block', noWrap: true }}>
                    {t.name}
                  </Typography>
                  <Typography variant="caption" sx={{ fontSize: '0.55rem', color: 'text.secondary', fontFamily: 'mono' }}>
                    {t.prescriptionDoseGy?.toFixed(1)} Gy / {t.numberOfFractions} fx · {t.beamCount} beams
                  </Typography>
                </Box>
                <Button size="small" variant="outlined"
                        onClick={() => handleInstantiate(t.id)}
                        sx={{ fontSize: '0.55rem', py: 0.1, color: 'primary.main', borderColor: 'rgba(88,196,220,0.3)' }}>
                  Use
                </Button>
              </Box>
            ))}
          </Box>
        )}
      </Box>

      {formError && (
        <Typography variant="caption" color="error" sx={{ px: 1.5, fontSize: '0.62rem' }}>
          {formError}
        </Typography>
      )}

      {/* new plan form */}
      {showNewPlan && (
        <Box sx={{ px: 1.5, py: 1, display: 'flex', flexDirection: 'column', gap: 0.75,
                   borderBottom: '1px solid rgba(88,196,220,0.12)' }}>
          <Typography variant="caption" sx={{ fontSize: '0.62rem', color: 'text.secondary', fontFamily: 'mono' }}>
            NEW PLAN
          </Typography>
          <TextField size="small" label="Plan name" value={name} onChange={e => setName(e.target.value)}
                     inputProps={{ style: { fontSize: '0.7rem' } }} />
          <TextField size="small" select label="Machine" value={machineId}
                     onChange={e => { setMachineId(e.target.value); setEnergyMv(getMachine(e.target.value).energies[0]); }}
                     inputProps={{ style: { fontSize: '0.7rem' } }}>
            {MACHINES.map(m => <MenuItem key={m.id} value={m.id}>{m.label}</MenuItem>)}
          </TextField>
          <TextField size="small" select label="Energy (MV)" value={energyMv}
                     onChange={e => setEnergyMv(Number(e.target.value))}
                     inputProps={{ style: { fontSize: '0.7rem' } }}>
            {machine.energies.map(e => <MenuItem key={e} value={e}>{e} MV</MenuItem>)}
          </TextField>
          <Box sx={{ display: 'flex', gap: 0.75 }}>
            <TextField size="small" label="Dose (Gy)" value={doseGy}
                       onChange={e => setDoseGy(e.target.value)} inputProps={{ style: { fontSize: '0.7rem' } }} />
            <TextField size="small" label="Fractions" value={fx}
                       onChange={e => setFx(e.target.value)} inputProps={{ style: { fontSize: '0.7rem' } }} />
          </Box>
          {dosePerFx && (
            <Typography variant="caption" sx={{ fontSize: '0.6rem', color: 'text.disabled' }}>
              {dosePerFx} Gy per fraction
            </Typography>
          )}
          <TextField size="small" select label="Normalization" value={normalization}
                     onChange={e => setNormalization(e.target.value)}
                     inputProps={{ style: { fontSize: '0.7rem' } }}>
            {NORMALIZATIONS.map(n => <MenuItem key={n.id} value={n.id}>{n.label}</MenuItem>)}
          </TextField>
          <TextField size="small" select label="Optimization algorithm" value={optAlgorithm}
                     onChange={e => setOptAlgorithm(e.target.value)}
                     inputProps={{ style: { fontSize: '0.7rem' } }}>
            {OPTIMIZATION_ALGORITHMS.map(a => <MenuItem key={a.id} value={a.id}>{a.label}</MenuItem>)}
          </TextField>
          <TextField size="small" select label="Dose algorithm" value={doseAlgorithm}
                     onChange={e => setDoseAlgorithm(e.target.value)}
                     inputProps={{ style: { fontSize: '0.7rem' } }}>
            {DOSE_ALGORITHMS.map(a => <MenuItem key={a.id} value={a.id}>{a.label}</MenuItem>)}
          </TextField>
          <Box sx={{ display: 'flex', gap: 0.75, alignItems: 'center' }}>
            <TextField size="small" label="Grid (mm)" value={gridSize}
                       onChange={e => setGridSize(e.target.value)} inputProps={{ style: { fontSize: '0.7rem' } }} />
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 1 }}>
              <Settings sx={{ fontSize: 13, color: 'text.secondary' }} />
              <Typography variant="caption" sx={{ fontSize: '0.6rem', color: 'text.secondary' }}>
                Heterogeneity
              </Typography>
              <Switch size="small" checked={heterogeneity} onChange={e => setHeterogeneity(e.target.checked)} />
            </Box>
          </Box>
          <Button size="small" variant="contained" onClick={handleCreatePlan}
                  disabled={!name.trim() || !doseGy || !fx}
                  sx={{ fontSize: '0.65rem' }}>
            Create Plan
          </Button>
        </Box>
      )}

      {/* beam management for the selected plan */}
      {selectedPlan && (
        <>
          {/* approval flow + template actions */}
          <Box sx={{ px: 1, py: 0.6, display: 'flex', alignItems: 'center', gap: 0.5,
                     borderBottom: '1px solid rgba(88,196,220,0.12)' }}>
            <Chip
              label={selectedPlan.approvalStatus}
              size="small"
              sx={{ height: 16, fontSize: '0.55rem', fontFamily: 'mono' }}
              color={selectedPlan.approvalStatus === 'APPROVED' ? 'success'
                : selectedPlan.approvalStatus === 'REVIEWED' ? 'info' : 'warning'}
              variant="outlined"
            />
            {NEXT_APPROVAL[selectedPlan.approvalStatus] && (
              <Tooltip title={`Mark as ${NEXT_APPROVAL[selectedPlan.approvalStatus]}`}>
                <Button size="small" variant="outlined" startIcon={<GppGood />}
                        onClick={handleApprovalAdvance}
                        sx={{ fontSize: '0.55rem', py: 0.1, color: 'primary.main', borderColor: 'rgba(88,196,220,0.3)' }}>
                  {NEXT_APPROVAL[selectedPlan.approvalStatus]}
                </Button>
              </Tooltip>
            )}
            {selectedPlan.approvalStatus !== 'UNAPPROVED' && (
              <Button size="small" variant="text"
                      onClick={handleApprovalReset}
                      sx={{ fontSize: '0.55rem', py: 0.1, color: 'text.secondary', minWidth: 0 }}>
                Reset
              </Button>
            )}
            <Box sx={{ flex: 1 }} />
            <Tooltip title="Save this plan as a reusable template">
              <IconButton size="small" sx={{ p: 0.25 }} aria-label="plan-save-as-template"
                          onClick={handleSaveAsTemplate}>
                <BookmarkAdded sx={{ fontSize: 14, color: 'text.secondary' }} />
              </IconButton>
            </Tooltip>
          </Box>

          <Typography
            variant="caption"
            sx={{ px: 1, py: 0.5, display: 'block', color: 'text.secondary', fontFamily: 'mono',
                  borderBottom: '1px solid rgba(88,196,220,0.12)' }}
          >
            BEAMS ({selectedPlan.beams?.length ?? 0}) — click row to visualize
          </Typography>
          <Table size="small" sx={{ '& .MuiTableCell-root': { py: 0.25, px: 0.6, fontSize: '0.6rem', fontFamily: 'mono', borderColor: 'rgba(88,196,220,0.08)' } }}>
            <TableHead>
              <TableRow>
                <TableCell>#</TableCell>
                <TableCell>Type</TableCell>
                <TableCell align="right">Gantry°</TableCell>
                <TableCell align="right">Wdg°</TableCell>
                <TableCell align="right">W</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {(selectedPlan.beams ?? []).map(b => (
                <TableRow
                  key={b.id}
                  hover
                  onClick={() => setSelectedPlanId(selectedPlanId)} // row click keeps plan selected
                  sx={{ cursor: 'default' }}
                >
                  <TableCell>{b.beamNumber}</TableCell>
                  <TableCell>{b.beamType}</TableCell>
                  <TableCell align="right">
                    {b.gantryAngle}{b.beamType === 'VMAT' && b.gantryAngleStop != null ? `→${b.gantryAngleStop}` : ''}
                  </TableCell>
                  <TableCell align="right">{b.wedgeAngle ?? '—'}</TableCell>
                  <TableCell align="right">{b.weight != null ? b.weight.toFixed(2) : '—'}</TableCell>
                  <TableCell align="right">
                    <IconButton
                      size="small" sx={{ p: 0.2 }}
                      aria-label={`beam-delete-${b.beamNumber}`}
                      onClick={(e) => { e.stopPropagation(); ebrt.deleteBeam(b.id).catch(err => setFormError(err.message)); }}
                    >
                      <Delete sx={{ fontSize: 12, color: 'text.secondary' }} />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {/* add beam form */}
          <Box sx={{ px: 1.5, py: 1, display: 'flex', flexDirection: 'column', gap: 0.75 }}>
            <Typography variant="caption" sx={{ fontSize: '0.62rem', color: 'text.secondary', fontFamily: 'mono' }}>
              ADD BEAM
            </Typography>
            <Box sx={{ display: 'flex', gap: 0.75 }}>
              <TextField size="small" select label="Type" value={beamType}
                         onChange={e => setBeamType(e.target.value)} sx={{ flex: 1 }}
                         inputProps={{ style: { fontSize: '0.7rem' } }}>
                <MenuItem value="STATIC">Static</MenuItem>
                <MenuItem value="DMLC">DMLC IMRT</MenuItem>
                <MenuItem value="VMAT">VMAT arc</MenuItem>
              </TextField>
              {beamType === 'VMAT' ? (
                <Box sx={{ display: 'flex', gap: 0.75, flex: 1 }}>
                  <TextField size="small" label="From°" value={gantry}
                             onChange={e => setGantry(e.target.value)} inputProps={{ style: { fontSize: '0.7rem' } }} />
                  <TextField size="small" label="To°" value={gantryStop}
                             onChange={e => setGantryStop(e.target.value)} inputProps={{ style: { fontSize: '0.7rem' } }} />
                </Box>
              ) : (
                <TextField size="small" label="Gantry°" value={gantry}
                           onChange={e => setGantry(e.target.value)} sx={{ flex: 1 }}
                           inputProps={{ style: { fontSize: '0.7rem' } }} />
              )}
            </Box>
            <Box sx={{ display: 'flex', gap: 0.75 }}>
              <TextField size="small" label="Collimator°" value={collimator}
                         onChange={e => setCollimator(e.target.value)} inputProps={{ style: { fontSize: '0.7rem' } }} />
              <TextField size="small" label="Couch°" value={couch}
                         onChange={e => setCouch(e.target.value)} inputProps={{ style: { fontSize: '0.7rem' } }} />
            </Box>
            <Box sx={{ display: 'flex', gap: 0.75 }}>
              <TextField size="small" label="Field X (mm)" value={jawX}
                         onChange={e => setJawX(e.target.value)} inputProps={{ style: { fontSize: '0.7rem' } }} />
              <TextField size="small" label="Field Y (mm)" value={jawY}
                         onChange={e => setJawY(e.target.value)} inputProps={{ style: { fontSize: '0.7rem' } }} />
            </Box>
            <Box sx={{ display: 'flex', gap: 0.75 }}>
              <TextField size="small" label="Wedge° (opt.)" value={wedgeAngle}
                         onChange={e => setWedgeAngle(e.target.value)} inputProps={{ style: { fontSize: '0.7rem' } }} />
              <TextField size="small" label="Bolus (opt.)" value={bolus}
                         onChange={e => setBolus(e.target.value)} inputProps={{ style: { fontSize: '0.7rem' } }} />
            </Box>
            <Button size="small" variant="contained" startIcon={<Add />}
                    onClick={handleAddBeam} sx={{ fontSize: '0.65rem' }}>
              Add Beam
            </Button>
          </Box>

          {/* reference points */}
          <Box sx={{ px: 1.5, py: 1, display: 'flex', flexDirection: 'column', gap: 0.5,
                     borderTop: '1px solid rgba(88,196,220,0.12)' }}>
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <Typography variant="caption" sx={{ fontSize: '0.62rem', color: 'text.secondary', fontFamily: 'mono' }}>
                REFERENCE POINTS ({refPoints.length})
              </Typography>
              <Box sx={{ flex: 1 }} />
              {refPointsDirty && (
                <Button size="small" variant="contained" onClick={saveRefPoints}
                        sx={{ fontSize: '0.55rem', py: 0.1 }}>
                  Save
                </Button>
              )}
            </Box>
            <Typography variant="caption" sx={{ fontSize: '0.55rem', color: 'text.disabled' }}>
              Patient-space points (mm) shown in the viewport — dose is reported here.
            </Typography>
            {refPoints.map((pt, idx) => (
              <Box key={idx} sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
                <TextField size="small" value={pt.name} label="name"
                           onChange={e => updateRefPoint(idx, { name: e.target.value })}
                           sx={{ flex: 1.4 }}
                           inputProps={{ style: { fontSize: '0.62rem' } }} />
                <TextField size="small" value={pt.x} label="x"
                           onChange={e => updateRefPoint(idx, { x: numOrNull(e.target.value) ?? 0 })}
                           sx={{ flex: 0.8 }}
                           inputProps={{ style: { fontSize: '0.62rem' } }} />
                <TextField size="small" value={pt.y} label="y"
                           onChange={e => updateRefPoint(idx, { y: numOrNull(e.target.value) ?? 0 })}
                           sx={{ flex: 0.8 }}
                           inputProps={{ style: { fontSize: '0.62rem' } }} />
                <TextField size="small" value={pt.z} label="z"
                           onChange={e => updateRefPoint(idx, { z: numOrNull(e.target.value) ?? 0 })}
                           sx={{ flex: 0.8 }}
                           inputProps={{ style: { fontSize: '0.62rem' } }} />
                <IconButton size="small" sx={{ p: 0.2 }} aria-label={`refpoint-delete-${pt.name}`}
                            onClick={() => { setRefPoints(prev => prev.filter((_, i) => i !== idx)); setRefPointsDirty(true); }}>
                  <Delete sx={{ fontSize: 12, color: 'text.secondary' }} />
                </IconButton>
              </Box>
            ))}
            <Button size="small" variant="outlined" startIcon={<Add />}
                    onClick={() => { setRefPoints(prev => [...prev, { name: `Point ${prev.length + 1}`, x: 0, y: 0, z: 0 }]); setRefPointsDirty(true); }}
                    sx={{ fontSize: '0.6rem', color: 'text.secondary', borderColor: 'rgba(88,196,220,0.3)' }}>
              Add Reference Point
            </Button>
          </Box>
        </>
      )}
    </Box>
  );
}
