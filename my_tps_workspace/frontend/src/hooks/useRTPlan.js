import { useState, useEffect } from 'react';

// Module-level cache: fileId -> parsed plan (backend also caches; this avoids
// refetches when toggling between modules)
const planCache = new Map();

/**
 * Fetch and cache the parsed RTPLAN for a file.
 * @param {Object} params
 * @param {number|null} params.fileId - RTPLAN dicom file id (null = none)
 * @returns {{ plan: Object|null, loading: boolean, error: string }}
 */
export function useRTPlan({ fileId }) {
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    setPlan(null);
    setError('');

    if (!fileId) return;

    if (planCache.has(fileId)) {
      setPlan(planCache.get(fileId));
      return;
    }

    setLoading(true);
    (async () => {
      try {
        const res = await fetch(`/api/rtplan/${fileId}`, { credentials: 'include' });
        if (!res.ok) throw new Error(`Failed to load RTPLAN (${res.status})`);
        const data = await res.json();
        planCache.set(fileId, data);
        if (!cancelled) setPlan(data);
      } catch (err) {
        console.error('Failed to load RTPLAN:', err);
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [fileId]);

  return { plan, loading, error };
}

export default useRTPlan;
