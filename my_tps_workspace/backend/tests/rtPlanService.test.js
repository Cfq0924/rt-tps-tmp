import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { existsSync, readdirSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';

// Locate the local test data (not committed — tests skip when missing)
const TEST_DATA_DIR = join(fileURLToPath(import.meta.url), '../../../../test_data/patient1');

function findTestFile(prefix) {
  if (!existsSync(TEST_DATA_DIR)) return null;
  const fileName = readdirSync(TEST_DATA_DIR).find(f => f.startsWith(prefix));
  return fileName ? join(TEST_DATA_DIR, fileName) : null;
}

const TEST_RTPLAN_PATH = findTestFile('RP.');
const SKIP_REASON = TEST_RTPLAN_PATH ? false : 'test_data/patient1 RTPLAN file not available';

describe('rtPlanService', { skip: SKIP_REASON }, () => {
  let svc;
  let plan;

  before(async () => {
    svc = await import('../src/services/rtPlanService.js');
    plan = await svc.parseRTPlan(TEST_RTPLAN_PATH);
  });

  describe('parseRTPlan', () => {
    it('parses plan metadata', () => {
      assert.strictEqual(plan.rtPlanLabel, 'test 9f');
      assert.strictEqual(plan.approvalStatus, 'UNAPPROVED');
      assert.match(plan.studyInstanceUID, /^1\.3\.12\.2\.1107/);
      assert.strictEqual(plan.rtPlanGeometry, 'PATIENT');
      assert.strictEqual(plan.manufacturer, 'Varian Medical Systems');
    });

    it('references the RTSTRUCT present in the study', () => {
      assert.strictEqual(
        plan.referencedStructureSetSOPInstanceUID,
        '1.2.246.352.71.4.891085747523.32.20241127044013'
      );
    });

    it('parses the prescription (73.92 Gy @ PGTVnx, TARGET)', () => {
      assert.ok(Math.abs(plan.prescription.targetPrescriptionDoseGy - 73.92) < 1e-6);
      assert.strictEqual(plan.prescription.description, 'PGTVnx');
      assert.strictEqual(plan.prescription.structureType, 'SITE');
      assert.strictEqual(plan.prescription.doseReferenceType, 'TARGET');
    });

    it('parses fractionation: 33 fractions over 9 beams, self-consistent dosing', () => {
      const f = plan.fractionation;
      assert.strictEqual(f.numberOfFractions, 33);
      assert.strictEqual(f.numberOfBeams, 9);
      assert.strictEqual(f.beamDosesGy.length, 9);
      assert.strictEqual(f.beamMetersetsMU.length, 9);
      // Σ beam dose × fractions === prescription
      const totalPerFx = f.beamDosesGy.reduce((a, b) => a + b, 0);
      assert.ok(Math.abs(totalPerFx * 33 - 73.92) < 0.01,
        `ΣbeamDose×fx should equal Rx: ${totalPerFx * 33}`);
    });

    it('parses all 9 beams with IMRT geometry', () => {
      assert.strictEqual(plan.beams.length, 9);
      const gantryAngles = plan.beams.map(b => b.gantryAngleDeg);
      assert.deepStrictEqual(gantryAngles, [0, 40, 80, 120, 160, 200, 240, 280, 320]);

      for (const b of plan.beams) {
        assert.strictEqual(b.radiationType, 'PHOTON');
        assert.strictEqual(b.beamType, 'DYNAMIC'); // DMLC sliding window
        assert.strictEqual(b.nominalBeamEnergyMV, 6);
        assert.strictEqual(b.sourceAxisDistanceMm, 1000);
        assert.strictEqual(b.numberOfControlPoints, 166);
        assert.strictEqual(b.gantryArc, null, 'fixed gantry per field');
        assert.strictEqual(b.patientSupportAngleDeg, 0, 'coplanar');
        assert.ok(b.isocenterPosition, 'isocenter present');
      }
      assert.strictEqual(plan.beams[0].beamName, 'Field 1');
      assert.strictEqual(plan.beams[0].treatmentMachineName, 'EclipseCAP_TB');
    });

    it('parses the single shared isocenter', () => {
      for (const b of plan.beams) {
        assert.ok(Math.abs(b.isocenterPosition.x - (-13.786471902499)) < 1e-6);
        assert.ok(Math.abs(b.isocenterPosition.y - (-223.77576769926)) < 1e-6);
        assert.ok(Math.abs(b.isocenterPosition.z - (-886.15820623665)) < 1e-6);
      }
    });

    it('parses jaw positions from control point 0 (keyword-swap tolerant)', () => {
      const b1 = plan.beams[0];
      assert.ok(b1.jawPosition, 'jawPosition extracted');
      assert.ok(Math.abs(b1.jawPosition.x1 - (-111.125)) < 1e-3);
      assert.ok(Math.abs(b1.jawPosition.x2 - 23.875) < 1e-3);
      assert.ok(Math.abs(b1.jawPosition.y1 - (-152)) < 1e-3);
      assert.ok(Math.abs(b1.jawPosition.y2 - 52) < 1e-3);
    });
  });

  describe('fractionDataForBeam', () => {
    it('returns dose/meterset for a beam number', () => {
      const d = svc.fractionDataForBeam(plan, 1);
      assert.ok(Math.abs(d.beamDoseGy - 0.24888888888889) < 1e-9);
      assert.ok(Math.abs(d.beamMetersetMU - 449.7009) < 1e-3);
      assert.strictEqual(svc.fractionDataForBeam(plan, 99), null);
    });
  });
});
