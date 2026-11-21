import { useMemo, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import {
  DEMO_SCENARIOS,
  type HopAnalysis,
  type LinkMode,
} from '@linksight/rf-engine';
import {
  evaluateLandingScenario,
  verdictLabel,
} from './landingScenarios';

export interface InteractiveWorkbenchShowcaseProps {
  onNavigate: (to: string) => void;
}

const STANDARDS_STRIP = [
  'ITU-R P.526-15',
  'SRTM 30M DEM',
  'COPERNICUS 90M',
  'OKUMURA-HATA',
  'COST-231 HATA',
  'MAPLIBRE GL 3D',
  'WGS-84 GEODESY',
  'JSPDF A4 SURVEY',
];

function MiniFresnelSvg({ hop }: { hop: HopAnalysis }) {
  const width = 820;
  const height = 276;
  const pad = { top: 22, right: 24, bottom: 32, left: 50 };
  const pts = hop.points;

  if (pts.length < 2 || hop.distanceKm <= 0) {
    return null;
  }

  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const p of pts) {
    minY = Math.min(minY, p.groundElevationM, p.fresnel1LowerM);
    maxY = Math.max(maxY, p.effectiveTerrainM, p.fresnel1UpperM, p.losHeightM);
  }
  const spanY = Math.max(25, maxY - minY);
  const yMin = Math.floor((minY - spanY * 0.08) / 5) * 5;
  const yMax = Math.ceil((maxY + spanY * 0.14) / 5) * 5;

  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const maxDist = Math.max(0.001, hop.distanceKm);

  const xOf = (d: number) => pad.left + (d / maxDist) * plotW;
  const yOf = (e: number) =>
    pad.top + (1 - (e - yMin) / Math.max(1, yMax - yMin)) * plotH;

  const baseBottom = pad.top + plotH;
  const terrainLine = pts
    .map(
      (p, i) =>
        `${i === 0 ? 'M' : 'L'} ${xOf(p.distanceKm).toFixed(1)} ${yOf(p.groundElevationM + p.earthBulgeM).toFixed(1)}`,
    )
    .join(' ');
  const terrainArea = `${terrainLine} L ${xOf(maxDist).toFixed(1)} ${baseBottom} L ${pad.left} ${baseBottom} Z`;

  const clutterUpper = pts.map(
    (p) => `${xOf(p.distanceKm).toFixed(1)} ${yOf(p.effectiveTerrainM).toFixed(1)}`,
  );
  const clutterLower = [...pts]
    .reverse()
    .map(
      (p) =>
        `${xOf(p.distanceKm).toFixed(1)} ${yOf(p.groundElevationM + p.earthBulgeM).toFixed(1)}`,
    );
  const clutterArea = `M ${clutterUpper.join(' L ')} L ${clutterLower.join(' L ')} Z`;

  const f1Upper = pts.map(
    (p) => `${xOf(p.distanceKm).toFixed(1)} ${yOf(p.fresnel1UpperM).toFixed(1)}`,
  );
  const f1Lower = [...pts]
    .reverse()
    .map(
      (p) => `${xOf(p.distanceKm).toFixed(1)} ${yOf(p.fresnel1LowerM).toFixed(1)}`,
    );
  const f1Polygon = `M ${f1Upper.join(' L ')} L ${f1Lower.join(' L ')} Z`;

  const f60LowerLine = pts
    .map(
      (p, i) =>
        `${i === 0 ? 'M' : 'L'} ${xOf(p.distanceKm).toFixed(1)} ${yOf(p.fresnel60LowerM).toFixed(1)}`,
    )
    .join(' ');

  const losStart = pts[0]!;
  const losEnd = pts[pts.length - 1]!;
  const worst = hop.worstPoint;
  const isClear = hop.minClearanceRatio >= 0.6;
  const losStroke =
    hop.minClearanceRatio < 0
      ? '#f87171'
      : isClear
        ? '#34d399'
        : '#fbbf24';

  const yTicks = [0, 0.33, 0.67, 1].map((t) => Math.round(yMin + (yMax - yMin) * t));
  const xTicks = [0, 0.25, 0.5, 0.75, 1].map((t) => maxDist * t);

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={`Interactive terrain elevation and 1st Fresnel zone profile for ${hop.label}`}
      className="w-full h-auto block select-none"
    >
      <defs>
        <linearGradient id="ls-preview-terrain" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3c5270" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#121923" stopOpacity="0.95" />
        </linearGradient>
      </defs>

      {/* Subtle horizontal gridlines */}
      {yTicks.map((val, idx) => {
        const y = yOf(val);
        return (
          <g key={idx}>
            <line
              x1={pad.left}
              x2={width - pad.right}
              y1={y}
              y2={y}
              stroke="rgb(244 242 234 / 0.08)"
              strokeDasharray="3 4"
            />
            <text
              x={pad.left - 8}
              y={y + 3}
              textAnchor="end"
              fill="#8fa1b9"
              fontSize="10"
              fontFamily="IBM Plex Mono, monospace"
            >
              {val}m
            </text>
          </g>
        );
      })}

      {/* Distance ticks */}
      {xTicks.map((d, idx) => {
        const x = xOf(d);
        return (
          <text
            key={idx}
            x={x}
            y={height - 10}
            textAnchor="middle"
            fill="#8fa1b9"
            fontSize="10"
            fontFamily="IBM Plex Mono, monospace"
          >
            {d.toFixed(1)} km
          </text>
        );
      })}

      {/* 1st Fresnel Envelope */}
      <path
        d={f1Polygon}
        fill="rgb(56 189 248 / 0.14)"
        stroke="rgb(56 189 248 / 0.45)"
        strokeWidth="1"
      />
      <path
        d={f60LowerLine}
        fill="none"
        stroke="#fbbf24"
        strokeWidth="1.3"
        strokeDasharray="4 4"
      />

      {/* Clutter & Terrain */}
      <path d={clutterArea} fill="rgb(100 116 139 / 0.42)" />
      <path d={terrainArea} fill="url(#ls-preview-terrain)" />
      <path d={terrainLine} fill="none" stroke="#859bb8" strokeWidth="1.6" />

      {/* Direct Line of Sight Ray */}
      <line
        x1={xOf(losStart.distanceKm)}
        y1={yOf(losStart.losHeightM)}
        x2={xOf(losEnd.distanceKm)}
        y2={yOf(losEnd.losHeightM)}
        stroke={losStroke}
        strokeWidth="2.2"
      />

      {/* TX & RX Tower Masts */}
      <line
        x1={xOf(losStart.distanceKm)}
        y1={yOf(losStart.groundElevationM)}
        x2={xOf(losStart.distanceKm)}
        y2={yOf(losStart.losHeightM)}
        stroke="#38bdf8"
        strokeWidth="3"
      />
      <circle
        cx={xOf(losStart.distanceKm)}
        cy={yOf(losStart.losHeightM)}
        r="4"
        fill="#38bdf8"
      />
      <line
        x1={xOf(losEnd.distanceKm)}
        y1={yOf(losEnd.groundElevationM)}
        x2={xOf(losEnd.distanceKm)}
        y2={yOf(losEnd.losHeightM)}
        stroke="#34d399"
        strokeWidth="3"
      />
      <circle
        cx={xOf(losEnd.distanceKm)}
        cy={yOf(losEnd.losHeightM)}
        r="4"
        fill="#34d399"
      />

      {/* Worst Fresnel clearance pinch marker */}
      {worst && (
        <g>
          <line
            x1={xOf(worst.distanceKm)}
            x2={xOf(worst.distanceKm)}
            y1={yOf(worst.effectiveTerrainM)}
            y2={yOf(worst.losHeightM)}
            stroke={losStroke}
            strokeWidth="1.4"
            strokeDasharray="2 2"
          />
          <circle
            cx={xOf(worst.distanceKm)}
            cy={yOf(worst.effectiveTerrainM)}
            r="4.5"
            fill={losStroke}
            stroke="#111722"
            strokeWidth="1.5"
          />
        </g>
      )}
    </svg>
  );
}

export function InteractiveWorkbenchShowcase({
  onNavigate,
}: InteractiveWorkbenchShowcaseProps) {
  const [selectedId, setSelectedId] = useState('bandung-lembang-relay');
  const [modeOverride, setModeOverride] = useState<LinkMode>('relay');
  const [antennaHeightM, setAntennaHeightM] = useState(30);
  const [selectedHopTab, setSelectedHopTab] = useState<'hop1' | 'hop2' | 'direct'>('hop1');

  const evaluated = useMemo(
    () =>
      evaluateLandingScenario(selectedId, {
        mode: modeOverride,
        antennaHeightM,
      }),
    [selectedId, modeOverride, antennaHeightM],
  );

  const { analysis, scenario } = evaluated;

  const activeHop = useMemo(() => {
    if (scenario.mode === 'ptp') return analysis.hops[0]!;
    if (selectedHopTab === 'direct' && analysis.directReference) {
      return analysis.directReference;
    }
    return (
      analysis.hops.find((h) => h.hopId === selectedHopTab) ?? analysis.hops[0]!
    );
  }, [analysis, scenario.mode, selectedHopTab]);

  const handleSelectScenario = (id: string) => {
    const preset = DEMO_SCENARIOS.find((s) => s.id === id) ?? DEMO_SCENARIOS[0]!;
    setSelectedId(preset.id);
    setModeOverride(preset.mode);
    setAntennaHeightM(preset.tx.antennaHeightM);
    setSelectedHopTab(preset.mode === 'relay' ? 'hop1' : 'direct');
  };

  const handleRouteClick = (
    e: React.MouseEvent<HTMLAnchorElement>,
    to: string,
  ) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    onNavigate(to);
  };

  const clearancePct = Math.round(activeHop.minClearanceRatio * 100);
  const verdictPillColor =
    activeHop.verdict === 'pass'
      ? { bg: 'rgb(52 211 153 / 0.16)', fg: '#34d399', border: 'rgb(52 211 153 / 0.35)' }
      : activeHop.verdict === 'marginal'
        ? { bg: 'rgb(251 191 36 / 0.16)', fg: '#fbbf24', border: 'rgb(251 191 36 / 0.35)' }
        : { bg: 'rgb(248 113 113 / 0.16)', fg: '#f87171', border: 'rgb(248 113 113 / 0.35)' };

  return (
    <>
      {/* Standards Proof Strip */}
      <section className="ls-strip" aria-label="Standards and models">
        <div className="ls-container flex items-center justify-center mb-3.5">
          <span className="ls-mono text-[10.5px] uppercase tracking-[0.07em] text-[var(--ls-dim)]">
            Built on proven RF &amp; geodetic standards
          </span>
        </div>

        <div className="ls-strip-belt">
          <div className="ls-strip-track">
            {STANDARDS_STRIP.map((label) => (
              <span
                key={`a-${label}`}
                className="ls-mono text-[12px] tracking-[0.06em] text-[var(--ls-ink-soft)] px-7 whitespace-nowrap"
              >
                {label}
              </span>
            ))}
            {STANDARDS_STRIP.map((label) => (
              <span
                key={`b-${label}`}
                aria-hidden="true"
                className="ls-strip-clone ls-mono text-[12px] tracking-[0.06em] text-[var(--ls-ink-soft)] px-7 whitespace-nowrap"
              >
                {label}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Section 3: Interactive Terrain & Fresnel Preview */}
      <section id="workbench" className="ls-section">
        <div className="ls-section-in">
          <div className="max-w-[680px]">
            <span className="ls-kicker">Interactive Workbench</span>
            <h2 className="ls-h2">See your whole RF link on one canvas</h2>
            <p className="ls-lede mt-3.5">
              Terrain elevation, 1st Fresnel zone clearance, knife-edge diffraction,
              and repeater gain stay computed side by side—no spreadsheets,
              desktop GIS licenses, or manual path conversions.
            </p>
          </div>

          {/* Framed Interactive RF Workbench Preview */}
          <div
            className="mt-9 rounded-[6px] overflow-hidden border border-[var(--ls-line-2)]"
            style={{
              colorScheme: 'only dark',
              backgroundColor: '#111722',
              color: '#f1f5f9',
              boxShadow: 'var(--ls-shadow-card)',
            }}
          >
            {/* Preview Top Chrome */}
            <div className="px-4 py-3 border-b border-white/10 bg-[#0d121c] flex flex-wrap items-center justify-between gap-3">
              <div
                className="flex flex-wrap items-center gap-1.5"
                role="group"
                aria-label="Corridor scenario presets"
              >
                {DEMO_SCENARIOS.map((preset) => {
                  const active = preset.id === selectedId;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => handleSelectScenario(preset.id)}
                      aria-pressed={active}
                      className="px-2.5 py-1.5 rounded-[4px] text-[11.5px] font-medium border cursor-pointer transition-colors duration-150"
                      style={{
                        backgroundColor: active ? '#1f4d74' : 'transparent',
                        borderColor: active ? '#38bdf8' : 'rgb(255 255 255 / 0.14)',
                        color: active ? '#ffffff' : '#cbd5e1',
                      }}
                    >
                      {preset.name.split(' ')[0]} ·{' '}
                      {preset.propagation.frequencyMhz >= 1000
                        ? `${Number((preset.propagation.frequencyMhz / 1000).toFixed(1))} GHz`
                        : `${Number(preset.propagation.frequencyMhz.toFixed(1))} MHz`}
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center gap-2">
                <div
                  role="group"
                  aria-label="Link topology mode"
                  className="inline-flex rounded-[4px] p-0.5 border border-white/15 bg-[#182130]"
                >
                  <button
                    type="button"
                    onClick={() => {
                      setModeOverride('ptp');
                      setSelectedHopTab('direct');
                    }}
                    aria-pressed={modeOverride === 'ptp'}
                    className="px-2.5 py-1 rounded-[3px] text-[11px] font-medium border-0 cursor-pointer transition-colors duration-150"
                    style={{
                      backgroundColor:
                        modeOverride === 'ptp' ? '#38bdf8' : 'transparent',
                      color: modeOverride === 'ptp' ? '#07131e' : '#cbd5e1',
                    }}
                  >
                    Point-to-Point
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setModeOverride('relay');
                      setSelectedHopTab('hop1');
                    }}
                    aria-pressed={modeOverride === 'relay'}
                    className="px-2.5 py-1 rounded-[3px] text-[11px] font-medium border-0 cursor-pointer transition-colors duration-150"
                    style={{
                      backgroundColor:
                        modeOverride === 'relay' ? '#38bdf8' : 'transparent',
                      color: modeOverride === 'relay' ? '#07131e' : '#cbd5e1',
                    }}
                  >
                    Repeater Relay
                  </button>
                </div>

                <span
                  className="ls-mono text-[10.5px] font-semibold px-2 py-1 rounded-[3px] border"
                  style={{
                    backgroundColor: verdictPillColor.bg,
                    color: verdictPillColor.fg,
                    borderColor: verdictPillColor.border,
                  }}
                >
                  {verdictLabel(activeHop.verdict)}
                </span>
              </div>
            </div>

            {/* Interactive Controls + Live Telemetry Strip */}
            <div className="px-4 py-3 border-b border-white/10 bg-[#151d2b] flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-4">
                <label className="flex items-center gap-3 text-[12px] text-[#cbd5e1]">
                  <span className="font-medium">Antenna Height (AGL)</span>
                  <input
                    type="range"
                    min={10}
                    max={80}
                    step={2}
                    value={antennaHeightM}
                    onChange={(e) => setAntennaHeightM(Number(e.target.value))}
                    className="ls-range-slider w-32 sm:w-40"
                  />
                  <span className="ls-mono text-[12px] font-semibold text-[#38bdf8] w-11">
                    {antennaHeightM} m
                  </span>
                </label>

                {scenario.mode === 'relay' && (
                  <div
                    role="group"
                    aria-label="Inspect relay hop"
                    className="inline-flex items-center gap-1"
                  >
                    {(['hop1', 'hop2', 'direct'] as const).map((hopKey) => {
                      const active = selectedHopTab === hopKey;
                      const label =
                        hopKey === 'hop1'
                          ? 'Hop 1 (TX → RPT)'
                          : hopKey === 'hop2'
                            ? 'Hop 2 (RPT → RX)'
                            : 'Direct Ref (No Relay)';
                      return (
                        <button
                          key={hopKey}
                          type="button"
                          onClick={() => setSelectedHopTab(hopKey)}
                          aria-pressed={active}
                          className="px-2 py-1 rounded-[3px] text-[11px] border cursor-pointer"
                          style={{
                            backgroundColor: active
                              ? 'rgb(56 189 248 / 0.16)'
                              : 'transparent',
                            borderColor: active
                              ? '#38bdf8'
                              : 'rgb(255 255 255 / 0.12)',
                            color: active ? '#38bdf8' : '#94a3b8',
                          }}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 sm:flex sm:items-center gap-4 text-[11px]">
                <div>
                  <span className="text-[#8fa1b9] block">Path Distance</span>
                  <span className="ls-mono text-[13px] font-semibold text-white">
                    {activeHop.distanceKm.toFixed(1)} km
                  </span>
                </div>
                <div>
                  <span className="text-[#8fa1b9] block">Rx Signal</span>
                  <span className="ls-mono text-[13px] font-semibold text-white">
                    {activeHop.rslDbm.toFixed(1)} dBm
                  </span>
                </div>
                <div>
                  <span className="text-[#8fa1b9] block">Fade Margin</span>
                  <span
                    className="ls-mono text-[13px] font-semibold"
                    style={{ color: verdictPillColor.fg }}
                  >
                    {activeHop.fadeMarginDb >= 0 ? '+' : ''}
                    {activeHop.fadeMarginDb.toFixed(1)} dB
                  </span>
                </div>
                <div>
                  <span className="text-[#8fa1b9] block">1st Fresnel</span>
                  <span
                    className="ls-mono text-[13px] font-semibold"
                    style={{ color: verdictPillColor.fg }}
                  >
                    {clearancePct}%
                  </span>
                </div>
                <div className="hidden md:block">
                  <span className="text-[#8fa1b9] block">Diffraction Loss</span>
                  <span className="ls-mono text-[13px] font-semibold text-white">
                    {activeHop.diffractionLossDb.toFixed(1)} dB
                  </span>
                </div>
              </div>
            </div>

            {/* Real Computed SVG Terrain + Fresnel Cross-Section */}
            <div className="p-3 sm:p-5 bg-[#0e141f]">
              <MiniFresnelSvg hop={activeHop} />
            </div>

            {/* Bottom Action Bar */}
            <div className="px-4 py-3 border-t border-white/10 bg-[#151d2b] flex flex-wrap items-center justify-between gap-3">
              <div className="text-[12px] text-[#cbd5e1]">
                {activeHop.heightAdvisor.needed ? (
                  <span>
                    <strong className="text-[#fbbf24] font-semibold">
                      Tower Height Advisor:
                    </strong>{' '}
                    Raising masts by{' '}
                    <span className="ls-mono text-white font-semibold">
                      +{activeHop.heightAdvisor.extraBalancedM.toFixed(1)} m
                    </span>{' '}
                    restores &ge;60% 1st Fresnel clearance on this path.
                  </span>
                ) : (
                  <span>
                    <strong className="text-[#34d399] font-semibold">
                      Clearance Verified:
                    </strong>{' '}
                    1st Fresnel corridor meets &ge;60% clearance along{' '}
                    {activeHop.label}.
                  </span>
                )}
              </div>

              <a
                href={`/planner?preset=${selectedId}`}
                onClick={(e) =>
                  handleRouteClick(e, `/planner?preset=${selectedId}`)
                }
                className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-[#38bdf8] no-underline hover:underline"
              >
                <span>Open {scenario.name.split(' ')[0]} in full 3D workbench</span>
                <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
              </a>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
