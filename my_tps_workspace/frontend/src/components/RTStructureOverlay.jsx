import { useEffect, useRef } from 'react';

/**
 * RTStructureOverlay - Renders RT Structure contours on Cornerstone viewport
 *
 * Coordinate transformation:
 * DICOM contour data is in Patient Coordinate System (world coordinates in mm).
 * We need to convert to canvas pixel coordinates for rendering.
 *
 * @param {Object} props
 * @param {Object} props.element - Cornerstone viewport element
 * @param {Array} props.contours - Array of contour objects for current slice
 * @param {Object} props.viewport - Cornerstone viewport instance
 * @param {boolean} props.visible - Whether overlay should be rendered
 * @param {number} props.currentImageIndex - Current slice index (triggers re-render on change)
 * @param {Object} props.imagePosition - Image position from DICOM (x, y, z)
 * @param {Object} props.pixelSpacing - Pixel spacing from DICOM (x, y)
 */
export default function RTStructureOverlay({ element, contours, viewport, visible, currentImageIndex = 0, imagePosition, pixelSpacing }) {
  const canvasRef = useRef(null);
  const cornerstoneRef = useRef(null);
  const viewportRef = useRef(null);
  const lastDrawnIndexRef = useRef(-1);

  // Keep refs updated
  useEffect(() => {
    viewportRef.current = viewport;
    if (viewport && window.cornerstone) {
      cornerstoneRef.current = window.cornerstone;
    }
  }, [viewport]);

  // Main drawing effect
  useEffect(() => {
    if (!canvasRef.current || !element || !visible || contours.length === 0) {
      return;
    }

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const cs = cornerstoneRef.current;
    const vp = viewportRef.current;

    // Skip if same index already drawn (unless viewport changed)
    if (lastDrawnIndexRef.current === currentImageIndex && vp) {
      return;
    }
    lastDrawnIndexRef.current = currentImageIndex;

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

    console.log('[RTStructureOverlay] Drawing: idx=', currentImageIndex, 'contours=', contours.length);

    // Get image metadata for coordinate transformation
    // Use props if provided (from database), otherwise fallback to Cornerstone APIs
    let imgPosition = imagePosition || { x: 0, y: 0, z: 0 };
    let imgPixelSpacing = pixelSpacing || { x: 1, y: 1 };
    let imageDimensions = { width: 512, height: 512 };

    if (vp) {
      try {
        // If props not provided, try to get from Cornerstone APIs
        if (!imagePosition) {
          // Method 1: getImagePlaneReferenceData
          const planeData = vp.getImagePlaneReferenceData?.();
          console.log('[RTStructureOverlay] planeData:', planeData);
          if (planeData?.imagePositionPatient) {
            imgPosition = {
              x: planeData.imagePositionPatient[0],
              y: planeData.imagePositionPatient[1],
              z: planeData.imagePositionPatient[2]
            };
          }

          // Method 2: get the Cornerstone image and use metadata API
          const csImage = vp.getCornerstoneImage?.();
          console.log('[RTStructureOverlay] csImage:', csImage ? {width: csImage.width, height: csImage.height, imageId: csImage.imageId} : null);
          if (csImage) {
            imageDimensions = {
              width: csImage.width || 512,
              height: csImage.height || 512
            };
            // Get metadata via cornerstone.metaData using the imageId
            if (csImage.imageId && cs?.metaData) {
              const ipp = cs.metaData.get('imagePositionPatient', csImage.imageId);
              if (ipp && ipp.length >= 3) {
                imgPosition = { x: ipp[0], y: ipp[1], z: ipp[2] };
              }
              const ps = cs.metaData.get('pixelSpacing', csImage.imageId);
              if (ps && ps.length >= 2) {
                imgPixelSpacing = { x: ps[0], y: ps[1] };
              }
            }
          }

          // Method 3: try getImageData for dimensions
          if (!imageDimensions.width || imageDimensions.width === 512) {
            const imageData = vp.getImageData?.();
            if (imageData) {
              if (imageData.dimensions) {
                imageDimensions = {
                  width: imageData.dimensions[0] || 512,
                  height: imageData.dimensions[1] || 512
                };
              }
              // Try to get spacing from imageData
              if (imageData.spacing) {
                imgPixelSpacing = { x: imageData.spacing[0] || 1, y: imageData.spacing[1] || 1 };
              }
            }
          }
        } else {
          // Props provided - use them, still get dimensions from Cornerstone
          const csImage = vp.getCornerstoneImage?.();
          if (csImage) {
            imageDimensions = {
              width: csImage.width || 512,
              height: csImage.height || 512
            };
          }
        }
      } catch (e) {
        console.warn('[RTStructureOverlay] Could not get image metadata:', e);
      }
    }

    // Debug output
    console.log('[RTStructureOverlay] Image metadata:', {
      imagePosition: imgPosition,
      pixelSpacing: imgPixelSpacing,
      imageDimensions
    });

    // Debug output
    console.log('[RTStructureOverlay] Image metadata:', {
      imagePosition,
      pixelSpacing,
      imageDimensions
    });

    // Draw each contour
    const canvasSize = [rect.width, rect.height];
    for (const contour of contours) {
      drawContour(ctx, contour, imgPosition, imgPixelSpacing, imageDimensions, canvasSize);
    }
  }, [element, contours, visible, currentImageIndex]);

  // Listen for Cornerstone viewport events
  useEffect(() => {
    if (!element || !viewport) return;

    const handleCameraChange = () => {
      // Force redraw when camera changes
      lastDrawnIndexRef.current = -1;
    };

    element.addEventListener('cornerstonecamerachange', handleCameraChange);
    element.addEventListener('cornerstoneimagerendered', handleCameraChange);

    return () => {
      element.removeEventListener('cornerstonecamerachange', handleCameraChange);
      element.removeEventListener('cornerstoneimagerendered', handleCameraChange);
    };
  }, [element, viewport]);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      lastDrawnIndexRef.current = -1;
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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
 * Convert DICOM world coordinates to canvas pixel coordinates
 *
 * For transverse CT images (ImageOrientationPatient = [1,0,0,0,1,0]):
 * - World X → Image Column (pi) = (world_x - imagePosition.x) / pixelSpacing.x
 * - World Y → Image Row (pj) = (world_y - imagePosition.y) / pixelSpacing.y
 *
 * Then scale to canvas based on how the image fills the viewport
 */
function worldToCanvasCoords(x, y, imagePosition, pixelSpacing, imageDimensions, canvasSize) {
  const [canvasWidth, canvasHeight] = canvasSize;

  // Convert world (mm) to pixel coordinates
  const pi = (x - imagePosition.x) / pixelSpacing.x;
  const pj = (y - imagePosition.y) / pixelSpacing.y;

  // Convert pixel [0, dim-1] to canvas [0, canvasWidth/Height]
  // Assuming image fills the viewport (no additional zoom/pan)
  const canvasX = (pi / imageDimensions.width) * canvasWidth;
  const canvasY = (pj / imageDimensions.height) * canvasHeight;

  return { x: canvasX, y: canvasY };
}

/**
 * Draw a single contour on the canvas
 */
function drawContour(ctx, contour, imagePosition, pixelSpacing, imageDimensions, canvasSize) {
  const contourData = contour.points || contour.contourData;
  if (!contourData || contourData.length < 3) {
    return;
  }

  const color = contour.color || contour.displayColor || { r: 255, g: 255, b: 255 };

  // Debug first contour
  if (!drawContour._logged) {
    drawContour._logged = true;
    const firstPt = { x: contourData[0], y: contourData[1], z: contourData[2] };
    const canvasPt = worldToCanvasCoords(firstPt.x, firstPt.y, imagePosition, pixelSpacing, imageDimensions, canvasSize);
    console.log('[RTStructureOverlay] First point world:', firstPt);
    console.log('[RTStructureOverlay] First point canvas:', canvasPt);
    console.log('[RTStructureOverlay] Canvas size:', canvasSize);
  }

  // Contour data is flat array of x,y,z triplets
  const points = [];
  for (let i = 0; i < contourData.length; i += 3) {
    points.push({
      x: contourData[i],
      y: contourData[i + 1],
      z: contourData[i + 2]
    });
  }

  if (points.length < 3) {
    return;
  }

  ctx.save();
  ctx.beginPath();

  // Convert each point and draw
  for (let i = 0; i < points.length; i++) {
    const pt = points[i];
    const canvasPoint = worldToCanvasCoords(pt.x, pt.y, imagePosition, pixelSpacing, imageDimensions, canvasSize);

    if (i === 0) {
      ctx.moveTo(canvasPoint.x, canvasPoint.y);
    } else {
      ctx.lineTo(canvasPoint.x, canvasPoint.y);
    }
  }

  ctx.closePath();

  // Fill with semi-transparent color
  ctx.fillStyle = `rgba(${color.r}, ${color.g}, ${color.b}, 0.3)`;
  ctx.fill();

  // Stroke with full color
  ctx.strokeStyle = `rgb(${color.r}, ${color.g}, ${color.b})`;
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.restore();
}
