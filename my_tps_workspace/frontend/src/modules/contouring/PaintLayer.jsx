import { Box } from '@mui/material';
import { useEffect, useRef } from 'react';
import * as cornerstone from '@cornerstonejs/core';
import { projectWorldToCanvas, canvasToPlanePoint } from '../../lib/viewportCamera.js';
import {
  stampLine,
  fillRect,
  fillEllipse,
  maskToPolygons,
  patientToImagePixel,
} from './paintCore.js';

const TOOLS = { BRUSH: 'brush', ERASER: 'eraser', RECT: 'rect', CIRCLE: 'circle' };

/**
 * PaintLayer - interactive canvas for the contouring module.
 *
 * Sits above the cornerstone viewport (pointer-events enabled only in
 * contouring mode). Painting writes into the active segment's per-slice mask
 * (mutated in place through callbacks), and the layer renders every visible
 * segment's contours for the displayed slice via marching squares.
 *
 * @param {Object} props
 * @param {boolean} props.enabled - capture pointer events (contouring mode)
 * @param {Object|null} props.viewport - cornerstone viewport instance
 * @param {number} props.sliceIdx - current slice index
 * @param {number} props.ctZ - z (mm) of the displayed slice
 * @param {Object} props.ctGeom - CT geometry {imagePosition, imageOrientation, pixelSpacing, cols, rows}
 * @param {Map<number, Uint8Array>} props.masks - segmentId → per-slice mask map (mutated in place)
 * @param {Array<{id:number,name:string,color:string,visible:boolean}>} props.segments
 * @param {number|null} props.activeSegmentId
 * @param {string} props.tool - 'brush' | 'eraser' | 'rect' | 'circle'
 * @param {number} props.brushSizeMm - brush diameter in mm
 * @param {number} props.paintVersion - bump to force a redraw after external mask changes
 * @param {Function} props.onStrokeStart - (sliceIdx) => void (snapshot for undo)
 * @param {Function} props.onStrokeEnd - () => void (bump version)
 */
export default function PaintLayer({
  enabled,
  viewport,
  sliceIdx,
  ctZ,
  ctGeom,
  masks,
  segments,
  activeSegmentId,
  tool,
  brushSizeMm,
  paintVersion,
  onStrokeStart,
  onStrokeEnd,
}) {
  const canvasRef = useRef(null);
  const drawingRef = useRef(null); // { lastImg: {i,j}, startImg: {i,j} }

  // Convert canvas CSS coordinates → CT image pixel coordinates
  const canvasToImage = (clientX, clientY) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const world = canvasToPlanePoint(viewport, clientX - rect.left, clientY - rect.top, ctZ);
    return patientToImagePixel(world, ctGeom);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      const rect = canvas.parentElement.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
    };
    resize();

    // ---------- painting (pointer) ----------
    const valueForTool = () => (tool === TOOLS.ERASER ? 0 : 1);
    const radiusPx = () => {
      // brush diameter in mm → radius in image px
      const spacing = ctGeom.pixelSpacing.j || 1; // mm per column px
      return Math.max(1, (brushSizeMm / 2) / spacing);
    };

    const getMask = () => {
      if (activeSegmentId == null) return null;
      if (!masks.has(activeSegmentId)) masks.set(activeSegmentId, new Map());
      const sliceMap = masks.get(activeSegmentId);
      if (!sliceMap.has(sliceIdx)) sliceMap.set(sliceIdx, new Uint8Array(ctGeom.cols * ctGeom.rows));
      return sliceMap.get(sliceIdx);
    };

    const applyAt = (img) => {
      const mask = getMask();
      if (!mask) return;
      const value = valueForTool();
      if ((tool === TOOLS.RECT || tool === TOOLS.CIRCLE) && drawingRef.current?.startImg) {
        // shape preview: restore the pre-stroke snapshot, then fill the
        // current bounding shape (so dragging in/out updates cleanly)
        const pre = drawingRef.current.preStroke;
        if (pre) mask.set(pre);
        if (tool === TOOLS.RECT) {
          fillRect(mask, ctGeom.cols, ctGeom.rows,
            drawingRef.current.startImg.i, drawingRef.current.startImg.j, img.i, img.j, value);
        } else {
          fillEllipse(mask, ctGeom.cols, ctGeom.rows,
            drawingRef.current.startImg.i, drawingRef.current.startImg.j, img.i, img.j, value);
        }
      } else {
        const prev = drawingRef.current?.lastImg ?? img;
        stampLine(mask, ctGeom.cols, ctGeom.rows, prev.i, prev.j, img.i, img.j, radiusPx(), value);
      }
    };

    const onPointerDown = (e) => {
      if (!enabled || activeSegmentId == null || !ctGeom) return;
      e.preventDefault();
      canvas.setPointerCapture(e.pointerId);
      const img = canvasToImage(e.clientX, e.clientY);
      const mask = getMask();
      drawingRef.current = {
        lastImg: img,
        startImg: { ...img },
        // shape tools preview from a snapshot so dragging in/out works
        preStroke: (tool === TOOLS.RECT || tool === TOOLS.CIRCLE) && mask ? mask.slice() : null,
      };
      onStrokeStart?.(sliceIdx);
      if (tool === TOOLS.BRUSH || tool === TOOLS.ERASER) {
        applyAt(img);
      }
    };

    const onPointerMove = (e) => {
      if (!drawingRef.current) return;
      const img = canvasToImage(e.clientX, e.clientY);
      applyAt(img);
      drawingRef.current.lastImg = img;
      onStrokeEnd?.(); // repaint (does not clear undo)
    };

    const onPointerUp = (e) => {
      if (!drawingRef.current) return;
      // final apply for shape tools (drag preview already wrote, this is the commit)
      const img = canvasToImage(e.clientX, e.clientY);
      if (tool === TOOLS.RECT || tool === TOOLS.CIRCLE) applyAt(img);
      drawingRef.current = null;
      onStrokeEnd?.();
    };

    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointercancel', onPointerUp);

    // Slice navigation: the paint layer intercepts pointer events, so wheel
    // scrolling must be forwarded to the viewport explicitly
    const onWheel = (e) => {
      if (!enabled || !viewport) return;
      e.preventDefault();
      viewport.scroll(e.deltaY > 0 ? 1 : -1, false);
    };
    canvas.addEventListener('wheel', onWheel, { passive: false });

    return () => {
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerUp);
      canvas.removeEventListener('wheel', onWheel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, viewport, sliceIdx, ctZ, ctGeom, segments, activeSegmentId, tool, brushSizeMm]);

  // ---------- render contours ----------
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
      if (!viewport || !ctGeom) return;

      // Affine: CT image pixel space → canvas
      const p0 = projectWorldToCanvas(viewport, [ctGeom.imagePosition.x, ctGeom.imagePosition.y, ctZ]);
      const p1 = projectWorldToCanvas(viewport, [
        ctGeom.imagePosition.x + ctGeom.cols * ctGeom.pixelSpacing.j,
        ctGeom.imagePosition.y,
        ctZ,
      ]);
      const p2 = projectWorldToCanvas(viewport, [
        ctGeom.imagePosition.x,
        ctGeom.imagePosition.y + ctGeom.rows * ctGeom.pixelSpacing.i,
        ctZ,
      ]);
      const a = (p1.x - p0.x) / ctGeom.cols;
      const b = (p1.y - p0.y) / ctGeom.cols;
      const c = (p2.x - p0.x) / ctGeom.rows;
      const d = (p2.y - p0.y) / ctGeom.rows;
      const e = p0.x, f = p0.y;
      if (![a, b, c, d, e, f].every(Number.isFinite)) return;
      const avgScale = (Math.abs(a) + Math.abs(d)) / 2;

      ctx.save();
      ctx.setTransform(a * dpr, b * dpr, c * dpr, d * dpr, e * dpr, f * dpr);
      ctx.lineWidth = 1.5 / avgScale;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';

      for (const seg of segments) {
        if (!seg.visible) continue;
        const sliceMap = masks.get(seg.id);
        const mask = sliceMap?.get(sliceIdx);
        if (!mask) continue;
        const isActive = seg.id === activeSegmentId;
        const polys = maskToPolygons(mask, ctGeom.cols, ctGeom.rows, 1);
        if (polys.length === 0) continue;
        ctx.strokeStyle = seg.color;
        ctx.globalAlpha = isActive ? 1 : 0.6;
        ctx.lineWidth = (isActive ? 2 : 1.25) / avgScale;
        ctx.beginPath();
        for (const poly of polys) {
          ctx.moveTo(poly[0], poly[1]);
          for (let p = 2; p < poly.length; p += 2) {
            ctx.lineTo(poly[p], poly[p + 1]);
          }
          ctx.closePath();
        }
        ctx.stroke();
      }
      ctx.restore();
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
  }, [viewport, ctGeom, ctZ, sliceIdx, masks, segments, activeSegmentId, paintVersion]);

  return (
    <Box
      sx={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 5,
        pointerEvents: enabled ? 'auto' : 'none',
        cursor: enabled && activeSegmentId != null ? 'crosshair' : 'default',
      }}
    >
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: '100%', display: 'block', touchAction: 'none' }}
      />
    </Box>
  );
}
