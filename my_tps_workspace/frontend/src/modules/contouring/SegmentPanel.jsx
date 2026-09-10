import { useState } from 'react';
import {
  Box, Typography, Checkbox, IconButton, Button, TextField, Tooltip,
  Menu, MenuItem, Divider, Chip,
} from '@mui/material';
import { Add, Delete, Undo, Redo, Save, Layers, Lock, LockOpen, MenuBook } from '@mui/icons-material';
import { STRUCTURE_DICTIONARY, ROI_TYPES, inferTypeFromName } from './structureDictionary.js';

const SEGMENT_PALETTE = ['#ff5c5c', '#ff9f43', '#f6c177', '#9ae66e', '#5cc8ff', '#c792ea'];

/**
 * SegmentPanel - segment list with dictionary picker, InterpretedType chip
 * and approve/delete actions.
 *
 * @param {Object} props
 * @param {Array<{id:number,name:string,color:string,visible:boolean,approved?:boolean,interpretedType?:string}>} props.segments
 * @param {number|null} props.activeSegmentId
 * @param {Function} props.onAddSegment - (name, color) => void
 * @param {Function} props.onAddFromDictionary - (entryName) => Promise|void
 * @param {Function} props.onUpdateSegment - (id, patch) => void
 * @param {Function} props.onDeleteSegment - (id) => void
 * @param {Function} props.onSelectSegment - (id) => void
 * @param {Function} props.onUndo
 * @param {Function} props.onRedo
 * @param {boolean} props.canUndo
 * @param {boolean} props.canRedo
 * @param {Function} props.onSave
 * @param {boolean} props.saving
 * @param {boolean} props.dirty
 */
export default function SegmentPanel({
  segments,
  activeSegmentId,
  onAddSegment,
  onAddFromDictionary,
  onUpdateSegment,
  onDeleteSegment,
  onSelectSegment,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onSave,
  saving,
  dirty,
}) {
  const [dictAnchor, setDictAnchor] = useState(null);
  const [dictFilter, setDictFilter] = useState('');

  const addSegment = () => {
    const used = new Set(segments.map(s => s.color));
    const color = SEGMENT_PALETTE.find(c => !used.has(c)) ?? SEGMENT_PALETTE[segments.length % SEGMENT_PALETTE.length];
    onAddSegment(`Segment ${segments.length + 1}`, color);
  };

  const filteredDict = STRUCTURE_DICTIONARY.filter(e =>
    !dictFilter || e.name.toLowerCase().includes(dictFilter.toLowerCase()) || e.group.toLowerCase().includes(dictFilter.toLowerCase())
  );

  // group dictionary by category for a readable menu
  const groups = [];
  for (const e of filteredDict) {
    let g = groups.find(x => x.group === e.group);
    if (!g) { g = { group: e.group, items: [] }; groups.push(g); }
    g.items.push(e);
  }

  return (
    <Box sx={{ width: '100%', overflow: 'auto' }}>
      <Typography
        variant="caption"
        sx={{ px: 1, py: 0.5, display: 'block', color: 'text.secondary', fontFamily: 'mono',
              borderBottom: '1px solid rgba(88,196,220,0.12)' }}
      >
        SEGMENTS ({segments.length})
      </Typography>

      {/* history + save actions */}
      <Box sx={{ px: 1, py: 0.75, display: 'flex', gap: 0.5 }}>
        <Tooltip title="Undo (Ctrl+Z)">
          <span>
            <IconButton size="small" onClick={onUndo} disabled={!canUndo} sx={{ color: 'primary.main' }}>
              <Undo fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title="Redo (Ctrl+Y)">
          <span>
            <IconButton size="small" onClick={onRedo} disabled={!canRedo} sx={{ color: 'primary.main' }}>
              <Redo fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
        <Box sx={{ flex: 1 }} />
        <Tooltip title={dirty ? 'Save contours' : 'No changes'}>
          <span>
            <Button
              size="small"
              variant={dirty ? 'contained' : 'outlined'}
              startIcon={<Save />}
              disabled={saving || !dirty}
              onClick={onSave}
              sx={{ fontSize: '0.65rem', py: 0.25 }}
            >
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </span>
        </Tooltip>
      </Box>

      <Typography variant="caption" sx={{ display: 'block', fontSize: '0.6rem', color: 'text.disabled', px: 1, mb: 0.5 }}>
        Click a segment to make it active, then paint on the CT slice.
      </Typography>

      {/* segment list */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25, px: 0.5 }}>
        {segments.length === 0 && (
          <Typography variant="caption" sx={{ px: 1, color: 'text.disabled', fontSize: '0.7rem' }}>
            No segments yet — add one or pick from the structure dictionary.
          </Typography>
        )}
        {segments.map(seg => (
          <Box
            key={seg.id}
            onClick={() => !seg.approved && onSelectSegment(seg.id)}
            sx={{
              display: 'flex',
              flexDirection: 'column',
              gap: 0.25,
              px: 0.75,
              py: 0.35,
              borderRadius: 0.5,
              cursor: seg.approved ? 'default' : 'pointer',
              border: '1px solid',
              borderColor: seg.id === activeSegmentId ? 'rgba(88,196,220,0.6)' : 'transparent',
              bgcolor: seg.id === activeSegmentId ? 'rgba(88,196,220,0.08)' : 'transparent',
              opacity: seg.approved ? 0.75 : 1,
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Checkbox
                checked={seg.visible}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => onUpdateSegment(seg.id, { visible: e.target.checked })}
                size="small"
                sx={{ p: 0.25 }}
                inputProps={{ 'aria-label': `segment-visible-${seg.name}` }}
              />
              <Box sx={{ width: 12, height: 12, borderRadius: '2px', bgcolor: seg.color, flexShrink: 0 }} />
              <TextField
                value={seg.name}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => onUpdateSegment(seg.id, { name: e.target.value })}
                disabled={seg.approved}
                size="small"
                fullWidth
                inputProps={{ 'aria-label': `segment-name-${seg.name}`, style: { fontSize: '0.7rem', padding: '1px 4px' } }}
                sx={{ '& .MuiOutlinedInput-root': { fontSize: '0.7rem' } }}
              />
              <Tooltip title={seg.approved ? 'Approved — click to unlock' : 'Approve (locks this segment)'}>
                <IconButton
                  size="small"
                  sx={{ p: 0.25 }}
                  onClick={(e) => { e.stopPropagation(); onUpdateSegment(seg.id, { approved: !seg.approved }); }}
                  aria-label={`segment-approve-${seg.name}`}
                >
                  {seg.approved
                    ? <Lock sx={{ fontSize: 13, color: '#f6c177' }} />
                    : <LockOpen sx={{ fontSize: 13, color: 'text.secondary' }} />}
                </IconButton>
              </Tooltip>
              <IconButton
                size="small"
                sx={{ p: 0.25 }}
                disabled={seg.approved}
                onClick={(e) => { e.stopPropagation(); onDeleteSegment(seg.id); }}
                aria-label={`segment-delete-${seg.name}`}
              >
                <Delete sx={{ fontSize: 13, color: 'text.secondary' }} />
              </IconButton>
            </Box>
            {/* InterpretedType selector (drives RTSTRUCT export) */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, pl: 3.5, pb: 0.25 }} onClick={e => e.stopPropagation()}>
              <Chip
                size="small"
                label={seg.interpretedType || inferTypeFromName(seg.name)}
                sx={{ height: 16, fontSize: '0.55rem', fontFamily: 'mono' }}
              />
              <TextField
                size="small"
                select
                value={seg.interpretedType || inferTypeFromName(seg.name)}
                onChange={(e) => onUpdateSegment(seg.id, { interpretedType: e.target.value })}
                disabled={seg.approved}
                aria-label={`segment-type-${seg.name}`}
                sx={{ minWidth: 90, '& .MuiOutlinedInput-root': { fontSize: '0.6rem', height: 22 } }}
                inputProps={{ style: { fontSize: '0.6rem', padding: '2px 6px' } }}
              >
                {ROI_TYPES.map(t => (
                  <MenuItem key={t} value={t} sx={{ fontSize: '0.65rem' }}>{t}</MenuItem>
                ))}
              </TextField>
            </Box>
          </Box>
        ))}
      </Box>

      <Box sx={{ px: 1, pt: 0.5, display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        <Button
          size="small"
          fullWidth
          startIcon={<Add />}
          onClick={addSegment}
          sx={{ fontSize: '0.65rem', color: 'text.secondary', borderColor: 'rgba(88,196,220,0.3)' }}
          variant="outlined"
        >
          Add Segment
        </Button>
        <Button
          size="small"
          fullWidth
          startIcon={<MenuBook />}
          onClick={(e) => setDictAnchor(e.currentTarget)}
          aria-label="open-structure-dictionary"
          sx={{ fontSize: '0.65rem', color: 'text.secondary', borderColor: 'rgba(88,196,220,0.3)' }}
          variant="outlined"
        >
          From Dictionary
        </Button>
      </Box>

      <Menu
        anchorEl={dictAnchor}
        open={Boolean(dictAnchor)}
        onClose={() => setDictAnchor(null)}
        PaperProps={{ sx: { maxHeight: 420, width: 280 } }}
      >
        <Box sx={{ px: 1.5, py: 1 }}>
          <TextField
            size="small"
            fullWidth
            placeholder="Filter structures…"
            value={dictFilter}
            onChange={e => setDictFilter(e.target.value)}
            inputProps={{ style: { fontSize: '0.75rem' }, 'aria-label': 'dict-filter' }}
          />
        </Box>
        {groups.map(g => (
          <Box key={g.group}>
            <Divider />
            <Typography variant="caption" sx={{ display: 'block', px: 1.5, py: 0.5, color: 'text.disabled', fontFamily: 'mono', fontSize: '0.6rem' }}>
              {g.group.toUpperCase()}
            </Typography>
            {g.items.map(entry => (
              <MenuItem
                key={entry.name}
                dense
                onClick={async () => {
                  try {
                    await onAddFromDictionary?.(entry.name);
                  } catch (err) {
                    console.error(err);
                  }
                  setDictAnchor(null);
                  setDictFilter('');
                }}
                aria-label={`dict-${entry.name}`}
              >
                <Box sx={{ width: 10, height: 10, borderRadius: '2px', bgcolor: entry.color, mr: 1, flexShrink: 0 }} />
                <Typography sx={{ fontSize: '0.75rem', flex: 1 }}>{entry.name}</Typography>
                <Typography sx={{ fontSize: '0.6rem', color: 'text.disabled', fontFamily: 'mono' }}>{entry.type}</Typography>
              </MenuItem>
            ))}
          </Box>
        ))}
        {filteredDict.length === 0 && (
          <MenuItem disabled>
            <Typography sx={{ fontSize: '0.7rem', color: 'text.disabled' }}>No matches</Typography>
          </MenuItem>
        )}
      </Menu>

      <Box sx={{ px: 1, pt: 2, display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <Layers sx={{ fontSize: 13, color: 'text.disabled' }} />
        <Typography variant="caption" sx={{ fontSize: '0.6rem', color: 'text.disabled' }}>
          Painted contours are stored per slice and saved as patient-space
          polylines (RTSTRUCT-compatible geometry). Type drives export InterpretedType.
        </Typography>
      </Box>
    </Box>
  );
}
