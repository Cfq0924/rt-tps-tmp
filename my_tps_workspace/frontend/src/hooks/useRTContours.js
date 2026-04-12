import { useState, useCallback, useEffect } from 'react';

/**
 * Hook to manage RT Structure contours for a study
 * Fetches contours per-slice to avoid loading all contour data at once
 */
export function useRTContours(rtStructFileId, files) {
  const [contoursBySlice, setContoursBySlice] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Build a map of SOPInstanceUID to file index for quick lookup
  const sopToIndexMap = useCallback(() => {
    if (!files) return {};
    const map = {};
    files.forEach((f, idx) => {
      if (f.sop_instance_uid) {
        map[f.sop_instance_uid] = idx;
      }
    });
    return map;
  }, [files]);

  // Fetch contours for a specific slice
  const fetchContoursForSlice = useCallback(async (sopInstanceUID) => {
    if (!rtStructFileId || !sopInstanceUID) return [];

    try {
      const res = await fetch(
        `/api/rtstruct/${rtStructFileId}/slice/${sopInstanceUID}`,
        { credentials: 'include' }
      );
      if (!res.ok) return [];
      const data = await res.json();
      return data.contours || [];
    } catch (err) {
      console.error('[useRTContours] Failed to fetch contours:', err);
      return [];
    }
  }, [rtStructFileId]);

  // Get contours for current slice (lazy loads on demand)
  const getContoursForSlice = useCallback(async (sopInstanceUID) => {
    if (!sopInstanceUID) return [];

    // Return cached if available
    if (contoursBySlice[sopInstanceUID]) {
      return contoursBySlice[sopInstanceUID];
    }

    // Fetch and cache
    setLoading(true);
    try {
      const contours = await fetchContoursForSlice(sopInstanceUID);
      setContoursBySlice(prev => ({
        ...prev,
        [sopInstanceUID]: contours
      }));
      return contours;
    } finally {
      setLoading(false);
    }
  }, [contoursBySlice, fetchContoursForSlice]);

  // Clear contours when study changes
  useEffect(() => {
    setContoursBySlice({});
  }, [rtStructFileId]);

  return {
    contoursBySlice,
    getContoursForSlice,
    loading,
    error,
    sopToIndexMap,
  };
}

/**
 * Format contour data for RTStructureOverlay
 * Converts flat array to points array
 */
export function formatContoursForOverlay(contours) {
  if (!contours || !Array.isArray(contours)) return [];

  return contours.map(contour => ({
    points: contour.contourData || [],
    color: contour.displayColor || { r: 255, g: 255, b: 255 },
    roiNumber: contour.referencedROINumber,
  }));
}
