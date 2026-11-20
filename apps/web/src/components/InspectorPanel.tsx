import { useEffect, useRef, useState } from 'react';
import { ArrowUpDown, Crosshair, Sparkles, TriangleAlert } from 'lucide-react';
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
} from '@linksight/rf-engine';
import { initAccessibleFormValidation } from '../lib/formA11y';
import { verdictColors } from './KpiRibbon';
import { NumericField } from './NumericField';
import { RelayComparisonCard } from './RelayComparisonCard';

export interface InspectorPanelProps {
  scenario: LinkScenario;
  analysis: LinkAnalysisResult;
  activeHop: HopAnalysis;
  onUpdateSite: (
    role: 'tx' | 'repeater' | 'rx',
    patch: Partial<SiteNode>,
  ) => void;
  onUpdatePropagation: (patch: Partial<PropagationSettings>) => void;
  onApplyEquipmentPreset: (presetId: string) => void;
  onSwapTxRx: () => void;
  onCenterRepeater: () => void;
  onApplyTowerBoost: (
    hopId: 'direct' | 'hop1' | 'hop2',
    extraM: number,
  ) => void;
}

type InspectorTab = 'sites' | 'radio' | 'budget';
type HardwareScope = 'all' | 'tx' | 'repeater' | 'rx';

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
  accentColor,
  site,
  groundElevM,
  onChange,
}: {
  title: string;
  accentColor: string;
  site: SiteNode;
  groundElevM: number;
  onChange: (patch: Partial<SiteNode>) => void;
}) {
  const idPrefix = `site-${site.role}`;
  return (
    <fieldset className="rf-fieldset space-y-2">
      <legend className="rf-legend flex items-center gap-1.5">
        <span
          className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
          style={{ backgroundColor: accentColor }}
          aria-hidden="true"
        />
        <span>{title}</span>
      </legend>

      <div className="flex items-center justify-between gap-2 text-[11px]">
        <span style={{ color: 'var(--text-secondary)' }}>Terrain Elevation</span>
        <span
          className="font-mono-num px-1.5 py-0.5 rounded border"
          style={{
            borderColor: 'var(--border-subtle)',
            backgroundColor: 'var(--bg-panel)',
            color: 'var(--text-secondary)',
          }}
        >
          Ground {groundElevM.toFixed(0)} m ASL
        </span>
      </div>

      <div>
        <label className="block text-[11px] mb-0.5" htmlFor={`${idPrefix}-name`}>
          Site Label
        </label>
        <input
          id={`${idPrefix}-name`}
          type="text"
          className="rf-input w-full"
          value={site.name}
          required
          maxLength={60}
          onChange={(e) => onChange({ name: e.target.value })}
        />
      </div>

      <div className="grid grid-cols-3 gap-1.5">
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
  onUpdateSite,
  onUpdatePropagation,
  onApplyEquipmentPreset,
  onSwapTxRx,
  onCenterRepeater,
  onApplyTowerBoost,
}: InspectorPanelProps) {
  const [tab, setTab] = useState<InspectorTab>('sites');
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
  }, [tab, scenario.mode, hardwareScope]);

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

  return (
    <aside
      ref={panelRef}
      className="order-2 lg:order-1 w-full lg:w-[368px] shrink-0 border-t lg:border-t-0 lg:border-r flex flex-col min-h-0"
      style={{
        backgroundColor: 'var(--bg-panel)',
        borderColor: 'var(--border-subtle)',
      }}
      aria-label="RF engineering controls and link budget"
    >
      <div
        role="tablist"
        aria-label="Inspector sections"
        className="grid grid-cols-3 border-b text-xs font-medium shrink-0"
        style={{
          borderColor: 'var(--border-subtle)',
          backgroundColor: 'var(--bg-elevated)',
        }}
      >
        {(
          [
            { id: 'sites', label: 'Sites & Towers' },
            { id: 'radio', label: 'Radio & Model' },
            { id: 'budget', label: 'Link Budget' },
          ] as Array<{ id: InspectorTab; label: string }>
        ).map((item) => {
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              role="tab"
              type="button"
              aria-selected={active}
              onClick={() => setTab(item.id)}
              className="py-2.5 px-2 text-center border-b-2 cursor-pointer transition-colors"
              style={
                active
                  ? {
                      borderColor: 'var(--accent)',
                      color: 'var(--text-primary)',
                      backgroundColor: 'var(--bg-panel)',
                    }
                  : {
                      borderColor: 'transparent',
                      color: 'var(--text-secondary)',
                    }
              }
            >
              {item.label}
            </button>
          );
        })}
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {tab === 'sites' && (
          <>
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={onSwapTxRx}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded border text-xs font-medium cursor-pointer"
                style={{
                  borderColor: 'var(--border-subtle)',
                  backgroundColor: 'var(--bg-elevated)',
                }}
              >
                <ArrowUpDown className="w-3.5 h-3.5" aria-hidden="true" />
                Swap TX / RX
              </button>

              {scenario.mode === 'relay' && (
                <button
                  type="button"
                  onClick={onCenterRepeater}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded border text-xs font-medium cursor-pointer"
                  style={{
                    borderColor: 'var(--border-subtle)',
                    backgroundColor: 'var(--bg-elevated)',
                  }}
                >
                  <Crosshair className="w-3.5 h-3.5" aria-hidden="true" />
                  Center Repeater
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
                  className="rounded-lg border p-2.5 text-xs space-y-2"
                  style={{
                    borderColor: 'var(--status-marginal)',
                    backgroundColor: 'var(--status-marginal-bg)',
                  }}
                >
                  <div className="flex items-start gap-2">
                    <Sparkles
                      className="w-4 h-4 shrink-0 mt-0.5"
                      style={{ color: 'var(--status-marginal)' }}
                      aria-hidden="true"
                    />
                    <div>
                      <div className="font-semibold">
                        Tower Height Advisor ({hop.hopId.toUpperCase()})
                      </div>
                      <p style={{ color: 'var(--text-secondary)' }}>
                        Min clearance is {(hop.minClearanceRatio * 100).toFixed(0)}% F1 at{' '}
                        {hop.heightAdvisor.worstDistanceKm.toFixed(1)} km. Add{' '}
                        <strong className="font-mono-num">
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
                    className="w-full py-1.5 px-2.5 rounded font-semibold cursor-pointer"
                    style={{
                      backgroundColor: 'var(--accent)',
                      color: 'var(--accent-ink)',
                    }}
                  >
                    Optimize Tower Height (60% F1)
                  </button>
                </div>
              );
            })}

            <SiteEditorBlock
              title="Transmitter (TX)"
              accentColor="#026498"
              site={scenario.tx}
              groundElevM={txGround}
              onChange={(patch) => onUpdateSite('tx', patch)}
            />

            {scenario.mode === 'relay' && (
              <SiteEditorBlock
                title="Repeater Station (RPT)"
                accentColor="#d97706"
                site={scenario.repeater}
                groundElevM={rptGround}
                onChange={(patch) => onUpdateSite('repeater', patch)}
              />
            )}

            <SiteEditorBlock
              title="Receiver (RX)"
              accentColor="#0f7b55"
              site={scenario.rx}
              groundElevM={rxGround}
              onChange={(patch) => onUpdateSite('rx', patch)}
            />
          </>
        )}

        {tab === 'radio' && (
          <>
            <div className="space-y-1.5">
              <div className="text-xs font-semibold">Equipment Quick Profiles</div>
              <div className="grid grid-cols-2 gap-1.5">
                {EQUIPMENT_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => onApplyEquipmentPreset(preset.id)}
                    className="p-2 rounded border text-left text-xs cursor-pointer hover:opacity-90"
                    style={{
                      borderColor: 'var(--border-subtle)',
                      backgroundColor: 'var(--bg-elevated)',
                    }}
                  >
                    <div className="font-semibold">{preset.bandLabel}</div>
                    <div
                      className="font-mono-num text-[11px]"
                      style={{ color: 'var(--text-secondary)' }}
                    >
                      {preset.txPowerDbm} dBm / {preset.antennaGainDbi} dBi
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <fieldset className="rf-fieldset space-y-2.5 text-xs">
              <legend className="rf-legend">RF Channel &amp; Propagation</legend>

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
                  <label className="block text-[11px] mb-0.5" htmlFor="prop-model">
                    Path Loss Model
                  </label>
                  <select
                    id="prop-model"
                    className="rf-input w-full"
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
                </div>
              </div>

              {scenario.propagation.model === 'okumura-hata' && (
                <div>
                  <label className="block text-[11px] mb-0.5" htmlFor="hata-env">
                    Hata Environment Clutter Class
                  </label>
                  <select
                    id="hata-env"
                    className="rf-input w-full"
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
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-1">
                  <span>Earth Radius k-Factor</span>
                  <span className="font-mono-num">
                    k = {scenario.propagation.kFactor.toFixed(3)}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { label: '4/3 Standard', val: 1.333 },
                    { label: '1.0 Dry', val: 1.0 },
                    { label: '2/3 Sub-refr.', val: 0.667 },
                  ].map((item) => (
                    <button
                      key={item.label}
                      type="button"
                      onClick={() => onUpdatePropagation({ kFactor: item.val })}
                      className="py-1 px-1.5 rounded border text-[11px] font-medium cursor-pointer"
                      style={
                        Math.abs(scenario.propagation.kFactor - item.val) < 0.02
                          ? {
                              backgroundColor: 'var(--accent)',
                              color: 'var(--accent-ink)',
                              borderColor: 'var(--accent)',
                            }
                          : {
                              backgroundColor: 'var(--bg-panel)',
                              borderColor: 'var(--border-subtle)',
                            }
                      }
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-1.5">
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

            <fieldset className="rf-fieldset space-y-2.5 text-xs">
              <legend className="rf-legend">Radio &amp; Feeder Hardware</legend>

              <div className="space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                    Edit Scope
                  </span>
                  {hardwareScope === 'all' && hardwareDiverges && (
                    <span
                      className="text-[10px] px-1.5 py-0.5 rounded border"
                      style={{
                        color: 'var(--status-marginal)',
                        borderColor: 'var(--status-marginal)',
                        backgroundColor: 'var(--status-marginal-bg)',
                      }}
                    >
                      Per-site overrides active
                    </span>
                  )}
                </div>

                <div
                  role="group"
                  aria-label="Hardware edit scope"
                  className="grid gap-1 p-0.5 rounded border text-[11px]"
                  style={{
                    gridTemplateColumns:
                      scenario.mode === 'relay' ? 'repeat(4, minmax(0, 1fr))' : 'repeat(3, minmax(0, 1fr))',
                    borderColor: 'var(--border-subtle)',
                    backgroundColor: 'var(--bg-panel)',
                  }}
                >
                  {(
                    [
                      { id: 'all', label: 'All (Sync)' },
                      { id: 'tx', label: 'TX' },
                      ...(scenario.mode === 'relay'
                        ? [{ id: 'repeater' as const, label: 'Repeater' }]
                        : []),
                      { id: 'rx', label: 'RX' },
                    ] as Array<{ id: HardwareScope; label: string }>
                  ).map((scopeItem) => {
                    const active = hardwareScope === scopeItem.id;
                    return (
                      <button
                        key={scopeItem.id}
                        type="button"
                        aria-pressed={active}
                        onClick={() => setHardwareScope(scopeItem.id)}
                        className="py-1 px-1.5 rounded font-medium cursor-pointer transition-colors"
                        style={
                          active
                            ? {
                                backgroundColor: 'var(--accent)',
                                color: 'var(--accent-ink)',
                              }
                            : { color: 'var(--text-secondary)' }
                        }
                      >
                        {scopeItem.label}
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

              <div>
                <label className="block text-[11px] mb-0.5" htmlFor="hw-cable-type">
                  Coax Feeder Type
                </label>
                <select
                  id="hw-cable-type"
                  className="rf-input w-full"
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
            </fieldset>
          </>
        )}

        {tab === 'budget' && (
          <>
            {activeHop.warnings.length > 0 && (
              <div
                className="rounded-lg border p-2.5 text-xs space-y-1"
                style={{
                  borderColor: 'var(--status-marginal)',
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
                <ul className="list-disc pl-4 space-y-0.5">
                  {activeHop.warnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex items-center justify-between text-xs">
              <div>
                <div className="font-semibold" id="budget-table-title">
                  {activeHop.label}
                </div>
                <div
                  className="font-mono-num text-[11px]"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  Azimuth {activeHop.forwardAzimuthDeg.toFixed(1)}° / Back{' '}
                  {activeHop.reverseAzimuthDeg.toFixed(1)}°
                </div>
              </div>
              <span
                className="px-2 py-0.5 rounded font-mono-num font-semibold"
                style={{
                  color: verdictColors(activeHop.verdict).color,
                  backgroundColor: verdictColors(activeHop.verdict).bg,
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
                  {activeHop.budgetItems.map((item) => (
                    <tr
                      key={item.id}
                      className={item.category === 'summary' ? 'is-summary' : ''}
                    >
                      <th scope="row">{item.label}</th>
                      <td className="font-mono-num whitespace-nowrap">
                        {item.valueDb >= 0 && item.unit === 'dB' ? '+' : ''}
                        {item.valueDb.toFixed(2)} {item.unit}
                      </td>
                      <td
                        className="text-[11px]"
                        style={{ color: 'var(--text-secondary)' }}
                      >
                        {item.note ?? '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </aside>
  );
}
