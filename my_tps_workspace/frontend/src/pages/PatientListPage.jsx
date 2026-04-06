import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, AppBar, Toolbar, Typography, Button, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Paper, CircularProgress, Alert,
  Chip, IconButton, Dialog, DialogTitle, DialogContent, DialogActions,
  LinearProgress,
} from '@mui/material';
import { Logout, Add, FolderOpen, Upload, ExpandMore, ExpandLess } from '@mui/icons-material';

export default function PatientListPage() {
  const navigate = useNavigate();
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [uploadSuccess, setUploadSuccess] = useState('');
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });
  const [expandedPatients, setExpandedPatients] = useState({});

  useEffect(() => {
    fetchPatients();
  }, []);

  async function fetchPatients() {
    try {
      const res = await fetch('/api/patients', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load patients');
      const data = await res.json();
      setPatients(data.patients);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    navigate('/login');
  }

  async function handleBatchUpload() {
    if (selectedFiles.length === 0) return;
    setUploading(true);
    setUploadError('');
    setUploadSuccess('');
    setUploadProgress({ current: 0, total: selectedFiles.length });

    const formData = new FormData();
    for (const file of selectedFiles) {
      formData.append('files', file);
    }

    try {
      const res = await fetch('/api/files/upload-batch', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');

      // Build success message
      const studyCount = data.studies.length;
      const totalImported = data.studies.reduce((sum, s) => sum + s.filesImported, 0);
      const totalSkipped = data.studies.reduce((sum, s) => sum + s.filesSkipped, 0);
      const totalFailed = data.studies.reduce((sum, s) => sum + s.filesFailed, 0);

      let msg = `Imported ${totalImported} files`;
      if (totalSkipped > 0) msg += `, ${totalSkipped} skipped (already exists)`;
      if (totalFailed > 0) msg += `, ${totalFailed} failed`;
      msg += ` across ${studyCount} study/studies.`;

      if (data.batchErrors && data.batchErrors.length > 0) {
        msg += ` ${data.batchErrors.length} files were invalid DICOM and rejected.`;
      }

      setUploadSuccess(msg);
      setSelectedFiles([]);
      fetchPatients();
    } catch (err) {
      setUploadError(err.message);
    } finally {
      setUploading(false);
      setUploadProgress({ current: 0, total: 0 });
    }
  }

  function handleFileSelect(e) {
    const files = Array.from(e.target.files);
    setSelectedFiles(prev => {
      const existingNames = new Set(prev.map(f => f.name));
      const newFiles = files.filter(f => !existingNames.has(f.name));
      return [...prev, ...newFiles];
    });
    e.target.value = '';
  }

  function removeFile(file) {
    setSelectedFiles(prev => prev.filter(f => f !== file));
  }

  function toggleExpand(patientId) {
    setExpandedPatients(prev => ({
      ...prev,
      [patientId]: !prev[patientId]
    }));
  }

  // Group files by modality
  function getModalitySummary(patient) {
    const modalities = [];
    if (patient.ct_count > 0) modalities.push({ label: 'CT', count: patient.ct_count, color: '#58c4dc' });
    if (patient.mr_count > 0) modalities.push({ label: 'MR', count: patient.mr_count, color: '#7ee0a1' });
    if (patient.rtstruct_count > 0) modalities.push({ label: 'RTSTRUCT', count: patient.rtstruct_count, color: '#f6c177' });
    if (patient.rtdose_count > 0) modalities.push({ label: 'RTDOSE', count: patient.rtdose_count, color: '#e06c75' });
    if (patient.rtplan_count > 0) modalities.push({ label: 'RTPLAN', count: patient.rtplan_count, color: '#a78bfa' });
    if (patient.pt_count > 0) modalities.push({ label: 'PT', count: patient.pt_count, color: '#fb923c' });
    if (patient.us_count > 0) modalities.push({ label: 'US', count: patient.us_count, color: '#f472b6' });
    if (patient.xa_count > 0) modalities.push({ label: 'XA', count: patient.xa_count, color: '#94a3b8' });
    if (patient.cr_count > 0) modalities.push({ label: 'CR', count: patient.cr_count, color: '#22d3ee' });
    return modalities;
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
          <Typography variant="h6" sx={{ flexGrow: 1, fontWeight: 600, color: 'primary.main' }}>
            TPS — Patients
          </Typography>
          <Button startIcon={<FolderOpen />} variant="outlined" size="small" onClick={() => setUploadOpen(true)} sx={{ mr: 1 }}>
            Import Folder
          </Button>
          <IconButton onClick={handleLogout} size="small" sx={{ color: 'text.secondary' }}>
            <Logout />
          </IconButton>
        </Toolbar>
      </AppBar>

      <Box sx={{ flex: 1, p: 2, overflow: 'auto' }}>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        <TableContainer component={Paper} sx={{ background: 'background.paper' }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ color: 'text.secondary', fontWeight: 600, width: 40 }} />
                <TableCell sx={{ color: 'text.secondary', fontWeight: 600 }}>Patient ID</TableCell>
                <TableCell sx={{ color: 'text.secondary', fontWeight: 600 }}>Name</TableCell>
                <TableCell sx={{ color: 'text.secondary', fontWeight: 600 }}>Gender</TableCell>
                <TableCell sx={{ color: 'text.secondary', fontWeight: 600, textAlign: 'center' }}>Studies</TableCell>
                <TableCell sx={{ color: 'text.secondary', fontWeight: 600, textAlign: 'center' }}>Files</TableCell>
                <TableCell sx={{ color: 'text.secondary', fontWeight: 600 }}>Modalities</TableCell>
                <TableCell sx={{ color: 'text.secondary', fontWeight: 600 }}>Created</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {patients.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} sx={{ textAlign: 'center', py: 4, color: 'text.secondary' }}>
                    No patients yet. Import a DICOM folder to get started.
                  </TableCell>
                </TableRow>
              ) : (
                patients.map(patient => (
                  <>
                    <TableRow key={patient.id} hover>
                      <TableCell sx={{ py: 0 }}>
                        <IconButton size="small" onClick={() => toggleExpand(patient.id)}>
                          {expandedPatients[patient.id] ? <ExpandLess /> : <ExpandMore />}
                        </IconButton>
                      </TableCell>
                      <TableCell sx={{ fontFamily: 'mono', fontSize: '0.8125rem' }}>{patient.external_id}</TableCell>
                      <TableCell>{patient.name}</TableCell>
                      <TableCell>
                        <Chip label={patient.gender || '—'} size="small" sx={{ fontFamily: 'mono' }} />
                      </TableCell>
                      <TableCell sx={{ textAlign: 'center', fontFamily: 'mono' }}>{patient.study_count}</TableCell>
                      <TableCell sx={{ textAlign: 'center', fontFamily: 'mono' }}>{patient.file_count}</TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                          {getModalitySummary(patient).map(mod => (
                            <Chip
                              key={mod.label}
                              label={`${mod.label}:${mod.count}`}
                              size="small"
                              sx={{
                                fontFamily: 'mono',
                                fontSize: '0.65rem',
                                height: 20,
                                backgroundColor: `${mod.color}20`,
                                borderColor: mod.color,
                                color: mod.color,
                                border: '1px solid',
                              }}
                            />
                          ))}
                        </Box>
                      </TableCell>
                      <TableCell sx={{ fontFamily: 'mono', fontSize: '0.75rem', color: 'text.secondary' }}>
                        {new Date(patient.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <IconButton size="small" onClick={() => navigate(`/patients/${patient.id}`)}>
                          <FolderOpen fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  </>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>

      {/* Batch Upload Dialog */}
      <Dialog open={uploadOpen} onClose={() => { setUploadOpen(false); setUploadError(''); setUploadSuccess(''); setSelectedFiles([]); }} maxWidth="md" fullWidth>
        <DialogTitle>Import DICOM Folder</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
            {uploadError && <Alert severity="error">{uploadError}</Alert>}
            {uploadSuccess && <Alert severity="success">{uploadSuccess}</Alert>}

            <Typography variant="body2" color="text.secondary">
              Select a folder containing DICOM files. All files will be parsed and grouped by StudyInstanceUID automatically.
            </Typography>

            <Button variant="outlined" component="label" fullWidth sx={{ py: 2 }}>
              <FolderOpen sx={{ mr: 1 }} />
              {selectedFiles.length > 0 ? `${selectedFiles.length} files selected` : 'Choose Folder'}
              <input
                type="file"
                // @ts-ignore - webkitdirectory is not in TS types but supported by browsers
                webkitdirectory="webkitdirectory"
                hidden
                onChange={handleFileSelect}
              />
            </Button>

            {selectedFiles.length > 0 && (
              <Box sx={{ maxHeight: 200, overflow: 'auto', background: 'background.default', borderRadius: 1, p: 1 }}>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                  {selectedFiles.length} files selected
                </Typography>
                {selectedFiles.slice(0, 100).map((file, idx) => (
                  <Box key={idx} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 0.25 }}>
                    <Typography variant="caption" sx={{ fontFamily: 'mono', fontSize: '0.7rem', color: 'text.secondary' }}>
                      {file.name}
                    </Typography>
                    <Button size="small" onClick={() => removeFile(file)} sx={{ minWidth: 0, p: 0.5, color: 'text.secondary' }}>
                      ×
                    </Button>
                  </Box>
                ))}
                {selectedFiles.length > 100 && (
                  <Typography variant="caption" color="text.secondary">
                    ...and {selectedFiles.length - 100} more files
                  </Typography>
                )}
              </Box>
            )}

            {uploading && (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <LinearProgress />
                <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center' }}>
                  Processing {uploadProgress.current} of {uploadProgress.total} files...
                </Typography>
              </Box>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => { setUploadOpen(false); setSelectedFiles([]); }}>Close</Button>
          <Button
            variant="contained"
            onClick={handleBatchUpload}
            disabled={selectedFiles.length === 0 || uploading}
            startIcon={<Upload />}
          >
            {uploading ? 'Importing...' : `Import ${selectedFiles.length} Files`}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
