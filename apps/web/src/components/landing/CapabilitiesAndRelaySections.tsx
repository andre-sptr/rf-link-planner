import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  ArrowRight,
  Box,
  Cable,
  Database,
  FileText,
  Layers,
  Mountain,
  Radio,
  Ruler,
  Waypoints,
} from 'lucide-react';
import relayRidgeMapUrl from '../../assets/landing/relay-ridge-map.webp';
import { evaluateLandingScenario } from './landingScenarios';

export interface CapabilitiesAndRelaySectionsProps {
  onNavigate: (to: string) => void;
}

const DATA_AND_PHYSICS_SOURCES = [
  { label: 'SRTM 30M DEM', icon: Mountain },
  { label: 'COPERNICUS 90M', icon: Layers },
  { label: 'ITU-R P.526-15', icon: Activity },
  { label: 'OKUMURA-HATA', icon: Radio },
  { label: 'COST-231 HATA', icon: Waypoints },
  { label: 'MAPLIBRE GL 3D', icon: Box },
  { label: 'LDF4 / LDF5 COAX', icon: Cable },
  { label: 'LMR-400 FEEDER', icon: Ruler },
  { label: 'SQLITE WAL CACHE', icon: Database },
  { label: 'JSPDF A4 SURVEY', icon: FileText },
];

const RELAY_CASE_STUDIES = [
  {
    id: 'bandung-lembang-relay',
    title: 'Mountain Ridge Relay',
    location: 'BANDUNG – SUBANG, ID',
    siteTitle: 'Bukit Tunggul Ridge RPT',
    elevationLabel: '2,150 m ASL',
    mode: 'relay' as const,
  },
  {
    id: 'jakarta-depok-58ghz',
    title: 'Urban 5.8 GHz Backhaul',
    location: 'KUNINGAN – DEPOK, ID',
    siteTitle: 'Kuningan Rooftop Mast',
    elevationLabel: '48 m AGL · 28 dBi',
    mode: 'ptp' as const,
  },
  {
    id: 'sumatra-vhf-telemetry',
    title: 'VHF 32 km Long-Haul',
    location: 'PEKANBARU – MINAS, ID',
    siteTitle: 'Minas Field RTU',
    elevationLabel: '152.5 MHz · 32.1 km',
    mode: 'ptp' as const,
  },
];

const SUPERPOWER_ITEMS = [
  {
    num: '01',
    title: '3D Topographic Map',
    desc: 'Interactive MapLibre 3D terrain canvas with ESRI Topo, Satellite, Studio, and Dark layers plus drag-and-drop TX/RPT/RX site markers.',
  },
  {
    num: '02',
    title: '1st Fresnel Profile',
    desc: 'Real-time SVG cross-section plotting ground elevation, canopy clutter, k-factor Earth bulge, 1st Fresnel envelope, and 60% F1 corridor.',
  },
  {
    num: '03',
    title: 'Repeater Relay Solver',
    desc: 'Evaluate Hop 1 and Hop 2 side by side against the direct TX → RX reference to quantify exact fade margin and clearance gains.',
  },
  {
    num: '04',
    title: 'Tower Height Advisor',
    desc: 'Closed-form solver computing the minimum extra mast height—balanced or single-ended—to restore ≥60% 1st Fresnel clearance.',
  },
  {
    num: '05',
    title: 'ITU-R P.526 & Hata',
    desc: 'Combines Free Space Path Loss, single knife-edge diffraction (ν), and empirical Okumura-Hata / COST-231 models with bounds warnings.',
  },
  {
    num: '06',
    title: 'Per-Site Radio Tuning',
    desc: 'Independent or synchronized TX power, Rx sensitivity, antenna gain, coaxial feeder (RG-58 through LDF5-50A), connector, and duplexer losses.',
  },
  {
    num: '07',
    title: '2-Page PDF Site Survey',
    desc: 'On-demand lazy-loaded jsPDF exporter producing print-ready A4 engineering reports with path azimuths, budgets, and terrain charts.',
  },
  {
    num: '08',
    title: 'Zero-Friction URL Sharing',
    desc: 'Encode complete scenarios into compact ?s= query links or local drafts with instant command-palette navigation (⌘K).',
  },
];

export function CapabilitiesAndRelaySections({
  onNavigate,
}: CapabilitiesAndRelaySectionsProps) {
  const [caseIdx, setCaseIdx] = useState(0);

  useEffect(() => {
    if (
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    ) {
      return;
    }
    const timer = window.setInterval(() => {
      setCaseIdx((i) => (i + 1) % RELAY_CASE_STUDIES.length);
    }, 7000);
    return () => window.clearInterval(timer);
  }, []);

  const activeCase = RELAY_CASE_STUDIES[caseIdx] ?? RELAY_CASE_STUDIES[0]!;
  const evaluatedCase = useMemo(
    () => evaluateLandingScenario(activeCase.id, { mode: activeCase.mode }),
    [activeCase],
  );

  const handleRouteClick = (
    e: React.MouseEvent<HTMLAnchorElement>,
    to: string,
  ) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    onNavigate(to);
  };

  const relayComp = evaluatedCase.analysis.relayComparison;
  const primaryHop = evaluatedCase.analysis.hops[0]!;
  const isRelayCase = evaluatedCase.scenario.mode === 'relay' && Boolean(relayComp);

  return (
    <>
      {/* Section 4: Terrain & Physics Sources (Felt "Cloud Sources" 2-column hairline grid) */}
      <section className="ls-section">
        <div className="ls-section-in">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-start">
            <div className="lg:col-span-5">
              <span className="ls-kicker">Terrain &amp; Physics</span>
              <h2 className="ls-h2">Real elevation, from SRTM to Fresnel</h2>
              <p className="ls-lede mt-4">
                Every coordinate pair fetches paced SRTM 30 m elevation tiles
                with automatic Copernicus 90 m failover and SQLite WAL caching—then
                runs pure TypeScript propagation math in real time.
              </p>
            </div>

            <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-x-8">
              {DATA_AND_PHYSICS_SOURCES.map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.label}
                    className="flex items-center gap-3.5 py-3.5 border-b border-[var(--ls-line)]"
                  >
                    <Icon
                      className="w-4 h-4 shrink-0"
                      style={{ color: 'var(--ls-cobalt)' }}
                      aria-hidden="true"
                    />
                    <span className="ls-mono text-[11.5px] tracking-[0.06em] text-[var(--ls-ink-soft)]">
                      {item.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Section 5: Relay Engineering Band (Felt "GIS expertise, a prompt away" 5fr/7fr split) */}
      <section className="ls-section">
        <div className="ls-section-in">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14 items-center">
            <div className="lg:col-span-5">
              <span className="ls-kicker">Relay Engineering</span>
              <h2 className="ls-h2">Obstructions solved, one ridge away.</h2>
              <p className="ls-lede mt-4">
                When a mountain wall blocks the direct path, place a passive
                ridge or active repeater node. LinkSight computes both relay
                hops alongside the obstructed direct baseline so the gain in dB
                is unmistakable.
              </p>

              <div className="mt-5">
                <a
                  href={`/planner?preset=${activeCase.id}`}
                  onClick={(e) =>
                    handleRouteClick(e, `/planner?preset=${activeCase.id}`)
                  }
                  className="ls-editorial-link"
                >
                  <span>Analyze this corridor</span>
                  <ArrowRight className="w-4 h-4" aria-hidden="true" />
                </a>
              </div>

              {/* 3 Case Selector Tabs */}
              <div className="mt-10 pt-4 border-t border-[var(--ls-line)]">
                <div className="grid grid-cols-3 gap-3 min-w-0">
                  {RELAY_CASE_STUDIES.map((item, idx) => {
                    const active = idx === caseIdx;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setCaseIdx(idx)}
                        aria-current={active ? 'true' : undefined}
                        className="text-left bg-transparent border-0 p-0 pt-2.5 cursor-pointer relative min-w-0"
                      >
                        <span
                          aria-hidden="true"
                          className="absolute top-0 left-0 right-0 h-[2px] transition-colors duration-150"
                          style={{
                            backgroundColor: active
                              ? 'var(--ls-ink)'
                              : 'transparent',
                          }}
                        />
                        <span
                          className="block text-[12.5px] font-medium leading-snug truncate"
                          style={{
                            color: active
                              ? 'var(--ls-ink)'
                              : 'var(--ls-dim)',
                          }}
                        >
                          {item.title}
                        </span>
                        <span className="ls-mono block text-[9.5px] tracking-[0.04em] text-[var(--ls-dim)] mt-0.5 truncate">
                          {item.location}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Right Feathered Ridge Map + Cobalt Site Inspection Card + Comparison Summary */}
            <div className="lg:col-span-7 relative">
              <div className="relative">
                <img
                  src={relayRidgeMapUrl}
                  alt="Editorial watercolor terrain map illustrating a forested mountain ridge separating two valleys"
                  width={1200}
                  height={896}
                  loading="lazy"
                  decoding="async"
                  className="ls-feather-map w-full h-auto block pointer-events-none select-none"
                />

                {/* Overlaid RF Vector Diagram */}
                <svg
                  viewBox="0 0 600 448"
                  className="absolute inset-0 w-full h-full pointer-events-none"
                  aria-hidden="true"
                >
                  {isRelayCase ? (
                    <>
                      {/* Obstructed Direct Line */}
                      <line
                        x1="128"
                        y1="142"
                        x2="474"
                        y2="314"
                        stroke="#b52b27"
                        strokeWidth="2.2"
                        strokeDasharray="6 5"
                      />
                      {/* Clear Relay Hops */}
                      <line
                        x1="128"
                        y1="142"
                        x2="318"
                        y2="196"
                        stroke="#14744e"
                        strokeWidth="3"
                      />
                      <line
                        x1="318"
                        y1="196"
                        x2="474"
                        y2="314"
                        stroke="#14744e"
                        strokeWidth="3"
                      />
                      <circle
                        cx="318"
                        cy="196"
                        r="8"
                        fill="#d97706"
                        stroke="#ffffff"
                        strokeWidth="2.5"
                      />
                    </>
                  ) : (
                    <>
                      <ellipse
                        cx="301"
                        cy="228"
                        rx="200"
                        ry="24"
                        transform="rotate(26 301 228)"
                        fill="rgb(31 77 116 / 0.14)"
                        stroke="#1f4d74"
                        strokeWidth="1.2"
                        strokeDasharray="4 4"
                      />
                      <line
                        x1="128"
                        y1="142"
                        x2="474"
                        y2="314"
                        stroke="#1f4d74"
                        strokeWidth="3"
                      />
                    </>
                  )}
                  <circle
                    cx="128"
                    cy="142"
                    r="8"
                    fill="#1f4d74"
                    stroke="#ffffff"
                    strokeWidth="2.5"
                  />
                  <circle
                    cx="474"
                    cy="314"
                    r="8"
                    fill="#14744e"
                    stroke="#ffffff"
                    strokeWidth="2.5"
                  />
                </svg>

                {/* Cobalt-Header Inspection Card (matches Felt's "North canyon tap" popover) */}
                <div
                  className="hidden sm:block absolute top-3 left-4 sm:left-10 w-[238px] rounded-[6px] overflow-hidden border border-[var(--ls-line)] bg-[var(--ls-surface)] z-10"
                  style={{ boxShadow: 'var(--ls-shadow-card)' }}
                >
                  <div
                    className="px-3.5 py-2.5 text-white flex items-baseline justify-between gap-2"
                    style={{ backgroundColor: 'var(--ls-cobalt)' }}
                  >
                    <div>
                      <div className="text-[12.5px] font-semibold leading-tight">
                        {activeCase.siteTitle}
                      </div>
                      <div className="ls-mono text-[9.5px] tracking-[0.06em] uppercase opacity-80 mt-0.5">
                        {activeCase.mode === 'relay' ? 'Relay Summit' : 'TX Site'}
                      </div>
                    </div>
                    <span className="ls-mono text-[13px] font-semibold">
                      {evaluatedCase.distanceKm.toFixed(1)} km
                    </span>
                  </div>
                  <div className="px-3.5 py-2.5 space-y-1.5 text-[11.5px]">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[var(--ls-dim)]">Site elevation</span>
                      <span className="ls-mono font-medium text-[var(--ls-ink)]">
                        {activeCase.elevationLabel}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[var(--ls-dim)]">
                        Diffraction loss
                      </span>
                      <span className="ls-mono font-medium text-[var(--ls-ink)]">
                        {primaryHop.diffractionLossDb.toFixed(1)} dB
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[var(--ls-dim)]">Frequency</span>
                      <span className="ls-mono font-medium text-[var(--ls-ink)]">
                        {evaluatedCase.scenario.propagation.frequencyMhz} MHz
                      </span>
                    </div>
                  </div>
                </div>

                {/* White Comparison / Verdict Card bottom-right */}
                <div
                  className="mt-4 sm:mt-0 sm:absolute sm:bottom-3 sm:right-2 w-full sm:w-[292px] rounded-[6px] border border-[var(--ls-line-2)] bg-[var(--ls-surface)] p-4 z-10"
                  style={{ boxShadow: 'var(--ls-shadow-card)' }}
                >
                  <div className="flex items-center justify-between gap-2 pb-2 border-b border-[var(--ls-line)]">
                    <span className="text-[12px] font-semibold text-[var(--ls-ink)]">
                      {isRelayCase
                        ? 'Relay vs. Direct Baseline'
                        : 'Link Budget Summary'}
                    </span>
                    <span className="ls-mono text-[10px] text-[var(--ls-terracotta)] font-medium">
                      {evaluatedCase.scenario.propagation.model ===
                      'fspl-diffraction'
                        ? 'ITU-R P.526'
                        : 'Okumura-Hata'}
                    </span>
                  </div>

                  {isRelayCase && relayComp ? (
                    <div className="mt-2.5 space-y-1.5 text-[12px]">
                      <div className="flex items-center justify-between">
                        <span className="text-[var(--ls-dim)]">
                          Direct Fade Margin
                        </span>
                        <span className="ls-mono font-semibold text-[var(--ls-fail)]">
                          {relayComp.directFadeMarginDb.toFixed(1)} dB
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[var(--ls-dim)]">
                          Relay Bottleneck
                        </span>
                        <span className="ls-mono font-semibold text-[var(--ls-pass)]">
                          +{relayComp.relayBottleneckFadeMarginDb.toFixed(1)} dB
                        </span>
                      </div>
                      <div className="pt-1.5 border-t border-[var(--ls-line)] flex items-center justify-between font-medium text-[var(--ls-ink)]">
                        <span>Net Relay Gain</span>
                        <span className="ls-mono text-[var(--ls-pass)] font-semibold">
                          +{relayComp.fadeMarginGainDb.toFixed(1)} dB
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-2.5 space-y-1.5 text-[12px]">
                      <div className="flex items-center justify-between">
                        <span className="text-[var(--ls-dim)]">
                          Total Path Loss
                        </span>
                        <span className="ls-mono font-semibold text-[var(--ls-ink)]">
                          {primaryHop.totalPathLossDb.toFixed(1)} dB
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[var(--ls-dim)]">Rx Signal</span>
                        <span className="ls-mono font-semibold text-[var(--ls-ink)]">
                          {primaryHop.rslDbm.toFixed(1)} dBm
                        </span>
                      </div>
                      <div className="pt-1.5 border-t border-[var(--ls-line)] flex items-center justify-between font-medium text-[var(--ls-ink)]">
                        <span>Fade Margin</span>
                        <span className="ls-mono text-[var(--ls-pass)] font-semibold">
                          +{primaryHop.fadeMarginDb.toFixed(1)} dB
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Section 6: Gain RF Engineering Superpowers (Felt diagram + 4x2 numbered 01-08 grid) */}
      <section id="capabilities" className="ls-section">
        <div className="ls-section-in">
          <span className="ls-kicker">RF Capabilities</span>
          <h2 className="ls-h2">Gain RF engineering superpowers</h2>

          <div className="mt-8 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
            {/* Clean Technical Vector Physics Plate */}
            <div
              className="lg:col-span-6 rounded-[6px] border border-[var(--ls-line-2)] p-4 sm:p-5"
              style={{
                colorScheme: 'only dark',
                backgroundColor: '#131924',
                color: '#f4f2ea',
                boxShadow: 'var(--ls-shadow-card)',
              }}
            >
              <svg
                viewBox="0 0 560 250"
                role="img"
                aria-label="Diagram showing Line of Sight ray, 1st Fresnel ellipsoid radius F1, 60 percent clearance zone, Earth bulge, and knife-edge parameter nu"
                className="w-full h-auto block"
              >
                <defs>
                  <linearGradient id="ls-f1-grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.24" />
                    <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.06" />
                  </linearGradient>
                </defs>
                {/* Reference Grid */}
                <path
                  d="M36 45 H524 M36 105 H524 M36 165 H524 M36 210 H524"
                  stroke="rgb(244 242 234 / 0.08)"
                  strokeDasharray="3 4"
                />

                {/* Curved Terrain with Peak & Earth Bulge */}
                <path
                  d="M44 195 Q 150 182, 265 130 Q 290 116, 315 138 Q 410 180, 516 178 L 516 218 L 44 218 Z"
                  fill="#243247"
                  stroke="#7d93ae"
                  strokeWidth="1.6"
                />

                {/* 1st Fresnel Ellipsoid (F1) */}
                <ellipse
                  cx="280"
                  cy="103"
                  rx="222"
                  ry="42"
                  transform="rotate(-2.2 280 103)"
                  fill="url(#ls-f1-grad)"
                  stroke="#38bdf8"
                  strokeWidth="1.3"
                />
                {/* 60% F1 Corridor */}
                <ellipse
                  cx="280"
                  cy="103"
                  rx="222"
                  ry="25"
                  transform="rotate(-2.2 280 103)"
                  fill="none"
                  stroke="#fbbf24"
                  strokeWidth="1.2"
                  strokeDasharray="5 4"
                />

                {/* Direct Line of Sight */}
                <line
                  x1="58"
                  y1="112"
                  x2="502"
                  y2="94"
                  stroke="#34d399"
                  strokeWidth="2.4"
                />

                {/* Towers */}
                <line x1="58" y1="192" x2="58" y2="112" stroke="#38bdf8" strokeWidth="3.5" />
                <circle cx="58" cy="112" r="4.5" fill="#38bdf8" />
                <text x="58" y="232" textAnchor="middle" fill="#cbd5e1" fontSize="10" fontFamily="IBM Plex Mono, monospace">
                  TX ANTENNA
                </text>

                <line x1="502" y1="178" x2="502" y2="94" stroke="#34d399" strokeWidth="3.5" />
                <circle cx="502" cy="94" r="4.5" fill="#34d399" />
                <text x="502" y="232" textAnchor="middle" fill="#cbd5e1" fontSize="10" fontFamily="IBM Plex Mono, monospace">
                  RX ANTENNA
                </text>

                {/* Knife-edge clearance indicator */}
                <line
                  x1="290"
                  y1="103"
                  x2="290"
                  y2="122"
                  stroke="#f87171"
                  strokeWidth="2"
                />
                <circle cx="290" cy="122" r="4" fill="#f87171" />

                {/* Annotations */}
                <text x="280" y="54" textAnchor="middle" fill="#38bdf8" fontSize="10.5" fontFamily="IBM Plex Mono, monospace">
                  1ST FRESNEL ZONE (F1)
                </text>
                <text x="405" y="138" textAnchor="middle" fill="#fbbf24" fontSize="10" fontFamily="IBM Plex Mono, monospace">
                  60% F1 CORRIDOR
                </text>
                <text x="290" y="156" textAnchor="middle" fill="#fca5a5" fontSize="9.5" fontFamily="IBM Plex Mono, monospace">
                  KNIFE-EDGE APEX (v)
                </text>
              </svg>
            </div>

            <div className="lg:col-span-6">
              <p className="ls-lede">
                Fresnel diffraction checks, coaxial feeder attenuation, and path
                loss budgeting used to mean hopping between desktop terrain tools
                and brittle spreadsheets. With LinkSight RF, every change
                recalculates in milliseconds inside your browser.
              </p>
              <div className="mt-5">
                <a
                  href="/planner?dialog=formulas"
                  onClick={(e) =>
                    handleRouteClick(e, '/planner?dialog=formulas')
                  }
                  className="ls-editorial-link"
                >
                  <span>Explore RF Math &amp; equations</span>
                  <ArrowRight className="w-4 h-4" aria-hidden="true" />
                </a>
              </div>
            </div>
          </div>

          {/* 4x2 Numbered Capabilities Grid (01–08) */}
          <div className="mt-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-9 pt-8 border-t border-[var(--ls-line)]">
            {SUPERPOWER_ITEMS.map((item) => (
              <div key={item.num}>
                <div className="ls-mono text-[11px] font-medium text-[var(--ls-terracotta)] mb-2">
                  {item.num}
                </div>
                <h3 className="text-[15px] font-semibold text-[var(--ls-ink)] m-0">
                  {item.title}
                </h3>
                <p className="text-[13.5px] leading-[1.55] text-[var(--ls-ink-soft)] mt-1.5 m-0">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
