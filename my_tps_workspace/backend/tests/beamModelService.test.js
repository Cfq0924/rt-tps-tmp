import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { unlinkSync } from 'fs';
import { tmpdir } from 'os';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const TEST_DB = join(tmpdir(), `beam-model-test-${Date.now()}-${process.pid}.db`);
process.env.DB_PATH = TEST_DB;
const STUDY_ID = 1;

const MLC_60 = { type: 'MLCX', leafPairs: Array.from({ length: 60 }, (_, i) => ({ x1: -100, x2: 100 })) };
const MLC_GAP = { type: 'MLCX', leafPairs: [{ x1: -60, x2: -20 }, ...Array.from({ length: 59 }, () => ({ x1: -100, x2: 100 }))] };

async function setupSchema() {
  const { default: Database } = await import('better-sqlite3');
  const db = new Database(TEST_DB);
  const { readFileSync } = await import('fs');
  const schemaPath = join(dirname(fileURLToPath(import.meta.url)), '../src/db/schema.sql');
  db.exec(readFileSync(schemaPath, 'utf-8'));
  const p = db.prepare("INSERT INTO patients (external_id, name) VALUES ('bm-test', 'Beam Model Test')").run();
  db.prepare('INSERT INTO studies (patient_id, study_instance_uid) VALUES (?, ?)').run(p.lastInsertRowid, '1.2.840.bmtest.1');
  const plan = db.prepare(`
    INSERT INTO ebrt_plans (study_id, name, prescription_dose_gy, number_of_fractions, isocenter_x, isocenter_y, isocenter_z)
    VALUES (?, 'BM Plan', 60, 30, 1, 2, 3)
  `).run(STUDY_ID);
  db.prepare(`
    INSERT INTO ebrt_beams (plan_id, beam_number, name, beam_type, energy_mv, gantry_angle, weight)
    VALUES (?, 1, 'AP', 'STATIC', 6, 0, 0.5)
  `).run(plan.lastInsertRowid);
  db.close();
}

describe('beamModelService', () => {
  let svc;
  let beamId;
  let planId;

  before(async () => {
    await setupSchema();
    svc = await import('../src/services/beamModelService.js');
    const db = (await import('../src/db/init.js')).getDb();
    beamId = db.prepare('SELECT id FROM ebrt_beams LIMIT 1').get().id;
    planId = db.prepare('SELECT plan_id AS planId FROM ebrt_beams LIMIT 1').get().planId;
  });

  after(() => {
    for (const ext of ['', '-wal', '-shm']) {
      try { unlinkSync(TEST_DB + ext); } catch {}
    }
  });

  describe('control points', () => {
    it('replaces and lists control points with MLC', () => {
      const cps = [
        { cpIndex: 0, gantryAngle: 0, collimatorAngle: 0, couchAngle: 0, cumulativeMetersetWeight: 0, mlc: MLC_60 },
        { cpIndex: 1, gantryAngle: 2, collimatorAngle: 0, couchAngle: 0, cumulativeMetersetWeight: 1, mlc: MLC_GAP },
      ];
      const listed = svc.replaceControlPoints({ beamId, controlPoints: cps, userId: 1, reqId: 't' });
      assert.strictEqual(listed.length, 2);
      assert.strictEqual(listed[0].mlc.leafPairs.length, 60);
      assert.strictEqual(listed[1].mlc.leafPairs[0].x1, -60);
    });

    it('rejects leaf count mismatch', () => {
      assert.throws(
        () => svc.replaceControlPoints({ beamId, controlPoints: [{ mlc: { type: 'MLCX', leafPairs: [{ x1: -1, x2: 1 }] } }], userId: 1, reqId: 't' }),
        e => /leaf pair/.test(e.message),
      );
    });

    it('rejects non-numeric leaf positions', () => {
      assert.throws(
        () => svc.replaceControlPoints({
          beamId,
          controlPoints: [{ mlc: { type: 'MLCX', leafPairs: Array.from({ length: 60 }, () => ({ x1: -1, x2: 'x' })) } }],
          userId: 1, reqId: 't',
        }),
        e => e.status === 400,
      );
    });

    it('rejects leaf travel beyond ±200 mm', () => {
      assert.throws(
        () => svc.replaceControlPoints({
          beamId,
          controlPoints: [{ mlc: { type: 'MLCX', leafPairs: Array.from({ length: 60 }, () => ({ x1: -500, x2: 500 })) } }],
          userId: 1, reqId: 't',
        }),
        e => e.status === 400,
      );
    });

    it('rejects decreasing cumulative meterset weight', () => {
      assert.throws(
        () => svc.replaceControlPoints({
          beamId,
          controlPoints: [
            { cumulativeMetersetWeight: 1, mlc: MLC_60 },
            { cumulativeMetersetWeight: 0.5, mlc: MLC_60 },
          ],
          userId: 1, reqId: 't',
        }),
        e => /non-decreasing/.test(e.message),
      );
    });
  });

  describe('subfields (field in field)', () => {
    it('adds, lists and deletes subfields', () => {
      const s = svc.addSubfield({ beamId, name: 'FiF boost', weight: 0.3, mlc: { type: 'MLCX', leafPairs: [{ x1: -20, x2: 20 }] } }, 1, 't');
      const list = svc.listSubfields({ beamId, userId: 1, reqId: 't' });
      assert.strictEqual(list.length, 1);
      assert.strictEqual(list[0].name, 'FiF boost');
      const del = svc.deleteSubfield({ beamId, subfieldId: s.id, userId: 1, reqId: 't' });
      assert.strictEqual(del.ok, true);
      assert.throws(() => svc.deleteSubfield({ beamId, subfieldId: s.id, userId: 1, reqId: 't' }), e => e.status === 404);
    });

    it('rejects subfields without a name', () => {
      assert.throws(() => svc.addSubfield({ beamId, name: '', userId: 1, reqId: 't' }), e => e.status === 400);
    });
  });

  describe('opposing field', () => {
    it('creates the 180° opposing field with normalized gantry and copied jaws', async () => {
      // re-seed a clean beam for the opposing test
      const db = (await import('../src/db/init.js')).getDb();
      const plan = db.prepare('SELECT plan_id FROM ebrt_beams LIMIT 1').get();
      db.prepare(`
        INSERT INTO ebrt_beams (plan_id, beam_number, name, beam_type, energy_mv, gantry_angle, jaw_x1, jaw_x2, jaw_y1, jaw_y2, weight)
        VALUES (?, 9, 'AP Origin', 'STATIC', 6, 0, -50, 50, -50, 50, 1)
      `).run(plan.plan_id);

      const beam = svc.createOpposingField({ planId: plan.plan_id, sourceBeamNumber: 9, name: 'PA', userId: 1, reqId: 't' });
      assert.strictEqual(beam.beamNumber, 10);
      assert.strictEqual(beam.gantryAngle, 180);      // 0 + 180
      assert.strictEqual(beam.jawX1, -50);             // geometry copied
      assert.strictEqual(beam.jawX2, 50);
      assert.strictEqual(beam.beamType, 'STATIC');
    });

    it('normalizes gantry 270 + 180 into 90', async () => {
      const db = (await import('../src/db/init.js')).getDb();
      db.prepare(`
        INSERT INTO ebrt_beams (plan_id, beam_number, name, beam_type, gantry_angle, weight)
        VALUES (?, 20, 'RL 270', 'STATIC', 270, 1)
      `).run(planId);
      const beam = svc.createOpposingField({ planId, sourceBeamNumber: 20, userId: 1, reqId: 't' });
      assert.strictEqual(beam.gantryAngle, 90); // normalizeAngle(270 + 180) = 90
    });
  });
});
