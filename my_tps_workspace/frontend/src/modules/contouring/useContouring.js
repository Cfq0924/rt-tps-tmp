import { useState, useRef, useCallback } from 'react';
import {
  maskToPolygons,
  polygonsToMask,
  imagePixelToPatient,
  patientToImagePixel,
  floodFillHU,
  booleanOp,
  expandMask3D,
  autoBodyMask,
  cleanupSmallComponents,
  cropMask,
  extractWallMask,
  stampLineCoronal,
  stampLineSagittal,
  fillRectCoronal,
  fillRectSagittal,
  cropCoronal,
  cropSagittal,
  floodFillCoronal,
  floodFillSagittal,
} from './paintCore.js';
import { findDictionaryEntry, inferTypeFromName } from './structureDictionary.js';

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
  const [cropMode, setCropMode] = useState('keepInside');
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
    const readCurrent = (sliceIdx) =>
      (sliceMap?.get(sliceIdx) ?? new Uint8Array(ctGeom.cols * ctGeom.rows)).slice();
    if (snap.group) {
      // composite entry (multi-slice op): current state of every slice goes to redo
      h.future.push({ segId: snap.segId, group: snap.group.map(g => ({ sliceIdx: g.sliceIdx, data: readCurrent(g.sliceIdx) })) });
      for (const g of snap.group) sliceMap.set(g.sliceIdx, g.data);
    } else {
      h.future.push({ segId: snap.segId, sliceIdx: snap.sliceIdx, data: readCurrent(snap.sliceIdx) });
      sliceMap.set(snap.sliceIdx, snap.data);
    }
    bump();
    refreshHistoryInfo();
  }, [bump, ctGeom, refreshHistoryInfo]);

  const redo = useCallback(() => {
    const h = historyRef.current;
    const snap = h.future.pop();
    if (!snap || !ctGeom) return;
    const sliceMap = masksRef.current.get(snap.segId);
    const readCurrent = (sliceIdx) =>
      (sliceMap?.get(sliceIdx) ?? new Uint8Array(ctGeom.cols * ctGeom.rows)).slice();
    if (snap.group) {
      h.past.push({ segId: snap.segId, group: snap.group.map(g => ({ sliceIdx: g.sliceIdx, data: readCurrent(g.sliceIdx) })) });
      for (const g of snap.group) sliceMap.set(g.sliceIdx, g.data);
    } else {
      h.past.push({ segId: snap.segId, sliceIdx: snap.sliceIdx, data: readCurrent(snap.sliceIdx) });
      sliceMap.set(snap.sliceIdx, snap.data);
    }
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
        nextSegments.push({
          id: meta.id,
          name: meta.name,
          color: meta.color || '#5cc8ff',
          visible: true,
          approved: !!meta.approved,
          interpretedType: meta.interpretedType || inferTypeFromName(meta.name),
        });
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
  const addSegment = useCallback(async (name, color, interpretedType) => {
    const body = { name, color };
    if (interpretedType) body.interpretedType = interpretedType;
    else {
      const entry = findDictionaryEntry(name);
      if (entry) body.interpretedType = entry.type;
      else body.interpretedType = inferTypeFromName(name);
    }
    const res = await fetch(`/api/segmentations/study/${studyId}`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error('Failed to create segmentation');
    const { segmentation } = await res.json();
    masksRef.current.set(segmentation.id, new Map());
    setSegments(prev => [...prev, {
      id: segmentation.id,
      name: segmentation.name,
      color: segmentation.color || color,
      visible: true,
      interpretedType: segmentation.interpretedType || body.interpretedType,
    }]);
    setActiveSegmentId(segmentation.id);
    return segmentation.id;
  }, [studyId]);

  /** Add a segment from the structure dictionary (name + type + color). */
  const addSegmentFromDictionary = useCallback(async (entryName) => {
    const entry = findDictionaryEntry(entryName);
    if (!entry) throw new Error(`Unknown dictionary entry: ${entryName}`);
    return addSegment(entry.name, entry.color, entry.type);
  }, [addSegment]);

  const updateSegment = useCallback((id, patch) => {
    setSegments(prev => prev.map(s => (s.id === id ? { ...s, ...patch } : s)));
    setDirty(true);
    // persist rename/recolor/approval/type immediately (cheap PATCH)
    if (patch.name !== undefined || patch.color !== undefined || patch.approved !== undefined || patch.interpretedType !== undefined) {
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


  const activeSegment = () => segments.find(s => s.id === activeSegmentId) ?? null;

  /** Flood fill on the active segment at a seed (image pixel coords). */
  const floodFillAt = useCallback((sliceIdx, seed, huTolerance, ctPixels) => {
    const seg = activeSegment();
    if (!seg || seg.approved) return;
    strokeStart(sliceIdx);
    const mask = getMask(seg.id, sliceIdx);
    floodFillHU(ctPixels, mask, ctGeom.cols, ctGeom.rows, Math.floor(seed.i), Math.floor(seed.j), huTolerance, 1);
    strokeEnd();
  }, [activeSegmentId, ctGeom, getMask, strokeStart, strokeEnd]);

  /** Boolean op of a source segment's mask INTO the active segment (all shared slices). */
  const applyBoolean = useCallback((sourceSegId, op) => {
    const seg = activeSegment();
    if (!seg || seg.approved || !ctGeom) return;
    if (sourceSegId === activeSegmentId || sourceSegId == null) return;
    const srcMap = masksRef.current.get(sourceSegId);
    const dstMap = masksRef.current.get(activeSegmentId);
    if (!srcMap || !dstMap) return;

    // one composite undo entry covering every slice this op touches —
    // a single-slice snapshot would make multi-slice booleans only partially
    // restorable
    const group = [];
    for (const [sliceIdx, dst] of dstMap) {
      if (srcMap.has(sliceIdx)) group.push({ sliceIdx, data: dst.slice() });
    }
    if (group.length === 0) return;
    const h = historyRef.current;
    h.past.push({ segId: activeSegmentId, group });
    if (h.past.length > 20) h.past.shift();
    h.future.length = 0;

    for (const [sliceIdx, dst] of dstMap) {
      const src = srcMap.get(sliceIdx);
      if (src) booleanOp(dst, src, op);
    }
    setDirty(true);
    bump();
    refreshHistoryInfo();
  }, [activeSegmentId, ctGeom, refreshHistoryInfo]);

  /** Expand the active segment by marginMm in-plane and zLayers slices. */
  const expandActive = useCallback((marginMm, zLayers) => {
    const seg = activeSegment();
    if (!seg || seg.approved || !ctGeom) return;
    strokeStart(0);
    const marginPx = Math.max(1, marginMm / (ctGeom.pixelSpacing.j || 1));
    const sliceMap = masksRef.current.get(activeSegmentId);
    if (sliceMap) {
      const indices = [...sliceMap.keys()];
      const lo = Math.min(...indices) - zLayers, hi = Math.max(...indices) + zLayers;
      for (let s = lo; s <= hi; s++) {
        if (s < 0) continue;
        if (!sliceMap.has(s)) sliceMap.set(s, new Uint8Array(ctGeom.cols * ctGeom.rows));
        const m = sliceMap.get(s);
        expandMask3D(m, ctGeom.cols, ctGeom.rows, marginPx, 0,
          (dz) => sliceMap.get(s + dz), (dz, mm) => sliceMap.set(s + dz, mm));
      }
    }
    strokeEnd();
  }, [activeSegmentId, ctGeom, strokeStart, strokeEnd]);

  /** Auto body contour into the active segment on the displayed slice. */
  const autoBodyOnSlice = useCallback((sliceIdx, ctPixels) => {
    const seg = activeSegment();
    if (!seg || seg.approved || !ctPixels) return;
    strokeStart(sliceIdx);
    const mask = getMask(seg.id, sliceIdx);
    const body = autoBodyMask(ctPixels, ctGeom.cols, ctGeom.rows);
    mask.set(body);
    strokeEnd();
  }, [activeSegmentId, ctGeom, getMask, strokeStart, strokeEnd]);

  /** Snapshot every existing slice of the active segment (composite undo). */
  const snapshotActiveAllSlices = useCallback(() => {
    if (activeSegmentId == null || !ctGeom) return null;
    const sliceMap = masksRef.current.get(activeSegmentId);
    if (!sliceMap) return { segId: activeSegmentId, group: [] };
    const group = [];
    for (const [sliceIdx, mask] of sliceMap) {
      group.push({ sliceIdx, data: mask.slice() });
    }
    const h = historyRef.current;
    h.past.push({ segId: activeSegmentId, group });
    if (h.past.length > 20) h.past.shift();
    h.future.length = 0;
    refreshHistoryInfo();
    return { segId: activeSegmentId, group };
  }, [activeSegmentId, ctGeom, refreshHistoryInfo]);

  /**
   * Eclipse Clean-up: drop small 4-connected fragments on every painted slice
   * of the active segment. minAreaMm2 is converted via pixel spacing.
   */
  const cleanupActive = useCallback((minAreaMm2) => {
    const seg = activeSegment();
    if (!seg || seg.approved || !ctGeom) return { removed: 0, kept: 0 };
    const spacingI = ctGeom.pixelSpacing?.i || 1;
    const spacingJ = ctGeom.pixelSpacing?.j || 1;
    const minAreaPx = Math.max(1, (minAreaMm2 || 4) / (spacingI * spacingJ));
    snapshotActiveAllSlices();
    const sliceMap = masksRef.current.get(activeSegmentId);
    let removed = 0, kept = 0;
    if (sliceMap) {
      for (const [, mask] of sliceMap) {
        const stats = cleanupSmallComponents(mask, ctGeom.cols, ctGeom.rows, minAreaPx);
        removed += stats.removed;
        kept += stats.kept;
      }
    }
    setDirty(true);
    bump();
    refreshHistoryInfo();
    return { removed, kept };
  }, [activeSegmentId, activeSegment, ctGeom, snapshotActiveAllSlices, bump, refreshHistoryInfo]);

  /**
   * Eclipse Crop Structure (current slice): keepInside | keepOutside a pixel rect.
   */
  const cropActiveOnSlice = useCallback((sliceIdx, rect, mode = 'keepInside') => {
    const seg = activeSegment();
    if (!seg || seg.approved || !ctGeom) return 0;
    strokeStart(sliceIdx);
    const mask = getMask(seg.id, sliceIdx);
    const cleared = cropMask(mask, ctGeom.cols, ctGeom.rows, rect, mode);
    strokeEnd();
    return cleared;
  }, [activeSegmentId, activeSegment, ctGeom, getMask, strokeStart, strokeEnd]);

  /**
   * Crop every painted slice of the active segment using the same image-pixel
   * rect (useful when the crop box is defined once and applied volume-wide).
   */
  const cropActiveAllSlices = useCallback((rect, mode = 'keepInside') => {
    const seg = activeSegment();
    if (!seg || seg.approved || !ctGeom) return 0;
    snapshotActiveAllSlices();
    const sliceMap = masksRef.current.get(activeSegmentId);
    let cleared = 0;
    if (sliceMap) {
      for (const [, mask] of sliceMap) {
        cleared += cropMask(mask, ctGeom.cols, ctGeom.rows, rect, mode);
      }
    }
    setDirty(true);
    bump();
    refreshHistoryInfo();
    return cleared;
  }, [activeSegmentId, activeSegment, ctGeom, snapshotActiveAllSlices, bump, refreshHistoryInfo]);

  /**
   * Eclipse Extract Wall: create a NEW segment that is a ring around the
   * active structure (outer dilate − inner erode), across all painted slices.
   */
  const extractWallFromActive = useCallback(async (outerMm, innerMm, newColor) => {
    const seg = activeSegment();
    if (!seg || seg.approved || !ctGeom) return null;
    const spacing = ctGeom.pixelSpacing?.j || 1;
    const outerPx = Math.max(0, (outerMm || 2) / spacing);
    const innerPx = Math.max(0, (innerMm || 2) / spacing);
    const sliceMap = masksRef.current.get(activeSegmentId);
    if (!sliceMap || sliceMap.size === 0) return null;

    // Build wall masks first (no mutation of the source), then create the segment
    const wallSlices = new Map();
    for (const [sliceIdx, mask] of sliceMap) {
      const wall = extractWallMask(mask, ctGeom.cols, ctGeom.rows, outerPx, innerPx);
      if (wall.some(v => v === 1)) wallSlices.set(sliceIdx, wall);
    }
    if (wallSlices.size === 0) return null;

    const wallName = `${seg.name}_Wall`;
    const color = newColor || seg.color;
    const newId = await addSegment(wallName, color, 'AVOIDANCE');
    const dstMap = masksRef.current.get(newId);
    if (dstMap) {
      for (const [sliceIdx, wall] of wallSlices) dstMap.set(sliceIdx, wall);
    }
    setDirty(true);
    bump();
    return newId;
  }, [activeSegmentId, activeSegment, ctGeom, addSegment, bump]);

  /**
   * Multi-plane brush stroke (Eclipse multi-plane contouring MVP).
   * Writes into the axial per-slice mask map so save/export stay unchanged.
   *
   * @param {'coronal'|'sagittal'} orientation
   * @param {number} planeCoord - yIdx for coronal, xIdx for sagittal
   * @param {{u0,v0,u1,v1}} line - plane pixel coords (u = in-plane column, v = slice)
   * @param {number} brushSizeMm
   * @param {0|1} value
   */
  const paintOnPlane = useCallback((orientation, planeCoord, line, brushSizeMm, value = 1) => {
    const seg = activeSegment();
    if (!seg || seg.approved || !ctGeom) return;
    const numSlices = ctFiles.length;
    if (numSlices === 0) return;
    const spacing = ctGeom.pixelSpacing?.j || 1;
    const rPx = Math.max(1, (brushSizeMm / 2) / spacing);
    const sliceMap = masksRef.current.get(activeSegmentId);
    if (!sliceMap) return;

    // one composite undo covering every slice this stroke may touch
    const vLo = Math.max(0, Math.floor(Math.min(line.v0, line.v1) - rPx - 1));
    const vHi = Math.min(numSlices - 1, Math.ceil(Math.max(line.v0, line.v1) + rPx + 1));
    const group = [];
    for (let s = vLo; s <= vHi; s++) {
      if (!sliceMap.has(s)) sliceMap.set(s, new Uint8Array(ctGeom.cols * ctGeom.rows));
      group.push({ sliceIdx: s, data: sliceMap.get(s).slice() });
    }
    const h = historyRef.current;
    h.past.push({ segId: activeSegmentId, group });
    if (h.past.length > 20) h.past.shift();
    h.future.length = 0;

    const getSlice = (s) => {
      if (!sliceMap.has(s)) sliceMap.set(s, new Uint8Array(ctGeom.cols * ctGeom.rows));
      return sliceMap.get(s);
    };
    const setSlice = (s, m) => sliceMap.set(s, m);

    if (orientation === 'coronal') {
      stampLineCoronal(getSlice, setSlice, ctGeom.cols, ctGeom.rows, numSlices,
        planeCoord, line.u0, line.v0, line.u1, line.v1, rPx, value);
    } else {
      stampLineSagittal(getSlice, setSlice, ctGeom.cols, ctGeom.rows, numSlices,
        planeCoord, line.u0, line.v0, line.u1, line.v1, rPx, value);
    }
    setDirty(true);
    bump();
    refreshHistoryInfo();
  }, [activeSegmentId, activeSegment, ctGeom, ctFiles, bump, refreshHistoryInfo]);

  /** Shared helper: snapshot slices spanned by a plane stroke (v range). */
  const withPlaneUndo = useCallback((vLo, vHi, fn) => {
    const seg = activeSegment();
    if (!seg || seg.approved || !ctGeom) return null;
    const sliceMap = masksRef.current.get(activeSegmentId);
    if (!sliceMap) return null;
    const numSlices = ctFiles.length;
    const lo = Math.max(0, Math.floor(vLo));
    const hi = Math.min(numSlices - 1, Math.ceil(vHi));
    const group = [];
    for (let s = lo; s <= hi; s++) {
      if (!sliceMap.has(s)) sliceMap.set(s, new Uint8Array(ctGeom.cols * ctGeom.rows));
      group.push({ sliceIdx: s, data: sliceMap.get(s).slice() });
    }
    const h = historyRef.current;
    h.past.push({ segId: activeSegmentId, group });
    if (h.past.length > 20) h.past.shift();
    h.future.length = 0;

    const getSlice = (k) => {
      if (!sliceMap.has(k)) sliceMap.set(k, new Uint8Array(ctGeom.cols * ctGeom.rows));
      return sliceMap.get(k);
    };
    const setSlice = (k, m) => sliceMap.set(k, m);
    const result = fn(getSlice, setSlice);
    setDirty(true);
    bump();
    refreshHistoryInfo();
    return result;
  }, [activeSegmentId, activeSegment, ctGeom, ctFiles, bump, refreshHistoryInfo]);

  /** Rectangle fill on a multi-plane (coronal/sagittal). */
  const fillRectOnPlane = useCallback((orientation, planeCoord, rect, value = 1) => {
    if (!ctGeom) return;
    const numSlices = ctFiles.length;
    const vLo = Math.min(rect.v0, rect.v1);
    const vHi = Math.max(rect.v0, rect.v1);
    return withPlaneUndo(vLo - 1, vHi + 1, (getSlice, setSlice) => {
      if (orientation === 'coronal') {
        fillRectCoronal(getSlice, setSlice, ctGeom.cols, ctGeom.rows, numSlices, planeCoord, rect, value);
      } else {
        fillRectSagittal(getSlice, setSlice, ctGeom.cols, ctGeom.rows, numSlices, planeCoord, rect, value);
      }
    });
  }, [ctGeom, ctFiles, withPlaneUndo]);

  /** Crop keepInside/keepOutside a rect on a multi-plane (affects that plane column only). */
  const cropOnPlane = useCallback((orientation, planeCoord, rect, mode = 'keepInside') => {
    if (!ctGeom) return 0;
    const numSlices = ctFiles.length;
    return withPlaneUndo(0, numSlices - 1, (getSlice, setSlice) => {
      if (orientation === 'coronal') {
        return cropCoronal(getSlice, setSlice, ctGeom.cols, ctGeom.rows, numSlices, planeCoord, rect, mode);
      }
      return cropSagittal(getSlice, setSlice, ctGeom.cols, ctGeom.rows, numSlices, planeCoord, rect, mode);
    }) ?? 0;
  }, [ctGeom, ctFiles, withPlaneUndo]);

  /**
   * HU flood fill on a multi-plane.
   * @param {Float32Array} planeHu - plane HU pixels (coronal cols×numSlices / sagittal rows×numSlices)
   */
  const floodFillOnPlane = useCallback((orientation, planeCoord, seed, planeHu, huTolerance = 50) => {
    if (!ctGeom || !planeHu) return 0;
    const numSlices = ctFiles.length;
    // seed only touches nearby slices for undo; flood may span more — snapshot all
    return withPlaneUndo(0, numSlices - 1, (getSlice, setSlice) => {
      if (orientation === 'coronal') {
        return floodFillCoronal(planeHu, getSlice, setSlice, ctGeom.cols, ctGeom.rows, numSlices,
          planeCoord, seed.u, seed.v, huTolerance, 1);
      }
      return floodFillSagittal(planeHu, getSlice, setSlice, ctGeom.cols, ctGeom.rows, numSlices,
        planeCoord, seed.u, seed.v, huTolerance, 1);
    }) ?? 0;
  }, [ctGeom, ctFiles, withPlaneUndo]);

  const activeSegmentApproved = !!(segments.find(s => s.id === activeSegmentId)?.approved);

  return {
    segments, activeSegmentId, setActiveSegmentId, activeSegmentApproved,
    masks: masksRef.current,
    tool, setTool, brushSizeMm, setBrushSizeMm,
    cropMode, setCropMode,
    paintVersion, bump,
    dirty, saving, loading, loadError,
    canUndo: historyInfo.canUndo, canRedo: historyInfo.canRedo,
    strokeStart, strokeEnd, undo, redo,
    floodFillAt, applyBoolean, expandActive, autoBodyOnSlice,
    cleanupActive, cropActiveOnSlice, cropActiveAllSlices, extractWallFromActive,
    paintOnPlane, fillRectOnPlane, cropOnPlane, floodFillOnPlane,
    addSegment, addSegmentFromDictionary, updateSegment, deleteSegment, save,
    loadFromServer, getMask,
  };
}

export default useContouring;
