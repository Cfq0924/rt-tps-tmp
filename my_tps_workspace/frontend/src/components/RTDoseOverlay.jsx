import { useEffect, useRef, useCallback } from 'react';

/**
 * RTDoseOverlay - Renders RT Dose heatmap on Cornerstone viewport
 *
 * @param {Object} props
 * @param {Object} props.element - Cornerstone viewport element
 * @param {Object|null} props.doseData - RT Dose data object
 * @param {Object} props.ctViewport - CT Cornerstone viewport instance
 * @param {boolean} props.visible - Whether overlay should be rendered
 * @param {number} props.opacity - Overlay opacity (0-1)
 * @param {number} props.threshold - Threshold percentage for isodose display
 */
export default function RTDoseOverlay({
  element,
  doseData,
  ctViewport,
  visible,
  opacity,
  threshold,
}) {
  const canvasRef = useRef(null);

  const drawDose = useCallback(() => {
    if (!canvasRef.current || !element || !doseData || !visible) {
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

    if (!visible || !doseData.maxDose) {
      return;
    }

    // Draw dose overlay (simplified - would need full dose grid for actual rendering)
    // This is a placeholder that demonstrates the overlay concept
    ctx.save();
    ctx.globalAlpha = opacity;

    // Create gradient for dose visualization
    const gradient = ctx.createLinearGradient(0, 0, rect.width, rect.height);
    gradient.addColorStop(0, 'rgba(246, 193, 119, 0.1)');
    gradient.addColorStop(0.5, 'rgba(246, 193, 119, 0.5)');
    gradient.addColorStop(1, 'rgba(246, 193, 119, 0.9)');

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, rect.width, rect.height);

    ctx.restore();
  }, [element, doseData, visible, opacity, threshold]);

  useEffect(() => {
    drawDose();

    // Redraw on window resize
    window.addEventListener('resize', drawDose);
    return () => window.removeEventListener('resize', drawDose);
  }, [drawDose]);

  if (!element || !visible || !doseData) {
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
        zIndex: 4,
      }}
    />
  );
}
