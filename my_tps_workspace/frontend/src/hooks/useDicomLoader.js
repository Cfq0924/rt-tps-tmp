import { useState, useCallback, useEffect, useRef } from 'react';

/**
 * @file useDicomLoader.js
 * Hook for loading and managing DICOM images from backend
 *
 * User Journey:
 * As a clinician, I want to view CT images with smooth scrolling,
 * so that I can navigate through a patient's scan efficiently.
 */

/**
 * @typedef {Object} DicomLoaderState
 * @property {boolean} loading - Loading state
 * @property {string|null} error - Error message
 * @property {string[]} imageIds - Array of Cornerstone imageIds
 * @property {number} currentImageIndex - Current image index
 * @property {string} activeTool - Current active tool (Pan, Zoom, WindowLevel)
 * @property {Object[]} files - Raw file metadata from API
 */

/**
 * Custom hook for loading and managing DICOM images
 * @param {Object} params
 * @param {number} params.studyId - Study ID to load images for
 * @returns {DicomLoaderState & {
 *   loadImagesForStudy: (studyId: number) => Promise<void>,
 *   goToImage: (index: number) => void,
 *   setActiveTool: (tool: string) => void,
 *   setImageIds: (ids: string[]) => void,
 * }}
 */
export function useDicomLoader({ studyId }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [imageIds, setImageIds] = useState([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [activeTool, setActiveTool] = useState('Pan');
  const [files, setFiles] = useState([]);

  /**
   * Get signed URL for a file
   * @param {number} fileId
   * @returns {Promise<string>}
   */
  const getSignedUrl = useCallback(async (fileId) => {
    const res = await fetch(`/api/files/signed-url/${fileId}`, { credentials: 'include' });
    if (!res.ok) throw new Error('Failed to get signed URL');
    const data = await res.json();
    return data.url;
  }, []);

  /**
   * Build Cornerstone imageId from signed URL
   * Uses wadouri scheme for DICOM file loading
   * @param {string} url - Signed URL to DICOM file
   * @param {number} fileId - File ID for reference
   * @returns {string} - Cornerstone imageId
   */
  const buildImageId = useCallback((url, fileId) => {
    // Use wadouri scheme with the signed URL
    return `wadouri:${url}`;
  }, []);

  /**
   * Load images for a study
   * Fetches CT files and builds image stack for Cornerstone
   * @param {number} studyId
   */
  const loadImagesForStudy = useCallback(async (studyId) => {
    setLoading(true);
    setError(null);

    try {
      // Fetch files for study
      const filesRes = await fetch(`/api/studies/${studyId}`, { credentials: 'include' });
      if (!filesRes.ok) throw new Error('Failed to load study');
      const { study } = await filesRes.json();

      // Filter to CT images only for primary display
      const ctFiles = (study.files || [])
        .filter(f => f.modality === 'CT')
        .sort((a, b) => {
          // Sort by SOP Instance Number if available, otherwise by filename
          const aNum = parseInt(a.sop_instance_uid?.split('.').pop() || '0', 10);
          const bNum = parseInt(b.sop_instance_uid?.split('.').pop() || '0', 10);
          return aNum - bNum;
        });

      if (ctFiles.length === 0) {
        setError('No CT images found in study');
        setLoading(false);
        return;
      }

      setFiles(ctFiles);

      // Get signed URLs and build imageIds
      const ids = [];
      for (const file of ctFiles) {
        try {
          const url = await getSignedUrl(file.id);
          const imageId = buildImageId(url, file.id);
          ids.push(imageId);
        } catch (err) {
          console.error(`Failed to get URL for file ${file.id}:`, err);
        }
      }

      setImageIds(ids);
      setCurrentImageIndex(0);
      setLoading(false);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  }, [getSignedUrl, buildImageId]);

  /**
   * Navigate to specific image index
   * @param {number} index
   */
  const goToImage = useCallback((index) => {
    if (imageIds.length === 0) return;

    const clampedIndex = Math.max(0, Math.min(index, imageIds.length - 1));
    setCurrentImageIndex(clampedIndex);
  }, [imageIds.length]);

  /**
   * Step through images (for wheel scroll)
   * @param {number} delta - Positive for next, negative for previous
   */
  const stepImage = useCallback((delta) => {
    goToImage(currentImageIndex + delta);
  }, [currentImageIndex, goToImage]);

  // Load images when studyId changes
  useEffect(() => {
    if (studyId) {
      loadImagesForStudy(studyId);
    }
  }, [studyId, loadImagesForStudy]);

  return {
    // State
    loading,
    error,
    imageIds,
    currentImageIndex,
    activeTool,
    files,
    totalImages: imageIds.length,

    // Actions
    loadImagesForStudy,
    goToImage,
    stepImage,
    setActiveTool,
    setImageIds,
    setCurrentImageIndex,
  };
}

export default useDicomLoader;
