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
    <div
      className="rounded-lg border p-2.5 space-y-2"
      style={{
        backgroundColor: 'var(--bg-elevated)',
        borderColor: 'var(--border-subtle)',
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
            style={{ backgroundColor: accentColor }}
            aria-hidden="true"
          />
          <span className="text-xs font-semibold truncate">{title}</span>
        </div>
        <span
          className="font-mono-num text-[11px] px-1.5 py-0.5 rounded border"
          style={{
            borderColor: 'var(--border-subtle)',
            backgroundColor: 'var(--bg-panel)',
            color: 'var(--text-secondary)',
          }}
        >
          Ground {groundElevM.toFixed(0)} m
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
        <div>
          <label className="block text-[11px] mb-0.5" htmlFor={`${idPrefix}-lat`}>
            Lat (°)
          </label>
          <input
            id={`${idPrefix}-lat`}
            type="number"
            className="rf-input font-mono-num w-full"
            step="0.0001"
            min={-85}
            max={85}
            required
            data-error={`${idPrefix}-lat-err`}
            value={site.coords.lat}
            onChange={(e) => {
              const v = Number(e.target.value);
              if (Number.isFinite(v)) {
                onChange({ coords: { ...site.coords, lat: v } });
              }
            }}
          />
          <span id={`${idPrefix}-lat-err`} className="field-error-msg">
            -85 to 85
          </span>
        </div>

        <div>
          <label className="block text-[11px] mb-0.5" htmlFor={`${idPrefix}-lng`}>
            Lng (°)
          </label>
          <input
            id={`${idPrefix}-lng`}
            type="number"
            className="rf-input font-mono-num w-full"
            step="0.0001"
            min={-180}
            max={180}
            required
            data-error={`${idPrefix}-lng-err`}
            value={site.coords.lng}
            onChange={(e) => {
              const v = Number(e.target.value);
              if (Number.isFinite(v)) {
                onChange({ coords: { ...site.coords, lng: v } });
              }
            }}
          />
          <span id={`${idPrefix}-lng-err`} className="field-error-msg">
            -180 to 180
          </span>
        </div>

        <div>
          <label className="block text-[11px] mb-0.5" htmlFor={`${idPrefix}-agl`}>
            Tower (m)
          </label>
          <input
            id={`${idPrefix}-agl`}
            type="number"
            className="rf-input font-mono-num w-full"
            step="1"
            min={1}
            max={400}
            required
            data-error={`${idPrefix}-agl-err`}
            value={site.antennaHeightM}
            onChange={(e) => {
              const v = Number(e.target.value);
              if (Number.isFinite(v) && v >= 1) {
                onChange({ antennaHeightM: v });
              }
            }}
          />
          <span id={`${idPrefix}-agl-err`} className="field-error-msg">
            1 to 400 m
          </span>
        </div>
      </div>
    </div>
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
  const panelRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!panelRef.current) return;
    return initAccessibleFormValidation(panelRef.current);
  }, [tab, scenario.mode]);

  const txGround = analysis.hops[0]?.txSite.groundElevationM ?? scenario.tx.groundElevationM;
  const rptGround =
    scenario.mode === 'relay'
      ? (analysis.hops[0]?.rxSite.groundElevationM ?? scenario.repeater.groundElevationM)
      : scenario.repeater.groundElevationM;
  const rxGround =
    analysis.hops[analysis.hops.length - 1]?.rxSite.groundElevationM ??
    scenario.rx.groundElevationM;

  const hopsNeedingHeight = analysis.hops.filter((h) => h.heightAdvisor.needed);

  return (
    <aside
      ref={panelRef}
      className="w-full lg:w-[368px] shrink-0 border-r flex flex-col min-h-0"
      style={{
        backgroundColor: 'var(--bg-panel)',
        borderColor: 'var(--border-subtle)',
      }}
      aria-label="RF engineering controls and link budget"
    >
      {/* Inspector Tab Switcher */}
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

      {/* Scrollable Inspector Body */}
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

            {hopsNeedingHeight.map((hop) => (
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
                      balanced (or +{hop.heightAdvisor.extraTxOnlyM.toFixed(1)} m TX / +
                      {hop.heightAdvisor.extraRxOnlyM.toFixed(1)} m RX).
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
            ))}

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

            <div
              className="rounded-lg border p-2.5 space-y-2.5 text-xs"
              style={{
                backgroundColor: 'var(--bg-elevated)',
                borderColor: 'var(--border-subtle)',
              }}
            >
              <div className="font-semibold">RF Channel &amp; Propagation</div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] mb-0.5" htmlFor="freq-mhz">
                    Frequency (MHz)
                  </label>
                  <input
                    id="freq-mhz"
                    type="number"
                    className="rf-input font-mono-num w-full"
                    min={30}
                    max={60000}
                    step="0.5"
                    required
                    data-error="freq-mhz-err"
                    value={scenario.propagation.frequencyMhz}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      if (Number.isFinite(v) && v >= 30) {
                        onUpdatePropagation({ frequencyMhz: v });
                      }
                    }}
                  />
                  <span id="freq-mhz-err" className="field-error-msg">
                    30 to 60,000 MHz
                  </span>
                </div>

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
                <div>
                  <label className="block text-[11px] mb-0.5" htmlFor="clutter-m">
                    Clutter (m)
                  </label>
                  <input
                    id="clutter-m"
                    type="number"
                    className="rf-input font-mono-num w-full"
                    min={0}
                    max={80}
                    step="1"
                    value={scenario.propagation.clutterHeightM}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      if (Number.isFinite(v) && v >= 0) {
                        onUpdatePropagation({ clutterHeightM: v });
                      }
                    }}
                  />
                </div>
                <div>
                  <label className="block text-[11px] mb-0.5" htmlFor="rain-db">
                    Rain (dB)
                  </label>
                  <input
                    id="rain-db"
                    type="number"
                    className="rf-input font-mono-num w-full"
                    min={0}
                    max={40}
                    step="0.5"
                    value={scenario.propagation.rainMarginDb}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      if (Number.isFinite(v) && v >= 0) {
                        onUpdatePropagation({ rainMarginDb: v });
                      }
                    }}
                  />
                </div>
                <div>
                  <label className="block text-[11px] mb-0.5" htmlFor="target-fm">
                    Target (dB)
                  </label>
                  <input
                    id="target-fm"
                    type="number"
                    className="rf-input font-mono-num w-full"
                    min={0}
                    max={50}
                    step="1"
                    value={scenario.propagation.targetFadeMarginDb}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      if (Number.isFinite(v) && v >= 0) {
                        onUpdatePropagation({ targetFadeMarginDb: v });
                      }
                    }}
                  />
                </div>
              </div>
            </div>

            <div
              className="rounded-lg border p-2.5 space-y-2.5 text-xs"
              style={{
                backgroundColor: 'var(--bg-elevated)',
                borderColor: 'var(--border-subtle)',
              }}
            >
              <div className="font-semibold">TX / RX Radio &amp; Feeder Hardware</div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] mb-0.5" htmlFor="tx-pwr">
                    TX Power (dBm)
                  </label>
                  <input
                    id="tx-pwr"
                    type="number"
                    className="rf-input font-mono-num w-full"
                    min={-10}
                    max={70}
                    step="0.5"
                    value={scenario.tx.txPowerDbm}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      if (Number.isFinite(v)) {
                        onUpdateSite('tx', { txPowerDbm: v });
                        onUpdateSite('repeater', { txPowerDbm: v });
                      }
                    }}
                  />
                  <div
                    className="font-mono-num text-[10px] mt-0.5"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    ≈ {dbmToWatts(scenario.tx.txPowerDbm).toFixed(2)} W
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] mb-0.5" htmlFor="rx-sens">
                    RX Sensitivity (dBm)
                  </label>
                  <input
                    id="rx-sens"
                    type="number"
                    className="rf-input font-mono-num w-full"
                    min={-150}
                    max={-20}
                    step="1"
                    value={scenario.rx.rxSensitivityDbm}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      if (Number.isFinite(v)) {
                        onUpdateSite('rx', { rxSensitivityDbm: v });
                        onUpdateSite('repeater', { rxSensitivityDbm: v });
                      }
                    }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] mb-0.5" htmlFor="tx-gain">
                    TX Gain (dBi)
                  </label>
                  <input
                    id="tx-gain"
                    type="number"
                    className="rf-input font-mono-num w-full"
                    min={-10}
                    max={50}
                    step="0.5"
                    value={scenario.tx.antennaGainDbi}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      if (Number.isFinite(v)) {
                        onUpdateSite('tx', { antennaGainDbi: v });
                      }
                    }}
                  />
                  <div
                    className="font-mono-num text-[10px] mt-0.5"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    {dbiToDbd(scenario.tx.antennaGainDbi).toFixed(2)} dBd
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] mb-0.5" htmlFor="rx-gain">
                    RX Gain (dBi)
                  </label>
                  <input
                    id="rx-gain"
                    type="number"
                    className="rf-input font-mono-num w-full"
                    min={-10}
                    max={50}
                    step="0.5"
                    value={scenario.rx.antennaGainDbi}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      if (Number.isFinite(v)) {
                        onUpdateSite('rx', { antennaGainDbi: v });
                      }
                    }}
                  />
                  <div
                    className="font-mono-num text-[10px] mt-0.5"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    {dbiToDbd(scenario.rx.antennaGainDbi).toFixed(2)} dBd
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] mb-0.5" htmlFor="cable-type">
                    Coax Feeder Type
                  </label>
                  <select
                    id="cable-type"
                    className="rf-input w-full"
                    value={scenario.tx.cableType}
                    onChange={(e) => {
                      const cableType = e.target.value as CableTypeId;
                      onUpdateSite('tx', { cableType });
                      onUpdateSite('repeater', { cableType });
                      onUpdateSite('rx', { cableType });
                    }}
                  >
                    {Object.values(CABLE_LIBRARY).map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] mb-0.5" htmlFor="cable-len">
                    Feeder Length (m)
                  </label>
                  <input
                    id="cable-len"
                    type="number"
                    className="rf-input font-mono-num w-full"
                    min={0}
                    max={500}
                    step="1"
                    value={scenario.tx.cableLengthM}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      if (Number.isFinite(v) && v >= 0) {
                        onUpdateSite('tx', { cableLengthM: v });
                        onUpdateSite('rx', { cableLengthM: v });
                      }
                    }}
                  />
                  <div
                    className="font-mono-num text-[10px] mt-0.5"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    Loss:{' '}
                    {calculateCableLossDb(
                      scenario.tx.cableType,
                      scenario.tx.cableLengthM,
                      scenario.propagation.frequencyMhz,
                    ).toFixed(2)}{' '}
                    dB / end
                  </div>
                </div>
              </div>
            </div>
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
