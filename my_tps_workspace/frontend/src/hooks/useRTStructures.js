import { useState, useCallback } from 'react';

/**
 * Hook for managing RT Structure data and visualization state.
 *
 * @returns {Object} RT Structure state and operations
 */
export function useRTStructures() {
  const [structures, setStructures] = useState([]);
  const [contours, setContours] = useState([]);
  const [selectedStructureId, setSelectedStructureId] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  /**
   * Load RT Structure data from backend API
   * @param {number} rtStructFileId - RT Structure file ID
   */
  const loadStructures = useCallback(async (rtStructFileId) => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/rtstruct/${rtStructFileId}`, {
        credentials: 'include',
      });

      if (!res.ok) {
        throw new Error('Failed to load RT Structure');
      }

      const data = await res.json();

      // Transform ROI sequence to structures with visibility state
      const loadedStructures = (data.roiSequence || []).map((roi) => ({
        roiNumber: roi.roiNumber,
        roiName: roi.roiName,
        color: roi.displayColor,
        visible: true, // Default to visible
      }));

      // Transform contour sequence
      const loadedContours = (data.contourSequence || []).map((contour) => ({
        referencedSOPInstanceUID: contour.referencedSOPInstanceUID,
        referencedROINumber: contour.referencedROINumber,
        points: contour.contourData,
        color: contour.displayColor,
      }));

      setStructures(loadedStructures);
      setContours(loadedContours);
      setSelectedStructureId(null);
    } catch (err) {
      setError(err.message);
      setStructures([]);
      setContours([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Toggle visibility of a structure by ROI number
   * @param {number} roiNumber - ROI number to toggle
   */
  const toggleStructureVisibility = useCallback((roiNumber) => {
    setStructures((prev) =>
      prev.map((s) =>
        s.roiNumber === roiNumber ? { ...s, visible: !s.visible } : s
      )
    );
  }, []);

  /**
   * Select a structure by ROI number
   * @param {number} roiNumber - ROI number to select (null to deselect)
   */
  const selectStructure = useCallback((roiNumber) => {
    setSelectedStructureId(roiNumber);
  }, []);

  /**
   * Get contours for a specific CT slice
   * @param {string} sopInstanceUID - SOP Instance UID of CT slice
   * @returns {Array} Contours for the slice that belong to visible structures
   */
  const getContoursForSlice = useCallback(
    (sopInstanceUID) => {
      if (!sopInstanceUID) return [];

      // Get visible ROI numbers
      const visibleROINumbers = new Set(
        structures.filter((s) => s.visible).map((s) => s.roiNumber)
      );

      // Filter contours by slice and visible structures
      return contours.filter(
        (c) =>
          c.referencedSOPInstanceUID === sopInstanceUID &&
          visibleROINumbers.has(c.referencedROINumber)
      );
    },
    [structures, contours]
  );

  return {
    structures,
    contours,
    selectedStructureId,
    isLoading,
    error,
    loadStructures,
    toggleStructureVisibility,
    selectStructure,
    getContoursForSlice,
  };
}
