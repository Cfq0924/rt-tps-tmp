/**
 * Preset treatment machine configurations for the EBRT module.
 * Extend this list to add machines — the plan form renders machine
 * properties (energies, max field size) from these objects.
 */
export const MACHINES = [
  {
    id: 'EclipseCAP_TB',
    label: 'Varian Eclipse CAP (EclipseCAP_TB)',
    sadMm: 1000,
    energies: [6, 10],
    mlc: { model: 'MLCX', leafPairs: 60 },
    maxFieldSizeMm: 400,
    maxGantryRate: 600,
  },
  {
    id: 'GenericLINAC',
    label: 'Generic LINAC',
    sadMm: 1000,
    energies: [6, 10],
    mlc: { model: 'MLCX', leafPairs: 60 },
    maxFieldSizeMm: 400,
    maxGantryRate: 600,
  },
];

export const DOSE_ALGORITHMS = [
  { id: 'PENCIL_BEAM', label: 'Pencil Beam Convolution' },
  { id: 'COLLAPSED_CONE', label: 'Collapsed Cone' },
  { id: 'MONTE_CARLO', label: 'Monte Carlo' },
];

export const OPTIMIZATION_ALGORITHMS = [
  { id: 'DMLC_IMRT', label: 'DMLC Sliding Window IMRT' },
  { id: 'VMAT', label: 'VMAT Arc Optimization' },
  { id: 'STATIC_3D', label: '3D Conformal (static fields)' },
];

export const NORMALIZATIONS = [
  { id: 'ISOCENTER', label: 'Normalize to isocenter' },
  { id: 'PRESCRIPTION_LINE', label: 'Normalize to prescription line' },
];

export function getMachine(id) {
  return MACHINES.find(m => m.id === id) ?? MACHINES[0];
}
