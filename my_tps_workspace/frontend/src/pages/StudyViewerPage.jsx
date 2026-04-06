import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box, AppBar, Toolbar, Typography, IconButton, Button, CircularProgress,
  Alert, List, ListItem, ListItemButton, ListItemText, Chip, Divider,
  Tooltip, Menu, MenuItem,
} from '@mui/material';
import { ArrowBack, Upload, ZoomIn, Download } from '@mui/icons-material';
import ToolbarComponent from '../components/Toolbar.jsx';
import ViewerViewport from '../components/ViewerViewport.jsx';
import { initCornerstone } from '../initCornerstone.js';

export default function StudyViewerPage() {
  const { studyId } = useParams();
  const navigate = useNavigate();
  const viewerRef = useRef(null);
  const cornerstoneRef = useRef(null);

  const [study, setStudy] = useState(null);
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTool, setActiveTool] = useState('Pan');
  const [selectedFileId, setSelectedFileId] = useState(null);
  const [activeModality, setActiveModality] = useState('CT');
  const [modalities, setModalities] = useState([]);
  const [csReady, setCsReady] = useState(false);
  const [aiAnchor, setAiAnchor] = useState(null);

  useEffect(() => {
    initCornerstone().then(() => setCsReady(true)).catch(err => setError('Failed to initialize Cornerstone'));
  }, []);

  useEffect(() => {
    fetchStudy();
  }, [studyId]);

  async function fetchStudy() {
    try {
      const res = await fetch(`/api/studies/${studyId}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load study');
      const data = await res.json();
      setStudy(data.study);
      setFiles(data.study.files || []);

      const mods = [...new Set((data.study.files || []).map(f => f.modality))];
      setModalities(mods);
      if (mods.includes('CT')) setActiveModality('CT');
      else if (mods.length) setActiveModality(mods[0]);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const filesForModality = files.filter(f => f.modality === activeModality);

  async function handleAutoSegment() {
    const rtStructFiles = files.filter(f => f.modality === 'RTSTRUCT');
    if (rtStructFiles.length === 0) {
      setError('No RTSTRUCT file found for this study. Import one first.');
      return;
    }

    const organName = prompt('Enter organ name to segment (e.g., "Liver", "GTV"):');
    if (!organName) return;

    try {
      const res = await fetch('/api/contouring/auto', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dicomFilePath: rtStructFiles[0].file_path,
          organName,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Auto-segmentation failed');
      alert(`Auto-segmentation complete for ${organName}`);
    } catch (err) {
      setError(err.message);
    }
  }

  async function getSignedUrl(fileId) {
    const res = await fetch(`/api/files/signed-url/${fileId}`, { credentials: 'include' });
    const data = await res.json();
    return data.url;
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
      {/* Header */}
      <AppBar position="static" sx={{ background: 'background.paper', borderBottom: '1px solid rgba(88,196,220,0.12)' }} elevation={0}>
        <Toolbar sx={{ minHeight: '48px !important', gap: 1 }}>
          <IconButton size="small" onClick={() => navigate('/patients')} sx={{ mr: 1 }}>
            <ArrowBack fontSize="small" />
          </IconButton>

          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
            {study?.patient_name || 'Patient'}
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary', fontFamily: 'mono' }}>
            {study?.study_instance_uid?.slice(0, 16)}…
          </Typography>

          <Divider orientation="vertical" flexItem />

          {/* Modality tabs */}
          {modalities.map(mod => (
            <Chip
              key={mod}
              label={mod}
              size="small"
              variant={activeModality === mod ? 'filled' : 'outlined'}
              color={activeModality === mod ? 'primary' : 'default'}
              onClick={() => setActiveModality(mod)}
              sx={{ fontFamily: 'mono', fontSize: '0.7rem', height: 22 }}
            />
          ))}

          <Box sx={{ flex: 1 }} />

          <Button
            size="small"
            variant="outlined"
            startIcon={<Upload />}
            onClick={() => navigate('/patients')}
            sx={{ fontSize: '0.75rem', py: 0.5 }}
          >
            Import
          </Button>
        </Toolbar>

        <ToolbarComponent activeTool={activeTool} onToolChange={setActiveTool} onAutoSegment={handleAutoSegment} />
      </AppBar>

      <Box sx={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* File list sidebar */}
        <Box
          sx={{
            width: 220,
            borderRight: '1px solid rgba(88,196,220,0.12)',
            background: 'background.paper',
            overflow: 'auto',
          }}
        >
          <List dense>
            {filesForModality.map(file => (
              <ListItem key={file.id} disablePadding>
                <ListItemButton
                  selected={selectedFileId === file.id}
                  onClick={() => setSelectedFileId(file.id)}
                  sx={{ py: 0.5 }}
                >
                  <ListItemText
                    primary={
                      <Typography sx={{ fontSize: '0.75rem', fontFamily: 'mono' }}>
                        {file.sop_instance_uid?.slice(0, 12)}…
                      </Typography>
                    }
                    secondary={
                      <Box sx={{ display: 'flex', gap: 0.5, mt: 0.25 }}>
                        <Chip label={file.modality} size="small" sx={{ height: 16, fontSize: '0.65rem', fontFamily: 'mono' }} />
                        {file.file_size && (
                          <Typography sx={{ fontSize: '0.65rem', color: 'text.secondary' }}>
                            {(file.file_size / 1024 / 1024).toFixed(1)}MB
                          </Typography>
                        )}
                      </Box>
                    }
                  />
                </ListItemButton>
              </ListItem>
            ))}
            {filesForModality.length === 0 && (
              <ListItem>
                <ListItemText secondary="No files" sx={{ color: 'text.secondary', fontSize: '0.75rem' }} />
              </ListItem>
            )}
          </List>
        </Box>

        {/* Main viewer */}
        <Box sx={{ flex: 1, position: 'relative', background: '#07111f' }}>
          {error && (
            <Alert
              severity="error"
              sx={{ position: 'absolute', top: 8, left: 8, right: 8, zIndex: 10 }}
              onClose={() => setError('')}
            >
              {error}
            </Alert>
          )}

          {!csReady ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
              <CircularProgress />
            </Box>
          ) : selectedFileId ? (
            <ViewerViewport
              elementRef={viewerRef}
              imageId={`dicomfile:${selectedFileId}`}
              activeTool={activeTool}
            />
          ) : (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
              <Typography color="text.secondary" variant="body2">
                Select a file from the sidebar to view
              </Typography>
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  );
}
