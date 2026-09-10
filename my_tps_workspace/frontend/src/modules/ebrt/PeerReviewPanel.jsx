import { useEffect, useState, useCallback } from 'react';
import { Box, Typography, Button, TextField, Checkbox, FormControlLabel, Chip, Divider, Tooltip } from '@mui/material';
import { RateReview, Send, Check, Close, MyLocation } from '@mui/icons-material';

/**
 * PeerReviewPanel - RT peer review (Eclipse Ch5) for a workspace plan:
 * open a review session on a REVIEWED plan, comment with optional slice
 * pins, then close with APPROVED / UNAPPROVED (which updates the plan's
 * approval status server-side).
 *
 * @param {Object} props
 * @param {Object} props.plan - selected workspace plan (with approvalStatus)
 * @param {number|null} props.currentSliceIdx - displayed CT slice (for pins)
 * @param {Function} props.onJumpToSlice - (sliceIdx) => void
 * @param {Function} props.onPlanUpdated - called after a decision changes the plan
 */
export default function PeerReviewPanel({ plan, currentSliceIdx, onJumpToSlice, onPlanUpdated }) {
  const [couch, setCouch] = useState({ vrt: '', lng: '', lat: '' });
  const [sessions, setSessions] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null); // full session incl. comments
  const [commentText, setCommentText] = useState('');
  const [pinSlice, setPinSlice] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const fetchSessions = useCallback(async (preferOpen = false) => {
    const res = await fetch(`/api/peer-review/sessions?planId=${plan.id}`, { credentials: 'include' });
    if (!res.ok) throw new Error('Failed to load review sessions');
    const { sessions: rows } = await res.json();
    setSessions(rows);
    setSelectedId(prev => {
      const open = rows.find(s => s.status === 'OPEN');
      if (preferOpen && open) return open.id;
      return rows.some(s => s.id === prev) ? prev : (open?.id ?? rows[0]?.id ?? null);
    });
    return rows;
  }, [plan.id]);

  // load the selected session's comments
  useEffect(() => {
    if (selectedId == null) { setDetail(null); return; }
    let alive = true;
    fetch(`/api/peer-review/sessions/${selectedId}`, { credentials: 'include' })
      .then(res => (res.ok ? res.json() : Promise.reject(new Error('Failed to load session'))))
      .then(d => { if (alive) setDetail(d.session); })
      .catch(() => { if (alive) setDetail(null); });
    return () => { alive = false; };
  }, [selectedId]);

  useEffect(() => {
    setError('');
    fetchSessions().catch(err => setError(err.message));
  }, [fetchSessions]);

  const startReview = async () => {
    setBusy(true); setError('');
    try {
      const res = await fetch(`/api/peer-review/plans/${plan.id}/sessions`, {
        method: 'POST', credentials: 'include',
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'Failed to open review session');
      }
      await fetchSessions(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const addComment = async () => {
    if (!detail || !commentText.trim()) return;
    setBusy(true); setError('');
    try {
      const res = await fetch(`/api/peer-review/sessions/${detail.id}/comments`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: commentText.trim(),
          ...(pinSlice && currentSliceIdx != null ? { location: { sliceIdx: currentSliceIdx } } : {}),
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'Failed to add comment');
      }
      const { session } = await res.json();
      setDetail(session);
      setSessions(prev => prev.map(s => (s.id === session.id ? { ...s, commentCount: session.comments.length } : s)));
      setCommentText('');
      setPinSlice(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const closeWith = async (decision) => {
    if (!detail) return;
    setBusy(true); setError('');
    try {
      const res = await fetch(`/api/peer-review/sessions/${detail.id}/close`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          decision,
          ...(couch.vrt !== '' || couch.lng !== '' || couch.lat !== '' ? {
            // one recorded shift per field (Eclipse Delta Couch Shifts shape)
            deltaCouch: {
              shifts: (plan.beams ?? []).map(b => ({
                fieldId: b.id,
                vrt: Number(couch.vrt) || 0,
                lng: Number(couch.lng) || 0,
                lat: Number(couch.lat) || 0,
              })),
            },
          } : {}),
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'Failed to close session');
      }
      const { session } = await res.json();
      setDetail(session);
      setCouch({ vrt: '', lng: '', lat: '' }); // don't leak shifts into the next session
      setSessions(prev => prev.map(s => (s.id === session.id ? { ...s, status: session.status, decision: session.decision } : s)));
      onPlanUpdated?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const openExists = sessions.some(s => s.status === 'OPEN');

  return (
    <Box sx={{ px: 1.5, py: 1, display: 'flex', flexDirection: 'column', gap: 0.75,
               borderTop: '1px solid rgba(88,196,220,0.12)' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <Typography variant="caption" sx={{ fontSize: '0.62rem', color: 'text.secondary', fontFamily: 'mono' }}>
          PEER REVIEW
        </Typography>
        <Box sx={{ flex: 1 }} />
        <Tooltip title={plan.approvalStatus === 'REVIEWED' ? 'Open a review session for this plan' : 'Plan must be in REVIEWED status'}>
          <span>
            <Button size="small" variant="outlined" startIcon={<RateReview fontSize="small" />}
                    disabled={busy || openExists || plan.approvalStatus !== 'REVIEWED'}
                    onClick={startReview}
                    sx={{ fontSize: '0.55rem', py: 0.1, color: 'text.secondary', borderColor: 'rgba(88,196,220,0.3)' }}>
              Start Session
            </Button>
          </span>
        </Tooltip>
      </Box>

      {error && <Typography variant="caption" color="error" sx={{ fontSize: '0.6rem' }}>{error}</Typography>}

      {/* session list */}
      {sessions.length === 0 && (
        <Typography variant="caption" sx={{ fontSize: '0.58rem', color: 'text.disabled' }}>
          No review sessions yet.
        </Typography>
      )}
      {sessions.map(s => (
        <Box key={s.id} onClick={() => setSelectedId(s.id)}
             sx={{ display: 'flex', alignItems: 'center', gap: 0.5, px: 0.5, py: 0.25, cursor: 'pointer',
                   borderRadius: 0.5, border: '1px solid',
                   borderColor: s.id === selectedId ? 'rgba(88,196,220,0.5)' : 'transparent' }}>
          <Typography variant="caption" sx={{ fontSize: '0.6rem', fontFamily: 'mono', flex: 1 }}>
            Session #{s.id} · {s.commentCount} comment{s.commentCount === 1 ? '' : 's'}
          </Typography>
          <Chip label={s.status} size="small"
                color={s.status === 'OPEN' ? 'warning' : 'default'}
                sx={{ height: 14, fontSize: '0.52rem' }} variant="outlined" />
          {s.decision && (
            <Chip label={s.decision} size="small"
                  color={s.decision === 'APPROVED' ? 'success' : 'error'}
                  sx={{ height: 14, fontSize: '0.52rem' }} variant="outlined" />
          )}
        </Box>
      ))}

      {/* selected session detail */}
      {selectedId != null && detail && (
        <>
          <Divider sx={{ my: 0.25 }} />
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, maxHeight: 260, overflow: 'auto' }}>
            {detail.comments.length === 0 && (
              <Typography variant="caption" sx={{ fontSize: '0.58rem', color: 'text.disabled' }}>
                No comments yet.
              </Typography>
            )}
            {detail.comments.map(cm => (
              <Box key={cm.id} sx={{ px: 0.5, py: 0.25, bgcolor: 'rgba(88,196,220,0.05)', borderRadius: 0.5 }}>
                <Typography variant="caption" sx={{ display: 'block', fontSize: '0.62rem' }}>
                  {cm.text}
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Typography variant="caption" sx={{ fontSize: '0.55rem', color: 'text.disabled', flex: 1 }}>
                    {cm.authorName ?? 'reviewer'} · {cm.createdAt}
                  </Typography>
                  {cm.location?.sliceIdx != null && onJumpToSlice && (
                    <Tooltip title={`Jump to slice ${cm.location.sliceIdx}`}>
                      <Button size="small" variant="text" startIcon={<MyLocation sx={{ fontSize: 11 }} />}
                              onClick={() => onJumpToSlice(cm.location.sliceIdx)}
                              sx={{ fontSize: '0.52rem', minWidth: 0, py: 0, color: 'primary.main' }}>
                        S{cm.location.sliceIdx}
                      </Button>
                    </Tooltip>
                  )}
                </Box>
              </Box>
            ))}
          </Box>

          {detail.status === 'OPEN' ? (
            <>
              <TextField
                size="small" multiline minRows={2} fullWidth label="Review comment"
                value={commentText} onChange={e => setCommentText(e.target.value)}
                inputProps={{ 'aria-label': 'review-comment', style: { fontSize: '0.65rem' } }}
              />
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <FormControlLabel
                  control={<Checkbox size="small" checked={pinSlice}
                                     onChange={e => setPinSlice(e.target.checked)}
                                     sx={{ p: 0.25 }} />}
                  label={<Typography variant="caption" sx={{ fontSize: '0.58rem' }}>
                    Pin current slice {currentSliceIdx != null ? `(${currentSliceIdx + 1})` : ''}
                  </Typography>}
                  sx={{ mr: 0.5 }}
                />
                <Box sx={{ flex: 1 }} />
                <Button size="small" variant="outlined" endIcon={<Send fontSize="small" />}
                        disabled={!commentText.trim() || busy}
                        onClick={addComment}
                        sx={{ fontSize: '0.58rem', py: 0.1 }}>
                  Add
                </Button>
              </Box>
              <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
                <Typography variant="caption" sx={{ fontSize: '0.55rem', color: 'text.secondary', fontFamily: 'mono' }}>
                  Delta couch (cm, all fields)
                </Typography>
                <TextField size="small" label="Vrt" value={couch.vrt} onChange={e => setCouch(d => ({ ...d, vrt: e.target.value }))}
                           sx={{ width: 60 }} inputProps={{ style: { fontSize: '0.6rem' } }} />
                <TextField size="small" label="Lng" value={couch.lng} onChange={e => setCouch(d => ({ ...d, lng: e.target.value }))}
                           sx={{ width: 60 }} inputProps={{ style: { fontSize: '0.6rem' } }} />
                <TextField size="small" label="Lat" value={couch.lat} onChange={e => setCouch(d => ({ ...d, lat: e.target.value }))}
                           sx={{ width: 60 }} inputProps={{ style: { fontSize: '0.6rem' } }} />
              </Box>
              <Box sx={{ display: 'flex', gap: 0.5 }}>
                <Button size="small" variant="contained" color="success" startIcon={<Check fontSize="small" />}
                        disabled={busy} onClick={() => closeWith('APPROVED')}
                        sx={{ fontSize: '0.6rem', flex: 1 }}>
                  Approve plan
                </Button>
                <Button size="small" variant="contained" color="error" startIcon={<Close fontSize="small" />}
                        disabled={busy} onClick={() => closeWith('UNAPPROVED')}
                        sx={{ fontSize: '0.6rem', flex: 1 }}>
                  Reject
                </Button>
              </Box>
            </>
          ) : (
            <Typography variant="caption" sx={{ fontSize: '0.58rem', color: 'text.disabled' }}>
              Session closed with decision {detail.decision}. Comments are read-only.
            </Typography>
          )}
        </>
      )}
    </Box>
  );
}
