import { useCallback, useEffect, useRef } from 'react';
import * as cornerstone from '@cornerstonejs/core';
import * as cornerstoneTools from '@cornerstonejs/tools';

const SEGMENTATION_ID = 'rtstruct-segmentation';

/**
 * Hook for rendering RT Structure contours using cornerstone3D native Segmentation API
 *
 * Contours are defined in patient coordinates, so they render in both Stack and
 * Volume viewports. The wadouri datasets must be preloaded before creating
 * geometries — the metadata provider can only answer imagePlaneModule queries
 * for datasets that are already cached (see WISSEN.md §1).
 *
 * @param {Object} params
 * @param {Object|null} params.viewport - Cornerstone viewport instance (null until ready)
 * @param {string|null} params.frameOfReferenceUID - Viewport FoR; null = volume not loaded yet
 * @param {Array} params.imageIds - CT imageIds the contours should align with
 * @param {Array} params.roiSequence - ROI sequence from backend { roiNumber, roiName, displayColor }
 * @param {Array} params.contourSequence - Contour sequence from backend { referencedSOPInstanceUID, referencedROINumber, contourData, displayColor }
 * @param {Object} params.visibility - Object mapping roiNumber to boolean visibility
 */
export function useRTContourSegmentation({
  viewport,
  frameOfReferenceUID,
  imageIds = [],
  roiSequence = [],
  contourSequence = [],
  visibility = {},
}) {
  const isInitializedRef = useRef(false);
  const isInitializingRef = useRef(false);
  const preloadStartedRef = useRef(false);

  /**
   * Preload images (batches of 5) so their DICOM datasets are cached and
   * metadata queries succeed
   */
  const preloadAllImages = useCallback(async (ids) => {
    if (!ids || ids.length === 0) return 0;

    const concurrency = 5;
    let totalLoaded = 0;

    for (let i = 0; i < ids.length; i += concurrency) {
      const batch = ids.slice(i, i + concurrency);
      const batchResults = await Promise.allSettled(
        batch.map(imageId => cornerstone.imageLoader.loadImage(imageId))
      );
      totalLoaded += batchResults.filter(r => r.status === 'fulfilled').length;
    }

    return totalLoaded;
  }, []);

  /**
   * Convert contour data from backend format to cornerstone3D PublicContourSetData format
   */
  const convertContourData = useCallback((contours, roiNumber) => {
    const relevantContours = contours.filter(c => c.referencedROINumber === roiNumber);
    if (relevantContours.length === 0) return null;

    const roiInfo = roiSequence.find(r => r.roiNumber === roiNumber);
    if (!roiInfo) return null;

    const contourDataArray = relevantContours.map(contour => {
      const points = [];
      const data = contour.contourData || [];
      for (let i = 0; i < data.length; i += 3) {
        points.push([data[i], data[i + 1], data[i + 2]]);
      }
      return {
        points,
        type: cornerstone.Enums.ContourType.CLOSED_PLANAR,
        color: [
          contour.displayColor?.r ?? 255,
          contour.displayColor?.g ?? 255,
          contour.displayColor?.b ?? 255,
        ],
        segmentIndex: roiNumber,
      };
    });

    const color = [
      roiInfo.displayColor?.r ?? 255,
      roiInfo.displayColor?.g ?? 255,
      roiInfo.displayColor?.b ?? 255,
    ];

    return {
      id: `rtstruct-geometry-roi-${roiNumber}`,
      data: contourDataArray,
      frameOfReferenceUID: frameOfReferenceUID || 'unknown',
      color,
      segmentIndex: roiNumber,
    };
  }, [roiSequence, frameOfReferenceUID]);

  /**
   * Create and cache geometries for all visible ROIs
   */
  const createGeometries = useCallback(async () => {
    const newGeometryIds = [];

    for (const roi of roiSequence) {
      if (visibility[roi.roiNumber] === false) continue;

      const contourSetData = convertContourData(contourSequence, roi.roiNumber);
      if (!contourSetData) continue;

      const geometryId = contourSetData.id;

      try {
        cornerstone.geometryLoader.createAndCacheGeometry(geometryId, {
          type: cornerstone.Enums.GeometryType.CONTOUR,
          geometryData: contourSetData,
        });
        if (!cornerstone.cache.getGeometry(geometryId)) {
          console.warn('[RTContourSegmentation] Geometry not found in cache:', geometryId);
          continue;
        }
        newGeometryIds.push(geometryId);
      } catch (err) {
        console.error('[RTContourSegmentation] Failed to create geometry:', geometryId, err);
      }
    }

    return newGeometryIds;
  }, [roiSequence, contourSequence, visibility, convertContourData]);

  /**
   * Add segmentation to viewport (contour representation + labelmap for editing tools)
   */
  const addSegmentationToViewport = useCallback(async (geometryIds) => {
    if (!viewport || !geometryIds.length) return;

    const { SegmentationRepresentations } = cornerstoneTools.Enums;

    const existingSeg = cornerstoneTools.segmentation.state.getSegmentation(SEGMENTATION_ID);
    if (!existingSeg) {
      cornerstoneTools.segmentation.addSegmentations([{
        segmentationId: SEGMENTATION_ID,
        representation: {
          type: SegmentationRepresentations.Contour,
          data: { geometryIds },
        },
      }]);
    }

    await cornerstoneTools.segmentation.addContourRepresentationToViewport(viewport.id, [{
      segmentationId: SEGMENTATION_ID,
    }]);

    // NOTE: no labelmap representation here.
    // Converting contours to a labelmap requires @cornerstonejs/polymorphic-segmentation
    // (PolySeg add-on). Without it, createLabelmapVolumeForViewport yields an empty
    // labelmap whose volume actor also ends up replacing the CT volume actor on the
    // viewport (observed: viewport left with only the segmentation actor → black CT).
    // Re-add labelmap support together with the PolySeg dependency when brush editing
    // of derived labelmaps is needed.
  }, [viewport]);

  /**
   * Initialize segmentation once viewport, data and volume are ready
   */
  useEffect(() => {
    if (!viewport || !roiSequence.length || !contourSequence.length) return;
    // frameOfReferenceUID is null until the CT volume has been set on the
    // viewport — attaching contours before that is unreliable
    if (frameOfReferenceUID === null) return;
    if (imageIds.length === 0) return;
    // Single-flight: StrictMode double-invokes this effect, and two concurrent
    // initializations would race on addSegmentations / geometry creation
    if (isInitializedRef.current || isInitializingRef.current) return;

    const updateSegmentation = async () => {
      isInitializingRef.current = true;
      try {
        // Preload remaining datasets in the background. The metadata for the
        // currently displayed slice is always available (displaying it cached
        // its dataset), so contour attachment must not wait for the bulk
        // preload — which can take minutes through the image load pool.
        if (!preloadStartedRef.current) {
          preloadStartedRef.current = true;
          preloadAllImages(imageIds).catch(err =>
            console.warn('[RTContourSegmentation] background preload failed:', err)
          );
        }

        const geometryIds = await createGeometries();
        if (geometryIds.length === 0) {
          console.warn('[RTContourSegmentation] No geometries created');
          return;
        }

        await addSegmentationToViewport(geometryIds);
        isInitializedRef.current = true;
      } catch (err) {
        preloadStartedRef.current = false;
        console.error('[RTContourSegmentation] Initialization failed:', err);
      } finally {
        isInitializingRef.current = false;
      }
    };

    updateSegmentation();
  }, [viewport, frameOfReferenceUID, imageIds, roiSequence, contourSequence, createGeometries, addSegmentationToViewport, preloadAllImages]);

  /**
   * Toggle visibility for a single segment (roiNumber) in the contour representation
   */
  const setSegmentVisibility = useCallback((segmentIndex, visible) => {
    if (!viewport) return;

    try {
      const { SegmentationRepresentations } = cornerstoneTools.Enums;

      cornerstoneTools.segmentation.config.visibility.setSegmentIndexVisibility(
        viewport.id,
        { segmentationId: SEGMENTATION_ID, type: SegmentationRepresentations.Contour },
        segmentIndex,
        visible
      );

      viewport.render();
    } catch (err) {
      console.error('[RTContourSegmentation] Failed to set visibility:', err);
    }
  }, [viewport]);

  return {
    setSegmentVisibility,
  };
}
