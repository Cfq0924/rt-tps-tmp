import { useEffect, useMemo, useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, FormControlLabel,
  Checkbox, MenuItem, TextField, Typography, Alert, CircularProgress, Chip, Box,
} from '@mui/material';
import { CloudUpload } from '@mui/icons-material';

const SENDABLE_MODALITIES = ['RTSTRUCT', 'RTPLAN', 'RTDOSE'];

/**
 * SendToPacsDialog - Phase 4 M5: push stored DICOM files of this study to a
 * configured C-STORE destination. Defaults to the RT objects of the study.
 *
 * @param {Object} props
 * @param {boolean} props.open
 * @param {Function} props.onClose
 * @param {number} props.studyId
 * @param {Array} props.files - study file rows ({id, file_name, modality})
 */
export default function SendToPacsDialog({ open, onClose, studyId, files = [] }) {
  const [destinations, setDestinations] = useState([]);
  const [destinationId, setDestinationId] = useState('');
  const [selected, setSelected] = useState(new Set());
  const [busy, setBusy] = useState(false);
  const [loadingDest, setLoadingDest] = useState(false);
  const [error, setError] = useState('');
  const [results, setResults] = useState(null);

  const sendable = useMemo(
    () => files.filter(f => SENDABLE_MODALITIES.includes(f.modality)),
    [files],
  );

  useEffect(() => {
    if (!open) return;
    setResults(null);
    setError('');
    setSelected(new Set(sendable.map(f => f.id)));
    setLoadingDest(true);
    fetch('/api/pacs/destinations', { credentials: 'include' })
      .then(r => (r.ok ? r.json() : Promise.reject(new Error('Failed to load destinations'))))
      .then(d => {
        setDestinations(d.destinations ?? []);
        if ((d.destinations ?? []).length > 0) setDestinationId(d.destinations[0].id);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoadingDest(false));
  }, [open, sendable]);

  const toggle = (id) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const send = async () => {
    setError('');
    setBusy(true);
    setResults(null);
    try {
      const res = await fetch('/api/pacs/send', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ destinationId, fileIds: [...selected] }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || 'Send failed');
      setResults(d);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontSize: '0.9rem' }}>Send to PACS (C-STORE)</DialogTitle>
      <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        {loadingDest ? <CircularProgress size={22} sx={{ alignSelf: 'center' }} /> : (
          <>
            {destinations.length === 0 && (
              <Alert severity="warning" sx={{ fontSize: '0.7rem' }}>
                No PACS destinations configured. Seed PACS_AET/PACS_HOST/PACS_PORT in the
                backend environment or POST /api/pacs/destinations.
              </Alert>
            )}
            {destinations.length > 0 && (
              <TextField size="small" select label="Destination" value={destinationId}
                         onChange={e => setDestinationId(e.target.value)}>
                {destinations.map(d => (
                  <MenuItem key={d.id} value={d.id}>
                    {d.name} — {d.aet}@{d.host}:{d.port}
                  </MenuItem>
                ))}
              </TextField>
            )}

            <Typography variant="caption" sx={{ fontSize: '0.65rem', color: 'text.secondary' }}>
              Files ({selected.size} of {sendable.length} selected)
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', maxHeight: 220, overflow: 'auto' }}>
              {sendable.map(f => (
                <FormControlLabel key={f.id} sx={{ py: 0 }}
                  control={<Checkbox size="small" checked={selected.has(f.id)} onChange={() => toggle(f.id)} />}
                  label={
                    <Typography variant="caption" sx={{ fontSize: '0.65rem', fontFamily: 'mono' }}>
                      {f.file_name}
                    </Typography>
                  }
                />
              ))}
              {sendable.length === 0 && (
                <Typography variant="caption" sx={{ fontSize: '0.65rem', color: 'text.disabled' }}>
                  No RT objects in this study.
                </Typography>
              )}
            </Box>

            {results && (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                <Chip
                  size="small"
                  color={results.failed === 0 ? 'success' : 'warning'}
                  label={`${results.sent} sent, ${results.failed} failed → ${results.destination?.name ?? ''}`}
                  sx={{ alignSelf: 'flex-start' }}
                />
                {results.results.map(r => (
                  <Typography key={r.fileId} variant="caption" sx={{ fontSize: '0.6rem', fontFamily: 'mono' }}>
                    {r.ok ? '✔' : '✗'} {r.fileName ?? `#${r.fileId}`} — {r.detail}
                  </Typography>
                ))}
              </Box>
            )}
            {error && <Alert severity="error" sx={{ fontSize: '0.7rem' }}>{error}</Alert>}
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button size="small" onClick={onClose} disabled={busy}>Close</Button>
        <Button size="small" variant="contained" startIcon={<CloudUpload />}
                onClick={send}
                disabled={busy || !destinationId || selected.size === 0}>
          {busy ? <CircularProgress size={16} /> : 'Send'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
