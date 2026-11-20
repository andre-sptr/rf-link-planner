import type { RelayComparison } from '@linksight/rf-engine';
import { verdictColors } from './KpiRibbon';

export interface RelayComparisonCardProps {
  comparison: RelayComparison;
}

export function RelayComparisonCard({ comparison }: RelayComparisonCardProps) {
  const directBadge = verdictColors(comparison.directVerdict);
  const relayBadge = verdictColors(comparison.relayVerdict);

  return (
    <div
      className="rounded-lg border p-3 text-xs space-y-2"
      style={{
        backgroundColor: 'var(--bg-elevated)',
        borderColor: 'var(--border-subtle)',
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold">Direct Path vs. Repeater Relay</span>
        <span
          className="font-mono-num font-semibold px-1.5 py-0.5 rounded"
          style={{
            color:
              comparison.fadeMarginGainDb >= 0
                ? 'var(--status-pass)'
                : 'var(--status-fail)',
            backgroundColor:
              comparison.fadeMarginGainDb >= 0
                ? 'var(--status-pass-bg)'
                : 'var(--status-fail-bg)',
          }}
        >
          {comparison.fadeMarginGainDb >= 0 ? '+' : ''}
          {comparison.fadeMarginGainDb.toFixed(1)} dB gain
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div
          className="p-2 rounded border"
          style={{
            backgroundColor: 'var(--bg-panel)',
            borderColor: 'var(--border-subtle)',
          }}
        >
          <div className="flex items-center justify-between">
            <span style={{ color: 'var(--text-secondary)' }}>Direct TX→RX</span>
            <span
              className="font-mono-num font-semibold"
              style={{ color: directBadge.color }}
            >
              {directBadge.label}
            </span>
          </div>
          <div className="mt-1 font-mono-num">
            Margin: {comparison.directFadeMarginDb.toFixed(1)} dB
          </div>
          <div className="font-mono-num" style={{ color: 'var(--text-secondary)' }}>
            F1: {(comparison.directMinClearanceRatio * 100).toFixed(0)}%
          </div>
        </div>

        <div
          className="p-2 rounded border"
          style={{
            backgroundColor: 'var(--bg-panel)',
            borderColor: 'var(--border-subtle)',
          }}
        >
          <div className="flex items-center justify-between">
            <span style={{ color: 'var(--text-secondary)' }}>Via Repeater</span>
            <span
              className="font-mono-num font-semibold"
              style={{ color: relayBadge.color }}
            >
              {relayBadge.label}
            </span>
          </div>
          <div className="mt-1 font-mono-num">
            Margin: {comparison.relayBottleneckFadeMarginDb.toFixed(1)} dB
          </div>
          <div className="font-mono-num" style={{ color: 'var(--text-secondary)' }}>
            F1: {(comparison.relayBottleneckClearanceRatio * 100).toFixed(0)}%
          </div>
        </div>
      </div>
    </div>
  );
}
