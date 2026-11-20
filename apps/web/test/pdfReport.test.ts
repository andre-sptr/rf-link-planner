import { describe, expect, it } from 'vitest';
import {
  DEMO_SCENARIOS,
  analyzeScenario,
  cloneScenario,
  generateSyntheticElevationM,
  sampleGreatCirclePath,
} from '@linksight/rf-engine';
import {
  buildSiteSurveyPdfDoc,
  resolveSvgCssVarsForPrint,
  sanitizePdfText,
} from '../src/lib/pdfReport';

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
        chartHopLabel: analysis.hops[0]!.label,
        generatedAt: new Date('2026-11-20T12:00:00Z'),
      });

      const raw = doc.output('arraybuffer');
      const header = new TextDecoder().decode(new Uint8Array(raw.slice(0, 7)));
      expect(header).toBe('%PDF-1.');
      expect(raw.byteLength).toBeGreaterThan(2000);
      expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(2);
    }
  });

  it('resolves CSS custom properties inside cloned SVG for print export', () => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    const poly = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    poly.setAttribute('fill', 'var(--terrain-fill)');
    poly.setAttribute('stroke', 'var(--accent)');
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('fill', 'var(--status-fail)');
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    text.setAttribute('class', 'font-mono-num');
    text.setAttribute('fill', 'var(--text-secondary)');
    text.textContent = '100m';

    svg.appendChild(poly);
    svg.appendChild(circle);
    svg.appendChild(text);

    const resolved = resolveSvgCssVarsForPrint(svg, 800, 240);
    const serialized = new XMLSerializer().serializeToString(resolved);

    expect(serialized).not.toContain('var(--');
    expect(serialized).toContain('#cbd5e1');
    expect(serialized).toContain('#026498');
    expect(serialized).toContain('#c81e1e');
    expect(serialized).toContain('#475569');
    expect(serialized).toContain('Courier New');
  });

  it('sanitizes non-WinAnsi Unicode glyphs cleanly for Helvetica PDF text', () => {
    const clean = sanitizePdfText('TX → RX | ν = 0.42 | ≥ 60% F1 – note ≈ OK');
    expect(clean).toBe('TX -> RX | nu = 0.42 | >= 60% F1 - note ~ OK');
  });
});
