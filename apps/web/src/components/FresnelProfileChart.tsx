import { useEffect, useMemo, useRef, useState } from 'react';
import type { FresnelPoint, HopAnalysis } from '@linksight/rf-engine';
import { verdictColors } from './KpiRibbon';

export interface FresnelProfileChartProps {
  hops: HopAnalysis[];
  directReference?: HopAnalysis;
  selectedHopId: 'direct' | 'hop1' | 'hop2';
  onSelectHop: (hopId: 'direct' | 'hop1' | 'hop2') => void;
  onHoverPoint: (point: FresnelPoint | null) => void;
  svgRef: React.RefObject<SVGSVGElement | null>;
}

const PAD = { top: 20, right: 26, bottom: 28, left: 54 };

export function FresnelProfileChart({
  hops,
  directReference,
  selectedHopId,
  onSelectHop,
  onHoverPoint,
  svgRef,
}: FresnelProfileChartProps) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ width: 820, height: 200 });
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const availableHops = useMemo(() => {
    const list = [...hops];
    if (directReference) list.push(directReference);
    return list;
  }, [hops, directReference]);

  const activeHop =
    availableHops.find((h) => h.hopId === selectedHopId) ?? availableHops[0]!;

  useEffect(() => {
    const el = wrapRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;

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
  }, []);

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
    const yMax = Math.ceil((maxY + spanY * 0.1) / 5) * 5;

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

    const rawGroundPolyline = pts
      .map((p) => `${xOf(p.distanceKm).toFixed(1)},${yOf(p.groundElevationM).toFixed(1)}`)
      .join(' ');

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

  const handlePointerMove = (clientX: number) => {
    if (!geometry || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const relX = clientX - rect.left - PAD.left;
    const frac = Math.max(0, Math.min(1, relX / Math.max(1, geometry.plotW)));
    const idx = Math.round(frac * (geometry.pts.length - 1));
    setHoverIdx(idx);
    onHoverPoint(geometry.pts[idx] ?? null);
  };

  return (
    <section
      className="flex flex-col border-t select-none"
      style={{
        backgroundColor: 'var(--bg-panel)',
        borderColor: 'var(--border-subtle)',
      }}
      aria-label="Terrain elevation and Fresnel zone profile"
    >
      <div
        className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 border-b text-xs"
        style={{
          borderColor: 'var(--border-subtle)',
          backgroundColor: 'var(--bg-elevated)',
        }}
      >
        <div className="flex flex-wrap items-center gap-1.5">
          {availableHops.map((hop) => {
            const active = hop.hopId === activeHop.hopId;
            const hopBadge = verdictColors(hop.verdict);
            return (
              <button
                key={hop.hopId}
                type="button"
                onClick={() => {
                  setHoverIdx(null);
                  onHoverPoint(null);
                  onSelectHop(hop.hopId);
                }}
                className="inline-flex items-center gap-1.5 px-2 py-1 rounded border font-medium cursor-pointer"
                style={
                  active
                    ? {
                        backgroundColor: 'var(--bg-panel)',
                        borderColor: 'var(--accent)',
                        color: 'var(--text-primary)',
                      }
                    : {
                        backgroundColor: 'transparent',
                        borderColor: 'transparent',
                        color: 'var(--text-secondary)',
                      }
                }
              >
                <span>
                  {hop.hopId === 'direct' && hops.length > 1
                    ? 'Direct Ref (TX→RX)'
                    : hop.label}
                </span>
                <span
                  className="font-mono-num text-[10px] px-1 rounded"
                  style={{ color: hopBadge.color, backgroundColor: hopBadge.bg }}
                >
                  {hopBadge.label}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-3 font-mono-num text-[11px]">
          {hovered ? (
            <span>
              d={hovered.distanceKm.toFixed(2)} km | Ground{' '}
              {hovered.groundElevationM.toFixed(0)} m | LOS{' '}
              {hovered.losHeightM.toFixed(0)} m | Clear{' '}
              {hovered.clearanceM >= 0 ? '+' : ''}
              {hovered.clearanceM.toFixed(1)} m (
              {(hovered.clearanceRatio * 100).toFixed(0)}% F1)
            </span>
          ) : (
            <span style={{ color: 'var(--text-secondary)' }}>
              Max F1: {activeHop.maxFresnel1RadiusM.toFixed(1)} m | Min Clear:{' '}
              {(activeHop.minClearanceRatio * 100).toFixed(0)}% F1 | L_diff:{' '}
              {activeHop.diffractionLossDb.toFixed(1)} dB
            </span>
          )}
        </div>
      </div>

      <div
        className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-1 border-b text-[11px]"
        style={{
          borderColor: 'var(--border-subtle)',
          color: 'var(--text-secondary)',
        }}
        aria-label="Chart legend"
      >
        <span className="inline-flex items-center gap-1.5">
          <span
            className="inline-block w-3 h-0.5"
            style={{ backgroundColor: badge.color }}
            aria-hidden="true"
          />
          <span>LOS Ray</span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            className="inline-block w-3 h-2 rounded-xs border border-dashed"
            style={{
              borderColor: 'var(--accent)',
              backgroundColor: 'color-mix(in srgb, var(--accent) 18%, transparent)',
            }}
            aria-hidden="true"
          />
          <span>1st Fresnel (F1)</span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            className="inline-block w-3 h-2 rounded-xs"
            style={{
              backgroundColor: badge.color,
              opacity: 0.3,
            }}
            aria-hidden="true"
          />
          <span>60% F1 Corridor</span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            className="inline-block w-3 h-2 rounded-xs border"
            style={{
              backgroundColor: 'var(--terrain-fill)',
              borderColor: 'var(--terrain-stroke)',
            }}
            aria-hidden="true"
          />
          <span>Terrain + Clutter</span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            className="inline-block w-3 border-t border-dotted"
            style={{ borderColor: 'var(--text-secondary)' }}
            aria-hidden="true"
          />
          <span>Earth Bulge (k)</span>
        </span>
        {activeHop.worstPoint && activeHop.minClearanceRatio < 0.6 && (
          <span className="inline-flex items-center gap-1.5">
            <span
              className="inline-block w-2 h-2 rounded-full"
              style={{ backgroundColor: 'var(--status-fail)' }}
              aria-hidden="true"
            />
            <span>Worst Obstruction</span>
          </span>
        )}
      </div>

      <div ref={wrapRef} className="w-full h-[210px] relative">
        {geometry ? (
          <svg
            ref={svgRef}
            width={size.width}
            height={size.height}
            viewBox={`0 0 ${size.width} ${size.height}`}
            className="w-full h-full block cursor-crosshair"
            onMouseMove={(e) => handlePointerMove(e.clientX)}
            onTouchMove={(e) => {
              if (e.touches[0]) handlePointerMove(e.touches[0].clientX);
            }}
            onMouseLeave={() => {
              setHoverIdx(null);
              onHoverPoint(null);
            }}
          >
            {/* Gridlines */}
            {geometry.yTicks.map((tick, idx) => (
              <g key={idx}>
                <line
                  x1={PAD.left}
                  y1={tick.y}
                  x2={size.width - PAD.right}
                  y2={tick.y}
                  stroke="var(--border-subtle)"
                  strokeDasharray="2 3"
                />
                <text
                  x={PAD.left - 6}
                  y={tick.y + 3}
                  textAnchor="end"
                  fontSize="10"
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
                  stroke="var(--border-subtle)"
                  strokeDasharray="2 4"
                />
                <text
                  x={tick.x}
                  y={size.height - 8}
                  textAnchor="middle"
                  fontSize="10"
                  fill="var(--text-secondary)"
                  className="font-mono-num"
                >
                  {tick.dist.toFixed(1)} km
                </text>
              </g>
            ))}

            {/* 1st Fresnel Zone Envelope */}
            <polygon
              points={geometry.f1Polygon}
              fill="var(--accent)"
              fillOpacity="0.08"
              stroke="var(--accent)"
              strokeWidth="1"
              strokeDasharray="4 3"
              strokeOpacity="0.6"
            />

            {/* 60% Fresnel Zone Corridor */}
            <polygon
              points={geometry.f60Polygon}
              fill={badge.color}
              fillOpacity="0.16"
            />

            {/* Terrain + Clutter Polygon */}
            <polygon points={geometry.terrainPolygon} fill="var(--terrain-fill)" />
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
            <polyline
              points={geometry.bulgeCurve}
              fill="none"
              stroke="var(--text-secondary)"
              strokeWidth="1"
              strokeDasharray="2 3"
              strokeOpacity="0.55"
            />

            {/* Direct Line-of-Sight Ray */}
            <line
              x1={geometry.xOf(geometry.losStart.distanceKm)}
              y1={geometry.yOf(geometry.losStart.losHeightM)}
              x2={geometry.xOf(geometry.losEnd.distanceKm)}
              y2={geometry.yOf(geometry.losEnd.losHeightM)}
              stroke={badge.color}
              strokeWidth="2"
            />

            {/* TX & RX Masts */}
            <line
              x1={geometry.xOf(0)}
              y1={geometry.yOf(geometry.losStart.groundElevationM)}
              x2={geometry.xOf(0)}
              y2={geometry.yOf(geometry.losStart.losHeightM)}
              stroke="var(--accent)"
              strokeWidth="3"
            />
            <circle
              cx={geometry.xOf(0)}
              cy={geometry.yOf(geometry.losStart.losHeightM)}
              r="3.5"
              fill="var(--accent)"
            />

            <line
              x1={geometry.xOf(activeHop.distanceKm)}
              y1={geometry.yOf(geometry.losEnd.groundElevationM)}
              x2={geometry.xOf(activeHop.distanceKm)}
              y2={geometry.yOf(geometry.losEnd.losHeightM)}
              stroke="var(--status-pass)"
              strokeWidth="3"
            />
            <circle
              cx={geometry.xOf(activeHop.distanceKm)}
              cy={geometry.yOf(geometry.losEnd.losHeightM)}
              r="3.5"
              fill="var(--status-pass)"
            />

            {/* Worst Obstruction Marker */}
            {activeHop.worstPoint && activeHop.minClearanceRatio < 0.6 && (
              <g>
                <line
                  x1={geometry.xOf(activeHop.worstPoint.distanceKm)}
                  y1={geometry.yOf(activeHop.worstPoint.losHeightM)}
                  x2={geometry.xOf(activeHop.worstPoint.distanceKm)}
                  y2={geometry.yOf(activeHop.worstPoint.effectiveTerrainM)}
                  stroke="var(--status-fail)"
                  strokeWidth="1.5"
                  strokeDasharray="2 2"
                />
                <circle
                  cx={geometry.xOf(activeHop.worstPoint.distanceKm)}
                  cy={geometry.yOf(activeHop.worstPoint.effectiveTerrainM)}
                  r="4"
                  fill="var(--status-fail)"
                  stroke="#ffffff"
                  strokeWidth="1.2"
                />
              </g>
            )}

            {/* Interactive Hover Crosshair */}
            {hovered && (
              <g>
                <line
                  x1={geometry.xOf(hovered.distanceKm)}
                  y1={PAD.top}
                  x2={geometry.xOf(hovered.distanceKm)}
                  y2={size.height - PAD.bottom}
                  stroke="var(--accent)"
                  strokeWidth="1.2"
                />
                <circle
                  cx={geometry.xOf(hovered.distanceKm)}
                  cy={geometry.yOf(hovered.effectiveTerrainM)}
                  r="3.5"
                  fill="var(--accent)"
                />
                <circle
                  cx={geometry.xOf(hovered.distanceKm)}
                  cy={geometry.yOf(hovered.losHeightM)}
                  r="3.5"
                  fill={badge.color}
                />
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
    </section>
  );
}
