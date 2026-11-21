import { useEffect, useRef } from 'react';
import {
  BookOpen,
  ChevronDown,
  Command,
  Eye,
  FileDown,
  FolderOpen,
  Moon,
  Share2,
  Sun,
} from 'lucide-react';
import {
  DEMO_SCENARIOS,
  type ElevationSource,
  type HopAnalysis,
  type LinkAnalysisResult,
  type LinkMode,
} from '@linksight/rf-engine';
import type { ResolvedTheme } from '../lib/theme';
import { BrandTowerIcon } from './BrandTowerIcon';
import { KpiRibbon } from './KpiRibbon';

export interface TopBarProps {
  scenarioId: string;
  mode: LinkMode;
  theme: ResolvedTheme;
  analysis: LinkAnalysisResult;
  activeHop: HopAnalysis;
  targetFadeMarginDb: number;
  elevationSource: ElevationSource;
  degraded: boolean;
  loading: boolean;
  inspectorOpen: boolean;
  onSelectPreset: (id: string) => void;
  onChangeMode: (mode: LinkMode) => void;
  onShare: () => void;
  onExportPdf: () => void;
  onOpenScenarios: () => void;
  onOpenFormulas: () => void;
  onOpenCommandPalette: () => void;
  onEnterZen: () => void;
  onToggleTheme: () => void;
  onNavigateHome?: () => void;
  exportingPdf: boolean;
}

export function TopBar({
  scenarioId,
  mode,
  theme,
  analysis,
  activeHop,
  targetFadeMarginDb,
  elevationSource,
  degraded,
  loading,
  inspectorOpen,
  onSelectPreset,
  onChangeMode,
  onShare,
  onExportPdf,
  onOpenScenarios,
  onOpenFormulas,
  onOpenCommandPalette,
  onEnterZen,
  onToggleTheme,
  onNavigateHome,
  exportingPdf,
}: TopBarProps) {
  const isPreset = DEMO_SCENARIOS.some((s) => s.id === scenarioId);
  const activePreset = DEMO_SCENARIOS.find((s) => s.id === scenarioId);
  const toolbarRef = useRef<HTMLDivElement | null>(null);

  // Roving tabindex fallback for role="toolbar" when native focusgroup is unsupported
  useEffect(() => {
    const bar = toolbarRef.current;
    if (!bar) return;
    if (typeof HTMLElement !== 'undefined' && 'focusGroup' in HTMLElement.prototype) {
      return;
    }

    const getItems = () =>
      Array.from(bar.querySelectorAll<HTMLButtonElement>('button:not([hidden])'));

    const items = getItems();
    if (!items.length) return;
    if (!items.some((b) => b.tabIndex === 0)) {
      items.forEach((b, i) => {
        b.tabIndex = i === 0 ? 0 : -1;
      });
    }

    const onFocusIn = (e: FocusEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target || target.tagName !== 'BUTTON') return;
      getItems().forEach((b) => {
        b.tabIndex = b === target ? 0 : -1;
      });
    };

    const onKeyDown = (e: KeyboardEvent) => {
      const list = getItems();
      const idx = list.indexOf(document.activeElement as HTMLButtonElement);
      if (idx === -1) return;

      const rtl = getComputedStyle(bar).direction === 'rtl';
      let nextIdx: number | null = null;
      if (e.key === 'ArrowRight') {
        nextIdx = (idx + (rtl ? -1 : 1) + list.length) % list.length;
      } else if (e.key === 'ArrowLeft') {
        nextIdx = (idx + (rtl ? 1 : -1) + list.length) % list.length;
      } else if (e.key === 'Home') {
        nextIdx = 0;
      } else if (e.key === 'End') {
        nextIdx = list.length - 1;
      }

      if (nextIdx !== null) {
        e.preventDefault();
        const nextBtn = list[nextIdx];
        if (nextBtn) {
          list.forEach((b) => {
            b.tabIndex = b === nextBtn ? 0 : -1;
          });
          nextBtn.focus();
        }
      }
    };

    bar.addEventListener('focusin', onFocusIn);
    bar.addEventListener('keydown', onKeyDown);
    return () => {
      bar.removeEventListener('focusin', onFocusIn);
      bar.removeEventListener('keydown', onKeyDown);
    };
  }, []);

  return (
    <header
      className="flex flex-wrap lg:flex-nowrap items-center justify-between gap-2 w-full pointer-events-none"
      style={{
        paddingTop: 'env(safe-area-inset-top, 0px)',
      }}
    >
      {/* Left Brand & Context Floating Pill */}
      <div className="rf-hud-surface rounded-xl px-2 py-1 flex items-center gap-1.5 min-w-0 shrink-0 pointer-events-auto">
        <a
          href="/"
          onClick={(e) => {
            if (onNavigateHome && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) {
              e.preventDefault();
              onNavigateHome();
            }
          }}
          className="flex items-center gap-2 pl-0.5 pr-1 py-0.5 rounded-lg min-w-0 no-underline transition-opacity duration-150 hover:opacity-80"
          style={{ color: 'inherit' }}
          title="Back to LinkSight RF overview"
          aria-label="LinkSight RF home"
        >
          <BrandTowerIcon className="w-7 h-7 shrink-0" />
          <span className="font-bold text-[13px] tracking-tight whitespace-nowrap">
            LinkSight RF
          </span>
        </a>

        <span className="hidden sm:inline-block rf-toolbar-sep" aria-hidden="true" />

        <div className="rf-select-wrap min-w-0">
          <label className="sr-only" htmlFor="preset-select">
            Demo Scenario Preset
          </label>
          <select
            id="preset-select"
            className="rf-input rf-select w-full max-w-[148px] xl:max-w-[184px] 2xl:max-w-[230px] text-xs font-medium py-1"
            title={activePreset?.name ?? 'Custom / Shared Scenario'}
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
          <ChevronDown
            className="w-3.5 h-3.5 pointer-events-none absolute right-2"
            style={{ color: 'var(--text-secondary)' }}
            aria-hidden="true"
          />
        </div>

        <div
          role="group"
          aria-label="Topology Mode"
          className="rf-seg-group shrink-0"
        >
          <button
            type="button"
            onClick={() => onChangeMode('ptp')}
            className="rf-seg-btn text-[11px] px-2 py-1"
            aria-pressed={mode === 'ptp'}
          >
            Point-to-Point
          </button>
          <button
            type="button"
            onClick={() => onChangeMode('relay')}
            className="rf-seg-btn text-[11px] px-2 py-1"
            aria-pressed={mode === 'relay'}
          >
            Repeater Relay
          </button>
        </div>
      </div>

      {/* Center Live Telemetry Floating Pill */}
      <KpiRibbon
        analysis={analysis}
        activeHop={activeHop}
        targetFadeMarginDb={targetFadeMarginDb}
        elevationSource={elevationSource}
        degraded={degraded}
        loading={loading}
        inspectorOpen={inspectorOpen}
      />

      {/* Right Workspace Action Floating Pill */}
      <div
        ref={toolbarRef}
        role="toolbar"
        aria-label="Workspace actions"
        {...({ focusgroup: 'toolbar wrap' } as Record<string, string>)}
        className="rf-hud-surface rounded-xl px-2 py-1 flex items-center gap-1 shrink-0 pointer-events-auto"
      >
        <button
          type="button"
          onClick={onOpenCommandPalette}
          className="rf-btn-subtle px-2 py-1 text-[11px]"
          title="Open command palette (Ctrl+K / ⌘K)"
          aria-label="Open command palette"
        >
          <Command className="w-3 h-3 shrink-0" aria-hidden="true" />
          <kbd className="font-mono-num text-[10px]">K</kbd>
        </button>

        <div role="group" aria-label="Scenario tools" className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={onOpenScenarios}
            className="rf-btn-ghost"
            aria-label="Scenarios"
            title="Save or load scenarios"
          >
            <FolderOpen className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span className="hidden 2xl:inline">Scenarios</span>
          </button>

          <button
            type="button"
            onClick={onOpenFormulas}
            className="rf-btn-ghost"
            aria-label="RF Math"
            title="RF formulas and methodology"
          >
            <BookOpen className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span className="hidden 2xl:inline">RF Math</span>
          </button>

          <button
            type="button"
            onClick={onShare}
            className="rf-btn-ghost"
            aria-label="Share scenario"
            title="Copy shareable scenario URL"
          >
            <Share2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span className="hidden 2xl:inline">Share</span>
          </button>
        </div>

        <span
          role="separator"
          aria-orientation="vertical"
          className="rf-toolbar-sep"
        />

        <button
          type="button"
          onClick={onExportPdf}
          disabled={exportingPdf}
          aria-disabled={exportingPdf ? 'true' : undefined}
          aria-label="Export PDF"
          className="rf-btn-primary py-1.5 px-2.5 disabled:opacity-60"
        >
          <FileDown className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          <span className="hidden sm:inline">{exportingPdf ? 'Exporting…' : 'Export PDF'}</span>
        </button>

        <button
          type="button"
          onClick={onEnterZen}
          className="rf-icon-btn hidden lg:inline-flex"
          title="Presentation mode (⌘.)"
          aria-label="Enter presentation mode"
        >
          <Eye className="w-3.5 h-3.5" aria-hidden="true" />
        </button>

        <button
          type="button"
          onClick={onToggleTheme}
          className="rf-icon-btn"
          aria-label={
            theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'
          }
          title={
            theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'
          }
        >
          {theme === 'dark' ? (
            <Sun className="w-3.5 h-3.5" aria-hidden="true" />
          ) : (
            <Moon className="w-3.5 h-3.5" aria-hidden="true" />
          )}
        </button>
      </div>
    </header>
  );
}
