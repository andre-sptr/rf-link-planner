import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Maximize2 } from 'lucide-react';
import type {
  FresnelPoint,
  LinkAnalysisResult,
  LinkScenario,
  LinkVerdict,
} from '@linksight/rf-engine';
import type { ResolvedTheme } from '../lib/theme';

export type BasemapId = 'topo' | 'satellite' | 'street' | 'dark';

const BASEMAPS: Record<
  BasemapId,
  {
    label: string;
    url: string;
    overlayUrl?: string;
    attribution: string;
    maxZoom: number;
  }
> = {
  topo: {
    label: 'Topo',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri',
    maxZoom: 18,
  },
  satellite: {
    label: 'Satellite',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Imagery &copy; Esri',
    maxZoom: 18,
  },
  street: {
    label: 'Street',
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 19,
  },
  dark: {
    label: 'Dark',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
    overlayUrl:
      'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}',
    attribution: 'Tiles &copy; Esri',
    maxZoom: 16,
  },
};

function verdictStroke(verdict: LinkVerdict): string {
  switch (verdict) {
    case 'pass':
      return '#10b981';
    case 'marginal':
      return '#f59e0b';
    case 'fail':
      return '#ef4444';
    default:
      return '#64748b';
  }
}

function createPinIcon(label: string, fill: string): L.DivIcon {
  return L.divIcon({
    className: 'linksight-pin-wrap',
    iconSize: [34, 40],
    iconAnchor: [17, 38],
    html: `<svg width="34" height="40" viewBox="0 0 34 40" xmlns="http://www.w3.org/2000/svg">
      <path d="M17 2C9.8 2 4 7.8 4 15c0 9.6 13 23 13 23s13-13.4 13-23c0-7.2-5.8-13-13-13z" fill="${fill}" stroke="#ffffff" stroke-width="2"/>
      <text x="17" y="18.5" text-anchor="middle" fill="#ffffff" font-size="9.5" font-weight="700" font-family="IBM Plex Mono, monospace">${label}</text>
    </svg>`,
  });
}

function createHazardIcon(): L.DivIcon {
  return L.divIcon({
    className: 'linksight-pin-wrap',
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    html: `<svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <polygon points="12,3 22,20 2,20" fill="#ef4444" stroke="#ffffff" stroke-width="1.8"/>
      <text x="12" y="17.5" text-anchor="middle" fill="#ffffff" font-size="10" font-weight="700">!</text>
    </svg>`,
  });
}

function createHoverCrosshairIcon(): L.DivIcon {
  return L.divIcon({
    className: 'linksight-pin-wrap',
    iconSize: [18, 18],
    iconAnchor: [9, 9],
    html: `<svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
      <circle cx="9" cy="9" r="6" fill="none" stroke="#0284c7" stroke-width="2.5"/>
      <circle cx="9" cy="9" r="2.2" fill="#ffffff" stroke="#0284c7" stroke-width="1.2"/>
    </svg>`,
  });
}

export interface MapCanvasProps {
  scenario: LinkScenario;
  analysis: LinkAnalysisResult;
  theme: ResolvedTheme;
  hoveredPoint: FresnelPoint | null;
  onMoveSite: (
    role: 'tx' | 'repeater' | 'rx',
    coords: { lat: number; lng: number },
  ) => void;
  onSelectSiteFocus?: (role: 'tx' | 'repeater' | 'rx') => void;
}

export function MapCanvas({
  scenario,
  analysis,
  theme,
  hoveredPoint,
  onMoveSite,
}: MapCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const labelLayerRef = useRef<L.TileLayer | null>(null);
  const overlayLayerRef = useRef<L.LayerGroup | null>(null);
  const hoverMarkerRef = useRef<L.Marker | null>(null);

  const [basemap, setBasemap] = useState<BasemapId>(
    theme === 'dark' ? 'dark' : 'topo',
  );
  const lastScenarioIdRef = useRef<string>('');

  // Keep latest callback ref so marker drag listeners always invoke fresh state setter
  const onMoveSiteRef = useRef(onMoveSite);
  onMoveSiteRef.current = onMoveSite;

  // Initialize Leaflet map once
  useEffect(() => {
    const el = containerRef.current;
    if (!el || mapRef.current) return;

    try {
      const map = L.map(el, {
        center: [scenario.tx.coords.lat, scenario.tx.coords.lng],
        zoom: 11,
        zoomControl: true,
      });

      const overlays = L.layerGroup().addTo(map);

      mapRef.current = map;
      overlayLayerRef.current = overlays;

      let ro: ResizeObserver | null = null;
      if (typeof ResizeObserver !== 'undefined') {
        ro = new ResizeObserver(() => {
          map.invalidateSize({ animate: false });
        });
        ro.observe(el);
      }

      return () => {
        ro?.disconnect();
        map.remove();
        mapRef.current = null;
        tileLayerRef.current = null;
        labelLayerRef.current = null;
        overlayLayerRef.current = null;
        hoverMarkerRef.current = null;
      };
    } catch {
      // Graceful no-op in non-layout environments such as jsdom tests
      return undefined;
    }
  }, []);

  // Switch basemap tile layer
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
      tileLayerRef.current = null;
    }
    if (labelLayerRef.current) {
      map.removeLayer(labelLayerRef.current);
      labelLayerRef.current = null;
    }

    const cfg = BASEMAPS[basemap];
    const baseLayer = L.tileLayer(cfg.url, {
      attribution: cfg.attribution,
      maxZoom: cfg.maxZoom,
      zIndex: 0,
    }).addTo(map);
    tileLayerRef.current = baseLayer;

    if (cfg.overlayUrl) {
      labelLayerRef.current = L.tileLayer(cfg.overlayUrl, {
        maxZoom: cfg.maxZoom,
        zIndex: 1,
      }).addTo(map);
    }
  }, [basemap]);

  // Draw markers, paths, and obstruction warnings
  useEffect(() => {
    const map = mapRef.current;
    const overlays = overlayLayerRef.current;
    if (!map || !overlays) return;

    overlays.clearLayers();

    // Direct reference dashed path when in Relay mode
    if (scenario.mode === 'relay') {
      const directStroke = analysis.directReference
        ? verdictStroke(analysis.directReference.verdict)
        : '#64748b';
      L.polyline(
        [
          [scenario.tx.coords.lat, scenario.tx.coords.lng],
          [scenario.rx.coords.lat, scenario.rx.coords.lng],
        ],
        {
          color: directStroke,
          weight: 2,
          dashArray: '6 6',
          opacity: 0.75,
        },
      ).addTo(overlays);
    }

    // Active hop polylines
    for (const hop of analysis.hops) {
      L.polyline(
        [
          [hop.txSite.coords.lat, hop.txSite.coords.lng],
          [hop.rxSite.coords.lat, hop.rxSite.coords.lng],
        ],
        {
          color: verdictStroke(hop.verdict),
          weight: 4,
          opacity: 0.92,
        },
      )
        .bindTooltip(
          `${hop.label}: ${hop.distanceKm.toFixed(2)} km | Margin ${hop.fadeMarginDb.toFixed(1)} dB`,
          { sticky: true },
        )
        .addTo(overlays);

      if (hop.worstPoint && hop.minClearanceRatio < 0.6) {
        L.marker([hop.worstPoint.lat, hop.worstPoint.lng], {
          icon: createHazardIcon(),
          interactive: true,
        })
          .bindTooltip(
            `Worst Clearance (${hop.hopId.toUpperCase()}): ${(hop.minClearanceRatio * 100).toFixed(0)}% F1 @ ${hop.worstPoint.distanceKm.toFixed(1)} km`,
          )
          .addTo(overlays);
      }
    }

    const addSiteMarker = (
      role: 'tx' | 'repeater' | 'rx',
      label: string,
      color: string,
      siteName: string,
      coords: { lat: number; lng: number },
    ) => {
      const marker = L.marker([coords.lat, coords.lng], {
        draggable: true,
        icon: createPinIcon(label, color),
      })
        .bindTooltip(`${label}: ${siteName} (drag to move)`, {
          direction: 'top',
          offset: [0, -34],
        })
        .addTo(overlays);

      marker.on('dragend', () => {
        const ll = marker.getLatLng();
        onMoveSiteRef.current(role, {
          lat: Number(ll.lat.toFixed(5)),
          lng: Number(ll.lng.toFixed(5)),
        });
      });
    };

    addSiteMarker('tx', 'TX', '#026498', scenario.tx.name, scenario.tx.coords);
    if (scenario.mode === 'relay') {
      addSiteMarker(
        'repeater',
        'RPT',
        '#d97706',
        scenario.repeater.name,
        scenario.repeater.coords,
      );
    }
    addSiteMarker('rx', 'RX', '#0f7b55', scenario.rx.name, scenario.rx.coords);

    // Fit map bounds automatically when switching scenario or mode
    const fitKey = `${scenario.id}:${scenario.mode}`;
    if (lastScenarioIdRef.current !== fitKey) {
      lastScenarioIdRef.current = fitKey;
      const coords: L.LatLngExpression[] = [
        [scenario.tx.coords.lat, scenario.tx.coords.lng],
        [scenario.rx.coords.lat, scenario.rx.coords.lng],
      ];
      if (scenario.mode === 'relay') {
        coords.push([scenario.repeater.coords.lat, scenario.repeater.coords.lng]);
      }
      map.fitBounds(L.latLngBounds(coords), { padding: [64, 64], maxZoom: 13 });
    }
  }, [scenario, analysis]);

  // Synchronize chart hover crosshair marker on map
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (!hoveredPoint) {
      if (hoverMarkerRef.current) {
        map.removeLayer(hoverMarkerRef.current);
        hoverMarkerRef.current = null;
      }
      return;
    }

    if (!hoverMarkerRef.current) {
      hoverMarkerRef.current = L.marker([hoveredPoint.lat, hoveredPoint.lng], {
        icon: createHoverCrosshairIcon(),
        interactive: false,
      }).addTo(map);
    } else {
      hoverMarkerRef.current.setLatLng([hoveredPoint.lat, hoveredPoint.lng]);
    }
  }, [hoveredPoint]);

  const handleFitBounds = () => {
    const map = mapRef.current;
    if (!map) return;
    const coords: L.LatLngExpression[] = [
      [scenario.tx.coords.lat, scenario.tx.coords.lng],
      [scenario.rx.coords.lat, scenario.rx.coords.lng],
    ];
    if (scenario.mode === 'relay') {
      coords.push([scenario.repeater.coords.lat, scenario.repeater.coords.lng]);
    }
    map.fitBounds(L.latLngBounds(coords), { padding: [64, 64], maxZoom: 14 });
  };

  return (
    <div className="relative w-full h-full min-h-[280px]">
      <div
        ref={containerRef}
        className="w-full h-full"
        aria-label="Interactive RF topology map"
      />

      {/* Basemap & Fit Path Controls */}
      <div className="absolute bottom-3 right-3 z-[400] flex items-center gap-1.5">
        <div
          className="inline-flex rounded-md border p-0.5 text-xs shadow-md backdrop-blur-sm"
          style={{
            backgroundColor:
              'color-mix(in srgb, var(--bg-panel) 92%, transparent)',
            borderColor: 'var(--border-subtle)',
          }}
        >
          {(Object.keys(BASEMAPS) as BasemapId[]).map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setBasemap(id)}
              className="px-2 py-1 rounded font-medium cursor-pointer"
              style={
                basemap === id
                  ? {
                      backgroundColor: 'var(--accent)',
                      color: 'var(--accent-ink)',
                    }
                  : { color: 'var(--text-secondary)' }
              }
            >
              {BASEMAPS[id].label}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={handleFitBounds}
          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border text-xs font-medium shadow-md cursor-pointer"
          style={{
            backgroundColor:
              'color-mix(in srgb, var(--bg-panel) 92%, transparent)',
            borderColor: 'var(--border-subtle)',
          }}
          title="Fit all sites in view"
        >
          <Maximize2 className="w-3.5 h-3.5" aria-hidden="true" />
          <span className="hidden sm:inline">Fit Path</span>
        </button>
      </div>
    </div>
  );
}
