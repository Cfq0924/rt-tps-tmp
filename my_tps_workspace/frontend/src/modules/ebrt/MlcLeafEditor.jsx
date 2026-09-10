import { useEffect, useRef, useState } from 'react';
import { Box, Typography, Slider } from '@mui/material';

/**
 * MlcLeafEditor — BEV canvas of MLC leaf pairs (X jaws horizontal).
 *
 * leafPairs: [{x1, x2}] in mm (x1 left bank, x2 right bank; x1 may exceed x2 = crossed).
 * Editing: drag a leaf edge horizontally. onChange(leafPairs) fires on commit.
 */
export default function MlcLeafEditor({
  leafPairs = [],
  width = 220,
  height = 160,
  readOnly = false,
  onChange,
  label = 'MLC',
}) {
  const canvasRef = useRef(null);
  const [hover, setHover] = useState(null); // {index, edge: 'x1'|'x2'}
  const dragRef = useRef(null);
  const pairsRef = useRef(leafPairs);
  pairsRef.current = leafPairs;

  // mm → canvas: x in [-200,200], y by leaf index
  const LEAF_MM = 200;
  const PAD = 8;

  const mmToX = (mm, w) => PAD + ((mm + LEAF_MM) / (2 * LEAF_MM)) * (w - 2 * PAD);
  const xToMm = (x, w) => ((x - PAD) / (w - 2 * PAD)) * 2 * LEAF_MM - LEAF_MM;
  const leafY = (i, n, h) => PAD + (i / Math.max(1, n)) * (h - 2 * PAD);
  const leafH = (n, h) => Math.max(2, ((h - 2 * PAD) / Math.max(1, n)) - 1);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    // field background
    ctx.fillStyle = 'rgba(7,17,31,0.9)';
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = 'rgba(88,196,220,0.25)';
    ctx.strokeRect(PAD, PAD, width - 2 * PAD, height - 2 * PAD);

    // centre line
    ctx.strokeStyle = 'rgba(88,196,220,0.2)';
    ctx.beginPath();
    ctx.moveTo(mmToX(0, width), PAD);
    ctx.lineTo(mmToX(0, width), height - PAD);
    ctx.stroke();

    const n = pairsRef.current.length;
    const lh = leafH(n, height);
    pairsRef.current.forEach((p, i) => {
      const y = leafY(i, n, height);
      const xa = mmToX(Math.min(p.x1, p.x2), width);
      const xb = mmToX(Math.max(p.x1, p.x2), width);
      const open = Math.abs(p.x2 - p.x1);
      const isHover = hover?.index === i;
      // open aperture (between banks)
      ctx.fillStyle = open > 0.5
        ? (isHover ? 'rgba(88,196,220,0.35)' : 'rgba(88,196,220,0.18)')
        : 'rgba(224,108,117,0.15)';
      ctx.fillRect(xa, y, Math.max(1, xb - xa), lh);
      // leaf banks
      ctx.fillStyle = isHover ? '#58c4dc' : 'rgba(156,200,216,0.75)';
      // left bank (x1) as a thick tick at x1
      const hx1 = mmToX(p.x1, width);
      const hx2 = mmToX(p.x2, width);
      ctx.fillRect(hx1 - 1.5, y, 3, lh);
      ctx.fillRect(hx2 - 1.5, y, 3, lh);
      if (isHover) {
        ctx.strokeStyle = '#f6c177';
        ctx.strokeRect(Math.min(hx1, hx2) - 2, y - 0.5, Math.abs(hx2 - hx1) + 4, lh + 1);
      }
    });

    ctx.fillStyle = 'rgba(148,163,184,0.9)';
    ctx.font = '9px "IBM Plex Mono", monospace';
    ctx.fillText(label, 4, 10);
    ctx.fillText(`${n} pairs`, width - 48, 10);
  }, [leafPairs, hover, width, height, label]);

  const hitTest = (clientX, clientY) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const n = pairsRef.current.length;
    if (n === 0) return null;
    const i = Math.floor(((y - PAD) / (height - 2 * PAD)) * n);
    if (i < 0 || i >= n) return null;
    const p = pairsRef.current[i];
    const hx1 = mmToX(p.x1, width);
    const hx2 = mmToX(p.x2, width);
    const edge = Math.abs(x - hx1) <= Math.abs(x - hx2) ? 'x1' : 'x2';
    const hx = edge === 'x1' ? hx1 : hx2;
    if (Math.abs(x - hx) > 10) return null;
    return { index: i, edge };
  };

  const onPointerDown = (e) => {
    if (readOnly) return;
    const hit = hitTest(e.clientX, e.clientY);
    if (!hit) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = hit;
    setHover(hit);
  };

  const onPointerMove = (e) => {
    if (readOnly) return;
    if (dragRef.current) {
      const canvas = canvasRef.current;
      const rect = canvas.getBoundingClientRect();
      const mm = Math.max(-LEAF_MM, Math.min(LEAF_MM, xToMm(e.clientX - rect.left, width)));
      const next = pairsRef.current.map((p, i) => {
        if (i !== dragRef.current.index) return p;
        const rounded = Math.round(mm * 10) / 10;
        return dragRef.current.edge === 'x1' ? { ...p, x1: rounded } : { ...p, x2: rounded };
      });
      onChange?.(next);
      return;
    }
    setHover(hitTest(e.clientX, e.clientY));
  };

  const onPointerUp = () => {
    dragRef.current = null;
  };

  return (
    <Box sx={{ width }}>
      <canvas
        ref={canvasRef}
        style={{ width, height, display: 'block', cursor: readOnly ? 'default' : 'ew-resize', borderRadius: 2 }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={() => { if (!dragRef.current) setHover(null); }}
        aria-label={`${label}-leaf-editor`}
      />
      <Typography variant="caption" sx={{ fontSize: '0.55rem', color: 'text.disabled', fontFamily: 'mono' }}>
        drag leaf banks · ±200 mm · {leafPairs.length ? `L0 ${leafPairs[0].x1}/${leafPairs[0].x2}` : 'empty'}
        {leafPairs.length > 1 ? ` … L${leafPairs.length - 1} ${leafPairs[leafPairs.length - 1].x1}/${leafPairs[leafPairs.length - 1].x2}` : ''}
      </Typography>
    </Box>
  );
}

/**
 * Build a simple rectangular MLC opening from jaws (mm).
 * Jaw half-widths xHalf/yHalf define the aperture; leaf banks sit at ±xHalf.
 */
export function rectMlcFromJaws(leafPairCount, xHalfMm, yHalfMm) {
  const n = leafPairCount || 60;
  const x1 = -Math.abs(xHalfMm);
  const x2 = Math.abs(xHalfMm);
  return {
    type: 'MLCX',
    leafPairs: Array.from({ length: n }, () => ({ x1, x2 })),
  };
}
