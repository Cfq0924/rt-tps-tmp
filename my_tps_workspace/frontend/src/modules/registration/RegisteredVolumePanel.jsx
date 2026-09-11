import { useEffect, useMemo, useRef, useState } from 'react';
import { Box, Typography, Button, Slider, Alert } from '@mui/material';
import { AutoFixHigh, Save } from '@mui/icons-material';
import { loadVolume, huToRGBA } from '../../lib/mprVolume.js';
import { geomFromFiles, resampleRigid } from '../../lib/resampleVolume.js';
import { imageToHU } from '../contouring/paintCore.js';
import * as cornerstone from '@cornerstonejs/core';

/**
 * RegisteredVolumePanel - Phase 4 M1: rigidly resample the moving series onto
 * the fixed grid in-browser (trilinear, saved transform), preview fixed vs
 * resampled axial slices with an alignment metric, and persist the derived
 * series provenance. v1 keeps pixels in the browser cache; the DICOM
 * write-out of the derived series is a later step.
 *
 * @param {Object} props
 * @param {number} props.studyId
 * @param {Array} props.files - all DICOM file rows of the study
 * @param {string} props.fixedSeriesUid
 * @param {Array|null} props.movingFiles - sorted moving-series file rows
 * @param {number[][]} props.matrix - moving→fixed 4×4 (current panel transform)
 * @param {number|null} props.registrationId - saved registration row (if any)
 */
export default function RegisteredVolumePanel({
  studyId,
  files,
  fixedSeriesUid,
  movingFiles,
  matrix,
  registrationId = null,
}) {
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(null);
  const [result, setResult] = useState(null); // { volume, geom, metrics }
  const [sliceIdx, setSliceIdx] = useState(null);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const fixedCanvasRef = useRef(null);
  const resampledCanvasRef = useRef(null);

  const fixedFiles = useMemo(() => {
    const rows = files.filter(f => f.series_instance_uid === fixedSeriesUid);
    return rows.sort((a, b) => (a.instance_number ?? 0) - (b.instance_number ?? 0));
  }, [files, fixedSeriesUid]);

  const fixedGeom = useMemo(
    () => (fixedFiles.length ? geomFromFiles(fixedFiles) : null),
    [fixedFiles],
  );

  const getSignedUrl = async (fileId) => {
    const r = await fetch(`/api/files/signed-url/${fileId}`, { credentials: 'include' });
    if (!r.ok) throw new Error('signed url failed');
    const d = await r.json();
    return d.url;
  };

  const loadFixedSliceHU = async (k) => {
    const file = fixedFiles[k];
    if (!file) return null;
    const url = await getSignedUrl(file.id);
    const image = await cornerstone.imageLoader.loadAndCacheImage(`wadouri:${window.location.origin}${url}`);
    return imageToHU(image);
  };

  const drawHU = (canvasRef, hu, cols, rows) => {
    const canvas = canvasRef.current;
    if (!canvas || !hu) return;
    canvas.width = cols;
    canvas.height = rows;
    const ctx = canvas.getContext('2d');
    ctx.putImageData(new ImageData(huToRGBA(hu, 40, 400), cols, rows), 0, 0);
  };

  const meanAbsDiff = async (resampled, k, span = 2) => {
    let sum = 0, n = 0;
    for (let kk = Math.max(0, k - span); kk <= Math.min(fixedGeom.numSlices - 1, k + span); kk += span) {
      const fixedHu = await loadFixedSliceHU(kk);
      if (!fixedHu) continue;
      const off = kk * fixedGeom.rows * fixedGeom.cols;
      for (let idx = 0; idx < fixedHu.length; idx++) {
        const rv = resampled[off + idx];
        if (rv > -999) { sum += Math.abs(rv - fixedHu[idx]); n++; }
      }
    }
    return n ? sum / n : null;
  };

  const generate = async () => {
    setError(''); setNote(''); setBusy(true); setProgress({ loaded: 0, total: movingFiles.length });
    try {
      const imageIds = movingFiles.map(() => ''); // built inside loadVolume via getSignedUrl
      const { volume: movingVolume, geom: movingGeom } = await loadVolume({
        imageIds,
        files: movingFiles,
        getSignedUrl,
        onProgress: (loaded, total) => setProgress({ loaded, total }),
      });
      setNote('Resampling onto the fixed grid…');
      const resampled = resampleRigid({
        srcVolume: movingVolume, srcGeom: movingGeom, dstGeom: fixedGeom, matrix,
      });
      const metrics = { meanAbsDiff: await meanAbsDiff(resampled, Math.floor(fixedGeom.numSlices / 2)) };
      setResult({ volume: resampled, geom: fixedGeom, metrics });
      setSliceIdx(Math.floor(fixedGeom.numSlices / 2));
      setNote('Registered volume ready (browser cache — DICOM write-out comes later)');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false); setProgress(null);
    }
  };

  // redraw whenever the slice or the result changes
  useEffect(() => {
    if (!result || sliceIdx == null) return;
    const off = sliceIdx * result.geom.rows * result.geom.cols;
    const resliced = result.volume.slice(off, off + result.geom.rows * result.geom.cols);
    drawHU(resampledCanvasRef, resliced, result.geom.cols, result.geom.rows);
    loadFixedSliceHU(sliceIdx)
      .then(fixedHu => drawHU(fixedCanvasRef, fixedHu, result.geom.cols, result.geom.rows))
      .catch(() => drawHU(fixedCanvasRef, null));
  }, [result, sliceIdx]);

  const save = async () => {
    setError('');
    try {
      const seriesUid = `2.25.${BigInt('0x' + crypto.randomUUID().replaceAll('-', ''))}`;
      const res = await fetch(`/api/registration/study/${studyId}/derived-series`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fixedSeriesUid,
          movingSeriesUid: movingFiles[0]?.series_instance_uid,
          seriesUid,
          description: 'Registered (rigid resample)',
          geometry: result.geom,
          matrix,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'Failed to save derived series');
      }
      setNote(`Derived series saved (${seriesUid.slice(0, 18)}…, metadata)`);
    } catch (err) {
      setError(err.message);
    }
  };

  if (!movingFiles || !fixedGeom) return null;

  return (
    <Box sx={{ px: 1.5, py: 1, display: 'flex', flexDirection: 'column', gap: 0.75,
               borderTop: '1px solid rgba(88,196,220,0.12)' }}>
      <Typography variant="caption" sx={{ fontSize: '0.62rem', color: 'text.secondary', fontFamily: 'mono' }}>
        REGISTERED VOLUME (rigid resample)
      </Typography>
      <Button size="small" variant="outlined" startIcon={<AutoFixHigh fontSize="small" />}
              disabled={busy}
              onClick={generate}
              sx={{ fontSize: '0.6rem', color: 'text.secondary', borderColor: 'rgba(88,196,220,0.3)' }}>
        {busy ? 'Working…' : 'Generate registered volume'}
      </Button>
      {progress && (
        <Typography variant="caption" sx={{ fontSize: '0.58rem', color: 'text.disabled', fontFamily: 'mono' }}>
          loading moving series {progress.loaded}/{progress.total}
        </Typography>
      )}
      {error && <Alert severity="error" sx={{ py: 0, fontSize: '0.6rem' }}>{error}</Alert>}

      {result && (
        <>
          <Box sx={{ display: 'flex', gap: 0.75 }}>
            <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 0.25 }}>
              <Typography variant="caption" sx={{ fontSize: '0.55rem', color: 'text.disabled' }}>fixed</Typography>
              <canvas ref={fixedCanvasRef} style={{ width: '100%', imageRendering: 'pixelated', borderRadius: 2 }} />
            </Box>
            <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 0.25 }}>
              <Typography variant="caption" sx={{ fontSize: '0.55rem', color: 'text.disabled' }}>resampled moving</Typography>
              <canvas ref={resampledCanvasRef} style={{ width: '100%', imageRendering: 'pixelated', borderRadius: 2 }} />
            </Box>
          </Box>
          <Slider size="small" value={sliceIdx} min={0} max={result.geom.numSlices - 1}
                  onChange={(_, v) => setSliceIdx(v)}
                  sx={{ py: 0.25, color: '#58c4dc' }} aria-label="registered-slice" />
          <Typography variant="caption" sx={{ fontSize: '0.58rem', fontFamily: 'mono', color: 'text.secondary' }}>
            slice {sliceIdx}/{result.geom.numSlices - 1}
            {result.metrics.meanAbsDiff != null && <> · mean |ΔHU| = {result.metrics.meanAbsDiff.toFixed(1)} (lower = aligned)</>}
          </Typography>
          <Button size="small" variant="outlined" startIcon={<Save fontSize="small" />}
                  onClick={save}
                  sx={{ fontSize: '0.6rem', color: 'text.secondary', borderColor: 'rgba(88,196,220,0.3)' }}>
            Save derived series (metadata)
          </Button>
        </>
      )}
      {note && <Typography variant="caption" sx={{ fontSize: '0.58rem', color: 'text.disabled' }}>{note}</Typography>}
    </Box>
  );
}
