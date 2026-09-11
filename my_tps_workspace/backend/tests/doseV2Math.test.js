import { describe, it } from 'node:test';
import assert from 'node:assert';

const {
  huToRho, tpr, tprParams, beamAxes, inverseSquare, controlPointFluence, integratedFluence, projectToBEV,
} = await import('../src/services/doseV2Math.js');

describe('huToRho', () => {
  it('maps table stops and interpolates linearly', () => {
    assert.strictEqual(huToRho(-1000), 0);
    assert.strictEqual(huToRho(-500), 0.5);
    assert.strictEqual(huToRho(0), 1);
    assert.strictEqual(huToRho(50), 1.05);
    assert.strictEqual(huToRho(3000), 2); // clamped
  });

  it('supports a custom table', () => {
    const table = [[-1000, 0], [1000, 1]];
    assert.strictEqual(huToRho(0, table), 0.5);
    assert.strictEqual(huToRho(5000, table), 1);
  });
});

describe('tpr + parameter table', () => {
  it('6MV peak at dmax and exponential falloff', () => {
    const p = tprParams(6);
    assert.strictEqual(p.dmax, 1.5);
    assert.strictEqual(tpr(0, p), 0);
    assert.strictEqual(tpr(1.5, p), 1);
    assert.ok(tpr(10, p) > 0.6 && tpr(10, p) < 0.7, `TPR(10cm 6MV) ${tpr(10, p)}`);
  });

  it('10MV is less attenuating than 6MV at depth', () => {
    assert.ok(tpr(20, tprParams(10)) > tpr(20, tprParams(6)));
  });

  it('energy above 8MV selects the 10MV table', () => {
    assert.strictEqual(tprParams(6).dmax, 1.5);
    assert.strictEqual(tprParams(10).dmax, 2.3);
  });
});

describe('beamAxes', () => {
  it('gantry 0 beam travels +y (anterior → posterior), leaves along x', () => {
    const { dir, ex, ey } = beamAxes(0);
    for (const [a, b] of [[dir[0], 0], [dir[1], 1], [ex[0], 1], [ex[1], 0]]) {
      assert.ok(Math.abs(a - b) < 1e-12, `${a} vs ${b}`);
    }
    assert.ok(Math.abs(ey[2]) === 1);
  });

  it('gantry 90 beam travels −x', () => {
    const { dir } = beamAxes(90);
    assert.ok(Math.abs(dir[0] + 1) < 1e-12);
    assert.ok(Math.abs(dir[1]) < 1e-12);
  });
});

describe('inverseSquare', () => {
  it('gives 1 at SAD and the exact ratio elsewhere', () => {
    assert.strictEqual(inverseSquare(1000, 1000), 1);
    assert.strictEqual(inverseSquare(900, 1000), (1000 / 900) ** 2);
    assert.strictEqual(inverseSquare(1100, 1000), (1000 / 1100) ** 2);
  });
});

describe('controlPointFluence', () => {
  const pairs = [
    { x1: -50, x2: -10 }, // row −2 (y ≈ −12..−7 with 5mm rows, 4 rows)
    { x1: -10, x2: 10 },
    { x1: -10, x2: 10 },
    { x1: 10, x2: 50 },
  ];

  it('is open inside the leaf pair and closed outside', () => {
    assert.ok(controlPointFluence(0, 1, pairs) > 0.95);
    assert.ok(controlPointFluence(30, 1, pairs) < 0.05); // blocked (pair open at +10..+50 but y=1 is centre rows)
    assert.ok(controlPointFluence(-30, -8, pairs) > 0.95); // row 0 open
  });

  it('closed leaf pair blocks the row', () => {
    assert.ok(controlPointFluence(0, 1, [{ x1: 5, x2: 5 }, { x1: 0, x2: 0 }, { x1: 0, x2: 0 }, { x1: 0, x2: 0 }]) < 0.05);
  });

  it('y outside the leaf bank is closed', () => {
    assert.strictEqual(controlPointFluence(0, 100, pairs), 0);
  });
});

describe('integratedFluence', () => {
  const cps = [
    { cumulativeWeight: 0.5, leafPairs: [{ x1: -40, x2: 40 }, { x1: -40, x2: 40 }, { x1: -40, x2: 40 }, { x1: -40, x2: 40 }] },
    { cumulativeWeight: 1.0, leafPairs: [{ x1: 5, x2: 40 }, { x1: 5, x2: 40 }, { x1: 5, x2: 40 }, { x1: 5, x2: 40 }] },
  ];

  it('weights control points by meterset deltas', () => {
    // left half (x<5) open only during CP1 (50% weight) → ≈ 0.5
    assert.ok(Math.abs(integratedFluence(-20, 1, cps) - 0.5) < 0.02);
    // x>20 open during both → 1.0
    assert.ok(Math.abs(integratedFluence(20, 1, cps) - 1) < 0.02);
  });

  it('returns 1 for beams without control points (open field)', () => {
    assert.strictEqual(integratedFluence(0, 0, []), 1);
  });
});

describe('projectToBEV', () => {
  const { dir, ex, ey } = beamAxes(0); // beam along +y
  const iso = [0, 0, 0];
  const source = [-dir[0] * 1000, -dir[1] * 1000, 0]; // (0,-1000,0)
  const axes = { dir, ex, ey };

  it('projects the isocentre to (0,0) at SAD distance', () => {
    const p = projectToBEV(iso, source, 1000, axes);
    assert.strictEqual(p.distFromSource, 1000);
    assert.ok(Math.abs(p.x) < 1e-9 && Math.abs(p.y) < 1e-9);
  });

  it('magnifies off-axis voxels closer to the source (divergence)', () => {
    // voxel 1cm off axis but 10cm nearer the source → BEV x magnified
    const v = [10, -100, 0];
    const p = projectToBEV(v, source, 1000, axes);
    assert.ok(p.x > 10, `x ${p.x} should exceed 10`);
    // voxel on the isocentre plane keeps its true offset
    const v2 = [10, 0, 0];
    const p2 = projectToBEV(v2, source, 1000, axes);
    assert.ok(Math.abs(p2.x - 10) < 1e-6);
  });

  it('rejects points behind the source', () => {
    assert.strictEqual(projectToBEV([0, -2000, 0], source, 1000, axes), null);
  });
});
