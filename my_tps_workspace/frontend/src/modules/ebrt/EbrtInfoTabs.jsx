import { useMemo, useState } from 'react';
import { Box, Typography, Tabs, Tab, Table, TableBody, TableCell, TableHead,
  TableRow } from '@mui/material';
import { trilinearSample } from '../../lib/doseSampling.js';

/**
 * EbrtInfoTabs - the Information (Info) window at the bottom of the EBRT
 * workspace (Eclipse style): Fields / Dose Statistics / Reference Points /
 * Calculation Models tabs. Read-only data views over existing state.
 *
 * @param {Object} props
 * @param {Object|null} props.plan - selected workspace plan (with beams)
 * @param {Array} props.dvhResults - computed per-structure results (useDvh)
 * @param {Float32Array|null} props.doseGrid
 * @param {Object|null} props.doseMeta
 * @param {number|null} props.prescriptionCgy
 */
export default function EbrtInfoTabs({ plan = null, dvhResults = [], doseGrid = null, doseMeta = null, prescriptionCgy = null }) {
  const [tab, setTab] = useState(0);

  const beams = plan?.beams ?? [];
  const referencePoints = plan?.referencePoints ?? [];
  const cellSx = { py: 0.3, px: 0.75, fontSize: '0.62rem', fontFamily: 'mono', borderColor: 'rgba(88,196,220,0.08)', whiteSpace: 'nowrap' };
  const headSx = { ...cellSx, color: 'text.secondary', position: 'sticky', top: 0, background: '#0d1f33' };

  // reference point doses sampled from the dose grid
  const pointDoses = useMemo(() => {
    if (!doseGrid || !doseMeta || referencePoints.length === 0) return null;
    return referencePoints.map(pt => {
      const dose = trilinearSample(doseGrid, {
        imagePosition: doseMeta.imagePosition,
        imageOrientation: doseMeta.imageOrientation,
        pixelSpacing: doseMeta.pixelSpacing,
        gridFrameOffsetVector: doseMeta.gridFrameOffsetVector,
        cols: doseMeta.columns,
        rows: doseMeta.rows,
      }, [pt.x, pt.y, pt.z]);
      return { name: pt.name, doseCgy: dose, inGrid: dose != null };
    });
  }, [doseGrid, doseMeta, referencePoints]);

  const pct = (cgy) => (prescriptionCgy ? (cgy / prescriptionCgy) * 100 : null);

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'background.paper', overflow: 'hidden' }}>
      <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" scrollButtons="auto"
            sx={{ minHeight: 26, borderBottom: '1px solid rgba(88,196,220,0.12)',
                  '& .MuiTab-root': { minHeight: 26, fontSize: '0.6rem', fontFamily: 'mono', px: 1.5 } }}>
        <Tab label="Fields" />
        <Tab label="Dose Statistics" />
        <Tab label="Reference Points" />
        <Tab label="Calculation Models" />
      </Tabs>

      <Box sx={{ flex: 1, overflow: 'auto' }}>
        {tab === 0 && (
          <Table size="small" sx={{ '& .MuiTableCell-root': cellSx }}>
            <TableHead>
              <TableRow>
                {['Field ID', 'Technique', 'Machine|Energy', 'Gantry', 'Coll', 'Couch', 'Wedge', 'Field X (mm)', 'Field Y (mm)', 'Weight'].map(h => (
                  <TableCell key={h} sx={headSx}>{h}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {beams.length === 0 && (
                <TableRow><TableCell colSpan={10} sx={{ color: 'text.disabled' }}>No plan selected.</TableCell></TableRow>
              )}
              {beams.map(b => (
                <TableRow key={b.id ?? b.beamNumber} hover>
                  <TableCell>{b.name ?? `Field ${b.beamNumber}`}</TableCell>
                  <TableCell>{b.beamType}</TableCell>
                  <TableCell>{[plan?.machineName, b.energyMv ? `${b.energyMv} MV` : null].filter(Boolean).join(' | ') || '—'}</TableCell>
                  <TableCell>
                    {b.gantryAngle ?? 0}{b.beamType === 'VMAT' && b.gantryAngleStop != null ? ` → ${b.gantryAngleStop}` : ''}
                  </TableCell>
                  <TableCell>{b.collimatorAngle ?? 0}</TableCell>
                  <TableCell>{b.couchAngle ?? 0}</TableCell>
                  <TableCell>{b.wedgeAngle != null ? `Wedge ${b.wedgeAngle}°` : 'None'}</TableCell>
                  <TableCell>{[b.jawX1, b.jawX2].map(v => (v ?? 0).toFixed(1)).join(' / ')}</TableCell>
                  <TableCell>{[b.jawY1, b.jawY2].map(v => (v ?? 0).toFixed(1)).join(' / ')}</TableCell>
                  <TableCell align="right">{b.weight != null ? b.weight.toFixed(3) : '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {tab === 1 && (
          <Table size="small" sx={{ '& .MuiTableCell-root': cellSx }}>
            <TableHead>
              <TableRow>
                {['Structure', 'Volume (cm³)', 'Min (%)', 'Max (%)', 'Mean (%)'].map(h => (
                  <TableCell key={h} sx={headSx}>{h}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {dvhResults.length === 0 && (
                <TableRow><TableCell colSpan={5} sx={{ color: 'text.disabled' }}>
                  No computed structures — tick structures in the sidebar EVALUATION module.
                </TableCell></TableRow>
              )}
              {dvhResults.map(r => {
                const p = (v) => (prescriptionCgy ? (v / prescriptionCgy * 100).toFixed(1) : '—');
                return (
                  <TableRow key={r.key} hover>
                    <TableCell>
                      <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}>
                        <Box sx={{ width: 8, height: 8, borderRadius: '2px', bgcolor: r.color }} />
                        {r.name}
                      </Box>
                    </TableCell>
                    <TableCell>{r.stats.volumeCm3.toFixed(1)}</TableCell>
                    <TableCell>{p(r.stats.min)}</TableCell>
                    <TableCell>{p(r.stats.max)}</TableCell>
                    <TableCell>{p(r.stats.mean)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}

        {tab === 2 && (
          <Table size="small" sx={{ '& .MuiTableCell-root': cellSx }}>
            <TableHead>
              <TableRow>
                <TableCell sx={headSx}>Point</TableCell>
                <TableCell sx={headSx}>Location (mm)</TableCell>
                <TableCell align="right" sx={headSx}>Total Dose (cGy)</TableCell>
                <TableCell align="right" sx={headSx}>% of Rx</TableCell>
                <TableCell sx={headSx}>In Grid</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {referencePoints.length === 0 && (
                <TableRow><TableCell colSpan={5} sx={{ color: 'text.disabled' }}>
                  No reference points on this plan (add them in the REFERENCE POINTS section of the panel).
                </TableCell></TableRow>
              )}
              {referencePoints.map((pt, i) => {
                const d = pointDoses?.[i];
                return (
                  <TableRow key={i} hover>
                    <TableCell>{pt.name}</TableCell>
                    <TableCell>{[pt.x, pt.y, pt.z].map(v => (v ?? 0).toFixed(1)).join(', ')}</TableCell>
                    <TableCell align="right">{d?.inGrid ? d.doseCgy.toFixed(1) : '—'}</TableCell>
                    <TableCell align="right">{d?.inGrid && prescriptionCgy ? `${(d.doseCgy / prescriptionCgy * 100).toFixed(1)}%` : '—'}</TableCell>
                    <TableCell>
                      {d == null ? '—' : d.inGrid
                        ? <Box component="span" sx={{ color: '#9ae66e' }}>●</Box>
                        : <Box component="span" sx={{ color: 'text.disabled' }}>outside</Box>}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}

        {tab === 3 && (
          <Table size="small" sx={{ '& .MuiTableCell-root': cellSx }}>
            <TableHead>
              <TableRow>
                {['Type', 'Calculation Type', 'Status'].map(h => (
                  <TableCell key={h} sx={headSx}>{h}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {[
                ['Volume Dose', 'Water-equivalent v1 (P3-M5a prototype)', 'OK'],
                ['Stereotactic Dose', '—', 'Not supported'],
                ['DVH Estimation', 'Direct computation (useDvh)', 'OK'],
                ['Compensator', '—', 'Not supported'],
                ['Portal Dose', '—', 'Not supported'],
                ['Beam Angle Optimization', '—', 'Not supported'],
                ['Optimization', '—', 'Not supported'],
              ].map(([type, calc, status]) => (
                <TableRow key={type} hover>
                  <TableCell>{type}</TableCell>
                  <TableCell>{calc}</TableCell>
                  <TableCell sx={{ color: status === 'OK' ? '#9ae66e' : 'text.disabled' }}>{status}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Box>
    </Box>
  );
}
