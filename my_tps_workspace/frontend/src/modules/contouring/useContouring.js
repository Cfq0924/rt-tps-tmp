import { useState, useRef, useCallback, useEffect } from 'react';
import { maskToPolygons, polygonsToMask, imagePixelToPatient, patientToImagePixel } from './paintCore.js';

/**
 * Contouring module state: segments, per-segment per-slice masks, undo/redo
 * and server persistence.
 *
 * Masks: Map<segmentId, Map<sliceIdx, Uint8Array(cols*rows)>> — values 0/1.
 * Each working segment maps 1:1 to a server `segmentations` row (created
 * immediately on "Add Segment"), so Save is a per-segment PUT.
 *
 * @param {Object} params
 * @param {number} params.studyId
 * @param {Array} params.ctFiles - CT files of the study, slice-ordered
 *   ({id, sop_instance_uid, instance_number, image_position_z, …})
 * @param {Object} params.ctGeom - {imagePosition, imageOrientation, pixelSpacing, cols, rows}
 */
export function useContouring({ studyId, ctFiles = [], ctGeom }) {
  const [segments, setSegments] = useState([]); // {id, name, color, visible}
  const [activeSegmentId, setActiveSegmentId] = useState(null);
  const [tool, setTool] = useState('brush');
  const [brushSizeMm, setBrushSizeMm] = useState(5);
  const [paintVersion, setPaintVersion] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');

  const masksRef = useRef(new Map()); // segId -> Map<sliceIdx, Uint8Array>
  const historyRef = useRef({ past: [], future: [] });
  const [historyInfo, setHistoryInfo] = useState({ canUndo: false, canRedo: false });

  const refreshHistoryInfo = useCallback(() => {
    setHistoryInfo({
      canUndo: historyRef.current.past.length > 0,
      canRedo: historyRef.current.future.length > 0,
    });
  }, []);

  const bump = useCallback(() => setPaintVersion(v => v + 1), []);

  const getMask = useCallback((segId, sliceIdx) => {
    if (!ctGeom) return new Uint8Array(0);
    if (!masksRef.current.has(segId)) masksRef.current.set(segId, new Map());
    const sliceMap = masksRef.current.get(segId);
    if (!sliceMap.has(sliceIdx)) sliceMap.set(sliceIdx, new Uint8Array(ctGeom.cols * ctGeom.rows));
    return sliceMap.get(sliceIdx);
  }, [ctGeom]);

  /** Called by PaintLayer before a stroke — snapshot the affected slice. */
  const strokeStart = useCallback((sliceIdx) => {
    if (activeSegmentId == null || !ctGeom) return;
    const h = historyRef.current;
    const sliceMap = masksRef.current.get(activeSegmentId);
    h.past.push({
      segId: activeSegmentId,
      sliceIdx,
      data: (sliceMap?.get(sliceIdx) ?? new Uint8Array(ctGeom.cols * ctGeom.rows)).slice(),
    });
    if (h.past.length > 20) h.past.shift();
    h.future.length = 0;
    refreshHistoryInfo();
  }, [activeSegmentId, ctGeom, refreshHistoryInfo]);

  /** Called after a stroke / external mask change — triggers a redraw. */
  const strokeEnd = useCallback(() => {
    setDirty(true);
    bump();
    refreshHistoryInfo();
  }, [bump, refreshHistoryInfo]);

  const undo = useCallback(() => {
    const h = historyRef.current;
    const snap = h.past.pop();
    if (!snap || !ctGeom) return;
    const sliceMap = masksRef.current.get(snap.segId);
    h.future.push({ segId: snap.segId, sliceIdx: snap.sliceIdx, data: (sliceMap?.get(snap.sliceIdx) ?? new Uint8Array(ctGeom.cols * ctGeom.rows)).slice() });
    sliceMap.set(snap.sliceIdx, snap.data);
    bump();
    refreshHistoryInfo();
  }, [bump, ctGeom, refreshHistoryInfo]);

  const redo = useCallback(() => {
    const h = historyRef.current;
    const snap = h.future.pop();
    if (!snap || !ctGeom) return;
    const sliceMap = masksRef.current.get(snap.segId);
    h.past.push({ segId: snap.segId, sliceIdx: snap.sliceIdx, data: (sliceMap?.get(snap.sliceIdx) ?? new Uint8Array(ctGeom.cols * ctGeom.rows)).slice() });
    sliceMap.set(snap.sliceIdx, snap.data);
    bump();
    refreshHistoryInfo();
  }, [bump, ctGeom, refreshHistoryInfo]);

  /** Load all server-saved segmentations of the study into the working set. */
  const loadFromServer = useCallback(async () => {
    if (!ctGeom) return;
    setLoading(true);
    setLoadError('');
    try {
      const listRes = await fetch(`/api/segmentations/study/${studyId}`, { credentials: 'include' });
      if (!listRes.ok) throw new Error('failed to list segmentations');
      const { segmentations } = await listRes.json();

      const nextSegments = [];
      for (const meta of segmentations) {
        const cRes = await fetch(`/api/segmentations/${meta.id}/contours`, { credentials: 'include' });
        if (!cRes.ok) continue;
        const { slices } = await cRes.json();
        const sliceMap = new Map();
        const uidToIdx = new Map(ctFiles.map((f, i) => [f.sop_instance_uid, i]));
        for (const s of slices) {
          const idx = uidToIdx.get(s.sopInstanceUID);
          if (idx === undefined) continue;
          const mask = new Uint8Array(ctGeom.cols * ctGeom.rows);
          for (const poly of s.contours) {
            // patient → image px, then scanline fill
            const pts = [];
            for (let p = 0; p < poly.length; p += 3) {
              const { i, j } = patientToImagePixel([poly[p], poly[p + 1], poly[p + 2]], ctGeom);
              pts.push(i, j);
            }
            polygonsToMask(mask, ctGeom.cols, ctGeom.rows, [pts], 1);
          }
          if (mask.some(v => v === 1)) sliceMap.set(idx, mask);
        }
        masksRef.current.set(meta.id, sliceMap);
        nextSegments.push({ id: meta.id, name: meta.name, color: meta.color || '#5cc8ff', visible: true });
      }
      setSegments(nextSegments);
      setActiveSegmentId(nextSegments[0]?.id ?? null);
      bump();
    } catch (err) {
      console.error('Failed to load segmentations:', err);
      setLoadError(err.message);
    } finally {
      setLoading(false);
    }
  }, [studyId, ctFiles, ctGeom, bump]);

  /** Create a segment (immediately persisted so Save can PUT contours). */
  const addSegment = useCallback(async (name, color) => {
    const res = await fetch(`/api/segmentations/study/${studyId}`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, color }),
    });
    if (!res.ok) throw new Error('Failed to create segmentation');
    const { segmentation } = await res.json();
    masksRef.current.set(segmentation.id, new Map());
    setSegments(prev => [...prev, { id: segmentation.id, name: segmentation.name, color: segmentation.color || color, visible: true }]);
    setActiveSegmentId(segmentation.id);
    return segmentation.id;
  }, [studyId]);

  const updateSegment = useCallback((id, patch) => {
    setSegments(prev => prev.map(s => (s.id === id ? { ...s, ...patch } : s)));
    setDirty(true);
    // persist rename/recolor immediately (cheap PATCH)
    if (patch.name !== undefined || patch.color !== undefined) {
      fetch(`/api/segmentations/${id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      }).catch(err => console.error('Failed to update segmentation:', err));
    }
  }, []);

  const deleteSegment = useCallback(async (id) => {
    setSegments(prev => prev.filter(s => s.id !== id));
    masksRef.current.delete(id);
    if (activeSegmentId === id) setActiveSegmentId(null);
    setDirty(true);
    await fetch(`/api/segmentations/${id}`, { method: 'DELETE', credentials: 'include' });
    bump();
  }, [activeSegmentId, bump]);

  /** Serialize one segment's masks → slices payload in patient mm. */
  const serializeSegment = useCallback((segId) => {
    if (!ctGeom) return [];
    const sliceMap = masksRef.current.get(segId);
    if (!sliceMap) return [];
    const slices = [];
    for (const [sliceIdx, mask] of sliceMap) {
      const file = ctFiles[sliceIdx];
      if (!file) continue;
      const polys = maskToPolygons(mask, ctGeom.cols, ctGeom.rows, 1);
      if (polys.length === 0) continue;
      const z = file.image_position_z ?? ctGeom.imagePosition.z;
      const contours = polys.map(poly => {
        const flat = [];
        for (let p = 0; p < poly.length; p += 2) {
          const pt = imagePixelToPatient(poly[p], poly[p + 1], z, ctGeom);
          flat.push(Number(pt[0].toFixed(4)), Number(pt[1].toFixed(4)), Number(pt[2].toFixed(4)));
        }
        return flat;
      });
      slices.push({
        sopInstanceUID: file.sop_instance_uid,
        instanceNumber: file.instance_number,
        contours,
      });
    }
    return slices;
  }, [ctFiles, ctGeom]);

  /** Save all working segments to the server. */
  const save = useCallback(async () => {
    setSaving(true);
    try {
      for (const seg of segments) {
        const slices = serializeSegment(seg.id);
        const res = await fetch(`/api/segmentations/${seg.id}/contours`, {
          method: 'PUT',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ slices }),
        });
        if (!res.ok) throw new Error(`Failed to save segmentation ${seg.name}`);
      }
      setDirty(false);
      return true;
    } finally {
      setSaving(false);
    }
  }, [segments, serializeSegment]);

  return {
    segments, activeSegmentId, setActiveSegmentId,
    masks: masksRef.current,
    tool, setTool, brushSizeMm, setBrushSizeMm,
    paintVersion, bump,
    dirty, saving, loading, loadError,
    canUndo: historyInfo.canUndo, canRedo: historyInfo.canRedo,
    strokeStart, strokeEnd, undo, redo,
    addSegment, updateSegment, deleteSegment, save,
    loadFromServer, getMask,
  };
}

export default useContouring;
