import { useEffect, useRef, useCallback } from 'react';

/**
 * RTStructureOverlay - Renders RT Structure contours on Cornerstone viewport
 *
 * @param {Object} props
 * @param {Object} props.element - Cornerstone viewport element
 * @param {Array} props.contours - Array of contour objects for current slice
 * @param {Object} props.viewport - Cornerstone viewport instance
 * @param {boolean} props.visible - Whether overlay should be rendered
 */
export default function RTStructureOverlay({ element, contours, viewport, visible }) {
  const canvasRef = useRef(null);

  const drawContours = useCallback(() => {
    if (!canvasRef.current || !element || !contours || contours.length === 0) {
      return;
    }

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    // Set canvas size to match element
    const rect = element.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    if (canvas.width !== rect.width * dpr || canvas.height !== rect.height * dpr) {
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
    }

    // Clear canvas
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, rect.width, rect.height);

    if (!visible) {
      return;
    }

    // Draw each contour
    for (const contour of contours) {
      drawContour(ctx, contour, viewport, element);
    }
  }, [element, contours, viewport, visible]);

  useEffect(() => {
    drawContours();

    // Redraw on window resize
    window.addEventListener('resize', drawContours);
    return () => window.removeEventListener('resize', drawContours);
  }, [drawContours]);

  if (!element || !visible) {
    return null;
  }

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        pointerEvents: 'none',
        zIndex: 5,
      }}
    />
  );
}

/**
 * Draw a single contour on the canvas
 */
function drawContour(ctx, contour, viewport, element) {
  if (!contour.points || contour.points.length < 3) {
    return;
  }

  const color = contour.color || { r: 255, g: 255, b: 255 };

  // Contour data is flat array of x,y,z triplets
  // We only need x,y for 2D display
  const points = [];
  for (let i = 0; i < contour.points.length; i += 3) {
    const x = contour.points[i];
    const y = contour.points[i + 1];
    const z = contour.points[i + 2];
    points.push({ x, y, z });
  }

  if (points.length < 3) {
    return;
  }

  ctx.save();
  ctx.beginPath();

  // Convert world coordinates to canvas pixel coordinates
  for (let i = 0; i < points.length; i++) {
    const pt = points[i];

    // Use Cornerstone pixelToCanvas to convert world coords to canvas
    let canvasPoint;
    try {
      if (viewport && viewport.pixelToCanvas) {
        canvasPoint = viewport.pixelToCanvas([pt.x, pt.y, pt.z]);
      } else {
        // Fallback: assume points are already in pixel coordinates
        canvasPoint = { x: pt.x, y: pt.y };
      }
    } catch (e) {
      canvasPoint = { x: pt.x, y: pt.y };
    }

    if (i === 0) {
      ctx.moveTo(canvasPoint.x, canvasPoint.y);
    } else {
      ctx.lineTo(canvasPoint.x, canvasPoint.y);
    }
  }

  ctx.closePath();

  // Fill with semi-transparent color
  ctx.fillStyle = `rgba(${color.r}, ${color.g}, ${color.b}, 0.16)`;
  ctx.fill();

  // Stroke with full color
  ctx.strokeStyle = `rgb(${color.r}, ${color.g}, ${color.b})`;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.restore();
}
