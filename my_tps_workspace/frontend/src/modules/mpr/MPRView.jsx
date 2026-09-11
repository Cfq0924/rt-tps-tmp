import { useEffect, useMemo, useRef } from 'react';
import * as cornerstone from '@cornerstonejs/core';
import { Box, Typography } from '@mui/material';
import {
  sampleCoronal,
  sampleSagittal,
  huToRGBA,
  doseToRGBA,
  sliceSpacing,
} from '../../lib/mprVolume.js';
import { trilinearSample } from '../../lib/doseSampling.js';
import { structurePlaneSegments } from '../../lib/contourPlaneIntersection.js';

/**
 * MPRView - one orthogonal plane (coronal | sagittal) rendered from the
 * cached CT volume by CPU resampling. Wheel scrolls the plane stack,
 * dragging moves the crosshair; a dose colour overlay is sampled from the
 * dose grid when enabled.
 *
 * All panes share ONE magnification: millimetres per CSS pixel is taken
 * from the master (axial) viewport camera, and every pane centres on the
 * isocentre — the Eclipse-style coordinated quad.
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
 * @param {Object|null} props.masterViewport - axial viewport (zoom master)
 * @param {Array|null} props.iso - isocentre patient mm [x, y, z]
 */
export default function MPRView({
  orientation,
  volumeState,
  crosshair,
  sliceIdx,
  onCrosshairChange,
  dose = null,
  wl = { wc: 40, ww: 400 },
  masterViewport = null,
  iso = null,
  structureLines = [],
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

  /**
   * Shared view transform: mm per CSS pixel from the master camera; the
   * pane centres on the isocentre. Returns the plane-pixel → canvas affine
   * plus the crosshair position in canvas space.
   */
  const viewTransform = (rect) => {
    const cam = masterViewport?.getCamera?.();
    const masterH = masterViewport?.element?.clientHeight ?? 0;
    if (!cam?.parallelScale || !masterH || !geom) return null;
    const mmPerPx = cam.parallelScale / (masterH / 2);
    const pxPerMm = 1 / mmPerPx;
    const cx = rect.width / 2, cy = rect.height / 2;
    const isoPt = iso ?? [
      geom.originX + geom.cols * geom.spacingX / 2,
      geom.originY + geom.rows * geom.spacingY / 2,
      geom.zPositions[Math.floor(geom.numSlices / 2)],
    ];
    const dz = sliceSpacing(geom) || 1;
    if (isCoronal) {
      return {
        a: geom.spacingX * pxPerMm,
        d: -dz * pxPerMm,
        e: cx + (geom.originX - isoPt[0]) * pxPerMm,
        f: cy - (geom.zPositions[0] - isoPt[2]) * pxPerMm,
        crossX: cx + (crosshair.xIdx * geom.spacingX + geom.originX - isoPt[0]) * pxPerMm,
        crossY: cy - (geom.zPositions[Math.min(sliceIdx, geom.numSlices - 1)] - isoPt[2]) * pxPerMm,
      };
    }
    return {
      a: geom.spacingY * pxPerMm,
      d: -dz * pxPerMm,
      e: cx + (geom.originY - isoPt[1]) * pxPerMm,
      f: cy - (geom.zPositions[0] - isoPt[2]) * pxPerMm,
      crossX: cx + (crosshair.yIdx * geom.spacingY + geom.originY - isoPt[1]) * pxPerMm,
      crossY: cy - (geom.zPositions[Math.min(sliceIdx, geom.numSlices - 1)] - isoPt[2]) * pxPerMm,
    };
  };

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

      if (!sample || !geom) {
        // centred loading state: bar + slice counter
        const msg = volumeState?.error ?? 'Reconstructing volume…';
        const prog = volumeState?.progress;
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(148,163,184,0.9)';
        ctx.font = '13px "IBM Plex Mono", monospace';
        ctx.fillText(msg, rect.width / 2, rect.height / 2 - 18);
        if (prog) {
          const frac = prog.total ? prog.loaded / prog.total : 0;
          const bw = Math.min(240, rect.width * 0.5);
          ctx.strokeStyle = 'rgba(88,196,220,0.5)';
          ctx.strokeRect(rect.width / 2 - bw / 2, rect.height / 2, bw, 8);
          ctx.fillStyle = '#58c4dc';
          ctx.fillRect(rect.width / 2 - bw / 2, rect.height / 2, bw * frac, 8);
          ctx.fillStyle = 'rgba(148,163,184,0.9)';
          ctx.fillText(`${prog.loaded} / ${prog.total} slices`, rect.width / 2, rect.height / 2 + 28);
        }
        ctx.textAlign = 'left';
        return;
      }

      const { pixels, width, height } = sample;
      const vt = viewTransform(rect);
      if (!vt) return;

      const off = document.createElement('canvas');
      off.width = width;
      off.height = height;
      off.getContext('2d').putImageData(
        new ImageData(huToRGBA(pixels, wl.wc, wl.ww), width, height), 0, 0,
      );

      // dose overlay sampled at output resolution (2px steps), same transform
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

      ctx.imageSmoothingEnabled = true;
      ctx.save();
      ctx.setTransform(vt.a * dpr, 0, 0, vt.d * dpr, vt.e * dpr, vt.f * dpr);
      ctx.drawImage(off, 0, 0);
      if (doseCanvas) ctx.drawImage(doseCanvas, 0, 0);
      ctx.restore();

      // RTSTRUCT silhouette lines: polygon ∩ plane, drawn in device space
      if (structureLines.length > 0) {
        const planeValue = isCoronal
          ? geom.originY + crosshair.yIdx * geom.spacingY
          : geom.originX + crosshair.xIdx * geom.spacingX;
        ctx.lineWidth = 1;
        for (const s of structureLines) {
          const segs = structurePlaneSegments(s.polygons, orientation, isCoronal ? crosshair.yIdx : crosshair.xIdx, geom);
          if (segs.length === 0) continue;
          const [r, g, b] = s.color;
          ctx.strokeStyle = `rgba(${r},${g},${b},0.9)`;
          ctx.beginPath();
          for (const seg of segs) {
            ctx.moveTo(vt.a * seg.a[0] + vt.e, vt.d * seg.a[1] + vt.f);
            ctx.lineTo(vt.a * seg.b[0] + vt.e, vt.d * seg.b[1] + vt.f);
          }
          ctx.stroke();
        }
      }

      // crosshair reference lines (canvas-space via the affine)
      const cxLine = vt.a * (isCoronal ? crosshair.xIdx : crosshair.yIdx) + vt.e;
      const cyLine = vt.d * sliceIdx + vt.f;
      ctx.strokeStyle = 'rgba(88,196,220,0.85)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cxLine, 0);
      ctx.lineTo(cxLine, rect.height);
      ctx.moveTo(0, cyLine);
      ctx.lineTo(rect.width, cyLine);
      ctx.stroke();

      // orientation labels
      ctx.fillStyle = 'rgba(148,163,184,0.95)';
      ctx.font = '11px "IBM Plex Mono", monospace';
      const tags = isCoronal ? ['R', 'L', 'A', 'P'] : ['A', 'P', 'R', 'L'];
      ctx.fillText(tags[0], 6, rect.height - 8);
      ctx.fillText(tags[1], rect.width - 16, rect.height - 8);
      ctx.fillText('H', 6, 16);
      ctx.fillText('F', rect.width / 2 - 4, rect.height - 8);
      ctx.fillStyle = 'rgba(88,196,220,0.9)';
      ctx.fillText(
        `${isCoronal ? 'COR' : 'SAG'} idx ${isCoronal ? crosshair.yIdx : crosshair.xIdx}`,
        rect.width - 90, 16,
      );
    };

    draw();
    const ro = new ResizeObserver(() => draw());
    const parent = canvas.parentElement;
    if (parent) ro.observe(parent);
    // mirror master (axial) zoom changes live
    const el = masterViewport?.element;
    const onCam = () => draw();
    el?.addEventListener(cornerstone.Enums.Events.CAMERA_MODIFIED, onCam);
    return () => {
      ro.disconnect();
      el?.removeEventListener(cornerstone.Enums.Events.CAMERA_MODIFIED, onCam);
    };
  }, [sample, geom, isCoronal, crosshair.xIdx, crosshair.yIdx, sliceIdx, dose, wl.wc, wl.ww, volumeState, masterViewport, iso, structureLines]);

  /** canvas px → plane cell + slice row, via the same affine (inverse) */
  const handlePointer = (e) => {
    if (!geom || !sample || !masterViewport) return;
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const vt = viewTransform(rect);
    if (!vt) return;
    const mx = e.clientX - rect.left - vt.e;
    const my = e.clientY - rect.top - vt.f;
    if (isCoronal) {
      const xIdx = Math.max(0, Math.min(geom.cols - 1, Math.round(mx / vt.a)));
      const k = Math.max(0, Math.min(geom.numSlices - 1, Math.round(my / vt.d)));
      onCrosshairChange?.({ xIdx, sliceIdx: k });
    } else {
      const yIdx = Math.max(0, Math.min(geom.rows - 1, Math.round(mx / vt.a)));
      const k = Math.max(0, Math.min(geom.numSlices - 1, Math.round(my / vt.d)));
      onCrosshairChange?.({ yIdx: Math.max(0, Math.min(geom.rows - 1, yIdx)), sliceIdx: k });
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
