import { Box } from '@mui/material';
import { useEffect, useRef } from 'react';
import * as cornerstone from '@cornerstonejs/core';
import { projectWorldToCanvas } from '../../lib/viewportCamera.js';
import {
  beamSourcePosition,
  beamPortalCorners,
  beamCentralAxisEnds,
} from '../../lib/beamGeometry.js';

/**
 * EBRTBeamsOverlay - draws beam geometry over the CT viewport:
 *  - isocenter crosshair on every slice
 *  - on the isocenter slice: the selected beam's light-field rectangle,
 *    central axis (entrance → isocenter → exit), beam label, and for VMAT
 *    fields an arc sweep indicator between the start/stop angles
 *
 * Accepts either data source shape:
 *  - parsed RTPLAN (useRTPlan): beams with isocenterPosition objects + jawPosition
 *  - workspace plan (useEbrtPlans): DB rows with isocenterX/Y/Z + jawX1.. columns
 *
 * @param {Object} props
 * @param {Object|null} props.viewport - cornerstone viewport instance
 * @param {Object|null} props.plan - { beams: [...] } from either source
 * @param {number|null} props.selectedBeamNumber - highlighted beam
 * @param {number|null} props.ctZ - z (mm) of the displayed slice
 */
export default function EBRTBeamsOverlay({
  viewport,
  plan,
  selectedBeamNumber,
  ctZ,
}) {
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

      if (!viewport || !plan?.beams?.length || ctZ === null || ctZ === undefined) {
        return;
      }

      // Normalize both beam shapes; single shared isocenter in v1.
      // Isocenter lives on the plan for workspace rows, on beams[0] for the
      // parsed RTPLAN shape.
      const first = plan.beams[0];
      const iso = first.isocenterPosition
        ? first.isocenterPosition
        : (plan.isocenterX != null
            ? { x: plan.isocenterX, y: plan.isocenterY, z: plan.isocenterZ }
            : (first.isocenterX != null
                ? { x: first.isocenterX, y: first.isocenterY, z: first.isocenterZ }
                : null));
      if (!iso) return;

      const beams = plan.beams.map(b => {
        if (b.isocenterPosition) {
          return {
            number: b.beamNumber,
            name: b.beamName,
            iso: b.isocenterPosition,
            jaw: b.jawPosition,
            sad: b.sourceAxisDistanceMm ?? 1000,
            gantry: b.gantryAngleDeg,
            gantryStop: b.gantryArc ? b.gantryArc.end : null,
          };
        }
        return {
          number: b.beamNumber,
          name: b.name,
          iso,
          jaw: {
            x1: b.jawX1 ?? -50, x2: b.jawX2 ?? 50,
            y1: b.jawY1 ?? -50, y2: b.jawY2 ?? 50,
          },
          sad: 1000,
          gantry: b.gantryAngle ?? 0,
          gantryStop: b.beamType === 'VMAT' ? (b.gantryAngleStop ?? null) : null,
        };
      });

      const selected = beams.find(b => b.number === selectedBeamNumber) ?? null;

      // --- isocenter crosshair (every slice) ---
      const isoCanvas = projectWorldToCanvas(viewport, [iso.x, iso.y, iso.z]);
      const arm = 9;
      ctx.strokeStyle = '#f6c177';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(isoCanvas.x - arm, isoCanvas.y);
      ctx.lineTo(isoCanvas.x + arm, isoCanvas.y);
      ctx.moveTo(isoCanvas.x, isoCanvas.y - arm);
      ctx.lineTo(isoCanvas.x, isoCanvas.y + arm);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(isoCanvas.x, isoCanvas.y, 3, 0, Math.PI * 2);
      ctx.stroke();

      // --- reference points: circle + label on their own slice ---
      if (Array.isArray(plan.referencePoints)) {
        ctx.font = '10px "IBM Plex Mono", monospace';
        for (const pt of plan.referencePoints) {
          if (pt.x == null || Math.abs(ctZ - pt.z) > 1.5) continue;
          const c = projectWorldToCanvas(viewport, [pt.x, pt.y, pt.z]);
          ctx.strokeStyle = '#5cc8ff';
          ctx.lineWidth = 1.25;
          ctx.beginPath();
          ctx.arc(c.x, c.y, 5, 0, Math.PI * 2);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(c.x - 8, c.y);
          ctx.lineTo(c.x + 8, c.y);
          ctx.moveTo(c.x, c.y - 8);
          ctx.lineTo(c.x, c.y + 8);
          ctx.stroke();
          ctx.fillStyle = '#5cc8ff';
          ctx.fillText(pt.name, c.x + 10, c.y - 6);
        }
      }

      // --- selected beam geometry on the isocenter slice ---
      if (!selected || !selected.jaw) return;
      const onIsoSlice = Math.abs(ctZ - iso.z) <= 1.5;
      if (!onIsoSlice) return;

      const corners = beamPortalCorners(selected.iso, selected.jaw);
      const cornersCanvas = corners.map(p => projectWorldToCanvas(viewport, [p.x, p.y, p.z]));

      // light-field rectangle
      ctx.strokeStyle = '#f6c177';
      ctx.lineWidth = 1.75;
      ctx.beginPath();
      cornersCanvas.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
      ctx.closePath();
      ctx.stroke();

      // central axis: entrance → source → exit
      const { sourceSide, distalSide } = beamCentralAxisEnds(selected.iso, selected.sad, selected.gantry);
      const entryC = projectWorldToCanvas(viewport, [sourceSide.x, sourceSide.y, sourceSide.z]);
      const exitC = projectWorldToCanvas(viewport, [distalSide.x, distalSide.y, distalSide.z]);
      const src = beamSourcePosition(selected.iso, selected.sad, selected.gantry);
      const srcC = projectWorldToCanvas(viewport, [src.x, src.y, selected.iso.z]);
      ctx.strokeStyle = '#f6c177';
      ctx.lineWidth = 1;
      ctx.setLineDash([6, 5]);
      ctx.beginPath();
      ctx.moveTo(entryC.x, entryC.y);
      ctx.lineTo(srcC.x, srcC.y);
      ctx.lineTo(exitC.x, exitC.y);
      ctx.stroke();
      ctx.setLineDash([]);

      // VMAT arc sweep indicator
      if (selected.gantryStop != null && selected.gantryStop !== selected.gantry) {
        ctx.lineWidth = 2;
        ctx.beginPath();
        const a0 = -Math.PI / 2 + (selected.gantry * Math.PI) / 180;
        const a1 = -Math.PI / 2 + (selected.gantryStop * Math.PI) / 180;
        ctx.arc(isoCanvas.x, isoCanvas.y, 34, a0, a1, selected.gantryStop < selected.gantry);
        ctx.stroke();
      }

      // beam label
      ctx.font = '11px "IBM Plex Mono", monospace';
      ctx.fillStyle = '#f6c177';
      ctx.fillText(
        `${selected.name || 'Beam ' + selected.number}  gantry ${selected.gantry}${selected.gantryStop != null ? '→' + selected.gantryStop : ''}°`,
        isoCanvas.x + 14,
        isoCanvas.y - 12
      );
    };

    draw();
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
  }, [viewport, plan, selectedBeamNumber, ctZ]);

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
