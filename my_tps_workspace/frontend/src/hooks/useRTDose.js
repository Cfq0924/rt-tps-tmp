import { useState, useEffect, useCallback, useRef } from 'react';

// Module-level cache: fileId -> Promise<{grid: Float32Array, ...meta}>
// Survives remounts so toggling dose visibility repeatedly doesn't refetch 6MB.
const gridCache = new Map();

/**
 * Fetch the binary dose grid for a file and decode it.
 * @returns {Promise<Object>} { grid, rows, columns, numberOfFrames, ... }
 */
async function fetchDoseGrid(fileId, signal) {
  const res = await fetch(`/api/rtdose/${fileId}/grid`, { credentials: 'include', signal });
  if (!res.ok) {
    throw new Error(`Failed to load dose grid (${res.status})`);
  }
  const buffer = await res.arrayBuffer();
  const grid = new Float32Array(buffer);
  const rows = parseInt(res.headers.get('X-Dose-Rows'), 10);
  const columns = parseInt(res.headers.get('X-Dose-Columns'), 10);
  const numberOfFrames = parseInt(res.headers.get('X-Dose-Frames'), 10);

  if (!rows || !columns || !numberOfFrames || grid.length !== rows * columns * numberOfFrames) {
    throw new Error('Dose grid response is incomplete or malformed');
  }
  return { grid, rows, columns, numberOfFrames };
}

/**
 * RT Dose data hook: metadata on mount, heavy grid lazily on demand.
 *
 * @param {Object} params
 * @param {number|null} params.fileId - RTDOSE dicom file id (null = no dose)
 * @returns {{ doseMeta: Object|null, grid: Float32Array|null, gridInfo: Object|null, gridLoading: boolean, gridError: string, loadGrid: Function }}
 */
export function useRTDose({ fileId }) {
  const [doseMeta, setDoseMeta] = useState(null);
  const [grid, setGrid] = useState(null);
  const [gridInfo, setGridInfo] = useState(null);
  const [gridLoading, setGridLoading] = useState(false);
  const [gridError, setGridError] = useState('');
  const gridRequestedRef = useRef(false);

  // Metadata fetch (small, on mount / fileId change)
  useEffect(() => {
    let cancelled = false;
    setDoseMeta(null);
    setGrid(null);
    setGridInfo(null);
    setGridError('');
    gridRequestedRef.current = false;

    if (!fileId) return;

    (async () => {
      try {
        const res = await fetch(`/api/rtdose/${fileId}`, { credentials: 'include' });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setDoseMeta(data);
      } catch (err) {
        console.error('Failed to fetch RTDOSE metadata:', err);
      }
    })();

    return () => { cancelled = true; };
  }, [fileId]);

  /**
   * Load the full dose grid once (cached afterwards). Call when the user
   * first enables dose display.
   */
  const loadGrid = useCallback(() => {
    if (!fileId || gridRequestedRef.current) return;
    gridRequestedRef.current = true;

    if (!gridCache.has(fileId)) {
      gridCache.set(fileId, fetchDoseGrid(fileId).catch(err => {
        gridCache.delete(fileId);
        throw err;
      }));
    }

    setGridLoading(true);
    gridCache.get(fileId)
      .then(info => {
        setGrid(info.grid);
        setGridInfo({ rows: info.rows, columns: info.columns, numberOfFrames: info.numberOfFrames });
        setGridLoading(false);
      })
      .catch(err => {
        console.error('Failed to load dose grid:', err);
        gridRequestedRef.current = false;
        setGridLoading(false);
        setGridError(err.message || 'Failed to load dose grid');
      });
  }, [fileId]);

  return { doseMeta, grid, gridInfo, gridLoading, gridError, loadGrid };
}

export default useRTDose;
