import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box, AppBar, Toolbar, Typography, IconButton, CircularProgress,
  Alert, List, ListItem, ListItemButton, ListItemText, Chip, Paper,
} from '@mui/material';
import { ArrowBack, FolderOpen } from '@mui/icons-material';

export default function PatientDetailPage() {
  const { patientId } = useParams();
  const navigate = useNavigate();
  const [studies, setStudies] = useState([]);
  const [patient, setPatient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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
    </Box>
  );
}
