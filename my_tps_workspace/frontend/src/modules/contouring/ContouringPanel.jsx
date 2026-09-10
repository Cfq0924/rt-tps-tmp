import { useState } from 'react';
import {
  Box, Typography, ButtonGroup, Button, Tooltip, Slider, TextField,
  Divider, MenuItem,
} from '@mui/material';
import {
  Brush, Clear, CropSquare, Circle, Undo, Redo, Save, FormatColorFill,
  AutoFixHigh, OpenInFull, Merge, ContentCut, CropFree, FilterCenterFocus,
} from '@mui/icons-material';
import SegmentPanel from './SegmentPanel.jsx';

const TOOLS = [
  { id: 'brush', icon: <Brush fontSize="small" />, label: 'Brush' },
  { id: 'eraser', icon: <Clear fontSize="small" />, label: 'Eraser' },
  { id: 'floodfill', icon: <FormatColorFill fontSize="small" />, label: 'Flood fill (HU)' },
  { id: 'rect', icon: <CropSquare fontSize="small" />, label: 'Rectangle fill' },
  { id: 'circle', icon: <Circle fontSize="small" />, label: 'Ellipse fill' },
  { id: 'crop', icon: <CropFree fontSize="small" />, label: 'Crop (drag box)' },
];

/**
 * ContouringPanel - right panel of the contouring module: paint tools,
 * brush size, structure ops (expand / body / boolean / cleanup / wall)
 * and the segment list.
 *
 * @param {Object} props - the useContouring() hook result plus slice helpers
 */
export default function ContouringPanel({ contouring, sliceIdx, getCtPixels }) {
  const c = contouring;
  const [boolSource, setBoolSource] = useState('');
  const [boolOp, setBoolOp] = useState('subtract');
  const [minAreaMm2, setMinAreaMm2] = useState(4);
  const [outerMm, setOuterMm] = useState(2);
  const [innerMm, setInnerMm] = useState(2);
  const [opNote, setOpNote] = useState('');

  const toolButton = (t) => (
    <Tooltip key={t.id} title={t.label}>
      <Button
        aria-label={`tool-${t.id}`}
        variant={c.tool === t.id ? 'contained' : 'outlined'}
        onClick={() => c.setTool(t.id)}
        sx={{ minWidth: 36, px: 1 }}
      >
        {t.icon}
      </Button>
    </Tooltip>
  );

  return (
    <Box sx={{ width: '100%', display: 'flex', flexDirection: 'column', overflow: 'auto' }}>
      <Typography
        variant="caption"
        sx={{ px: 1, py: 0.5, color: 'text.secondary', fontFamily: 'mono',
              borderBottom: '1px solid rgba(88,196,220,0.12)' }}
      >
        CONTOURING
      </Typography>

      {/* paint tools */}
      <Box sx={{ px: 1, py: 1, display: 'flex', flexDirection: 'column', gap: 1,
                 borderBottom: '1px solid rgba(88,196,220,0.12)' }}>
        <ButtonGroup size="small">
          {TOOLS.map(toolButton)}
        </ButtonGroup>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="caption" sx={{ fontSize: '0.65rem', color: 'text.secondary', whiteSpace: 'nowrap' }}>
            Brush: {c.brushSizeMm}mm
          </Typography>
          <Slider
            size="small"
            value={c.brushSizeMm}
            min={1}
            max={30}
            step={1}
            onChange={(_, v) => c.setBrushSizeMm(v)}
            sx={{ color: '#58c4dc' }}
          />
        </Box>
        {c.tool === 'crop' && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <TextField
              size="small" select label="Crop mode" value={c.cropMode}
              onChange={e => c.setCropMode(e.target.value)}
              sx={{ flex: 1 }}
              inputProps={{ style: { fontSize: '0.65rem' } }}
            >
              <MenuItem value="keepInside" sx={{ fontSize: '0.7rem' }}>Keep inside</MenuItem>
              <MenuItem value="keepOutside" sx={{ fontSize: '0.7rem' }}>Keep outside</MenuItem>
            </TextField>
          </Box>
        )}
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <Button size="small" startIcon={<Undo fontSize="small" />} disabled={!c.canUndo}
                  onClick={c.undo} sx={{ fontSize: '0.65rem' }}>Undo</Button>
          <Button size="small" startIcon={<Redo fontSize="small" />} disabled={!c.canRedo}
                  onClick={c.redo} sx={{ fontSize: '0.65rem' }}>Redo</Button>
          <Button size="small" startIcon={<Save fontSize="small" />} disabled={c.saving || !c.dirty}
                  onClick={c.save} variant={c.dirty ? 'contained' : 'outlined'}
                  sx={{ fontSize: '0.65rem' }}>{c.saving ? '…' : 'Save'}</Button>
        </Box>

        <Divider sx={{ my: 0.5 }} />

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
          <Typography variant="caption" sx={{ fontSize: '0.6rem', color: 'text.secondary', fontFamily: 'mono' }}>
            STRUCTURE OPS (active segment)
          </Typography>
          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
            <TextField size="small" label="Margin (mm)" defaultValue={3}
                       id="expand-margin-input" sx={{ width: 90 }}
                       inputProps={{ style: { fontSize: '0.65rem' } }} />
            <Button size="small" variant="outlined" startIcon={<OpenInFull fontSize="small" />}
                    onClick={() => {
                      const el = document.getElementById('expand-margin-input');
                      const mm = Number(el?.value) || 3;
                      c.expandActive(mm, Math.max(1, Math.round(mm / 3)));
                    }}
                    sx={{ fontSize: '0.62rem', color: 'text.secondary', borderColor: 'rgba(88,196,220,0.3)' }}>
              CTV→PTV
            </Button>
            <Tooltip title="Auto body contour on the displayed slice">
              <Button size="small" variant="outlined" startIcon={<AutoFixHigh fontSize="small" />}
                      onClick={() => c.autoBodyOnSlice(sliceIdx, getCtPixels?.() ?? null)}
                      sx={{ fontSize: '0.62rem', color: 'text.secondary', borderColor: 'rgba(88,196,220,0.3)' }}>
                Body
              </Button>
            </Tooltip>
          </Box>

          {/* Clean-up: remove small fragments */}
          <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
            <TextField
              size="small" label="Min area (mm²)" type="number" value={minAreaMm2}
              onChange={e => setMinAreaMm2(Number(e.target.value) || 1)}
              sx={{ width: 100 }}
              inputProps={{ min: 0.5, step: 0.5, style: { fontSize: '0.65rem' } }}
            />
            <Tooltip title="Eclipse Clean-up: remove connected fragments smaller than min area on every painted slice">
              <Button
                size="small" variant="outlined" startIcon={<ContentCut fontSize="small" />}
                aria-label="cleanup-apply"
                onClick={() => {
                  const stats = c.cleanupActive(minAreaMm2);
                  setOpNote(`Clean-up: removed ${stats.removed} voxels, kept ${stats.kept}`);
                }}
                sx={{ fontSize: '0.62rem', color: 'text.secondary', borderColor: 'rgba(88,196,220,0.3)' }}
              >
                Clean-up
              </Button>
            </Tooltip>
          </Box>

          {/* Extract Wall */}
          <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center', flexWrap: 'wrap' }}>
            <TextField
              size="small" label="Outer (mm)" type="number" value={outerMm}
              onChange={e => setOuterMm(Number(e.target.value) || 0)}
              sx={{ width: 88 }}
              inputProps={{ min: 0, step: 0.5, style: { fontSize: '0.65rem' } }}
            />
            <TextField
              size="small" label="Inner (mm)" type="number" value={innerMm}
              onChange={e => setInnerMm(Number(e.target.value) || 0)}
              sx={{ width: 88 }}
              inputProps={{ min: 0, step: 0.5, style: { fontSize: '0.65rem' } }}
            />
            <Tooltip title="Extract Wall: create a ring segment (outer dilate − inner erode) around the active structure">
              <Button
                size="small" variant="outlined" startIcon={<FilterCenterFocus fontSize="small" />}
                aria-label="extract-wall"
                onClick={async () => {
                  try {
                    const id = await c.extractWallFromActive(outerMm, innerMm);
                    setOpNote(id ? `Wall segment created (id ${id})` : 'Extract Wall: no wall generated');
                  } catch (err) {
                    setOpNote(`Extract Wall failed: ${err.message}`);
                  }
                }}
                sx={{ fontSize: '0.62rem', color: 'text.secondary', borderColor: 'rgba(88,196,220,0.3)' }}
              >
                Extract Wall
              </Button>
            </Tooltip>
          </Box>

          {opNote && (
            <Typography variant="caption" sx={{ fontSize: '0.6rem', color: 'text.disabled', px: 0.25 }}>
              {opNote}
            </Typography>
          )}

          {/* boolean ops: source segment INTO the active segment */}
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            <TextField
              size="small" select label="Source" value={boolSource}
              onChange={e => setBoolSource(e.target.value)}
              sx={{ flex: 1.2 }}
              inputProps={{ style: { fontSize: '0.65rem' } }}
            >
              {c.segments.filter(s => s.id !== c.activeSegmentId && !s.approved).map(s => (
                <MenuItem key={s.id} value={s.id} sx={{ fontSize: '0.7rem' }}>{s.name}</MenuItem>
              ))}
            </TextField>
            <TextField
              size="small" select label="Op" value={boolOp}
              onChange={e => setBoolOp(e.target.value)}
              sx={{ flex: 1 }}
              inputProps={{ style: { fontSize: '0.65rem' } }}
            >
              <MenuItem value="union" sx={{ fontSize: '0.7rem' }}>Union</MenuItem>
              <MenuItem value="subtract" sx={{ fontSize: '0.7rem' }}>Subtract</MenuItem>
              <MenuItem value="intersect" sx={{ fontSize: '0.7rem' }}>Intersect</MenuItem>
            </TextField>
            <Tooltip title="Apply the boolean op to the active segment (undoable in one step)">
              <span>
                <Button
                  size="small" variant="outlined" aria-label="boolean-apply"
                  startIcon={<Merge fontSize="small" />}
                  disabled={boolSource === ''}
                  onClick={() => { c.applyBoolean(Number(boolSource), boolOp); setBoolSource(''); }}
                  sx={{ fontSize: '0.62rem', color: 'text.secondary', borderColor: 'rgba(88,196,220,0.3)' }}
                >
                  Apply
                </Button>
              </span>
            </Tooltip>
          </Box>
        </Box>
      </Box>

      {/* segments list (scrollable) */}
      <Box sx={{ flex: 1, overflow: 'auto' }}>
        <SegmentPanel
          segments={c.segments}
          activeSegmentId={c.activeSegmentId}
          onAddSegment={c.addSegment}
          onAddFromDictionary={c.addSegmentFromDictionary}
          onUpdateSegment={c.updateSegment}
          onDeleteSegment={c.deleteSegment}
          onSelectSegment={c.setActiveSegmentId}
          onUndo={c.undo}
          onRedo={c.redo}
          canUndo={c.canUndo}
          canRedo={c.canRedo}
          onSave={c.save}
          saving={c.saving}
          dirty={c.dirty}
        />
      </Box>
    </Box>
  );
}
