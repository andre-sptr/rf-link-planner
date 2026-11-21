import { useEffect, useMemo, useRef, useState } from 'react';
import {
  BookOpen,
  Box,
  Compass,
  Crosshair,
  FileDown,
  FolderOpen,
  Layers,
  Map as MapIcon,
  Maximize2,
  Moon,
  PanelLeft,
  PanelBottom,
  Radio,
  Search,
  Share2,
  Sparkles,
  Sun,
  ArrowUpDown,
} from 'lucide-react';
import { DEMO_SCENARIOS, type LinkMode } from '@linksight/rf-engine';
import type { ResolvedTheme } from '../lib/theme';
import type { BasemapId } from './MapCanvas';

export interface CommandItem {
  id: string;
  group: 'Scenarios' | 'Map & Camera' | 'RF Tools & Workspace';
  label: string;
  hint?: string;
  keywords?: string;
  icon: typeof Radio;
  onSelect: () => void;
}

export interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  scenarioId: string;
  mode: LinkMode;
  theme: ResolvedTheme;
  basemap: BasemapId;
  is3D: boolean;
  inspectorOpen: boolean;
  fresnelMinimized: boolean;
  zenMode: boolean;
  canOptimizeTower: boolean;
  onSelectPreset: (id: string) => void;
  onChangeMode: (mode: LinkMode) => void;
  onChangeBasemap: (basemap: BasemapId) => void;
  onToggle3D: () => void;
  onFitPath: () => void;
  onSwapTxRx: () => void;
  onCenterRepeater: () => void;
  onOptimizeTower: () => void;
  onToggleInspector: () => void;
  onToggleFresnel: () => void;
  onToggleZen: () => void;
  onToggleTheme: () => void;
  onOpenScenarios: () => void;
  onOpenFormulas: () => void;
  onShare: () => void;
  onExportPdf: () => void;
}

export function CommandPalette({
  open,
  onClose,
  scenarioId,
  mode,
  theme,
  basemap,
  is3D,
  inspectorOpen,
  fresnelMinimized,
  zenMode,
  canOptimizeTower,
  onSelectPreset,
  onChangeMode,
  onChangeBasemap,
  onToggle3D,
  onFitPath,
  onSwapTxRx,
  onCenterRepeater,
  onOptimizeTower,
  onToggleInspector,
  onToggleFresnel,
  onToggleZen,
  onToggleTheme,
  onOpenScenarios,
  onOpenFormulas,
  onShare,
  onExportPdf,
}: CommandPaletteProps) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open) {
      setQuery('');
      setActiveIndex(0);
      if (!dialog.open) {
        try {
          dialog.showModal();
        } catch {
          dialog.setAttribute('open', 'true');
        }
      }
      window.setTimeout(() => {
        inputRef.current?.focus();
      }, 0);
    } else if (dialog.open) {
      dialog.close();
    }
  }, [open]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleClose = () => {
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

  const items = useMemo<CommandItem[]>(() => {
    const list: CommandItem[] = [];

    for (const preset of DEMO_SCENARIOS) {
      list.push({
        id: `preset-${preset.id}`,
        group: 'Scenarios',
        label: preset.name,
        hint:
          preset.id === scenarioId
            ? 'Active'
            : `${preset.mode.toUpperCase()} · ${preset.propagation.frequencyMhz} MHz`,
        keywords: `${preset.description} ${preset.mode} ${preset.propagation.frequencyMhz}`,
        icon: Radio,
        onSelect: () => onSelectPreset(preset.id),
      });
    }

    list.push(
      {
        id: 'map-3d',
        group: 'Map & Camera',
        label: is3D ? 'Switch Map to 2D Flat View' : 'Enable 3D Vector Terrain',
        hint: is3D ? 'Currently 3D' : 'Currently 2D',
        keywords: '3d 2d pitch terrain relief elevation',
        icon: Box,
        onSelect: onToggle3D,
      },
      {
        id: 'map-fit',
        group: 'Map & Camera',
        label: 'Fit Link Path in View',
        hint: 'Re-center',
        keywords: 'zoom center bounds fit path',
        icon: Maximize2,
        onSelect: onFitPath,
      },
      {
        id: 'basemap-topo',
        group: 'Map & Camera',
        label: 'Basemap: Topo 3D (Liberty)',
        hint: basemap === 'topo' ? 'Active' : undefined,
        keywords: 'map style basemap topo contour',
        icon: Layers,
        onSelect: () => onChangeBasemap('topo'),
      },
      {
        id: 'basemap-clean',
        group: 'Map & Camera',
        label: 'Basemap: Studio Paper (Positron)',
        hint: basemap === 'clean' ? 'Active' : undefined,
        keywords: 'map style basemap clean minimal felt paper',
        icon: MapIcon,
        onSelect: () => onChangeBasemap('clean'),
      },
      {
        id: 'basemap-dark',
        group: 'Map & Camera',
        label: 'Basemap: Nocturnal Dark',
        hint: basemap === 'dark' ? 'Active' : undefined,
        keywords: 'map style basemap dark night',
        icon: Moon,
        onSelect: () => onChangeBasemap('dark'),
      },
      {
        id: 'basemap-sat',
        group: 'Map & Camera',
        label: 'Basemap: Satellite Imagery',
        hint: basemap === 'satellite' ? 'Active' : undefined,
        keywords: 'map style basemap esri aerial satellite',
        icon: Compass,
        onSelect: () => onChangeBasemap('satellite'),
      },
    );

    list.push({
      id: 'rf-mode',
      group: 'RF Tools & Workspace',
      label:
        mode === 'ptp'
          ? 'Switch Topology to Repeater Relay'
          : 'Switch Topology to Point-to-Point',
      hint: mode === 'ptp' ? 'PtP → Relay' : 'Relay → PtP',
      keywords: 'topology mode ptp relay repeater',
      icon: Radio,
      onSelect: () => onChangeMode(mode === 'ptp' ? 'relay' : 'ptp'),
    });

    list.push({
      id: 'rf-swap',
      group: 'RF Tools & Workspace',
      label: 'Swap TX and RX Sites',
      keywords: 'reverse swap tx rx',
      icon: ArrowUpDown,
      onSelect: onSwapTxRx,
    });

    if (mode === 'relay') {
      list.push({
        id: 'rf-center-rpt',
        group: 'RF Tools & Workspace',
        label: 'Center Repeater at Great-Circle Midpoint',
        keywords: 'midpoint repeater center',
        icon: Crosshair,
        onSelect: onCenterRepeater,
      });
    }

    if (canOptimizeTower) {
      list.push({
        id: 'rf-optimize-tower',
        group: 'RF Tools & Workspace',
        label: 'Optimize Tower Heights to ≥60% 1st Fresnel',
        hint: 'Advisor',
        keywords: 'tower boost height fresnel 60%',
        icon: Sparkles,
        onSelect: onOptimizeTower,
      });
    }

    list.push(
      {
        id: 'ws-inspector',
        group: 'RF Tools & Workspace',
        label: inspectorOpen ? 'Collapse Left Inspector Drawer' : 'Open Left Inspector Drawer',
        hint: '⌘\\',
        keywords: 'sidebar drawer panel inspector',
        icon: PanelLeft,
        onSelect: onToggleInspector,
      },
      {
        id: 'ws-fresnel',
        group: 'RF Tools & Workspace',
        label: fresnelMinimized ? 'Show Fresnel Profile Drawer' : 'Minimize Fresnel Profile Drawer',
        keywords: 'chart graph fresnel elevation bottom',
        icon: PanelBottom,
        onSelect: onToggleFresnel,
      },
      {
        id: 'ws-zen',
        group: 'RF Tools & Workspace',
        label: zenMode ? 'Exit Presentation Mode' : 'Enter Presentation Mode (Full Map)',
        hint: '⌘.',
        keywords: 'zen presentation fullscreen hide chrome',
        icon: Maximize2,
        onSelect: onToggleZen,
      },
      {
        id: 'ws-theme',
        group: 'RF Tools & Workspace',
        label: theme === 'dark' ? 'Switch to Light Studio Theme' : 'Switch to Nocturnal Dark Theme',
        keywords: 'theme light dark appearance',
        icon: theme === 'dark' ? Sun : Moon,
        onSelect: onToggleTheme,
      },
      {
        id: 'ws-scenarios',
        group: 'RF Tools & Workspace',
        label: 'Open Scenarios & Saved Projects',
        keywords: 'save load projects preset',
        icon: FolderOpen,
        onSelect: onOpenScenarios,
      },
      {
        id: 'ws-math',
        group: 'RF Tools & Workspace',
        label: 'Open RF Math & DEM Methodology',
        keywords: 'formulas fspl itu p526 fresnel srtm',
        icon: BookOpen,
        onSelect: onOpenFormulas,
      },
      {
        id: 'ws-share',
        group: 'RF Tools & Workspace',
        label: 'Copy Shareable Scenario URL',
        keywords: 'link share copy url',
        icon: Share2,
        onSelect: onShare,
      },
      {
        id: 'ws-pdf',
        group: 'RF Tools & Workspace',
        label: 'Export Site Survey PDF Report',
        keywords: 'pdf report download print export',
        icon: FileDown,
        onSelect: onExportPdf,
      },
    );

    return list;
  }, [
    scenarioId,
    mode,
    theme,
    basemap,
    is3D,
    inspectorOpen,
    fresnelMinimized,
    zenMode,
    canOptimizeTower,
    onSelectPreset,
    onChangeMode,
    onChangeBasemap,
    onToggle3D,
    onFitPath,
    onSwapTxRx,
    onCenterRepeater,
    onOptimizeTower,
    onToggleInspector,
    onToggleFresnel,
    onToggleZen,
    onToggleTheme,
    onOpenScenarios,
    onOpenFormulas,
    onShare,
    onExportPdf,
  ]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    const tokens = q.split(/\s+/);
    return items.filter((item) => {
      const hay = `${item.label} ${item.group} ${item.hint ?? ''} ${item.keywords ?? ''}`.toLowerCase();
      return tokens.every((t) => hay.includes(t));
    });
  }, [items, query]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  const executeItem = (item: CommandItem) => {
    onClose();
    item.onSelect();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!filtered.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((prev) => (prev + 1) % filtered.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((prev) => (prev - 1 + filtered.length) % filtered.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const target = filtered[activeIndex] ?? filtered[0];
      if (target) executeItem(target);
    }
  };

  const grouped = useMemo(() => {
    const map = new Map<CommandItem['group'], Array<{ item: CommandItem; flatIdx: number }>>();
    filtered.forEach((item, flatIdx) => {
      const bucket = map.get(item.group) ?? [];
      bucket.push({ item, flatIdx });
      map.set(item.group, bucket);
    });
    return Array.from(map.entries());
  }, [filtered]);

  return (
    <dialog
      ref={dialogRef}
      hidden={!open}
      className="rf-cmd-dialog"
      {...({ closedby: 'any' } as Record<string, string>)}
      aria-label="Quick command palette"
    >
      {open && (
        <>
          <div
            className="flex items-center gap-2.5 px-3.5 py-2.5 border-b"
            style={{ borderColor: 'var(--border-subtle)' }}
          >
            <Search
              className="w-4 h-4 shrink-0"
              style={{ color: 'var(--text-muted)' }}
              aria-hidden="true"
            />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Jump to scenario, switch 3D/basemap, or run RF action…"
              aria-label="Filter commands"
              className="w-full bg-transparent text-xs sm:text-[13px] outline-none"
              style={{ color: 'var(--text-primary)' }}
            />
            <kbd
              className="font-mono-num text-[10px] px-1.5 py-0.5 rounded border shrink-0"
              style={{
                borderColor: 'var(--border-subtle)',
                backgroundColor: 'var(--bg-elevated)',
                color: 'var(--text-muted)',
              }}
            >
              ESC
            </kbd>
          </div>

          <div className="overflow-y-auto overscroll-contain p-2 space-y-2.5 text-xs">
            {grouped.length === 0 ? (
              <div
                className="py-8 text-center text-xs"
                style={{ color: 'var(--text-secondary)' }}
              >
                No matching commands for “{query}”.
              </div>
            ) : (
              grouped.map(([groupName, entries]) => (
                <div key={groupName} className="space-y-1">
                  <div
                    className="px-2 pt-1 text-[10.5px] font-semibold tracking-wide"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    {groupName}
                  </div>
                  <div className="space-y-0.5">
                    {entries.map(({ item, flatIdx }) => {
                      const Icon = item.icon;
                      const active = flatIdx === activeIndex;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onMouseEnter={() => setActiveIndex(flatIdx)}
                          onClick={() => executeItem(item)}
                          className="w-full flex items-center justify-between gap-2.5 px-2.5 py-2 rounded-lg text-left transition-colors"
                          style={{
                            backgroundColor: active ? 'var(--accent-soft)' : 'transparent',
                            color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
                          }}
                        >
                          <span className="flex items-center gap-2.5 min-w-0">
                            <Icon
                              className="w-3.5 h-3.5 shrink-0"
                              style={{
                                color: active ? 'var(--accent)' : 'var(--text-muted)',
                              }}
                              aria-hidden="true"
                            />
                            <span className="font-medium truncate">{item.label}</span>
                          </span>
                          {item.hint && (
                            <span
                              className="font-mono-num text-[10.5px] px-1.5 py-0.5 rounded border shrink-0"
                              style={{
                                borderColor: 'var(--border-subtle)',
                                backgroundColor: 'var(--bg-panel)',
                                color: 'var(--text-muted)',
                              }}
                            >
                              {item.hint}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </dialog>
  );
}
