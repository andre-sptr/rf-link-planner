import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { DEMO_SCENARIOS, cloneScenario } from '@linksight/rf-engine';
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
    // ignore in environments without storage file
  }
});

describe('LinkSight RF workbench App', () => {
  it('renders default Relay scenario, switches to PtP, and opens native RF Math dialog', () => {
    mockElevationFetch();

    render(<App />);

    expect(screen.getByText('LinkSight RF')).toBeTruthy();
    expect(screen.getByText('Direct Path vs. Repeater Relay')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Point-to-Point' }));
    expect(screen.queryByText('Direct Path vs. Repeater Relay')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /RF Math/i }));
    expect(
      screen.getByText('RF Engineering Equations & DEM Methodology'),
    ).toBeTruthy();

    fireEvent.click(screen.getByRole('tab', { name: 'Link Budget' }));
    expect(
      screen.getByText('Free Space Path Loss (FSPL)'),
    ).toBeTruthy();
  });

  it('allows clearing and retyping numeric fields without snapping back or zeroing coordinates', () => {
    mockElevationFetch();

    render(<App />);

    const txTower = screen.getByLabelText('Tower (m)', {
      selector: '#site-tx-agl',
    }) as HTMLInputElement;
    fireEvent.focus(txTower);
    fireEvent.change(txTower, { target: { value: '' } });
    expect(txTower.value).toBe('');
    fireEvent.change(txTower, { target: { value: '55' } });
    fireEvent.blur(txTower);
    expect(txTower.value).toBe('55');

    const txLat = screen.getByLabelText('Lat (°)', {
      selector: '#site-tx-lat',
    }) as HTMLInputElement;
    const initialLat = txLat.value;
    fireEvent.focus(txLat);
    fireEvent.change(txLat, { target: { value: '' } });
    fireEvent.blur(txLat);
    // Clearing latitude on blur safely restores previous valid coordinate instead of zeroing to 0
    expect(txLat.value).toBe(initialLat);
  });

  it('supports independent Repeater hardware tuning including connector and duplexer losses', () => {
    mockElevationFetch();

    render(<App />);

    fireEvent.click(screen.getByRole('tab', { name: 'Radio & Model' }));

    // Select Repeater scope
    fireEvent.click(screen.getByRole('button', { name: 'Repeater' }));

    const gainInput = screen.getByLabelText('Antenna Gain (dBi)') as HTMLInputElement;
    const connInput = screen.getByLabelText('Connector Loss (dB)') as HTMLInputElement;
    const dupInput = screen.getByLabelText('Duplexer Loss (dB)') as HTMLInputElement;

    fireEvent.focus(gainInput);
    fireEvent.change(gainInput, { target: { value: '14' } });
    fireEvent.blur(gainInput);

    fireEvent.focus(connInput);
    fireEvent.change(connInput, { target: { value: '1.2' } });
    fireEvent.blur(connInput);

    fireEvent.focus(dupInput);
    fireEvent.change(dupInput, { target: { value: '2.5' } });
    fireEvent.blur(dupInput);

    // Switch to Link Budget for Hop 1 (TX -> Repeater) and confirm Repeater RX gain & losses appear
    fireEvent.click(screen.getByRole('tab', { name: 'Link Budget' }));
    expect(screen.getByText('+14.00 dB')).toBeTruthy();
    expect(screen.getByText('-3.70 dB')).toBeTruthy();
  });

  it('treats malicious HTML payloads in shared ?s= site names as plain text (no DOM XSS)', () => {
    mockElevationFetch();

    const tampered = cloneScenario(DEMO_SCENARIOS[1]!);
    tampered.tx.name = '<img src=x onerror=alert(1)>';
    const param = encodeScenarioToParam(tampered);
    window.history.replaceState(null, '', `?s=${param}`);

    const { container } = render(<App />);
    expect(container.querySelector('img[src="x"]')).toBeNull();
    const txNameInput = screen.getByLabelText('Site Label', {
      selector: '#site-tx-name',
    }) as HTMLInputElement;
    expect(txNameInput.value).toBe('<img src=x onerror=alert(1)>');
  });

  it('updates Fade Margin KPI color threshold dynamically when Target Fade Margin changes', () => {
    mockElevationFetch();

    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: 'Point-to-Point' }));
    fireEvent.click(screen.getByRole('tab', { name: 'Radio & Model' }));

    const targetInput = screen.getByLabelText('Target (dB)') as HTMLInputElement;
    fireEvent.focus(targetInput);
    fireEvent.change(targetInput, { target: { value: '45' } });
    fireEvent.blur(targetInput);

    const fadeMarginLabel = screen.getByText('Fade Margin');
    const fadeMarginVal = fadeMarginLabel.nextElementSibling as HTMLElement;
    expect(fadeMarginVal.style.color).toBe('var(--status-marginal)');
  });
});
