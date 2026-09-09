import { Box, Typography, Table, TableBody, TableCell, TableHead, TableRow,
  Button } from '@mui/material';
import DVHChart from './DVHChart.jsx';

/**
 * EvaluationPane - the main-area DVH pane (large chart + full statistics).
 * Consumes the same useDvh state as the sidebar controls.
 *
 * @param {Object} props
 * @param {Object} props.dvh - useDvh() hook result
 * @param {boolean} props.doseReady - dose grid available
 * @param {number|null} props.prescriptionCgy
 */
export default function EvaluationPane({ dvh, doseReady = false, prescriptionCgy = null }) {
  const { allSources, selected, select, results, binWidth } = dvh;

  const selectAll = () => select(allSources.map(s => s.key));
  const selectNone = () => select([]);

  return (
    <Box sx={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
               overflow: 'auto', p: 1.5, boxSizing: 'border-box' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
        <Typography variant="subtitle2" sx={{ fontFamily: 'mono', letterSpacing: 0.5 }}>
          DVH — DOSE VOLUME HISTOGRAM
        </Typography>
        {prescriptionCgy != null && (
          <Typography variant="caption" sx={{ fontSize: '0.62rem', color: 'text.secondary', fontFamily: 'mono' }}>
            · Rx {prescriptionCgy} cGy
          </Typography>
        )}
        <Box sx={{ flex: 1 }} />
        <Button size="small" variant="text" onClick={selectAll}
                disabled={allSources.length === 0}
                sx={{ fontSize: '0.6rem', minWidth: 0, color: 'text.secondary' }}>
          Select all
        </Button>
        <Button size="small" variant="text" onClick={selectNone}
                disabled={selected.length === 0}
                sx={{ fontSize: '0.6rem', minWidth: 0, color: 'text.secondary' }}>
          None
        </Button>
      </Box>

      {doseReady ? (
        <>
          <Box sx={{ height: '46%', minHeight: 280 }}>
            <DVHChart results={results} prescriptionCgy={prescriptionCgy} />
          </Box>

          <Typography variant="caption" sx={{ display: 'block', fontSize: '0.58rem', color: 'text.disabled', mt: 0.5, mb: 0.75 }}>
            Cumulative DVH — hover the chart to read each structure's volume at a dose. Bin {binWidth} cGy.
          </Typography>

          <Table size="small" sx={{ '& .MuiTableCell-root': { py: 0.4, px: 0.75, fontSize: '0.68rem', fontFamily: 'mono', borderColor: 'rgba(88,196,220,0.08)' } }}>
            <TableHead>
              <TableRow>
                <TableCell>Structure</TableCell>
                <TableCell align="right">Mean</TableCell>
                <TableCell align="right">Max</TableCell>
                <TableCell align="right">D95</TableCell>
                <TableCell align="right">D50</TableCell>
                <TableCell align="right">D2</TableCell>
                <TableCell align="right">Vol cm³</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {results.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} sx={{ color: 'text.disabled' }}>
                    Tick structures in the sidebar to compute their DVH.
                  </TableCell>
                </TableRow>
              )}
              {results.map(r => (
                <TableRow key={r.key} hover>
                  <TableCell>
                    <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75 }}>
                      <Box sx={{ width: 10, height: 10, borderRadius: '2px', bgcolor: r.color, flexShrink: 0 }} />
                      {r.name}
                    </Box>
                  </TableCell>
                  <TableCell align="right">{r.stats.mean.toFixed(0)}</TableCell>
                  <TableCell align="right">{r.stats.max.toFixed(0)}</TableCell>
                  <TableCell align="right">{r.stats.dX(0.95).toFixed(0)}</TableCell>
                  <TableCell align="right">{r.stats.dX(0.5).toFixed(0)}</TableCell>
                  <TableCell align="right">{r.stats.dX(0.02).toFixed(0)}</TableCell>
                  <TableCell align="right">{r.stats.volumeCm3.toFixed(1)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {results.length > 0 && (
            <Typography variant="caption" sx={{ display: 'block', fontSize: '0.55rem', color: 'text.disabled', mt: 0.5 }}>
              cGy · volumes at dose-grid resolution · D95/D50/D2 = dose reached by at least 95/50/2% of the structure
            </Typography>
          )}
        </>
      ) : (
        <Box sx={{ py: 4 }}>
          <Typography variant="caption" color="text.secondary">
            Enable dose display (IMAGES module → Dose tab → Show Dose) once to
            load the dose grid, then return here.
          </Typography>
        </Box>
      )}
    </Box>
  );
}
