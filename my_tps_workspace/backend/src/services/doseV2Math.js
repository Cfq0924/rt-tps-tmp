/**
 * Phase 4 M2 — dose engine v2 math (pure functions, unit-testable).
 *
 * Upgrades over the v1 water prototype:
 *   - HU → relative density via a configurable piecewise-linear calibration
 *   - exact inverse-square from the virtual source (divergent beam)
 *   - MLC leaf-pair control points → BEV fluence, integrated over control
 *     points weighted by cumulative meterset weight
 *   - TPR parameter table (6MV / 10MV, configurable)
 *
 * Beam axes (HFS, gantry rotation in the patient xy-plane, IEC angles):
 *   û  = beam axis, source → isocentre: (-sin g, cos g, 0)
 *   êx = leaf-travel / X-jaw axis:      ( cos g, sin g, 0)
 *   source S = isocentre − SAD · û
 */

/** erfc-based smooth step used for field edges (penumbra σ from mm width). */
function erfApx(x) {
  const t = 1 / (1 + 0.3275911 * Math.abs(x));
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return x >= 0 ? y : -y;
}

/** Closed at a, open past b, erfc-smoothed edges with the given penumbra (mm). */
function smoothWindow(x, a, b, penumbraMm) {
  const s = Math.max(0.1, penumbraMm) / 1.7; // 20-80% penumbra ≈ 1.7σ
  return 0.5 * (erfApx((x - a) / s) - erfApx((x - b) / s));
}

/** TPR parameter sets. mu = exponential falloff (1/cm), dmax = build-up depth (cm). */
export const TPR_TABLE = {
  6: { mu: 0.047, dmax: 1.5 },
  10: { mu: 0.030, dmax: 2.3 },
};

export function tprParams(mv) {
  const key = Number(mv) >= 8 ? 10 : 6;
  return TPR_TABLE[key];
}

/** Tissue-maximum-ratio style depth falloff with build-up ramp. */
export function tpr(depthCm, params = TPR_TABLE[6]) {
  const { mu, dmax } = params;
  if (depthCm <= 0) return 0;
  if (depthCm < dmax) return Math.pow(depthCm / dmax, 0.7);
  return Math.exp(-mu * (depthCm - dmax));
}

/** Default HU → relative density calibration (piecewise linear, clamped). */
export const DEFAULT_RHO_TABLE = [
  [-1000, 0],
  [0, 1],
  [100, 1.1],
  [2000, 2],
];

/** Piecewise-linear HU → ρ with clamping at the table ends. */
export function huToRho(hu, table = DEFAULT_RHO_TABLE) {
  if (hu <= table[0][0]) return table[0][1];
  for (let i = 1; i < table.length; i++) {
    const [hu1, rho1] = table[i];
    if (hu <= hu1) {
      const [hu0, rho0] = table[i - 1];
      return rho0 + ((hu - hu0) / (hu1 - hu0)) * (rho1 - rho0);
    }
  }
  return table[table.length - 1][1];
}

/**
 * Beam axes for an IEC gantry angle (degrees).
 * @returns {{dir:[number,number,0], ex:[number,number,0], ey:[number,number,number]}}
 *   dir: source→isocentre axis; ex: leaf travel; ey: dir × ex (≈ ±z)
 */
export function beamAxes(gantryDeg) {
  const g = (gantryDeg * Math.PI) / 180;
  const dir = [-Math.sin(g), Math.cos(g), 0];
  const ex = [Math.cos(g), Math.sin(g), 0];
  const ey = [
    dir[1] * ex[2] - dir[2] * ex[1],
    dir[2] * ex[0] - dir[0] * ex[2],
    dir[0] * ex[1] - dir[1] * ex[0],
  ];
  return { dir, ex, ey };
}

/**
 * Exact inverse-square factor for a voxel at distance `distFromSource`
 * from the virtual source (SAD = source→isocentre distance).
 */
export function inverseSquare(distFromSourceMm, sadMm) {
  if (distFromSourceMm <= 0) return 0;
  return (sadMm / distFromSourceMm) ** 2;
}

/**
 * BEV fluence at the isocentre plane for one control point's leaf pairs.
 * @param {number} x - BEV x at iso plane (mm, leaf-travel axis)
 * @param {number} y - BEV y at iso plane (mm, leaf-row axis)
 * @param {Array<{x1:number, x2:number}>} leafPairs - bank positions (mm),
 *   row j covers y ∈ [ (j - n/2)·leafWidthMm, (j + 1 - n/2)·leafWidthMm ]
 * @param {number} leafWidthMm
 * @param {number} penumbraMm
 * @returns {number} 0..1
 */
export function controlPointFluence(x, y, leafPairs, leafWidthMm = 5, penumbraMm = 4) {
  const n = leafPairs.length;
  const row = Math.floor((y + (n * leafWidthMm) / 2) / leafWidthMm);
  if (row < 0 || row >= n) return 0;
  const { x1, x2 } = leafPairs[row];
  return Math.max(0, smoothWindow(x, x1, x2, penumbraMm));
}

/**
 * Integrated BEV fluence over the plan's control points, weighted by
 * cumulative meterset weight deltas, normalised to sum(weights) = 1.
 * @param {number} x - BEV x at iso plane (mm)
 * @param {number} y - BEV y at iso plane (mm)
 * @param {Array<{cumulativeWeight:number, leafPairs:Array<{x1:number,x2:number}>}>} controlPoints
 *   ascending by cumulativeWeight (as extracted from RTPLAN)
 * @returns {number} 0..1 relative fluence
 */
export function integratedFluence(x, y, controlPoints, leafWidthMm = 5, penumbraMm = 4) {
  const cps = (controlPoints ?? []).filter(cp => cp.leafPairs?.length);
  if (cps.length === 0) return 1; // no modulation data → open field
  let acc = 0;
  let total = 0;
  let prev = 0;
  for (const cp of cps) {
    const w = Math.max(0, (cp.cumulativeWeight ?? 0) - prev);
    prev = cp.cumulativeWeight ?? prev;
    if (w <= 0) continue;
    acc += w * controlPointFluence(x, y, cp.leafPairs, leafWidthMm, penumbraMm);
    total += w;
  }
  return total > 0 ? acc / total : 1;
}

/**
 * Project a patient voxel onto the beam's isocentre plane (divergent ray).
 * @param {number[]} v - voxel patient coords
 * @param {number[]} source - virtual source position
 * @param {number} sad - source→isocentre distance (mm)
 * @param {Object} axes - beamAxes() result
 * @returns {{x:number, y:number, distFromSource:number, onAxis:boolean}|null}
 */
export function projectToBEV(v, source, sad, axes) {
  const w = [v[0] - source[0], v[1] - source[1], v[2] - source[2]];
  const dist = Math.hypot(w[0], w[1], w[2]);
  if (dist < 1e-6) return null;
  const a = w[0] * axes.dir[0] + w[1] * axes.dir[1] + w[2] * axes.dir[2];
  if (a <= 1) return null; // behind or at the source plane
  const scale = sad / a;
  return {
    x: (w[0] * axes.ex[0] + w[1] * axes.ex[1] + w[2] * axes.ex[2]) * scale,
    y: (w[0] * axes.ey[0] + w[1] * axes.ey[1] + w[2] * axes.ey[2]) * scale,
    distFromSource: dist,
    onAxis: a > 0,
  };
}
