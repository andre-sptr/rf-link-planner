import { useEffect, useMemo } from 'react';
import { ArrowDown, ArrowRight, Radio } from 'lucide-react';
import { DEMO_SCENARIOS } from '@linksight/rf-engine';
import heroTopoMapUrl from '../../assets/landing/hero-topo-map.webp';
import {
  evaluateLandingScenario,
  verdictLabel,
  type EvaluatedLandingScenario,
} from './landingScenarios';

export interface HeroSectionProps {
  activeIdx: number;
  onSelectIdx: (idx: number) => void;
  onNavigate: (to: string) => void;
}

const HERO_INSIGHTS: Record<string, string> = {
  'bandung-lembang-relay':
    'Does Bukit Tunggul Ridge clear the northern Bandung mountain wall for sub-valley UHF telemetry?',
  'pekanbaru-rumbai-uhf':
    'Check 452.5 MHz 1st Fresnel clearance across the Siak River basin with suburban canopy clutter.',
  'sumatra-vhf-telemetry':
    'Evaluate a 32 km 152.5 MHz VHF telemetry hop under k = 4/3 atmospheric refraction.',
  'jakarta-depok-58ghz':
    'Size 5.8 GHz microwave backhaul clearance and 4 dB tropical rain margin from Kuningan to Depok.',
};

export function HeroSection({
  activeIdx,
  onSelectIdx,
  onNavigate,
}: HeroSectionProps) {
  useEffect(() => {
    if (
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    ) {
      return;
    }
    const timer = window.setInterval(() => {
      onSelectIdx((activeIdx + 1) % DEMO_SCENARIOS.length);
    }, 6500);
    return () => window.clearInterval(timer);
  }, [activeIdx, onSelectIdx]);

  const evaluated: EvaluatedLandingScenario = useMemo(() => {
    const preset = DEMO_SCENARIOS[activeIdx] ?? DEMO_SCENARIOS[0]!;
    return evaluateLandingScenario(preset.id);
  }, [activeIdx]);

  const { scenario, analysis, distanceKm, bandBadge, shortTitle } = evaluated;
  const insight = HERO_INSIGHTS[scenario.id] ?? scenario.description;
  const isRelay = scenario.mode === 'relay';
  const primaryVerdict = analysis.overallVerdict;
  const clearancePct = Math.round(analysis.bottleneckClearanceRatio * 100);

  const verdictColor =
    primaryVerdict === 'pass'
      ? 'var(--ls-pass)'
      : primaryVerdict === 'marginal'
        ? 'var(--ls-marginal)'
        : 'var(--ls-fail)';

  const verdictBg =
    primaryVerdict === 'pass'
      ? 'var(--ls-pass-bg)'
      : primaryVerdict === 'marginal'
        ? 'var(--ls-marginal-bg)'
        : 'var(--ls-fail-bg)';

  const handleRouteClick = (
    e: React.MouseEvent<HTMLAnchorElement>,
    to: string,
  ) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    onNavigate(to);
  };

  return (
    <section className="ls-hero-section">
      <div className="ls-container">
        <div className="ls-hero-grid">
          {/* Left Editorial Column */}
          <div className="relative z-10 max-w-[560px]">
            <span className="ls-kicker">RF Spatial Engineering</span>
            <h1 className="ls-display text-[clamp(2.55rem,4.7vw,4.55rem)] leading-[1.03] tracking-[-0.025em] text-[var(--ls-ink)] m-0">
              The RF terrain workbench your links run on
            </h1>
            <p className="ls-lede mt-5 max-w-[46ch]">
              Plot sites over real SRTM terrain, verify{' '}
              <mark className="ls-brush">1st Fresnel clearance</mark>, and
              compare single-repeater relays directly in your browser.
            </p>

            <div className="mt-7 flex flex-wrap items-center gap-3">
              <a
                href="/planner"
                onClick={(e) => handleRouteClick(e, '/planner')}
                className="ls-btn-primary"
              >
                <span>Open RF Workbench</span>
                <ArrowRight className="w-4 h-4 shrink-0" aria-hidden="true" />
              </a>
              <a href="#workbench" className="ls-btn-secondary">
                <span>Explore live demo</span>
                <ArrowDown className="w-4 h-4 shrink-0" aria-hidden="true" />
              </a>
            </div>

            {/* Corridor Selector Dots */}
            <div className="mt-9 flex items-center gap-3">
              <div
                className="flex items-center gap-2"
                role="group"
                aria-label="Featured RF corridors"
              >
                {DEMO_SCENARIOS.map((item, idx) => {
                  const isActive = idx === activeIdx;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onSelectIdx(idx)}
                      aria-label={`Show ${item.name}`}
                      aria-current={isActive ? 'true' : undefined}
                      className="h-2 rounded-full border-0 cursor-pointer transition-[width,background-color] duration-200"
                      style={{
                        width: isActive ? '22px' : '7px',
                        backgroundColor: isActive
                          ? 'var(--ls-ink)'
                          : 'var(--ls-line-2)',
                      }}
                    />
                  );
                })}
              </div>

              <span className="ls-mono text-[11px] tracking-[0.04em] text-[var(--ls-dim)] truncate">
                {shortTitle}
              </span>
            </div>
          </div>

          {/* Right Watercolor Cartographic Stage + Floating RF Cards */}
          <div className="relative min-h-[360px] sm:min-h-[450px] lg:min-h-[520px] flex items-center justify-center">
            {/* Feathered Editorial Watercolor Plate */}
            <div className="relative w-full max-w-[780px] select-none">
              <img
                src={heroTopoMapUrl}
                alt="Editorial cartographic watercolor relief showing volcanic ridge contours, valley settlements, and river corridor"
                width={1400}
                height={940}
                fetchPriority="high"
                decoding="async"
                className="ls-feather-map w-full h-auto block pointer-events-none"
              />

              {/* Crisp Vector RF Overlay plotted over the terrain */}
              <svg
                viewBox="0 0 700 466"
                className="absolute inset-0 w-full h-full pointer-events-none"
                aria-hidden="true"
              >
                {/* Geodesic corridor path depending on relay vs PtP */}
                {isRelay ? (
                  <>
                    {/* Obstructed Direct Reference */}
                    <line
                      x1="158"
                      y1="322"
                      x2="528"
                      y2="148"
                      stroke="#b52b27"
                      strokeWidth="2.2"
                      strokeDasharray="6 5"
                      strokeOpacity="0.82"
                    />
                    {/* Clear Hop 1: TX -> Ridge RPT */}
                    <line
                      x1="158"
                      y1="322"
                      x2="342"
                      y2="162"
                      stroke="#14744e"
                      strokeWidth="2.8"
                    />
                    {/* Clear Hop 2: Ridge RPT -> RX */}
                    <line
                      x1="342"
                      y1="162"
                      x2="528"
                      y2="148"
                      stroke="#14744e"
                      strokeWidth="2.8"
                    />
                    {/* Fresnel envelope hint on Hop 1 */}
                    <ellipse
                      cx="250"
                      cy="242"
                      rx="118"
                      ry="18"
                      transform="rotate(-41 250 242)"
                      fill="rgb(20 116 78 / 0.12)"
                      stroke="#14744e"
                      strokeWidth="1"
                      strokeDasharray="3 3"
                    />
                    {/* Direct obstruction X on mountain wall */}
                    <circle
                      cx="322"
                      cy="245"
                      r="11"
                      fill="#ffffff"
                      stroke="#b52b27"
                      strokeWidth="2"
                    />
                    <path
                      d="M318 241 L326 249 M326 241 L318 249"
                      stroke="#b52b27"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                    {/* RPT Pin */}
                    <circle
                      cx="342"
                      cy="162"
                      r="17"
                      fill="rgb(217 119 6 / 0.16)"
                    />
                    <circle
                      cx="342"
                      cy="162"
                      r="8"
                      fill="#d97706"
                      stroke="#ffffff"
                      strokeWidth="2.4"
                    />
                    <rect
                      x="317"
                      y="133"
                      width="50"
                      height="18"
                      rx="9"
                      fill="#1c1b18"
                    />
                    <text
                      x="342"
                      y="145"
                      textAnchor="middle"
                      fill="#f4f2ea"
                      fontSize="9.5"
                      fontWeight="600"
                      fontFamily="IBM Plex Mono, monospace"
                    >
                      RPT
                    </text>
                  </>
                ) : (
                  <>
                    <ellipse
                      cx="346"
                      cy="236"
                      rx="210"
                      ry="28"
                      transform="rotate(-24 346 236)"
                      fill="rgb(31 77 116 / 0.11)"
                      stroke="#1f4d74"
                      strokeWidth="1.1"
                      strokeDasharray="4 4"
                    />
                    <line
                      x1="158"
                      y1="322"
                      x2="528"
                      y2="148"
                      stroke="#1f4d74"
                      strokeWidth="2.8"
                    />
                  </>
                )}

                {/* TX Pin */}
                <circle
                  cx="158"
                  cy="322"
                  r="16"
                  fill="rgb(31 77 116 / 0.18)"
                />
                <circle
                  cx="158"
                  cy="322"
                  r="8"
                  fill="#1f4d74"
                  stroke="#ffffff"
                  strokeWidth="2.4"
                />
                <rect
                  x="139"
                  y="336"
                  width="38"
                  height="18"
                  rx="9"
                  fill="#1f4d74"
                />
                <text
                  x="158"
                  y="348"
                  textAnchor="middle"
                  fill="#ffffff"
                  fontSize="9.5"
                  fontWeight="600"
                  fontFamily="IBM Plex Mono, monospace"
                >
                  TX
                </text>

                {/* RX Pin */}
                <circle
                  cx="528"
                  cy="148"
                  r="16"
                  fill="rgb(20 116 78 / 0.16)"
                />
                <circle
                  cx="528"
                  cy="148"
                  r="8"
                  fill="#14744e"
                  stroke="#ffffff"
                  strokeWidth="2.4"
                />
                <rect
                  x="509"
                  y="162"
                  width="38"
                  height="18"
                  rx="9"
                  fill="#14744e"
                />
                <text
                  x="528"
                  y="174"
                  textAnchor="middle"
                  fill="#ffffff"
                  fontSize="9.5"
                  fontWeight="600"
                  fontFamily="IBM Plex Mono, monospace"
                >
                  RX
                </text>
              </svg>
            </div>

            {/* Floating Top-Right Telemetry Card (Felt signature white KPI card) */}
            <aside
              aria-label="Active scenario link summary"
              className="hidden sm:block absolute top-2 right-0 md:right-2 w-[252px] rounded-[6px] bg-[var(--ls-surface)] border border-[var(--ls-line)] p-4 z-10"
              style={{ boxShadow: 'var(--ls-shadow-card)' }}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-[13px] font-semibold text-[var(--ls-ink)] leading-snug">
                    {shortTitle}
                  </div>
                  <div className="ls-mono text-[10px] tracking-[0.04em] text-[var(--ls-dim)] mt-0.5">
                    {bandBadge}
                  </div>
                </div>
                <span
                  className="ls-mono text-[10px] font-semibold px-1.5 py-0.5 rounded-[3px] shrink-0"
                  style={{ color: verdictColor, backgroundColor: verdictBg }}
                >
                  {verdictLabel(primaryVerdict)}
                </span>
              </div>

              <div className="mt-3 space-y-1.5 text-[12px] text-[var(--ls-ink-soft)]">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 truncate">
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: '#1f4d74' }}
                      aria-hidden="true"
                    />
                    <span className="truncate">{scenario.tx.name}</span>
                  </span>
                  <span className="ls-mono text-[11px] text-[var(--ls-dim)] shrink-0">
                    {scenario.tx.antennaHeightM}m
                  </span>
                </div>
                {isRelay && (
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 truncate">
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: '#d97706' }}
                        aria-hidden="true"
                      />
                      <span className="truncate">{scenario.repeater.name}</span>
                    </span>
                    <span className="ls-mono text-[11px] text-[var(--ls-dim)] shrink-0">
                      {scenario.repeater.groundElevationM}m ASL
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 truncate">
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: '#14744e' }}
                      aria-hidden="true"
                    />
                    <span className="truncate">{scenario.rx.name}</span>
                  </span>
                  <span className="ls-mono text-[11px] text-[var(--ls-dim)] shrink-0">
                    {distanceKm.toFixed(1)} km
                  </span>
                </div>
              </div>

              <div className="mt-3 pt-2.5 border-t border-[var(--ls-line)] flex items-baseline justify-between gap-2">
                <div>
                  <div className="text-[11px] text-[var(--ls-dim)]">
                    Fade margin
                  </div>
                  <div className="ls-mono text-[22px] font-semibold tracking-tight text-[var(--ls-ink)] leading-tight">
                    {analysis.bottleneckFadeMarginDb >= 0 ? '+' : ''}
                    {analysis.bottleneckFadeMarginDb.toFixed(1)} dB
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-[11px] text-[var(--ls-dim)]">
                    1st Fresnel
                  </div>
                  <div
                    className="ls-mono text-[15px] font-semibold"
                    style={{ color: verdictColor }}
                  >
                    {clearancePct}%
                  </div>
                </div>
              </div>
            </aside>

            {/* Floating Bottom Corridor Card (Felt signature interactive bar) */}
            <div
              className="absolute bottom-2 left-1/2 -translate-x-1/2 w-[min(94%,460px)] rounded-[6px] bg-[var(--ls-surface)] border border-[var(--ls-line-2)] px-4 py-3 flex items-center justify-between gap-3 z-10"
              style={{ boxShadow: 'var(--ls-shadow-card)' }}
            >
              <div className="flex items-start gap-2.5 min-w-0">
                <Radio
                  className="w-4 h-4 mt-0.5 shrink-0"
                  style={{ color: 'var(--ls-terracotta)' }}
                  aria-hidden="true"
                />
                <p className="text-[12.5px] leading-[1.4] text-[var(--ls-ink-soft)] m-0">
                  {insight}
                </p>
              </div>
              <a
                href={`/planner?preset=${scenario.id}`}
                onClick={(e) =>
                  handleRouteClick(e, `/planner?preset=${scenario.id}`)
                }
                aria-label={`Open ${shortTitle} in RF workbench`}
                title={`Open ${shortTitle} in RF workbench`}
                className="w-8 h-8 rounded-[4px] bg-[var(--ls-ink)] text-[var(--ls-paper)] inline-flex items-center justify-center shrink-0 transition-transform duration-150 active:scale-[0.96]"
              >
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
