import { Box, Typography, CircularProgress } from '@mui/material';
import { useEffect, useRef, useState, useCallback } from 'react';
import * as cornerstone from '@cornerstonejs/core';
import * as cornerstoneTools from '@cornerstonejs/tools';
import { initCornerstone, addViewportToToolGroup, DEFAULT_TOOL_GROUP_ID } from '../initCornerstone.js';
import { useRTContourSegmentation } from '../hooks/useRTContourSegmentation.js';

const VIEWPORT_ELEMENT_ID = 'dicom-viewport';
const RENDERING_ENGINE_ID = 'myTPSRenderingEngine';
const VIEWPORT_ID = 'CT_VIEWPORT';

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
  onStructureVisibilityChange,  // callback(roiNumber, visible) for structure toggle
}) {
  const containerRef = useRef(null);
  const renderingEngineRef = useRef(null);
  const viewportRef = useRef(null);
  const [isReady, setIsReady] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [status, setStatus] = useState('');
  const [viewportReady, setViewportReady] = useState(false);
  const currentIndexRef = useRef(currentImageIndex);
  const activeToolRef = useRef(activeTool);
  const lastSetIndexRef = useRef(currentImageIndex);
  // Track what triggered the last index change to avoid feedback loops
  const scrollSourceRef = useRef('init'); // 'init' | 'parent' | 'internal'

  // Build visibility map from structures array
  const visibilityMapRef = useRef({});
  useEffect(() => {
    const map = {};
    structures.forEach(s => {
      map[s.roiNumber] = s.visible !== false;
    });
    visibilityMapRef.current = map;
  }, [structures]);

  // Use cornerstone3D native contour segmentation
  const viewportForSeg = viewportReady ? viewportRef.current : null;
  const { setSegmentVisibility } = useRTContourSegmentation({
    viewport: viewportForSeg,
    roiSequence: structures,
    contourSequence: contours,
    visibility: visibilityMapRef.current,
  });

  // Expose setSegmentVisibility to parent via callback
  useEffect(() => {
    if (onStructureVisibilityChange) {
      onStructureVisibilityChange(setSegmentVisibility);
    }
  }, [onStructureVisibilityChange, setSegmentVisibility]);

  // Keep activeTool ref updated
  useEffect(() => {
    activeToolRef.current = activeTool;
  }, [activeTool]);

  useEffect(() => {
    currentIndexRef.current = currentImageIndex;
  }, [currentImageIndex]);

  // Set active tool when it changes
  useEffect(() => {
    if (!isReady) return;

    const toolGroup = cornerstoneTools.ToolGroupManager.getToolGroup(DEFAULT_TOOL_GROUP_ID);
    if (!toolGroup) return;

    // Deactivate all tools first
    const tools = ['Pan', 'Zoom', 'WindowLevel', 'StackScroll', 'Length', 'Angle',
                    'Probe', 'RectangleScissorsTool', 'CircleScissorsTool', 'BrushTool', 'EraserTool'];
    tools.forEach(toolName => {
      try {
        if (toolGroup.hasTool(toolName)) {
          toolGroup.setToolPassive(toolName);
        }
      } catch (e) {
        // Tool might not be in group
      }
    });

    // Map short names to class names for tools that need it
    const toolNameMap = {
      'RectangleScissors': 'RectangleScissorsTool',
      'CircleScissors': 'CircleScissorsTool',
      'Brush': 'BrushTool',
      'Eraser': 'EraserTool',
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
    let eventCleanupFns = [];

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

        // Enable stack prefetch for smooth scrolling
        cornerstoneTools.utilities.stackPrefetch.enable(element);

        // Store viewport reference for overlay
        viewportRef.current = renderingEngine.getViewport(VIEWPORT_ID);
        setViewportReady(true);

        setStatus('Viewport ready');
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
      // Clean up event listeners
      eventCleanupFns.forEach(fn => fn());
      if (renderingEngineRef.current) {
        renderingEngineRef.current.destroy();
      }
    };
  }, []);

  // Handle image loading
  useEffect(() => {
    if (!isReady) {
      return;
    }

    if (!imageId || imageIds.length === 0) {
      setStatus('');
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    let eventCleanupFns = [];

    const loadAndDisplay = async () => {
      setIsLoading(true);
      setStatus('Loading images...');

      try {
        // Use viewportRef directly since it's set after init
        const vp = viewportRef.current;
        if (!vp) {
          throw new Error('Viewport not available');
        }

        setStatus(`setStack with ${imageIds.length} images...`);
        await vp.setStack(imageIds, currentImageIndex);
        setStatus('Rendering...');
        vp.render();
        setStatus('Render complete');

        if (!cancelled) {
          setIsLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          console.error('[Viewer] Failed:', err);
          setError(err.message);
          setIsLoading(false);
        }
      }
    };

    loadAndDisplay();

    return () => {
      cancelled = true;
      // Clean up event listeners
      eventCleanupFns.forEach(fn => fn());
    };
    // Only depend on isReady and imageIds - currentImageIndex is handled by Cornerstone internally
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isReady, imageId]);

  // Handle programmatic index changes (e.g., thumbnail clicks)
  // This is separate from internal scroll handled by Cornerstone
  useEffect(() => {
    if (!isReady) return;

    const vp = viewportRef.current;
    if (!vp) return;

    // Only proceed if parent is requesting a different index than what we last set
    // AND the source was 'parent' (not internal scroll which already updated the viewport)
    if (currentImageIndex === lastSetIndexRef.current) return;
    if (scrollSourceRef.current !== 'parent') return;

    lastSetIndexRef.current = currentImageIndex;

    vp.setStack(imageIds, currentImageIndex).then(() => {
      vp.render();
    }).catch(console.error);
  }, [isReady, currentImageIndex, imageId]);

  // Track Cornerstone internal slice changes and notify parent
  useEffect(() => {
    if (!isReady) return;

    let rafId;
    let lastKnownIndex = -1;

    const checkSliceChange = () => {
      const vp = viewportRef.current;
      if (vp && onImageIndexChange) {
        const currentIdx = vp.getCurrentImageIdIndex();
        if (lastKnownIndex !== -1 && currentIdx !== lastKnownIndex) {
          scrollSourceRef.current = 'internal';
          onImageIndexChange(currentIdx);
        }
        lastKnownIndex = currentIdx;
      }
      rafId = requestAnimationFrame(checkSliceChange);
    };

    // Start polling after a short delay to ensure viewport is ready
    const timeoutId = setTimeout(() => {
      const vp = viewportRef.current;
      if (vp) {
        lastKnownIndex = vp.getCurrentImageIdIndex();
      }
      rafId = requestAnimationFrame(checkSliceChange);
    }, 500);

    return () => {
      clearTimeout(timeoutId);
      if (rafId) {
        cancelAnimationFrame(rafId);
      }
    };
  }, [isReady, onImageIndexChange]);

  // Reset scroll source when parent explicitly sets currentImageIndex
  useEffect(() => {
    scrollSourceRef.current = 'parent';
  }, [currentImageIndex]);

  return (
    <Box ref={containerRef} sx={{ width: '100%', height: '100%', position: 'relative', background: '#07111f' }}>
      <div id={VIEWPORT_ELEMENT_ID} style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0 }} />

      {/* RT Structure Overlay - Cornerstone native segmentation handles rendering */}
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
