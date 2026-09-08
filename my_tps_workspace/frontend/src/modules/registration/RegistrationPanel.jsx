import { useEffect, useMemo, useState } from 'react';
import { Box, Typography, TextField, Button, Slider, MenuItem, Tooltip, Divider } from '@mui/material';
import { AutoMode, RestartAlt, Save } from '@mui/icons-material';
import { identity4, axialTransform, decomposeAxial, intensityCentroid } from '../../lib/registrationMath.js';
import { imageToHU } from '../contouring/paintCore.js';
import * as cornerstone from '@cornerstonejs/core';

const IMAGE_MODALITIES = ['CT', 'MR', 'PT'];

/**
 * RegistrationPanel - right-sidebar controls for the registration module:
 * pick fixed/moving series, adjust the in-plane rigid transform (θ, tx, ty),
 * run centroid auto-match, and save/load the registration.
 *
 * @param {Object} props
 * @param {number} props.studyId
 * @param {Array} props.files - all DICOM file rows of the study
 * @param {string} props.fixedSeriesUid - series shown in the shared viewport
 * @param {Function} props.onMovingChange - ({ movingUid, files, movingIndex, matrix }) => void
 * @param {number|null} props.currentSliceIdx - displayed fixed slice index
 * @param {Object|null} props.ctGeom - geometry of the displayed fixed slice
 * @param {number|null} props.ctZ - fixed slice z (patient mm)
 * @param {Function} props.getCtHuPixels - () => Float32Array HU of displayed slice
 */
export default function RegistrationPanel({
  studyId,
  files,
  fixedSeriesUid,
  onMovingChange,
  currentSliceIdx = null,
  ctGeom,
  ctZ,
  getCtHuPixels,
}) {
  const seriesOptions = useMemo(() => {
    const bySeries = new Map();
    for (const f of files) {
      if (!IMAGE_MODALITIES.includes(f.modality)) continue;
      if (!bySeries.has(f.series_instance_uid)) {
        bySeries.set(f.series_instance_uid, {
          seriesUid: f.series_instance_uid,
          modality: f.modality,
          count: 0,
          files: [],
        });
      }
      const s = bySeries.get(f.series_instance_uid);
      s.count++;
      s.files.push(f);
    }
    return [...bySeries.values()].map(s => ({
      ...s,
      files: s.files.sort((a, b) => (a.instance_number ?? 0) - (b.instance_number ?? 0)),
    }));
  }, [files]);

  const [movingUid, setMovingUid] = useState('');
  const [theta, setTheta] = useState('0');
  const [tx, setTx] = useState('0');
  const [ty, setTy] = useState('0');
  const [opacity, setOpacity] = useState(0.5);
  const [lastMethod, setLastMethod] = useState('MANUAL');
  const [savedNote, setSavedNote] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const moving = seriesOptions.find(s => s.seriesUid === movingUid) ?? null;

  // moving image centre = rotation centre for the axial transform
  const rotationCentre = useMemo(() => {
    if (!moving) return null;
    const f0 = moving.files[0];
    return [
      (f0.image_position_x ?? 0) + (f0.columns ?? 512) * (f0.pixel_spacing_y ?? 1) / 2,
      (f0.image_position_y ?? 0) + (f0.rows ?? 512) * (f0.pixel_spacing_x ?? 1) / 2,
    ];
  }, [moving]);

  const matrix = useMemo(
    () => axialTransform(Number(theta) || 0, Number(tx) || 0, Number(ty) || 0, rotationCentre ?? [0, 0]),
    [theta, tx, ty, rotationCentre],
  );

  const movingIndex = useMemo(() => {
    if (!moving) return 0;
    return Math.min(currentSliceIdx ?? 0, moving.files.length - 1);
  }, [moving, currentSliceIdx]);

  // push selection up to the overlay
  useEffect(() => {
    onMovingChange?.({ movingUid, files: moving?.files ?? null, movingIndex, matrix });
  }, [movingUid, moving, movingIndex, matrix, onMovingChange]);

  // load the saved registration when the pair changes
  useEffect(() => {
    if (!movingUid) return;
    let alive = true;
    (async () => {
      try {
        const res = await fetch(
          `/api/registration/study/${studyId}/latest?fixed=${encodeURIComponent(fixedSeriesUid)}&moving=${encodeURIComponent(movingUid)}`,
          { credentials: 'include' },
        );
        if (!res.ok) return;
        const { registration } = await res.json();
        if (alive && registration) {
          const { thetaDeg, tx: x, ty: y } = decomposeAxial(registration.matrix, rotationCentre ?? [0, 0]);
          setTheta(String(Number(thetaDeg.toFixed(2))));
          setTx(String(Number(x.toFixed(2))));
          setTy(String(Number(y.toFixed(2))));
          setLastMethod(registration.method);
          setSavedNote(`loaded saved registration (method ${registration.method})`);
        }
      } catch { /* keep defaults */ }
    })();
    return () => { alive = false; };
  }, [studyId, fixedSeriesUid, movingUid]);

  const reset = () => { setTheta('0'); setTx('0'); setTy('0'); setLastMethod('MANUAL'); setSavedNote(''); };

  const autoMatch = async () => {
    setError('');
    if (!moving) return;
    setBusy(true);
    try {
      const fixedHu = getCtHuPixels?.();
      if (!fixedHu || !ctGeom || ctZ == null) throw new Error('Fixed slice not ready');
      const fixedC = intensityCentroid(fixedHu, ctGeom, ctZ);

      const file = moving.files[movingIndex];
      const url = await new Promise((resolve, reject) => {
        fetch(`/api/files/signed-url/${file.id}`, { credentials: 'include' })
          .then(r => (r.ok ? r.json() : reject(new Error('signed url failed'))))
          .then(d => resolve(d.url));
      });
      const image = await cornerstone.imageLoader.loadAndCacheImage(`wadouri:${window.location.origin}${url}`);
      const hu = imageToHU(image);
      const movingGeom = {
        imagePosition: { x: file.image_position_x ?? 0, y: file.image_position_y ?? 0, z: file.image_position_z ?? 0 },
        pixelSpacing: { i: file.pixel_spacing_x ?? 1, j: file.pixel_spacing_y ?? 1 },
        cols: image.columns,
        rows: image.rows,
      };
      const movingC = intensityCentroid(hu, movingGeom, file.image_position_z ?? 0);
      if (!fixedC || !movingC) throw new Error('Centroid failed — check intensity thresholds');

      setTx(String(Number((fixedC[0] - movingC[0]).toFixed(2))));
      setTy(String(Number((fixedC[1] - movingC[1]).toFixed(2))));
      setLastMethod('AUTO_CENTROID');
      setSavedNote('');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    setError('');
    setBusy(true);
    try {
      const res = await fetch(`/api/registration/study/${studyId}`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fixedSeriesUid,
          movingSeriesUid: movingUid,
          matrix,
          method: lastMethod,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'Failed to save registration');
      }
      setSavedNote('registration saved');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const nudge = (setter, current, delta) => setter(String(Number((Number(current) + delta).toFixed(2))));

  return (
    <Box sx={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 1, overflow: 'auto' }}>
      <Typography variant="caption" sx={{ px: 1, py: 0.5, color: 'text.secondary', fontFamily: 'mono',
            borderBottom: '1px solid rgba(88,196,220,0.12)' }}>
        REGISTRATION
      </Typography>

      <Box sx={{ px: 1.5, py: 1, display: 'flex', flexDirection: 'column', gap: 1 }}>
        <TextField size="small" select label="Fixed series (viewport)" value={fixedSeriesUid} disabled
                   inputProps={{ style: { fontSize: '0.7rem' } }}>
          <MenuItem value={fixedSeriesUid}>{fixedSeriesUid.slice(0, 18)}…</MenuItem>
        </TextField>
        <TextField size="small" select label="Moving series (overlay)" value={movingUid}
                   onChange={e => { setMovingUid(e.target.value); setSavedNote(''); }}
                   inputProps={{ style: { fontSize: '0.7rem' } }}>
          <MenuItem value="" sx={{ fontSize: '0.7rem' }}>— none —</MenuItem>
          {seriesOptions.map(s => (
            <MenuItem key={s.seriesUid} value={s.seriesUid} sx={{ fontSize: '0.7rem' }}>
              {s.modality} · {s.count} slices{s.seriesUid === fixedSeriesUid ? ' · self' : ''}
            </MenuItem>
          ))}
        </TextField>

        <Divider sx={{ my: 0.25 }} />

        {([
          ['Rotation θ (°)', theta, setTheta, 0.5, 'rot'],
          ['Translate X (mm)', tx, setTx, 0.5, 'tx'],
          ['Translate Y (mm)', ty, setTy, 0.5, 'ty'],
        ]).map(([label, value, setter, step, key]) => (
          <Box key={key} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="caption" sx={{ fontSize: '0.6rem', color: 'text.secondary', width: 86, whiteSpace: 'nowrap' }}>
              {label}
            </Typography>
            <Slider size="small" value={Number(value) || 0} min={-30} max={30} step={step}
                    aria-label={`transform-${key}-slider`}
                    onChange={(_, v) => setter(String(v))} sx={{ color: '#58c4dc', flex: 1, minWidth: 40 }} />
            <TextField size="small" value={value} onChange={e => setter(e.target.value)}
                       inputProps={{ 'aria-label': `transform-${key}`, style: { fontSize: '0.62rem', padding: '1px 2px' } }}
                       sx={{ width: 54 }} />
          </Box>
        ))}

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="caption" sx={{ fontSize: '0.6rem', color: 'text.secondary', width: 86 }}>
            Overlay opacity
          </Typography>
          <Slider size="small" value={opacity} min={0} max={1} step={0.05}
                  onChange={(_, v) => setOpacity(v)} sx={{ color: '#58c4dc', flex: 1 }} />
          <Typography variant="caption" sx={{ fontSize: '0.6rem', fontFamily: 'mono', width: 28 }}>
            {opacity.toFixed(2)}
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <Button size="small" variant="outlined" startIcon={<AutoMode fontSize="small" />}
                  disabled={busy || !moving} onClick={autoMatch}
                  sx={{ fontSize: '0.6rem', flex: 1, color: 'text.secondary', borderColor: 'rgba(88,196,220,0.3)' }}>
            Auto Match
          </Button>
          <Button size="small" variant="outlined" startIcon={<RestartAlt fontSize="small" />}
                  onClick={reset}
                  sx={{ fontSize: '0.6rem', color: 'text.secondary', borderColor: 'rgba(88,196,220,0.3)' }}>
            Reset
          </Button>
        </Box>

        <Tooltip title="Save the current transform for this series pair">
          <span>
            <Button size="small" variant="contained" startIcon={<Save fontSize="small" />}
                    disabled={busy || !moving} onClick={save} sx={{ fontSize: '0.65rem' }}>
              Save Registration
            </Button>
          </span>
        </Tooltip>

        {savedNote && (
          <Typography variant="caption" sx={{ fontSize: '0.6rem', color: 'primary.main' }}>
            {savedNote}
          </Typography>
        )}
        {error && <Typography variant="caption" color="error" sx={{ fontSize: '0.6rem' }}>{error}</Typography>}
        <Typography variant="caption" sx={{ fontSize: '0.55rem', color: 'text.disabled' }}>
          Manual in-plane matching (axial). Overlay = moving series with the
          current transform; saved registrations reload per series pair.
        </Typography>
      </Box>
    </Box>
  );
}
