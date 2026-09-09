import { readFile } from 'fs/promises';
import pkg from 'dcmjs';

const { data: { DicomMessage, DicomMetaDictionary } } = pkg;

/**
 * Parse an RTPLAN DICOM file into a plain JSON-able plan object.
 *
 * Scope (v1): plan metadata, prescription, fractionation and per-beam
 * GEOMETRY summaries (gantry/collimator/couch angles, jaws, isocenter —
 * from control point 0). MLC leaf sequences are intentionally not extracted
 * (IMRT fluence editing/verification is out of scope for now).
 *
 * Varian quirk: this vendor writes (300A,011A)/(300A,011C) swapped relative
 * to the DICOM standard, and dcmjs's dictionary has the same swap — they
 * cancel out, so naturalized keyword access is correct for these files.
 * Standard-conformant files would land the sequence under the opposite
 * keyword; helpers below try both forms.
 */

function num(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function str(v, fallback = '') {
  return v === undefined || v === null ? fallback : String(v);
}

/**
 * Get a sequence from a naturalized dataset/item, tolerating the
 * BeamLimitingDevicePositionSequence / LeafJawPositions keyword swap.
 */
function getSequence(item, ...names) {
  for (const n of names) {
    if (item && Array.isArray(item[n])) return item[n];
  }
  return [];
}

/**
 * Extract the jaw positions (ASYMX/ASYMY pairs) from a control point's
 * beam-limiting device sequence, tolerating the keyword swap.
 * @returns {{x1:number,x2:number,y1:number,y2:number}|null}
 */
function extractJaws(controlPoint) {
  const devices = getSequence(
    controlPoint,
    'BeamLimitingDevicePositionSequence',
    'LeafJawPositions'
  );
  let x = null;
  let y = null;
  for (const dev of devices) {
    const type = str(dev.RTBeamLimitingDeviceType);
    const pos = dev.LeafJawPositions ?? dev.BeamLimitingDevicePosition;
    if (!Array.isArray(pos) || pos.length < 2) continue;
    if (type === 'ASYMX' || (!type && x === null && pos.length === 2)) {
      x = { x1: num(pos[0]), x2: num(pos[1]) };
    } else if (type === 'ASYMY' || (!type && y === null && pos.length === 2)) {
      y = { y1: num(pos[0]), y2: num(pos[1]) };
    }
  }
  if (!x || !y) return null;
  return { x1: x.x1, x2: x.x2, y1: y.y1, y2: y.y2 };
}

/**
 * Extract MLC leaf pairs (MLCX/MLCY) from a control point.
 * @returns {{type:string, leafPairs:{x1:number,x2:number}[]}|null}
 */
function extractMLC(controlPoint) {
  const devices = getSequence(controlPoint, 'BeamLimitingDevicePositionSequence');
  for (const dev of devices) {
    const type = str(dev.RTBeamLimitingDeviceType);
    if (type !== 'MLCX' && type !== 'MLCY') continue;
    const pos = dev.LeafJawPositions ?? dev.BeamLimitingDevicePosition;
    if (!Array.isArray(pos) || pos.length < 2) continue;
    const leafPairs = [];
    for (let i = 0; i + 1 < pos.length; i += 2) {
      leafPairs.push({ x1: num(pos[i]), x2: num(pos[i + 1]) });
    }
    return { type, leafPairs };
  }
  return null;
}

/** Leaf pair count from the beam's BeamLimitingDeviceSequence (MLCX). */
function extractLeafPairCount(beam) {
  const devices = getSequence(beam, 'BeamLimitingDeviceSequence');
  for (const dev of devices) {
    const type = str(dev.RTBeamLimitingDeviceType);
    if (type === 'MLCX' || type === 'MLCY') {
      return num(dev.NumberOfLeafJawPairs);
    }
  }
  return null;
}

/** Per-control-point geometry/MLC snapshot (beam delivery sequence). */
function extractControlPoints(controlPoints) {
  return controlPoints.map((cp, idx) => ({
    cpIndex: idx,
    gantryAngle: num(cp.GantryAngle),
    collimatorAngle: num(cp.BeamLimitingDeviceAngle),
    couchAngle: num(cp.PatientSupportAngle),
    cumulativeMetersetWeight: num(cp.CumulativeMetersetWeight),
    mlc: extractMLC(cp),
    jaws: extractJaws(cp),
  }));
}

/**
 * Parse an RTPLAN file.
 * @param {string} filePath
 * @returns {Object} plan (JSON-able)
 */
export async function parseRTPlan(filePath) {
  let buffer;
  try {
    buffer = await readFile(filePath);
  } catch (err) {
    throw new Error(`Failed to read DICOM file: ${err.message}`);
  }

  const byteArray = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  const dicomData = DicomMessage.readFile(byteArray);
  const ds = DicomMetaDictionary.naturalizeDataset(dicomData.dict);

  // ---- metadata ----
  const referencedStructureSet = getSequence(ds, 'ReferencedStructureSetSequence')[0];

  // ---- prescription (DoseReferenceSequence 300A,0010) ----
  const doseRef = getSequence(ds, 'DoseReferenceSequence')[0] ?? {};
  const prescription = {
    doseReferenceNumber: num(doseRef.DoseReferenceNumber, 1),
    structureType: str(doseRef.DoseReferenceStructureType),
    description: str(doseRef.DoseReferenceDescription),
    doseReferenceType: str(doseRef.DoseReferenceType),
    targetPrescriptionDoseGy: num(doseRef.TargetPrescriptionDose),
  };

  // ---- fractionation (FractionGroupSequence 300A,0070) ----
  const fracGroup = getSequence(ds, 'FractionGroupSequence')[0] ?? {};
  const refBeams = getSequence(fracGroup, 'ReferencedBeamSequence');
  const fractionation = {
    numberOfFractions: num(fracGroup.NumberOfFractionsPlanned, 1),
    numberOfBeams: num(fracGroup.NumberOfBeams, refBeams.length),
    beamDosesGy: refBeams.map(rb => num(rb.BeamDose)),
    beamMetersetsMU: refBeams.map(rb => num(rb.BeamMeterset)),
  };

  // ---- beams (BeamSequence 300A,00B0) ----
  const beams = getSequence(ds, 'BeamSequence').map(beam => {
    const controlPoints = getSequence(beam, 'ControlPointSequence');
    const cp0 = controlPoints[0] ?? {};
    const cpLast = controlPoints[controlPoints.length - 1] ?? cp0;

    const gantryStart = num(cp0.GantryAngle);
    const gantryEnd = num(cpLast.GantryAngle, gantryStart);

    return {
      beamNumber: num(beam.BeamNumber),
      beamName: str(beam.BeamName),
      beamDescription: str(beam.BeamDescription) || null,
      treatmentMachineName: str(beam.TreatmentMachineName),
      radiationType: str(beam.RadiationType),
      beamType: str(beam.BeamType),
      treatmentDeliveryType: str(beam.TreatmentDeliveryType) || 'TREAT',
      nominalBeamEnergyMV: num(cp0.NominalBeamEnergy),
      sourceAxisDistanceMm: num(beam.SourceAxisDistance),
      numberOfControlPoints: num(beam.NumberOfControlPoints, controlPoints.length),
      // geometry lives on control point 0 for static-gantry fields
      gantryAngleDeg: gantryStart,
      // arc detection: gantry differs between first and last control point
      gantryArc: Math.abs(gantryEnd - gantryStart) > 0.01
        ? { start: gantryStart, end: gantryEnd }
        : null,
      beamLimitingDeviceAngleDeg: num(cp0.BeamLimitingDeviceAngle),
      patientSupportAngleDeg: num(cp0.PatientSupportAngle),
      isocenterPosition: cp0.IsocenterPosition
        ? { x: num(cp0.IsocenterPosition[0]), y: num(cp0.IsocenterPosition[1]), z: num(cp0.IsocenterPosition[2]) }
        : null,
      jawPosition: extractJaws(cp0),
      finalCumulativeMetersetWeight: num(beam.FinalCumulativeMetersetWeight, 1),
      leafPairCount: extractLeafPairCount(beam),
      controlPoints: extractControlPoints(controlPoints),
    };
  });

  return {
    rtPlanLabel: str(ds.RTPlanLabel),
    rtPlanName: str(ds.RTPlanName) || null,
    rtPlanDate: str(ds.RTPlanDate),
    approvalStatus: str(ds.ApprovalStatus) || 'UNAPPROVED',
    manufacturer: str(ds.Manufacturer),
    manufacturerModelName: str(ds.ManufacturerModelName),
    softwareVersions: str(ds.SoftwareVersions),
    studyInstanceUID: str(ds.StudyInstanceUID),
    rtPlanGeometry: str(ds.RTPlanGeometry),
    referencedStructureSetSOPInstanceUID: referencedStructureSet
      ? str(referencedStructureSet.ReferencedSOPInstanceUID)
      : null,
    prescription,
    fractionation,
    beams,
  };
}

/**
 * Look up fraction-group data for a beam number (beam dose / meterset).
 */
export function fractionDataForBeam(plan, beamNumber) {
  const i = plan.beams.findIndex(b => b.beamNumber === beamNumber);
  if (i === -1) return null;
  return {
    beamDoseGy: plan.fractionation.beamDosesGy[i] ?? null,
    beamMetersetMU: plan.fractionation.beamMetersetsMU[i] ?? null,
  };
}
