import { describe, expect, it } from 'vitest';
import { DEMO_SCENARIOS, cloneScenario } from '@linksight/rf-engine';
import {
  decodeScenarioFromParam,
  encodeScenarioToParam,
} from '../src/lib/shareCodec';

describe('shareCodec URL serializer', () => {
  it('round-trips a complex Relay scenario faithfully including Unicode characters', () => {
    const scenario = cloneScenario(DEMO_SCENARIOS[0]!);
    scenario.tx.coords.lat = -6.91234;
    scenario.propagation.kFactor = 0.667;

    const encoded = encodeScenarioToParam(scenario);
    const decoded = decodeScenarioFromParam(encoded);

    expect(decoded).not.toBeNull();
    expect(decoded!.name).toBe(scenario.name);
    expect(decoded!.mode).toBe('relay');
    expect(decoded!.tx.coords.lat).toBeCloseTo(-6.91234, 5);
    expect(decoded!.propagation.kFactor).toBeCloseTo(0.667, 3);
  });

  it('rejects malformed, oversized, or missing-field payloads cleanly', () => {
    expect(decodeScenarioFromParam('')).toBeNull();
    expect(decodeScenarioFromParam('%%%invalid-base64%%%')).toBeNull();
    expect(decodeScenarioFromParam('x'.repeat(20_000))).toBeNull();

    const badObj = Buffer.from(JSON.stringify({ hello: 'world' })).toString(
      'base64url',
    );
    expect(decodeScenarioFromParam(badObj)).toBeNull();
  });

  it('clamps out-of-bounds coordinates and invalid cable types', () => {
    const scenario = cloneScenario(DEMO_SCENARIOS[1]!);
    const tampered = {
      ...scenario,
      tx: {
        ...scenario.tx,
        coords: { lat: 250, lng: -400 },
        cableType: 'UNKNOWN_CABLE',
      },
    };
    const encoded = Buffer.from(JSON.stringify(tampered)).toString('base64url');
    const decoded = decodeScenarioFromParam(encoded);

    expect(decoded).not.toBeNull();
    expect(decoded!.tx.coords.lat).toBe(85);
    expect(decoded!.tx.coords.lng).toBe(-180);
    expect(decoded!.tx.cableType).toBe('LDF4-50A');
  });
});
