import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  DEMO_SCENARIOS,
  EQUIPMENT_PRESETS,
  cloneScenario,
  type LinkMode,
  type LinkScenario,
  type PropagationSettings,
  type SiteNode,
} from '@linksight/rf-engine';
import {
  decodeScenarioFromParam,
  encodeScenarioToParam,
  sanitizeScenario,
} from '../lib/shareCodec';

const SAVED_SCENARIOS_KEY = 'linksight-saved-scenarios-v1';

export interface SavedScenarioEntry {
  savedAt: string;
  scenario: LinkScenario;
}

function readSavedScenarios(): SavedScenarioEntry[] {
  try {
    const raw = window.localStorage.getItem(SAVED_SCENARIOS_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const valid: SavedScenarioEntry[] = [];
    for (const item of parsed) {
      if (!item || typeof item !== 'object') continue;
      const entry = item as Record<string, unknown>;
      const clean = sanitizeScenario(entry.scenario);
      if (clean) {
        valid.push({
          savedAt:
            typeof entry.savedAt === 'string'
              ? entry.savedAt
              : new Date().toISOString(),
          scenario: clean,
        });
      }
    }
    return valid;
  } catch {
    return [];
  }
}

function writeSavedScenarios(entries: SavedScenarioEntry[]): void {
  try {
    window.localStorage.setItem(SAVED_SCENARIOS_KEY, JSON.stringify(entries));
  } catch {
    // ignore storage quota errors
  }
}

function loadInitialState(): {
  scenario: LinkScenario;
  invalidUrlWarning: boolean;
} {
  if (typeof window === 'undefined') {
    return {
      scenario: cloneScenario(DEMO_SCENARIOS[0]!),
      invalidUrlWarning: false,
    };
  }
  const params = new URLSearchParams(window.location.search);
  const encoded = params.get('s');
  if (encoded) {
    const decoded = decodeScenarioFromParam(encoded);
    if (decoded) {
      return { scenario: decoded, invalidUrlWarning: false };
    }
    return {
      scenario: cloneScenario(DEMO_SCENARIOS[0]!),
      invalidUrlWarning: true,
    };
  }
  return {
    scenario: cloneScenario(DEMO_SCENARIOS[0]!),
    invalidUrlWarning: false,
  };
}

export function usePlannerStore() {
  const initial = useMemo(() => loadInitialState(), []);
  const [scenario, setScenario] = useState<LinkScenario>(initial.scenario);
  const [savedScenarios, setSavedScenarios] = useState<SavedScenarioEntry[]>(
    () => (typeof window === 'undefined' ? [] : readSavedScenarios()),
  );
  const [toastMessage, setToastMessage] = useState<string | null>(
    initial.invalidUrlWarning
      ? 'Shared URL was invalid or corrupted — loaded default scenario.'
      : null,
  );

  useEffect(() => {
    if (!toastMessage) return;
    const timer = window.setTimeout(() => setToastMessage(null), 4000);
    return () => window.clearTimeout(timer);
  }, [toastMessage]);

  const notify = useCallback((msg: string) => {
    setToastMessage(msg);
  }, []);

  const selectPreset = useCallback((presetId: string) => {
    const found = DEMO_SCENARIOS.find((s) => s.id === presetId);
    if (!found) return;
    setScenario(cloneScenario(found));
    setToastMessage(`Loaded preset: ${found.name}`);
  }, []);

  const setMode = useCallback((mode: LinkMode) => {
    setScenario((prev) => ({ ...prev, mode }));
  }, []);

  const updateSite = useCallback(
    (role: 'tx' | 'repeater' | 'rx', patch: Partial<SiteNode>) => {
      setScenario((prev) => ({
        ...prev,
        [role]: {
          ...prev[role],
          ...patch,
          coords: patch.coords ? { ...patch.coords } : prev[role].coords,
        },
      }));
    },
    [],
  );

  const updatePropagation = useCallback((patch: Partial<PropagationSettings>) => {
    setScenario((prev) => ({
      ...prev,
      propagation: {
        ...prev.propagation,
        ...patch,
      },
    }));
  }, []);

  const applyEquipmentPreset = useCallback((presetId: string) => {
    const preset = EQUIPMENT_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;

    setScenario((prev) => ({
      ...prev,
      tx: {
        ...prev.tx,
        txPowerDbm: preset.txPowerDbm,
        antennaGainDbi: preset.antennaGainDbi,
        cableType: preset.cableType,
        cableLengthM: preset.cableLengthM,
        connectorLossDb: preset.connectorLossDb,
        duplexerLossDb: preset.duplexerLossDb,
        rxSensitivityDbm: preset.rxSensitivityDbm,
      },
      repeater: {
        ...prev.repeater,
        txPowerDbm: preset.txPowerDbm,
        antennaGainDbi: preset.antennaGainDbi,
        cableType: preset.cableType,
        cableLengthM: preset.cableLengthM,
        connectorLossDb: preset.connectorLossDb,
        duplexerLossDb: preset.duplexerLossDb,
        rxSensitivityDbm: preset.rxSensitivityDbm,
      },
      rx: {
        ...prev.rx,
        txPowerDbm: preset.txPowerDbm,
        antennaGainDbi: preset.antennaGainDbi,
        cableType: preset.cableType,
        cableLengthM: preset.cableLengthM,
        connectorLossDb: preset.connectorLossDb,
        duplexerLossDb: preset.duplexerLossDb,
        rxSensitivityDbm: preset.rxSensitivityDbm,
      },
      propagation: {
        ...prev.propagation,
        frequencyMhz: preset.frequencyMhz,
        rainMarginDb: preset.rainMarginDb,
        targetFadeMarginDb: preset.targetFadeMarginDb,
      },
    }));
    setToastMessage(`Applied equipment profile: ${preset.name}`);
  }, []);

  const swapTxRx = useCallback(() => {
    setScenario((prev) => ({
      ...prev,
      tx: { ...prev.rx, id: prev.tx.id, role: 'tx' },
      rx: { ...prev.tx, id: prev.rx.id, role: 'rx' },
    }));
    setToastMessage('Swapped TX and RX sites.');
  }, []);

  const placeRepeaterMidpoint = useCallback(() => {
    setScenario((prev) => ({
      ...prev,
      repeater: {
        ...prev.repeater,
        coords: {
          lat: Number(((prev.tx.coords.lat + prev.rx.coords.lat) / 2).toFixed(5)),
          lng: Number(((prev.tx.coords.lng + prev.rx.coords.lng) / 2).toFixed(5)),
        },
      },
    }));
    setToastMessage('Centered repeater at path midpoint.');
  }, []);

  const applyBalancedTowerBoost = useCallback(
    (hopId: 'direct' | 'hop1' | 'hop2', extraM: number) => {
      if (extraM <= 0) return;
      setScenario((prev) => {
        if (hopId === 'hop1') {
          return {
            ...prev,
            tx: {
              ...prev.tx,
              antennaHeightM: Number((prev.tx.antennaHeightM + extraM).toFixed(1)),
            },
            repeater: {
              ...prev.repeater,
              antennaHeightM: Number(
                (prev.repeater.antennaHeightM + extraM).toFixed(1),
              ),
            },
          };
        }
        if (hopId === 'hop2') {
          return {
            ...prev,
            repeater: {
              ...prev.repeater,
              antennaHeightM: Number(
                (prev.repeater.antennaHeightM + extraM).toFixed(1),
              ),
            },
            rx: {
              ...prev.rx,
              antennaHeightM: Number((prev.rx.antennaHeightM + extraM).toFixed(1)),
            },
          };
        }
        return {
          ...prev,
          tx: {
            ...prev.tx,
            antennaHeightM: Number((prev.tx.antennaHeightM + extraM).toFixed(1)),
          },
          rx: {
            ...prev.rx,
            antennaHeightM: Number((prev.rx.antennaHeightM + extraM).toFixed(1)),
          },
        };
      });
      setToastMessage(
        `Raised towers by +${extraM.toFixed(1)} m to restore ≥60% 1st Fresnel clearance.`,
      );
    },
    [],
  );

  const saveScenarioToStorage = useCallback(
    (customName: string) => {
      const trimmed = customName.trim() || scenario.name;
      const cloned: LinkScenario = {
        ...cloneScenario(scenario),
        id: `saved-${Date.now()}`,
        name: trimmed,
      };
      setScenario(cloned);
      setSavedScenarios((prev) => {
        const next = [{ savedAt: new Date().toISOString(), scenario: cloned }, ...prev];
        writeSavedScenarios(next);
        return next;
      });
      setToastMessage(`Saved scenario "${trimmed}" locally.`);
    },
    [scenario],
  );

  const loadSavedScenario = useCallback(
    (id: string) => {
      const entry = savedScenarios.find((item) => item.scenario.id === id);
      if (!entry) return;
      setScenario(cloneScenario(entry.scenario));
      setToastMessage(`Loaded "${entry.scenario.name}".`);
    },
    [savedScenarios],
  );

  const deleteSavedScenario = useCallback((id: string) => {
    setSavedScenarios((prev) => {
      const next = prev.filter((item) => item.scenario.id !== id);
      writeSavedScenarios(next);
      return next;
    });
  }, []);

  const copyShareUrl = useCallback(async () => {
    const encoded = encodeScenarioToParam(scenario);
    const url = `${window.location.origin}${window.location.pathname}?s=${encoded}`;
    window.history.replaceState(null, '', `?s=${encoded}`);
    try {
      await navigator.clipboard.writeText(url);
      setToastMessage('Shareable scenario link copied to clipboard.');
    } catch {
      setToastMessage('Share link updated in browser address bar.');
    }
  }, [scenario]);

  return {
    scenario,
    savedScenarios,
    toastMessage,
    notify,
    selectPreset,
    setMode,
    updateSite,
    updatePropagation,
    applyEquipmentPreset,
    swapTxRx,
    placeRepeaterMidpoint,
    applyBalancedTowerBoost,
    saveScenarioToStorage,
    loadSavedScenario,
    deleteSavedScenario,
    copyShareUrl,
  };
}
