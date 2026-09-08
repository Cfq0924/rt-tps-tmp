import { Box } from '@mui/material';
import { useEffect, useRef } from 'react';
import * as cornerstone from '@cornerstonejs/core';
import { projectWorldToCanvas, canvasToPlanePoint } from '../../lib/viewportCamera.js';

/**
 * DoseProbeOverlay - evaluation-module point dose tool.
 *
 * When enabled, captures clicks on the viewport and reports the picked
 * patient-space point; always draws the current probe marker (crosshair +
 * dose label) on the displayed plane. Disabled by default so the standard
 * cornerstone tools (pan/zoom/WL) keep working — mirrors Eclipse's
 * dedicated Point Dose tool.
 *
 * @param {Object} props
 * @param {boolean} props.enabled - capture pointer events
 * @param {Object|null} props.viewport - cornerstone viewport instance
 * @param {number|null} props.ctZ - patient z of the displayed slice
 * @param {Object|null} props.doseProbe - { point: [x,y,z], doseCgy: number|null, pctRx: number|null }
 * @param {Function} props.onPointPick - (patientPoint [x,y,z]) => void
 */
export default function DoseProbeOverlay({
  enabled,
  viewport,
  ctZ,
  doseProbe,
  onPointPick,
}) {
  const canvasRef = useRef(null);

  // draw the probe marker
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
      if (!viewport || !doseProbe?.point) return;

      const [x, y, z] = doseProbe.point;
      // marker lives on its own slice — draw only when that slice is shown
      if (ctZ != null && Math.abs(ctZ - z) > 1.5) return;
      const c = projectWorldToCanvas(viewport, [x, y, z]);

      const arm = 9;
      ctx.strokeStyle = '#9ae66e';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(c.x - arm, c.y);
      ctx.lineTo(c.x + arm, c.y);
      ctx.moveTo(c.x, c.y - arm);
      ctx.lineTo(c.x, c.y + arm);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(c.x, c.y, 3, 0, Math.PI * 2);
      ctx.stroke();

      if (doseProbe.doseCgy != null) {
        ctx.font = '11px "IBM Plex Mono", monospace';
        ctx.fillStyle = '#9ae66e';
        const pct = doseProbe.pctRx != null ? ` (${doseProbe.pctRx.toFixed(0)}% Rx)` : '';
        ctx.fillText(`${doseProbe.doseCgy.toFixed(0)} cGy${pct}`, c.x + 14, c.y - 10);
      }
    };

    draw();
    const el = viewport?.element;
    const onCameraModified = () => draw();
    el?.addEventListener(cornerstone.Enums.Events.CAMERA_MODIFIED, onCameraModified);
    const ro = new ResizeObserver(() => draw());
    if (el) ro.observe(el);
    return () => {
      el?.removeEventListener(cornerstone.Enums.Events.CAMERA_MODIFIED, onCameraModified);
      ro.disconnect();
    };
  }, [viewport, doseProbe, ctZ]);

  // pointer capture
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !enabled) return;

    const onPointerDown = (e) => {
      if (!viewport) return;
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const world = canvasToPlanePoint(viewport, e.clientX - rect.left, e.clientY - rect.top, ctZ);
      onPointPick?.(world);
    };
    canvas.addEventListener('pointerdown', onPointerDown);
    return () => canvas.removeEventListener('pointerdown', onPointerDown);
  }, [enabled, viewport, ctZ, onPointPick]);

  return (
    <Box
      sx={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 4,
        pointerEvents: enabled ? 'auto' : 'none',
        cursor: enabled ? 'crosshair' : 'default',
      }}
    >
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: '100%', display: 'block', touchAction: 'none' }}
      />
    </Box>
  );
}
