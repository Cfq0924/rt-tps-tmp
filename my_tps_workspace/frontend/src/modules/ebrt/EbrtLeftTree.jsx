import { Box, Typography, Checkbox, Tooltip } from '@mui/material';
import { AccountTree } from '@mui/icons-material';

/**
 * EbrtLeftTree - Focus-window style tree (Eclipse EBPT): structures with
 * visibility eyes, reference points, dose (isodose) levels and the plan's
 * beam hierarchy. Drives the existing overlay states — no new backend.
 *
 * @param {Object} props
 * @param {Array} props.structures - roiSequence [{roiNumber, roiName, displayColor}]
 * @param {Object} props.structureVisibility - { [roiNumber]: boolean }
 * @param {Function} props.onToggleStructure - (roiNumber) => void
 * @param {Array} props.isodoseLevels - [{id, pct, color, visible}]
 * @param {Function} props.onIsodoseChange - (levels) => void
 * @param {Array|null} props.beams - selected plan beams
 * @param {number|null} props.selectedBeamNumber
 * @param {Function} props.onSelectBeam - (beamNumber) => void
 * @param {Array|null} props.referencePoints - [{name, x, y, z}]
 * @param {Array} props.ctFiles - CT files (slice order) for z→index mapping
 * @param {Function} props.onJumpToSlice - (sliceIdx) => void
 */
export default function EbrtLeftTree({
  structures = [],
  structureVisibility = {},
  onToggleStructure,
  isodoseLevels = [],
  onIsodoseChange,
  beams = null,
  selectedBeamNumber = null,
  onSelectBeam,
  referencePoints = null,
  ctFiles = [],
  onJumpToSlice,
}) {
  const jumpToPoint = (pt) => {
    if (!pt || !ctFiles.length) return;
    let best = 0, bestDist = Infinity;
    ctFiles.forEach((f, i) => {
      const d = Math.abs((f.image_position_z ?? 0) - pt.z);
      if (d < bestDist) { bestDist = d; best = i; }
    });
    onJumpToSlice?.(best);
  };

  const toggleLevel = (id) => {
    onIsodoseChange?.(isodoseLevels.map(l => (l.id === id ? { ...l, visible: !l.visible } : l)));
  };

  const section = (title) => (
    <Typography variant="caption" sx={{ display: 'flex', alignItems: 'center', gap: 0.5,
          px: 0.75, pt: 0.75, pb: 0.25, color: 'text.secondary', fontFamily: 'mono', fontSize: '0.58rem' }}>
      <AccountTree sx={{ fontSize: 11 }} /> {title}
    </Typography>
  );

  const eye = (checked, onChange, label) => (
    <Checkbox
      checked={!!checked}
      onChange={onChange}
      onClick={(e) => e.stopPropagation()}
      size="small"
      sx={{ p: 0.25 }}
      inputProps={{ 'aria-label': label }}
    />
  );

  return (
    <Box sx={{ width: '100%', height: '100%', overflow: 'auto', background: 'background.paper' }}>
      {/* structures */}
      {section(`STRUCTURES (${structures.length})`)}
      <Box sx={{ display: 'flex', flexDirection: 'column' }}>
        {structures.map(s => (
          <Box key={s.roiNumber} sx={{ display: 'flex', alignItems: 'center', gap: 0.5, px: 0.75 }}>
            {eye(structureVisibility[s.roiNumber] ?? true,
                 () => onToggleStructure?.(s.roiNumber),
                 `tree-structure-${s.roiName}`)}
            <Box sx={{ width: 9, height: 9, borderRadius: '2px', flexShrink: 0,
                       bgcolor: `rgb(${s.displayColor?.r ?? 88},${s.displayColor?.g ?? 196},${s.displayColor?.b ?? 220})` }} />
            <Typography variant="caption" sx={{ fontSize: '0.6rem', flex: 1, noWrap: true }}>
              {s.roiName}
            </Typography>
          </Box>
        ))}
      </Box>

      {/* reference points */}
      {section(`REFERENCE POINTS (${referencePoints?.length ?? 0})`)}
      {(referencePoints ?? []).map((pt, i) => (
        <Tooltip key={i} title={`Jump to (${pt.x?.toFixed(1)}, ${pt.y?.toFixed(1)}, ${pt.z?.toFixed(1)}) mm`}>
          <Box onClick={() => jumpToPoint(pt)}
               sx={{ display: 'flex', alignItems: 'center', gap: 0.5, px: 1.5, py: 0.1, cursor: 'pointer' }}>
            <Typography variant="caption" sx={{ fontSize: '0.6rem', color: 'text.secondary' }}>
              ◈ {pt.name}
            </Typography>
          </Box>
        </Tooltip>
      ))}
      {!referencePoints?.length && (
        <Typography variant="caption" sx={{ px: 1.5, fontSize: '0.55rem', color: 'text.disabled' }}>
          none
        </Typography>
      )}

      {/* dose / isodose levels */}
      {section(`DOSE LEVELS (${isodoseLevels.length})`)}
      <Box sx={{ display: 'flex', flexDirection: 'column' }}>
        {isodoseLevels.map(l => (
          <Box key={l.id} sx={{ display: 'flex', alignItems: 'center', gap: 0.5, px: 0.75 }}>
            {eye(l.visible, () => toggleLevel(l.id), `tree-isodose-${l.pct}`)}
            <Box sx={{ width: 9, height: 9, borderRadius: '2px', flexShrink: 0, bgcolor: l.color }} />
            <Typography variant="caption" sx={{ fontSize: '0.6rem', fontFamily: 'mono' }}>
              {l.pct}%
            </Typography>
          </Box>
        ))}
      </Box>

      {/* fields / beams */}
      {section(`FIELDS${beams?.length ? ` (${beams.length} beams)` : ''}`)}
      <Typography variant="caption" sx={{ px: 1.5, fontSize: '0.58rem', color: 'text.secondary', display: 'block' }}>
        ▸ Isocenter Group 1
      </Typography>
      {(beams ?? []).map(b => (
        <Box
          key={b.beamNumber}
          onClick={() => onSelectBeam?.(b.beamNumber)}
          sx={{ display: 'flex', alignItems: 'center', gap: 0.5, px: 2.5, py: 0.1, cursor: 'pointer',
                bgcolor: b.beamNumber === selectedBeamNumber ? 'rgba(88,196,220,0.12)' : 'transparent' }}
        >
          <Typography variant="caption" sx={{ fontSize: '0.6rem', fontFamily: 'mono',
                color: b.beamNumber === selectedBeamNumber ? 'primary.main' : 'text.secondary' }}>
            {b.name ?? `Field ${b.beamNumber}`} · {b.beamType} {b.gantryAngle}°
          </Typography>
        </Box>
      ))}
      {!beams?.length && (
        <Typography variant="caption" sx={{ px: 2.5, fontSize: '0.55rem', color: 'text.disabled' }}>
          no plan selected
        </Typography>
      )}
    </Box>
  );
}
