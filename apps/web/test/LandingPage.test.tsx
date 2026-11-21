import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { DEMO_SCENARIOS } from '@linksight/rf-engine';
import { encodeScenarioToParam } from '../src/lib/shareCodec';
import { App } from '../src/App';

function mockElevationFetch() {
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
    const body = init?.body ? JSON.parse(String(init.body)) : { points: [] };
    const elevations = (body.points as Array<unknown>).map(() => 450);
    return new Response(
      JSON.stringify({
        elevations,
        source: 'srtm30m',
        cacheHitRatio: 0,
        degraded: false,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  });
}

beforeAll(() => {
  window.scrollTo = vi.fn();
  if (typeof window.matchMedia !== 'function') {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  }

  if (typeof HTMLDialogElement !== 'undefined') {
    if (!HTMLDialogElement.prototype.showModal) {
      HTMLDialogElement.prototype.showModal = function showModal() {
        this.setAttribute('open', '');
      };
    }
    if (!HTMLDialogElement.prototype.close) {
      HTMLDialogElement.prototype.close = function close() {
        this.removeAttribute('open');
        this.dispatchEvent(new Event('close'));
      };
    }
  }
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  window.history.replaceState(null, '', '/');
  try {
    window.localStorage.clear();
  } catch {
    // ignore storage errors
  }
});

describe('LinkSight RF Felt-style Landing Page', () => {
  it('renders the landing page at / with single h1, datum strip, 4 corridors, and 5 FAQs', () => {
    window.history.replaceState(null, '', '/');
    render(<App />);

    const h1 = screen.getByRole('heading', { level: 1 });
    expect(h1.textContent).toMatch(/The RF terrain workbench your links run on/i);

    expect(screen.getAllByText(/WGS84 \/ SRTM 30M/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Jakarta – Depok 5.8 GHz')).toBeTruthy();
    expect(screen.getByText('Sumatra VHF Telemetry')).toBeTruthy();

    const details = document.querySelectorAll('details.ls-faq-item');
    expect(details.length).toBe(5);

    const feltLink = screen.getByRole('link', { name: 'felt.com' });
    expect(feltLink.getAttribute('href')).toBe('https://felt.com');
    expect(feltLink.getAttribute('target')).toBe('_blank');
    expect(feltLink.getAttribute('rel')).toContain('noopener');
  });

  it('recomputes live Fresnel & link metrics in the interactive showcase preview', () => {
    window.history.replaceState(null, '', '/');
    render(<App />);

    const slider = screen.getByLabelText(/Antenna Height \(AGL\)/i) as HTMLInputElement;
    expect(slider.value).toBe('30');

    // Switch preview topology from Repeater Relay to obstructed Point-to-Point
    const ptpBtn = screen.getByRole('button', { name: 'Point-to-Point' });
    fireEvent.click(ptpBtn);
    expect(screen.getByText(/Tower Height Advisor:/i)).toBeTruthy();

    // Drag antenna height slider
    fireEvent.change(slider, { target: { value: '60' } });
    expect(screen.getByText('60 m')).toBeTruthy();
  });

  it('navigates to /planner when clicking Open RF Workbench CTA', async () => {
    mockElevationFetch();
    window.history.replaceState(null, '', '/');
    render(<App />);

    const ctaLinks = screen.getAllByRole('link', { name: /Open RF Workbench/i });
    fireEvent.click(ctaLinks[0]!);

    expect(window.location.pathname).toBe('/planner');
    expect(await screen.findByText('Direct Path vs. Repeater Relay')).toBeTruthy();
  });

  it('loads the selected corridor preset when clicking a corridor card', async () => {
    mockElevationFetch();
    window.history.replaceState(null, '', '/');
    render(<App />);

    const jakartaCard = screen.getByRole('link', {
      name: /Jakarta – Depok 5\.8 GHz/i,
    });
    fireEvent.click(jakartaCard);

    expect(window.location.pathname).toBe('/planner');
    expect(window.location.search).toBe('?preset=jakarta-depok-58ghz');

    const txNameInput = (await screen.findByLabelText('Site Label', {
      selector: '#site-tx-name',
    })) as HTMLInputElement;
    expect(txNameInput.value).toBe('Kuningan Rooftop Mast');
  });

  it('preserves backwards-compatible /?s= share URLs by mounting the workbench directly', async () => {
    mockElevationFetch();
    const param = encodeScenarioToParam(DEMO_SCENARIOS[2]!);
    window.history.replaceState(null, '', `/?s=${param}`);

    render(<App />);
    const txNameInput = (await screen.findByLabelText('Site Label', {
      selector: '#site-tx-name',
    })) as HTMLInputElement;
    expect(txNameInput.value).toBe('Pekanbaru Hub Mast');
  });
});
