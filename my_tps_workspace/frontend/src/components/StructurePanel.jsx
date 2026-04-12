import {
  Box,
  Typography,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  Checkbox,
  ListItemText,
  Divider,
  Button,
  IconButton,
  Tooltip,
} from '@mui/material';
import { CheckBoxOutlineBlank, CheckBox } from '@mui/icons-material';

/**
 * StructurePanel - Displays ROI list with visibility toggles
 *
 * @param {Object} props
 * @param {Array} props.structures - Array of structure objects
 * @param {Function} props.onToggle - Callback when structure visibility is toggled
 * @param {Function} props.onSelect - Callback when structure is selected
 * @param {number|null} props.selectedStructureId - Currently selected ROI number
 * @param {Function} props.onToggleAll - Callback to toggle all structures visibility
 */
export default function StructurePanel({
  structures,
  onToggle,
  onSelect,
  selectedStructureId,
  onToggleAll,
}) {
  if (!structures || structures.length === 0) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography variant="caption" color="text.secondary">
          No structures loaded
        </Typography>
      </Box>
    );
  }

  const allVisible = structures.every(s => s.visible);
  const noneVisible = structures.every(s => !s.visible);

  return (
    <Box sx={{ width: '100%', overflow: 'auto' }}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          px: 1,
          py: 0.5,
          borderBottom: '1px solid rgba(88,196,220,0.12)',
        }}
      >
        <Typography
          variant="caption"
          sx={{
            color: 'text.secondary',
            fontFamily: 'mono',
          }}
        >
          STRUCTURES ({structures.length})
        </Typography>
        <Tooltip title={allVisible ? 'Hide All' : 'Show All'}>
          <IconButton
            size="small"
            onClick={onToggleAll}
            sx={{ color: 'text.secondary', p: 0.5 }}
          >
            {allVisible ? <CheckBox fontSize="small" /> : <CheckBoxOutlineBlank fontSize="small" />}
          </IconButton>
        </Tooltip>
      </Box>
      <List dense sx={{ py: 0 }}>
        {structures.map((structure) => (
          <ListItem
            key={structure.roiNumber}
            disablePadding
            secondaryAction={
              <Checkbox
                edge="end"
                checked={structure.visible}
                onChange={() => onToggle(structure.roiNumber)}
                size="small"
                sx={{
                  color: 'rgba(88,196,220,0.3)',
                  '&.Mui-checked': {
                    color: structure.visible
                      ? `rgb(${structure.displayColor?.r || 255}, ${structure.displayColor?.g || 255}, ${structure.displayColor?.b || 255})`
                      : 'primary.main',
                  },
                }}
              />
            }
          >
            <ListItemButton
              selected={selectedStructureId === structure.roiNumber}
              onClick={() => onSelect(structure.roiNumber)}
              sx={{
                py: 0.5,
                pr: 4,
                '&.Mui-selected': {
                  backgroundColor: 'rgba(88,196,220,0.08)',
                  borderLeft: `3px solid rgb(${structure.displayColor?.r || 255}, ${structure.displayColor?.g || 255}, ${structure.displayColor?.b || 255})`,
                },
              }}
            >
              <ListItemIcon sx={{ minWidth: 28 }}>
                <Box
                  sx={{
                    width: 14,
                    height: 14,
                    borderRadius: '2px',
                    backgroundColor: `rgb(${structure.displayColor?.r || 255}, ${structure.displayColor?.g || 255}, ${structure.displayColor?.b || 255})`,
                  }}
                />
              </ListItemIcon>
              <ListItemText
                primary={
                  <Typography
                    variant="caption"
                    sx={{
                      fontFamily: 'mono',
                      fontSize: '0.7rem',
                      color:
                        selectedStructureId === structure.roiNumber
                          ? 'text.primary'
                          : 'text.secondary',
                    }}
                  >
                    {structure.roiName}
                  </Typography>
                }
                secondary={
                  <Typography
                    variant="caption"
                    sx={{ fontFamily: 'mono', fontSize: '0.65rem', color: 'text.disabled' }}
                  >
                    #{structure.roiNumber}
                  </Typography>
                }
              />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
      <Divider sx={{ mt: 1 }} />
    </Box>
  );
}
