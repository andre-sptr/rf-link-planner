import { describe, expect, it } from 'vitest';
import {
  analyzeFresnelProfile,
  calculateBearingDeg,
  calculateDistanceKm,
  calculateEarthBulgeM,
  calculateFresnelRadiusM,
  calculateGreatCircleMidpoint,
  calculateKnifeEdgeLossDb,
  sampleGreatCirclePath,
} from '../src/index.js';

describe('geodesy and Fresnel math', () => {
  it('computes textbook midpoint 1st Fresnel radius for 10 km @ 450 MHz', () => {
    const f1 = calculateFresnelRadiusM(5, 5, 450, 1);
    expect(f1).toBeCloseTo(40.81, 1);
  });

  it('computes midpoint Earth curvature bulge for 20 km at k=4/3', () => {
    const bulge = calculateEarthBulgeM(10, 10, 4 / 3);
    expect(bulge).toBeCloseTo(5.89, 1);
  });

  it('computes ITU-R P.526 knife-edge diffraction loss at key nu benchmarks', () => {
    expect(calculateKnifeEdgeLossDb(-1.0)).toBe(0);
    expect(calculateKnifeEdgeLossDb(-0.78)).toBe(0);
    expect(calculateKnifeEdgeLossDb(0)).toBeCloseTo(6.03, 2);
    expect(calculateKnifeEdgeLossDb(1.0)).toBeCloseTo(13.93, 2);
  });

  it('calculates bearing and zero-distance safely', () => {
    const a = { lat: -6.9, lng: 107.6 };
    expect(calculateDistanceKm(a, a)).toBe(0);
    expect(calculateBearingDeg(a, a)).toBe(0);
    expect(sampleGreatCirclePath(a, a, 10)).toHaveLength(10);

    const north = { lat: -5.9, lng: 107.6 };
    expect(calculateBearingDeg(a, north)).toBeCloseTo(0, 1);

    const east = { lat: 0, lng: 1 };
    expect(calculateBearingDeg({ lat: 0, lng: 0 }, east)).toBeCloseTo(90, 1);
  });

  it('recommends tower height adjustments that restore >= 60% F1 clearance', () => {
    const tx = { lat: 0, lng: 0 };
    const rx = { lat: 0, lng: 0.089932 }; // ~10 km east
    const path = sampleGreatCirclePath(tx, rx, 21);
    // Flat valley at 100 m except midpoint peak at 160 m ASL
    const elevations = path.map((_, i) => (i === 10 ? 160 : 100));

    const initial = analyzeFresnelProfile(path, elevations, 20, 20, 450, 4 / 3, 0);
    expect(initial.minClearanceRatio).toBeLessThan(0);
    expect(initial.heightAdvisor.needed).toBe(true);
    expect(initial.heightAdvisor.extraBalancedM).toBeGreaterThan(60);

    const extra = initial.heightAdvisor.extraBalancedM;
    const fixed = analyzeFresnelProfile(
      path,
      elevations,
      20 + extra,
      20 + extra,
      450,
      4 / 3,
      0,
    );
    expect(fixed.minClearanceRatio).toBeGreaterThanOrEqual(0.6);
    expect(fixed.heightAdvisor.needed).toBe(false);
  });

  it('marks infeasible single-end tower recommendations as null near endpoints', () => {
    const tx = { lat: 0, lng: 0 };
    const rx = { lat: 0, lng: 0.089932 }; // ~10 km
    const path = sampleGreatCirclePath(tx, rx, 41); // step fraction = 0.025
    const elevations = path.map((_, i) => (i === 1 ? 180 : 100)); // obstruction at fraction 0.025

    const res = analyzeFresnelProfile(path, elevations, 20, 20, 450, 4 / 3, 0);
    expect(res.heightAdvisor.needed).toBe(true);
    expect(res.heightAdvisor.extraBalancedM).toBeGreaterThan(0);
    expect(res.heightAdvisor.extraRxOnlyM).toBeNull();
    expect(res.heightAdvisor.extraTxOnlyM).not.toBeNull();
  });

  it('computes spherical great-circle midpoint safely', () => {
    const a = { lat: -6.9475, lng: 107.6191 };
    const b = { lat: -6.565, lng: 107.762 };
    const mid = calculateGreatCircleMidpoint(a, b);
    expect(mid.lat).toBeGreaterThan(-6.9475);
    expect(mid.lat).toBeLessThan(-6.565);
    expect(mid.lng).toBeGreaterThan(107.6191);
    expect(mid.lng).toBeLessThan(107.762);

    const same = calculateGreatCircleMidpoint(a, a);
    expect(same.lat).toBeCloseTo(a.lat, 4);
    expect(same.lng).toBeCloseTo(a.lng, 4);
  });
});
