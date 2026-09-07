import { describe, it, expect } from 'vitest';
import {
  beamSourcePosition,
  beamPortalCorners,
  beamCentralAxisEnds,
} from './beamGeometry.js';

const ISO = { x: -13.786471902499, y: -223.77576769926, z: -886.15820623665 };
const SAD = 1000;

describe('beamSourcePosition (IEC 61217)', () => {
  it('gantry 0: source directly anterior (−y)', () => {
    const s = beamSourcePosition(ISO, SAD, 0);
    expect(s.x).toBeCloseTo(ISO.x, 9);
    expect(s.y).toBeCloseTo(ISO.y - 1000, 9);
    expect(s.z).toBeCloseTo(ISO.z, 9);
  });

  it('gantry 90: source on the patient-left side (+x)', () => {
    const s = beamSourcePosition(ISO, SAD, 90);
    expect(s.x).toBeCloseTo(ISO.x + 1000, 9);
    expect(s.y).toBeCloseTo(ISO.y, 9);
  });

  it('gantry 180: source directly posterior (+y)', () => {
    const s = beamSourcePosition(ISO, SAD, 180);
    expect(s.y).toBeCloseTo(ISO.y + 1000, 9);
  });

  it('gantry 40 matches the real plan geometry', () => {
    const s = beamSourcePosition(ISO, SAD, 40);
    expect(s.x).toBeCloseTo(ISO.x + 1000 * Math.sin(40 * Math.PI / 180), 9);
    expect(s.y).toBeCloseTo(ISO.y - 1000 * Math.cos(40 * Math.PI / 180), 9);
  });
});

describe('beamPortalCorners', () => {
  const JAW = { x1: -111.125, x2: 23.875, y1: -152, y2: 52 };

  it('returns the 4 corners in draw order at the isocenter plane', () => {
    const c = beamPortalCorners(ISO, JAW);
    expect(c).toHaveLength(4);
    expect(c[0]).toEqual({ x: ISO.x - 111.125, y: ISO.y - 152, z: ISO.z });
    expect(c[1]).toEqual({ x: ISO.x + 23.875, y: ISO.y - 152, z: ISO.z });
    expect(c[2]).toEqual({ x: ISO.x + 23.875, y: ISO.y + 52, z: ISO.z });
    expect(c[3]).toEqual({ x: ISO.x - 111.125, y: ISO.y + 52, z: ISO.z });
  });

  it('all corners lie in the isocenter plane (coplanar beams)', () => {
    const c = beamPortalCorners(ISO, JAW);
    for (const p of c) expect(p.z).toBe(ISO.z);
  });
});

describe('beamCentralAxisEnds', () => {
  it('source and distal sides are SAD on opposite sides of the isocenter', () => {
    const { sourceSide, distalSide } = beamCentralAxisEnds(ISO, SAD, 40);
    const mid = {
      x: (sourceSide.x + distalSide.x) / 2,
      y: (sourceSide.y + distalSide.y) / 2,
      z: (sourceSide.z + distalSide.z) / 2,
    };
    expect(mid.x).toBeCloseTo(ISO.x, 9);
    expect(mid.y).toBeCloseTo(ISO.y, 9);
    expect(mid.z).toBeCloseTo(ISO.z, 9);
    expect(Math.hypot(distalSide.x - sourceSide.x, distalSide.y - sourceSide.y)).toBeCloseTo(2 * SAD, 6);
  });
});
