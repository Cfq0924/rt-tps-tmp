import { describe, it } from 'node:test';
import assert from 'node:assert';
import { deltaCouchShiftsFromIso } from '../src/services/ebrtPlanService.js';

describe('deltaCouchShiftsFromIso', () => {
  it('converts the isocentre to Varian couch coordinates (HFS, cm)', () => {
    const plan = {
      name: 'Rt Lung',
      isocenterX: 10, isocenterY: -20, isocenterZ: 30,
      beams: [
        { beamNumber: 1, purpose: 'TREATMENT', name: 'Field 1' },
        { beamNumber: 2, purpose: 'SETUP', name: 'AP kV-Setup' },
      ],
    };
    const r = deltaCouchShiftsFromIso(plan);
    assert.deepEqual(r.shifts, { couchVrtCm: -3, couchLngCm: 2, couchLatCm: -1 });
    // setup fields listed first as reference setup positions
    assert.deepEqual(r.fields.map(f => f.fieldId), ['AP kV-Setup', 'Field 1']);
    assert.equal(r.fields[0].kind, 'SETUP');
    assert.equal(r.fields[1].kind, 'TREATMENT');
  });

  it('rounds shifts to 0.1 cm like the Eclipse table', () => {
    const r = deltaCouchShiftsFromIso({ isocenterX: 12.34, isocenterY: -5.6, isocenterZ: 0.78, beams: [] });
    assert.deepEqual(r.shifts, { couchVrtCm: -0.1, couchLngCm: 0.6, couchLatCm: -1.2 });
  });
});
