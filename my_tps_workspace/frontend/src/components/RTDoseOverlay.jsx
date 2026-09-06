import { Box } from '@mui/material';
import { useEffect, useRef } from 'react';
import * as cornerstone from '@cornerstonejs/core';
import {
  computeDoseCanvasTransform,
  doseFrameIndexForZ,
  applyColormapLUT,
  extractIsolineSegments,
} from '../lib/doseTransform.js';

/**
 * RTDoseOverlay - canvas overlay rendering the dose heat map for the
 * currently displayed CT slice.
 *
 * The overlay is a transparent 2D canvas stacked over the cornerstone
 * viewport element. Dose → canvas alignment is resolved per draw via the
 * camera projection, so the heat map tracks pan/zoom/window changes.
 *
 * @param {Object} props
 * @param {Object|null} props.viewport - cornerstone viewport instance (null until ready)
 * @param {Float32Array|null} props.grid - dose grid (cGy, frame-major), null until loaded
 * @param {Object|null} props.doseMeta - dose metadata (imagePosition, imageOrientation, pixelSpacing, gridFrameOffsetVector, maxDose…)
 * @param {number|null} props.ctZ - z (mm) of the currently displayed CT slice
 * @param {boolean} props.visible
 * @param {number} props.opacity - 0..1 multiplier on the colormap alpha
 * @param {number} props.threshold - percent of maxDose below which dose is hidden
 * @param {Array<{id:number,pct:number,visible:boolean,color:string}>} props.isodoseLevels - user-editable iso line levels (% of maxDose)
 */
export default function RTDoseOverlay({
  viewport,
  grid,
  doseMeta,
  ctZ,
  visible,
  opacity,
  threshold,
  isodoseLevels = [],
}) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const draw = () => {
      const parent = canvas.parentElement;
      if (!parent) return;

      const rect = parent.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const w = Math.round(rect.width * dpr);
      const h = Math.round(rect.height * dpr);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      const ctx = canvas.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, rect.width, rect.height);

      if (!visible || !viewport || !grid || !doseMeta || ctZ === null || ctZ === undefined) {
        return;
      }

      const geom = {
        imagePosition: doseMeta.imagePosition,
        imageOrientation: doseMeta.imageOrientation,
        pixelSpacing: doseMeta.pixelSpacing,
        gridFrameOffsetVector: doseMeta.gridFrameOffsetVector,
        _cols: doseMeta.columns,
        _rows: doseMeta.rows,
      };

      // The CT slice must sit inside the dose z range
      const k = doseFrameIndexForZ(
        doseMeta.gridFrameOffsetVector,
        doseMeta.imagePosition.z,
        ctZ,
        2.0, // half of the 3mm frame spacing — outside means "no dose here"
      );
      if (k === null) return;

      const transform = computeDoseCanvasTransform(viewport, geom, ctZ, 2.0);
      if (!transform) return;

      const voxelsPerFrame = doseMeta.rows * doseMeta.columns;
      const frame = grid.subarray(k * voxelsPerFrame, (k + 1) * voxelsPerFrame);
      const rgba = applyColormapLUT(frame, {
        maxDose: doseMeta.maxDose,
        thresholdPct: threshold,
      });

      // Paint the dose frame into an offscreen canvas sized to the grid
      const off = document.createElement('canvas');
      off.width = doseMeta.columns;
      off.height = doseMeta.rows;
      const offCtx = off.getContext('2d');
      const imageData = new ImageData(rgba, doseMeta.columns, doseMeta.rows);
      offCtx.putImageData(imageData, 0, 0);

      // Draw the grid plane onto the viewport canvas via the affine transform
      ctx.save();
      ctx.globalAlpha = opacity;
      ctx.imageSmoothingEnabled = true;
      ctx.setTransform(
        transform.a * dpr, transform.b * dpr,
        transform.c * dpr, transform.d * dpr,
        transform.e * dpr, transform.f * dpr,
      );
      ctx.drawImage(off, 0, 0);
      ctx.restore();

      // Isodose lines: stroke in grid space so the affine transform maps them
      // onto the CT slice; width compensated to stay ~1.5 screen px
      if (isodoseLevels?.length) {
        const avgScale = (Math.abs(transform.a) + Math.abs(transform.d)) / 2;
        const gridLineWidth = avgScale > 0 ? 1.5 / avgScale : 1.5;
        ctx.save();
        ctx.globalAlpha = 1;
        ctx.setTransform(
          transform.a * dpr, transform.b * dpr,
          transform.c * dpr, transform.d * dpr,
          transform.e * dpr, transform.f * dpr,
        );
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        for (const lvl of isodoseLevels) {
          if (!lvl.visible || !(lvl.pct > 0)) continue;
          const levelAbs = (lvl.pct / 100) * doseMeta.maxDose;
          const segs = extractIsolineSegments(frame, doseMeta.columns, doseMeta.rows, levelAbs);
          if (segs.length === 0) continue;
          ctx.strokeStyle = lvl.color;
          ctx.lineWidth = gridLineWidth;
          ctx.beginPath();
          for (const s of segs) {
            ctx.moveTo(s.x1, s.y1);
            ctx.lineTo(s.x2, s.y2);
          }
          ctx.stroke();
        }
        ctx.restore();
      }
    };

    draw();

    // Redraw when the underlying view changes (scroll/pan/zoom) or resize
    const el = viewport?.element;
    const onCameraModified = () => draw();
    const eventName = cornerstone.Enums.Events.CAMERA_MODIFIED;
    el?.addEventListener(eventName, onCameraModified);
    const ro = new ResizeObserver(() => draw());
    if (el) ro.observe(el);

    return () => {
      el?.removeEventListener(eventName, onCameraModified);
      ro.disconnect();
    };
  }, [viewport, grid, doseMeta, ctZ, visible, opacity, threshold, isodoseLevels]);

  return (
    <Box
      sx={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        pointerEvents: 'none',
        zIndex: 4,
      }}
    >
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: '100%', display: 'block' }}
      />
    </Box>
  );
}
