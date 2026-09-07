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
import { useRTDose } from '../hooks/useRTDose.js';
import RTStructSVGOverlay from '../components/RTStructSVGOverlay.jsx';
import { DEFAULT_ISODOSE_LEVELS } from '../lib/doseTransform.js';
import PaintLayer from '../modules/contouring/PaintLayer.jsx';
import ContouringPanel from '../modules/contouring/ContouringPanel.jsx';
import { useContouring } from '../modules/contouring/useContouring.js';
import { RegistrationModule, EvaluationModule } from '../modules/placeholders.jsx';
import EbrtWorkspace from '../modules/ebrt/EbrtWorkspace.jsx';
import { useEbrtPlans } from '../modules/ebrt/useEbrtPlans.js';
import { registerCTPlaneMetadataProvider } from '../lib/ctMetadataProvider.js';
import EBRTBeamsOverlay from '../modules/ebrt/EBRTBeamsOverlay.jsx';
import { useRTPlan } from '../hooks/useRTPlan.js';
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

  // Non-CT single-file viewer imageId (signed URL resolved asynchronously)
  const [nonCtImageId, setNonCtImageId] = useState(null);
  useEffect(() => {
    let cancelled = false;
    setNonCtImageId(null);
    if (activeModality === 'CT' || !selectedFileId) return;
    (async () => {
      try {
        const url = await getSignedUrl(selectedFileId);
        if (!cancelled) setNonCtImageId(`wadouri:${window.location.origin}${url}`);
      } catch (err) {
        console.error(`Failed to get URL for file ${selectedFileId}:`, err);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeModality, selectedFileId]);

  // RT Structure state
  const [structures, setStructures] = useState([]);
  const [selectedStructureId, setSelectedStructureId] = useState(null);
  const [structureVisibility, setStructureVisibility] = useState({});
  const [contours, setContours] = useState([]); // All contours from RTSTRUCT
  const [currentContours, setCurrentContours] = useState([]); // Contours for current slice
  const [rtStructFileId, setRtStructFileId] = useState(null);
  const segmentVisibilityToggleRef = useRef(null); // stores the actual setSegmentVisibility function from hook

  // Callback to register the setSegmentVisibility function from the hook
  const handleSegmentVisibilityRef = useCallback((toggleFn) => {
    segmentVisibilityToggleRef.current = toggleFn;
  }, []);

  // Callback to register the cornerstone viewport instance (for overlays)
  const handleViewportRef = useCallback((vp) => {
    viewportRef.current = vp;
    setViewportInstance(vp);
  }, []);

  // RT Dose state (metadata fetched per fileId; grid loaded lazily on toggle)
  const [rtDoseFileId, setRtDoseFileId] = useState(null);
  const [doseVisible, setDoseVisible] = useState(false);
  const [doseOpacity, setDoseOpacity] = useState(0.5);
  const [doseThreshold, setDoseThreshold] = useState(20);
  const [isodoseLevels, setIsodoseLevels] = useState(DEFAULT_ISODOSE_LEVELS);
  const [rtPlanFileId, setRtPlanFileId] = useState(null);
  const [selectedBeamNumber, setSelectedBeamNumber] = useState(null);
  const [ebrtEnabled, setEbrtEnabled] = useState(false);
  const ebrt = useEbrtPlans({ studyId: Number(studyId), enabled: ebrtEnabled });
  const viewportRef = useRef(null);
  const { doseMeta: doseData, grid: doseGrid, gridLoading, loadGrid } = useRTDose({ fileId: rtDoseFileId });
  const { plan: rtPlan, loading: planLoading, error: planError } = useRTPlan({ fileId: rtPlanFileId });

  // Right panel tab
  const [rightTab, setRightTab] = useState(0);

  // Functional modules (M1 imaging / M2 contouring / M3-M5 placeholders)
  const [activeModule, setActiveModule] = useState('images');
  const [viewportInstance, setViewportInstance] = useState(null);
  const contouringLoadedRef = useRef(false);

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
        setRtDoseFileId(rtDoseFile.id);
      }

      // RTPLAN is parsed on demand by useRTPlan
      const rtPlanFile = data.study.files?.find(f => f.modality === 'RTPLAN');
      if (rtPlanFile) {
        setRtPlanFileId(rtPlanFile.id);
      }

      // imagePlaneModule fallback so contour mapping never depends on
      // downloaded datasets
      registerCTPlaneMetadataProvider(data.study.files ?? []);
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

    if (ctFiles.length === 0) {
      return;
    }

    const ids = [];
    for (const file of ctFiles) {
      try {
        const url = await getSignedUrl(file.id);
        // Same-origin URL through the Vite proxy (no CORS issues), resolved
        // against the actual host/port the app is served from
        ids.push(`wadouri:${window.location.origin}${url}`);
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
    // Return just the path, let the Vite proxy handle it
    // This avoids CORS issues with direct localhost:3001 requests
    return data.url;
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

  // RTDOSE metadata is fetched by useRTDose when rtDoseFileId is set; the
  // 6MB grid only downloads when the user first toggles dose display

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
          fileId: rtStructFiles[0].id,
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
    if (segmentVisibilityToggleRef.current) {
      segmentVisibilityToggleRef.current?.(roiNumber, newVisible);
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
    // Also toggle all contours in cornerstone segmentation
    if (segmentVisibilityToggleRef.current) {
      structures.forEach(s => {
        segmentVisibilityToggleRef.current?.(s.roiNumber, newVisible);
      });
    }
  }

  function handleFileSelect(fileId) {
    setSelectedFileId(fileId);
  }

  // z (mm) of the slice currently displayed — driven by the viewport's
  // camera events (currentImageIndex), NOT the clicked/selected file
  const currentCTZ = filesForModality[currentImageIndex]?.image_position_z ?? null;
  const currentSliceSOP = filesForModality[currentImageIndex]?.sop_instance_uid ?? null;

  // CT geometry of the displayed slice (contouring module paint space).
  // IOP is assumed axial HFS [1,0,0,0,1,0] — the DB does not store IOP.
  const ctGeom = useMemo(() => {
    const f = filesForModality[currentImageIndex];
    if (!f || f.image_position_z == null) return null;
    return {
      imagePosition: {
        x: f.image_position_x ?? 0,
        y: f.image_position_y ?? 0,
        z: f.image_position_z,
      },
      imageOrientation: { x: [1, 0, 0], y: [0, 1, 0] },
      pixelSpacing: { i: f.pixel_spacing_x ?? 1, j: f.pixel_spacing_y ?? 1 },
      cols: f.columns ?? 512,
      rows: f.rows ?? 512,
    };
  }, [filesForModality, currentImageIndex]);

  const prescriptionCgy = (() => {
    if (ebrt.selectedPlan?.prescriptionDoseGy != null) {
      return Math.round(ebrt.selectedPlan.prescriptionDoseGy * 100);
    }
    return rtPlan?.prescription?.targetPrescriptionDoseGy != null
      ? Math.round(rtPlan.prescription.targetPrescriptionDoseGy * 100)
      : null;
  })();

  // M2 contouring module state (persistence + paint masks + undo/redo)
  const contouring = useContouring({
    studyId: Number(studyId),
    ctFiles: filesForModality,
    ctGeom,
  });

  // Isocenter slice index (nearest CT slice to the plan isocenter z).
  // Prefers the selected workspace plan; falls back to the parsed RTPLAN.
  const isocenterZ = (() => {
    const p = ebrt.selectedPlan;
    if (p?.isocenterX != null) return p.isocenterZ;
    const b = rtPlan?.beams?.find(x => x.isocenterPosition);
    return b?.isocenterPosition?.z ?? null;
  })();
  const isocenterSliceIdx = (() => {
    if (isocenterZ == null || !filesForModality.length) return null;
    let best = 0, bestDist = Infinity;
    filesForModality.forEach((f, i) => {
      const d = Math.abs((f.image_position_z ?? 0) - isocenterZ);
      if (d < bestDist) { bestDist = d; best = i; }
    });
    return best;
  })();

  function handleGoToIsocenter() {
    if (isocenterSliceIdx == null) return;
    if (activeModality !== 'CT') setActiveModality('CT');
    setCurrentImageIndex(isocenterSliceIdx);
  }

  function switchModule(mod) {
    setActiveModule(mod);
    if (mod === 'contouring') {
      // the paint canvas only makes sense on the CT stack
      if (modalities.includes('CT')) setActiveModality('CT');
      if (!contouringLoadedRef.current) {
        contouringLoadedRef.current = true;
        contouring.loadFromServer();
      }
    }
    if (mod === 'ebrt') {
      if (modalities.includes('CT')) setActiveModality('CT');
      setEbrtEnabled(true);
      handleGoToIsocenter();
    }
  }

  function handleDoseVisibleChange(nextVisible) {
    setDoseVisible(nextVisible);
    // Grid (~6MB) downloads on first enable; cached afterwards
    if (nextVisible) {
      loadGrid();
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
      {/* Header */}
      <AppBar position="static" sx={{ background: 'background.paper', borderBottom: '1px solid rgba(88,196,220,0.12)' }} elevation={0}>
        {/* Functional module tabs (M1-M5) */}
        <Tabs
          value={activeModule}
          onChange={(_, v) => switchModule(v)}
          variant="standard"
          sx={{
            minHeight: 30,
            borderBottom: '1px solid rgba(88,196,220,0.12)',
            '& .MuiTab-root': { minHeight: 30, fontSize: '0.65rem', fontFamily: 'mono', px: 2 },
          }}
        >
          <Tab value="images" label="IMAGES" />
          <Tab value="contouring" label="CONTOURING" />
          <Tab value="registration" label="REGISTRATION" />
          <Tab value="ebrt" label="EBRT PLAN" />
          <Tab value="evaluation" label="EVALUATION" />
        </Tabs>

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

          {/* Modality tabs (imaging module only) */}
          {activeModule === 'images' && modalities.map(mod => (
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

        {activeModule === 'images' && (
          <ToolbarComponent activeTool={activeTool} onToolChange={setActiveTool} onAutoSegment={handleAutoSegment} />
        )}
      </AppBar>

      <Box sx={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* File list sidebar (imaging module, non-CT modalities) */}
        {activeModule === 'images' && activeModality !== 'CT' && (
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
              key={studyId}
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
              onSegmentVisibilityRef={handleSegmentVisibilityRef}
              onViewportRef={handleViewportRef}
              doseGrid={doseGrid}
              doseMeta={doseData}
              doseVisible={doseVisible}
              doseOpacity={doseOpacity}
              doseThreshold={doseThreshold}
              doseCTZ={currentCTZ}
              isodoseLevels={isodoseLevels}
            />
          ) : activeModule === 'contouring' ? (
            /* contouring without a CT stack: hint only */
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
              <Typography color="text.secondary" variant="body2">
                This study has no CT series to contour.
              </Typography>
            </Box>
          ) : nonCtImageId ? (
            <ViewerViewport
              key={`nonct-${selectedFileId}`}
              imageId={nonCtImageId}
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

          {/* RT Structure contours as SVG (deterministic display path) */}
          {activeModule === 'images' && activeModality === 'CT' && imageIds.length > 0 && (
            <RTStructSVGOverlay
              viewport={viewportInstance}
              contours={contours}
              structureVisibility={structureVisibility}
              ctGeom={ctGeom}
              sopInstanceUID={currentSliceSOP}
              ctZ={currentCTZ}
            />
          )}

          {/* M4 EBRT beam geometry overlay */}
          {activeModule === 'ebrt' && (
            <EBRTBeamsOverlay
              viewport={viewportInstance}
              plan={ebrt.selectedPlan ?? rtPlan}
              selectedBeamNumber={selectedBeamNumber ?? (ebrt.selectedPlan?.beams?.[0]?.beamNumber ?? null)}
              ctZ={currentCTZ}
            />
          )}

          {/* M2 contouring paint layer (above the shared viewport) */}
          {activeModule === 'contouring' && (
            <PaintLayer
              enabled
              viewport={viewportInstance}
              sliceIdx={currentImageIndex}
              ctZ={currentCTZ}
              ctGeom={ctGeom}
              masks={contouring.masks}
              segments={contouring.segments}
              activeSegmentId={contouring.activeSegmentId}
              tool={contouring.tool}
              brushSizeMm={contouring.brushSizeMm}
              paintVersion={contouring.paintVersion}
              onStrokeStart={contouring.strokeStart}
              onStrokeEnd={contouring.strokeEnd}
            />
          )}
        </Box>

        {/* Right sidebar - per-module panels */}
        <Box
          sx={{
            width: 260,
            borderLeft: '1px solid rgba(88,196,220,0.12)',
            background: 'background.paper',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {activeModule === 'images' && (
            <>
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
                    gridLoading={gridLoading}
                    isodoseLevels={isodoseLevels}
                    prescriptionCgy={prescriptionCgy}
                    onVisibleChange={handleDoseVisibleChange}
                    onOpacityChange={setDoseOpacity}
                    onThresholdChange={setDoseThreshold}
                    onLevelsChange={setIsodoseLevels}
                  />
                )}
              </Box>
            </>
          )}

          {activeModule === 'contouring' && <ContouringPanel contouring={contouring} />}
          {activeModule === 'ebrt' && (
            <EbrtWorkspace
              studyId={Number(studyId)}
              ebrt={ebrt}
              rtPlanFileId={rtPlanFileId}
            />
          )}
          {activeModule === 'registration' && <RegistrationModule />}
          {activeModule === 'evaluation' && <EvaluationModule />}
        </Box>
      </Box>
    </Box>
  );
}
