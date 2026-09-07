import { useEffect, useMemo, useRef, useState } from 'react';
import { projectWorldToCanvas } from '../lib/viewportCamera.js';
import { patientToImagePixel } from '../modules/contouring/paintCore.js';

/**
 * RTStructSVGOverlay — draws RT Structure contours for the displayed CT
 * slice as SVG polylines.
 *
 * This is a deterministic fallback/rendering path that does not depend on
 * cornerstone's contour-segmentation representation (which has proven
 * fragile across StrictMode remounts and package upgrades). Contour data
 * comes from the already-fetched /api/rtstruct payload; coordinates are
 * transformed from patient space to image pixels to canvas via the
 * viewport camera projection.
 *
 * @param {Object} props
 * @param {Object|null} props.viewport - cornerstone viewport instance
 * @param {Array} props.contours - contourSequence from /api/rtstruct
 * @param {Object} props.structureVisibility - { [roiNumber]: boolean }
 * @param {Object|null} props.ctGeom - { imagePosition, imageOrientation, pixelSpacing, cols, rows }
 * @param {string|null} props.sopInstanceUID - SOP UID of the displayed slice
 * @param {number|null} props.ctZ - z (mm) of the displayed slice
 */
export default function RTStructSVGOverlay({
  viewport,
  contours = [],
  structureVisibility = {},
  ctGeom,
  sopInstanceUID,
  ctZ,
}) {
  // Polylines in image pixel space for the displayed slice
  const polylines = useMemo(() => {
    if (!ctGeom || !sopInstanceUID) return [];
    const out = [];
    for (const c of contours) {
      if (structureVisibility[c.referencedROINumber] === false) continue;
      if (c.referencedSOPInstanceUID !== sopInstanceUID) continue;
      const data = c.contourData || [];
      if (data.length < 6) continue;
      const pts = [];
      for (let p = 0; p < data.length; p += 3) {
        const { i, j } = patientToImagePixel([data[p], data[p + 1], data[p + 2]], ctGeom);
        if (!Number.isFinite(i) || !Number.isFinite(j)) continue;
        pts.push([i, j]);
      }
      if (pts.length >= 3) {
        out.push({
          roiNumber: c.referencedROINumber,
          color: c.displayColor
            ? `rgb(${c.displayColor.r},${c.displayColor.g},${c.displayColor.b})`
            : '#58c4dc',
          pts,
        });
      }
    }
    return out;
  }, [contours, structureVisibility, ctGeom, sopInstanceUID]);

  const svgRef = useRef(null);
  const [renderTick, setRenderTick] = useState(0);

  // Track camera changes to re-render the SVG
  useEffect(() => {
    if (!viewport) return;
    const el = viewport.element;
    const onCamera = () => setRenderTick(t => t + 1);
    const eventName = 'cornerstonecameramodified';
    // cornerstone 4.22 programmatic scroll may not fire this; parent slice
    // changes re-render via props anyway
    el?.addEventListener(eventName, onCamera);
    const ro = new ResizeObserver(onCamera);
    if (el) ro.observe(el);
    return () => {
      el?.removeEventListener(eventName, onCamera);
      ro.disconnect();
    };
  }, [viewport]);

  const paths = useMemo(() => {
    if (!viewport || !ctGeom || polylines.length === 0) return [];
    const project = (i, j) => {
      const x = ctGeom.imagePosition.x + i * ctGeom.pixelSpacing.j * ctGeom.imageOrientation.x[0] + j * ctGeom.pixelSpacing.i * ctGeom.imageOrientation.y[0];
      const y = ctGeom.imagePosition.y + i * ctGeom.pixelSpacing.j * ctGeom.imageOrientation.x[1] + j * ctGeom.pixelSpacing.i * ctGeom.imageOrientation.y[1];
      const p = projectWorldToCanvas(viewport, [x, y, ctZ ?? ctGeom.imagePosition.z]);
      return p;
    };
    return polylines.map(pl => ({
      roi: pl.roiNumber,
      color: pl.color,
      points: pl.pts.map(([i, j]) => {
        const p = project(i, j);
        return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
      }).join(' '),
    }));
    // renderTick included so camera moves redraw the SVG
  }, [polylines, viewport, ctGeom, ctZ, renderTick]);

  return (
    <svg
      ref={svgRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 3,
      }}
    >
      {paths.map((p, idx) => (
        <polyline
          key={`${p.roi}-${idx}`}
          points={p.points}
          fill="none"
          stroke={p.color}
          strokeWidth="1.5"
          strokeLinejoin="round"
          strokeLinecap="round"
          opacity="0.95"
        />
      ))}
    </svg>
  );
}

