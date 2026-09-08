import { Box } from '@mui/material';
import { useEffect, useRef, useState } from 'react';
import * as cornerstone from '@cornerstonejs/core';
import { projectWorldToCanvas } from '../../lib/viewportCamera.js';
import { imagePixelToPatient } from '../contouring/paintCore.js';
import { apply4 } from '../../lib/registrationMath.js';

/**
 * RegistrationOverlay - draws the MOVING series slice over the shared
 * viewport (the FIXED series), transformed by the current registration
 * matrix. The moving image is rendered from cached pixel data with an
 * affine canvas transform derived from projecting three image corners —
 * the same approach as the paint layer, so no cornerstone camera state is
 * touched.
 *
 * @param {Object} props
 * @param {Object|null} props.viewport - cornerstone viewport (fixed series)
 * @param {Array|null} props.matrix - 4x4 registration matrix (moving → fixed)
 * @param {number} props.opacity - 0..1
 * @param {Array|null} props.movingFiles - moving series file rows (slice order)
 * @param {number} props.movingIndex - moving slice index to display
 * @param {boolean} props.visible
 * @param {Function} props.getSignedUrl - async (fileId) => url for wadouri load
 */
export default function RegistrationOverlay({
  viewport,
  matrix,
  opacity,
  movingFiles,
  movingIndex,
  visible,
  getSignedUrl,
}) {
  const canvasRef = useRef(null);
  const offscreenRef = useRef(null); // { canvas, key }
  const [loaded, setLoaded] = useState(null); // { image, file }

  const file = movingFiles?.[movingIndex] ?? movingFiles?.[movingFiles.length - 1] ?? null;

  // load the moving slice image
  useEffect(() => {
    if (!visible || !file) return;
    let alive = true;
    (async () => {
      try {
        const url = await getSignedUrl(file.id);
        const image = await cornerstone.imageLoader.loadAndCacheImage(`wadouri:${window.location.origin}${url}`);
        if (alive) setLoaded({ image, file });
      } catch {
        /* slice unavailable — keep the previous one */
      }
    })();
    return () => { alive = false; };
  }, [file?.id, visible, getSignedUrl]);

  // HU → 8-bit offscreen render of the loaded image
  useEffect(() => {
    if (!loaded) return;
    const { image } = loaded;
    const px = image.getPixelData();
    const slope = image.slope ?? 1;
    const intercept = image.intercept ?? 0;
    let ww = image.windowWidth, wc = image.windowCenter;
    if (Array.isArray(ww)) ww = ww[0];
    if (Array.isArray(wc)) wc = wc[0];
    ww = ww ?? 400;
    wc = wc ?? 40;
    const lo = wc - ww / 2;
    const scale = 255 / (ww || 1);
    const cols = image.columns, rows = image.rows;
    const canvas = document.createElement('canvas');
    canvas.width = cols;
    canvas.height = rows;
    const ctx = canvas.getContext('2d');
    const imageData = ctx.createImageData(cols, rows);
    for (let i = 0; i < cols * rows; i++) {
      const hu = px[i] * slope + intercept;
      const g = Math.max(0, Math.min(255, (hu - lo) * scale));
      imageData.data[i * 4] = g;
      imageData.data[i * 4 + 1] = g;
      imageData.data[i * 4 + 2] = g;
      imageData.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(imageData, 0, 0);
    offscreenRef.current = { canvas, key: loaded.file.id };
    setLoaded({ ...loaded, ready: true });
  }, [loaded?.image]);

  // draw with the current transform
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
      if (!viewport || !visible || !loaded?.image || !file || !matrix) return;

      const image = loaded.image;
      const geom = {
        imagePosition: {
          x: file.image_position_x ?? 0,
          y: file.image_position_y ?? 0,
          z: file.image_position_z ?? 0,
        },
        imageOrientation: { x: [1, 0, 0], y: [0, 1, 0] },
        pixelSpacing: { i: file.pixel_spacing_x ?? 1, j: file.pixel_spacing_y ?? 1 },
        cols: image.columns,
        rows: image.rows,
      };
      const zMov = geom.imagePosition.z;

      // project three moving-image corners through M then the fixed camera
      const proj = (i, j) => {
        const p = imagePixelToPatient(i, j, zMov, geom);
        return projectWorldToCanvas(viewport, apply4(matrix, p));
      };
      const p0 = proj(0, 0);
      const p1 = proj(geom.cols, 0);
      const p2 = proj(0, geom.rows);
      const a = (p1.x - p0.x) / geom.cols;
      const b = (p1.y - p0.y) / geom.cols;
      const c = (p2.x - p0.x) / geom.rows;
      const d = (p2.y - p0.y) / geom.rows;
      const e = p0.x, f = p0.y;
      if (![a, b, c, d, e, f].every(Number.isFinite)) return;

      ctx.save();
      ctx.setTransform(a * dpr, b * dpr, c * dpr, d * dpr, e * dpr, f * dpr);
      ctx.globalAlpha = opacity;
      ctx.drawImage(offscreenRef.current.canvas, 0, 0);
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
  }, [viewport, matrix, opacity, loaded, file, visible]);

  return (
    <Box
      sx={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 4,
        pointerEvents: 'none',
      }}
    >
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: '100%', display: 'block' }}
      />
    </Box>
  );
}
