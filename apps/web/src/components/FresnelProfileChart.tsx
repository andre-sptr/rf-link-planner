import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  ChevronDown,
  ChevronUp,
  GripHorizontal,
  Maximize2,
  Minimize2,
} from 'lucide-react';
import type { FresnelPoint, HopAnalysis } from '@linksight/rf-engine';
import { verdictColors } from './KpiRibbon';

export type FresnelDrawerState = 'normal' | 'expanded' | 'minimized';

export interface FresnelProfileChartProps {
  hops: HopAnalysis[];
  directReference?: HopAnalysis;
  selectedHopId: 'direct' | 'hop1' | 'hop2';
  drawerState: FresnelDrawerState;
  heightPx: number;
  inspectorOpen: boolean;
  onChangeDrawerState: (state: FresnelDrawerState) => void;
  onChangeHeightPx: (px: number) => void;
  onSelectHop: (hopId: 'direct' | 'hop1' | 'hop2') => void;
  onHoverPoint: (point: FresnelPoint | null) => void;
  svgRef: React.RefObject<SVGSVGElement | null>;
}

const PAD = { top: 20, right: 24, bottom: 26, left: 52 };

function compactHopTitle(hop: HopAnalysis, totalHops: number): string {
  if (hop.hopId === 'hop1') return 'Hop 1: TX → RPT';
  if (hop.hopId === 'hop2') return 'Hop 2: RPT → RX';
  if (hop.hopId === 'direct' && totalHops > 1) return 'Direct Ref (TX → RX)';
  return hop.label;
}

export function FresnelProfileChart({
  hops,
  directReference,
  selectedHopId,
  drawerState,
  heightPx,
  inspectorOpen,
  onChangeDrawerState,
  onChangeHeightPx,
  onSelectHop,
  onHoverPoint,
  svgRef,
}: FresnelProfileChartProps) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ width: 820, height: heightPx });
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [layers, setLayers] = useState({
    f1: true,
    f60: true,
    clutter: true,
    bulge: true,
  });

  const dragStartRef = useRef<{ y: number; h: number } | null>(null);

  const availableHops = useMemo(() => {
    const list = [...hops];
    if (directReference) list.push(directReference);
    return list;
  }, [hops, directReference]);

  const activeHop =
    availableHops.find((h) => h.hopId === selectedHopId) ?? availableHops[0]!;

  useEffect(() => {
    const el = wrapRef.current;
    if (!el || typeof ResizeObserver === 'undefined' || drawerState === 'minimized') {
      return;
    }

    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const w = Math.round(entry.contentRect.width);
      const h = Math.round(entry.contentRect.height);
      if (w > 120 && h > 90) {
        setSize({ width: w, height: h });
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [drawerState, heightPx, inspectorOpen]);

  const activeSvgHeight =
    drawerState === 'expanded' ? 330 : Math.max(156, Math.min(400, heightPx));

  const geometry = useMemo(() => {
    const pts = activeHop.points;
    if (pts.length < 2 || activeHop.distanceKm <= 0) return null;

    let minY = Number.POSITIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;

    for (const p of pts) {
      minY = Math.min(minY, p.groundElevationM, p.fresnel1LowerM);
      maxY = Math.max(
        maxY,
        p.effectiveTerrainM,
        p.fresnel1UpperM,
        p.losHeightM,
      );
    }

    const spanY = Math.max(25, maxY - minY);
    const yMin = Math.floor((minY - spanY * 0.08) / 5) * 5;
    const yMax = Math.ceil((maxY + spanY * 0.12) / 5) * 5;

    const plotW = Math.max(120, size.width - PAD.left - PAD.right);
    const plotH = Math.max(80, size.height - PAD.top - PAD.bottom);
    const maxDist = Math.max(0.001, activeHop.distanceKm);

    const xOf = (distKm: number) => PAD.left + (distKm / maxDist) * plotW;
    const yOf = (elevM: number) =>
      PAD.top + ((yMax - elevM) / (yMax - yMin)) * plotH;

    const terrainCoords = pts
      .map((p) => `${xOf(p.distanceKm).toFixed(1)},${yOf(p.effectiveTerrainM).toFixed(1)}`)
      .join(' ');

    const baselineY = yOf(yMin);
    const terrainPolygon = `${xOf(0).toFixed(1)},${baselineY.toFixed(1)} ${terrainCoords} ${xOf(maxDist).toFixed(1)},${baselineY.toFixed(1)}`;

    const rawGroundPoints = pts.map(
      (p) => `${xOf(p.distanceKm).toFixed(1)},${yOf(p.groundElevationM).toFixed(1)}`,
    );
    const rawGroundPolyline = rawGroundPoints.join(' ');

    const effectiveTopForward = pts.map(
      (p) => `${xOf(p.distanceKm).toFixed(1)},${yOf(p.effectiveTerrainM).toFixed(1)}`,
    );
    const rawGroundReverse = [...rawGroundPoints].reverse();
    const clutterBandPolygon = `${effectiveTopForward.join(' ')} ${rawGroundReverse.join(' ')}`;

    const losStart = pts[0]!;
    const losEnd = pts[pts.length - 1]!;

    const f1Upper = pts.map(
      (p) => `${xOf(p.distanceKm).toFixed(1)},${yOf(p.fresnel1UpperM).toFixed(1)}`,
    );
    const f1LowerRev = [...pts]
      .reverse()
      .map(
        (p) => `${xOf(p.distanceKm).toFixed(1)},${yOf(p.fresnel1LowerM).toFixed(1)}`,
      );
    const f1Polygon = `${f1Upper.join(' ')} ${f1LowerRev.join(' ')}`;

    const f60Upper = pts.map(
      (p) =>
        `${xOf(p.distanceKm).toFixed(1)},${yOf(p.losHeightM + p.fresnel60RadiusM).toFixed(1)}`,
    );
    const f60LowerRev = [...pts]
      .reverse()
      .map(
        (p) => `${xOf(p.distanceKm).toFixed(1)},${yOf(p.fresnel60LowerM).toFixed(1)}`,
      );
    const f60Polygon = `${f60Upper.join(' ')} ${f60LowerRev.join(' ')}`;

    const bulgeCurve = pts
      .map((p) => {
        const chordGround =
          losStart.groundElevationM * (1 - p.fraction) +
          losEnd.groundElevationM * p.fraction;
        return `${xOf(p.distanceKm).toFixed(1)},${yOf(chordGround + p.earthBulgeM).toFixed(1)}`;
      })
      .join(' ');

    const yTicks = Array.from({ length: 5 }, (_, idx) => {
      const val = yMin + ((yMax - yMin) * idx) / 4;
      return { val, y: yOf(val) };
    });

    const xTicks = Array.from({ length: 5 }, (_, idx) => {
      const dist = (maxDist * idx) / 4;
      return { dist, x: xOf(dist) };
    });

    return {
      pts,
      xOf,
      yOf,
      yMin,
      yMax,
      plotW,
      plotH,
      terrainCoords,
      terrainPolygon,
      rawGroundPolyline,
      clutterBandPolygon,
      f1Polygon,
      f60Polygon,
      bulgeCurve,
      losStart,
      losEnd,
      yTicks,
      xTicks,
    };
  }, [activeHop, size]);

  const hovered =
    hoverIdx !== null && activeHop.points[hoverIdx]
      ? activeHop.points[hoverIdx]!
      : null;

  const badge = verdictColors(activeHop.verdict);

  const txRoleLabel = activeHop.hopId === 'hop2' ? 'RPT' : 'TX';
  const rxRoleLabel = activeHop.hopId === 'hop1' ? 'RPT' : 'RX';
  const txRoleColor = activeHop.hopId === 'hop2' ? 'var(--role-rpt)' : 'var(--role-tx)';
  const rxRoleColor = activeHop.hopId === 'hop1' ? 'var(--role-rpt)' : 'var(--role-rx)';

  const handlePointerMove = (clientX: number) => {
    if (!geometry || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const relX = clientX - rect.left - PAD.left;
    const frac = Math.max(0, Math.min(1, relX / Math.max(1, geometry.plotW)));
    const idx = Math.round(frac * (geometry.pts.length - 1));
    setHoverIdx(idx);
    onHoverPoint(geometry.pts[idx] ?? null);
  };

  const handleSvgKeyDown = (e: React.KeyboardEvent<SVGSVGElement>) => {
    if (!geometry) return;
    const maxIdx = geometry.pts.length - 1;
    const step = e.shiftKey ? 5 : 1;

    if (e.key === 'ArrowRight') {
      e.preventDefault();
      const next = hoverIdx === null ? 0 : Math.min(maxIdx, hoverIdx + step);
      setHoverIdx(next);
      onHoverPoint(geometry.pts[next] ?? null);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      const next = hoverIdx === null ? maxIdx : Math.max(0, hoverIdx - step);
      setHoverIdx(next);
      onHoverPoint(geometry.pts[next] ?? null);
    } else if (e.key === 'Home') {
      e.preventDefault();
      setHoverIdx(0);
      onHoverPoint(geometry.pts[0] ?? null);
    } else if (e.key === 'End') {
      e.preventDefault();
      setHoverIdx(maxIdx);
      onHoverPoint(geometry.pts[maxIdx] ?? null);
    } else if (e.key === 'Escape') {
      setHoverIdx(null);
      onHoverPoint(null);
    }
  };

  const calloutLayout = useMemo(() => {
    if (!hovered || !geometry) return null;
    const x = geometry.xOf(hovered.distanceKm);
    const boxW = 192;
    const boxH = 42;
    const flipLeft = x + boxW + 14 > size.width - PAD.right;
    const boxX = flipLeft ? x - boxW - 10 : x + 10;
    const boxY = Math.max(PAD.top + 2, Math.min(size.height - PAD.bottom - boxH - 4, PAD.top + 4));
    return { x, boxX, boxY, boxW, boxH };
  }, [hovered, geometry, size]);

  const toggleLayer = (key: keyof typeof layers) => {
    setLayers((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <section
      className={`rf-hud-surface rounded-none lg:rounded-2xl flex flex-col select-none shrink-0 pointer-events-auto overflow-hidden
        lg:fixed lg:bottom-3 lg:right-3 lg:z-20
        transition-[left] duration-[240ms] [transition-timing-function:var(--ease-drawer)]
        ${inspectorOpen ? 'lg:left-[368px] xl:left-[400px]' : 'lg:left-3'}`}
      aria-label="Terrain elevation and Fresnel zone profile"
    >
      {/* Drag Resize Handle (visible on desktop when open) */}
      {drawerState !== 'minimized' && (
        <div
          role="separator"
          aria-orientation="horizontal"
          aria-label="Resize Fresnel profile chart height"
          className="hidden lg:flex items-center justify-center h-3 w-full cursor-ns-resize border-b hover:bg-[var(--bg-hover)] transition-colors"
          style={{ borderColor: 'var(--border-subtle)' }}
          onPointerDown={(e) => {
            e.preventDefault();
            e.currentTarget.setPointerCapture(e.pointerId);
            dragStartRef.current = { y: e.clientY, h: activeSvgHeight };
            if (drawerState === 'expanded') {
              onChangeDrawerState('normal');
            }
          }}
          onPointerMove={(e) => {
            if (!dragStartRef.current) return;
            const delta = dragStartRef.current.y - e.clientY;
            const next = Math.max(156, Math.min(400, Math.round(dragStartRef.current.h + delta)));
            onChangeHeightPx(next);
          }}
          onPointerUp={(e) => {
            if (dragStartRef.current) {
              dragStartRef.current = null;
              if (e.currentTarget.hasPointerCapture(e.pointerId)) {
                e.currentTarget.releasePointerCapture(e.pointerId);
              }
            }
          }}
        >
          <GripHorizontal
            className="w-4 h-3"
            style={{ color: 'var(--text-muted)' }}
            aria-hidden="true"
          />
        </div>
      )}

      {/* Hop Switcher & Telemetry Header */}
      <div
        className="flex flex-wrap xl:flex-nowrap items-center justify-between gap-2 px-3 py-1.5 border-b text-xs"
        style={{
          borderColor: drawerState === 'minimized' ? 'transparent' : 'var(--border-subtle)',
        }}
      >
        <div
          role="group"
          aria-label="Path hop selector"
          className="flex flex-wrap items-center gap-1 shrink-0"
        >
          <span
            className="inline-flex items-center mr-0.5"
            title="Terrain & Fresnel Profile"
            aria-hidden="true"
          >
            <Activity className="w-3.5 h-3.5" style={{ color: 'var(--accent)' }} />
          </span>

          {availableHops.map((hop) => {
            const active = hop.hopId === activeHop.hopId;
            const hopBadge = verdictColors(hop.verdict);
            return (
              <button
                key={hop.hopId}
                type="button"
                aria-pressed={active}
                title={hop.label}
                onClick={() => {
                  setHoverIdx(null);
                  onHoverPoint(null);
                  onSelectHop(hop.hopId);
                }}
                className="rf-pill-btn py-0.5 px-2 text-[11px]"
              >
                <span
                  className="inline-block w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: hopBadge.color }}
                  aria-hidden="true"
                />
                <span className="truncate max-w-[165px]">
                  {compactHopTitle(hop, availableHops.length)}
                </span>
                <span
                  className="font-mono-num text-[10px] font-semibold px-1 py-0.2 rounded"
                  style={{ color: hopBadge.color, backgroundColor: hopBadge.bg }}
                >
                  {hopBadge.label}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2 min-w-0 ml-auto">
          <div className="font-mono-num text-[11px] truncate">
            {hovered ? (
              <span>
                d={hovered.distanceKm.toFixed(2)} km · Ground{' '}
                {hovered.groundElevationM.toFixed(0)} m · LOS{' '}
                {hovered.losHeightM.toFixed(0)} m · Clear{' '}
                {hovered.clearanceM >= 0 ? '+' : ''}
                {hovered.clearanceM.toFixed(1)} m (
                {(hovered.clearanceRatio * 100).toFixed(0)}% F1)
              </span>
            ) : (
              <span style={{ color: 'var(--text-secondary)' }}>
                Max F1: {activeHop.maxFresnel1RadiusM.toFixed(1)} m · Clear:{' '}
                {(activeHop.minClearanceRatio * 100).toFixed(0)}% F1
                <span className="hidden 2xl:inline">
                  {' '}
                  · L_diff: {activeHop.diffractionLossDb.toFixed(1)} dB
                </span>
              </span>
            )}
          </div>

          {drawerState !== 'minimized' && (
            <button
              type="button"
              onClick={() =>
                onChangeDrawerState(drawerState === 'expanded' ? 'normal' : 'expanded')
              }
              className="rf-icon-btn hidden lg:inline-flex"
              aria-label={
                drawerState === 'expanded'
                  ? 'Compact Fresnel profile height'
                  : 'Expand Fresnel profile height'
              }
              title={drawerState === 'expanded' ? 'Compact profile' : 'Expand profile'}
            >
              {drawerState === 'expanded' ? (
                <Minimize2 className="w-3.5 h-3.5" aria-hidden="true" />
              ) : (
                <Maximize2 className="w-3.5 h-3.5" aria-hidden="true" />
              )}
            </button>
          )}

          <button
            type="button"
            onClick={() =>
              onChangeDrawerState(drawerState === 'minimized' ? 'normal' : 'minimized')
            }
            className="rf-btn-subtle px-2 py-1 text-[11px]"
            aria-label={
              drawerState === 'minimized'
                ? 'Show Fresnel profile chart'
                : 'Minimize Fresnel profile chart'
            }
            title={
              drawerState === 'minimized'
                ? 'Show Fresnel profile'
                : 'Minimize Fresnel profile'
            }
          >
            {drawerState === 'minimized' ? (
              <>
                <ChevronUp className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Show Profile</span>
              </>
            ) : (
              <>
                <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />
                <span className="hidden sm:inline">Minimize</span>
              </>
            )}
          </button>
        </div>
      </div>

      {drawerState !== 'minimized' && (
        <>
          {/* Interactive Legend Filter Strip */}
          <div
            className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 px-3 py-1 border-b text-[11px]"
            style={{
              borderColor: 'var(--border-subtle)',
              color: 'var(--text-secondary)',
            }}
            aria-label="Chart legend"
          >
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="inline-flex items-center gap-1.5 px-1.5 py-0.5 text-[11px]">
                <span
                  className="inline-block w-3.5 h-0.5 rounded-full"
                  style={{ backgroundColor: badge.color }}
                  aria-hidden="true"
                />
                <span>LOS Ray</span>
              </span>

              <button
                type="button"
                aria-pressed={layers.f1}
                onClick={() => toggleLayer('f1')}
                className="rf-legend-chip"
                title="Toggle 1st Fresnel envelope"
              >
                <span
                  className="inline-block w-3 h-2 rounded-xs border border-dashed"
                  style={{
                    borderColor: 'var(--accent)',
                    backgroundColor: 'color-mix(in srgb, var(--accent) 18%, transparent)',
                  }}
                  aria-hidden="true"
                />
                <span>1st Fresnel (F1)</span>
              </button>

              <button
                type="button"
                aria-pressed={layers.f60}
                onClick={() => toggleLayer('f60')}
                className="rf-legend-chip"
                title="Toggle 60% F1 clearance corridor"
              >
                <span
                  className="inline-block w-3 h-2 rounded-xs"
                  style={{
                    backgroundColor: badge.color,
                    opacity: 0.34,
                  }}
                  aria-hidden="true"
                />
                <span>60% F1 Corridor</span>
              </button>

              <span className="inline-flex items-center gap-1.5 px-1.5 py-0.5 text-[11px]">
                <span
                  className="inline-block w-3 h-2 rounded-xs border"
                  style={{
                    backgroundColor: 'var(--terrain-fill)',
                    borderColor: 'var(--terrain-stroke)',
                  }}
                  aria-hidden="true"
                />
                <span>SRTM Terrain</span>
              </span>

              <button
                type="button"
                aria-pressed={layers.clutter}
                onClick={() => toggleLayer('clutter')}
                className="rf-legend-chip"
                title="Toggle vegetation/urban clutter band"
              >
                <span
                  className="inline-block w-3 h-2 rounded-xs border"
                  style={{
                    backgroundColor: 'color-mix(in srgb, var(--clutter-fill) 40%, transparent)',
                    borderColor: 'var(--terrain-stroke)',
                  }}
                  aria-hidden="true"
                />
                <span>Clutter + Bulge</span>
              </button>

              <button
                type="button"
                aria-pressed={layers.bulge}
                onClick={() => toggleLayer('bulge')}
                className="rf-legend-chip"
                title="Toggle Earth curvature bulge curve"
              >
                <span
                  className="inline-block w-3 border-t border-dotted"
                  style={{ borderColor: 'var(--text-secondary)' }}
                  aria-hidden="true"
                />
                <span>Earth Bulge (k)</span>
              </button>

              {activeHop.worstPoint && activeHop.minClearanceRatio < 0.6 && (
                <span className="inline-flex items-center gap-1.5 px-1.5 py-0.5 text-[11px]">
                  <span
                    className="inline-block w-2 h-2 rounded-full"
                    style={{ backgroundColor: 'var(--status-fail)' }}
                    aria-hidden="true"
                  />
                  <span>Worst Obstruction</span>
                </span>
              )}
            </div>

            <span
              className="hidden xl:inline font-mono-num text-[10px]"
              style={{ color: 'var(--text-muted)' }}
            >
              ← / → scrub · drag edge to resize
            </span>
          </div>

          {/* SVG Elevation & Fresnel Profile Canvas */}
          <div
            ref={wrapRef}
            className="w-full relative"
            style={{ height: `${activeSvgHeight}px`, touchAction: 'pan-y' }}
          >
            {geometry ? (
              <svg
                ref={svgRef}
                width={size.width}
                height={size.height}
                viewBox={`0 0 ${size.width} ${size.height}`}
                tabIndex={0}
                role="img"
                aria-label={`Terrain elevation and 1st Fresnel zone clearance profile for ${activeHop.label}. Use Left and Right arrow keys to inspect path points.`}
                className="w-full h-full block cursor-crosshair focus-visible:outline-2 focus-visible:outline-[var(--accent)] focus-visible:-outline-offset-2"
                onMouseMove={(e) => handlePointerMove(e.clientX)}
                onTouchMove={(e) => {
                  if (e.touches[0]) handlePointerMove(e.touches[0].clientX);
                }}
                onMouseLeave={() => {
                  setHoverIdx(null);
                  onHoverPoint(null);
                }}
                onKeyDown={handleSvgKeyDown}
              >
                <defs>
                  <linearGradient id="ls-terrain-grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--terrain-fill-top)" stopOpacity="0.78" />
                    <stop offset="100%" stopColor="var(--terrain-fill-bottom)" stopOpacity="0.95" />
                  </linearGradient>
                </defs>

                {/* Gridlines & Axis Ticks */}
                {geometry.yTicks.map((tick, idx) => (
                  <g key={idx}>
                    <line
                      x1={PAD.left}
                      y1={tick.y}
                      x2={size.width - PAD.right}
                      y2={tick.y}
                      stroke="var(--grid-line)"
                      strokeDasharray="2 3"
                    />
                    <text
                      x={PAD.left - 7}
                      y={tick.y + 3.5}
                      textAnchor="end"
                      fontSize="10.5"
                      fill="var(--text-secondary)"
                      className="font-mono-num"
                    >
                      {Math.round(tick.val)}m
                    </text>
                  </g>
                ))}

                {geometry.xTicks.map((tick, idx) => (
                  <g key={idx}>
                    <line
                      x1={tick.x}
                      y1={PAD.top}
                      x2={tick.x}
                      y2={size.height - PAD.bottom}
                      stroke="var(--grid-line)"
                      strokeDasharray="2 4"
                    />
                    <text
                      x={tick.x}
                      y={size.height - 8}
                      textAnchor="middle"
                      fontSize="10.5"
                      fill="var(--text-secondary)"
                      className="font-mono-num"
                    >
                      {tick.dist.toFixed(1)} km
                    </text>
                  </g>
                ))}

                {/* 1st Fresnel Zone Envelope */}
                {layers.f1 && (
                  <polygon
                    points={geometry.f1Polygon}
                    fill="var(--accent)"
                    fillOpacity="0.09"
                    stroke="var(--accent)"
                    strokeWidth="1.1"
                    strokeDasharray="4 3"
                    strokeOpacity="0.7"
                  />
                )}

                {/* 60% Fresnel Zone Corridor */}
                {layers.f60 && (
                  <polygon
                    points={geometry.f60Polygon}
                    fill={badge.color}
                    fillOpacity="0.17"
                  />
                )}

                {/* Bare Terrain Fill + Clutter/Bulge Envelope */}
                <polygon points={geometry.terrainPolygon} fill="url(#ls-terrain-grad)" />
                {layers.clutter && (
                  <polygon
                    points={geometry.clutterBandPolygon}
                    fill="var(--clutter-fill)"
                    fillOpacity="0.28"
                  />
                )}
                <polyline
                  points={geometry.rawGroundPolyline}
                  fill="none"
                  stroke="var(--terrain-stroke)"
                  strokeWidth="1.2"
                  strokeOpacity="0.65"
                />
                <polyline
                  points={geometry.terrainCoords}
                  fill="none"
                  stroke="var(--terrain-stroke)"
                  strokeWidth="1.8"
                />

                {/* Earth Curvature Bulge reference curve */}
                {layers.bulge && (
                  <polyline
                    points={geometry.bulgeCurve}
                    fill="none"
                    stroke="var(--text-secondary)"
                    strokeWidth="1"
                    strokeDasharray="2 3"
                    strokeOpacity="0.65"
                  />
                )}

                {/* Direct Line-of-Sight Ray + Soft Beam Halo */}
                <line
                  x1={geometry.xOf(geometry.losStart.distanceKm)}
                  y1={geometry.yOf(geometry.losStart.losHeightM)}
                  x2={geometry.xOf(geometry.losEnd.distanceKm)}
                  y2={geometry.yOf(geometry.losEnd.losHeightM)}
                  stroke={badge.color}
                  strokeOpacity="0.18"
                  strokeWidth="6.5"
                />
                <line
                  x1={geometry.xOf(geometry.losStart.distanceKm)}
                  y1={geometry.yOf(geometry.losStart.losHeightM)}
                  x2={geometry.xOf(geometry.losEnd.distanceKm)}
                  y2={geometry.yOf(geometry.losEnd.losHeightM)}
                  stroke={badge.color}
                  strokeWidth="2.3"
                />

                {/* TX / Start Mast */}
                <line
                  x1={geometry.xOf(0)}
                  y1={geometry.yOf(geometry.losStart.groundElevationM)}
                  x2={geometry.xOf(0)}
                  y2={geometry.yOf(geometry.losStart.losHeightM)}
                  stroke={txRoleColor}
                  strokeWidth="3.2"
                  strokeLinecap="round"
                />
                <circle
                  cx={geometry.xOf(0)}
                  cy={geometry.yOf(geometry.losStart.losHeightM)}
                  r="4.2"
                  fill="var(--bg-panel)"
                  stroke={txRoleColor}
                  strokeWidth="2.2"
                />
                <text
                  x={geometry.xOf(0) + 8}
                  y={Math.max(PAD.top + 10, geometry.yOf(geometry.losStart.losHeightM) - 4)}
                  fontSize="9.5"
                  fontWeight="700"
                  fill={txRoleColor}
                  className="font-mono-num"
                >
                  {txRoleLabel}
                </text>

                {/* RX / End Mast */}
                <line
                  x1={geometry.xOf(activeHop.distanceKm)}
                  y1={geometry.yOf(geometry.losEnd.groundElevationM)}
                  x2={geometry.xOf(activeHop.distanceKm)}
                  y2={geometry.yOf(geometry.losEnd.losHeightM)}
                  stroke={rxRoleColor}
                  strokeWidth="3.2"
                  strokeLinecap="round"
                />
                <circle
                  cx={geometry.xOf(activeHop.distanceKm)}
                  cy={geometry.yOf(geometry.losEnd.losHeightM)}
                  r="4.2"
                  fill="var(--bg-panel)"
                  stroke={rxRoleColor}
                  strokeWidth="2.2"
                />
                <text
                  x={geometry.xOf(activeHop.distanceKm) - 8}
                  y={Math.max(PAD.top + 10, geometry.yOf(geometry.losEnd.losHeightM) - 4)}
                  textAnchor="end"
                  fontSize="9.5"
                  fontWeight="700"
                  fill={rxRoleColor}
                  className="font-mono-num"
                >
                  {rxRoleLabel}
                </text>

                {/* Worst Obstruction Marker */}
                {activeHop.worstPoint && activeHop.minClearanceRatio < 0.6 && (
                  <g>
                    <line
                      x1={geometry.xOf(activeHop.worstPoint.distanceKm)}
                      y1={geometry.yOf(activeHop.worstPoint.losHeightM)}
                      x2={geometry.xOf(activeHop.worstPoint.distanceKm)}
                      y2={geometry.yOf(activeHop.worstPoint.effectiveTerrainM)}
                      stroke="var(--status-fail)"
                      strokeWidth="1.6"
                      strokeDasharray="2 2"
                    />
                    <circle
                      cx={geometry.xOf(activeHop.worstPoint.distanceKm)}
                      cy={geometry.yOf(activeHop.worstPoint.effectiveTerrainM)}
                      r="4.2"
                      fill="var(--status-fail)"
                      stroke="var(--bg-panel)"
                      strokeWidth="1.5"
                    />
                  </g>
                )}

                {/* Interactive Hover Crosshair & Floating Callout */}
                {hovered && calloutLayout && (
                  <g data-hover-overlay="true">
                    <line
                      x1={calloutLayout.x}
                      y1={PAD.top}
                      x2={calloutLayout.x}
                      y2={size.height - PAD.bottom}
                      stroke="var(--accent)"
                      strokeWidth="1.2"
                      strokeDasharray="3 2"
                    />
                    <circle
                      cx={calloutLayout.x}
                      cy={geometry.yOf(hovered.effectiveTerrainM)}
                      r="3.8"
                      fill="var(--accent)"
                      stroke="var(--bg-panel)"
                      strokeWidth="1.3"
                    />
                    <circle
                      cx={calloutLayout.x}
                      cy={geometry.yOf(hovered.losHeightM)}
                      r="3.8"
                      fill={badge.color}
                      stroke="var(--bg-panel)"
                      strokeWidth="1.3"
                    />

                    <rect
                      x={calloutLayout.boxX}
                      y={calloutLayout.boxY}
                      width={calloutLayout.boxW}
                      height={calloutLayout.boxH}
                      rx="8"
                      fill="var(--bg-panel)"
                      stroke="var(--border-strong)"
                      strokeWidth="1"
                    />
                    <text
                      x={calloutLayout.boxX + 9}
                      y={calloutLayout.boxY + 16}
                      fontSize="10"
                      fontWeight="600"
                      fill="var(--text-primary)"
                      className="font-mono-num"
                    >
                      d={hovered.distanceKm.toFixed(2)} km · Ground {hovered.groundElevationM.toFixed(0)}m
                    </text>
                    <text
                      x={calloutLayout.boxX + 9}
                      y={calloutLayout.boxY + 32}
                      fontSize="10"
                      fill={
                        hovered.clearanceRatio >= 0.6
                          ? 'var(--status-pass)'
                          : hovered.clearanceRatio >= 0
                            ? 'var(--status-marginal)'
                            : 'var(--status-fail)'
                      }
                      className="font-mono-num"
                    >
                      Clear {hovered.clearanceM >= 0 ? '+' : ''}
                      {hovered.clearanceM.toFixed(1)} m ({(hovered.clearanceRatio * 100).toFixed(0)}% F1)
                    </text>
                  </g>
                )}
              </svg>
            ) : (
              <div
                className="flex items-center justify-center h-full text-xs"
                style={{ color: 'var(--text-secondary)' }}
              >
                Invalid path geometry — separate TX and RX locations to plot Fresnel clearance.
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}
