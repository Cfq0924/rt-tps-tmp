import { useCallback, useEffect, useRef } from 'react';
import * as cornerstone from '@cornerstonejs/core';
import * as cornerstoneTools from '@cornerstonejs/tools';

const SEGMENTATION_ID = 'rtstruct-segmentation';

/**
 * Hook for rendering RT Structure contours using cornerstone3D native Segmentation API
 *
 * @param {Object} params
 * @param {Object} params.viewport - Cornerstone viewport instance
 * @param {Array} params.roiSequence - ROI sequence from backend { roiNumber, roiName, displayColor }
 * @param {Array} params.contourSequence - Contour sequence from backend { referencedSOPInstanceUID, referencedROINumber, contourData, displayColor }
 * @param {Object} params.visibility - Object mapping roiNumber to boolean visibility
 * @param {string} params.frameOfReferenceUID - Frame of Reference UID to match contours with CT images
 */
export function useRTContourSegmentation({
  viewport,
  roiSequence = [],
  contourSequence = [],
  visibility = {},
  frameOfReferenceUID,
}) {
  const geometryIdsRef = useRef([]);
  const isInitializedRef = useRef(false);
  const preloadStartedRef = useRef(false);

  /**
   * Preload a single image and wait for its dataset to be cached
   */
  const preloadImage = useCallback(async (imageId) => {
    try {
      await cornerstone.imageLoader.loadImage(imageId);
      return true;
    } catch (err) {
      console.error('[RTContourSegmentation] Failed to load image:', err);
      return false;
    }
  }, []);

  /**
   * Preload all images in the stack to ensure metadata is available
   * This is critical for getClosestImageIdForStackViewport to work correctly
   */
  const preloadAllImages = useCallback(async (imageIds) => {
    if (!imageIds || imageIds.length === 0) return 0;

    const concurrency = 5;
    let totalLoaded = 0;

    for (let i = 0; i < imageIds.length; i += concurrency) {
      const batch = imageIds.slice(i, i + concurrency);
      const batchResults = await Promise.allSettled(
        batch.map(imageId => preloadImage(imageId))
      );
      totalLoaded += batchResults.filter(r => r.status === 'fulfilled' && r.value).length;
    }

    return totalLoaded;
  }, [preloadImage]);

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
        type: 'CLOSED_PLANAR',
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
          type: 'CONTOUR',
          geometryData: contourSetData,
        });
        const cached = cornerstone.cache.getGeometry(geometryId);
        if (!cached) {
          console.warn('[RTContourSegmentation] Geometry not found in cache:', geometryId);
        }
        newGeometryIds.push(geometryId);
      } catch (err) {
        console.error('[RTContourSegmentation] Failed to create geometry:', err);
      }
    }

    geometryIdsRef.current = newGeometryIds;
    return newGeometryIds;
  }, [roiSequence, contourSequence, visibility, convertContourData]);

  /**
   * Add segmentation to viewport
   */
  const addSegmentationToViewport = useCallback(async (geometryIds) => {
    if (!viewport || !geometryIds.length) return;

    try {
      const segmentationId = SEGMENTATION_ID;
      const { SegmentationRepresentations } = cornerstoneTools.Enums;

      let existingSeg = null;
      try {
        existingSeg = cornerstoneTools.segmentation.state.getSegmentation(segmentationId);
      } catch (e) {
        existingSeg = null;
      }

      if (!existingSeg) {
        cornerstoneTools.segmentation.addSegmentations([{
          segmentationId,
          representation: {
            type: SegmentationRepresentations.Contour,
            data: { geometryIds },
          },
        }]);
      }

      await cornerstoneTools.segmentation.addContourRepresentationToViewport(viewport.id, [{
        segmentationId,
      }]);
    } catch (err) {
      console.error('[RTContourSegmentation] Failed to add segmentation:', err);
      throw err;
    }
  }, [viewport]);

  /**
   * Update segmentation when data changes
   */
  useEffect(() => {
    if (!viewport || !roiSequence.length || !contourSequence.length) return;
    if (isInitializedRef.current) return;

    const updateSegmentation = async () => {
      try {
        const imageIds = viewport.getImageIds();
        if (!imageIds || imageIds.length === 0) {
          await new Promise(resolve => setTimeout(resolve, 2000));
          const imageIdsAfter = viewport.getImageIds();
          if (!imageIdsAfter || imageIdsAfter.length === 0) return;
        }

        if (!preloadStartedRef.current) {
          preloadStartedRef.current = true;
          await preloadAllImages(viewport.getImageIds());
        }

        const geometryIds = await createGeometries();
        if (geometryIds.length === 0) return;

        await addSegmentationToViewport(geometryIds);
        isInitializedRef.current = true;
      } catch (err) {
        console.error('[RTContourSegmentation] Update failed:', err);
        preloadStartedRef.current = false;
      }
    };

    updateSegmentation();
  }, [viewport, roiSequence, contourSequence, visibility, createGeometries, addSegmentationToViewport, preloadAllImages]);

  /**
   * Toggle visibility for a segment
   */
  const setSegmentVisibility = useCallback((segmentIndex, visible) => {
    if (!viewport) return;

    try {
      const { SegmentationRepresentations } = cornerstoneTools.Enums;

      cornerstoneTools.segmentation.config.setSegmentationRepresentationVisibility({
        viewportId: viewport.id,
        segmentationId: SEGMENTATION_ID,
        type: SegmentationRepresentations.Contour,
        visible,
      });

      viewport.render();
    } catch (err) {
      console.error('[RTContourSegmentation] Failed to set visibility:', err);
    }
  }, [viewport]);

  return {
    setSegmentVisibility,
  };
}
