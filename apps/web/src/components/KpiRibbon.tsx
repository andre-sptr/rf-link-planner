import type {
  ElevationSource,
  HopAnalysis,
  LinkAnalysisResult,
  LinkVerdict,
} from '@linksight/rf-engine';

export interface KpiRibbonProps {
  analysis: LinkAnalysisResult;
  activeHop: HopAnalysis;
  elevationSource: ElevationSource;
  degraded: boolean;
  loading: boolean;
}

export function verdictColors(verdict: LinkVerdict): {
  color: string;
  bg: string;
  label: string;
} {
  switch (verdict) {
    case 'pass':
      return {
        color: 'var(--status-pass)',
        bg: 'var(--status-pass-bg)',
        label: 'PASS',
      };
    case 'marginal':
      return {
        color: 'var(--status-marginal)',
        bg: 'var(--status-marginal-bg)',
        label: 'MARGINAL',
      };
    case 'fail':
      return {
        color: 'var(--status-fail)',
        bg: 'var(--status-fail-bg)',
        label: 'FAIL',
      };
    default:
      return {
        color: 'var(--text-secondary)',
        bg: 'var(--bg-elevated)',
        label: 'INVALID',
      };
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
      return 'Synthetic Fallback';
  }
}

export function KpiRibbon({
  analysis,
  activeHop,
  elevationSource,
  degraded,
  loading,
}: KpiRibbonProps) {
  const badge = verdictColors(analysis.overallVerdict);

  return (
    <div
      className="flex flex-wrap items-center gap-2 px-2.5 py-2 rounded-lg border shadow-md backdrop-blur-sm text-xs"
      style={{
        backgroundColor:
          'color-mix(in srgb, var(--bg-panel) 92%, transparent)',
        borderColor: 'var(--border-subtle)',
      }}
    >
      <div
        className="px-2 py-1 rounded font-semibold font-mono-num tracking-wide"
        style={{ color: badge.color, backgroundColor: badge.bg }}
      >
        {badge.label}
      </div>

      <div className="px-2 border-l" style={{ borderColor: 'var(--border-subtle)' }}>
        <div className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
          {analysis.mode === 'relay' ? 'Total Relay Path' : 'Path Distance'}
        </div>
        <div className="font-mono-num font-semibold">
          {analysis.totalDistanceKm.toFixed(2)} km
        </div>
      </div>

      <div className="px-2 border-l" style={{ borderColor: 'var(--border-subtle)' }}>
        <div className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
          RSL ({activeHop.hopId === 'direct' ? 'Link' : activeHop.hopId.toUpperCase()})
        </div>
        <div className="font-mono-num font-semibold">
          {activeHop.rslDbm.toFixed(1)} dBm
        </div>
      </div>

      <div className="px-2 border-l" style={{ borderColor: 'var(--border-subtle)' }}>
        <div className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
          {analysis.mode === 'relay' ? 'Min Fade Margin' : 'Fade Margin'}
        </div>
        <div
          className="font-mono-num font-semibold"
          style={{
            color:
              analysis.bottleneckFadeMarginDb >= 15
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

      <div className="px-2 border-l" style={{ borderColor: 'var(--border-subtle)' }}>
        <div className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
          Min 1st Fresnel
        </div>
        <div
          className="font-mono-num font-semibold"
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

      <div className="px-2 border-l" style={{ borderColor: 'var(--border-subtle)' }}>
        <div className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
          Elevation DEM
        </div>
        <div
          className="font-mono-num font-medium"
          style={{
            color: degraded ? 'var(--status-marginal)' : 'var(--text-primary)',
          }}
        >
          {loading ? 'Updating…' : sourceLabel(elevationSource)}
        </div>
      </div>
    </div>
  );
}
