import { useEffect, useRef } from 'react';
import * as cornerstone from '@cornerstonejs/core';
import { Box } from '@mui/material';
import { projectWorldToCanvas } from '../../lib/viewportCamera.js';
import { imagePixelToPatient } from '../contouring/paintCore.js';

/**
 * AxialCrosshairOverlay - crosshair reference lines on the axial viewport
 * for the EBRT quad layout: dashed lines through the crosshair voxel plus
 * T-shaped position markers at the pane edge midpoints (Eclipse style).
 *
 * @param {Object} props
 * @param {Object|null} props.viewport - cornerstone viewport
 * @param {Object|null} props.ctGeom - geometry of the displayed slice
 * @param {number|null} props.ctZ - patient z of the displayed slice
 * @param {{xIdx:number, yIdx:number}} props.crosshair
 */
export default function AxialCrosshairOverlay({ viewport, ctGeom, ctZ, crosshair }) {
  const canvasRef = useRef(null);

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
      if (!viewport || !ctGeom || ctZ == null || !crosshair) return;

      // project the crosshair voxel centre to canvas
      const p = imagePixelToPatient(crosshair.xIdx, crosshair.yIdx, ctZ, ctGeom);
      const c = projectWorldToCanvas(viewport, p);
      if (!Number.isFinite(c.x) || !Number.isFinite(c.y)) return;

      // dashed reference lines through the crosshair
      ctx.strokeStyle = 'rgba(88,196,220,0.75)';
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.moveTo(0, c.y);
      ctx.lineTo(rect.width, c.y);
      ctx.moveTo(c.x, 0);
      ctx.lineTo(c.x, rect.height);
      ctx.stroke();
      ctx.setLineDash([]);

      // T-shaped position markers at the four edge midpoints
      ctx.fillStyle = 'rgba(158,230,110,0.9)';
      const T = 9, bar = 3;
      // top / bottom (vertical marker: horizontal bar + stem)
      ctx.fillRect(rect.width / 2 - T / 2, 0, T, bar);
      ctx.fillRect(rect.width / 2 - bar / 2, 0, bar, T);
      ctx.fillRect(rect.width / 2 - T / 2, rect.height - bar, T, bar);
      ctx.fillRect(rect.width / 2 - bar / 2, rect.height - T, bar, T);
      // left / right (horizontal marker: vertical bar + stem)
      ctx.fillRect(0, rect.height / 2 - T / 2, bar, T);
      ctx.fillRect(0, rect.height / 2 - bar / 2, T, bar);
      ctx.fillRect(rect.width - bar, rect.height / 2 - T / 2, bar, T);
      ctx.fillRect(rect.width - T, rect.height / 2 - bar / 2, T, bar);
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
  }, [viewport, ctGeom, ctZ, crosshair]);

  return (
    <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 6, pointerEvents: 'none' }}>
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block' }} />
    </Box>
  );
}
