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
      window.cornerstone = cornerstone;

      await cornerstone.init();
      dicomImageLoader.init();

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

      const { calibratedPixelSpacingMetadataProvider } = cornerstone.utilities;
      cornerstone.metaData.addProvider(
        calibratedPixelSpacingMetadataProvider.get.bind(calibratedPixelSpacingMetadataProvider),
        11000
      );

      await cornerstoneTools.init();

      cornerstoneTools.addTool(PanTool);
      cornerstoneTools.addTool(ZoomTool);
      cornerstoneTools.addTool(WindowLevelTool);
      cornerstoneTools.addTool(StackScrollTool);
      cornerstoneTools.addTool(LengthTool);
      cornerstoneTools.addTool(AngleTool);
      cornerstoneTools.addTool(ProbeTool);
      cornerstoneTools.addTool(RectangleScissorsTool);
      cornerstoneTools.addTool(CircleScissorsTool);
      cornerstoneTools.addTool(BrushTool);
      cornerstoneTools.addTool(EraserTool);

      createDefaultToolGroup();

      isInitialized = true;
      return { cornerstone, cornerstoneTools };
    } catch (err) {
      console.error('[Init] Failed to initialize Cornerstone:', err);
      initPromise = null;
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
