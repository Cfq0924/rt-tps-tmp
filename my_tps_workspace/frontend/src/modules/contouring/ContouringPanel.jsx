import { useState } from 'react';
import {
  Box, Typography, ButtonGroup, Button, Tooltip, Slider, TextField,
  Divider, MenuItem,
} from '@mui/material';
import {
  Brush, Clear, CropSquare, Circle, Undo, Redo, Save, FormatColorFill,
  AutoFixHigh, OpenInFull, Merge, ContentCut, CropFree,
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

const opBtnSx = {
  fontSize: '0.65rem', color: 'text.secondary',
  borderColor: 'rgba(88,196,220,0.3)', px: 0.75, minWidth: 0, flexShrink: 0,
};

function MicroLabel({ children }) {
  return (
    <Typography variant="caption" sx={{ fontSize: '0.6rem', color: 'text.secondary',
          fontFamily: 'mono', whiteSpace: 'nowrap', flexShrink: 0 }}>
      {children}
    </Typography>
  );
}

function NumField({ width = 52, inputProps: inProps, ...rest }) {
  return (
    <TextField
      size="small"
      {...rest}
      sx={{ width, flexShrink: 0, '& .MuiOutlinedInput-root': { fontSize: '0.7rem' } }}
      inputProps={{ style: { fontSize: '0.7rem', padding: '2px 6px' }, ...inProps }}
    />
  );
}

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
  const activeSeg = c.segments.find(s => s.id === c.activeSegmentId);

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
          <NumField
            select
            label="Crop mode"
            width={120}
            value={c.cropMode}
            onChange={e => c.setCropMode(e.target.value)}
          >
            <MenuItem value="keepInside" sx={{ fontSize: '0.7rem' }}>Keep inside</MenuItem>
            <MenuItem value="keepOutside" sx={{ fontSize: '0.7rem' }}>Keep outside</MenuItem>
          </NumField>
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

        {/* structure ops on the active segment */}
        <Box sx={{ border: '1px solid rgba(88,196,220,0.15)', borderRadius: 1, p: 0.75,
                   bgcolor: 'rgba(18,32,53,0.6)', display: 'flex', flexDirection: 'column', gap: 0.75 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, minWidth: 0 }}>
            <Typography variant="caption" sx={{ fontSize: '0.6rem', color: 'text.secondary', fontFamily: 'mono', flexShrink: 0 }}>
              STRUCTURE OPS
            </Typography>
            {activeSeg && (
              <>
                <Box sx={{ width: 8, height: 8, borderRadius: '2px', bgcolor: activeSeg.color, flexShrink: 0 }} />
                <Typography variant="caption" sx={{ fontSize: '0.6rem', color: 'text.secondary',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {activeSeg.name}
                </Typography>
              </>
            )}
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <MicroLabel>Margin</MicroLabel>
            <NumField id="expand-margin-input" defaultValue={3} inputProps={{ 'aria-label': 'expand-margin-mm' }} />
            <MicroLabel>mm</MicroLabel>
            <Box sx={{ flex: 1 }} />
            <Tooltip title="Expand the active segment by the margin (Eclipse CTV→PTV)">
              <Button size="small" variant="outlined" startIcon={<OpenInFull fontSize="small" />}
                      onClick={() => {
                        const el = document.getElementById('expand-margin-input');
                        const mm = Number(el?.value) || 3;
                        c.expandActive(mm, Math.max(1, Math.round(mm / 3)));
                      }}
                      aria-label="expand-apply" sx={opBtnSx}>
                CTV→PTV
              </Button>
            </Tooltip>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <MicroLabel>Min area</MicroLabel>
            <NumField type="number" value={minAreaMm2} width={48}
                      onChange={e => setMinAreaMm2(Number(e.target.value) || 1)}
                      inputProps={{ min: 0.5, step: 0.5, 'aria-label': 'cleanup-min-area' }} />
            <MicroLabel>mm²</MicroLabel>
            <Box sx={{ flex: 1 }} />
            <Tooltip title="Eclipse Clean-up: remove connected fragments smaller than min area on every painted slice">
              <Button size="small" variant="outlined" startIcon={<ContentCut fontSize="small" />}
                      aria-label="cleanup-apply"
                      onClick={() => {
                        const stats = c.cleanupActive(minAreaMm2);
                        setOpNote(`Clean-up: removed ${stats.removed} voxels, kept ${stats.kept}`);
                      }}
                      sx={opBtnSx}>
                Clean-up
              </Button>
            </Tooltip>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <MicroLabel>Wall</MicroLabel>
            <NumField type="number" value={outerMm} width={44}
                      onChange={e => setOuterMm(Number(e.target.value) || 0)}
                      inputProps={{ min: 0, step: 0.5, 'aria-label': 'wall-outer-mm' }} />
            <MicroLabel>−</MicroLabel>
            <NumField type="number" value={innerMm} width={44}
                      onChange={e => setInnerMm(Number(e.target.value) || 0)}
                      inputProps={{ min: 0, step: 0.5, 'aria-label': 'wall-inner-mm' }} />
            <MicroLabel>mm</MicroLabel>
            <Box sx={{ flex: 1 }} />
            <Tooltip title="Extract Wall: create a ring segment (outer dilate − inner erode) around the active structure">
              <Button size="small" variant="outlined" aria-label="extract-wall"
                      onClick={async () => {
                        try {
                          const id = await c.extractWallFromActive(outerMm, innerMm);
                          setOpNote(id ? `Wall segment created (id ${id})` : 'Extract Wall: no wall generated');
                        } catch (err) {
                          setOpNote(`Extract Wall failed: ${err.message}`);
                        }
                      }}
                      sx={opBtnSx}>
                Extract
              </Button>
            </Tooltip>
          </Box>

          {opNote && (
            <Typography variant="caption" sx={{ fontSize: '0.6rem', color: 'text.disabled', px: 0.25 }}>
              {opNote}
            </Typography>
          )}

          <Divider sx={{ borderColor: 'rgba(88,196,220,0.12)' }} />

          {/* boolean ops: source segment INTO the active segment */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <MicroLabel>Source</MicroLabel>
            <TextField
              size="small" select value={boolSource}
              onChange={e => setBoolSource(e.target.value)}
              sx={{ flex: 1, '& .MuiOutlinedInput-root': { fontSize: '0.7rem' } }}
              inputProps={{ 'aria-label': 'boolean-source', style: { fontSize: '0.7rem', padding: '2px 6px' } }}
            >
              {c.segments.filter(s => s.id !== c.activeSegmentId && !s.approved).map(s => (
                <MenuItem key={s.id} value={s.id} sx={{ fontSize: '0.7rem' }}>{s.name}</MenuItem>
              ))}
            </TextField>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <MicroLabel>Op</MicroLabel>
            <TextField
              size="small" select value={boolOp}
              onChange={e => setBoolOp(e.target.value)}
              sx={{ flex: 1, '& .MuiOutlinedInput-root': { fontSize: '0.7rem' } }}
              inputProps={{ 'aria-label': 'boolean-op', style: { fontSize: '0.7rem', padding: '2px 6px' } }}
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
                  sx={opBtnSx}
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
        />
      </Box>
    </Box>
  );
}
