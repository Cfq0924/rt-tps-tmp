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
import { imageToHU } from '../modules/contouring/paintCore.js';
import EvaluationPanel from '../modules/evaluation/EvaluationPanel.jsx';
import EvaluationPane from '../modules/evaluation/EvaluationPane.jsx';
import DoseProbeOverlay from '../modules/evaluation/DoseProbeOverlay.jsx';
import { useDvh } from '../modules/evaluation/useDvh.js';
import DVHChart from '../modules/evaluation/DVHChart.jsx';
import { trilinearSample, findGlobalMax, voxelToPatient } from '../lib/doseSampling.js';
import RegistrationOverlay from '../modules/registration/RegistrationOverlay.jsx';
import RegistrationPanel from '../modules/registration/RegistrationPanel.jsx';
import PlanSums from '../modules/doseSum/PlanSums.jsx';
import MPRView from '../modules/mpr/MPRView.jsx';
import MPRContourLayer from '../modules/mpr/MPRContourLayer.jsx';
import { loadVolume } from '../lib/mprVolume.js';
import EbrtLeftTree from '../modules/ebrt/EbrtLeftTree.jsx';
import EbrtInfoTabs from '../modules/ebrt/EbrtInfoTabs.jsx';
import AxialCrosshairOverlay from '../modules/ebrt/AxialCrosshairOverlay.jsx';
import EbrtWorkspace from '../modules/ebrt/EbrtWorkspace.jsx';
import { useEbrtPlans } from '../modules/ebrt/useEbrtPlans.js';
import { registerCTPlaneMetadataProvider } from '../lib/ctMetadataProvider.js';
import EBRTBeamsOverlay from '../modules/ebrt/EBRTBeamsOverlay.jsx';
import { useRTPlan } from '../hooks/useRTPlan.js';
import * as cornerstone from '@cornerstonejs/core';
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
  const [exportMenuAnchor, setExportMenuAnchor] = useState(null);
  // P3-M2 registration: moving series + current transform (overlay)
  const [movingState, setMovingState] = useState({ movingUid: '', files: null, movingIndex: 0, matrix: null });
  // MPR three-plane viewer
  const [mprEnabled, setMprEnabled] = useState(false);
  const [mprState, setMprState] = useState({ volume: null, geom: null, progress: null, error: '' });
  const [crosshair, setCrosshair] = useState({ xIdx: 256, yIdx: 256 });
  // M5 point dose probe (evaluation module)
  const [doseProbeEnabled, setDoseProbeEnabled] = useState(false);
  const [doseProbe, setDoseProbe] = useState(null); // { point, doseCgy, pctRx }
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

  // M2 contouring module state (persistence + paint masks + undo/redo)
  const contouring = useContouring({
    studyId: Number(studyId),
    ctFiles: filesForModality,
    ctGeom,
  });

  // MPR column active: enabled + CT + images module (v1 scope)
  const mprActive = mprEnabled && activeModality === 'CT'
    && (activeModule === 'images' || activeModule === 'contouring');
  const mprPaintActive = mprActive && activeModule === 'contouring'
    && ['brush', 'eraser', 'floodfill', 'rect', 'crop'].includes(contouring.tool);

  const prescriptionCgy = (() => {
    if (ebrt.selectedPlan?.prescriptionDoseGy != null) {
      return Math.round(ebrt.selectedPlan.prescriptionDoseGy * 100);
    }
    return rtPlan?.prescription?.targetPrescriptionDoseGy != null
      ? Math.round(rtPlan.prescription.targetPrescriptionDoseGy * 100)
      : null;
  })();

  // M5 evaluation: DVH state shared by the sidebar controls and the main pane
  const paintedSegments = useMemo(
    () => contouring.segments.map(s => ({ ...s, slices: contouring.serializeSegment(s.id) })),
    [contouring.segments, contouring.paintVersion],
  );
  const dvh = useDvh({
    roiSequence: structures,
    contourSequence: contours,
    paintedSegments,
    doseGrid,
    doseMeta: doseData,
    ctFiles: filesForModality,
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

  // --- M5 point dose / global max (evaluation module) ---
  // Sampling geometry built from doseMeta with the field names doseSampling expects.
  const doseSamplingGeom = useMemo(() => {
    if (!doseData) return null;
    return {
      imagePosition: doseData.imagePosition,
      imageOrientation: doseData.imageOrientation,
      pixelSpacing: doseData.pixelSpacing,
      gridFrameOffsetVector: doseData.gridFrameOffsetVector,
      cols: doseData.columns,
      rows: doseData.rows,
    };
  }, [doseData]);

  const sampleDoseAt = useCallback((point) => {
    if (!doseGrid || !doseSamplingGeom) return { point, doseCgy: null, pctRx: null };
    const doseCgy = trilinearSample(doseGrid, doseSamplingGeom, point);
    const pctRx = doseCgy != null && prescriptionCgy
      ? (doseCgy / prescriptionCgy) * 100
      : null;
    return { point, doseCgy, pctRx };
  }, [doseGrid, doseSamplingGeom, prescriptionCgy]);

  const handlePointPick = useCallback((point) => {
    setDoseProbe(sampleDoseAt(point));
  }, [sampleDoseAt]);

  const handleJumpToSlice = useCallback((idx) => {
    if (idx == null || !Number.isInteger(idx)) return;
    if (activeModality !== 'CT') setActiveModality('CT');
    setCurrentImageIndex(idx);
  }, [activeModality]);

  // --- MPR three-plane viewer (IMAGES module, CT only) ---
  const ctFilesSorted = useMemo(
    () => files.filter(f => f.modality === 'CT')
      .sort((a, b) => (a.instance_number ?? 0) - (b.instance_number ?? 0)),
    [files],
  );

  const isEbrtQuad = activeModule === 'ebrt';
  const volumeViewActive = mprEnabled || isEbrtQuad;

  useEffect(() => {
    if (!volumeViewActive || mprState.volume || imageIds.length === 0) return;
    let alive = true;
    setMprState({ volume: null, geom: null, progress: { loaded: 0, total: imageIds.length }, error: '' });
    loadVolume({
      imageIds,
      files: ctFilesSorted,
      getSignedUrl,
      onProgress: (loaded, total) => {
        if (alive) setMprState(s => ({ ...s, progress: { loaded, total } }));
      },
    })
      .then(({ volume, geom }) => {
        if (alive) setMprState(s => ({ ...s, volume, geom, progress: null }));
      })
      .catch(err => {
        if (alive) setMprState(s => ({ ...s, error: err.message, progress: null }));
      });
    return () => { alive = false; };
  }, [volumeViewActive, imageIds, ctFilesSorted, mprState.volume]);

  // keep the default crosshair centred once the geometry is known
  useEffect(() => {
    if (mprState.geom) {
      setCrosshair({
        xIdx: Math.floor(mprState.geom.cols / 2),
        yIdx: Math.floor(mprState.geom.rows / 2),
      });
    }
  }, [mprState.geom]);

  const mprDoseProps = useMemo(() => (
    (doseVisible && doseGrid && doseData) ? {
      grid: doseGrid,
      geom: {
        imagePosition: doseData.imagePosition,
        imageOrientation: doseData.imageOrientation,
        pixelSpacing: doseData.pixelSpacing,
        gridFrameOffsetVector: doseData.gridFrameOffsetVector,
        columns: doseData.columns, rows: doseData.rows,
      },
      doseAtFull: (doseData.maxDose ?? 100) * (doseThreshold / 100),
      opacity: doseOpacity,
    } : null
  ), [doseVisible, doseGrid, doseData, doseThreshold, doseOpacity]);

  const handleMprCrosshair = useCallback((patch) => {
    if (patch.sliceIdx != null && patch.sliceIdx !== currentImageIndex) {
      setCurrentImageIndex(patch.sliceIdx);
    }
    setCrosshair(prev => ({
      xIdx: patch.xIdx ?? prev.xIdx,
      yIdx: patch.yIdx ?? prev.yIdx,
    }));
  }, [currentImageIndex]);

  // MPR panes centre on the plan isocentre (EBRT) or the volume centre (MPR)
  const mprIso = useMemo(() => {
    if (isEbrtQuad && ebrt.selectedPlan?.isocenterX != null) {
      return [ebrt.selectedPlan.isocenterX, ebrt.selectedPlan.isocenterY, ebrt.selectedPlan.isocenterZ];
    }
    if (!mprState.geom) return null;
    const g = mprState.geom;
    return [
      g.originX + g.cols * g.spacingX / 2,
      g.originY + g.rows * g.spacingY / 2,
      g.zPositions[Math.floor(g.numSlices / 2)],
    ];
  }, [isEbrtQuad, ebrt.selectedPlan, mprState.geom]);

  const handleJumpToGlobalMax = useCallback(() => {
    if (!doseGrid || !doseSamplingGeom || !filesForModality.length) return;
    const { flatIndex } = findGlobalMax(doseGrid);
    const point = voxelToPatient(flatIndex, doseSamplingGeom);
    setDoseProbe(sampleDoseAt(point));
    // jump to the CT slice containing the max point (isocenter-jump pattern)
    let best = 0, bestDist = Infinity;
    filesForModality.forEach((f, i) => {
      const d = Math.abs((f.image_position_z ?? 0) - point[2]);
      if (d < bestDist) { bestDist = d; best = i; }
    });
    if (activeModality !== 'CT') setActiveModality('CT');
    setCurrentImageIndex(best);
  }, [doseGrid, doseSamplingGeom, filesForModality, sampleDoseAt, activeModality]);

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
    if (mod === 'evaluation') {
      // DVH needs the dose grid — load it regardless of heatmap display
      loadGrid();
    }
  }

  // CT HU pixels of the displayed slice (for flood fill / auto body)
  const getCtPixels = useCallback(() => {
    try {
      const vp = viewportInstance;
      if (!vp) return null;
      return imageToHU(cornerstone.cache.getImage(vp.getCurrentImageId()));
    } catch (err) {
      return null;
    }
  }, [viewportInstance]);

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
          {activeModule === 'images' && activeModality === 'CT' && imageIds.length > 0 && (
            <Tooltip title="Three-plane viewer (axial + coronal + sagittal)">
              <Chip
                label="MPR"
                size="small"
                variant={mprEnabled ? 'filled' : 'outlined'}
                color={mprEnabled ? 'primary' : 'default'}
                onClick={() => setMprEnabled(v => !v)}
                sx={{ fontFamily: 'mono', fontSize: '0.7rem', height: 22, cursor: 'pointer' }}
              />
            </Tooltip>
          )}
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

          {/* M1 DICOM RT export */}
          <Button
            size="small"
            variant="outlined"
            startIcon={<Download />}
            onClick={(e) => setExportMenuAnchor(e.currentTarget)}
            sx={{ fontSize: '0.75rem', py: 0.5, mr: 1 }}
          >
            Export
          </Button>
          <Menu
            anchorEl={exportMenuAnchor}
            open={!!exportMenuAnchor}
            onClose={() => setExportMenuAnchor(null)}
          >
            <MenuItem
              onClick={() => { setExportMenuAnchor(null); window.location.href = `/api/export/study/${studyId}/rtstruct`; }}
            >
              RTSTRUCT — painted segments
            </MenuItem>
            <MenuItem
              disabled={!ebrt.selectedPlan}
              onClick={() => { setExportMenuAnchor(null); window.location.href = `/api/export/ebrt/plan/${ebrt.selectedPlan.id}/rtplan`; }}
            >
              RTPLAN — {ebrt.selectedPlan?.name ?? 'no plan selected'}
            </MenuItem>
          </Menu>

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

        {/* Main viewer (+ MPR column when enabled) */}
        <Box sx={isEbrtQuad ? {
            flex: 1, display: 'grid', overflow: 'hidden', position: 'relative', background: '#07111f',
            gridTemplateColumns: '240px minmax(0, 2fr) minmax(0, 1fr)',
            gridTemplateRows: 'minmax(0, 1fr) minmax(0, 1fr) auto',
          } : { flex: 1, display: 'flex', overflow: 'hidden', position: 'relative', background: '#07111f' }}>
        {isEbrtQuad && (
          <Box sx={{ gridColumn: 1, gridRow: '1 / 3', borderRight: '1px solid rgba(88,196,220,0.12)', overflow: 'auto' }}>
            <EbrtLeftTree
              structures={structures}
              structureVisibility={structureVisibility}
              onToggleStructure={handleToggleStructure}
              isodoseLevels={isodoseLevels}
              onIsodoseChange={setIsodoseLevels}
              beams={ebrt.selectedPlan?.beams ?? null}
              selectedBeamNumber={selectedBeamNumber}
              onSelectBeam={setSelectedBeamNumber}
              referencePoints={ebrt.selectedPlan?.referencePoints ?? null}
              ctFiles={ctFilesSorted}
              onJumpToSlice={handleJumpToSlice}
            />
          </Box>
        )}
        <Box sx={isEbrtQuad ? { gridColumn: 2, gridRow: 1, position: 'relative', minWidth: 0, minHeight: 0, overflow: 'hidden' } : { flex: mprActive ? 2 : 1, position: 'relative' }}>
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
              activeSegmentApproved={contouring.activeSegmentApproved}
              tool={contouring.tool}
              brushSizeMm={contouring.brushSizeMm}
              paintVersion={contouring.paintVersion}
              onStrokeStart={contouring.strokeStart}
              onStrokeEnd={contouring.strokeEnd}
              onFloodFill={(sliceIdx, si, sj, ctPixels) => contouring.floodFillAt(sliceIdx, { i: si, j: sj }, 50, ctPixels)}
              cropMode={contouring.cropMode}
              onCrop={(sliceIdx, rect, mode) => contouring.cropActiveOnSlice(sliceIdx, rect, mode)}
            />
          )}

          {/* EBRT quad: axial crosshair reference lines */}
          {isEbrtQuad && (
            <AxialCrosshairOverlay
              viewport={viewportInstance}
              ctGeom={ctGeom}
              ctZ={currentCTZ}
              crosshair={crosshair}
            />
          )}

          {/* P3-M2 registration overlay: moving series with the current transform */}
          {activeModule === 'registration' && movingState.movingUid && (
            <RegistrationOverlay
              viewport={viewportInstance}
              matrix={movingState.matrix}
              opacity={0.5}
              movingFiles={movingState.files}
              movingIndex={movingState.movingIndex}
              visible
              getSignedUrl={getSignedUrl}
            />
          )}

          {/* M5 point dose probe (evaluation module, toggled from the panel) */}
          {activeModule === 'evaluation' && (
            <DoseProbeOverlay
              enabled={doseProbeEnabled}
              viewport={viewportInstance}
              ctZ={currentCTZ}
              doseProbe={doseProbe}
              onPointPick={handlePointPick}
            />
          )}
        </Box>

          {/* M5 evaluation: full-width DVH pane next to the viewport */}
          {activeModule === 'evaluation' && (
            <Box sx={{ width: '46%', minWidth: 480, borderLeft: '1px solid rgba(88,196,220,0.12)',
                       background: 'background.paper' }}>
              <EvaluationPane
                dvh={dvh}
                doseReady={!!(doseGrid && doseData)}
                prescriptionCgy={prescriptionCgy}
              />
            </Box>
          )}

        {/* EBRT quad: DVH pane (TR), coronal + sagittal (BL/BR), info tabs (bottom) */}
        {isEbrtQuad && (
          <Box sx={{ gridColumn: 3, gridRow: 1, position: 'relative', minWidth: 0, minHeight: 0,
                     overflow: 'hidden', borderLeft: '1px solid rgba(88,196,220,0.12)', p: 0.5, boxSizing: 'border-box',
                     display: 'flex', flexDirection: 'column' }}>
            <Typography variant="caption" sx={{ px: 0.5, fontSize: '0.55rem', color: 'text.disabled', fontFamily: 'mono' }}>
              DVH — tick structures in EVALUATION
            </Typography>
            <Box sx={{ flex: 1, minHeight: 0 }}>
              <DVHChart results={dvh.results} prescriptionCgy={prescriptionCgy} />
            </Box>
            {(isodoseLevels ?? []).length > 0 && (
              <Box sx={{ px: 0.5, pb: 0.5, display: 'flex', flexWrap: 'wrap', gap: 0.25 }}>
                {isodoseLevels.filter(l => l.visible).map(l => (
                  <Box key={l.id} component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.25,
                        border: '1px solid rgba(88,196,220,0.2)', borderRadius: 0.5, px: 0.4 }}>
                    <Box sx={{ width: 6, height: 6, borderRadius: '1px', bgcolor: l.color }} />
                    <Typography component="span" sx={{ fontSize: '0.52rem', fontFamily: 'mono', color: 'text.secondary' }}>
                      {l.pct}%
                    </Typography>
                  </Box>
                ))}
              </Box>
            )}
          </Box>
        )}
        {isEbrtQuad && (
          <Box sx={{ gridColumn: 2, gridRow: 2, position: 'relative', minWidth: 0, minHeight: 0,
                     overflow: 'hidden', borderTop: '1px solid rgba(88,196,220,0.12)' }}>
            <MPRView
              orientation="coronal"
              volumeState={mprState}
              crosshair={crosshair}
              sliceIdx={currentImageIndex}
              onCrosshairChange={handleMprCrosshair}
              dose={mprDoseProps}
              masterViewport={viewportInstance}
              iso={mprIso}
            />
          </Box>
        )}
        {isEbrtQuad && (
          <Box sx={{ gridColumn: 3, gridRow: 2, position: 'relative', minWidth: 0, minHeight: 0,
                     overflow: 'hidden', borderLeft: '1px solid rgba(88,196,220,0.12)', borderTop: '1px solid rgba(88,196,220,0.12)' }}>
            <MPRView
              orientation="sagittal"
              volumeState={mprState}
              crosshair={crosshair}
              sliceIdx={currentImageIndex}
              onCrosshairChange={handleMprCrosshair}
              dose={mprDoseProps}
              masterViewport={viewportInstance}
              iso={mprIso}
            />
          </Box>
        )}
        {isEbrtQuad && (
          <Box sx={{ gridColumn: '1 / -1', gridRow: 3, height: 170 }}>
            <EbrtInfoTabs
              plan={ebrt.selectedPlan}
              dvhResults={dvh.results}
              doseGrid={doseGrid}
              doseMeta={doseData}
              prescriptionCgy={prescriptionCgy}
              onPatchCalcModels={(patch) => ebrt.updatePlan(ebrt.selectedPlan.id, { calc_models_json: patch })}
            />
          </Box>
        )}

        {mprActive && (
          <Box sx={{ width: '30%', minWidth: 260, display: 'flex', flexDirection: 'column',
                     borderLeft: '1px solid rgba(88,196,220,0.12)' }}>
            <Box sx={{ flex: 1, position: 'relative', borderBottom: '1px solid rgba(88,196,220,0.12)' }}>
              <MPRView
                orientation="coronal"
                volumeState={mprState}
                crosshair={crosshair}
                sliceIdx={currentImageIndex}
                onCrosshairChange={handleMprCrosshair}
                dose={doseVisible && doseGrid && doseData ? {
                  grid: doseGrid,
                  geom: {
                    imagePosition: doseData.imagePosition,
                    imageOrientation: doseData.imageOrientation,
                    pixelSpacing: doseData.pixelSpacing,
                    gridFrameOffsetVector: doseData.gridFrameOffsetVector,
                    columns: doseData.columns, rows: doseData.rows,
                  },
                  doseAtFull: (doseData.maxDose ?? 100) * (doseThreshold / 100),
                  opacity: doseOpacity,
                } : null}
                masterViewport={viewportInstance}
                iso={mprIso}
              />
              {mprState.geom && (
                <MPRContourLayer
                  orientation="coronal"
                  geom={mprState.geom}
                  volume={mprState.volume}
                  masterViewport={viewportInstance}
                  iso={mprIso}
                  planeCoord={crosshair.yIdx}
                  sliceIdx={currentImageIndex}
                  segments={contouring.segments}
                  masks={contouring.masks}
                  paintVersion={contouring.paintVersion}
                  paintEnabled={mprPaintActive}
                  tool={contouring.tool}
                  brushSizeMm={contouring.brushSizeMm}
                  cropMode={contouring.cropMode}
                  activeSegmentId={contouring.activeSegmentId}
                  activeSegmentApproved={contouring.activeSegmentApproved}
                  onPaintPlane={contouring.paintOnPlane}
                  onFillRectPlane={contouring.fillRectOnPlane}
                  onCropPlane={contouring.cropOnPlane}
                  onFloodFillPlane={contouring.floodFillOnPlane}
                />
              )}
            </Box>
            <Box sx={{ flex: 1, position: 'relative' }}>
              <MPRView
                orientation="sagittal"
                volumeState={mprState}
                crosshair={crosshair}
                sliceIdx={currentImageIndex}
                onCrosshairChange={handleMprCrosshair}
                dose={doseVisible && doseGrid && doseData ? {
                  grid: doseGrid,
                  geom: {
                    imagePosition: doseData.imagePosition,
                    imageOrientation: doseData.imageOrientation,
                    pixelSpacing: doseData.pixelSpacing,
                    gridFrameOffsetVector: doseData.gridFrameOffsetVector,
                    columns: doseData.columns, rows: doseData.rows,
                  },
                  doseAtFull: (doseData.maxDose ?? 100) * (doseThreshold / 100),
                  opacity: doseOpacity,
                } : null}
                masterViewport={viewportInstance}
                iso={mprIso}
              />
              {mprState.geom && (
                <MPRContourLayer
                  orientation="sagittal"
                  geom={mprState.geom}
                  volume={mprState.volume}
                  masterViewport={viewportInstance}
                  iso={mprIso}
                  planeCoord={crosshair.xIdx}
                  sliceIdx={currentImageIndex}
                  segments={contouring.segments}
                  masks={contouring.masks}
                  paintVersion={contouring.paintVersion}
                  paintEnabled={mprPaintActive}
                  tool={contouring.tool}
                  brushSizeMm={contouring.brushSizeMm}
                  cropMode={contouring.cropMode}
                  activeSegmentId={contouring.activeSegmentId}
                  activeSegmentApproved={contouring.activeSegmentApproved}
                  onPaintPlane={contouring.paintOnPlane}
                  onFillRectPlane={contouring.fillRectOnPlane}
                  onCropPlane={contouring.cropOnPlane}
                  onFloodFillPlane={contouring.floodFillOnPlane}
                />
              )}
            </Box>
          </Box>
        )}

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
                  <>
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
                    <Divider sx={{ mx: 1.5, my: 0.5 }} />
                    <PlanSums
                      studyId={Number(studyId)}
                      doseFiles={files.filter(f => f.modality === 'RTDOSE')}
                      activeDoseFileId={rtDoseFileId}
                      onSelectDoseFile={setRtDoseFileId}
                    />
                  </>
                )}
              </Box>
            </>
          )}

          {activeModule === 'contouring' && (
            <ContouringPanel
              contouring={contouring}
              sliceIdx={currentImageIndex}
              getCtPixels={getCtPixels}
            />
          )}
          {activeModule === 'ebrt' && (
            <EbrtWorkspace
              studyId={Number(studyId)}
              ebrt={ebrt}
              rtPlanFileId={rtPlanFileId}
              currentSliceIdx={currentImageIndex}
              onJumpToSlice={handleJumpToSlice}
            />
          )}
          {activeModule === 'registration' && (
            <RegistrationPanel
              studyId={Number(studyId)}
              files={files}
              fixedSeriesUid={filesForModality[0]?.series_instance_uid ?? ''}
              currentSliceIdx={currentImageIndex}
              ctGeom={ctGeom}
              ctZ={currentCTZ}
              getCtHuPixels={getCtPixels}
              onMovingChange={setMovingState}
            />
          )}
          {activeModule === 'evaluation' && (
            <EvaluationPanel
              dvh={dvh}
              doseReady={!!(doseGrid && doseData)}
              doseProbe={doseProbe}
              probeEnabled={doseProbeEnabled}
              onToggleProbe={() => setDoseProbeEnabled(v => !v)}
              onJumpToGlobalMax={handleJumpToGlobalMax}
            />
          )}
        </Box>
      </Box>
    </Box>
  </Box>
  );
}
