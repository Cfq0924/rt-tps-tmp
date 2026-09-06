import { Box, Typography, CircularProgress } from '@mui/material';
import { useEffect, useRef, useState, useCallback } from 'react';
import * as cornerstone from '@cornerstonejs/core';
import * as cornerstoneTools from '@cornerstonejs/tools';
import { initCornerstone, addViewportToToolGroup, DEFAULT_TOOL_GROUP_ID } from '../initCornerstone.js';
import { useRTContourSegmentation } from '../hooks/useRTContourSegmentation.js';
import RTDoseOverlay from './RTDoseOverlay.jsx';

const VIEWPORT_ELEMENT_ID = 'dicom-viewport';
const RENDERING_ENGINE_ID = 'myTPSRenderingEngine';
const VIEWPORT_ID = 'CT_VIEWPORT';

// StackViewport is used for CT display. The VolumeViewport (ORTHOGRAPHIC)
// migration is on hold: with cornerstone3D 4.20–4.22 the volume texture never
// receives data on real (hardware) GL contexts — the viewport stays black,
// while the exact same code renders correctly under software GL
// (SwiftShader). See WISSEN.md §9 before resuming that work.

export default function ViewerViewport({
  imageId,
  activeTool,
  imageIds = [],
  currentImageIndex = 0,
  onImageIndexChange,
  structures = [],        // roiSequence from RTSTRUCT
  contours = [],          // contourSequence from RTSTRUCT
  structureOverlayVisible = true,
  activeModality = 'CT',
  imagePosition,
  pixelSpacing,
  frameOfReferenceUID,
  onSegmentVisibilityRef,  // callback to register setSegmentVisibility function
  onViewportRef,           // callback to register the cornerstone viewport instance
  // RT Dose overlay props (pass-through to RTDoseOverlay)
  doseGrid = null,
  doseMeta = null,
  doseVisible = false,
  doseOpacity = 0.5,
  doseThreshold = 20,
  doseCTZ = null,          // z (mm) of the currently displayed CT slice, for the dose overlay
  isodoseLevels = [],      // user-editable iso line levels (% of maxDose)
}) {
  const containerRef = useRef(null);
  const renderingEngineRef = useRef(null);
  const viewportRef = useRef(null);
  const [isReady, setIsReady] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [status, setStatus] = useState('');
  const [viewportReady, setViewportReady] = useState(false);
  const [viewportFrameOfReferenceUID, setViewportFrameOfReferenceUID] = useState(null);
  const activeToolRef = useRef(activeTool);
  const lastSetIndexRef = useRef(currentImageIndex);
  // Track what triggered the last index change to avoid feedback loops
  const scrollSourceRef = useRef('init'); // 'init' | 'parent' | 'internal'
  // The imageId whose stack is (being) loaded — guards against duplicate
  // stack loading from React StrictMode double-invoked effects
  const loadedStackForRef = useRef(null);

  // Build visibility map from structures array
  const visibilityMapRef = useRef({});
  useEffect(() => {
    const map = {};
    structures.forEach(s => {
      map[s.roiNumber] = s.visible !== false;
    });
    visibilityMapRef.current = map;
  }, [structures]);

  // Render RT Structure contours via cornerstone3D native segmentation.
  // Contours attach only after the stack is on the viewport
  // (viewportFrameOfReferenceUID flips from null once that happened).
  const viewportForSeg = viewportReady ? viewportRef.current : null;
  const { setSegmentVisibility } = useRTContourSegmentation({
    viewport: viewportForSeg,
    frameOfReferenceUID: viewportFrameOfReferenceUID,
    imageIds,
    roiSequence: structures,
    contourSequence: contours,
    visibility: visibilityMapRef.current,
  });

  // Expose setSegmentVisibility to parent via callback
  useEffect(() => {
    if (onSegmentVisibilityRef) {
      onSegmentVisibilityRef(setSegmentVisibility);
    }
  }, [onSegmentVisibilityRef, setSegmentVisibility]);

  // Expose the cornerstone viewport instance to the parent via callback
  const viewportForParent = viewportReady ? viewportRef.current : null;
  useEffect(() => {
    if (onViewportRef) {
      onViewportRef(viewportForParent);
    }
  }, [onViewportRef, viewportForParent]);

  // Keep activeTool ref updated
  useEffect(() => {
    activeToolRef.current = activeTool;
  }, [activeTool]);

  // Set active tool when it changes
  useEffect(() => {
    if (!isReady) return;

    const toolGroup = cornerstoneTools.ToolGroupManager.getToolGroup(DEFAULT_TOOL_GROUP_ID);
    if (!toolGroup) return;

    // Deactivate all tools first
    const tools = ['Pan', 'Zoom', 'WindowLevel', 'StackScroll', 'Length', 'Angle',
                    'Probe', 'RectangleScissor', 'CircleScissor', 'Brush', 'Eraser'];
    tools.forEach(toolName => {
      try {
        if (toolGroup.hasTool(toolName)) {
          toolGroup.setToolPassive(toolName);
        }
      } catch (e) {
        // Tool might not be in group
      }
    });

    // Map toolbar ids to registered tool names
    const toolNameMap = {
      'RectangleScissors': 'RectangleScissor',
      'CircleScissors': 'CircleScissor',
      'Brush': 'Brush',
      'Eraser': 'Eraser',
    };
    const toolToActivate = toolNameMap[activeTool] || activeTool;

    // Activate the selected tool
    if (toolToActivate && toolGroup.hasTool(toolToActivate)) {
      toolGroup.setToolActive(toolToActivate, { bindings: [{ mouseButton: 0 }] });
    }
  }, [activeTool, isReady]);

  // Initialize Cornerstone
  useEffect(() => {
    let mounted = true;

    const init = async () => {
      try {
        setStatus('Initializing...');
        await initCornerstone();
        setStatus('Cornerstone ready');

        if (!mounted) return;

        const element = document.getElementById(VIEWPORT_ELEMENT_ID);
        if (!element) {
          throw new Error('Viewport element not found');
        }

        const renderingEngine = new cornerstone.RenderingEngine(RENDERING_ENGINE_ID);
        renderingEngineRef.current = renderingEngine;

        renderingEngine.enableElement({
          viewportId: VIEWPORT_ID,
          type: cornerstone.Enums.ViewportType.STACK,
          element,
          defaultOptions: {
            background: [0.027, 0.067, 0.122],
          },
        });

        // Add viewport to default tool group
        addViewportToToolGroup(VIEWPORT_ID, RENDERING_ENGINE_ID);

        viewportRef.current = renderingEngine.getViewport(VIEWPORT_ID);
        setViewportReady(true);

        if (mounted) {
          setIsReady(true);
        }
      } catch (err) {
        console.error('[Viewer] Init error:', err);
        setError(err.message);
        setIsLoading(false);
      }
    };

    init();

    return () => {
      mounted = false;
      if (renderingEngineRef.current) {
        renderingEngineRef.current.destroy();
      }
    };
  }, []);

  // Handle stack loading
  useEffect(() => {
    if (!isReady) {
      return;
    }

    if (!imageId || imageIds.length === 0) {
      setStatus('');
      setIsLoading(false);
      return;
    }

    // React StrictMode (dev) invokes every effect twice with the same props —
    // deduplicate by imageId so the stack is only created and loaded once.
    // Reset on failure so a re-render can retry.
    if (loadedStackForRef.current === imageId) return;

    const loadAndDisplay = async () => {
      loadedStackForRef.current = imageId;

      setIsLoading(true);
      setStatus(`Loading ${imageIds.length} images...`);

      try {
        const vp = viewportRef.current;
        if (!vp) {
          throw new Error('Viewport not available');
        }

        // setStack renders the first image; the datasets for every imageId are
        // cached as they stream in (metadata queries depend on that)
        await vp.setStack(imageIds, 0);

        // Contours need the viewport FoR, which is only valid once the stack
        // is in place — flip it from null to let the hook initialize
        setViewportFrameOfReferenceUID(vp.getFrameOfReferenceUID());

        // Jump to the specified slice index (scroll API — 4.22 has no
        // setCurrentImageIdIndex)
        if (currentImageIndex > 0) {
          vp.scroll(currentImageIndex - vp.getCurrentImageIdIndex(), false);
        }

        vp.render();
        setStatus('');
        setIsLoading(false);
      } catch (err) {
        loadedStackForRef.current = null;
        console.error('[Viewer] Failed:', err);
        setError(err.message);
        setIsLoading(false);
      }
    };

    loadAndDisplay();
    // currentImageIndex is handled via setCurrentImageIdIndex / camera events, not as a dep
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReady, imageId]);

  // Handle programmatic index changes (e.g., thumbnail clicks)
  useEffect(() => {
    if (!isReady) return;

    const vp = viewportRef.current;
    if (!vp) return;

    // Only proceed if parent is requesting a different index than what we last set
    // AND the source was 'parent' (not internal scroll which already updated the viewport)
    if (currentImageIndex === lastSetIndexRef.current) return;
    if (scrollSourceRef.current !== 'parent') return;

    lastSetIndexRef.current = currentImageIndex;

    vp.scroll(currentImageIndex - vp.getCurrentImageIdIndex(), false);
  }, [isReady, currentImageIndex]);

  // Track slice changes and notify the parent. cornerstone 4.22's programmatic
  // scroll() does NOT dispatch CAMERA_MODIFIED on the viewport element, so the
  // reliable way to observe the index is a rAF poll (state updates only on
  // change — negligible cost).
  useEffect(() => {
    if (!isReady) return;

    let raf;
    let lastKnownIndex = viewportRef.current?.getCurrentImageIdIndex?.() ?? -1;

    const tick = () => {
      const vp = viewportRef.current;
      const idx = vp?.getCurrentImageIdIndex?.();
      if (typeof idx === 'number' && idx !== lastKnownIndex) {
        lastKnownIndex = idx;
        scrollSourceRef.current = 'internal';
        lastSetIndexRef.current = idx;
        onImageIndexChange?.(idx);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(raf);
  }, [isReady, onImageIndexChange]);

  // Reset scroll source when parent explicitly sets currentImageIndex
  useEffect(() => {
    scrollSourceRef.current = 'parent';
  }, [currentImageIndex]);

  return (
    <Box ref={containerRef} sx={{ width: '100%', height: '100%', position: 'relative', background: '#07111f' }}>
      <div id={VIEWPORT_ELEMENT_ID} style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }} />

      {/* RT Dose heat map overlay (transparent canvas above the viewport) */}
      <RTDoseOverlay
        viewport={viewportForParent}
        grid={doseGrid}
        doseMeta={doseMeta}
        ctZ={doseCTZ}
        visible={doseVisible}
        opacity={doseOpacity}
        threshold={doseThreshold}
        isodoseLevels={isodoseLevels}
      />

      {status && (
        <Box sx={{ position: 'absolute', top: 8, left: 8, right: 8, background: 'rgba(0,0,0,0.7)', p: 1, borderRadius: 0.5 }}>
          <Typography variant="caption" sx={{ fontFamily: 'mono', fontSize: '0.65rem', color: '#58c4dc', wordBreak: 'break-all' }}>
            {status}
          </Typography>
        </Box>
      )}

      {isLoading && (
        <Box sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}>
          <CircularProgress size={24} sx={{ color: '#58c4dc' }} />
        </Box>
      )}

      {error && (
        <Box sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center', p: 2, background: 'rgba(0,0,0,0.8)', maxWidth: '80%' }}>
          <Typography variant="body2" color="error">{error}</Typography>
        </Box>
      )}

      {!imageId && !isLoading && !error && (
        <Box sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>Select a CT image to view</Typography>
        </Box>
      )}
    </Box>
  );
}
