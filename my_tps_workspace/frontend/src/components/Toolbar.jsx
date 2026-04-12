import { useState } from 'react';
import {
  Box, ButtonGroup, Button, Tooltip, Divider, Typography,
} from '@mui/material';
import {
  PanTool, ZoomIn, Contrast, Layers, ContentCut, Circle, Brush, Clear,
} from '@mui/icons-material';

// Tool names must match registered tool names in initCornerstone.js
const TOOLS = [
  { id: 'Pan', icon: <PanTool />, label: 'Pan' },
  { id: 'Zoom', icon: <ZoomIn />, label: 'Zoom' },
  { id: 'WindowLevel', icon: <Contrast />, label: 'Window/Level' },
  { id: 'StackScroll', icon: <Layers />, label: 'Scroll' },
  { id: 'Length', icon: null, label: 'Length' },
  { id: 'Angle', icon: null, label: 'Angle' },
];

const CONTOUR_TOOLS = [
  { id: 'RectangleScissors', icon: <ContentCut />, label: 'Rectangle' },
  { id: 'CircleScissors', icon: <Circle />, label: 'Circle' },
  { id: 'Brush', icon: <Brush />, label: 'Brush' },
  { id: 'Eraser', icon: <Clear />, label: 'Eraser' },
];

export default function Toolbar({ activeTool, onToolChange, onAutoSegment }) {
  const [contourMode, setContourMode] = useState(false);

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        p: 1,
        background: 'rgba(13,31,51,0.95)',
        borderBottom: '1px solid rgba(88,196,220,0.12)',
      }}
    >
      <Typography variant="caption" sx={{ color: 'text.secondary', mr: 1, fontFamily: 'mono' }}>
        TPS
      </Typography>

      <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

      <ButtonGroup size="small" variant="outlined">
        {TOOLS.map(tool => (
          <Tooltip key={tool.id} title={tool.label}>
            <Button
              variant={activeTool === tool.id ? 'contained' : 'outlined'}
              onClick={() => { onToolChange(tool.id); setContourMode(false); }}
              sx={{ minWidth: 36, px: 1 }}
            >
              {tool.icon}
            </Button>
          </Tooltip>
        ))}
      </ButtonGroup>

      <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

      <ButtonGroup size="small" variant={contourMode ? 'contained' : 'outlined'}>
        {CONTOUR_TOOLS.map(tool => (
          <Tooltip key={tool.id} title={tool.label}>
            <Button
              variant={activeTool === tool.id ? 'contained' : 'outlined'}
              onClick={() => { onToolChange(tool.id); setContourMode(true); }}
              sx={{ minWidth: 36, px: 1 }}
            >
              {tool.icon}
            </Button>
          </Tooltip>
        ))}
      </ButtonGroup>

      <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

      <Tooltip title="Auto-segment with AI">
        <Button
          size="small"
          variant="outlined"
          onClick={onAutoSegment}
          sx={{ color: 'secondary.main', borderColor: 'secondary.main' }}
        >
          AI Auto-Segment
        </Button>
      </Tooltip>

      <Box sx={{ flex: 1 }} />

      <Typography variant="caption" sx={{ color: 'text.secondary', fontFamily: 'mono' }}>
        {activeTool.toUpperCase()}
      </Typography>
    </Box>
  );
}
