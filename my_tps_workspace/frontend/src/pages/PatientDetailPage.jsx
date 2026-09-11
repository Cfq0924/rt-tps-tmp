import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box, AppBar, Toolbar, Typography, IconButton, CircularProgress,
  Alert, List, ListItem, ListItemButton, ListItemText, Chip, Paper,
  Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem,
} from '@mui/material';
import { ArrowBack, FolderOpen, Edit } from '@mui/icons-material';

export default function PatientDetailPage() {
  const { patientId } = useParams();
  const navigate = useNavigate();
  const [studies, setStudies] = useState([]);
  const [patient, setPatient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // Phase 4 M5 患者编辑
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({ name: '', birthDate: '', gender: '' });
  const [editBusy, setEditBusy] = useState(false);
  const [editError, setEditError] = useState('');

  const openEdit = () => {
    setEditForm({
      name: patient?.name ?? '',
      birthDate: patient?.birth_date ?? '',
      gender: patient?.gender ?? '',
    });
    setEditError('');
    setEditOpen(true);
  };

  const saveEdit = async () => {
    setEditBusy(true); setEditError('');
    try {
      const res = await fetch(`/api/patients/${patientId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editForm.name,
          birthDate: editForm.birthDate || null,
          gender: editForm.gender || null,
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || 'Failed to update patient');
      setPatient(prev => ({ ...prev, ...d.patient }));
      setEditOpen(false);
    } catch (err) {
      setEditError(err.message);
    } finally {
      setEditBusy(false);
    }
  };

  useEffect(() => {
    fetchPatient();
  }, [patientId]);

  async function fetchPatient() {
    try {
      const res = await fetch(`/api/patients/${patientId}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load patient');
      const data = await res.json();
      setPatient(data.patient);
      setStudies(data.patient.studies || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column', background: 'background.default' }}>
      <AppBar position="static" sx={{ background: 'background.paper', borderBottom: '1px solid rgba(88,196,220,0.12)' }} elevation={0}>
        <Toolbar>
          <IconButton size="small" onClick={() => navigate('/patients')} sx={{ mr: 1 }}>
            <ArrowBack fontSize="small" />
          </IconButton>
          <Typography variant="h6" sx={{ fontWeight: 600, color: 'primary.main' }}>
            {patient?.name || 'Patient'}
          </Typography>
          <Chip label={patient?.external_id} size="small" sx={{ ml: 1, fontFamily: 'mono' }} />
          {patient?.birth_date && (
            <Typography variant="caption" sx={{ ml: 1, color: 'text.secondary', fontFamily: 'mono' }}>
              {patient.birth_date}{patient.gender ? ` · ${patient.gender}` : ''}
            </Typography>
          )}
          <Box sx={{ flex: 1 }} />
          <Button size="small" startIcon={<Edit />} onClick={openEdit}
                  sx={{ fontSize: '0.7rem', color: 'text.secondary', borderColor: 'rgba(88,196,220,0.3)' }}>
            Edit
          </Button>
        </Toolbar>
      </AppBar>

      <Box sx={{ flex: 1, p: 2, overflow: 'auto' }}>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        <Typography variant="subtitle2" sx={{ mb: 1, color: 'text.secondary' }}>
          Studies ({studies.length})
        </Typography>

        <List>
          {studies.map(study => (
            <ListItem key={study.id} disablePadding sx={{ mb: 1 }}>
              <Paper
                component={ListItemButton}
                onClick={() => navigate(`/viewer/${study.id}`)}
                sx={{
                  background: 'background.paper',
                  '&:hover': { background: 'rgba(88,196,220,0.08)' },
                }}
              >
                <FolderOpen sx={{ mr: 2, color: 'primary.main' }} />
                <ListItemText
                  primary={
                    <Typography sx={{ fontFamily: 'mono', fontSize: '0.875rem' }}>
                      {study.study_instance_uid?.slice(0, 24)}...
                    </Typography>
                  }
                  secondary={
                    <Box sx={{ display: 'flex', gap: 1, mt: 0.5 }}>
                      <Chip label={study.description || 'No description'} size="small" sx={{ fontSize: '0.65rem' }} />
                      <Typography variant="caption" color="text.secondary">
                        {study.file_count} files
                      </Typography>
                    </Box>
                  }
                />
              </Paper>
            </ListItem>
          ))}
        </List>

        {studies.length === 0 && (
          <Typography color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
            No studies for this patient
          </Typography>
        )}
      </Box>

      <Dialog open={editOpen} onClose={() => !editBusy && setEditOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontSize: '0.9rem' }}>Edit patient</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, pt: 1 }}>
          {editError && <Alert severity="error" sx={{ fontSize: '0.7rem' }}>{editError}</Alert>}
          <TextField size="small" label="Name" value={editForm.name}
                     onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} />
          <TextField size="small" label="Birth date (YYYY-MM-DD)" placeholder="1970-01-01"
                     value={editForm.birthDate}
                     onChange={e => setEditForm(f => ({ ...f, birthDate: e.target.value }))} />
          <TextField size="small" select label="Gender" value={editForm.gender}
                     onChange={e => setEditForm(f => ({ ...f, gender: e.target.value }))}>
            <MenuItem value="">—</MenuItem>
            <MenuItem value="M">M</MenuItem>
            <MenuItem value="F">F</MenuItem>
            <MenuItem value="O">O</MenuItem>
          </TextField>
          <Typography variant="caption" sx={{ fontSize: '0.6rem', color: 'text.disabled' }}>
            External ID is the patient identity key and cannot be changed.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button size="small" onClick={() => setEditOpen(false)} disabled={editBusy}>Cancel</Button>
          <Button size="small" variant="contained" onClick={saveEdit} disabled={editBusy || !editForm.name.trim()}>
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
