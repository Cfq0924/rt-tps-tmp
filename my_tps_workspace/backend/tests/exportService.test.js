import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { existsSync, mkdirSync, unlinkSync, writeFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import dcmjs from 'dcmjs';
import { default as Database } from 'better-sqlite3';

// Isolated DB for this test run — set before importing db/init.js
const TEST_DB = join(tmpdir(), `export-test-${Date.now()}-${process.pid}.db`);
process.env.DB_PATH = TEST_DB;

const TEST_DIR = join(tmpdir(), `export-test-files-${process.pid}`);
const { datasetToBuffer } = dcmjs.data;
const { DicomMessage, DicomMetaDictionary } = dcmjs.data;

// dcmjs abbreviates UI values in `Value` (keeps lossless bytes in `_rawValue`);
// restore before naturalizing or UIDs read back truncated
function parseDataset(buffer) {
  const dicomDict = DicomMessage.readFile(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength));
  const restore = (d) => {
    for (const el of Object.values(d)) {
      if (!el || typeof el !== 'object' || !el.vr) continue;
      if (el.vr === 'UI' && Array.isArray(el._rawValue)) {
        el.Value = el._rawValue;
      } else if (el.vr === 'SQ' && Array.isArray(el.Value)) {
        el.Value.forEach(item => { if (item && typeof item === 'object') restore(item); });
      }
    }
  };
  restore(dicomDict.dict);
  return DicomMetaDictionary.naturalizeDataset(dicomDict.dict);
}

const STUDY_ID = 1;

async function setupSchema() {
  const { default: Database } = await import('better-sqlite3');
  const db = new Database(TEST_DB);
  const { readFileSync } = await import('fs');
  const schemaPath = join(dirname(fileURLToPath(import.meta.url)), '../src/db/schema.sql');
  db.exec(readFileSync(schemaPath, 'utf-8'));

  const p = db.prepare("INSERT INTO patients (external_id, name, birth_date, gender) VALUES ('App014', 'NPC RDS', '1970-01-01', 'F')").run();
  db.prepare('INSERT INTO studies (patient_id, study_instance_uid, study_date, description) VALUES (?, ?, ?, ?)')
    .run(p.lastInsertRowid, '1.2.840.export.test.1', '2026-04-06', 'Export test study');

  // two synthetic CT files (carry the FrameOfReferenceUID the exporter reads)
  mkdirSync(TEST_DIR, { recursive: true });
  for (const [idx, z] of [[1, -100], [2, -98]]) {
    const ct = {
      _meta: {},
      SOPClassUID: '1.2.840.10008.5.1.4.1.1.2',
      SOPInstanceUID: `1.2.840.export.ct.${idx}`,
      StudyInstanceUID: '1.2.840.export.test.1',
      SeriesInstanceUID: '1.2.840.export.ctseries',
      FrameOfReferenceUID: '1.2.840.export.for',
      Modality: 'CT',
      ImagePositionPatient: [0, 0, z],
      PixelData: '',
    };
    const bytes = datasetToBuffer(ct);
    const path = join(TEST_DIR, `ct${idx}.dcm`);
    writeFileSync(path, bytes);
    db.prepare(`
      INSERT INTO dicom_files (study_id, series_instance_uid, sop_instance_uid, modality, instance_number, file_path, file_name, image_position_z)
      VALUES (?, '1.2.840.export.ctseries', ?, 'CT', ?, ?, ?, ?)
    `).run(STUDY_ID, `1.2.840.export.ct.${idx}`, idx, path, `ct${idx}.dcm`, z);
  }

  // two painted segmentations with one slice each (flat [x,y,z,...] polygons)
  for (const [name, color] of [['PTV70', '#ff5c5c'], ['Parotid_L', '#5cc8ff']]) {
    const r = db.prepare('INSERT INTO segmentations (study_id, name, color) VALUES (?, ?, ?)').run(STUDY_ID, name, color);
    const points = name === 'PTV70'
      ? [[0, 0, -100, 10, 0, -100, 10, 10, -100, 0, 10, -100]]
      : [[20, 20, -98, 30, 20, -98, 30, 30, -98]];
    db.prepare('INSERT INTO segmentation_slices (segmentation_id, sop_instance_uid, instance_number, points_json) VALUES (?, ?, ?, ?)')
      .run(r.lastInsertRowid, `1.2.840.export.ct.${name === 'PTV70' ? 1 : 2}`, name === 'PTV70' ? 1 : 2, JSON.stringify(points));
  }

  // one EBRT plan with two beams (incl. VMAT + wedge + bolus)
  const plan = db.prepare(`
    INSERT INTO ebrt_plans (study_id, name, machine_name, energy_mv, prescription_dose_gy,
      number_of_fractions, approval_status, isocenter_x, isocenter_y, isocenter_z)
    VALUES (?, 'Test IMRT', 'EclipseCAP_TB', 6, 70, 33, 'REVIEWED', -13.8, -223.8, -886.2)
  `).run(STUDY_ID);
  db.prepare(`
    INSERT INTO ebrt_beams (plan_id, beam_number, name, beam_type, energy_mv, gantry_angle,
      gantry_angle_stop, collimator_angle, couch_angle, jaw_x1, jaw_x2, jaw_y1, jaw_y2, weight, wedge_angle, bolus)
    VALUES (?, 1, 'Field 1', 'STATIC', 6, 0, NULL, 0, 0, -111, 23, -152, 52, 0.5, 45, '5mm gel')
  `).run(plan.lastInsertRowid);
  db.prepare(`
    INSERT INTO ebrt_beams (plan_id, beam_number, name, beam_type, energy_mv, gantry_angle,
      gantry_angle_stop, collimator_angle, couch_angle, jaw_x1, jaw_x2, jaw_y1, jaw_y2, weight)
    VALUES (?, 2, 'Arc 1', 'VMAT', 6, 200, 160, 10, 0, -50, 50, -50, 50, 0.5)
  `).run(plan.lastInsertRowid);

  db.close();
}

describe('exportService', () => {
  let svc;

  before(async () => {
    await setupSchema();
    svc = await import('../src/services/exportService.js');
  });

  after(() => {
    for (const ext of ['', '-wal', '-shm']) {
      try { unlinkSync(TEST_DB + ext); } catch {}
    }
    try { rmSync(TEST_DIR, { recursive: true, force: true }); } catch {}
  });

  describe('generateDicomUid', () => {
    it('produces 2.25 UIDs within 64 chars and unique', () => {
      const seen = new Set();
      for (let i = 0; i < 100; i++) {
        const uid = svc.generateDicomUid();
        assert.ok(uid.startsWith('2.25.'));
        assert.ok(uid.length <= 64);
        assert.ok(!seen.has(uid));
        seen.add(uid);
      }
    });
  });

  describe('RTSTRUCT export', () => {
    let buffer;

    it('exports painted segmentations as a parseable RTSTRUCT', () => {
      const { buffer: buf, filename, roiCount } = svc.rtStructFromSegmentations({ studyId: STUDY_ID, userId: 1, reqId: 't' });
      buffer = buf;
      assert.strictEqual(roiCount, 2);
      assert.match(filename, /^rtstruct-study1-\d{8}\.dcm$/);
      assert.strictEqual(buffer.toString('ascii', 128, 132), 'DICM');
      const ds = parseDataset(buffer);
      assert.strictEqual(ds.Modality, 'RTSTRUCT');
      assert.strictEqual(ds.SOPClassUID, '1.2.840.10008.5.1.4.1.481.3');
      assert.strictEqual(ds.StudyInstanceUID, '1.2.840.export.test.1');
      assert.strictEqual(ds.PatientName[0].Alphabetic, 'NPC RDS');
      assert.strictEqual(ds.PatientID, 'App014');
      assert.strictEqual(ds.PatientSex, 'F');
      assert.strictEqual(ds.StructureSetROISequence.length, 2);
      assert.strictEqual(ds.StructureSetROISequence[0].ROIName, 'PTV70');
      assert.strictEqual(ds.StructureSetROISequence[0].ROINumber, 1);
    });

    it('round-trips contour geometry and frame of reference', () => {
      const ds = parseDataset(buffer);
      assert.strictEqual(ds.RTROIObservationsSequence[0].RTROIInterpretedType, 'PTV');
      assert.strictEqual(ds.RTROIObservationsSequence[1].RTROIInterpretedType, 'ORGAN');

      const roi1 = ds.ROIContourSequence.find(r => r.ReferencedROINumber === 1);
      const contour = roi1.ContourSequence[0];
      assert.strictEqual(contour.ContourGeometricType, 'CLOSED_PLANAR');
      assert.strictEqual(contour.NumberOfContourPoints, 4);
      assert.deepStrictEqual([...contour.ContourData], [0, 0, -100, 10, 0, -100, 10, 10, -100, 0, 10, -100]);
      assert.strictEqual(contour.ContourImageSequence[0].ReferencedSOPInstanceUID, '1.2.840.export.ct.1');

      // frame of reference read from the stored CT file
      assert.strictEqual(ds.ReferencedFrameOfReferenceSequence[0].FrameOfReferenceUID, '1.2.840.export.for');
      const refSeries = ds.ReferencedFrameOfReferenceSequence[0].RTReferencedStudySequence[0].RTReferencedSeriesSequence[0];
      assert.strictEqual(refSeries.SeriesInstanceUID, '1.2.840.export.ctseries');
      assert.strictEqual(refSeries.ContourImageSequence.length, 2);
    });

  });

  describe('segmentationIds filter', () => {
    it('exports only the requested ROI', () => {
      const db = new Database(TEST_DB, { readonly: true });
      const ids = db.prepare('SELECT id FROM segmentations ORDER BY id').all();
      db.close();
      const { buffer } = svc.rtStructFromSegmentations({
        studyId: STUDY_ID, segmentationIds: [ids[0].id], userId: 1, reqId: 't',
      });
      const ds = parseDataset(buffer);
      assert.strictEqual(ds.StructureSetROISequence.length, 1);
      assert.strictEqual(ds.StructureSetROISequence[0].ROIName, 'PTV70');
    });
  });

  describe('RTPLAN export', () => {
    let buffer;

    it('exports the workspace plan as a parseable RTPLAN', () => {
      const db = new Database(TEST_DB, { readonly: true });
      const plan = db.prepare('SELECT id FROM ebrt_plans LIMIT 1').get();
      db.close();
      const { buffer: buf, filename } = svc.rtPlanFromEbrtPlan({ planId: plan.id, userId: 1, reqId: 't' });
      buffer = buf;
      assert.match(filename, /^rtplan-\d+-\d{8}\.dcm$/);
      const ds = parseDataset(buffer);
      assert.strictEqual(ds.Modality, 'RTPLAN');
      assert.strictEqual(ds.RTPlanLabel, 'Test IMRT');
      assert.strictEqual(ds.ApprovalStatus, 'REVIEWED');
      assert.strictEqual(ds.FractionGroupSequence[0].NumberOfFractionsPlanned, 33);
      assert.strictEqual(ds.FractionGroupSequence[0].NumberOfBeams, 2);

      const staticBeam = ds.BeamSequence.find(b => b.BeamNumber === 1);
      assert.strictEqual(staticBeam.BeamType, 'STATIC');
      assert.strictEqual(staticBeam.ControlPointSequence[0].GantryAngle, 0);
      assert.strictEqual(staticBeam.WedgeSequence[0].WedgeAngle, 45);
      assert.strictEqual(staticBeam.BeamDescription, '5mm gel');
      const jaws = staticBeam.ControlPointSequence[0].BeamLimitingDevicePositionSequence;
      assert.deepStrictEqual(jaws.find(j => j.RTBeamLimitingDeviceType === 'X').LeafJawPositions, [-111, 23]);
      assert.deepStrictEqual(staticBeam.ControlPointSequence[0].IsocenterPosition, [-13.8, -223.8, -886.2]);

      const vmat = ds.BeamSequence.find(b => b.BeamNumber === 2);
      assert.strictEqual(vmat.BeamType, 'DYNAMIC');
      assert.strictEqual(vmat.ControlPointSequence.length, 2);
      assert.strictEqual(vmat.ControlPointSequence[1].GantryAngle, 160);
    });
  });

  describe('raw file export', () => {
    it('returns the stored bytes unchanged', () => {
      const db = new Database(TEST_DB, { readonly: true });
      const file = db.prepare("SELECT id FROM dicom_files WHERE sop_instance_uid = '1.2.840.export.ct.1'").get();
      db.close();
      const { buffer, filename } = svc.rawFileBytes({ fileId: file.id, userId: 1, reqId: 't' });
      assert.match(filename, /^ct1\.dcm$/);
      assert.strictEqual(buffer.toString('ascii', 128, 132), 'DICM');
      const ds = parseDataset(buffer);
      assert.strictEqual(ds.SOPInstanceUID, '1.2.840.export.ct.1');
    });

    it('throws 404 for unknown file ids', () => {
      assert.throws(() => svc.rawFileBytes({ fileId: 99999, userId: 1, reqId: 't' }), e => e.status === 404);
    });
  });
});
