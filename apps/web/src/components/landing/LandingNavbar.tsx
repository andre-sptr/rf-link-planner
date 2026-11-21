import { useEffect, useRef } from 'react';
import { Menu } from 'lucide-react';
import { BrandTowerIcon } from '../BrandTowerIcon';
import {
  formatBearing,
  formatLatDms,
  formatLonDms,
  type EvaluatedLandingScenario,
} from './landingScenarios';

export interface LandingNavbarProps {
  activeScenario: EvaluatedLandingScenario;
  onNavigate: (to: string) => void;
}

const NAV_LINKS = [
  { href: '#workbench', label: 'Workbench' },
  { href: '#capabilities', label: 'RF Engine' },
  { href: '#corridors', label: 'Corridors' },
  { href: '#architecture', label: 'Architecture' },
  { href: '#faq', label: 'FAQ' },
];

export function LandingNavbar({
  activeScenario,
  onNavigate,
}: LandingNavbarProps) {
  const headerRef = useRef<HTMLElement | null>(null);
  const innerRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLUListElement | null>(null);
  const isWideRef = useRef<boolean | null>(null);
  const lastCollapsedWidthRef = useRef(0);

  useEffect(() => {
    if (
      typeof HTMLElement !== 'undefined' &&
      !Object.hasOwn(HTMLElement.prototype, 'popover') &&
      typeof window !== 'undefined' &&
      typeof window.CSS?.escape === 'function'
    ) {
      void import('@oddbird/popover-polyfill').catch(() => {});
    }

    const header = headerRef.current;
    const inner = innerRef.current;
    const menu = menuRef.current;
    if (!header || !inner || !menu) return;

    const measure = () => {
      const currentWidth = header.getBoundingClientRect().width;
      if (
        isWideRef.current === false &&
        currentWidth <= lastCollapsedWidthRef.current
      ) {
        return;
      }

      const wasPopoverOpen =
        !isWideRef.current &&
        typeof menu.matches === 'function' &&
        (menu.matches(':popover-open') || menu.classList.contains(':popover-open'));

      header.classList.add('is-measuring');
      header.classList.add('is-wide');
      menu.removeAttribute('popover');

      const wide = inner.scrollWidth <= inner.clientWidth;
      isWideRef.current = wide;

      if (wide) {
        header.classList.add('is-wide');
        menu.removeAttribute('popover');
      } else {
        lastCollapsedWidthRef.current = currentWidth;
        header.classList.remove('is-wide');
        menu.setAttribute('popover', 'auto');
        if (wasPopoverOpen && typeof menu.showPopover === 'function') {
          try {
            menu.showPopover();
          } catch {
            // ignore if polyfill not yet attached
          }
        }
      }

      window.requestAnimationFrame(() => {
        header.classList.remove('is-measuring');
      });
    };

    measure();

    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => {
      measure();
    });
    ro.observe(header);
    ro.observe(menu);

    return () => {
      ro.disconnect();
    };
  }, []);

  const handleRouteClick = (
    e: React.MouseEvent<HTMLAnchorElement>,
    to: string,
  ) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    onNavigate(to);
  };

  const handleAnchorClick = () => {
    const menu = menuRef.current;
    if (
      menu &&
      !isWideRef.current &&
      typeof menu.hidePopover === 'function' &&
      (menu.matches(':popover-open') || menu.classList.contains(':popover-open'))
    ) {
      try {
        menu.hidePopover();
      } catch {
        // ignore if already closed
      }
    }
  };

  const { scenario, bearingDeg, scaleLabel } = activeScenario;

  return (
    <>
      {/* Top Cartographic Datum Bar */}
      <div className="ls-datum-strip" aria-label="Active coordinate datum">
        <div className="ls-datum-inner">
          <div className="flex items-center gap-x-4 gap-y-1 flex-wrap">
            <span>
              <span className="ls-datum-label">LAT </span>
              <span>{formatLatDms(scenario.tx.coords.lat)}</span>
            </span>
            <span>
              <span className="ls-datum-label">LON </span>
              <span>{formatLonDms(scenario.tx.coords.lng)}</span>
            </span>
            <span className="hidden sm:inline">
              <span className="ls-datum-label">AZM </span>
              <span>{formatBearing(bearingDeg)}</span>
            </span>
            <span className="hidden md:inline">
              <span className="ls-datum-label">FREQ </span>
              <span>{scenario.propagation.frequencyMhz} MHz</span>
            </span>
          </div>

          <div className="flex items-center gap-4 shrink-0">
            <span className="hidden sm:inline">
              <span className="ls-datum-label">CRS </span>
              <span>WGS84 / SRTM 30M</span>
            </span>
            <div className="flex items-center gap-2" aria-hidden="true">
              <span className="inline-flex h-[5px] w-14 border border-[#a3a29b]">
                <span className="w-1/4 bg-[#f4f2ea]" />
                <span className="w-1/4 bg-transparent" />
                <span className="w-1/4 bg-[#f4f2ea]" />
                <span className="w-1/4 bg-transparent" />
              </span>
              <span>{scaleLabel}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Sticky Editorial Navigation Header */}
      <header ref={headerRef} className="ls-header is-wide">
        <div ref={innerRef} className="ls-header-inner">
          <a
            href="/"
            onClick={(e) => handleRouteClick(e, '/')}
            className="flex items-center gap-2.5 no-underline shrink-0"
            style={{ color: 'var(--ls-ink)' }}
            aria-label="LinkSight RF home"
          >
            <BrandTowerIcon className="w-7 h-7 shrink-0" />
            <span
              className="ls-display text-[22px] font-semibold tracking-[-0.02em] leading-none"
              style={{ color: 'var(--ls-ink)' }}
            >
              LinkSight
            </span>
          </a>

          <nav className="ls-header-nav" aria-label="Primary">
            <button
              className="ls-menu-button"
              type="button"
              popoverTarget="ls-site-menu"
              popoverTargetAction="toggle"
              aria-controls="ls-site-menu"
            >
              <Menu className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span className="sr-only sm:not-sr-only">Menu</span>
            </button>

            <ul id="ls-site-menu" ref={menuRef} className="ls-nav-menu">
              {NAV_LINKS.map((item) => (
                <li key={item.href}>
                  <a href={item.href} onClick={handleAnchorClick}>
                    {item.label}
                  </a>
                </li>
              ))}
              <li className="ls-mobile-only-item">
                <a
                  href="/planner?dialog=formulas"
                  onClick={(e) => {
                    handleAnchorClick();
                    handleRouteClick(e, '/planner?dialog=formulas');
                  }}
                >
                  RF Math &amp; Equations
                </a>
              </li>
            </ul>
          </nav>

          <div className="flex items-center gap-2 shrink-0">
            <a
              href="/planner?dialog=formulas"
              onClick={(e) => handleRouteClick(e, '/planner?dialog=formulas')}
              className="ls-btn-secondary ls-btn-sm hidden sm:inline-flex"
            >
              RF Math
            </a>
            <a
              href="/planner"
              onClick={(e) => handleRouteClick(e, '/planner')}
              className="ls-btn-primary ls-btn-sm"
            >
              Open Workbench
            </a>
          </div>
        </div>
      </header>
    </>
  );
}
