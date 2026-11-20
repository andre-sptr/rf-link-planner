import { describe, expect, it } from 'vitest';
import {
  DEMO_SCENARIOS,
  analyzeScenario,
  cloneScenario,
  generateSyntheticElevationM,
  sampleGreatCirclePath,
} from '@linksight/rf-engine';
import { buildSiteSurveyPdfDoc } from '../src/lib/pdfReport';

describe('pdfReport generator', () => {
  it('generates valid multi-page PDF bytes for Relay and PtP scenarios', () => {
    for (const base of [DEMO_SCENARIOS[0]!, DEMO_SCENARIOS[1]!]) {
      const scenario = cloneScenario(base);
      const count = scenario.propagation.sampleCount;

      const makeElev = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) =>
        sampleGreatCirclePath(a, b, count).map((p) =>
          generateSyntheticElevationM(p.lat, p.lng),
        );

      const elevations =
        scenario.mode === 'relay'
          ? {
              hop1: makeElev(scenario.tx.coords, scenario.repeater.coords),
              hop2: makeElev(scenario.repeater.coords, scenario.rx.coords),
              direct: makeElev(scenario.tx.coords, scenario.rx.coords),
            }
          : {
              direct: makeElev(scenario.tx.coords, scenario.rx.coords),
            };

      const analysis = analyzeScenario(scenario, elevations);
      const doc = buildSiteSurveyPdfDoc({
        scenario,
        analysis,
        elevationSource: 'srtm30m',
        generatedAt: new Date('2026-11-20T12:00:00Z'),
      });

      const raw = doc.output('arraybuffer');
      const header = new TextDecoder().decode(new Uint8Array(raw.slice(0, 7)));
      expect(header).toBe('%PDF-1.');
      expect(raw.byteLength).toBeGreaterThan(2000);
      expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(2);
    }
  });
});
