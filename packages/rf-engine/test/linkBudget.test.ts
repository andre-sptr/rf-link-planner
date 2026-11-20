import { describe, expect, it } from 'vitest';
import {
  DEMO_SCENARIOS,
  analyzeHop,
  analyzeScenario,
  calculateCableLossDb,
  calculateFsplDb,
  calculateOkumuraHataLossDb,
  cloneScenario,
  dbmToWatts,
  wattsToDbm,
} from '../src/index.js';

describe('propagation and link budget solver', () => {
  it('computes FSPL at 10 km @ 1000 MHz accurately', () => {
    const fspl = calculateFsplDb(10, 1000);
    expect(fspl).toBeCloseTo(112.44, 1);
  });

  it('computes frequency-dependent cable losses and W <-> dBm conversions', () => {
    expect(wattsToDbm(40)).toBeCloseTo(46.02, 1);
    expect(dbmToWatts(46)).toBeCloseTo(39.81, 1);
    expect(calculateCableLossDb('INTEGRATED', 50, 5800)).toBe(0);

    const ldf4 = calculateCableLossDb('LDF4-50A', 30, 450);
    const rg58 = calculateCableLossDb('RG-58', 30, 450);
    expect(ldf4).toBeGreaterThan(1);
    expect(ldf4).toBeLessThan(3);
    expect(rg58).toBeGreaterThan(ldf4 * 4);
  });

  it('emits domain warnings for out-of-range Okumura-Hata parameters without NaN', () => {
    const res = calculateOkumuraHataLossDb({
      distanceKm: 0.4,
      frequencyMhz: 5800,
      txHeightM: 15,
      rxHeightM: 25,
      environment: 'urban',
    });
    expect(Number.isFinite(res.lossDb)).toBe(true);
    expect(res.variant).toBe('cost-231-hata');
    expect(res.warnings.length).toBeGreaterThanOrEqual(4);
  });

  it('handles identical TX and RX coordinates gracefully without NaN/Infinity', () => {
    const scenario = cloneScenario(DEMO_SCENARIOS[1]!);
    scenario.rx.coords = { ...scenario.tx.coords };
    const hop = analyzeHop(
      'direct',
      'Zero Dist',
      scenario.tx,
      scenario.rx,
      [20, 20],
      scenario.propagation,
    );
    expect(hop.verdict).toBe('invalid');
    expect(hop.distanceKm).toBe(0);
    expect(Number.isFinite(hop.fsplDb)).toBe(true);
    expect(Number.isFinite(hop.fadeMarginDb)).toBe(true);
    expect(hop.warnings.length).toBeGreaterThan(0);
  });

  it('evaluates relay bottleneck and improvement over obstructed direct path', () => {
    const scenario = cloneScenario(DEMO_SCENARIOS[0]!);
    const n = scenario.propagation.sampleCount;
    // Direct path crosses a 1600 m ridge, while Hop1 (678->1560) and Hop2 (1560->810) rise monotonically/slope cleanly
    const directElev = Array.from({ length: n }, (_, i) => {
      const f = i / (n - 1);
      return 700 + Math.sin(f * Math.PI) * 950;
    });
    const hop1Elev = Array.from({ length: n }, (_, i) => {
      const f = i / (n - 1);
      return 678 + f * (1560 - 678) - Math.sin(f * Math.PI) * 120;
    });
    const hop2Elev = Array.from({ length: n }, (_, i) => {
      const f = i / (n - 1);
      return 1560 + f * (810 - 1560) - Math.sin(f * Math.PI) * 100;
    });

    const result = analyzeScenario(scenario, {
      direct: directElev,
      hop1: hop1Elev,
      hop2: hop2Elev,
    });

    expect(result.mode).toBe('relay');
    expect(result.overallVerdict).toBe('pass');
    expect(result.directReference?.verdict).toBe('fail');
    expect(result.relayComparison?.fadeMarginGainDb).toBeGreaterThan(15);
    expect(result.relayComparison?.clearanceGainPercent).toBeGreaterThan(100);
  });
});
