import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { Box, Typography, Table, TableBody, TableCell, TableHead, TableRow,
  Checkbox, Button, Divider, Tooltip } from '@mui/material';
import { Colorize, TrendingUp } from '@mui/icons-material';
import {
  buildCtToDoseFrame,
  collectStructureDose,
  computeDVH,
  doseStats,
  volumeAtDose,
} from '../../lib/dvh.js';

const DVH_BIN_WIDTH = 20; // cGy per bin

/**
 * EvaluationPanel - M5 plan evaluation: DVH curves per structure with dose
 * statistics, plus point-dose readout.
 *
 * DVH inputs come from two structure sources (both already in the shape
 * { slices: [{sopInstanceUID, contours}] }):
 *  - imported RTSTRUCT ROIs (contours + roiSequence from /api/rtstruct)
 *  - user-painted segments (serialized on demand by the contouring hook)
 *
 * @param {Object} props
 * @param {Object|null} props.plan - parsed RTPLAN (for prescription % axis)
 * @param {Array} props.roiSequence - ROI list from /api/rtstruct ({roiNumber, roiName, displayColor})
 * @param {Array} props.contourSequence - contours from /api/rtstruct
 * @param {Array} props.paintedSegments - [{ id, name, color, slices }] serialized painted segments
 * @param {Float32Array|null} props.doseGrid
 * @param {Object|null} props.doseMeta
 * @param {Array} props.ctFiles - CT files slice-ordered
 * @param {Object|null} props.doseProbe - { point, doseCgy, pctRx } last sampled point
 * @param {boolean} props.probeEnabled - point dose click-capture active
 * @param {Function} props.onToggleProbe - toggle point dose click capture
 * @param {Function} props.onJumpToGlobalMax - jump to the global max dose point
 */
export default function EvaluationPanel({
  plan,
  roiSequence = [],
  contourSequence = [],
  paintedSegments = [],
  doseGrid,
  doseMeta,
  ctFiles,
  doseProbe = null,
  probeEnabled = false,
  onToggleProbe,
  onJumpToGlobalMax,
}) {
  const [selected, setSelected] = useState([]); // [{key, name, color, slices}]
  const [results, setResults] = useState([]); // [{key, name, color, stats, dvh}]
  const canvasRef = useRef(null);
  const doseReady = !!(doseGrid && doseMeta);

  const allSources = useMemo(() => {
    // group contourSequence by ROI, then by slice SOP UID
    const rtSources = roiSequence.map(roi => {
      const bySlice = new Map();
      for (const c of contourSequence) {
        if (c.referencedROINumber !== roi.roiNumber) continue;
        const uid = c.referencedSOPInstanceUID;
        if (!bySlice.has(uid)) bySlice.set(uid, []);
        bySlice.get(uid).push(c.contourData);
      }
      const slices = [...bySlice.entries()].map(([sopInstanceUID, contours]) => ({ sopInstanceUID, contours }));
      return {
        key: `rtstruct-${roi.roiNumber}`, name: roi.roiName,
        color: `rgb(${roi.displayColor?.r ?? 88},${roi.displayColor?.g ?? 196},${roi.displayColor?.b ?? 220})`,
        slices,
      };
    });
    const painted = paintedSegments.map(s => ({
      key: `painted-${s.id}`, name: s.name, color: s.color, slices: s.slices ?? [],
    }));
    return [...rtSources, ...painted];
  }, [roiSequence, contourSequence, paintedSegments]);

  const toggle = (key) => {
    setSelected(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
  };

  // (re)compute DVH when selection or dose changes
  useEffect(() => {
    if (!doseReady) { setResults([]); return; }
    const out = [];
    for (const src of allSources) {
      if (!selected.includes(src.key)) continue;
      const { values, voxelVolumeMm3 } = collectStructureDose(
        { slices: src.slices }, doseGrid, doseMeta, ctFiles, null,
        // real rasterizer injected to keep this module dependency-light
        (mask, cols, rows, polys, v) => {
          for (const poly of polys) {
            const n = poly.length / 2;
            if (n < 3) continue;
            const jMin = Math.max(0, Math.ceil(Math.min(...poly.filter((_, i) => i % 2 === 1))));
            const jMax = Math.min(rows - 1, Math.floor(Math.max(...poly.filter((_, i) => i % 2 === 1))));
            for (let j = jMin; j <= jMax; j++) {
              const xs = [];
              for (let e = 0; e < n; e++) {
                const xa = poly[e * 2], ya = poly[e * 2 + 1];
                const xb = poly[((e + 1) % n) * 2], yb = poly[((e + 1) % n) * 2 + 1];
                if ((ya <= j && yb > j) || (yb <= j && ya > j)) {
                  xs.push(xa + ((j - ya) / (yb - ya)) * (xb - xa));
                }
              }
              xs.sort((a, b) => a - b);
              for (let k = 0; k + 1 < xs.length; k += 2) {
                const xa = Math.max(0, Math.ceil(xs[k]));
                const xb = Math.min(cols - 1, Math.floor(xs[k + 1]));
                for (let i = xa; i <= xb; i++) mask[j * cols + i] = v;
              }
            }
          }
        },
        // patient → dose voxel column/row (axial HFS)
        (patientP, dg) => ({
          i: (patientP[0] - dg.imagePosition.x) / dg.pixelSpacing.j,
          j: (patientP[1] - dg.imagePosition.y) / dg.pixelSpacing.i,
        }),
      );
      if (values.length === 0) continue;
      const stats = doseStats(values);
      out.push({
        key: src.key, name: src.name, color: src.color,
        dvh: computeDVH(values, DVH_BIN_WIDTH),
        stats: {
          ...stats,
          volumeCm3: (values.length * voxelVolumeMm3 / 1000),
        },
      });
    }
    setResults(out);
  }, [selected, allSources, doseReady, doseGrid, doseMeta, ctFiles]);

  // draw DVH curves on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.parentElement?.getBoundingClientRect();
    const w = Math.round((rect?.width ?? 240) * dpr);
    const h = Math.round(180 * dpr);
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w / dpr, h / dpr);
    if (results.length === 0) return;

    const cssW = w / dpr, cssH = h / dpr;
    const padL = 34, padB = 22, padT = 8, padR = 8;
    const plotW = cssW - padL - padR, plotH = cssH - padB - padT;

    // axes: x = dose cGy, y = cumulative volume % (0-100)
    const maxDose = Math.max(...results.map(r => {
      const dvh = r.dvh;
      return dvh.binCenters.length ? dvh.binCenters[dvh.binCenters.length - 1] + r.dvh.binWidth : 0;
    }), 1);
    const totalVox = results[0]?.dvh.totalCount || 1;

    ctx.strokeStyle = 'rgba(88,196,220,0.35)';
    ctx.lineWidth = 1;
    ctx.strokeRect(padL, padT, plotW, plotH);
    // gridlines at 25/50/75%
    ctx.strokeStyle = 'rgba(88,196,220,0.12)';
    for (const gy of [0.25, 0.5, 0.75]) {
      ctx.beginPath();
      ctx.moveTo(padL, padT + plotH * gy);
      ctx.lineTo(padL + plotW, padT + plotH * gy);
      ctx.stroke();
    }
    // axis labels
    ctx.fillStyle = 'rgba(148,163,184,0.9)';
    ctx.font = '9px "IBM Plex Mono", monospace';
    ctx.fillText('Dose (cGy)', padL + plotW / 2 - 22, cssH - 4);
    ctx.save();
    ctx.translate(8, padT + plotH / 2 + 18);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('Volume (%)', 0, 0);
    ctx.restore();
    ctx.fillText(maxDose.toFixed(0), padL + plotW - 24, cssH - 6);
    ctx.fillText('0', padL - 4, cssH - 6);
    ctx.fillText('100', 2, padT + 8);

    for (const r of results) {
      const { cumulative, totalCount, binWidth } = r.dvh;
      if (!totalCount) continue;
      ctx.strokeStyle = r.color;
      ctx.lineWidth = 1.75;
      ctx.beginPath();
      for (let b = 0; b < cumulative.length; b++) {
        const x = padL + ((b * binWidth) / maxDose) * plotW;
        const y = padT + plotH - (cumulative[b] / totalCount) * plotH;
        b === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }, [results]);

  const prescriptionCgy = plan?.prescription?.targetPrescriptionDoseGy != null
    ? plan.prescription.targetPrescriptionDoseGy * 100 : null;

  return (
    <Box sx={{ width: '100%', overflow: 'auto' }}>
      <Typography
        variant="caption"
        sx={{ px: 1, py: 0.5, display: 'flex', alignItems: 'center', gap: 0.5,
              color: 'text.secondary', fontFamily: 'mono',
              borderBottom: '1px solid rgba(88,196,220,0.12)' }}
      >
        PLAN EVALUATION {prescriptionCgy ? `· Rx ${prescriptionCgy} cGy` : ''}
      </Typography>

      {!doseReady && (
        <Box sx={{ p: 2 }}>
          <Typography variant="caption" sx={{ fontSize: '0.65rem', color: 'text.secondary' }}>
            Enable dose display (IMAGES module → Dose tab → Show Dose) once to
            load the dose grid, then return here.
          </Typography>
        </Box>
      )}

      {doseReady && (
        <Box sx={{ px: 1, py: 1 }}>
          <canvas ref={canvasRef} style={{ width: '100%', height: 180, display: 'block' }} />
          <Typography variant="caption" sx={{ display: 'block', fontSize: '0.58rem', color: 'text.disabled', mt: 0.5 }}>
            Cumulative DVH — one curve per selected structure
          </Typography>

          <Divider sx={{ my: 1 }} />

          {/* point dose probe (Eclipse Ch6.7) + global max jump (Ch6.6) */}
          <Box sx={{ display: 'flex', gap: 0.5, mb: 0.5 }}>
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
                onClick={onJumpToGlobalMax}
                sx={{ fontSize: '0.6rem', flex: 1, color: 'text.secondary', borderColor: 'rgba(88,196,220,0.3)' }}
              >
                Global Max
              </Button>
            </Tooltip>
          </Box>
          <Typography variant="caption" sx={{ display: 'block', fontSize: '0.58rem', color: 'text.secondary', mb: 0.5, fontFamily: 'mono' }}>
            {doseProbe == null && 'Point dose off — enable and click the CT to sample.'}
            {doseProbe != null && doseProbe.doseCgy == null && 'Picked point is outside the dose grid.'}
            {doseProbe != null && doseProbe.doseCgy != null && (
              <>
                {doseProbe.doseCgy.toFixed(1)} cGy
                {doseProbe.pctRx != null ? ` · ${doseProbe.pctRx.toFixed(1)}% Rx` : ''}
              </>
            )}
          </Typography>

          <Divider sx={{ my: 1 }} />

          <Typography variant="caption" sx={{ display: 'block', fontSize: '0.62rem', color: 'text.secondary', fontFamily: 'mono', mb: 0.5 }}>
            STRUCTURES
          </Typography>
          <Table size="small" sx={{ '& .MuiTableCell-root': { py: 0.2, px: 0.5, fontSize: '0.58rem', fontFamily: 'mono', borderColor: 'rgba(88,196,220,0.08)' } }}>
            <TableHead>
              <TableRow>
                <TableCell padding="none">Show</TableCell>
                <TableCell>Name</TableCell>
                <TableCell align="right">Mean</TableCell>
                <TableCell align="right">Max</TableCell>
                <TableCell align="right">Vol cm³</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {allSources.map(src => {
                const r = results.find(x => x.key === src.key);
                const isSel = selected.includes(src.key);
                return (
                  <TableRow key={src.key} hover onClick={() => toggle(src.key)} sx={{ cursor: 'pointer' }}>
                    <TableCell padding="none">
                      <Checkbox size="small" checked={isSel} sx={{ p: 0.2 }}
                                inputProps={{ 'aria-label': `dvh-${src.name}` }} />
                    </TableCell>
                    <TableCell>
                      <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
                        <Box sx={{ width: 8, height: 8, borderRadius: '2px', bgcolor: src.color, flexShrink: 0 }} />
                        {src.name}
                      </Box>
                    </TableCell>
                    <TableCell align="right">{r ? r.stats.mean.toFixed(0) : '—'}</TableCell>
                    <TableCell align="right">{r ? r.stats.max.toFixed(0) : '—'}</TableCell>
                    <TableCell align="right">{r ? r.stats.volumeCm3.toFixed(1) : '—'}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          {results.length > 0 && (
            <Box sx={{ mt: 1 }}>
              <Typography variant="caption" sx={{ display: 'block', fontSize: '0.58rem', color: 'text.disabled' }}>
                Dose statistics in cGy · volumes in cm³ (dose-grid resolution)
              </Typography>
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
}
