import { TrendingDown, TrendingUp } from 'lucide-react';
import type { RelayComparison } from '@linksight/rf-engine';
import { verdictColors } from './KpiRibbon';

export interface RelayComparisonCardProps {
  comparison: RelayComparison;
}

function ClearanceBar({
  ratio,
  color,
}: {
  ratio: number;
  color: string;
}) {
  const pct = Math.max(0, Math.min(100, ratio * 100));
  return (
    <div
      className="relative h-1.5 w-full rounded-full overflow-hidden mt-1.5"
      style={{ backgroundColor: 'var(--bg-elevated)' }}
      aria-hidden="true"
    >
      <div
        className="h-full rounded-full transition-[width] duration-200"
        style={{ width: `${pct}%`, backgroundColor: color }}
      />
      <div
        className="absolute top-0 bottom-0 w-0.5"
        style={{ left: '60%', backgroundColor: 'var(--text-primary)', opacity: 0.45 }}
      />
    </div>
  );
}

export function RelayComparisonCard({ comparison }: RelayComparisonCardProps) {
  const directBadge = verdictColors(comparison.directVerdict);
  const relayBadge = verdictColors(comparison.relayVerdict);
  const isGainPositive = comparison.fadeMarginGainDb >= 0;

  return (
    <div
      className="rf-card p-3 text-xs space-y-2.5"
      style={{ backgroundColor: 'color-mix(in srgb, var(--bg-elevated) 72%, var(--bg-panel))' }}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold">Direct Path vs. Repeater Relay</span>
        <span
          className="inline-flex items-center gap-1 font-mono-num font-semibold px-2 py-0.5 rounded-md border text-[11px]"
          style={{
            color: isGainPositive ? 'var(--status-pass)' : 'var(--status-fail)',
            backgroundColor: isGainPositive
              ? 'var(--status-pass-bg)'
              : 'var(--status-fail-bg)',
            borderColor: isGainPositive
              ? 'var(--status-pass-border)'
              : 'var(--status-fail-border)',
          }}
        >
          {isGainPositive ? (
            <TrendingUp className="w-3 h-3 shrink-0" aria-hidden="true" />
          ) : (
            <TrendingDown className="w-3 h-3 shrink-0" aria-hidden="true" />
          )}
          <span>
            {isGainPositive ? '+' : ''}
            {comparison.fadeMarginGainDb.toFixed(1)} dB gain
          </span>
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div
          className="p-2.5 rounded-lg border"
          style={{
            backgroundColor: 'var(--bg-panel)',
            borderColor: 'var(--border-subtle)',
            borderTopWidth: '2.5px',
            borderTopColor: directBadge.color,
          }}
        >
          <div className="flex items-center justify-between gap-1">
            <span className="text-[11px] font-medium" style={{ color: 'var(--text-secondary)' }}>
              Direct TX→RX
            </span>
            <span
              className="font-mono-num text-[10px] font-semibold px-1.5 py-0.5 rounded"
              style={{ color: directBadge.color, backgroundColor: directBadge.bg }}
            >
              {directBadge.label}
            </span>
          </div>
          <div className="mt-1.5 font-mono-num font-semibold text-[13px]">
            {comparison.directFadeMarginDb >= 0 ? '+' : ''}
            {comparison.directFadeMarginDb.toFixed(1)} dB
          </div>
          <div className="font-mono-num text-[11px]" style={{ color: 'var(--text-secondary)' }}>
            F1: {(comparison.directMinClearanceRatio * 100).toFixed(0)}%
          </div>
          <ClearanceBar
            ratio={comparison.directMinClearanceRatio}
            color={directBadge.color}
          />
        </div>

        <div
          className="p-2.5 rounded-lg border"
          style={{
            backgroundColor: 'var(--bg-panel)',
            borderColor: 'var(--border-subtle)',
            borderTopWidth: '2.5px',
            borderTopColor: relayBadge.color,
          }}
        >
          <div className="flex items-center justify-between gap-1">
            <span className="text-[11px] font-medium" style={{ color: 'var(--text-secondary)' }}>
              Via Repeater
            </span>
            <span
              className="font-mono-num text-[10px] font-semibold px-1.5 py-0.5 rounded"
              style={{ color: relayBadge.color, backgroundColor: relayBadge.bg }}
            >
              {relayBadge.label}
            </span>
          </div>
          <div className="mt-1.5 font-mono-num font-semibold text-[13px]">
            {comparison.relayBottleneckFadeMarginDb >= 0 ? '+' : ''}
            {comparison.relayBottleneckFadeMarginDb.toFixed(1)} dB
          </div>
          <div className="font-mono-num text-[11px]" style={{ color: 'var(--text-secondary)' }}>
            F1: {(comparison.relayBottleneckClearanceRatio * 100).toFixed(0)}%
          </div>
          <ClearanceBar
            ratio={comparison.relayBottleneckClearanceRatio}
            color={relayBadge.color}
          />
        </div>
      </div>
    </div>
  );
}
