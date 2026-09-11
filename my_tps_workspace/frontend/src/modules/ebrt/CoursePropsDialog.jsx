import { useEffect, useState } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField,
  MenuItem, Alert,
} from '@mui/material';

const INTENTS = ['CURATIVE', 'ADJUVANT', 'PALLIATIVE', 'SUPPORTIVE', 'BENIGN'];
const STATUSES = ['ACTIVE', 'COMPLETED', 'CANCELLED'];

/**
 * CoursePropsDialog - Eclipse "Course Properties" (Basic Planning p.194):
 * edit intent / status / start / completed for the selected course.
 *
 * @param {Object} props
 * @param {boolean} props.open
 * @param {Object|null} props.course - { id, name, intent, status, startDate, completedDate }
 * @param {Function} props.onClose
 * @param {Function} props.onSaved - (course) => void
 */
export default function CoursePropsDialog({ open, onClose, course, onSaved }) {
  const [form, setForm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (open && course) {
      setForm({
        intent: course.intent ?? '',
        status: course.status ?? 'ACTIVE',
        startDate: course.startDate ?? '',
        completedDate: course.completedDate ?? '',
      });
      setError('');
    }
  }, [open, course]);

  const save = async () => {
    setBusy(true); setError('');
    try {
      const res = await fetch(`/api/courses/${course.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || 'Failed to update course');
      onSaved?.(d.course);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onClose={() => !busy && onClose()} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontSize: '0.9rem' }}>
        课程属性{course?.name ? ` — ${course.name}` : ''}
      </DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, pt: 1 }}>
        {error && <Alert severity="error" sx={{ fontSize: '0.7rem' }}>{error}</Alert>}
        {form && (
          <>
            <TextField size="small" select label="Intent（治疗意图）" value={form.intent}
                       onChange={e => setForm(f => ({ ...f, intent: e.target.value }))}>
              <MenuItem value="">—</MenuItem>
              {INTENTS.map(i => <MenuItem key={i} value={i}>{i}</MenuItem>)}
            </TextField>
            <TextField size="small" select label="Status（状态）" value={form.status}
                       onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
              {STATUSES.map(s => <MenuItem key={s} value={s}>{s}</MenuItem>)}
            </TextField>
            <TextField size="small" label="Start（开始日期）" placeholder="YYYY-MM-DD" value={form.startDate}
                       onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} />
            <TextField size="small" label="Completed（完成日期）" placeholder="YYYY-MM-DD" value={form.completedDate}
                       onChange={e => setForm(f => ({ ...f, completedDate: e.target.value }))} />
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button size="small" onClick={onClose} disabled={busy}>取消</Button>
        <Button size="small" variant="contained" onClick={save} disabled={busy || !form}>保存</Button>
      </DialogActions>
    </Dialog>
  );
}
