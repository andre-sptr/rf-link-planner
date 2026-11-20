import { useEffect, useRef, useState } from 'react';
import { Trash2, X } from 'lucide-react';
import { DEMO_SCENARIOS, type LinkScenario } from '@linksight/rf-engine';
import type { SavedScenarioEntry } from '../state/usePlannerStore';

export type DialogMode = 'scenarios' | 'formulas' | null;

export interface ScenarioDialogProps {
  mode: DialogMode;
  activeScenario: LinkScenario;
  savedScenarios: SavedScenarioEntry[];
  onClose: () => void;
  onSelectPreset: (id: string) => void;
  onSaveScenario: (name: string) => void;
  onLoadSaved: (id: string) => void;
  onDeleteSaved: (id: string) => void;
}

export function ScenarioDialog({
  mode,
  activeScenario,
  savedScenarios,
  onClose,
  onSelectPreset,
  onSaveScenario,
  onLoadSaved,
  onDeleteSaved,
}: ScenarioDialogProps) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const [saveName, setSaveName] = useState(activeScenario.name);

  useEffect(() => {
    setSaveName(activeScenario.name);
  }, [activeScenario.name, mode]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (mode !== null) {
      if (!dialog.open) {
        try {
          dialog.showModal();
        } catch {
          dialog.setAttribute('open', 'true');
        }
      }
    } else if (dialog.open) {
      dialog.close();
    }
  }, [mode]);

  // Safari fallback for closedby="any" light dismiss + returnValue reset on close
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleClose = () => {
      dialog.returnValue = '';
      onClose();
    };

    dialog.addEventListener('close', handleClose);

    if (!('closedBy' in HTMLDialogElement.prototype)) {
      const outside = (e: PointerEvent) => {
        const r = dialog.getBoundingClientRect();
        return (
          e.clientX < r.left ||
          e.clientX > r.right ||
          e.clientY < r.top ||
          e.clientY > r.bottom
        );
      };
      let pressedOutside = false;
      const onDown = (e: PointerEvent) => {
        pressedOutside = outside(e);
      };
      const onUp = (e: PointerEvent) => {
        if (pressedOutside && outside(e) && dialog.open) {
          dialog.close();
        }
      };
      dialog.addEventListener('pointerdown', onDown);
      dialog.addEventListener('pointerup', onUp);

      return () => {
        dialog.removeEventListener('close', handleClose);
        dialog.removeEventListener('pointerdown', onDown);
        dialog.removeEventListener('pointerup', onUp);
      };
    }

    return () => {
      dialog.removeEventListener('close', handleClose);
    };
  }, [onClose]);

  const title =
    mode === 'formulas'
      ? 'RF Engineering Equations & DEM Methodology'
      : 'Scenarios & Saved Projects';

  return (
    <dialog
      ref={dialogRef}
      className="rf-dialog"
      {...({ closedby: 'any' } as Record<string, string>)}
      aria-labelledby="rf-dialog-title"
    >
      <div
        className="flex items-center justify-between gap-3 px-4 py-3 border-b"
        style={{
          borderColor: 'var(--border-subtle)',
          backgroundColor: 'var(--bg-elevated)',
        }}
      >
        <h2 id="rf-dialog-title" className="text-sm font-semibold">
          {title}
        </h2>
        <button
          type="button"
          onClick={() => dialogRef.current?.close()}
          className="inline-flex items-center justify-center w-7 h-7 rounded border cursor-pointer"
          style={{
            borderColor: 'var(--border-subtle)',
            backgroundColor: 'var(--bg-panel)',
          }}
          aria-label="Close dialog"
        >
          <X className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>

      <div className="p-4 overflow-y-auto space-y-4 text-xs">
        {mode === 'scenarios' && (
          <>
            <form
              className="space-y-2 p-3 rounded-lg border"
              style={{
                borderColor: 'var(--border-subtle)',
                backgroundColor: 'var(--bg-elevated)',
              }}
              onSubmit={(e) => {
                e.preventDefault();
                onSaveScenario(saveName);
              }}
            >
              <label htmlFor="save-scenario-name" className="block font-semibold">
                Save Current Configuration Locally
              </label>
              <div className="flex gap-2">
                <input
                  id="save-scenario-name"
                  type="text"
                  className="rf-input flex-1"
                  value={saveName}
                  required
                  maxLength={80}
                  onChange={(e) => setSaveName(e.target.value)}
                />
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded font-semibold cursor-pointer"
                  style={{
                    backgroundColor: 'var(--accent)',
                    color: 'var(--accent-ink)',
                  }}
                >
                  Save Scenario
                </button>
              </div>
            </form>

            <div className="space-y-2">
              <h3 className="font-semibold text-xs uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
                Saved Local Scenarios ({savedScenarios.length})
              </h3>
              {savedScenarios.length === 0 ? (
                <p style={{ color: 'var(--text-secondary)' }}>
                  No saved scenarios yet. Save your active configuration above to store it in this browser.
                </p>
              ) : (
                <ul className="space-y-1.5">
                  {savedScenarios.map((entry) => (
                    <li
                      key={entry.scenario.id}
                      className="flex items-center justify-between gap-2 p-2.5 rounded-lg border"
                      style={{ borderColor: 'var(--border-subtle)' }}
                    >
                      <div className="min-w-0">
                        <div className="font-semibold truncate">
                          {entry.scenario.name}
                        </div>
                        <div
                          className="font-mono-num text-[11px]"
                          style={{ color: 'var(--text-secondary)' }}
                        >
                          {entry.scenario.mode.toUpperCase()} ·{' '}
                          {entry.scenario.propagation.frequencyMhz} MHz · Saved{' '}
                          {entry.savedAt.slice(0, 10)}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => {
                            onLoadSaved(entry.scenario.id);
                            dialogRef.current?.close();
                          }}
                          className="px-2.5 py-1 rounded font-medium cursor-pointer"
                          style={{
                            backgroundColor: 'var(--accent)',
                            color: 'var(--accent-ink)',
                          }}
                        >
                          Load
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteSaved(entry.scenario.id)}
                          className="p-1.5 rounded border cursor-pointer"
                          style={{ borderColor: 'var(--border-subtle)' }}
                          aria-label={`Delete ${entry.scenario.name}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="space-y-2">
              <h3 className="font-semibold text-xs uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
                Built-in Indonesian Engineering Presets
              </h3>
              <ul className="space-y-1.5">
                {DEMO_SCENARIOS.map((preset) => (
                  <li
                    key={preset.id}
                    className="flex items-center justify-between gap-2 p-2.5 rounded-lg border"
                    style={{ borderColor: 'var(--border-subtle)' }}
                  >
                    <div className="min-w-0">
                      <div className="font-semibold">{preset.name}</div>
                      <div style={{ color: 'var(--text-secondary)' }}>
                        {preset.description}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        onSelectPreset(preset.id);
                        dialogRef.current?.close();
                      }}
                      className="px-2.5 py-1 rounded border font-medium shrink-0 cursor-pointer"
                      style={{
                        borderColor: 'var(--border-subtle)',
                        backgroundColor: 'var(--bg-elevated)',
                      }}
                    >
                      Load Preset
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}

        {mode === 'formulas' && (
          <div className="space-y-3 leading-relaxed">
            <div className="p-3 rounded-lg border" style={{ borderColor: 'var(--border-subtle)', backgroundColor: 'var(--bg-elevated)' }}>
              <div className="font-semibold mb-1">1. Free Space Path Loss (FSPL)</div>
              <code className="font-mono-num block">
                FSPL(dB) = 32.4418 + 20·log10(d_km) + 20·log10(f_MHz)
              </code>
            </div>

            <div className="p-3 rounded-lg border" style={{ borderColor: 'var(--border-subtle)', backgroundColor: 'var(--bg-elevated)' }}>
              <div className="font-semibold mb-1">2. 1st Fresnel Zone Radius &amp; Earth Bulge</div>
              <code className="font-mono-num block">
                F1(m) = sqrt((λ · d1 · d2) / (d1 + d2)), where λ = 299.792 / f_MHz
              </code>
              <code className="font-mono-num block mt-1">
                h_bulge(m) = (d1 · d2) / (2 · k · 6,371,008.8 m)
              </code>
              <p className="mt-1" style={{ color: 'var(--text-secondary)' }}>
                Industry microwave/UHF practice targets ≥ 60% F1 clearance across the entire path to avoid diffraction fading.
              </p>
            </div>

            <div className="p-3 rounded-lg border" style={{ borderColor: 'var(--border-subtle)', backgroundColor: 'var(--bg-elevated)' }}>
              <div className="font-semibold mb-1">3. ITU-R P.526-15 Knife-Edge Diffraction</div>
              <code className="font-mono-num block">
                ν = -clearance · sqrt(2) / F1
              </code>
              <code className="font-mono-num block mt-1">
                L(ν) = 6.9 + 20·log10(sqrt((ν - 0.1)² + 1) + ν - 0.1) dB (for ν &gt; -0.78)
              </code>
            </div>

            <div className="p-3 rounded-lg border" style={{ borderColor: 'var(--border-subtle)', backgroundColor: 'var(--bg-elevated)' }}>
              <div className="font-semibold mb-1">4. Terrain DEM Pipeline</div>
              <p style={{ color: 'var(--text-secondary)' }}>
                Great-circle path samples query the Fastify backend, which resolves missing coordinates from OpenTopoData SRTM 30m first, fails over to Open-Meteo Copernicus 90m on rate limits, and caches points at 4-decimal (~11 m) precision in SQLite WAL.
              </p>
            </div>
          </div>
        )}
      </div>
    </dialog>
  );
}
