/**
 * Eclipse-style structure dictionary (subset of common ROIs).
 * Selecting an entry sets name + interpretedType + default color so RTSTRUCT
 * export carries a proper RTROIInterpretedType without relying on name heuristics.
 *
 * Types match DICOM RTROIInterpretedType (3006,00A4).
 */

export const ROI_TYPES = ['GTV', 'CTV', 'PTV', 'ORGAN', 'AVOIDANCE', 'CONTROL', 'EXTERNAL', 'BOLUS', 'MARKER', 'REGISTRATION'];

/** @type {Array<{name:string, type:string, color:string, group:string}>} */
export const STRUCTURE_DICTIONARY = [
  // Targets
  { name: 'GTV', type: 'GTV', color: '#ff5c5c', group: 'Target' },
  { name: 'CTV', type: 'CTV', color: '#ff9f43', group: 'Target' },
  { name: 'CTV_High', type: 'CTV', color: '#ff9f43', group: 'Target' },
  { name: 'CTV_Low', type: 'CTV', color: '#ffb347', group: 'Target' },
  { name: 'PTV', type: 'PTV', color: '#f6c177', group: 'Target' },
  { name: 'PTV_High', type: 'PTV', color: '#f6c177', group: 'Target' },
  { name: 'PTV_Low', type: 'PTV', color: '#ffd28a', group: 'Target' },
  { name: 'Body', type: 'EXTERNAL', color: '#9ae66e', group: 'External' },
  { name: 'Bolus', type: 'BOLUS', color: '#5cc8ff', group: 'External' },

  // CNS
  { name: 'SpinalCord', type: 'AVOIDANCE', color: '#c792ea', group: 'CNS' },
  { name: 'BrainStem', type: 'AVOIDANCE', color: '#c792ea', group: 'CNS' },
  { name: 'OpticChiasm', type: 'AVOIDANCE', color: '#c792ea', group: 'CNS' },
  { name: 'OpticNerve_L', type: 'AVOIDANCE', color: '#c792ea', group: 'CNS' },
  { name: 'OpticNerve_R', type: 'AVOIDANCE', color: '#c792ea', group: 'CNS' },
  { name: 'Lens_L', type: 'AVOIDANCE', color: '#e0e0e0', group: 'CNS' },
  { name: 'Lens_R', type: 'AVOIDANCE', color: '#e0e0e0', group: 'CNS' },
  { name: 'Eye_L', type: 'ORGAN', color: '#e0e0e0', group: 'CNS' },
  { name: 'Eye_R', type: 'ORGAN', color: '#e0e0e0', group: 'CNS' },
  { name: 'Cochlea_L', type: 'AVOIDANCE', color: '#c792ea', group: 'CNS' },
  { name: 'Cochlea_R', type: 'AVOIDANCE', color: '#c792ea', group: 'CNS' },

  // H&N
  { name: 'Parotid_L', type: 'ORGAN', color: '#5cc8ff', group: 'HN' },
  { name: 'Parotid_R', type: 'ORGAN', color: '#5cc8ff', group: 'HN' },
  { name: 'Submand_L', type: 'ORGAN', color: '#5cc8ff', group: 'HN' },
  { name: 'Submand_R', type: 'ORGAN', color: '#5cc8ff', group: 'HN' },
  { name: 'Larynx', type: 'ORGAN', color: '#5cc8ff', group: 'HN' },
  { name: 'Mandible', type: 'ORGAN', color: '#e0e0e0', group: 'HN' },

  // Thorax
  { name: 'Lung_L', type: 'ORGAN', color: '#5cc8ff', group: 'Thorax' },
  { name: 'Lung_R', type: 'ORGAN', color: '#5cc8ff', group: 'Thorax' },
  { name: 'Heart', type: 'ORGAN', color: '#ff5c5c', group: 'Thorax' },
  { name: 'Esophagus', type: 'ORGAN', color: '#5cc8ff', group: 'Thorax' },
  { name: 'SpinalCanal', type: 'AVOIDANCE', color: '#c792ea', group: 'Thorax' },

  // Abdomen / Pelvis
  { name: 'Liver', type: 'ORGAN', color: '#ff9f43', group: 'Abdomen' },
  { name: 'Kidney_L', type: 'ORGAN', color: '#5cc8ff', group: 'Abdomen' },
  { name: 'Kidney_R', type: 'ORGAN', color: '#5cc8ff', group: 'Abdomen' },
  { name: 'Stomach', type: 'ORGAN', color: '#5cc8ff', group: 'Abdomen' },
  { name: 'Bowel', type: 'ORGAN', color: '#5cc8ff', group: 'Abdomen' },
  { name: 'Bladder', type: 'ORGAN', color: '#5cc8ff', group: 'Pelvis' },
  { name: 'Rectum', type: 'ORGAN', color: '#5cc8ff', group: 'Pelvis' },
  { name: 'FemoralHead_L', type: 'ORGAN', color: '#e0e0e0', group: 'Pelvis' },
  { name: 'FemoralHead_R', type: 'ORGAN', color: '#e0e0e0', group: 'Pelvis' },
];

/** Infer InterpretedType from a free-form name (fallback when dictionary not used). */
export function inferTypeFromName(name) {
  const n = String(name ?? '').trim().toUpperCase();
  if (!n) return 'ORGAN';
  if (n.startsWith('PTV')) return 'PTV';
  if (n.startsWith('CTV')) return 'CTV';
  if (n.startsWith('GTV')) return 'GTV';
  if (n.includes('BOLUS')) return 'BOLUS';
  if (n.startsWith('BODY') || n === 'EXTERNAL' || n.startsWith('EXTERNAL')) return 'EXTERNAL';
  if (n.includes('CORD') || n.includes('AVOID') || n.includes('PRV')) return 'AVOIDANCE';
  return 'ORGAN';
}

/** Look up a dictionary entry by exact name (case-sensitive). */
export function findDictionaryEntry(name) {
  return STRUCTURE_DICTIONARY.find(e => e.name === name) ?? null;
}
