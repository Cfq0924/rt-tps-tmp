import * as cornerstone from '@cornerstonejs/core';
import * as cornerstoneTools from '@cornerstonejs/tools';
import {
  cornerstoneStreamingImageVolumeLoader,
  cornerstoneStreamingDynamicImageVolumeLoader,
} from '@cornerstonejs/core/loaders';
import dicomImageLoader, { wadouri } from '@cornerstonejs/dicom-image-loader';

const {
  PanTool,
  ZoomTool,
  WindowLevelTool,
  StackScrollTool,
  LengthTool,
  AngleTool,
  ProbeTool,
  RectangleScissorsTool,
  CircleScissorsTool,
  BrushTool,
  EraserTool,
} = cornerstoneTools;

const { MouseBindings } = cornerstoneTools.Enums;

// Cornerstone3D initialization
let isInitialized = false;
let initPromise = null;

// Default tool group ID
export const DEFAULT_TOOL_GROUP_ID = 'MY_TOOL_GROUP';

/**
 * Initialize Cornerstone3D with DICOM image loader
 * Following official Cornerstone3D example pattern from packages/core/examples/wadouri/
 */
export async function initCornerstone() {
  // Return existing promise if initialization is in progress
  if (initPromise) {
    return initPromise;
  }

  if (isInitialized) {
    return { cornerstone, cornerstoneTools };
  }

  initPromise = doInit();

  async function doInit() {
    try {
      console.log('[Init] Starting initialization...');

      // Expose cornerstone globally (required for dicomImageLoader)
      window.cornerstone = cornerstone;

      // Step 1: Initialize DICOM image loader FIRST (before cornerstone.init)
      console.log('[Init] Calling dicomImageLoader.init()...');
      try {
        dicomImageLoader.init();
        console.log('[Init] dicomImageLoader.init() complete');
      } catch (err) {
        console.error('[Init] dicomImageLoader.init() FAILED:', err);
      }
      // Manually register wadouri loader using the direct wadouri.loadImage
      // This ensures the loader is registered even with Vite pre-bundling
      try {
        cornerstone.imageLoader.registerImageLoader('wadouri', wadouri.loadImage);
      } catch (e) {
        // Registration may fail if already registered, which is fine
      }

      // Step 2: Initialize cornerstone core
      await cornerstone.init();
      console.log('[Init] cornerstone.init() complete');

      // Step 3: Register volume loaders
      cornerstone.volumeLoader.registerUnknownVolumeLoader(
        cornerstoneStreamingImageVolumeLoader
      );
      cornerstone.volumeLoader.registerVolumeLoader(
        'cornerstoneStreamingImageVolume',
        cornerstoneStreamingImageVolumeLoader
      );
      cornerstone.volumeLoader.registerVolumeLoader(
        'cornerstoneStreamingDynamicImageVolume',
        cornerstoneStreamingDynamicImageVolumeLoader
      );
      console.log('[Init] volumeLoader.registerVolumeLoader() complete');

      // Step 4: Add metadata providers (for CT pixel spacing etc.)
      const { calibratedPixelSpacingMetadataProvider } = cornerstone.utilities;
      cornerstone.metaData.addProvider(
        calibratedPixelSpacingMetadataProvider.get.bind(calibratedPixelSpacingMetadataProvider),
        11000
      );
      console.log('[Init] metadata providers added');

      // Step 5: Initialize cornerstone tools
      await cornerstoneTools.init();
      console.log('[Init] cornerstoneTools.init() complete');

      // Step 5: Register tools
      cornerstoneTools.addTool(PanTool);
      cornerstoneTools.addTool(ZoomTool);
      cornerstoneTools.addTool(WindowLevelTool);
      cornerstoneTools.addTool(StackScrollTool);
      cornerstoneTools.addTool(LengthTool);
      cornerstoneTools.addTool(AngleTool);
      cornerstoneTools.addTool(ProbeTool);
      // Segmentation tools
      cornerstoneTools.addTool(RectangleScissorsTool);
      cornerstoneTools.addTool(CircleScissorsTool);
      cornerstoneTools.addTool(BrushTool);
      cornerstoneTools.addTool(EraserTool);
      console.log('[Init] Tools registered');

      // Step 6: Create and configure default tool group
      createDefaultToolGroup();

      isInitialized = true;
      console.log('[Init] Cornerstone3D initialized successfully');
      return { cornerstone, cornerstoneTools };
    } catch (err) {
      console.error('[Init] Failed to initialize Cornerstone:', err);
      initPromise = null; // Reset so retry is possible
      throw err;
    }
  }

  return initPromise;
}

/**
 * Create and configure the default tool group
 */
export function createDefaultToolGroup() {
  const toolGroup = cornerstoneTools.ToolGroupManager.createToolGroup(DEFAULT_TOOL_GROUP_ID);
  if (!toolGroup) {
    console.warn('[Init] Tool group already exists');
    return;
  }

  // Add tools to the tool group
  // Note: Tool names must match how they were registered
  toolGroup.addTool('Pan');
  toolGroup.addTool('Zoom');
  toolGroup.addTool('WindowLevel');
  toolGroup.addTool('StackScroll');
  toolGroup.addTool('Length');
  toolGroup.addTool('Angle');
  toolGroup.addTool('Probe');
  // Segmentation tools - use class names as registered
  toolGroup.addTool('RectangleScissorsTool');
  toolGroup.addTool('CircleScissorsTool');
  toolGroup.addTool('BrushTool');
  toolGroup.addTool('EraserTool');

  // Set default active tool
  toolGroup.setToolActive('Pan', { bindings: [{ mouseButton: 0 }] });
  // Window/Level on right click
  toolGroup.setToolActive('WindowLevel', { bindings: [{ mouseButton: 2 }] });
  // Stack scroll on wheel
  toolGroup.addTool('StackScroll');
  toolGroup.setToolActive('StackScroll', { bindings: [{ mouseButton: MouseBindings.Wheel }] });

  console.log('[Init] Default tool group created');
  return toolGroup;
}

/**
 * Add a viewport to the default tool group
 */
export function addViewportToToolGroup(viewportId, renderingEngineId) {
  const toolGroup = cornerstoneTools.ToolGroupManager.getToolGroup(DEFAULT_TOOL_GROUP_ID);
  if (toolGroup) {
    toolGroup.addViewport(viewportId, renderingEngineId);
    console.log(`[Init] Viewport ${viewportId} added to tool group`);
  }
}

/**
 * Check if Cornerstone is initialized
 */
export function isCsInitialized() {
  return isInitialized;
}

export { cornerstone, cornerstoneTools };
