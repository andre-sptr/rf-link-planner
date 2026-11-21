import { useEffect, useRef, useState } from 'react';
import { BookOpen, FolderOpen, Save, Trash2, X } from 'lucide-react';
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

let cachedSupportsDisplayTransition: boolean | undefined;

function canTransitionDisplay(): boolean {
  if (cachedSupportsDisplayTransition !== undefined) {
    return cachedSupportsDisplayTransition;
  }
  if (
    typeof window === 'undefined' ||
    !window.CSS?.supports?.('transition-behavior', 'allow-discrete') ||
    !document.body
  ) {
    cachedSupportsDisplayTransition = false;
    return false;
  }
  const probe = document.createElement('div');
  probe.style.cssText =
    'transition: display 1s allow-discrete !important; display: block;';
  document.body.appendChild(probe);
  getComputedStyle(probe).display;
  probe.style.display = 'none';
  cachedSupportsDisplayTransition = getComputedStyle(probe).display === 'block';
  probe.remove();
  return cachedSupportsDisplayTransition;
}

function supportsTopLayerExit(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean(window.CSS?.supports?.('overlay', 'auto')) && canTransitionDisplay();
}

async function closeTopLayer(dialog: HTMLDialogElement): Promise<void> {
  if (!dialog.open) return;

  if (!supportsTopLayerExit() && typeof dialog.getAnimations === 'function') {
    dialog.setAttribute('data-closing', '');
    const animations = dialog.getAnimations({ subtree: true });
    if (animations.length > 0) {
      await Promise.race([
        Promise.allSettled(animations.map((a) => a.finished)),
        new Promise((resolve) => window.setTimeout(resolve, 400)),
      ]);
    }
    if (!dialog.hasAttribute('data-closing')) return;
    dialog.removeAttribute('data-closing');
  }

  if (dialog.open) {
    dialog.close();
  }
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
      dialog.removeAttribute('data-closing');
      if (!dialog.open) {
        try {
          dialog.showModal();
        } catch {
          dialog.setAttribute('open', 'true');
        }
      }
    } else if (dialog.open) {
      void closeTopLayer(dialog);
    }
  }, [mode]);

  // Top-layer exit animation interception + Safari fallback for closedby="any" light dismiss
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleClose = () => {
      dialog.removeAttribute('data-closing');
      dialog.returnValue = '';
      onClose();
    };

    const handleCancel = (e: Event) => {
      e.preventDefault();
      void closeTopLayer(dialog);
    };

    dialog.addEventListener('close', handleClose);
    dialog.addEventListener('cancel', handleCancel);

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
          void closeTopLayer(dialog);
        }
      };
      dialog.addEventListener('pointerdown', onDown);
      dialog.addEventListener('pointerup', onUp);

      return () => {
        dialog.removeEventListener('close', handleClose);
        dialog.removeEventListener('cancel', handleCancel);
        dialog.removeEventListener('pointerdown', onDown);
        dialog.removeEventListener('pointerup', onUp);
      };
    }

    return () => {
      dialog.removeEventListener('close', handleClose);
      dialog.removeEventListener('cancel', handleCancel);
    };
  }, [onClose]);

  const title =
    mode === 'formulas'
      ? 'RF Engineering Equations & DEM Methodology'
      : 'Scenarios & Saved Projects';

  const requestClose = () => {
    if (dialogRef.current) {
      void closeTopLayer(dialogRef.current);
    }
  };

  return (
    <dialog
      ref={dialogRef}
      className="rf-dialog"
      {...({ closedby: 'any' } as Record<string, string>)}
      aria-labelledby="rf-dialog-title"
    >
      <div
        className="flex items-center justify-between gap-3 px-4 py-3 border-b shrink-0"
        style={{
          borderColor: 'var(--border-subtle)',
          backgroundColor: 'color-mix(in srgb, var(--bg-elevated) 60%, transparent)',
        }}
      >
        <div className="flex items-center gap-2 min-w-0">
          {mode === 'formulas' ? (
            <BookOpen
              className="w-4 h-4 shrink-0"
              style={{ color: 'var(--accent)' }}
              aria-hidden="true"
            />
          ) : (
            <FolderOpen
              className="w-4 h-4 shrink-0"
              style={{ color: 'var(--accent)' }}
              aria-hidden="true"
            />
          )}
          <h2 id="rf-dialog-title" className="text-sm font-semibold truncate">
            {title}
          </h2>
        </div>
        <button
          type="button"
          onClick={requestClose}
          className="rf-icon-btn"
          aria-label="Close dialog"
        >
          <X className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>

      <div className="p-4 overflow-y-auto overscroll-contain space-y-4 text-xs">
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
                <button type="submit" className="rf-btn-primary shrink-0">
                  <Save className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>Save Scenario</span>
                </button>
              </div>
            </form>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3
                  className="font-semibold text-xs"
                  style={{ color: 'var(--text-secondary)' }}
                >
                  Saved Local Scenarios ({savedScenarios.length})
                </h3>
              </div>

              {savedScenarios.length === 0 ? (
                <div
                  className="p-3 rounded-lg border border-dashed text-xs"
                  style={{
                    borderColor: 'var(--border-subtle)',
                    color: 'var(--text-secondary)',
                  }}
                >
                  No saved scenarios yet. Save your active configuration above to store it in this browser.
                </div>
              ) : (
                <ul className="space-y-2">
                  {savedScenarios.map((entry) => (
                    <li
                      key={entry.scenario.id}
                      className="rf-card flex items-center justify-between gap-2.5 p-2.5"
                    >
                      <div className="min-w-0">
                        <div className="font-semibold truncate">
                          {entry.scenario.name}
                        </div>
                        <div
                          className="font-mono-num text-[11px] mt-0.5"
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
                            requestClose();
                          }}
                          className="rf-btn-primary"
                        >
                          Load
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteSaved(entry.scenario.id)}
                          className="rf-icon-btn"
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
              <h3
                className="font-semibold text-xs"
                style={{ color: 'var(--text-secondary)' }}
              >
                Built-in Indonesian Engineering Presets
              </h3>
              <ul className="space-y-2">
                {DEMO_SCENARIOS.map((preset) => {
                  const isCurrent = preset.id === activeScenario.id;
                  return (
                    <li
                      key={preset.id}
                      className="rf-card flex items-start sm:items-center justify-between gap-3 p-3"
                      style={
                        isCurrent
                          ? {
                              borderColor: 'var(--accent)',
                              backgroundColor: 'var(--accent-soft)',
                            }
                          : undefined
                      }
                    >
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="font-semibold">{preset.name}</span>
                          <span
                            className="font-mono-num text-[10px] px-1.5 py-0.5 rounded border"
                            style={{
                              borderColor: 'var(--border-subtle)',
                              backgroundColor: 'var(--bg-elevated)',
                              color: 'var(--text-secondary)',
                            }}
                          >
                            {preset.mode.toUpperCase()} · {preset.propagation.frequencyMhz} MHz
                          </span>
                        </div>
                        <p
                          className="leading-relaxed max-w-[65ch]"
                          style={{ color: 'var(--text-secondary)' }}
                        >
                          {preset.description}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          onSelectPreset(preset.id);
                          requestClose();
                        }}
                        className="rf-btn-subtle shrink-0"
                      >
                        Load Preset
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          </>
        )}

        {mode === 'formulas' && (
          <div className="w-full max-w-[65ch] mx-auto space-y-3 leading-relaxed">
            <div
              className="p-3.5 rounded-lg border space-y-1.5"
              style={{
                borderColor: 'var(--border-subtle)',
                backgroundColor: 'var(--bg-elevated)',
              }}
            >
              <div className="font-semibold">1. Free Space Path Loss (FSPL)</div>
              <code
                className="font-mono-num block px-2.5 py-1.5 rounded border text-[11.5px]"
                style={{
                  backgroundColor: 'var(--bg-panel)',
                  borderColor: 'var(--border-subtle)',
                }}
              >
                FSPL(dB) = 32.4418 + 20·log10(d_km) + 20·log10(f_MHz)
              </code>
            </div>

            <div
              className="p-3.5 rounded-lg border space-y-1.5"
              style={{
                borderColor: 'var(--border-subtle)',
                backgroundColor: 'var(--bg-elevated)',
              }}
            >
              <div className="font-semibold">2. 1st Fresnel Zone Radius &amp; Earth Bulge</div>
              <code
                className="font-mono-num block px-2.5 py-1.5 rounded border text-[11.5px]"
                style={{
                  backgroundColor: 'var(--bg-panel)',
                  borderColor: 'var(--border-subtle)',
                }}
              >
                F1(m) = sqrt((λ · d1 · d2) / (d1 + d2)), where λ = 299.792 / f_MHz
              </code>
              <code
                className="font-mono-num block px-2.5 py-1.5 rounded border text-[11.5px]"
                style={{
                  backgroundColor: 'var(--bg-panel)',
                  borderColor: 'var(--border-subtle)',
                }}
              >
                h_bulge(m) = (d1 · d2) / (2 · k · 6,371,008.8 m)
              </code>
              <p style={{ color: 'var(--text-secondary)' }}>
                Industry microwave/UHF practice targets ≥ 60% F1 clearance across the entire path to avoid diffraction fading.
              </p>
            </div>

            <div
              className="p-3.5 rounded-lg border space-y-1.5"
              style={{
                borderColor: 'var(--border-subtle)',
                backgroundColor: 'var(--bg-elevated)',
              }}
            >
              <div className="font-semibold">3. ITU-R P.526-15 Knife-Edge Diffraction</div>
              <code
                className="font-mono-num block px-2.5 py-1.5 rounded border text-[11.5px]"
                style={{
                  backgroundColor: 'var(--bg-panel)',
                  borderColor: 'var(--border-subtle)',
                }}
              >
                ν = -clearance · sqrt(2) / F1
              </code>
              <code
                className="font-mono-num block px-2.5 py-1.5 rounded border text-[11.5px]"
                style={{
                  backgroundColor: 'var(--bg-panel)',
                  borderColor: 'var(--border-subtle)',
                }}
              >
                L(ν) = 6.9 + 20·log10(sqrt((ν - 0.1)² + 1) + ν - 0.1) dB (for ν &gt; -0.78)
              </code>
            </div>

            <div
              className="p-3.5 rounded-lg border space-y-1.5"
              style={{
                borderColor: 'var(--border-subtle)',
                backgroundColor: 'var(--bg-elevated)',
              }}
            >
              <div className="font-semibold">4. Terrain DEM Pipeline</div>
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
