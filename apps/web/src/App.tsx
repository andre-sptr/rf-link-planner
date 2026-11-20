import { useEffect, useMemo, useRef, useState } from 'react';
import {
  analyzeScenario,
  type FresnelPoint,
} from '@linksight/rf-engine';
import { exportSiteSurveyPdf } from './lib/pdfReport';
import {
  resolveActiveTheme,
  subscribeThemeChanges,
  toggleColorScheme,
  type ResolvedTheme,
} from './lib/theme';
import { useElevation } from './state/useElevation';
import { usePlannerStore } from './state/usePlannerStore';
import { FresnelProfileChart } from './components/FresnelProfileChart';
import { InspectorPanel } from './components/InspectorPanel';
import { KpiRibbon } from './components/KpiRibbon';
import { MapCanvas } from './components/MapCanvas';
import { ScenarioDialog, type DialogMode } from './components/ScenarioDialog';
import { TopBar } from './components/TopBar';

export function App() {
  const store = usePlannerStore();
  const elevation = useElevation(store.scenario);

  const [theme, setTheme] = useState<ResolvedTheme>(() => resolveActiveTheme());
  const [dialogMode, setDialogMode] = useState<DialogMode>(null);
  const [selectedHopId, setSelectedHopId] = useState<'direct' | 'hop1' | 'hop2'>(
    'hop1',
  );
  const [hoveredPoint, setHoveredPoint] = useState<FresnelPoint | null>(null);
  const [exportingPdf, setExportingPdf] = useState(false);

  const chartSvgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    return subscribeThemeChanges((resolved) => {
      setTheme(resolved);
    });
  }, []);

  const analysis = useMemo(() => {
    return analyzeScenario(store.scenario, elevation.elevations);
  }, [store.scenario, elevation.elevations]);

  useEffect(() => {
    if (store.scenario.mode === 'ptp') {
      setSelectedHopId('direct');
    } else if (selectedHopId === 'direct' && !analysis.directReference) {
      setSelectedHopId('hop1');
    }
  }, [store.scenario.mode, selectedHopId, analysis.directReference]);

  const activeHop = useMemo(() => {
    if (selectedHopId === 'direct' && analysis.directReference) {
      return analysis.directReference;
    }
    return (
      analysis.hops.find((h) => h.hopId === selectedHopId) ?? analysis.hops[0]!
    );
  }, [analysis, selectedHopId]);

  const handleExportPdf = async () => {
    setExportingPdf(true);
    try {
      await exportSiteSurveyPdf({
        scenario: store.scenario,
        analysis,
        elevationSource: elevation.source,
        chartSvgElement: chartSvgRef.current,
      });
      store.notify('Exported PDF RF Site Survey report.');
    } catch {
      store.notify('Failed to generate PDF report.');
    } finally {
      setExportingPdf(false);
    }
  };

  return (
    <div className="workbench-root">
      <TopBar
        scenarioId={store.scenario.id}
        mode={store.scenario.mode}
        theme={theme}
        onSelectPreset={(id) => {
          store.selectPreset(id);
          setHoveredPoint(null);
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
        onToggleTheme={() => setTheme(toggleColorScheme())}
        exportingPdf={exportingPdf}
      />

      <main className="flex-1 min-h-0 flex flex-col lg:flex-row">
        <InspectorPanel
          scenario={store.scenario}
          analysis={analysis}
          activeHop={activeHop}
          onUpdateSite={store.updateSite}
          onUpdatePropagation={store.updatePropagation}
          onApplyEquipmentPreset={store.applyEquipmentPreset}
          onSwapTxRx={store.swapTxRx}
          onCenterRepeater={store.placeRepeaterMidpoint}
          onApplyTowerBoost={store.applyBalancedTowerBoost}
        />

        <div className="flex-1 min-w-0 min-h-0 flex flex-col">
          <div className="relative flex-1 min-h-[300px]">
            <MapCanvas
              scenario={store.scenario}
              analysis={analysis}
              theme={theme}
              hoveredPoint={hoveredPoint}
              onMoveSite={(role, coords) => store.updateSite(role, { coords })}
            />

            <div className="absolute top-3 left-12 right-3 z-[400] pointer-events-none flex justify-start">
              <div className="pointer-events-auto max-w-full">
                <KpiRibbon
                  analysis={analysis}
                  activeHop={activeHop}
                  elevationSource={elevation.source}
                  degraded={elevation.degraded}
                  loading={elevation.loading}
                />
              </div>
            </div>
          </div>

          <FresnelProfileChart
            hops={analysis.hops}
            directReference={analysis.directReference}
            selectedHopId={activeHop.hopId}
            onSelectHop={(hopId) => setSelectedHopId(hopId)}
            onHoverPoint={setHoveredPoint}
            svgRef={chartSvgRef}
          />
        </div>
      </main>

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

      {store.toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[1000] px-3.5 py-2 rounded-lg border shadow-lg text-xs font-medium"
          style={{
            backgroundColor: 'var(--bg-panel)',
            borderColor: 'var(--accent)',
            color: 'var(--text-primary)',
          }}
        >
          {store.toastMessage}
        </div>
      )}
    </div>
  );
}
export default App;
