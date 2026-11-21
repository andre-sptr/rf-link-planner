import {
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  XCircle,
} from 'lucide-react';
import type {
  ElevationSource,
  HopAnalysis,
  LinkAnalysisResult,
  LinkVerdict,
} from '@linksight/rf-engine';

export interface KpiRibbonProps {
  analysis: LinkAnalysisResult;
  activeHop: HopAnalysis;
  targetFadeMarginDb: number;
  elevationSource: ElevationSource;
  degraded: boolean;
  loading: boolean;
  inspectorOpen: boolean;
}

export function verdictColors(verdict: LinkVerdict): {
  color: string;
  bg: string;
  border: string;
  label: string;
} {
  switch (verdict) {
    case 'pass':
      return {
        color: 'var(--status-pass)',
        bg: 'var(--status-pass-bg)',
        border: 'var(--status-pass-border)',
        label: 'PASS',
      };
    case 'marginal':
      return {
        color: 'var(--status-marginal)',
        bg: 'var(--status-marginal-bg)',
        border: 'var(--status-marginal-border)',
        label: 'MARGINAL',
      };
    case 'fail':
      return {
        color: 'var(--status-fail)',
        bg: 'var(--status-fail-bg)',
        border: 'var(--status-fail-border)',
        label: 'FAIL',
      };
    default:
      return {
        color: 'var(--text-secondary)',
        bg: 'var(--bg-elevated)',
        border: 'var(--border-subtle)',
        label: 'INVALID',
      };
  }
}

function VerdictIcon({ verdict }: { verdict: LinkVerdict }) {
  switch (verdict) {
    case 'pass':
      return <CheckCircle2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />;
    case 'marginal':
      return <AlertTriangle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />;
    case 'fail':
      return <XCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />;
    default:
      return <HelpCircle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />;
  }
}

function sourceLabel(source: ElevationSource): string {
  switch (source) {
    case 'srtm30m':
      return 'SRTM 30m';
    case 'open-meteo-90m':
      return 'Copernicus 90m';
    case 'mixed-cache':
      return 'DEM Cache';
    default:
      return 'Synthetic';
  }
}

export function KpiRibbon({
  analysis,
  activeHop,
  targetFadeMarginDb,
  elevationSource,
  degraded,
  loading,
  inspectorOpen,
}: KpiRibbonProps) {
  const badge = verdictColors(analysis.overallVerdict);

  return (
    <section
      aria-label="Link telemetry summary"
      data-inspector-open={inspectorOpen ? 'true' : 'false'}
      className="rf-kpi-hud rf-hud-surface rounded-xl px-1.5 py-1 grid grid-cols-2 sm:grid-cols-3 shrink-0 pointer-events-auto"
    >
      {/* Overall Verdict */}
      <div className="flex items-center gap-1 px-1 py-0.5 shrink-0">
        <div
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border font-semibold font-mono-num text-[11px] tracking-wide"
          style={{
            color: badge.color,
            backgroundColor: badge.bg,
            borderColor: badge.border,
          }}
        >
          <VerdictIcon verdict={analysis.overallVerdict} />
          <span>{badge.label}</span>
        </div>
      </div>

      <span className="hidden lg:inline-block rf-toolbar-sep" aria-hidden="true" />

      {/* Path Distance */}
      <div className="px-1.5 py-0.5 flex flex-col justify-center shrink-0">
        <div className="text-[10px] font-medium whitespace-nowrap leading-tight" style={{ color: 'var(--text-muted)' }}>
          {analysis.mode === 'relay' ? 'Relay Path' : 'Distance'}
        </div>
        <div className="font-mono-num text-[12px] leading-tight font-semibold whitespace-nowrap">
          {analysis.totalDistanceKm.toFixed(2)} km
        </div>
      </div>

      <span className="hidden lg:inline-block rf-toolbar-sep" aria-hidden="true" />

      {/* Active Hop RSL */}
      <div className="px-1.5 py-0.5 flex flex-col justify-center shrink-0">
        <div className="text-[10px] font-medium whitespace-nowrap leading-tight" style={{ color: 'var(--text-muted)' }}>
          RSL ({activeHop.hopId === 'direct' ? 'Link' : activeHop.hopId.toUpperCase()})
        </div>
        <div className="font-mono-num text-[12px] leading-tight font-semibold whitespace-nowrap">
          {activeHop.rslDbm.toFixed(1)} dBm
        </div>
      </div>

      <span className="hidden lg:inline-block rf-toolbar-sep" aria-hidden="true" />

      {/* Fade Margin (Preserve immediate nextElementSibling contract for tests!) */}
      <div
        className="px-1.5 py-0.5 flex flex-col justify-center shrink-0"
        title={`Target fade margin ≥ ${targetFadeMarginDb} dB`}
      >
        <div className="text-[10px] font-medium whitespace-nowrap leading-tight" style={{ color: 'var(--text-muted)' }}>
          {analysis.mode === 'relay' ? 'Min Fade Margin' : 'Fade Margin'}
        </div>
        <div
          className="font-mono-num text-[12px] leading-tight font-semibold whitespace-nowrap"
          style={{
            color:
              analysis.bottleneckFadeMarginDb >= targetFadeMarginDb
                ? 'var(--status-pass)'
                : analysis.bottleneckFadeMarginDb >= 0
                  ? 'var(--status-marginal)'
                  : 'var(--status-fail)',
          }}
        >
          {analysis.bottleneckFadeMarginDb >= 0 ? '+' : ''}
          {analysis.bottleneckFadeMarginDb.toFixed(1)} dB
        </div>
      </div>

      <span className="hidden lg:inline-block rf-toolbar-sep" aria-hidden="true" />

      {/* Min 1st Fresnel */}
      <div
        className="px-1.5 py-0.5 flex flex-col justify-center shrink-0"
        title="≥ 60% 1st Fresnel clearance required"
      >
        <div className="text-[10px] font-medium whitespace-nowrap leading-tight" style={{ color: 'var(--text-muted)' }}>
          Min 1st Fresnel
        </div>
        <div
          className="font-mono-num text-[12px] leading-tight font-semibold whitespace-nowrap"
          style={{
            color:
              analysis.bottleneckClearanceRatio >= 0.6
                ? 'var(--status-pass)'
                : analysis.bottleneckClearanceRatio >= 0
                  ? 'var(--status-marginal)'
                  : 'var(--status-fail)',
          }}
        >
          {(analysis.bottleneckClearanceRatio * 100).toFixed(0)}% F1
        </div>
      </div>

      <span className="hidden xl:inline-block rf-toolbar-sep" aria-hidden="true" />

      {/* Elevation DEM */}
      <div
        className="hidden xl:flex px-1.5 py-0.5 items-center gap-1.5 shrink-0"
        title={`DEM Source: ${loading ? 'Updating…' : sourceLabel(elevationSource)}`}
      >
        <span
          className="rf-pulse-dot shrink-0"
          data-loading={loading ? 'true' : 'false'}
          style={{
            backgroundColor: loading
              ? 'var(--accent)'
              : degraded
                ? 'var(--status-marginal)'
                : 'var(--status-pass)',
          }}
          aria-hidden="true"
        />
        <span
          className="hidden 2xl:inline font-mono-num text-[11px] font-medium truncate"
          style={{
            color: degraded ? 'var(--status-marginal)' : 'var(--text-secondary)',
          }}
        >
          {loading ? 'Updating…' : sourceLabel(elevationSource)}
        </span>
      </div>
    </section>
  );
}
