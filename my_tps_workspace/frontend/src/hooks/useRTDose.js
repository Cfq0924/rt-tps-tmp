import { useState, useCallback } from 'react';

/**
 * Hook for managing RT Dose data and visualization state.
 *
 * @returns {Object} RT Dose state and operations
 */
export function useRTDose() {
  const [doseData, setDoseData] = useState(null);
  const [visible, setVisible] = useState(false);
  const [opacity, setOpacity] = useState(0.5);
  const [threshold, setThreshold] = useState(50); // Percentage for isodose display
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  /**
   * Load RT Dose data from backend API
   * @param {number} rtDoseFileId - RT Dose file ID
   */
  const loadDose = useCallback(async (rtDoseFileId) => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/rtdose/${rtDoseFileId}`, {
        credentials: 'include',
      });

      if (!res.ok) {
        throw new Error('Failed to load RT Dose');
      }

      const data = await res.json();

      setDoseData({
        doseGridScaling: data.doseGridScaling,
        doseType: data.doseType,
        doseUnits: data.doseUnits,
        maxDose: data.maxDose,
        gridSize: data.gridSize,
        imagePosition: data.imagePosition,
        imageOrientation: data.imageOrientation,
        pixelSpacing: data.pixelSpacing,
      });

      setVisible(false); // Default to hidden
    } catch (err) {
      setError(err.message);
      setDoseData(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Set dose overlay visibility
   * @param {boolean} newVisible - Visibility state
   */
  const setVisibleState = useCallback((newVisible) => {
    setVisible(newVisible);
  }, []);

  /**
   * Set dose overlay opacity
   * @param {number} newOpacity - Opacity value (0-1)
   */
  const setOpacityValue = useCallback((newOpacity) => {
    setOpacity(Math.max(0, Math.min(1, newOpacity)));
  }, []);

  /**
   * Set dose threshold for isodose display
   * @param {number} newThreshold - Threshold percentage (0-100)
   */
  const setThresholdValue = useCallback((newThreshold) => {
    setThreshold(Math.max(0, Math.min(100, newThreshold)));
  }, []);

  return {
    doseData,
    visible,
    opacity,
    threshold,
    isLoading,
    error,
    loadDose,
    setVisible: setVisibleState,
    setOpacity: setOpacityValue,
    setThreshold: setThresholdValue,
  };
}
