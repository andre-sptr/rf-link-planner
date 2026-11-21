import { useEffect, useMemo, useRef, useState } from 'react';
import { EyeOff } from 'lucide-react';
import {
  analyzeScenario,
  type FresnelPoint,
  type SiteRole,
} from '@linksight/rf-engine';
import {
  resolveActiveTheme,
  subscribeThemeChanges,
  toggleColorScheme,
  type ResolvedTheme,
} from './lib/theme';
import { useElevation } from './state/useElevation';
import { usePlannerStore } from './state/usePlannerStore';
import { CommandPalette } from './components/CommandPalette';
import {
  FresnelProfileChart,
  type FresnelDrawerState,
} from './components/FresnelProfileChart';
import { InspectorPanel, type InspectorTab } from './components/InspectorPanel';
import { MapCanvas, type BasemapId } from './components/MapCanvas';
import { ScenarioDialog, type DialogMode } from './components/ScenarioDialog';
import { TopBar } from './components/TopBar';

export interface WorkbenchAppProps {
  onNavigateHome?: () => void;
}

function getInitialDialogMode(): DialogMode {
  if (typeof window === 'undefined') return null;
  const dialog = new URLSearchParams(window.location.search).get('dialog');
  if (dialog === 'formulas') return 'formulas';
  if (dialog === 'scenarios') return 'scenarios';
  return null;
}

export function WorkbenchApp({ onNavigateHome }: WorkbenchAppProps) {
  const store = usePlannerStore();
  const elevation = useElevation(store.scenario);

  const [theme, setTheme] = useState<ResolvedTheme>(() => resolveActiveTheme());
  const [dialogMode, setDialogMode] = useState<DialogMode>(() =>
    getInitialDialogMode(),
  );
  const [commandOpen, setCommandOpen] = useState(false);

  const [selectedHopId, setSelectedHopId] = useState<'direct' | 'hop1' | 'hop2'>(
    () => (store.scenario.mode === 'relay' ? 'hop1' : 'direct'),
  );
  const [selectedSiteRole, setSelectedSiteRole] = useState<SiteRole | null>(null);
  const [hoveredPoint, setHoveredPoint] = useState<FresnelPoint | null>(null);
  const [exportingPdf, setExportingPdf] = useState(false);

  const [inspectorOpen, setInspectorOpen] = useState(true);
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>('sites');
  const [fresnelState, setFresnelState] = useState<FresnelDrawerState>('normal');
  const [fresnelHeightPx, setFresnelHeightPx] = useState(212);
  const [zenMode, setZenMode] = useState(false);

  const [basemap, setBasemap] = useState<BasemapId>(
    () => (resolveActiveTheme() === 'dark' ? 'dark' : 'topo'),
  );
  const [is3D, setIs3D] = useState(true);
  const [fitTrigger, setFitTrigger] = useState(0);
  const [focusSiteTrigger, setFocusSiteTrigger] = useState<{
    role: SiteRole;
    seq: number;
  } | null>(null);

  const chartSvgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    return subscribeThemeChanges((resolved) => {
      setTheme(resolved);
    });
  }, []);

  // Auto-sync topo <-> dark basemap on theme switch while keeping Studio/Satellite manual choices
  useEffect(() => {
    setBasemap((current) => {
      if (theme === 'dark' && current === 'topo') return 'dark';
      if (theme === 'light' && current === 'dark') return 'topo';
      return current;
    });
  }, [theme]);

  const analysis = useMemo(() => {
    return analyzeScenario(store.scenario, elevation.elevations);
  }, [store.scenario, elevation.elevations]);

  useEffect(() => {
    if (store.scenario.mode === 'ptp') {
      setSelectedHopId('direct');
      if (selectedSiteRole === 'repeater') {
        setSelectedSiteRole(null);
      }
    } else if (selectedHopId === 'direct' && !analysis.directReference) {
      setSelectedHopId('hop1');
    }
  }, [store.scenario.mode, selectedHopId, selectedSiteRole, analysis.directReference]);

  const activeHop = useMemo(() => {
    if (selectedHopId === 'direct' && analysis.directReference) {
      return analysis.directReference;
    }
    return (
      analysis.hops.find((h) => h.hopId === selectedHopId) ?? analysis.hops[0]!
    );
  }, [analysis, selectedHopId]);

  const firstAdvisorHop = useMemo(
    () => analysis.hops.find((h) => h.heightAdvisor.needed) ?? null,
    [analysis.hops],
  );

  const handleExportPdf = async () => {
    setExportingPdf(true);
    try {
      const { exportSiteSurveyPdf } = await import('./lib/pdfReport');
      await exportSiteSurveyPdf({
        scenario: store.scenario,
        analysis,
        elevationSource: elevation.source,
        chartHopLabel: activeHop.label,
        chartSvgElement: chartSvgRef.current,
      });
      store.notify('Exported PDF RF Site Survey report.');
    } catch {
      store.notify('Failed to generate PDF report.');
    } finally {
      setExportingPdf(false);
    }
  };

  // Global Studio Keyboard Shortcuts: Cmd/Ctrl+K (Palette), Cmd/Ctrl+\ (Inspector), Cmd/Ctrl+. (Zen)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;

      const key = e.key.toLowerCase();
      if (key === 'k') {
        e.preventDefault();
        setCommandOpen((v) => !v);
      } else if (key === '\\') {
        e.preventDefault();
        setZenMode(false);
        setInspectorOpen((v) => !v);
      } else if (e.key === '.') {
        e.preventDefault();
        setZenMode((v) => !v);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const effectiveInspectorOpen = !zenMode && inspectorOpen;
  const effectiveFresnelState: FresnelDrawerState = zenMode
    ? 'minimized'
    : fresnelState;

  return (
    <div className="workbench-root">
      {/* Full-Bleed MapLibre 3D Spatial Canvas */}
      <main className="w-full lg:absolute lg:inset-0 lg:z-0">
        <MapCanvas
          scenario={store.scenario}
          analysis={analysis}
          theme={theme}
          hoveredPoint={hoveredPoint}
          selectedHopId={activeHop.hopId}
          selectedSiteRole={selectedSiteRole}
          basemap={basemap}
          is3D={is3D}
          inspectorOpen={effectiveInspectorOpen}
          fresnelState={effectiveFresnelState}
          fresnelHeightPx={fresnelHeightPx}
          zenMode={zenMode}
          fitTrigger={fitTrigger}
          focusSiteTrigger={focusSiteTrigger}
          onChangeBasemap={setBasemap}
          onToggle3D={() => setIs3D((v) => !v)}
          onSelectHop={(hopId) => setSelectedHopId(hopId)}
          onSelectSite={setSelectedSiteRole}
          onMoveSite={(role, coords) => store.updateSite(role, { coords })}
          onUpdateSiteHeight={(role, antennaHeightM) =>
            store.updateSite(role, { antennaHeightM })
          }
          onEditInInspector={(role) => {
            setZenMode(false);
            setInspectorOpen(true);
            setInspectorTab('sites');
            setSelectedSiteRole(role);
          }}
          onNotify={store.notify}
        />
      </main>

      {/* Top Floating Studio Bar */}
      {!zenMode ? (
        <div className="order-first p-2.5 lg:p-0 lg:fixed lg:top-3 lg:left-3 lg:right-3 lg:z-30 pointer-events-none">
          <TopBar
            scenarioId={store.scenario.id}
            mode={store.scenario.mode}
            theme={theme}
            analysis={analysis}
            activeHop={activeHop}
            targetFadeMarginDb={store.scenario.propagation.targetFadeMarginDb}
            elevationSource={elevation.source}
            degraded={elevation.degraded}
            loading={elevation.loading}
            inspectorOpen={effectiveInspectorOpen}
            onSelectPreset={(id) => {
              store.selectPreset(id);
              setHoveredPoint(null);
              setSelectedSiteRole(null);
            }}
            onChangeMode={(mode) => {
              store.setMode(mode);
              setSelectedHopId(mode === 'relay' ? 'hop1' : 'direct');
              setHoveredPoint(null);
            }}
            onShare={() => void store.copyShareUrl()}
            onExportPdf={() => void handleExportPdf()}
            onOpenScenarios={() => setDialogMode('scenarios')}
            onOpenFormulas={() => setDialogMode('formulas')}
            onOpenCommandPalette={() => setCommandOpen(true)}
            onEnterZen={() => setZenMode(true)}
            onToggleTheme={() => setTheme(toggleColorScheme())}
            onNavigateHome={onNavigateHome}
            exportingPdf={exportingPdf}
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setZenMode(false)}
          className="rf-hud-surface-strong rounded-full px-3.5 py-2 text-xs font-semibold inline-flex items-center gap-2 fixed top-3 left-3 z-30 pointer-events-auto cursor-pointer transition-transform duration-150 active:scale-[0.97]"
        >
          <EyeOff className="w-3.5 h-3.5" style={{ color: 'var(--accent)' }} aria-hidden="true" />
          <span>Exit Presentation (⌘.)</span>
        </button>
      )}

      {/* Left Floating Collapsible Inspector Drawer */}
      <InspectorPanel
        scenario={store.scenario}
        analysis={analysis}
        activeHop={activeHop}
        open={effectiveInspectorOpen}
        zenMode={zenMode}
        activeTab={inspectorTab}
        selectedSiteRole={selectedSiteRole}
        onChangeTab={setInspectorTab}
        onToggleOpen={() => {
          setZenMode(false);
          setInspectorOpen((v) => !v);
        }}
        onSelectSite={(role) => setSelectedSiteRole(role)}
        onFocusSiteOnMap={(role) => {
          setSelectedSiteRole(role);
          setFocusSiteTrigger((prev) => ({ role, seq: (prev?.seq ?? 0) + 1 }));
        }}
        onUpdateSite={store.updateSite}
        onUpdatePropagation={store.updatePropagation}
        onApplyEquipmentPreset={store.applyEquipmentPreset}
        onSwapTxRx={store.swapTxRx}
        onCenterRepeater={store.placeRepeaterMidpoint}
        onApplyTowerBoost={store.applyBalancedTowerBoost}
      />

      {/* Bottom Floating Resizable Fresnel Profile Drawer */}
      <FresnelProfileChart
        hops={analysis.hops}
        directReference={analysis.directReference}
        selectedHopId={activeHop.hopId}
        drawerState={effectiveFresnelState}
        heightPx={fresnelHeightPx}
        inspectorOpen={effectiveInspectorOpen}
        onChangeDrawerState={(nextState) => {
          setZenMode(false);
          setFresnelState(nextState);
        }}
        onChangeHeightPx={setFresnelHeightPx}
        onSelectHop={(hopId) => setSelectedHopId(hopId)}
        onHoverPoint={setHoveredPoint}
        svgRef={chartSvgRef}
      />

      <ScenarioDialog
        mode={dialogMode}
        activeScenario={store.scenario}
        savedScenarios={store.savedScenarios}
        onClose={() => setDialogMode(null)}
        onSelectPreset={store.selectPreset}
        onSaveScenario={store.saveScenarioToStorage}
        onLoadSaved={store.loadSavedScenario}
        onDeleteSaved={store.deleteSavedScenario}
      />

      <CommandPalette
        open={commandOpen}
        onClose={() => setCommandOpen(false)}
        scenarioId={store.scenario.id}
        mode={store.scenario.mode}
        theme={theme}
        basemap={basemap}
        is3D={is3D}
        inspectorOpen={effectiveInspectorOpen}
        fresnelMinimized={effectiveFresnelState === 'minimized'}
        zenMode={zenMode}
        canOptimizeTower={Boolean(firstAdvisorHop)}
        onSelectPreset={(id) => {
          store.selectPreset(id);
          setHoveredPoint(null);
          setSelectedSiteRole(null);
        }}
        onChangeMode={(mode) => {
          store.setMode(mode);
          setSelectedHopId(mode === 'relay' ? 'hop1' : 'direct');
          setHoveredPoint(null);
        }}
        onChangeBasemap={setBasemap}
        onToggle3D={() => setIs3D((v) => !v)}
        onFitPath={() => setFitTrigger((c) => c + 1)}
        onSwapTxRx={store.swapTxRx}
        onCenterRepeater={store.placeRepeaterMidpoint}
        onOptimizeTower={() => {
          if (firstAdvisorHop) {
            store.applyBalancedTowerBoost(
              firstAdvisorHop.hopId,
              firstAdvisorHop.heightAdvisor.extraBalancedM,
            );
          }
        }}
        onToggleInspector={() => {
          setZenMode(false);
          setInspectorOpen((v) => !v);
        }}
        onToggleFresnel={() => {
          setZenMode(false);
          setFresnelState((s) => (s === 'minimized' ? 'normal' : 'minimized'));
        }}
        onToggleZen={() => setZenMode((v) => !v)}
        onToggleTheme={() => setTheme(toggleColorScheme())}
        onOpenScenarios={() => setDialogMode('scenarios')}
        onOpenFormulas={() => setDialogMode('formulas')}
        onShare={() => void store.copyShareUrl()}
        onExportPdf={() => void handleExportPdf()}
      />

      {/* Persistent live region kept in DOM for reliable screen-reader status announcements */}
      <div
        role="status"
        aria-live="polite"
        className="fixed left-1/2 -translate-x-1/2 z-[1000] pointer-events-none"
        style={{ bottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))' }}
      >
        {store.toastMessage && (
          <div className="rf-toast pointer-events-auto">
            <span
              className="inline-block w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: 'var(--accent)' }}
              aria-hidden="true"
            />
            <span>{store.toastMessage}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default WorkbenchApp;
