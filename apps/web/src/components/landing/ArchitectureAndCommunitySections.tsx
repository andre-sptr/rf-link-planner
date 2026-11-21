import { useMemo } from 'react';
import { ArrowRight } from 'lucide-react';
import { DEMO_SCENARIOS } from '@linksight/rf-engine';
import fieldOfficeCollabUrl from '../../assets/landing/field-office-collab.webp';
import { BrandTowerIcon } from '../BrandTowerIcon';
import {
  evaluateLandingScenario,
  formatBearing,
  formatLatDms,
  formatLonDms,
  verdictLabel,
  type EvaluatedLandingScenario,
} from './landingScenarios';

export interface ArchitectureAndCommunitySectionsProps {
  activeScenario: EvaluatedLandingScenario;
  onNavigate: (to: string) => void;
}

const RF_WORKFLOWS = [
  {
    title: 'VHF / UHF Repeaters',
    desc: 'Place ridge repeaters and compare two-hop vs. direct links across rugged topography.',
    preset: 'bandung-lembang-relay',
  },
  {
    title: '5.8 GHz PtP Microwave',
    desc: 'Verify narrow high-frequency Fresnel clearances and tropical rain-fade margins.',
    preset: 'jakarta-depok-58ghz',
  },
  {
    title: 'Industrial SCADA Telemetry',
    desc: 'Size 915 MHz & VHF long-haul paths for substations, pipelines, and remote RTUs.',
    preset: 'sumatra-vhf-telemetry',
  },
  {
    title: 'Emergency & SAR Comms',
    desc: 'Validate tactical field relay positions rapidly without desktop GIS setup.',
    preset: 'bandung-lembang-relay',
  },
  {
    title: 'Campus & Plant Backhaul',
    desc: 'Account for suburban tree clutter, coax attenuation, and rooftop mast height.',
    preset: 'pekanbaru-rumbai-uhf',
  },
  {
    title: 'Tower Height Feasibility',
    desc: 'Solve minimum balanced or single-end mast height boosts to pass 60% F1.',
    preset: 'sumatra-vhf-telemetry',
  },
  {
    title: 'Pre-Sales Site Surveys',
    desc: 'Generate clean 2-page A4 PDF link budget reports for field engineering signoff.',
    preset: 'jakarta-depok-58ghz',
  },
  {
    title: 'RF Engineering Labs',
    desc: 'Inspect ITU-R P.526 diffraction, Okumura-Hata, and Earth k-factor sensitivity live.',
    preset: 'pekanbaru-rumbai-uhf',
  },
];

const RELIABILITY_PILLARS = [
  {
    num: '01',
    title: 'Client-Side RF Math',
    desc: 'All geodesy, Fresnel radii, ITU-R P.526 diffraction, and coaxial feeder losses execute locally in pure TypeScript inside @linksight/rf-engine.',
  },
  {
    num: '02',
    title: 'Zero-Account URL Sharing',
    desc: 'Every coordinate, frequency, radio profile, and clutter setting serializes into a compact ?s= URL parameter or browser localStorage draft.',
  },
  {
    num: '03',
    title: 'Multi-Source DEM Failover',
    desc: 'Paced SRTM 30 m terrain queries cache cleanly in SQLite WAL on a 4-decimal grid with automatic Copernicus 90 m and synthetic fallback.',
  },
];

const FAQ_ITEMS = [
  {
    num: '01',
    q: 'Which propagation and terrain models does LinkSight RF calculate?',
    a: 'LinkSight RF pairs Free Space Path Loss (FSPL) with ITU-R P.526-15 single knife-edge diffraction across sampled terrain, Earth curvature bulge (adjustable k-factor 4/3, 1.0, or 2/3), and uniform canopy clutter. You can also switch to empirical Okumura-Hata (150–1500 MHz) or COST-231 Hata (1500–2000 MHz) with automatic domain bounds warnings.',
  },
  {
    num: '02',
    q: 'Where does elevation data come from, and what happens offline?',
    a: 'Terrain elevation along each path is fetched through the Fastify DEM caching proxy from OpenTopoData SRTM 30 m, backed by a 4-decimal (~11 m) SQLite WAL grid cache and automatic failover to Open-Meteo Copernicus 90 m. If both upstream services are unreachable, a deterministic synthetic fallback keeps the workbench interactive.',
  },
  {
    num: '03',
    q: 'How does Repeater Relay mode compare against a Direct link?',
    a: 'In Repeater Relay mode, LinkSight evaluates Hop 1 (TX → Repeater) and Hop 2 (Repeater → RX) independently alongside the unassisted Direct TX → RX reference path. You immediately see the bottleneck fade margin, minimum Fresnel clearance ratio, and net gain in dB from adding the relay.',
  },
  {
    num: '04',
    q: 'Do I need an account to save scenarios or export site survey PDFs?',
    a: 'No account or backend login is required. Active drafts and named presets persist locally in your browser, full scenarios share via ?s= URL links, and a lazy-loaded jsPDF exporter produces print-ready 2-page A4 RF Site Survey Engineering Reports on demand.',
  },
  {
    num: '05',
    q: 'Which frequency bands and coaxial cables are supported?',
    a: 'Built-in equipment profiles cover VHF 150 MHz, UHF 450 MHz, 915 MHz ISM SCADA, and 5.8 GHz PtP microwave, while all numeric fields accept custom frequencies, Tx power, antenna gains, Rx sensitivities, connector/duplexer losses, and frequency-dependent attenuation for RG-58, RG-213, LMR-240, LMR-400, LDF4-50A, and LDF5-50A.',
  },
];

function CorridorMiniCardThumb({
  evaluated,
}: {
  evaluated: EvaluatedLandingScenario;
}) {
  const hop = evaluated.analysis.hops[0]!;
  const pts = hop.points;
  const w = 360;
  const h = 160;
  const padX = 18;
  const padTop = 20;
  const padBottom = 18;

  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const p of pts) {
    minY = Math.min(minY, p.groundElevationM);
    maxY = Math.max(maxY, p.effectiveTerrainM, p.fresnel1UpperM, p.losHeightM);
  }
  const span = Math.max(25, maxY - minY);
  const yMin = minY - span * 0.1;
  const yMax = maxY + span * 0.16;

  const xOf = (d: number) =>
    padX + (d / Math.max(0.001, hop.distanceKm)) * (w - padX * 2);
  const yOf = (e: number) =>
    padTop + (1 - (e - yMin) / Math.max(1, yMax - yMin)) * (h - padTop - padBottom);

  const terrainLine = pts
    .map(
      (p, i) =>
        `${i === 0 ? 'M' : 'L'} ${xOf(p.distanceKm).toFixed(1)} ${yOf(p.effectiveTerrainM).toFixed(1)}`,
    )
    .join(' ');
  const terrainArea = `${terrainLine} L ${w - padX} ${h - padBottom} L ${padX} ${h - padBottom} Z`;

  const f1Upper = pts.map(
    (p) => `${xOf(p.distanceKm).toFixed(1)} ${yOf(p.fresnel1UpperM).toFixed(1)}`,
  );
  const f1Lower = [...pts]
    .reverse()
    .map(
      (p) => `${xOf(p.distanceKm).toFixed(1)} ${yOf(p.fresnel1LowerM).toFixed(1)}`,
    );
  const f1Poly = `M ${f1Upper.join(' L ')} L ${f1Lower.join(' L ')} Z`;

  const start = pts[0]!;
  const end = pts[pts.length - 1]!;
  const isRelay = evaluated.scenario.mode === 'relay';
  const strokeColor =
    evaluated.analysis.overallVerdict === 'pass'
      ? '#34d399'
      : evaluated.analysis.overallVerdict === 'marginal'
        ? '#fbbf24'
        : '#f87171';

  return (
    <div
      className="ls-corridor-thumb"
      style={{
        background:
          'linear-gradient(155deg, #162233 0%, #0f1622 65%, #192434 100%)',
      }}
    >
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="w-full h-full block"
        aria-hidden="true"
      >
        {/* Subtle topographic contour lines */}
        <path
          d="M0 32 Q 90 18, 180 34 T 360 28 M0 60 Q 110 48, 220 66 T 360 54"
          fill="none"
          stroke="rgb(244 242 234 / 0.06)"
          strokeWidth="1"
        />
        <path d={f1Poly} fill="rgb(56 189 248 / 0.14)" stroke="rgb(56 189 248 / 0.4)" strokeWidth="0.9" />
        <path d={terrainArea} fill="rgb(56 80 110 / 0.55)" />
        <path d={terrainLine} fill="none" stroke="#859bb8" strokeWidth="1.5" />
        <line
          x1={xOf(start.distanceKm)}
          y1={yOf(start.losHeightM)}
          x2={xOf(end.distanceKm)}
          y2={yOf(end.losHeightM)}
          stroke={strokeColor}
          strokeWidth="2"
        />
        <circle cx={xOf(start.distanceKm)} cy={yOf(start.losHeightM)} r="3.5" fill="#38bdf8" />
        <circle cx={xOf(end.distanceKm)} cy={yOf(end.losHeightM)} r="3.5" fill="#34d399" />

        {/* Corner telemetry badge */}
        <rect x="14" y="12" width={isRelay ? 98 : 82} height="18" rx="3" fill="rgb(28 27 24 / 0.72)" />
        <text
          x="21"
          y="24"
          fill="#f4f2ea"
          fontSize="9.5"
          fontFamily="IBM Plex Mono, monospace"
        >
          {evaluated.distanceKm.toFixed(1)} KM · {verdictLabel(evaluated.analysis.overallVerdict)}
        </text>
      </svg>
    </div>
  );
}

export function ArchitectureAndCommunitySections({
  activeScenario,
  onNavigate,
}: ArchitectureAndCommunitySectionsProps) {
  const corridors = useMemo(
    () => DEMO_SCENARIOS.map((s) => evaluateLandingScenario(s.id)),
    [],
  );

  const handleRouteClick = (
    e: React.MouseEvent<HTMLAnchorElement>,
    to: string,
  ) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    onNavigate(to);
  };

  return (
    <>
      {/* Section 7: Inset Dark Charcoal Architecture Card (Felt "Build your business logic into Felt") */}
      <section id="architecture" className="ls-section">
        <div className="ls-section-in">
          <div className="ls-dark-band p-7 sm:p-11 lg:p-14 grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            <div className="lg:col-span-5">
              <span className="ls-kicker">Engine Architecture</span>
              <h2 className="ls-h2">
                Deterministic RF physics, built for the browser
              </h2>
              <p className="ls-lede mt-4">
                Every calculation runs inside a framework-agnostic TypeScript
                engine shared across UI, PDF reporting, and unit tests. Only DEM
                elevation sampling touches the Fastify + SQLite WAL caching
                proxy—keeping interaction instantaneous.
              </p>
              <div className="mt-6">
                <a
                  href="/planner?dialog=formulas"
                  onClick={(e) =>
                    handleRouteClick(e, '/planner?dialog=formulas')
                  }
                  className="ls-editorial-link"
                >
                  <span>Inspect formulas &amp; equations</span>
                  <ArrowRight className="w-4 h-4" aria-hidden="true" />
                </a>
              </div>
            </div>

            {/* 3-Layer Isometric Architecture Wireframe SVG */}
            <div className="lg:col-span-7 flex justify-center">
              <svg
                viewBox="0 0 560 340"
                role="img"
                aria-label="Three-layer isometric stack diagram showing MapLibre 3D UI layer, rf-engine physics layer, and Fastify SQLite DEM cache layer"
                className="w-full max-w-[540px] h-auto block"
              >
                {/* Vertical connector beams */}
                <line x1="280" y1="62" x2="280" y2="292" stroke="rgb(244 242 234 / 0.16)" strokeDasharray="3 4" />
                <line x1="128" y1="108" x2="128" y2="245" stroke="rgb(244 242 234 / 0.14)" strokeDasharray="3 4" />
                <line x1="432" y1="108" x2="432" y2="245" stroke="rgb(244 242 234 / 0.14)" strokeDasharray="3 4" />

                {/* Bottom Plane: Fastify DEM Proxy + SQLite WAL */}
                <polygon
                  points="280,192 480,248 280,304 80,248"
                  fill="#23221c"
                  stroke="#a3a29b"
                  strokeOpacity="0.45"
                  strokeWidth="1.2"
                />
                <polygon
                  points="190,236 270,258 232,270 152,248"
                  fill="rgb(220 140 70 / 0.16)"
                  stroke="#dc8c46"
                  strokeWidth="1"
                />
                <polygon
                  points="290,224 378,248 342,260 254,236"
                  fill="rgb(56 189 248 / 0.12)"
                  stroke="#38bdf8"
                  strokeWidth="1"
                />
                <text x="280" y="324" textAnchor="middle" fill="#a3a29b" fontSize="10.5" fontFamily="IBM Plex Mono, monospace">
                  03 · FASTIFY DEM PROXY · SQLITE WAL · SRTM 30M / COPERNICUS 90M
                </text>

                {/* Middle Plane: @linksight/rf-engine */}
                <polygon
                  points="280,114 480,170 280,226 80,170"
                  fill="rgb(31 77 116 / 0.28)"
                  stroke="#38bdf8"
                  strokeOpacity="0.6"
                  strokeWidth="1.3"
                />
                {/* Topographic contour lines inside middle plane */}
                <ellipse cx="280" cy="170" rx="115" ry="26" fill="none" stroke="rgb(52 211 153 / 0.45)" strokeWidth="1" />
                <ellipse cx="280" cy="170" rx="70" ry="15" fill="none" stroke="rgb(56 189 248 / 0.55)" strokeWidth="1" />
                <line x1="176" y1="170" x2="384" y2="170" stroke="#34d399" strokeWidth="2" />
                <circle cx="176" cy="170" r="4" fill="#38bdf8" />
                <circle cx="280" cy="170" r="4" fill="#dc8c46" />
                <circle cx="384" cy="170" r="4" fill="#34d399" />
                <text x="488" y="172" textAnchor="start" fill="#38bdf8" fontSize="10" fontFamily="IBM Plex Mono, monospace">
                  RF ENGINE
                </text>

                {/* Top Plane: MapLibre 3D + Fresnel HUD */}
                <polygon
                  points="280,36 480,92 280,148 80,92"
                  fill="rgb(244 242 234 / 0.08)"
                  stroke="#f4f2ea"
                  strokeOpacity="0.65"
                  strokeWidth="1.4"
                />
                {/* Floating UI card outlines on top plane */}
                <polygon
                  points="146,84 228,62 256,70 174,92"
                  fill="rgb(244 242 234 / 0.14)"
                  stroke="#f4f2ea"
                  strokeOpacity="0.5"
                  strokeWidth="1"
                />
                <polygon
                  points="210,114 352,75 412,92 270,131"
                  fill="rgb(220 140 70 / 0.18)"
                  stroke="#dc8c46"
                  strokeWidth="1.1"
                />
                <text x="280" y="21" textAnchor="middle" fill="#f4f2ea" fontSize="10.5" fontFamily="IBM Plex Mono, monospace">
                  01 · MAPLIBRE 3D CANVAS + SVG FRESNEL + JSPDF A4
                </text>
              </svg>
            </div>
          </div>
        </div>
      </section>

      {/* Section 8: Field-to-Office Collaboration & Survey Reports (Felt wide triptych band) */}
      <section className="ls-section">
        <div className="ls-section-in">
          <div className="max-w-[580px]">
            <span className="ls-kicker">Collaboration &amp; Reports</span>
            <h2 className="ls-h2">
              Share link budgets and site surveys in one click
            </h2>
            <p className="ls-lede mt-4">
              Send a live scenario link that opens directly into the interactive
              terrain canvas, or export a 2-page A4 PDF RF Site Survey report
              with path azimuths, link tables, and print-resolved Fresnel charts.
            </p>
            <div className="mt-5">
              <a
                href="/planner"
                onClick={(e) => handleRouteClick(e, '/planner')}
                className="ls-editorial-link"
              >
                <span>Open workbench</span>
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </a>
            </div>
          </div>

          <div className="mt-8">
            <img
              src={fieldOfficeCollabUrl}
              alt="Editorial watercolor triptych illustrating an RF field engineer at a radio tower, an office engineer inspecting terrain profiles, and a team reviewing a printed site survey map"
              width={1400}
              height={562}
              loading="lazy"
              decoding="async"
              className="ls-feather-collab w-full h-auto block pointer-events-none select-none"
            />
          </div>
        </div>
      </section>

      {/* Section 9: Applications Matrix (Felt 4-column hairline workflow grid) */}
      <section className="ls-section">
        <div className="ls-section-in">
          <span className="ls-kicker">Applications</span>
          <h2 className="ls-h2">Built for real-world RF planning</h2>

          <div className="mt-9 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-2">
            {RF_WORKFLOWS.map((item) => (
              <a
                key={item.title}
                href={`/planner?preset=${item.preset}`}
                onClick={(e) =>
                  handleRouteClick(e, `/planner?preset=${item.preset}`)
                }
                className="group block py-4 border-b border-[var(--ls-line)] no-underline text-inherit transition-colors duration-150"
              >
                <div className="text-[14.5px] font-semibold text-[var(--ls-ink)] group-hover:text-[var(--ls-terracotta)] transition-colors duration-150">
                  {item.title}
                </div>
                <p className="text-[13px] leading-[1.5] text-[var(--ls-ink-soft)] mt-1 m-0">
                  {item.desc}
                </p>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* Section 10: Inset Dark Reliability & Privacy Band (Felt 01/02/03 dark card) */}
      <section className="ls-section">
        <div className="ls-section-in">
          <div className="ls-dark-band p-7 sm:p-11 lg:p-14">
            <div className="max-w-[620px]">
              <span className="ls-kicker">Reliability &amp; Privacy</span>
              <h2 className="ls-h2">
                Your site plans stay fast, local, and yours
              </h2>
            </div>

            <div className="mt-10 pt-8 border-t border-[var(--ls-dark-line)] grid grid-cols-1 md:grid-cols-3 gap-8">
              {RELIABILITY_PILLARS.map((item) => (
                <div key={item.num}>
                  <div className="ls-mono text-[11px] text-[var(--ls-amber)] mb-2">
                    {item.num}
                  </div>
                  <h3 className="text-[15.5px] font-semibold text-[var(--ls-dark-ink)] m-0">
                    {item.title}
                  </h3>
                  <p className="text-[13.5px] leading-[1.58] text-[var(--ls-dark-muted)] mt-2 m-0">
                    {item.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Section 11: Real Indonesian RF Corridors Gallery (Felt Map Gallery grid) */}
      <section id="corridors" className="ls-section">
        <div className="ls-section-in">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <span className="ls-kicker">Demo Corridors</span>
              <h2 className="ls-h2">
                Explore real Indonesian RF corridors
              </h2>
            </div>
            <a
              href="/planner?dialog=scenarios"
              onClick={(e) => handleRouteClick(e, '/planner?dialog=scenarios')}
              className="ls-editorial-link"
            >
              <span>All presets in workbench</span>
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </a>
          </div>

          <div className="mt-9 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {corridors.map((item) => (
              <a
                key={item.scenario.id}
                href={`/planner?preset=${item.scenario.id}`}
                onClick={(e) =>
                  handleRouteClick(e, `/planner?preset=${item.scenario.id}`)
                }
                className="ls-corridor-card"
              >
                <CorridorMiniCardThumb evaluated={item} />
                <div className="mt-3">
                  <div className="ls-mono text-[10px] uppercase tracking-[0.06em] text-[var(--ls-terracotta)]">
                    {item.corridorTag}
                  </div>
                  <h3 className="text-[15.5px] font-semibold text-[var(--ls-ink)] mt-1 m-0 leading-snug">
                    {item.shortTitle}
                  </h3>
                  <p className="text-[13px] leading-[1.5] text-[var(--ls-ink-soft)] mt-1.5 m-0 line-clamp-3">
                    {item.scenario.description}
                  </p>
                  <div className="ls-mono text-[11px] text-[var(--ls-dim)] mt-2.5">
                    Fade Margin {item.analysis.bottleneckFadeMarginDb >= 0 ? '+' : ''}
                    {item.analysis.bottleneckFadeMarginDb.toFixed(1)} dB ·{' '}
                    {Math.round(item.analysis.bottleneckClearanceRatio * 100)}% F1
                  </div>
                </div>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* Section 12: Common Questions (modern-web-guidance: accordion — native <details>, non-exclusive) */}
      <section
        id="faq"
        aria-labelledby="ls-faq-heading"
        className="ls-section"
      >
        <div className="ls-section-in">
          <div className="max-w-[920px]">
            <span className="ls-kicker">FAQ</span>
            <h2 id="ls-faq-heading" className="ls-h2 mb-8">
              Common questions
            </h2>

            {FAQ_ITEMS.map((item) => (
              <details key={item.num} className="ls-faq-item">
                <summary className="ls-faq-summary">
                  <span className="ls-mono text-[11px] text-[var(--ls-dim)]">
                    {item.num}
                  </span>
                  <span className="text-[16px] sm:text-[17px] font-medium leading-snug">
                    {item.q}
                  </span>
                </summary>
                <div className="pl-[3rem] pr-6 pb-5 text-[14.5px] leading-[1.62] text-[var(--ls-ink-soft)] max-w-[68ch]">
                  <p className="m-0">{item.a}</p>
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Section 13: Final Topographic Veil CTA (Felt final band) */}
      <section className="ls-section relative overflow-hidden">
        <svg
          viewBox="0 0 1440 420"
          preserveAspectRatio="xMidYMid slice"
          className="absolute inset-0 w-full h-full pointer-events-none opacity-45"
          aria-hidden="true"
        >
          <path
            d="M-40 120 Q 260 40, 560 150 T 1120 110 T 1500 170"
            fill="none"
            stroke="#9fb394"
            strokeWidth="1.4"
          />
          <path
            d="M-40 185 Q 290 90, 620 210 T 1180 170 T 1500 220"
            fill="none"
            stroke="#c6b793"
            strokeWidth="1.2"
          />
          <path
            d="M-40 250 Q 320 160, 680 275 T 1240 235 T 1500 280"
            fill="none"
            stroke="#8fa8be"
            strokeWidth="1.3"
          />
          <path
            d="M-40 320 Q 340 240, 720 335 T 1290 295 T 1500 345"
            fill="none"
            stroke="#9fb394"
            strokeWidth="1.1"
          />
          <circle cx="420" cy="180" r="140" fill="none" stroke="#c6b793" strokeOpacity="0.45" />
          <circle cx="1040" cy="210" r="180" fill="none" stroke="#8fa8be" strokeOpacity="0.45" />
        </svg>

        <div
          className="relative z-10 ls-section-in text-center"
          style={{ backgroundColor: 'rgb(244 242 234 / 0.78)' }}
        >
          <span className="ls-kicker">Try LinkSight RF</span>
          <h2 className="ls-display text-[clamp(2.2rem,4vw,3.4rem)] leading-[1.06] tracking-[-0.025em] text-[var(--ls-ink)] max-w-[16ch] mx-auto m-0">
            Plot your sites, verify your Fresnel zone
          </h2>
          <p className="ls-lede mt-4 max-w-[46ch] mx-auto">
            Open the live 3D terrain workbench or start directly from a curated
            Indonesian UHF, VHF, or 5.8 GHz corridor.
          </p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <a
              href="/planner"
              onClick={(e) => handleRouteClick(e, '/planner')}
              className="ls-btn-primary"
            >
              <span>Open RF Workbench</span>
              <ArrowRight className="w-4 h-4 shrink-0" aria-hidden="true" />
            </a>
            <a
              href="/planner?preset=bandung-lembang-relay"
              onClick={(e) =>
                handleRouteClick(e, '/planner?preset=bandung-lembang-relay')
              }
              className="ls-btn-secondary"
            >
              <span>Load Bandung Relay Demo</span>
              <ArrowRight className="w-4 h-4 shrink-0" aria-hidden="true" />
            </a>
          </div>
        </div>
      </section>

      {/* Section 14: Deep Charcoal Editorial Footer */}
      <footer className="ls-footer">
        <div className="ls-container py-14">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-10">
            <div className="md:col-span-5">
              <div className="flex items-center gap-2.5">
                <BrandTowerIcon className="w-7 h-7 shrink-0" />
                <span className="ls-display text-[22px] font-semibold tracking-[-0.02em] text-[var(--ls-dark-ink)]">
                  LinkSight RF
                </span>
              </div>
              <p className="text-[13.5px] text-[var(--ls-dark-muted)] mt-3 max-w-[36ch]">
                Browser-native RF link budget, single-repeater relay, and 1st
                Fresnel terrain clearance workbench.
              </p>
              <div className="ls-mono text-[10.5px] tracking-[0.06em] text-[var(--ls-dark-muted)] mt-6">
                LAT {formatLatDms(activeScenario.scenario.tx.coords.lat)} · LON{' '}
                {formatLonDms(activeScenario.scenario.tx.coords.lng)} · BRG{' '}
                {formatBearing(activeScenario.bearingDeg)}
              </div>
            </div>

            <div className="md:col-span-7 grid grid-cols-2 sm:grid-cols-4 gap-8 text-[13px]">
              <div>
                <div className="ls-mono text-[10.5px] tracking-[0.08em] uppercase text-[var(--ls-dark-muted)] mb-3">
                  Workbench
                </div>
                <ul className="list-none p-0 m-0 space-y-2">
                  <li>
                    <a
                      href="/planner"
                      onClick={(e) => handleRouteClick(e, '/planner')}
                      className="text-[var(--ls-dark-ink)] no-underline hover:underline"
                    >
                      3D Map Canvas
                    </a>
                  </li>
                  <li>
                    <a
                      href="/planner?dialog=formulas"
                      onClick={(e) =>
                        handleRouteClick(e, '/planner?dialog=formulas')
                      }
                      className="text-[var(--ls-dark-ink)] no-underline hover:underline"
                    >
                      RF Math Equations
                    </a>
                  </li>
                  <li>
                    <a
                      href="/planner?dialog=scenarios"
                      onClick={(e) =>
                        handleRouteClick(e, '/planner?dialog=scenarios')
                      }
                      className="text-[var(--ls-dark-ink)] no-underline hover:underline"
                    >
                      Saved Scenarios
                    </a>
                  </li>
                </ul>
              </div>

              <div>
                <div className="ls-mono text-[10.5px] tracking-[0.08em] uppercase text-[var(--ls-dark-muted)] mb-3">
                  Corridors
                </div>
                <ul className="list-none p-0 m-0 space-y-2">
                  {DEMO_SCENARIOS.map((item) => (
                    <li key={item.id}>
                      <a
                        href={`/planner?preset=${item.id}`}
                        onClick={(e) =>
                          handleRouteClick(e, `/planner?preset=${item.id}`)
                        }
                        className="text-[var(--ls-dark-ink)] no-underline hover:underline"
                      >
                        {item.name.split(' ')[0]} Link
                      </a>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <div className="ls-mono text-[10.5px] tracking-[0.08em] uppercase text-[var(--ls-dark-muted)] mb-3">
                  RF Engine
                </div>
                <ul className="list-none p-0 m-0 space-y-2 text-[var(--ls-dark-ink-soft)]">
                  <li>
                    <a
                      href="#workbench"
                      className="text-[var(--ls-dark-ink)] no-underline hover:underline"
                    >
                      Fresnel Profile
                    </a>
                  </li>
                  <li>
                    <a
                      href="#capabilities"
                      className="text-[var(--ls-dark-ink)] no-underline hover:underline"
                    >
                      ITU-R P.526-15
                    </a>
                  </li>
                  <li>
                    <a
                      href="#architecture"
                      className="text-[var(--ls-dark-ink)] no-underline hover:underline"
                    >
                      DEM Failover
                    </a>
                  </li>
                </ul>
              </div>

              <div>
                <div className="ls-mono text-[10.5px] tracking-[0.08em] uppercase text-[var(--ls-dark-muted)] mb-3">
                  Project
                </div>
                <ul className="list-none p-0 m-0 space-y-2">
                  <li>
                    <a
                      href="#faq"
                      className="text-[var(--ls-dark-ink)] no-underline hover:underline"
                    >
                      FAQ
                    </a>
                  </li>
                  <li>
                    <a
                      href="https://andresptr.site/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[var(--ls-dark-ink)] no-underline hover:underline"
                    >
                      Andre Saputra
                    </a>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          <div className="mt-12 pt-5 border-t border-[var(--ls-dark-line)] flex flex-wrap items-center justify-between gap-4 ls-mono text-[11px] text-[var(--ls-dark-muted)]">
            <span>&copy; 2026 LinkSight RF &middot; Built by Andre Saputra</span>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <span>
                Design reference from{' '}
                <a
                  href="https://felt.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[var(--ls-dark-ink)] no-underline hover:text-[var(--ls-amber)] transition-colors duration-150"
                >
                  felt.com
                </a>
              </span>
              <span aria-hidden="true">&middot;</span>
              <span>CRS WGS84 / SRTM 30M</span>
            </div>
          </div>
        </div>
      </footer>
    </>
  );
}
