import { useEffect, useMemo, useRef } from 'react';
import { Box, Typography } from '@mui/material';
import {
  sampleCoronal,
  sampleSagittal,
  huToRGBA,
  doseToRGBA,
  zExtentMm,
} from '../../lib/mprVolume.js';
import { trilinearSample } from '../../lib/doseSampling.js';

/**
 * MPRView - one orthogonal plane (coronal | sagittal) rendered from the
 * cached CT volume by CPU resampling. Wheel scrolls the plane stack,
 * dragging moves the crosshair; a dose colour overlay is sampled from the
 * dose grid when enabled.
 *
 * Orientation conventions (HFS axial stack):
 *  - coronal: horizontal = x (R→L), vertical = slices (H→F), wheel = yIdx
 *  - sagittal: horizontal = y (A→P), vertical = slices (H→F), wheel = xIdx
 *
 * @param {Object} props
 * @param {'coronal'|'sagittal'} props.orientation
 * @param {Object|null} props.volumeState - { volume, geom, progress, error }
 * @param {{xIdx:number, yIdx:number}} props.crosshair
 * @param {number} props.sliceIdx - current z slice (kept in sync with axial)
 * @param {Function} props.onCrosshairChange - ({xIdx?, yIdx?, sliceIdx?}) => void
 * @param {Object|null} props.dose - { grid, geom, doseAtFull, opacity } | null
 * @param {{wc:number, ww:number}} props.wl
 */
export default function MPRView({
  orientation,
  volumeState,
  crosshair,
  sliceIdx,
  onCrosshairChange,
  dose = null,
  wl = { wc: 40, ww: 400 },
}) {
  const canvasRef = useRef(null);
  const { volume, geom } = volumeState ?? {};
  const isCoronal = orientation === 'coronal';

  const sample = useMemo(() => {
    if (!volume || !geom) return null;
    return isCoronal
      ? sampleCoronal(volume, geom, crosshair.yIdx)
      : sampleSagittal(volume, geom, crosshair.xIdx);
  }, [volume, geom, isCoronal, crosshair.yIdx, crosshair.xIdx]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const draw = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const dpr = window.devicePixelRatio || 1;
      const rect = parent.getBoundingClientRect();
      const w = Math.round(rect.width * dpr);
      const h = Math.round(rect.height * dpr);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      const ctx = canvas.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, rect.width, rect.height);

      const ox0 = 4, oy0 = 4; // label margin
      if (!sample || !geom) {
        ctx.fillStyle = 'rgba(148,163,184,0.6)';
        ctx.font = '12px "IBM Plex Mono", monospace';
        ctx.fillText(volumeState?.error ?? 'loading volume…', 14, 24);
        if (volumeState?.progress) {
          ctx.fillText(`${volumeState.progress.loaded}/${volumeState.progress.total}`, 14, 44);
        }
        return;
      }

      const { pixels, width, height } = sample;
      const off = document.createElement('canvas');
      off.width = width;
      off.height = height;
      off.getContext('2d').putImageData(
        new ImageData(huToRGBA(pixels, wl.wc, wl.ww), width, height), 0, 0,
      );

      // dose overlay sampled at output resolution (2px steps)
      let doseCanvas = null;
      if (dose?.grid && dose?.geom) {
        doseCanvas = document.createElement('canvas');
        doseCanvas.width = width;
        doseCanvas.height = height;
        const dctx = doseCanvas.getContext('2d');
        const dosePixels = new Float32Array(width * height);
        const step = 2;
        for (let k = 0; k < height; k += step) {
          const z = geom.zPositions[Math.min(k, geom.zPositions.length - 1)];
          for (let i = 0; i < width; i += step) {
            const p = isCoronal
              ? [geom.originX + i * geom.spacingX, geom.originY + crosshair.yIdx * geom.spacingY, z]
              : [geom.originX + crosshair.xIdx * geom.spacingX, geom.originY + i * geom.spacingY, z];
            const d = trilinearSample(dose.grid, dose.geom, p) ?? 0;
            for (let dk = 0; dk < step && k + dk < height; dk++) {
              for (let di = 0; di < step && i + di < width; di++) {
                dosePixels[(k + dk) * width + i + di] = d;
              }
            }
          }
        }
        dctx.putImageData(
          new ImageData(doseToRGBA(dosePixels, dose.doseAtFull, dose.opacity), width, height), 0, 0,
        );
      }

      // fit into canvas preserving the mm aspect
      const inPlaneMm = width * (isCoronal ? geom.spacingX : geom.spacingY);
      const heightMm = zExtentMm(geom);
      const scale = Math.min((rect.width - ox0 * 2) / inPlaneMm, (rect.height - oy0 * 2) / heightMm);
      const drawW = inPlaneMm * scale;
      const drawH = heightMm * scale;
      const ox = (rect.width - drawW) / 2;
      const oy = (rect.height - drawH) / 2;

      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(off, ox, oy, drawW, drawH);
      if (doseCanvas) {
        ctx.drawImage(doseCanvas, ox, oy, drawW, drawH);
      }

      // crosshair lines
      ctx.strokeStyle = 'rgba(88,196,220,0.85)';
      ctx.lineWidth = 1;
      const colW = drawW / width;
      const rowH = drawH / height;
      const cxLine = ox + ((isCoronal ? crosshair.xIdx : crosshair.yIdx) + 0.5) * colW;
      const cyLine = oy + (sliceIdx + 0.5) * rowH;
      ctx.beginPath();
      ctx.moveTo(cxLine, oy);
      ctx.lineTo(cxLine, oy + drawH);
      ctx.moveTo(ox, cyLine);
      ctx.lineTo(ox + drawW, cyLine);
      ctx.stroke();

      // orientation labels
      ctx.fillStyle = 'rgba(148,163,184,0.95)';
      ctx.font = '11px "IBM Plex Mono", monospace';
      const tags = isCoronal ? ['R', 'L', 'A', 'P'] : ['A', 'P', 'R', 'L'];
      ctx.fillText(tags[0], ox + 6, oy + drawH - 8);
      ctx.fillText(tags[1], ox + drawW - 16, oy + drawH - 8);
      ctx.fillText('H', ox + 6, oy + 16);
      ctx.fillText('F', ox + drawW / 2 - 4, oy + drawH - 8);
      ctx.fillStyle = 'rgba(88,196,220,0.9)';
      ctx.fillText(
        `${isCoronal ? 'COR' : 'SAG'} idx ${isCoronal ? crosshair.yIdx : crosshair.xIdx}`,
        ox + drawW - 90, oy + 16,
      );
    };

    draw();
    const ro = new ResizeObserver(() => draw());
    const parent = canvas.parentElement;
    if (parent) ro.observe(parent);
    return () => ro.disconnect();
  }, [sample, geom, isCoronal, crosshair.xIdx, crosshair.yIdx, sliceIdx, dose, wl.wc, wl.ww, volumeState]);

  // pixel → output cell → crosshair update
  const handlePointer = (e) => {
    if (!geom || !sample) return;
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const width = sample.width, height = sample.height;
    const inPlaneMm = width * (isCoronal ? geom.spacingX : geom.spacingY);
    const heightMm = zExtentMm(geom);
    const scale = Math.min((rect.width - 8) / inPlaneMm, (rect.height - 8) / heightMm);
    const drawW = inPlaneMm * scale, drawH = heightMm * scale;
    const ox = (rect.width - drawW) / 2, oy = (rect.height - drawH) / 2;
    const cx = e.clientX - rect.left - ox, cy = e.clientY - rect.top - oy;
    if (cx < 0 || cy < 0 || cx > drawW || cy > drawH) return;
    const cell = Math.max(0, Math.min(width - 1, Math.floor(cx / (drawW / width))));
    const row = Math.max(0, Math.min(height - 1, Math.floor(cy / (drawH / height))));
    if (isCoronal) {
      onCrosshairChange?.({ xIdx: cell, sliceIdx: row });
    } else {
      onCrosshairChange?.({ yIdx: cell, sliceIdx: row });
    }
  };

  const handleWheel = (e) => {
    e.preventDefault();
    const dir = e.deltaY > 0 ? 1 : -1;
    if (isCoronal) {
      onCrosshairChange?.({ yIdx: (crosshair.yIdx ?? 0) + dir });
    } else {
      onCrosshairChange?.({ xIdx: (crosshair.xIdx ?? 0) + dir });
    }
  };

  return (
    <Box
      sx={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden' }}
      onWheel={handleWheel}
      onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); handlePointer(e); }}
      onPointerMove={(e) => { if (e.buttons === 1) handlePointer(e); }}
    >
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block', touchAction: 'none' }} />
      <Typography variant="caption" sx={{ position: 'absolute', right: 6, bottom: 4, fontSize: '0.55rem',
            color: 'text.disabled', fontFamily: 'mono', pointerEvents: 'none' }}>
        {isCoronal ? 'CORONAL' : 'SAGITTAL'}
      </Typography>
    </Box>
  );
}
