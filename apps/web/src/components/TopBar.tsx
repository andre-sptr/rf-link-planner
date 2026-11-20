import {
  BookOpen,
  FileDown,
  FolderOpen,
  Moon,
  Radio,
  Share2,
  Sun,
} from 'lucide-react';
import { DEMO_SCENARIOS, type LinkMode } from '@linksight/rf-engine';
import type { ResolvedTheme } from '../lib/theme';

export interface TopBarProps {
  scenarioId: string;
  mode: LinkMode;
  theme: ResolvedTheme;
  onSelectPreset: (id: string) => void;
  onChangeMode: (mode: LinkMode) => void;
  onShare: () => void;
  onExportPdf: () => void;
  onOpenScenarios: () => void;
  onOpenFormulas: () => void;
  onToggleTheme: () => void;
  exportingPdf: boolean;
}

export function TopBar({
  scenarioId,
  mode,
  theme,
  onSelectPreset,
  onChangeMode,
  onShare,
  onExportPdf,
  onOpenScenarios,
  onOpenFormulas,
  onToggleTheme,
  exportingPdf,
}: TopBarProps) {
  const isPreset = DEMO_SCENARIOS.some((s) => s.id === scenarioId);

  return (
    <header
      className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 border-b"
      style={{
        backgroundColor: 'var(--bg-panel)',
        borderColor: 'var(--border-subtle)',
      }}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <div
          className="flex items-center justify-center w-8 h-8 rounded-md shrink-0"
          style={{
            backgroundColor: 'var(--accent)',
            color: 'var(--accent-ink)',
          }}
          aria-hidden="true"
        >
          <Radio className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm tracking-tight truncate">
              LinkSight RF
            </span>
            <span
              className="hidden sm:inline text-xs px-1.5 py-0.5 rounded border"
              style={{
                color: 'var(--text-secondary)',
                borderColor: 'var(--border-subtle)',
                backgroundColor: 'var(--bg-elevated)',
              }}
            >
              Link Budget &amp; Fresnel
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="sr-only" htmlFor="preset-select">
          Demo Scenario Preset
        </label>
        <select
          id="preset-select"
          className="rf-input max-w-[230px] text-xs font-medium"
          value={isPreset ? scenarioId : ''}
          onChange={(e) => {
            if (e.target.value) onSelectPreset(e.target.value);
          }}
        >
          {!isPreset && <option value="">Custom / Shared Scenario</option>}
          {DEMO_SCENARIOS.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>

        <div
          role="group"
          aria-label="Topology Mode"
          className="inline-flex rounded-md border p-0.5 text-xs"
          style={{
            borderColor: 'var(--border-subtle)',
            backgroundColor: 'var(--bg-elevated)',
          }}
        >
          <button
            type="button"
            onClick={() => onChangeMode('ptp')}
            className="px-2.5 py-1 rounded font-medium cursor-pointer transition-colors"
            style={
              mode === 'ptp'
                ? {
                    backgroundColor: 'var(--accent)',
                    color: 'var(--accent-ink)',
                  }
                : { color: 'var(--text-secondary)' }
            }
            aria-pressed={mode === 'ptp'}
          >
            Point-to-Point
          </button>
          <button
            type="button"
            onClick={() => onChangeMode('relay')}
            className="px-2.5 py-1 rounded font-medium cursor-pointer transition-colors"
            style={
              mode === 'relay'
                ? {
                    backgroundColor: 'var(--accent)',
                    color: 'var(--accent-ink)',
                  }
                : { color: 'var(--text-secondary)' }
            }
            aria-pressed={mode === 'relay'}
          >
            Repeater Relay
          </button>
        </div>

        <button
          type="button"
          onClick={onOpenScenarios}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border text-xs font-medium cursor-pointer"
          style={{
            borderColor: 'var(--border-subtle)',
            backgroundColor: 'var(--bg-panel)',
          }}
          title="Save or load scenarios"
        >
          <FolderOpen className="w-3.5 h-3.5" aria-hidden="true" />
          <span className="hidden md:inline">Scenarios</span>
        </button>

        <button
          type="button"
          onClick={onOpenFormulas}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border text-xs font-medium cursor-pointer"
          style={{
            borderColor: 'var(--border-subtle)',
            backgroundColor: 'var(--bg-panel)',
          }}
          title="RF formulas and methodology"
        >
          <BookOpen className="w-3.5 h-3.5" aria-hidden="true" />
          <span className="hidden lg:inline">RF Math</span>
        </button>

        <button
          type="button"
          onClick={onShare}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border text-xs font-medium cursor-pointer"
          style={{
            borderColor: 'var(--border-subtle)',
            backgroundColor: 'var(--bg-panel)',
          }}
          title="Copy shareable scenario URL"
        >
          <Share2 className="w-3.5 h-3.5" aria-hidden="true" />
          <span className="hidden sm:inline">Share</span>
        </button>

        <button
          type="button"
          onClick={onExportPdf}
          disabled={exportingPdf}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-semibold cursor-pointer disabled:opacity-60"
          style={{
            backgroundColor: 'var(--accent)',
            color: 'var(--accent-ink)',
          }}
        >
          <FileDown className="w-3.5 h-3.5" aria-hidden="true" />
          <span>{exportingPdf ? 'Exporting…' : 'Export PDF'}</span>
        </button>

        <button
          type="button"
          onClick={onToggleTheme}
          className="inline-flex items-center justify-center w-8 h-8 rounded-md border cursor-pointer"
          style={{
            borderColor: 'var(--border-subtle)',
            backgroundColor: 'var(--bg-panel)',
          }}
          aria-label={
            theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'
          }
          title={
            theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'
          }
        >
          {theme === 'dark' ? (
            <Sun className="w-4 h-4" aria-hidden="true" />
          ) : (
            <Moon className="w-4 h-4" aria-hidden="true" />
          )}
        </button>
      </div>
    </header>
  );
}
