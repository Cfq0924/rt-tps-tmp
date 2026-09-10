import { useState } from 'react';
import {
  Box, Typography, TextField, Button, IconButton, Tooltip, Chip,
} from '@mui/material';
import { Delete, Add } from '@mui/icons-material';
import MlcLeafEditor, { rectMlcFromJaws } from './MlcLeafEditor.jsx';

/**
 * SubfieldEditor — Eclipse Field-in-Field: list / add / delete subfields of a
 * beam. Each subfield carries weight + optional rectangular MLC opening.
 */
export default function SubfieldEditor({ beam, subfields = [], onChange, onAdd, onDelete, busy = false }) {
  const [name, setName] = useState('Sub 1');
  const [weight, setWeight] = useState('1');
  const [xHalf, setXHalf] = useState(String(Math.round((beam?.jawX1 ?? 50))));
  const [yHalf, setYHalf] = useState(String(Math.round((beam?.jawY1 ?? 50))));
  const [editingId, setEditingId] = useState(null);
  const [draftMlc, setDraftMlc] = useState(null);

  const leafCount = beam?.leafPairCount || 60;

  const handleAdd = async () => {
    if (!name.trim()) return;
    const mlc = rectMlcFromJaws(leafCount, Number(xHalf) || 50, Number(yHalf) || 50);
    await onAdd?.({ name: name.trim(), weight: Number(weight) || 1, mlc });
    setName(`Sub ${subfields.length + 2}`);
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
      <Typography variant="caption" sx={{ fontSize: '0.6rem', color: 'text.secondary', fontFamily: 'mono' }}>
        FIELD-IN-FIELD SUBFIELDS
      </Typography>
      {(subfields ?? []).length === 0 && (
        <Typography variant="caption" sx={{ fontSize: '0.6rem', color: 'text.disabled' }}>
          No subfields — add a shaped segment below.
        </Typography>
      )}
      {(subfields ?? []).map(sf => (
        <Box key={sf.id} sx={{ border: '1px solid rgba(88,196,220,0.12)', borderRadius: 0.5, px: 0.75, py: 0.4 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Typography sx={{ flex: 1, fontSize: '0.65rem', fontFamily: 'mono' }}>{sf.name}</Typography>
            <Chip size="small" label={`w ${sf.weight ?? 1}`} sx={{ height: 16, fontSize: '0.55rem' }} />
            <Tooltip title="Edit MLC opening">
              <Button size="small" sx={{ fontSize: '0.55rem', minWidth: 0 }}
                      onClick={() => {
                        setEditingId(editingId === sf.id ? null : sf.id);
                        setDraftMlc(sf.mlc ?? rectMlcFromJaws(leafCount, 50, 50));
                      }}>
                MLC
              </Button>
            </Tooltip>
            <IconButton size="small" sx={{ p: 0.2 }} disabled={busy}
                        aria-label={`subfield-delete-${sf.id}`}
                        onClick={() => onDelete?.(sf.id)}>
              <Delete sx={{ fontSize: 12, color: 'text.secondary' }} />
            </IconButton>
          </Box>
          {editingId === sf.id && draftMlc?.leafPairs && (
            <Box sx={{ pt: 0.5 }}>
              <MlcLeafEditor
                leafPairs={draftMlc.leafPairs}
                label={sf.name}
                onChange={(leafPairs) => setDraftMlc({ ...draftMlc, leafPairs })}
              />
              <Button size="small" variant="outlined" sx={{ mt: 0.5, fontSize: '0.55rem' }}
                      onClick={() => onChange?.(sf.id, { mlc: draftMlc })}>
                Save MLC
              </Button>
            </Box>
          )}
        </Box>
      ))}

      <Box sx={{ display: 'flex', gap: 0.4, flexWrap: 'wrap', alignItems: 'center' }}>
        <TextField size="small" label="Name" value={name} onChange={e => setName(e.target.value)}
                   sx={{ width: 80 }} inputProps={{ style: { fontSize: '0.65rem' } }} />
        <TextField size="small" label="Weight" value={weight} onChange={e => setWeight(e.target.value)}
                   sx={{ width: 64 }} inputProps={{ style: { fontSize: '0.65rem' } }} />
        <TextField size="small" label="X½ mm" value={xHalf} onChange={e => setXHalf(e.target.value)}
                   sx={{ width: 64 }} inputProps={{ style: { fontSize: '0.65rem' } }} />
        <TextField size="small" label="Y½ mm" value={yHalf} onChange={e => setYHalf(e.target.value)}
                   sx={{ width: 64 }} inputProps={{ style: { fontSize: '0.65rem' } }} />
        <Tooltip title="Add FiF subfield with a rectangular MLC opening from jaws">
          <Button size="small" startIcon={<Add fontSize="small" />} variant="outlined"
                  onClick={handleAdd} disabled={busy || !name.trim()}
                  sx={{ fontSize: '0.6rem' }}>
            Add
          </Button>
        </Tooltip>
      </Box>
    </Box>
  );
}
