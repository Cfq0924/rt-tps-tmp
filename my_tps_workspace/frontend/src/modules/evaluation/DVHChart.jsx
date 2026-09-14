import { useEffect, useRef, useState } from 'react';
import { Box } from '@mui/material';

/**
 * DVHChart - large cumulative DVH canvas with nice axis ticks, gridlines,
 * curve legend, and a hover crosshair that reads each curve's remaining
 * volume at the hovered dose (Eclipse-style).
 *
 * @param {Object} props
 * @param {Array} props.results - [{ key, name, color, dvh: {cumulative, totalCount, binWidth}, stats }]
 * @param {number|null} props.prescriptionCgy - draws an Rx reference line
 */
export default function DVHChart({ results = [], prescriptionCgy = null }) {
  const canvasRef = useRef(null);
  const [hoverX, setHoverX] = useState(null); // css px within canvas
  const hoverRef = useRef(null);
  const rafRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const draw = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const dpr = window.devicePixelRatio || 1;
      const rect = parent.getBoundingClientRect();
      const w = Math.round(rect.width * dpr);
      const h = Math.round((rect.height) * dpr);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      const ctx = canvas.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, rect.width, rect.height);

      const cssW = rect.width, cssH = rect.height;
      const padL = 46, padB = 34, padT = 18, padR = 14;
      const plotW = cssW - padL - padR;
      const plotH = cssH - padB - padT;

      // axes frame + gridlines
      ctx.strokeStyle = 'rgba(88,196,220,0.35)';
      ctx.lineWidth = 1;
      ctx.strokeRect(padL, padT, plotW, plotH);
      ctx.font = '10px "IBM Plex Mono", monospace';
      ctx.fillStyle = 'rgba(148,163,184,0.9)';

      // y ticks: 0/10/.../100 %
      ctx.textAlign = 'right';
      for (let p = 0; p <= 100; p += 10) {
        const y = padT + plotH * (1 - p / 100);
        if (p > 0 && p < 100) {
          ctx.strokeStyle = 'rgba(88,196,220,0.10)';
          ctx.beginPath();
          ctx.moveTo(padL, y);
          ctx.lineTo(padL + plotW, y);
          ctx.stroke();
        }
        ctx.fillText(`${p}`, padL - 6, y + 3);
      }

      // x scale: max dose over curves, rounded up to a nice step
      const xMaxRaw = Math.max(...results.map(r => {
        const { binCenters, binWidth } = r.dvh;
        return binCenters.length ? binCenters[binCenters.length - 1] + binWidth : 0;
      }), 1);
      const niceStep = (range, target) => {
        const raw = range / target;
        const mag = Math.pow(10, Math.floor(Math.log10(raw)));
        for (const m of [1, 2, 2.5, 5, 10]) if (raw <= m * mag) return m * mag;
        return 10 * mag;
      };
      const step = niceStep(xMaxRaw, 6);
      const xMax = Math.ceil(xMaxRaw / step) * step;
      // label from the index (never d += step) — avoids float artifacts like
      // 0.6000000000000001 on the axis
      const tickLabel = (v) => String(parseFloat(v.toFixed(3)));
      ctx.textAlign = 'center';
      for (let i = 0; i * step <= xMax + step * 1e-6; i++) {
        const d = i * step;
        const x = padL + (d / xMax) * plotW;
        if (d > 0) {
          ctx.strokeStyle = 'rgba(88,196,220,0.10)';
          ctx.beginPath();
          ctx.moveTo(x, padT);
          ctx.lineTo(x, padT + plotH);
          ctx.stroke();
        }
        ctx.fillText(tickLabel(d), x, cssH - padB + 14);
      }
      ctx.fillText('Dose (cGy)', padL + plotW / 2, cssH - 6);
      ctx.save();
      ctx.translate(10, padT + plotH / 2 + 8);
      ctx.rotate(-Math.PI / 2);
      ctx.fillText('Volume (%)', 0, 0);
      ctx.restore();

      // prescription reference line
      if (prescriptionCgy && prescriptionCgy <= xMax) {
        const x = padL + (prescriptionCgy / xMax) * plotW;
        ctx.strokeStyle = 'rgba(246,193,119,0.6)';
        ctx.setLineDash([5, 4]);
        ctx.beginPath();
        ctx.moveTo(x, padT);
        ctx.lineTo(x, padT + plotH);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = 'rgba(246,193,119,0.9)';
        ctx.textAlign = 'left';
        ctx.fillText('Rx', x + 4, padT + 10);
      }

      // curves
      for (const r of results) {
        const { cumulative, totalCount, binWidth: bw } = r.dvh;
        if (!totalCount) continue;
        ctx.strokeStyle = r.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let b = 0; b < cumulative.length; b++) {
          const x = padL + ((b * bw) / xMax) * plotW;
          const y = padT + plotH - (cumulative[b] / totalCount) * plotH;
          b === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.stroke();
      }

      // hover crosshair + per-curve readout
      if (hoverRef.current != null && results.length > 0) {
        const mx = hoverRef.current;
        if (mx >= padL && mx <= padL + plotW) {
          const doseAt = ((mx - padL) / plotW) * xMax;
          ctx.strokeStyle = 'rgba(255,255,255,0.35)';
          ctx.setLineDash([4, 3]);
          ctx.beginPath();
          ctx.moveTo(mx, padT);
          ctx.lineTo(mx, padT + plotH);
          ctx.stroke();
          ctx.setLineDash([]);

          ctx.textAlign = 'left';
          let labelY = padT + 14;
          for (const r of results) {
            const { cumulative, totalCount: total, binWidth: bw } = r.dvh;
            if (!total) continue;
            const bi = Math.max(0, Math.min(cumulative.length - 1, Math.floor(doseAt / bw)));
            const pct = (cumulative[bi] / total) * 100;
            const y = padT + plotH - (cumulative[bi] / total) * plotH;
            ctx.fillStyle = r.color;
            ctx.beginPath();
            ctx.arc(mx, y, 3, 0, Math.PI * 2);
            ctx.fill();
            const label = `${r.name.length > 14 ? r.name.slice(0, 13) + '…' : r.name} ${pct.toFixed(1)}%`;
            const lw = ctx.measureText(label).width;
            const lx = Math.min(mx + 8, padL + plotW - lw - 4);
            ctx.fillText(label, lx, labelY);
            labelY += 13;
          }
        }
      }
    };

    draw();
    const ro = new ResizeObserver(() => draw());
    const parent = canvas.parentElement;
    if (parent) ro.observe(parent);
    return () => ro.disconnect();
  }, [results, prescriptionCgy, hoverX]);

  const onMove = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => setHoverX(e.clientX - rect.left));
  };

  return (
    <Box sx={{ width: '100%', height: '100%', minHeight: 300, position: 'relative' }}>
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: '100%', display: 'block', cursor: 'crosshair' }}
        onMouseMove={onMove}
        onMouseLeave={() => { setHoverX(null); }}
      />
    </Box>
  );
}
