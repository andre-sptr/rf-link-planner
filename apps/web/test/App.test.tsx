import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { App } from '../src/App';

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
});

describe('LinkSight RF workbench App', () => {
  it('renders default Relay scenario, switches to PtP, and opens native RF Math dialog', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url, init) => {
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

    render(<App />);

    expect(screen.getByText('LinkSight RF')).toBeTruthy();
    expect(screen.getByText('Direct Path vs. Repeater Relay')).toBeTruthy();

    // Switch topology mode to Point-to-Point
    fireEvent.click(screen.getByRole('button', { name: 'Point-to-Point' }));
    expect(screen.queryByText('Direct Path vs. Repeater Relay')).toBeNull();

    // Open RF Math modal dialog
    fireEvent.click(screen.getByRole('button', { name: /RF Math/i }));
    expect(
      screen.getByText('RF Engineering Equations & DEM Methodology'),
    ).toBeTruthy();

    // Switch inspector tab to Link Budget
    fireEvent.click(screen.getByRole('tab', { name: 'Link Budget' }));
    expect(
      screen.getByText('Free Space Path Loss (FSPL)'),
    ).toBeTruthy();
  });
});
