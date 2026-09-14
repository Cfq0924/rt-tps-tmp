import { describe, it } from 'node:test';
import assert from 'node:assert';
import { fluenceToSlidingWindowMLC } from '../src/services/optimizerService.js';

describe('fluenceToSlidingWindowMLC', () => {
  it('produces closed-leaf CPs outside the fluence extent', () => {
    const cps = fluenceToSlidingWindowMLC({ fluence: [[0, 0, 0]], x0: 0, y0: 0 });
    assert.deepEqual(cps, []);
  });

  it('sweeps a unidirectional sliding window over the intensity levels', () => {
    // one leaf pair row, profile [1, 0, 2] → 2 levels
    const cps = fluenceToSlidingWindowMLC({ fluence: [[1, 0, 2]], x0: 0, y0: 0 });
    assert.equal(cps.length, 2);
    assert.equal(cps[0].cpIndex, 0);
    assert.equal(cps[1].cpIndex, 1);
    // level 0: only bin 0 open (x 0..5)
    assert.deepEqual(cps[0].leafPairs[30], { x1: 0, x2: 5 });
    // level 1: only bin 2 open (x 10..15)
    assert.deepEqual(cps[1].leafPairs[30], { x1: 10, x2: 15 });
    // all other pairs closed; cumulative weights ascend to 1
    assert.ok(cps[0].leafPairs.every((p, i) => i === 30 || (p.x1 === 0 && p.x2 === 0)));
    assert.equal(cps[1].cumulativeWeight, 1);
  });

  it('maps BEV rows onto the correct leaf pairs (5mm, 60 pairs)', () => {
    // y0 = 50 → row 0 covers y 50..55 → pair index floor((52.5+150)/5) = 40
    const cps = fluenceToSlidingWindowMLC({ fluence: [[2]], x0: 0, y0: 50 });
    assert.equal(cps.length, 2); // max fluence 2 → two intensity levels
    for (const cp of cps) {
      assert.ok(cps.every(cp2 => cp2.leafPairs[40].x2 >= cp2.leafPairs[40].x1));
      assert.deepEqual(cp.leafPairs[40], { x1: 0, x2: 5 });
      assert.ok(cp.leafPairs.every((p, i) => i === 40 || (p.x1 === 0 && p.x2 === 0)));
    }
  });
});
