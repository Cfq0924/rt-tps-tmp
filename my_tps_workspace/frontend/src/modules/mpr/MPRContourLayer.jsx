import { useEffect, useRef } from 'react';
import * as cornerstone from '@cornerstonejs/core';
import { Box } from '@mui/material';
import {
  sampleCoronalMask,
  sampleSagittalMask,
  maskToPolygons,
} from '../contouring/paintCore.js';
import { sliceSpacing, sampleCoronal, sampleSagittal } from '../../lib/mprVolume.js';

/**
 * MPRContourLayer — contour display + painting on a coronal/sagittal MPR plane.
 *
 * Tools: brush / eraser / floodfill / rect / crop.
 * Writes into the axial per-slice mask map via useContouring callbacks.
 *
 * Orientation (matches MPRView):
 *  coronal:  u = x col, v = slice k, planeCoord = yIdx
 *  sagittal: u = y row, v = slice k, planeCoord = xIdx
 */
export default function MPRContourLayer({
  orientation,
  geom,
  volume = null,
  masterViewport = null,
  iso = null,
  planeCoord,
  sliceIdx,
  segments = [],
  masks,
  paintVersion = 0,
  paintEnabled = false,
  tool = 'brush',
  brushSizeMm = 5,
  cropMode = 'keepInside',
  activeSegmentId = null,
  activeSegmentApproved = false,
  onPaintPlane,
  onPlaneStrokeEnd,
  onFillRectPlane,
  onCropPlane,
  onFloodFillPlane,
  huTolerance = 50,
}) {
  const canvasRef = useRef(null);
  const strokeRef = useRef(null);
  const previewRef = useRef(null);
  const drawRef = useRef(() => {});
  const isCoronal = orientation === 'coronal';
  const isBrush = tool === 'brush' || tool === 'eraser';
  const isShape = tool === 'rect' || tool === 'crop';

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
      };
    }
    return {
      a: geom.spacingY * pxPerMm,
      d: -dz * pxPerMm,
      e: cx + (geom.originY - isoPt[1]) * pxPerMm,
      f: cy - (geom.zPositions[0] - isoPt[2]) * pxPerMm,
    };
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !geom) return;

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
      const vt = viewTransform(rect);
      if (!vt) return;

      if (masks && segments.length > 0) {
        const numSlices = geom.numSlices;
        const planeWidth = isCoronal ? geom.cols : geom.rows;
        const planeHeight = numSlices;

        ctx.save();
        ctx.setTransform(vt.a * dpr, 0, 0, vt.d * dpr, vt.e * dpr, vt.f * dpr);
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';

        for (const seg of segments) {
          if (!seg.visible) continue;
          const sliceMap = masks.get(seg.id);
          if (!sliceMap) continue;
          const getSlice = (k) => sliceMap.get(k) ?? null;
          const planeMask = isCoronal
            ? sampleCoronalMask(getSlice, numSlices, geom.cols, geom.rows, planeCoord)
            : sampleSagittalMask(getSlice, numSlices, geom.cols, geom.rows, planeCoord);
          if (!planeMask.some(v => v === 1)) continue;
          const polys = maskToPolygons(planeMask, planeWidth, planeHeight, 1);
          if (polys.length === 0) continue;
          const isActive = seg.id === activeSegmentId;
          ctx.strokeStyle = seg.color;
          ctx.globalAlpha = isActive ? 1 : 0.55;
          ctx.lineWidth = (isActive ? 1.6 : 1.1) / Math.abs(vt.a || 1);
          ctx.beginPath();
          for (const poly of polys) {
            ctx.moveTo(poly[0], poly[1]);
            for (let p = 2; p < poly.length; p += 2) ctx.lineTo(poly[p], poly[p + 1]);
            ctx.closePath();
          }
          ctx.stroke();
        }
        ctx.restore();
      }

      const pv = previewRef.current;
      if (pv) {
        ctx.strokeStyle = tool === 'crop' ? '#f6c177' : '#58c4dc';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 3]);
        const x = Math.min(pv.u0, pv.u1) * vt.a + vt.e;
        const y = Math.min(pv.v0, pv.v1) * vt.d + vt.f;
        const ww = Math.abs(pv.u1 - pv.u0) * Math.abs(vt.a);
        const hh = Math.abs(pv.v1 - pv.v0) * Math.abs(vt.d);
        ctx.strokeRect(x, y, ww, hh);
        ctx.setLineDash([]);
      }
    };
    drawRef.current = draw;

    draw();
    const ro = new ResizeObserver(() => draw());
    const parent = canvas.parentElement;
    if (parent) ro.observe(parent);
    const el = masterViewport?.element;
    const onCam = () => draw();
    el?.addEventListener(cornerstone.Enums.Events.CAMERA_MODIFIED, onCam);
    return () => {
      ro.disconnect();
      el?.removeEventListener(cornerstone.Enums.Events.CAMERA_MODIFIED, onCam);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geom, segments, masks, paintVersion, planeCoord, sliceIdx, isCoronal, masterViewport, iso, activeSegmentId, tool]);

  const canvasToPlane = (clientX, clientY) => {
    const canvas = canvasRef.current;
    if (!canvas || !geom) return null;
    const rect = canvas.getBoundingClientRect();
    const vt = viewTransform(rect);
    if (!vt) return null;
    const mx = clientX - rect.left - vt.e;
    const my = clientY - rect.top - vt.f;
    return { u: mx / vt.a, v: my / vt.d };
  };

  const planeHuPixels = () => {
    if (!volume || !geom) return null;
    return isCoronal
      ? sampleCoronal(volume, geom, planeCoord).pixels
      : sampleSagittal(volume, geom, planeCoord).pixels;
  };

  const handleDown = (e) => {
    if (!paintEnabled || activeSegmentId == null || activeSegmentApproved) return;
    const pt = canvasToPlane(e.clientX, e.clientY);
    if (!pt) return;
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);

    if (isBrush) {
      strokeRef.current = { last: pt, start: pt };
      const value = tool === 'eraser' ? 0 : 1;
      onPaintPlane?.(orientation, planeCoord, { u0: pt.u, v0: pt.v, u1: pt.u, v1: pt.v }, brushSizeMm, value);
      return;
    }
    if (tool === 'floodfill') {
      const hu = planeHuPixels();
      if (hu) onFloodFillPlane?.(orientation, planeCoord, { u: pt.u, v: pt.v }, hu, huTolerance);
      return;
    }
    if (isShape) {
      strokeRef.current = { last: pt, start: pt };
      previewRef.current = { u0: pt.u, v0: pt.v, u1: pt.u, v1: pt.v };
      drawRef.current();
    }
  };

  const handleMove = (e) => {
    if (!strokeRef.current || !paintEnabled) return;
    const pt = canvasToPlane(e.clientX, e.clientY);
    if (!pt) return;
    e.stopPropagation();

    if (isBrush) {
      const last = strokeRef.current.last;
      const value = tool === 'eraser' ? 0 : 1;
      onPaintPlane?.(orientation, planeCoord, { u0: last.u, v0: last.v, u1: pt.u, v1: pt.v }, brushSizeMm, value);
      strokeRef.current.last = pt;
      return;
    }
    if (isShape) {
      const start = strokeRef.current.start;
      previewRef.current = { u0: start.u, v0: start.v, u1: pt.u, v1: pt.v };
      strokeRef.current.last = pt;
      drawRef.current();
    }
  };

  const handleUp = (e) => {
    if (!strokeRef.current) return;
    e.stopPropagation();
    const start = strokeRef.current.start;
    const last = strokeRef.current.last ?? start;
    strokeRef.current = null;
    previewRef.current = null;

    if (isShape) {
      const w = Math.abs(last.u - start.u);
      const h = Math.abs(last.v - start.v);
      if (w > 1 && h > 1) {
        const rect = { u0: start.u, v0: start.v, u1: last.u, v1: last.v };
        if (tool === 'rect') onFillRectPlane?.(orientation, planeCoord, rect, 1);
        else onCropPlane?.(orientation, planeCoord, rect, cropMode);
      }
    }
    if (isBrush) onPlaneStrokeEnd?.();
    drawRef.current();
  };

  const interactive = paintEnabled && activeSegmentId != null && !activeSegmentApproved
    && ['brush', 'eraser', 'floodfill', 'rect', 'crop'].includes(tool);

  return (
    <Box
      sx={{
        position: 'absolute', inset: 0, zIndex: 6,
        pointerEvents: paintEnabled ? 'auto' : 'none',
        cursor: interactive ? 'crosshair' : 'default',
      }}
      onPointerDown={handleDown}
      onPointerMove={handleMove}
      onPointerUp={handleUp}
      onPointerCancel={handleUp}
    >
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block', touchAction: 'none' }} />
    </Box>
  );
}
