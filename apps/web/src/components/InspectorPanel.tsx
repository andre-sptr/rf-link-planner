import { useEffect, useRef, useState } from 'react';
import {
  ArrowUpDown,
  ChevronDown,
  Crosshair,
  LocateFixed,
  MapPin,
  PanelLeftClose,
  PanelLeftOpen,
  SlidersHorizontal,
  Sparkles,
  Table2,
  TriangleAlert,
} from 'lucide-react';
import {
  CABLE_LIBRARY,
  EQUIPMENT_PRESETS,
  calculateCableLossDb,
  dbiToDbd,
  dbmToWatts,
  type CableTypeId,
  type HataEnvironment,
  type HopAnalysis,
  type LinkAnalysisResult,
  type LinkScenario,
  type PropagationModelId,
  type PropagationSettings,
  type SiteNode,
  type SiteRole,
} from '@linksight/rf-engine';
import { initAccessibleFormValidation } from '../lib/formA11y';
import { verdictColors } from './KpiRibbon';
import { NumericField } from './NumericField';
import { RelayComparisonCard } from './RelayComparisonCard';

export type InspectorTab = 'sites' | 'radio' | 'budget';
type HardwareScope = 'all' | 'tx' | 'repeater' | 'rx';

export interface InspectorPanelProps {
  scenario: LinkScenario;
  analysis: LinkAnalysisResult;
  activeHop: HopAnalysis;
  open: boolean;
  zenMode: boolean;
  activeTab: InspectorTab;
  selectedSiteRole: SiteRole | null;
  onChangeTab: (tab: InspectorTab) => void;
  onToggleOpen: () => void;
  onSelectSite: (role: SiteRole) => void;
  onFocusSiteOnMap: (role: SiteRole) => void;
  onUpdateSite: (role: SiteRole, patch: Partial<SiteNode>) => void;
  onUpdatePropagation: (patch: Partial<PropagationSettings>) => void;
  onApplyEquipmentPreset: (presetId: string) => void;
  onSwapTxRx: () => void;
  onCenterRepeater: () => void;
  onApplyTowerBoost: (
    hopId: 'direct' | 'hop1' | 'hop2',
    extraM: number,
  ) => void;
}

function hasHardwareDivergence(scenario: LinkScenario): boolean {
  const sites =
    scenario.mode === 'relay'
      ? [scenario.tx, scenario.repeater, scenario.rx]
      : [scenario.tx, scenario.rx];
  const base = sites[0]!;
  return sites.some(
    (s) =>
      s.txPowerDbm !== base.txPowerDbm ||
      s.rxSensitivityDbm !== base.rxSensitivityDbm ||
      s.antennaGainDbi !== base.antennaGainDbi ||
      s.cableType !== base.cableType ||
      s.cableLengthM !== base.cableLengthM ||
      s.connectorLossDb !== base.connectorLossDb ||
      s.duplexerLossDb !== base.duplexerLossDb,
  );
}

function SiteEditorBlock({
  title,
  roleTag,
  accentColor,
  site,
  groundElevM,
  isSelected,
  onSelect,
  onFocusOnMap,
  onChange,
}: {
  title: string;
  roleTag: string;
  accentColor: string;
  site: SiteNode;
  groundElevM: number;
  isSelected: boolean;
  onSelect: () => void;
  onFocusOnMap: () => void;
  onChange: (patch: Partial<SiteNode>) => void;
}) {
  const idPrefix = `site-${site.role}`;
  const totalTipM = groundElevM + site.antennaHeightM;

  return (
    <fieldset
      className="rf-module space-y-2.5"
      data-selected={isSelected ? 'true' : 'false'}
      onFocus={onSelect}
    >
      <legend className="visually-hidden">{title}</legend>

      <div className="rf-module-header">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="inline-flex items-center justify-center px-1.5 py-0.5 rounded font-mono-num text-[10px] font-bold tracking-wide text-white shrink-0"
            style={{ backgroundColor: accentColor }}
            aria-hidden="true"
          >
            {roleTag}
          </span>
          <span className="text-xs font-semibold truncate">{title}</span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <span
            className="font-mono-num text-[10.5px] px-1.5 py-0.5 rounded border"
            style={{
              borderColor: 'var(--border-subtle)',
              backgroundColor: 'var(--bg-panel)',
              color: 'var(--text-secondary)',
            }}
            title={`Ground ${groundElevM.toFixed(0)} m ASL · Antenna tip ${totalTipM.toFixed(0)} m ASL`}
          >
            {groundElevM.toFixed(0)}m ASL
          </span>
          <button
            type="button"
            onClick={onFocusOnMap}
            className="rf-icon-btn !min-inline-size-[24px] !min-block-size-[24px] !p-1"
            title={`Center map on ${title}`}
            aria-label={`Focus ${title} on map`}
          >
            <LocateFixed className="w-3 h-3" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div>
        <label
          className="block text-[11px] font-medium mb-1"
          style={{ color: 'var(--text-secondary)' }}
          htmlFor={`${idPrefix}-name`}
        >
          Site Label
        </label>
        <input
          id={`${idPrefix}-name`}
          type="text"
          className="rf-input w-full font-medium"
          value={site.name}
          required
          maxLength={60}
          onChange={(e) => onChange({ name: e.target.value })}
        />
      </div>

      <div className="grid grid-cols-3 gap-2">
        <NumericField
          id={`${idPrefix}-lat`}
          label="Lat (°)"
          value={site.coords.lat}
          min={-85}
          max={85}
          step="0.0001"
          errorText="-85 to 85"
          onCommit={(v) => onChange({ coords: { ...site.coords, lat: v } })}
        />
        <NumericField
          id={`${idPrefix}-lng`}
          label="Lng (°)"
          value={site.coords.lng}
          min={-180}
          max={180}
          step="0.0001"
          errorText="-180 to 180"
          onCommit={(v) => onChange({ coords: { ...site.coords, lng: v } })}
        />
        <NumericField
          id={`${idPrefix}-agl`}
          label="Tower (m)"
          value={site.antennaHeightM}
          min={1}
          max={400}
          step="1"
          errorText="1 to 400 m"
          onCommit={(v) => onChange({ antennaHeightM: v })}
        />
      </div>
    </fieldset>
  );
}

export function InspectorPanel({
  scenario,
  analysis,
  activeHop,
  open,
  zenMode,
  activeTab,
  selectedSiteRole,
  onChangeTab,
  onToggleOpen,
  onSelectSite,
  onFocusSiteOnMap,
  onUpdateSite,
  onUpdatePropagation,
  onApplyEquipmentPreset,
  onSwapTxRx,
  onCenterRepeater,
  onApplyTowerBoost,
}: InspectorPanelProps) {
  const [hardwareScope, setHardwareScope] = useState<HardwareScope>('all');
  const panelRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (scenario.mode === 'ptp' && hardwareScope === 'repeater') {
      setHardwareScope('all');
    }
  }, [scenario.mode, hardwareScope]);

  useEffect(() => {
    if (!panelRef.current) return;
    return initAccessibleFormValidation(panelRef.current);
  }, [activeTab, scenario.mode, hardwareScope]);

  const txGround = analysis.hops[0]?.txSite.groundElevationM ?? scenario.tx.groundElevationM;
  const rptGround =
    scenario.mode === 'relay'
      ? (analysis.hops[0]?.rxSite.groundElevationM ?? scenario.repeater.groundElevationM)
      : scenario.repeater.groundElevationM;
  const rxGround =
    analysis.hops[analysis.hops.length - 1]?.rxSite.groundElevationM ??
    scenario.rx.groundElevationM;

  const hopsNeedingHeight = analysis.hops.filter((h) => h.heightAdvisor.needed);

  const scopedSite: SiteNode =
    hardwareScope === 'all' ? scenario.tx : scenario[hardwareScope];
  const hardwareDiverges = hasHardwareDivergence(scenario);

  const commitHardwarePatch = (patch: Partial<SiteNode>) => {
    if (hardwareScope === 'all') {
      onUpdateSite('tx', patch);
      onUpdateSite('repeater', patch);
      onUpdateSite('rx', patch);
    } else {
      onUpdateSite(hardwareScope, patch);
    }
  };

  const maxAbsBudgetDb = Math.max(
    1,
    ...activeHop.budgetItems
      .filter((i) => i.category !== 'summary')
      .map((i) => Math.abs(i.valueDb)),
  );

  return (
    <>
      {!open && !zenMode && (
        <button
          type="button"
          onClick={onToggleOpen}
          className="hidden lg:inline-flex rf-hud-surface rounded-xl px-3 py-2 text-xs font-semibold items-center gap-2 pointer-events-auto fixed top-[68px] left-3 z-20 cursor-pointer transition-transform duration-150 active:scale-[0.97]"
          aria-label="Open RF Inspector drawer"
        >
          <PanelLeftOpen className="w-4 h-4" style={{ color: 'var(--accent)' }} aria-hidden="true" />
          <span>Inspector</span>
        </button>
      )}

      <aside
        ref={panelRef}
        data-open={open ? 'true' : 'false'}
        aria-label="RF engineering controls and link budget"
        className={`rf-hud-drawer rf-hud-surface rounded-none lg:rounded-2xl flex flex-col min-h-0 pointer-events-auto
          w-full lg:w-[344px] xl:w-[376px] shrink-0
          lg:fixed lg:top-[68px] lg:left-3 lg:bottom-3 lg:z-20
          transition-[transform,opacity] duration-[240ms] [transition-timing-function:var(--ease-drawer)]
          ${open ? 'lg:translate-x-0 lg:opacity-100' : 'lg:-translate-x-[calc(100%+24px)] lg:opacity-0 lg:pointer-events-none'}`}
      >
        <div
          className="flex items-center gap-1.5 p-2 border-b shrink-0"
          style={{
            borderColor: 'var(--border-subtle)',
          }}
        >
          <div
            role="tablist"
            aria-label="Inspector sections"
            className="flex-1 grid grid-cols-3 gap-1 p-0.5 rounded-lg border text-[11.5px] font-medium"
            style={{
              borderColor: 'var(--border-subtle)',
              backgroundColor: 'color-mix(in srgb, var(--bg-elevated) 75%, transparent)',
            }}
          >
            {(
              [
                { id: 'sites', label: 'Sites', icon: MapPin },
                { id: 'radio', label: 'Radio & Model', icon: SlidersHorizontal },
                { id: 'budget', label: 'Link Budget', icon: Table2 },
              ] as Array<{
                id: InspectorTab;
                label: string;
                icon: typeof MapPin;
              }>
            ).map((item) => {
              const active = activeTab === item.id;
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  role="tab"
                  type="button"
                  aria-selected={active}
                  onClick={() => onChangeTab(item.id)}
                  className="rf-tab"
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={onToggleOpen}
            className="rf-icon-btn hidden lg:inline-flex shrink-0"
            title="Collapse inspector drawer (⌘\)"
            aria-label="Collapse RF Inspector drawer"
          >
            <PanelLeftClose className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 inspector-scroll p-3 space-y-2.5">
          {activeTab === 'sites' && (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={onSwapTxRx}
                  className="rf-btn-subtle"
                >
                  <ArrowUpDown className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                  <span>Swap TX / RX</span>
                </button>

                {scenario.mode === 'relay' && (
                  <button
                    type="button"
                    onClick={onCenterRepeater}
                    className="rf-btn-subtle"
                  >
                    <Crosshair className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                    <span>Center Repeater</span>
                  </button>
                )}
              </div>

              {analysis.relayComparison && (
                <RelayComparisonCard comparison={analysis.relayComparison} />
              )}

              {hopsNeedingHeight.map((hop) => {
                const singleEndHints = [
                  hop.heightAdvisor.extraTxOnlyM !== null
                    ? `+${hop.heightAdvisor.extraTxOnlyM.toFixed(1)} m TX`
                    : 'TX-only N/A',
                  hop.heightAdvisor.extraRxOnlyM !== null
                    ? `+${hop.heightAdvisor.extraRxOnlyM.toFixed(1)} m RX`
                    : 'RX-only N/A',
                ].join(' / ');

                return (
                  <div
                    key={hop.hopId}
                    className="rounded-xl border p-3 text-xs space-y-2.5"
                    style={{
                      borderColor: 'var(--status-marginal-border)',
                      borderLeftWidth: '3px',
                      borderLeftColor: 'var(--status-marginal)',
                      backgroundColor: 'var(--status-marginal-bg)',
                    }}
                  >
                    <div className="flex items-start gap-2">
                      <Sparkles
                        className="w-4 h-4 shrink-0 mt-0.5"
                        style={{ color: 'var(--status-marginal)' }}
                        aria-hidden="true"
                      />
                      <div className="space-y-0.5">
                        <div className="font-semibold">
                          Tower Height Advisor ({hop.hopId.toUpperCase()})
                        </div>
                        <p className="leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                          Min clearance is {(hop.minClearanceRatio * 100).toFixed(0)}% F1 at{' '}
                          {hop.heightAdvisor.worstDistanceKm.toFixed(1)} km. Add{' '}
                          <strong className="font-mono-num" style={{ color: 'var(--text-primary)' }}>
                            +{hop.heightAdvisor.extraBalancedM.toFixed(1)} m
                          </strong>{' '}
                          balanced ({singleEndHints}).
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        onApplyTowerBoost(hop.hopId, hop.heightAdvisor.extraBalancedM)
                      }
                      className="rf-btn-primary w-full"
                    >
                      Optimize Tower Height (60% F1)
                    </button>
                  </div>
                );
              })}

              <SiteEditorBlock
                title="Transmitter (TX)"
                roleTag="TX"
                accentColor="var(--role-tx)"
                site={scenario.tx}
                groundElevM={txGround}
                isSelected={selectedSiteRole === 'tx'}
                onSelect={() => onSelectSite('tx')}
                onFocusOnMap={() => onFocusSiteOnMap('tx')}
                onChange={(patch) => onUpdateSite('tx', patch)}
              />

              {scenario.mode === 'relay' && (
                <SiteEditorBlock
                  title="Repeater Station (RPT)"
                  roleTag="RPT"
                  accentColor="var(--role-rpt)"
                  site={scenario.repeater}
                  groundElevM={rptGround}
                  isSelected={selectedSiteRole === 'repeater'}
                  onSelect={() => onSelectSite('repeater')}
                  onFocusOnMap={() => onFocusSiteOnMap('repeater')}
                  onChange={(patch) => onUpdateSite('repeater', patch)}
                />
              )}

              <SiteEditorBlock
                title="Receiver (RX)"
                roleTag="RX"
                accentColor="var(--role-rx)"
                site={scenario.rx}
                groundElevM={rxGround}
                isSelected={selectedSiteRole === 'rx'}
                onSelect={() => onSelectSite('rx')}
                onFocusOnMap={() => onFocusSiteOnMap('rx')}
                onChange={(patch) => onUpdateSite('rx', patch)}
              />
            </>
          )}

          {activeTab === 'radio' && (
            <>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold">Equipment Quick Profiles</span>
                  <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                    Apply band template
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {EQUIPMENT_PRESETS.map((preset) => {
                    const isActivePreset =
                      Math.abs(scenario.propagation.frequencyMhz - preset.frequencyMhz) < 0.1 &&
                      scenario.tx.txPowerDbm === preset.txPowerDbm &&
                      scenario.tx.antennaGainDbi === preset.antennaGainDbi;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        data-active={isActivePreset ? 'true' : 'false'}
                        onClick={() => onApplyEquipmentPreset(preset.id)}
                        className="rf-preset-card"
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-semibold text-xs">{preset.bandLabel}</span>
                          {isActivePreset && (
                            <span
                              className="inline-block w-1.5 h-1.5 rounded-full shrink-0"
                              style={{ backgroundColor: 'var(--accent)' }}
                              aria-hidden="true"
                            />
                          )}
                        </div>
                        <div
                          className="font-mono-num text-[11px] mt-0.5"
                          style={{ color: 'var(--text-secondary)' }}
                        >
                          {preset.txPowerDbm} dBm / {preset.antennaGainDbi} dBi
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <fieldset className="rf-module space-y-2.5 text-xs">
                <legend className="visually-hidden">RF Channel &amp; Propagation</legend>
                <div className="rf-module-header">
                  <span className="font-semibold">RF Channel &amp; Propagation</span>
                  <span
                    className="font-mono-num text-[10.5px]"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    {scenario.propagation.frequencyMhz} MHz
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <NumericField
                    id="freq-mhz"
                    label="Frequency (MHz)"
                    value={scenario.propagation.frequencyMhz}
                    min={30}
                    max={60000}
                    step="0.5"
                    errorText="30 to 60,000 MHz"
                    onCommit={(v) => onUpdatePropagation({ frequencyMhz: v })}
                  />

                  <div>
                    <label
                      className="block text-[11px] font-medium mb-1"
                      style={{ color: 'var(--text-secondary)' }}
                      htmlFor="prop-model"
                    >
                      Path Loss Model
                    </label>
                    <div className="rf-select-wrap">
                      <select
                        id="prop-model"
                        className="rf-input rf-select w-full"
                        value={scenario.propagation.model}
                        onChange={(e) =>
                          onUpdatePropagation({
                            model: e.target.value as PropagationModelId,
                          })
                        }
                      >
                        <option value="fspl-diffraction">
                          FSPL + P.526 Diffraction
                        </option>
                        <option value="okumura-hata">Okumura-Hata / COST-231</option>
                      </select>
                      <ChevronDown
                        className="w-3.5 h-3.5 pointer-events-none absolute right-2"
                        style={{ color: 'var(--text-secondary)' }}
                        aria-hidden="true"
                      />
                    </div>
                  </div>
                </div>

                {scenario.propagation.model === 'okumura-hata' && (
                  <div>
                    <label
                      className="block text-[11px] font-medium mb-1"
                      style={{ color: 'var(--text-secondary)' }}
                      htmlFor="hata-env"
                    >
                      Hata Environment Clutter Class
                    </label>
                    <div className="rf-select-wrap">
                      <select
                        id="hata-env"
                        className="rf-input rf-select w-full"
                        value={scenario.propagation.hataEnvironment}
                        onChange={(e) =>
                          onUpdatePropagation({
                            hataEnvironment: e.target.value as HataEnvironment,
                          })
                        }
                      >
                        <option value="urban">Urban (Dense City)</option>
                        <option value="suburban">Suburban</option>
                        <option value="rural">Open Rural</option>
                      </select>
                      <ChevronDown
                        className="w-3.5 h-3.5 pointer-events-none absolute right-2"
                        style={{ color: 'var(--text-secondary)' }}
                        aria-hidden="true"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-medium" style={{ color: 'var(--text-secondary)' }}>
                      Earth Radius k-Factor
                    </span>
                    <span className="font-mono-num text-[11px] font-medium">
                      k = {scenario.propagation.kFactor.toFixed(3)}
                    </span>
                  </div>
                  <div className="rf-seg-group w-full grid grid-cols-3">
                    {[
                      { label: '4/3 Standard', val: 1.333 },
                      { label: '1.0 Dry', val: 1.0 },
                      { label: '2/3 Sub-refr.', val: 0.667 },
                    ].map((item) => {
                      const active = Math.abs(scenario.propagation.kFactor - item.val) < 0.02;
                      return (
                        <button
                          key={item.label}
                          type="button"
                          aria-pressed={active}
                          onClick={() => onUpdatePropagation({ kFactor: item.val })}
                          className="rf-seg-btn text-[11px]"
                        >
                          {item.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <NumericField
                    id="clutter-m"
                    label="Clutter (m)"
                    value={scenario.propagation.clutterHeightM}
                    min={0}
                    max={80}
                    step="1"
                    errorText="0 to 80 m"
                    onCommit={(v) => onUpdatePropagation({ clutterHeightM: v })}
                  />
                  <NumericField
                    id="rain-db"
                    label="Rain (dB)"
                    value={scenario.propagation.rainMarginDb}
                    min={0}
                    max={40}
                    step="0.5"
                    errorText="0 to 40 dB"
                    onCommit={(v) => onUpdatePropagation({ rainMarginDb: v })}
                  />
                  <NumericField
                    id="target-fm"
                    label="Target (dB)"
                    value={scenario.propagation.targetFadeMarginDb}
                    min={0}
                    max={50}
                    step="1"
                    errorText="0 to 50 dB"
                    onCommit={(v) => onUpdatePropagation({ targetFadeMarginDb: v })}
                  />
                </div>
              </fieldset>

              <fieldset className="rf-module space-y-2.5 text-xs">
                <legend className="visually-hidden">Radio &amp; Feeder Hardware</legend>
                <div className="rf-module-header">
                  <span className="font-semibold">Radio &amp; Feeder Hardware</span>
                  {hardwareScope === 'all' && hardwareDiverges && (
                    <span
                      className="text-[10px] font-medium px-1.5 py-0.5 rounded border"
                      style={{
                        color: 'var(--status-marginal)',
                        borderColor: 'var(--status-marginal-border)',
                        backgroundColor: 'var(--status-marginal-bg)',
                      }}
                    >
                      Per-site overrides active
                    </span>
                  )}
                </div>

                <div className="space-y-1">
                  <span
                    className="block text-[11px] font-medium"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    Edit Scope
                  </span>

                  <div
                    role="group"
                    aria-label="Hardware edit scope"
                    className="rf-seg-group w-full grid"
                    style={{
                      gridTemplateColumns:
                        scenario.mode === 'relay'
                          ? 'repeat(4, minmax(0, 1fr))'
                          : 'repeat(3, minmax(0, 1fr))',
                    }}
                  >
                    {(
                      [
                        { id: 'all', label: 'All (Sync)' },
                        { id: 'tx', label: 'TX', dot: 'var(--role-tx)' },
                        ...(scenario.mode === 'relay'
                          ? [{ id: 'repeater' as const, label: 'Repeater', dot: 'var(--role-rpt)' }]
                          : []),
                        { id: 'rx', label: 'RX', dot: 'var(--role-rx)' },
                      ] as Array<{ id: HardwareScope; label: string; dot?: string }>
                    ).map((scopeItem) => {
                      const active = hardwareScope === scopeItem.id;
                      return (
                        <button
                          key={scopeItem.id}
                          type="button"
                          aria-pressed={active}
                          onClick={() => setHardwareScope(scopeItem.id)}
                          className="rf-seg-btn text-[11px]"
                        >
                          {scopeItem.dot && !active && (
                            <span
                              className="inline-block w-1.5 h-1.5 rounded-full shrink-0"
                              style={{ backgroundColor: scopeItem.dot }}
                              aria-hidden="true"
                            />
                          )}
                          <span>{scopeItem.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <NumericField
                    id="hw-tx-pwr"
                    label="TX Power (dBm)"
                    value={scopedSite.txPowerDbm}
                    min={-10}
                    max={70}
                    step="0.5"
                    errorText="-10 to 70 dBm"
                    helperText={`≈ ${dbmToWatts(scopedSite.txPowerDbm).toFixed(2)} W`}
                    onCommit={(v) => commitHardwarePatch({ txPowerDbm: v })}
                  />

                  <NumericField
                    id="hw-rx-sens"
                    label="RX Sensitivity (dBm)"
                    value={scopedSite.rxSensitivityDbm}
                    min={-150}
                    max={-20}
                    step="1"
                    errorText="-150 to -20 dBm"
                    onCommit={(v) => commitHardwarePatch({ rxSensitivityDbm: v })}
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <NumericField
                    id="hw-ant-gain"
                    label="Antenna Gain (dBi)"
                    value={scopedSite.antennaGainDbi}
                    min={-10}
                    max={50}
                    step="0.5"
                    errorText="-10 to 50 dBi"
                    helperText={`${dbiToDbd(scopedSite.antennaGainDbi).toFixed(2)} dBd`}
                    onCommit={(v) => commitHardwarePatch({ antennaGainDbi: v })}
                  />

                  <NumericField
                    id="hw-cable-len"
                    label="Feeder Length (m)"
                    value={scopedSite.cableLengthM}
                    min={0}
                    max={500}
                    step="1"
                    errorText="0 to 500 m"
                    helperText={`Loss: ${calculateCableLossDb(
                      scopedSite.cableType,
                      scopedSite.cableLengthM,
                      scenario.propagation.frequencyMhz,
                    ).toFixed(2)} dB`}
                    onCommit={(v) => commitHardwarePatch({ cableLengthM: v })}
                  />
                </div>

                <details className="rf-details" open>
                  <summary>Feeder &amp; Passive Losses</summary>
                  <div className="space-y-2.5">
                    <div>
                      <label
                        className="block text-[11px] font-medium mb-1"
                        style={{ color: 'var(--text-secondary)' }}
                        htmlFor="hw-cable-type"
                      >
                        Coax Feeder Type
                      </label>
                      <div className="rf-select-wrap">
                        <select
                          id="hw-cable-type"
                          className="rf-input rf-select w-full"
                          value={scopedSite.cableType}
                          onChange={(e) =>
                            commitHardwarePatch({ cableType: e.target.value as CableTypeId })
                          }
                        >
                          {Object.values(CABLE_LIBRARY).map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.label}
                            </option>
                          ))}
                        </select>
                        <ChevronDown
                          className="w-3.5 h-3.5 pointer-events-none absolute right-2"
                          style={{ color: 'var(--text-secondary)' }}
                          aria-hidden="true"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <NumericField
                        id="hw-conn-loss"
                        label="Connector Loss (dB)"
                        value={scopedSite.connectorLossDb}
                        min={0}
                        max={20}
                        step="0.1"
                        errorText="0 to 20 dB"
                        onCommit={(v) => commitHardwarePatch({ connectorLossDb: v })}
                      />
                      <NumericField
                        id="hw-dup-loss"
                        label="Duplexer Loss (dB)"
                        value={scopedSite.duplexerLossDb}
                        min={0}
                        max={20}
                        step="0.1"
                        errorText="0 to 20 dB"
                        onCommit={(v) => commitHardwarePatch({ duplexerLossDb: v })}
                      />
                    </div>
                  </div>
                </details>
              </fieldset>
            </>
          )}

          {activeTab === 'budget' && (
            <>
              {activeHop.warnings.length > 0 && (
                <div
                  className="rounded-xl border p-3 text-xs space-y-1.5"
                  style={{
                    borderColor: 'var(--status-marginal-border)',
                    borderLeftWidth: '3px',
                    borderLeftColor: 'var(--status-marginal)',
                    backgroundColor: 'var(--status-marginal-bg)',
                  }}
                >
                  <div className="flex items-center gap-1.5 font-semibold">
                    <TriangleAlert
                      className="w-4 h-4 shrink-0"
                      style={{ color: 'var(--status-marginal)' }}
                      aria-hidden="true"
                    />
                    <span>Engineering Notices ({activeHop.hopId.toUpperCase()})</span>
                  </div>
                  <ul className="list-disc pl-4 space-y-0.5 leading-relaxed">
                    {activeHop.warnings.map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="rf-card p-3 flex items-start justify-between gap-2 text-xs">
                <div className="min-w-0 space-y-0.5">
                  <div className="font-semibold truncate" id="budget-table-title">
                    {activeHop.label}
                  </div>
                  <div
                    className="font-mono-num text-[11px]"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    {activeHop.distanceKm.toFixed(2)} km · {scenario.propagation.frequencyMhz} MHz
                  </div>
                  <div
                    className="font-mono-num text-[11px]"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    Azimuth {activeHop.forwardAzimuthDeg.toFixed(1)}° / Back{' '}
                    {activeHop.reverseAzimuthDeg.toFixed(1)}°
                  </div>
                </div>
                <span
                  className="px-2 py-0.5 rounded-md border font-mono-num font-semibold text-[11px] shrink-0"
                  style={{
                    color: verdictColors(activeHop.verdict).color,
                    backgroundColor: verdictColors(activeHop.verdict).bg,
                    borderColor: verdictColors(activeHop.verdict).border,
                  }}
                >
                  {verdictColors(activeHop.verdict).label}
                </span>
              </div>

              <div
                tabIndex={0}
                role="region"
                aria-labelledby="budget-table-title"
                className="budget-table-wrap"
              >
                <table className="budget-table">
                  <caption className="visually-hidden">
                    Itemized RF Link Budget for {activeHop.label}
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Parameter</th>
                      <th scope="col">Value</th>
                      <th scope="col">Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeHop.budgetItems.map((item) => {
                      const isSummary = item.category === 'summary';
                      const valueColor = isSummary
                        ? item.id === 'fade-margin'
                          ? verdictColors(activeHop.verdict).color
                          : 'var(--text-primary)'
                        : item.unit === 'dB' && item.valueDb > 0
                          ? 'var(--status-pass)'
                          : item.unit === 'dB' && item.valueDb < 0
                            ? 'var(--text-secondary)'
                            : 'var(--text-primary)';

                      const barRatio =
                        !isSummary && item.unit === 'dB'
                          ? Math.min(1, Math.abs(item.valueDb) / maxAbsBudgetDb)
                          : 0;

                      return (
                        <tr
                          key={item.id}
                          className={isSummary ? 'is-summary' : ''}
                        >
                          <th scope="row">{item.label}</th>
                          <td>
                            <div
                              className="font-mono-num whitespace-nowrap font-semibold"
                              style={{ color: valueColor }}
                            >
                              {item.valueDb >= 0 && item.unit === 'dB' ? '+' : ''}
                              {item.valueDb.toFixed(2)} {item.unit}
                            </div>
                            {barRatio > 0.02 && (
                              <div
                                className="h-[2.5px] w-full rounded-full mt-1 overflow-hidden"
                                style={{ backgroundColor: 'var(--bg-elevated)' }}
                                aria-hidden="true"
                              >
                                <div
                                  className="h-full rounded-full"
                                  style={{
                                    width: `${Math.round(barRatio * 100)}%`,
                                    backgroundColor:
                                      item.valueDb > 0
                                        ? 'var(--status-pass)'
                                        : 'var(--accent)',
                                    opacity: item.valueDb > 0 ? 0.7 : 0.45,
                                  }}
                                />
                              </div>
                            )}
                          </td>
                          <td
                            className="text-[11px]"
                            style={{ color: 'var(--text-secondary)' }}
                          >
                            {item.note ?? '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </aside>
    </>
  );
}
