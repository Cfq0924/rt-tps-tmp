import * as cornerstone from '@cornerstonejs/core';
import * as cornerstoneTools from '@cornerstonejs/tools';

const {
  PanTool,
  ZoomTool,
  WindowLevelTool,
  StackScrollTool,
  LengthTool,
  AngleTool,
  ProbeTool,
} = cornerstoneTools;

// Initialize Cornerstone3D (full imaging implementation in Phase 2)
export async function initCornerstone() {
  await cornerstone.init();
  await cornerstoneTools.init();

  // Register tools
  cornerstoneTools.addTool(PanTool);
  cornerstoneTools.addTool(ZoomTool);
  cornerstoneTools.addTool(WindowLevelTool);
  cornerstoneTools.addTool(StackScrollTool);
  cornerstoneTools.addTool(LengthTool);
  cornerstoneTools.addTool(AngleTool);
  cornerstoneTools.addTool(ProbeTool);

  return { cornerstone, cornerstoneTools };
}
