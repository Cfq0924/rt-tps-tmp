import { useEffect, useMemo, useState } from 'react';
import {
  collectStructureDose,
  computeDVH,
  doseStats,
} from '../../lib/dvh.js';

const DVH_BIN_WIDTH = 20; // cGy per bin

/**
 * DVH module state: structure sources (RTSTRUCT ROIs + painted segments),
 * selection, and the per-structure dose statistics / cumulative DVH
 * computation. Shared by the sidebar controls and the main-area DVH pane.
 *
 * @param {Object} params
 * @param {Array} params.roiSequence - ROI list from /api/rtstruct
 * @param {Array} params.contourSequence - contours from /api/rtstruct
 * @param {Array} params.paintedSegments - [{ id, name, color, slices }]
 * @param {Float32Array|null} params.doseGrid
 * @param {Object|null} params.doseMeta
 * @param {Array} params.ctFiles - CT files slice-ordered
 */
export function useDvh({ roiSequence = [], contourSequence = [], paintedSegments = [], doseGrid, doseMeta, ctFiles }) {
  const [selected, setSelected] = useState([]); // [{key, name, color, slices}]
  const [results, setResults] = useState([]); // [{key, name, color, stats, dvh}]
  const doseReady = !!(doseGrid && doseMeta);

  const allSources = useMemo(() => {
    const rtSources = roiSequence.map(roi => {
      const bySlice = new Map();
      for (const c of contourSequence) {
        if (c.referencedROINumber !== roi.roiNumber) continue;
        const uid = c.referencedSOPInstanceUID;
        if (!bySlice.has(uid)) bySlice.set(uid, []);
        bySlice.get(uid).push(c.contourData);
      }
      const slices = [...bySlice.entries()].map(([sopInstanceUID, contours]) => ({ sopInstanceUID, contours }));
      return {
        key: `rtstruct-${roi.roiNumber}`, name: roi.roiName,
        color: `rgb(${roi.displayColor?.r ?? 88},${roi.displayColor?.g ?? 196},${roi.displayColor?.b ?? 220})`,
        slices,
      };
    });
    const painted = paintedSegments.map(s => ({
      key: `painted-${s.id}`, name: s.name, color: s.color, slices: s.slices ?? [],
    }));
    return [...rtSources, ...painted];
  }, [roiSequence, contourSequence, paintedSegments]);

  const toggle = (key) => {
    setSelected(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
  };

  // Eclipse-style: when dose data is first ready, preselect targets and key
  // OARs so the DVH opens populated instead of empty (user toggles win after)
  useEffect(() => {
    if (!doseReady || allSources.length === 0) return;
    setSelected(prev => {
      if (prev.length > 0) return prev;
      const pick = (re) => allSources.filter(s => re.test(s.name)).map(s => s.key);
      return [
        ...pick(/PTV/i), ...pick(/GTV|CTV/i),
        ...pick(/CORD|BRAIN ?STEM/i), ...pick(/PAROTID/i),
      ].slice(0, 8);
    });
  }, [doseReady, allSources]);

  // (re)compute DVH when selection or dose changes
  useEffect(() => {
    if (!doseReady) { setResults([]); return; }
    const out = [];
    for (const src of allSources) {
      if (!selected.includes(src.key)) continue;
      const { values, voxelVolumeMm3 } = collectStructureDose(
        { slices: src.slices }, doseGrid, doseMeta, ctFiles, null,
        // real rasterizer injected to keep this module dependency-light
        (mask, cols, rows, polys, v) => {
          for (const poly of polys) {
            const n = poly.length / 2;
            if (n < 3) continue;
            const jMin = Math.max(0, Math.ceil(Math.min(...poly.filter((_, i) => i % 2 === 1))));
            const jMax = Math.min(rows - 1, Math.floor(Math.max(...poly.filter((_, i) => i % 2 === 1))));
            for (let j = jMin; j <= jMax; j++) {
              const xs = [];
              for (let e = 0; e < n; e++) {
                const xa = poly[e * 2], ya = poly[e * 2 + 1];
                const xb = poly[((e + 1) % n) * 2], yb = poly[((e + 1) % n) * 2 + 1];
                if ((ya <= j && yb > j) || (yb <= j && ya > j)) {
                  xs.push(xa + ((j - ya) / (yb - ya)) * (xb - xa));
                }
              }
              xs.sort((a, b) => a - b);
              for (let k = 0; k + 1 < xs.length; k += 2) {
                const xa = Math.max(0, Math.ceil(xs[k]));
                const xb = Math.min(cols - 1, Math.floor(xs[k + 1]));
                for (let i = xa; i <= xb; i++) mask[j * cols + i] = v;
              }
            }
          }
        },
        // patient → dose voxel column/row (axial HFS)
        (patientP, dg) => ({
          i: (patientP[0] - dg.imagePosition.x) / dg.pixelSpacing.j,
          j: (patientP[1] - dg.imagePosition.y) / dg.pixelSpacing.i,
        }),
      );
      if (values.length === 0) continue;
      const stats = doseStats(values);
      out.push({
        key: src.key, name: src.name, color: src.color,
        dvh: computeDVH(values, DVH_BIN_WIDTH),
        stats: {
          ...stats,
          volumeCm3: (values.length * voxelVolumeMm3 / 1000),
        },
      });
    }
    setResults(out);
  }, [selected, allSources, doseReady, doseGrid, doseMeta, ctFiles]);

  return {
    allSources,
    selected,
    toggle,
    select: setSelected,
    results,
    doseReady,
    binWidth: DVH_BIN_WIDTH,
  };
}

export default useDvh;
