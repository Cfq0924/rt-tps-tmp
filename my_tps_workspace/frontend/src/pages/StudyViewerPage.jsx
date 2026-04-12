import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box, AppBar, Toolbar, Typography, IconButton, Button, CircularProgress,
  Alert, List, ListItem, ListItemButton, ListItemText, Chip, Divider,
  Tooltip, Menu, MenuItem, Tabs, Tab,
} from '@mui/material';
import { ArrowBack, Upload, ZoomIn, Download } from '@mui/icons-material';
import ToolbarComponent from '../components/Toolbar.jsx';
import ViewerViewport from '../components/ViewerViewport.jsx';
import StructurePanel from '../components/StructurePanel.jsx';
import DosePanel from '../components/DosePanel.jsx';
import { initCornerstone } from '../initCornerstone.js';

export default function StudyViewerPage() {
  const { studyId } = useParams();
  const navigate = useNavigate();
  const viewerRef = useRef(null);

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

  // Image stack state
  const [imageIds, setImageIds] = useState([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  // RT Structure state
  const [structures, setStructures] = useState([]);
  const [selectedStructureId, setSelectedStructureId] = useState(null);
  const [structureVisibility, setStructureVisibility] = useState({});
  const [contours, setContours] = useState([]); // All contours from RTSTRUCT
  const [currentContours, setCurrentContours] = useState([]); // Contours for current slice
  const [rtStructFileId, setRtStructFileId] = useState(null);
  const [segmentVisibilityToggle, setSegmentVisibilityToggle] = useState(null); // from useRTContourSegmentation hook

  // RT Dose state
  const [doseData, setDoseData] = useState(null);
  const [doseVisible, setDoseVisible] = useState(false);
  const [doseOpacity, setDoseOpacity] = useState(0.5);
  const [doseThreshold, setDoseThreshold] = useState(20);

  // Right panel tab
  const [rightTab, setRightTab] = useState(0);

  useEffect(() => {
    initCornerstone()
      .then(() => setCsReady(true))
      .catch(err => setError('Failed to initialize Cornerstone'));
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

      // Build imageIds for CT files
      buildImageIds(data.study.files || []);

      // Fetch RTSTRUCT data
      const rtStructFile = data.study.files?.find(f => f.modality === 'RTSTRUCT');
      if (rtStructFile) {
        fetchRTSTRUCT(rtStructFile.id);
      }

      // Fetch RTDOSE data
      const rtDoseFile = data.study.files?.find(f => f.modality === 'RTDOSE');
      if (rtDoseFile) {
        fetchRTDOSE(rtDoseFile.id);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  /**
   * Build Cornerstone imageIds for CT files
   * Uses direct HTTP URLs with wadouri scheme
   */
  async function buildImageIds(allFiles) {
    const ctFiles = allFiles
      .filter(f => f.modality === 'CT')
      .sort((a, b) => {
        // Sort by instance_number if available, otherwise fallback to sop_instance_uid
        const aNum = a.instance_number ?? parseInt(a.sop_instance_uid?.split('.').pop() || '0', 10);
        const bNum = b.instance_number ?? parseInt(b.sop_instance_uid?.split('.').pop() || '0', 10);
        return aNum - bNum;
      });

    if (ctFiles.length === 0) return;

    const ids = [];
    for (const file of ctFiles) {
      try {
        const url = await getSignedUrl(file.id);
        // Use relative URL - loadFileRequest will prepend origin
        ids.push(`wadouri:${url}`);
      } catch (err) {
        console.error(`Failed to get URL for file ${file.id}:`, err);
      }
    }

    setImageIds(ids);

    // Auto-select first CT file
    if (!selectedFileId && ctFiles.length > 0) {
      setSelectedFileId(ctFiles[0].id);
    }
  }

  async function getSignedUrl(fileId) {
    const res = await fetch(`/api/files/signed-url/${fileId}`, { credentials: 'include' });
    if (!res.ok) throw new Error('Failed to get signed URL');
    const data = await res.json();
    // wadouri scheme requires absolute URL with protocol and host
    // Point directly to backend (port 3001) since Vite proxy may not handle query strings correctly
    const baseUrl = `http://localhost:3001`;
    return `${baseUrl}${data.url}`;
  }

  async function fetchRTSTRUCT(fileId) {
    try {
      setRtStructFileId(fileId);
      const res = await fetch(`/api/rtstruct/${fileId}`, { credentials: 'include' });
      if (!res.ok) return;
      const data = await res.json();
      if (data.roiSequence) {
        const initialStructures = data.roiSequence.map(roi => ({
          ...roi,
          visible: true,
        }));
        setStructures(initialStructures);
        setStructureVisibility(
          initialStructures.reduce((acc, s) => ({ ...acc, [s.roiNumber]: true }), {})
        );
        if (initialStructures.length > 0) {
          setSelectedStructureId(initialStructures[0].roiNumber);
        }
      }
      // Store contour sequence for per-slice rendering
      if (data.contourSequence) {
        setContours(data.contourSequence);
      }
    } catch (err) {
      console.error('Failed to fetch RTSTRUCT:', err);
    }
  }

  async function fetchRTDOSE(fileId) {
    try {
      const res = await fetch(`/api/rtdose/${fileId}`, { credentials: 'include' });
      if (!res.ok) return;
      const data = await res.json();
      setDoseData(data);
    } catch (err) {
      console.error('Failed to fetch RTDOSE:', err);
    }
  }

  const filesForModality = useMemo(
    () => files.filter(f => f.modality === activeModality),
    [files, activeModality]
  );

  // Get current imageId for CT
  const currentImageId = useMemo(() => {
    if (activeModality !== 'CT' || imageIds.length === 0 || !selectedFileId) return null;
    const idx = filesForModality.findIndex(f => f.id === selectedFileId);
    return idx >= 0 ? imageIds[idx] : null;
  }, [activeModality, imageIds, selectedFileId, filesForModality]);

  // Get current CT file for SOPInstanceUID
  const currentCTFile = useMemo(() => {
    if (activeModality !== 'CT' || !selectedFileId) return null;
    return filesForModality.find(f => f.id === selectedFileId) || null;
  }, [activeModality, selectedFileId, filesForModality]);

  // Filter contours for current slice when slice changes
  useEffect(() => {
    if (!currentImageIndex && currentImageIndex !== 0) {
      setCurrentContours([]);
      return;
    }

    if (contours.length === 0) {
      setCurrentContours([]);
      return;
    }

    // Get the currently displayed CT slice file
    // filesForModality is sorted by instance_number, so index = currentImageIndex
    const currentFile = filesForModality[currentImageIndex];
    if (!currentFile?.sop_instance_uid) {
      setCurrentContours([]);
      return;
    }

    const currentSOPInstanceUID = currentFile.sop_instance_uid;
    const visibleROINumbers = new Set(
      Object.entries(structureVisibility)
        .filter(([_, visible]) => visible)
        .map(([roiNumber]) => parseInt(roiNumber, 10))
    );

    // Filter contours using referencedSOPInstanceUID - direct match
    const filtered = contours.filter(c => {
      if (!visibleROINumbers.has(c.referencedROINumber)) return false;
      if (c.referencedSOPInstanceUID !== currentSOPInstanceUID) return false;
      const contourData = c.contourData;
      if (!contourData || contourData.length < 3) return false;
      return true;
    });

    setCurrentContours(filtered);
  }, [currentImageIndex, contours, structureVisibility, filesForModality]);

  // Auto-update currentImageIndex when selectedFileId changes
  useEffect(() => {
    if (selectedFileId && filesForModality.length > 0) {
      const idx = filesForModality.findIndex(f => f.id === selectedFileId);
      if (idx >= 0) {
        setCurrentImageIndex(idx);
      }
    }
  }, [selectedFileId, filesForModality]);

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

  function handleToggleStructure(roiNumber) {
    const newVisible = !structureVisibility[roiNumber];
    setStructureVisibility(prev => {
      const newVisibility = { ...prev, [roiNumber]: newVisible };
      setStructures(prev => prev.map(s =>
        s.roiNumber === roiNumber ? { ...s, visible: newVisibility[roiNumber] } : s
      ));
      return newVisibility;
    });
    // Also toggle the actual contour rendering
    if (segmentVisibilityToggle) {
      segmentVisibilityToggle(roiNumber, newVisible);
    }
  }

  function handleSelectStructure(roiNumber) {
    setSelectedStructureId(roiNumber);
  }

  function handleToggleAllStructures() {
    const allVisible = structures.every(s => s.visible);
    const newVisible = !allVisible;
    setStructureVisibility(
      structures.reduce((acc, s) => ({ ...acc, [s.roiNumber]: newVisible }), {})
    );
    setStructures(prev => prev.map(s => ({ ...s, visible: newVisible })));
  }

  function handleFileSelect(fileId) {
    setSelectedFileId(fileId);
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
        {/* File list sidebar - only show if not CT */}
        {activeModality !== 'CT' && (
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
                    onClick={() => handleFileSelect(file.id)}
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
        )}

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
          ) : activeModality === 'CT' && imageIds.length > 0 ? (
            <ViewerViewport
              imageId={currentImageId}
              activeTool={activeTool}
              imageIds={imageIds}
              currentImageIndex={currentImageIndex}
              onImageIndexChange={setCurrentImageIndex}
              structures={structures}           // roiSequence for RT Structure
              contours={contours}             // contourSequence for RT Structure
              structureOverlayVisible={true}
              activeModality={activeModality}
              imagePosition={currentCTFile ? {
                x: currentCTFile.image_position_x || 0,
                y: currentCTFile.image_position_y || 0,
                z: currentCTFile.image_position_z || 0,
              } : null}
              pixelSpacing={currentCTFile ? {
                x: currentCTFile.pixel_spacing_x || 1,
                y: currentCTFile.pixel_spacing_y || 1,
              } : null}
              frameOfReferenceUID={currentCTFile?.frame_of_reference_uid}
              onStructureVisibilityChange={setSegmentVisibilityToggle}
            />
          ) : selectedFileId ? (
            <ViewerViewport
              imageId={`wadouri:/api/files/signed-url/${selectedFileId}`}
              activeTool={activeTool}
            />
          ) : (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
              <Typography color="text.secondary" variant="body2">
                Select a file from the sidebar to view
              </Typography>
            </Box>
          )}

          {/* Image info overlay */}
          {activeModality === 'CT' && imageIds.length > 0 && (
            <Box
              sx={{
                position: 'absolute',
                bottom: 8,
                left: 8,
                background: 'rgba(0,0,0,0.6)',
                px: 1,
                py: 0.5,
                borderRadius: 0.5,
              }}
            >
              <Typography variant="caption" sx={{ fontFamily: 'mono', color: '#58c4dc' }}>
                Image: {currentImageIndex + 1} / {imageIds.length}
              </Typography>
            </Box>
          )}
        </Box>

        {/* Right sidebar - Structure/Dose panels */}
        <Box
          sx={{
            width: 260,
            borderLeft: '1px solid rgba(88,196,220,0.12)',
            background: 'background.paper',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <Tabs
            value={rightTab}
            onChange={(_, v) => setRightTab(v)}
            variant="fullWidth"
            sx={{
              minHeight: 36,
              borderBottom: '1px solid rgba(88,196,220,0.12)',
              '& .MuiTab-root': { minHeight: 36, fontSize: '0.7rem', fontFamily: 'mono' },
            }}
          >
            <Tab label="Structures" />
            <Tab label="Dose" />
          </Tabs>

          <Box sx={{ flex: 1, overflow: 'auto' }}>
            {rightTab === 0 && (
              <StructurePanel
                structures={structures}
                onToggle={handleToggleStructure}
                onSelect={handleSelectStructure}
                onToggleAll={handleToggleAllStructures}
                selectedStructureId={selectedStructureId}
              />
            )}
            {rightTab === 1 && (
              <DosePanel
                doseData={doseData}
                visible={doseVisible}
                opacity={doseOpacity}
                threshold={doseThreshold}
                onVisibleChange={setDoseVisible}
                onOpacityChange={setDoseOpacity}
                onThresholdChange={setDoseThreshold}
              />
            )}
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
