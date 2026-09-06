import * as cornerstone from '@cornerstonejs/core';
import * as cornerstoneTools from '@cornerstonejs/tools';
import {
  cornerstoneStreamingImageVolumeLoader,
  cornerstoneStreamingDynamicImageVolumeLoader,
} from '@cornerstonejs/core/loaders';
import dicomImageLoader from '@cornerstonejs/dicom-image-loader';

// Import basic tools from main package
const {
  PanTool,
  ZoomTool,
  WindowLevelTool,
  StackScrollTool,
  LengthTool,
  AngleTool,
  ProbeTool,
} = cornerstoneTools;

// Import segmentation tools from subpath exports
import RectScissorsTool from '@cornerstonejs/tools/tools/segmentation/RectangleScissorsTool';
import CircleScissorsTool from '@cornerstonejs/tools/tools/segmentation/CircleScissorsTool';
import BrushTool from '@cornerstonejs/tools/tools/segmentation/BrushTool';
import EraserTool from '@cornerstonejs/tools/tools/AnnotationEraserTool';

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

      // Initialize dicomImageLoader first (per official cornerstone3D examples)
      dicomImageLoader.init();

      // Initialize cornerstone core
      await cornerstone.init();

      // Register the wadouri image loader and metadata provider
      dicomImageLoader.wadouri.register();

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
      cornerstoneTools.addTool(RectScissorsTool);
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
    return;
  }

  // Add tools to the tool group
  toolGroup.addTool('Pan');
  toolGroup.addTool('Zoom');
  toolGroup.addTool('WindowLevel');
  toolGroup.addTool('StackScroll');
  toolGroup.addTool('Length');
  toolGroup.addTool('Angle');
  toolGroup.addTool('Probe');
  toolGroup.addTool('RectangleScissor');
  toolGroup.addTool('CircleScissor');
  toolGroup.addTool('Brush');
  toolGroup.addTool('Eraser');

  // Set default active tool
  toolGroup.setToolActive('Pan', { bindings: [{ mouseButton: 0 }] });
  toolGroup.setToolActive('WindowLevel', { bindings: [{ mouseButton: 2 }] });
  toolGroup.addTool('StackScroll');
  toolGroup.setToolActive('StackScroll', { bindings: [{ mouseButton: MouseBindings.Wheel }] });

  return toolGroup;
}

/**
 * Add a viewport to the default tool group
 */
export function addViewportToToolGroup(viewportId, renderingEngineId) {
  const toolGroup = cornerstoneTools.ToolGroupManager.getToolGroup(DEFAULT_TOOL_GROUP_ID);
  if (toolGroup) {
    toolGroup.addViewport(viewportId, renderingEngineId);
  }
}

/**
 * Check if Cornerstone is initialized
 */
export function isCsInitialized() {
  return isInitialized;
}

export { cornerstone, cornerstoneTools };

/**
 * CT Transfer Function for Volume Actor
 * Sets the window/level (WW: 400, WC: 40) for CT images
 * This is required for proper CT rendering in VolumeViewport
 */
const windowWidth = 400;
const windowCenter = 40;

const lower = windowCenter - windowWidth / 2.0;
const upper = windowCenter + windowWidth / 2.0;

const ctVoiRange = { lower, upper };

export function setCtTransferFunctionForVolumeActor({ volumeActor }) {
  volumeActor
    .getProperty()
    .getRGBTransferFunction(0)
    .setMappingRange(lower, upper);
}

export { ctVoiRange };
