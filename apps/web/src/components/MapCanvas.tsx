import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AttributionControl,
  GeoJSONSource,
  LngLatBounds,
  MapLibreMap,
  Marker,
  setWorkerUrl,
  type LayerSpecification,
  type MapLayerMouseEvent,
  type MapMouseEvent,
  type PaddingOptions,
  type StyleSpecification,
} from 'maplibre-gl';
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import 'maplibre-gl/dist/maplibre-gl.css';

if (typeof window !== 'undefined' && maplibreWorkerUrl) {
  setWorkerUrl(maplibreWorkerUrl);
}
import {
  Compass,
  Copy,
  Maximize2,
  Minus,
  Plus,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import type {
  FresnelPoint,
  LinkAnalysisResult,
  LinkMode,
  LinkScenario,
  LinkVerdict,
  SiteRole,
} from '@linksight/rf-engine';
import type { ResolvedTheme } from '../lib/theme';
import type { FresnelDrawerState } from './FresnelProfileChart';

export type BasemapId = 'topo' | 'clean' | 'dark' | 'satellite';

const BASEMAPS: Record<BasemapId, { label: string }> = {
  topo: { label: 'Topo 3D' },
  clean: { label: 'Studio' },
  dark: { label: 'Dark' },
  satellite: { label: 'Satellite' },
};

const MAPTERHORN_TILEJSON = 'https://tiles.mapterhorn.com/tilejson.json';

const SATELLITE_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    'esri-imagery': {
      type: 'raster',
      tiles: [
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      ],
      tileSize: 256,
      maxzoom: 18,
      attribution: 'Imagery &copy; Esri',
    },
    'esri-labels': {
      type: 'raster',
      tiles: [
        'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
      ],
      tileSize: 256,
      maxzoom: 16,
    },
  },
  layers: [
    { id: 'esri-imagery', type: 'raster', source: 'esri-imagery' },
    { id: 'esri-labels', type: 'raster', source: 'esri-labels' },
  ],
};

function getMapStyle(basemap: BasemapId): string | StyleSpecification {
  switch (basemap) {
    case 'topo':
      return 'https://tiles.openfreemap.org/styles/liberty';
    case 'clean':
      return 'https://tiles.openfreemap.org/styles/positron';
    case 'dark':
      return 'https://tiles.openfreemap.org/styles/dark';
    case 'satellite':
      return SATELLITE_STYLE;
  }
}

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

function roleColorHex(role: SiteRole): string {
  switch (role) {
    case 'tx':
      return '#0066cc';
    case 'repeater':
      return '#d97706';
    case 'rx':
      return '#059669';
  }
}

function roleShortLabel(role: SiteRole): string {
  switch (role) {
    case 'tx':
      return 'TX';
    case 'repeater':
      return 'RPT';
    case 'rx':
      return 'RX';
  }
}

function hasWebGLSupport(): boolean {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return false;
  }
  try {
    const canvas = document.createElement('canvas');
    return Boolean(
      window.WebGLRenderingContext &&
        (canvas.getContext('webgl2') ||
          canvas.getContext('webgl') ||
          canvas.getContext('experimental-webgl')),
    );
  } catch {
    return false;
  }
}

export interface MapCanvasProps {
  scenario: LinkScenario;
  analysis: LinkAnalysisResult;
  theme: ResolvedTheme;
  hoveredPoint: FresnelPoint | null;
  selectedHopId: 'direct' | 'hop1' | 'hop2';
  selectedSiteRole: SiteRole | null;
  basemap: BasemapId;
  is3D: boolean;
  inspectorOpen: boolean;
  fresnelState: FresnelDrawerState;
  fresnelHeightPx: number;
  zenMode: boolean;
  fitTrigger: number;
  focusSiteTrigger: { role: SiteRole; seq: number } | null;
  onChangeBasemap: (basemap: BasemapId) => void;
  onToggle3D: () => void;
  onSelectHop: (hopId: 'direct' | 'hop1' | 'hop2') => void;
  onSelectSite: (role: SiteRole | null) => void;
  onMoveSite: (role: SiteRole, coords: { lat: number; lng: number }) => void;
  onUpdateSiteHeight: (role: SiteRole, antennaHeightM: number) => void;
  onEditInInspector: (role: SiteRole) => void;
  onNotify?: (msg: string) => void;
}

interface SiteMarkerHandle {
  marker: Marker;
  btn: HTMLButtonElement;
  pill: HTMLSpanElement;
  dragging: boolean;
}

type LineGeoJsonData = Parameters<GeoJSONSource['setData']>[0];
type LineFeature = {
  type: 'Feature';
  properties: Record<string, unknown>;
  geometry: { type: 'LineString'; coordinates: [number, number][] };
};

export function MapCanvas({
  scenario,
  analysis,
  theme,
  hoveredPoint,
  selectedHopId,
  selectedSiteRole,
  basemap,
  is3D,
  inspectorOpen,
  fresnelState,
  fresnelHeightPx,
  zenMode,
  fitTrigger,
  focusSiteTrigger,
  onChangeBasemap,
  onToggle3D,
  onSelectHop,
  onSelectSite,
  onMoveSite,
  onUpdateSiteHeight,
  onEditInInspector,
  onNotify,
}: MapCanvasProps) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const styleReadyRef = useRef<boolean>(false);
  const appliedBasemapRef = useRef<BasemapId>(basemap);
  const lastScenarioKeyRef = useRef<string>('');

  const siteMarkersRef = useRef<Partial<Record<SiteRole, SiteMarkerHandle>>>({});
  const hazardMarkersRef = useRef<Marker[]>([]);
  const hoverMarkerRef = useRef<Marker | null>(null);

  const [bearingDeg, setBearingDeg] = useState(is3D ? -16 : 0);
  const [popoverScreenPos, setPopoverScreenPos] = useState<{ x: number; y: number } | null>(
    null,
  );
  const [ctxMenu, setCtxMenu] = useState<{
    x: number;
    y: number;
    lat: number;
    lng: number;
  } | null>(null);
  const [hoveredHopTooltip, setHoveredHopTooltip] = useState<{
    x: number;
    y: number;
    label: string;
    distanceKm: number;
    fadeMarginDb: number;
    clearancePct: number;
  } | null>(null);

  // Refs for fresh state inside MapLibre callbacks
  const scenarioRef = useRef(scenario);
  scenarioRef.current = scenario;
  const analysisRef = useRef(analysis);
  analysisRef.current = analysis;
  const selectedHopRef = useRef(selectedHopId);
  selectedHopRef.current = selectedHopId;
  const selectedSiteRef = useRef(selectedSiteRole);
  selectedSiteRef.current = selectedSiteRole;
  const basemapRef = useRef(basemap);
  basemapRef.current = basemap;
  const is3DRef = useRef(is3D);
  is3DRef.current = is3D;
  const themeRef = useRef(theme);
  themeRef.current = theme;
  const modeRef = useRef<LinkMode>(scenario.mode);
  modeRef.current = scenario.mode;

  const onMoveSiteRef = useRef(onMoveSite);
  onMoveSiteRef.current = onMoveSite;
  const onSelectHopRef = useRef(onSelectHop);
  onSelectHopRef.current = onSelectHop;
  const onSelectSiteRef = useRef(onSelectSite);
  onSelectSiteRef.current = onSelectSite;

  const computeHudPadding = useCallback((): PaddingOptions => {
    const w = wrapperRef.current?.clientWidth ?? 1280;
    const isDesktop = w >= 1024;
    if (!isDesktop) {
      return { top: 44, bottom: 44, left: 44, right: 44 };
    }
    if (zenMode) {
      return { top: 64, bottom: 84, left: 64, right: 80 };
    }
    const bottomChartSpace =
      fresnelState === 'minimized'
        ? 84
        : (fresnelState === 'expanded' ? 330 : fresnelHeightPx) + 108;

    return {
      top: w >= 1440 ? 84 : 128,
      left: inspectorOpen ? (w >= 1280 ? 424 : 388) : 64,
      right: 84,
      bottom: Math.min(460, bottomChartSpace),
    };
  }, [zenMode, inspectorOpen, fresnelState, fresnelHeightPx]);

  const fitAllSites = useCallback(
    (animate = true) => {
      const map = mapRef.current;
      if (!map) return;
      const sc = scenarioRef.current;
      const bounds = new LngLatBounds(
        [sc.tx.coords.lng, sc.tx.coords.lat],
        [sc.tx.coords.lng, sc.tx.coords.lat],
      );
      bounds.extend([sc.rx.coords.lng, sc.rx.coords.lat]);
      if (sc.mode === 'relay') {
        bounds.extend([sc.repeater.coords.lng, sc.repeater.coords.lat]);
      }
      map.fitBounds(bounds, {
        padding: computeHudPadding(),
        maxZoom: 13.5,
        pitch: is3DRef.current ? 52 : 0,
        bearing: is3DRef.current ? -16 : 0,
        duration: animate ? 620 : 0,
      });
    },
    [computeHudPadding],
  );

  const buildGeoJsonData = useCallback(() => {
    const sc = scenarioRef.current;
    const an = analysisRef.current;
    const selHop = selectedHopRef.current;

    const directFeatures: LineFeature[] = [];
    if (sc.mode === 'relay') {
      const directStroke = an.directReference
        ? verdictStroke(an.directReference.verdict)
        : '#64748b';
      directFeatures.push({
        type: 'Feature',
        properties: { color: directStroke },
        geometry: {
          type: 'LineString',
          coordinates: [
            [sc.tx.coords.lng, sc.tx.coords.lat],
            [sc.rx.coords.lng, sc.rx.coords.lat],
          ],
        },
      });
    }

    const hopFeatures: LineFeature[] = an.hops.map((hop) => ({
      type: 'Feature',
      properties: {
        hopId: hop.hopId,
        label: hop.label,
        color: verdictStroke(hop.verdict),
        isSelected: hop.hopId === selHop,
        distanceKm: Number(hop.distanceKm.toFixed(2)),
        fadeMarginDb: Number(hop.fadeMarginDb.toFixed(1)),
        clearancePct: Math.round(hop.minClearanceRatio * 100),
      },
      geometry: {
        type: 'LineString',
        coordinates: [
          [hop.txSite.coords.lng, hop.txSite.coords.lat],
          [hop.rxSite.coords.lng, hop.rxSite.coords.lat],
        ],
      },
    }));

    return {
      direct: { type: 'FeatureCollection', features: directFeatures } as LineGeoJsonData,
      hops: { type: 'FeatureCollection', features: hopFeatures } as LineGeoJsonData,
    };
  }, []);

  const syncPathLayers = useCallback(
    (map: MapLibreMap) => {
      if (!styleReadyRef.current) return;
      const data = buildGeoJsonData();

      const directSrc = map.getSource('rf-direct-ref') as GeoJSONSource | undefined;
      if (directSrc) {
        directSrc.setData(data.direct);
      } else {
        map.addSource('rf-direct-ref', { type: 'geojson', data: data.direct });
        map.addLayer({
          id: 'rf-direct-ref-line',
          type: 'line',
          source: 'rf-direct-ref',
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: {
            'line-color': ['get', 'color'],
            'line-width': 2.2,
            'line-dasharray': [3, 3],
            'line-opacity': 0.78,
          },
        });
      }

      const hopsSrc = map.getSource('rf-hops') as GeoJSONSource | undefined;
      if (hopsSrc) {
        hopsSrc.setData(data.hops);
      } else {
        map.addSource('rf-hops', { type: 'geojson', data: data.hops });
        map.addLayer({
          id: 'rf-hops-glow',
          type: 'line',
          source: 'rf-hops',
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: {
            'line-color': ['get', 'color'],
            'line-width': ['case', ['get', 'isSelected'], 13, 8],
            'line-blur': 5,
            'line-opacity': 0.28,
          },
        });
        map.addLayer({
          id: 'rf-hops-core',
          type: 'line',
          source: 'rf-hops',
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: {
            'line-color': ['get', 'color'],
            'line-width': ['case', ['get', 'isSelected'], 4.2, 2.8],
            'line-opacity': 0.96,
          },
        });
      }
    },
    [buildGeoJsonData],
  );

  const syncTerrainAndSky = useCallback((map: MapLibreMap) => {
    if (!styleReadyRef.current) return;
    const enable3D = is3DRef.current;
    const currentBasemap = basemapRef.current;
    const isDarkSurface = currentBasemap === 'dark' || themeRef.current === 'dark';

    if (enable3D) {
      if (!map.getSource('terrainSource')) {
        map.addSource('terrainSource', {
          type: 'raster-dem',
          url: MAPTERHORN_TILEJSON,
        });
      }
      if (!map.getSource('hillshadeSource')) {
        map.addSource('hillshadeSource', {
          type: 'raster-dem',
          url: MAPTERHORN_TILEJSON,
        });
      }

      if (currentBasemap !== 'satellite' && !map.getLayer('hills')) {
        const firstSymbolId = map
          .getStyle()
          .layers?.find((l: LayerSpecification) => l.type === 'symbol')?.id;
        map.addLayer(
          {
            id: 'hills',
            type: 'hillshade',
            source: 'hillshadeSource',
            layout: { visibility: 'visible' },
            paint: {
              'hillshade-shadow-color': isDarkSurface ? '#020617' : '#334155',
              'hillshade-highlight-color': isDarkSurface ? '#334155' : '#ffffff',
              'hillshade-exaggeration': isDarkSurface ? 0.35 : 0.42,
            },
          },
          firstSymbolId,
        );
      } else if (map.getLayer('hills')) {
        map.setLayoutProperty('hills', 'visibility', 'visible');
      }

      try {
        map.setTerrain({ source: 'terrainSource', exaggeration: 1.35 });
      } catch {
        // ignore if DEM source is still initializing
      }

      try {
        map.setSky({
          'sky-color': isDarkSurface ? '#09111e' : '#93c5fd',
          'horizon-color': isDarkSurface ? '#162338' : '#e0f2fe',
          'fog-color': isDarkSurface ? '#0c1320' : '#edf4fb',
          'fog-ground-blend': 0.48,
          'horizon-fog-blend': 0.55,
          'atmosphere-blend': 0.72,
        });
      } catch {
        // ignore sky unsupported environments
      }
    } else {
      try {
        map.setTerrain(null);
      } catch {
        // ignore
      }
      if (map.getLayer('hills')) {
        map.setLayoutProperty('hills', 'visibility', 'none');
      }
    }
  }, []);

  const updateQuickPopoverScreenPos = useCallback(() => {
    const map = mapRef.current;
    const role = selectedSiteRef.current;
    if (!map || !role || !wrapperRef.current) {
      setPopoverScreenPos(null);
      return;
    }
    const sc = scenarioRef.current;
    if (role === 'repeater' && sc.mode !== 'relay') {
      setPopoverScreenPos(null);
      return;
    }
    const site = sc[role];
    const pt = map.project([site.coords.lng, site.coords.lat]);
    const w = wrapperRef.current.clientWidth;
    const h = wrapperRef.current.clientHeight;
    const clampedX = Math.max(150, Math.min(w - 150, pt.x));
    const clampedY = Math.max(175, Math.min(h - 32, pt.y - 46));
    setPopoverScreenPos({ x: clampedX, y: clampedY });
  }, []);

  // Initialize MapLibre GL map once
  useEffect(() => {
    const el = containerRef.current;
    if (!el || mapRef.current || !hasWebGLSupport()) return;

    let map: MapLibreMap;
    try {
      appliedBasemapRef.current = basemapRef.current;
      map = new MapLibreMap({
        container: el,
        style: getMapStyle(basemapRef.current),
        center: [scenarioRef.current.tx.coords.lng, scenarioRef.current.tx.coords.lat],
        zoom: 10.5,
        pitch: is3DRef.current ? 52 : 0,
        bearing: is3DRef.current ? -16 : 0,
        maxPitch: 78,
        attributionControl: false,
      });
    } catch {
      return;
    }

    map.addControl(new AttributionControl({ compact: true }), 'bottom-right');

    const onStyleLoad = () => {
      styleReadyRef.current = true;
      syncTerrainAndSky(map);
      syncPathLayers(map);
    };
    map.on('style.load', onStyleLoad);

    map.on('rotate', () => {
      setBearingDeg(Math.round(map.getBearing()));
    });

    map.on('move', () => {
      updateQuickPopoverScreenPos();
      setCtxMenu(null);
    });

    map.on('click', (e: MapMouseEvent) => {
      setCtxMenu(null);
      const hit = map.queryRenderedFeatures(e.point, {
        layers: map.getLayer('rf-hops-core') ? ['rf-hops-core'] : [],
      });
      if (hit.length === 0) {
        onSelectSiteRef.current(null);
      }
    });

    map.on('mousemove', 'rf-hops-core', (e: MapLayerMouseEvent) => {
      map.getCanvas().style.cursor = 'pointer';
      const f = e.features?.[0];
      if (!f?.properties) return;
      setHoveredHopTooltip({
        x: e.point.x,
        y: e.point.y,
        label: String(f.properties.label ?? ''),
        distanceKm: Number(f.properties.distanceKm ?? 0),
        fadeMarginDb: Number(f.properties.fadeMarginDb ?? 0),
        clearancePct: Number(f.properties.clearancePct ?? 0),
      });
    });

    map.on('mouseleave', 'rf-hops-core', () => {
      map.getCanvas().style.cursor = '';
      setHoveredHopTooltip(null);
    });

    map.on('click', 'rf-hops-core', (e: MapLayerMouseEvent) => {
      const hopId = e.features?.[0]?.properties?.hopId;
      if (hopId === 'direct' || hopId === 'hop1' || hopId === 'hop2') {
        onSelectHopRef.current(hopId);
      }
    });

    map.on('contextmenu', (e: MapMouseEvent) => {
      e.preventDefault();
      onSelectSiteRef.current(null);
      const w = wrapperRef.current?.clientWidth ?? 1280;
      const h = wrapperRef.current?.clientHeight ?? 800;
      setCtxMenu({
        x: Math.max(16, Math.min(w - 205, e.point.x)),
        y: Math.max(68, Math.min(h - 190, e.point.y)),
        lat: Number(e.lngLat.lat.toFixed(5)),
        lng: Number(e.lngLat.lng.toFixed(5)),
      });
    });

    // Create persistent TX, RPT, RX draggable markers
    const createSiteMarker = (role: SiteRole): SiteMarkerHandle => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'ls-marker-btn';
      btn.setAttribute('aria-label', `${roleShortLabel(role)} site marker, click to inspect or drag to move`);

      const pill = document.createElement('span');
      pill.className = 'ls-marker-pill';
      pill.style.backgroundColor = roleColorHex(role);

      const stem = document.createElement('span');
      stem.className = 'ls-marker-stem';
      stem.setAttribute('aria-hidden', 'true');

      const anchor = document.createElement('span');
      anchor.className = 'ls-marker-anchor';
      anchor.style.backgroundColor = roleColorHex(role);
      anchor.setAttribute('aria-hidden', 'true');

      btn.append(pill, stem, anchor);

      const marker = new Marker({
        element: btn,
        anchor: 'bottom',
        draggable: true,
      }).setLngLat([0, 0]);

      const handle: SiteMarkerHandle = { marker, btn, pill, dragging: false };

      marker.on('dragstart', () => {
        handle.dragging = true;
        setCtxMenu(null);
      });

      marker.on('dragend', () => {
        const ll = marker.getLngLat();
        onMoveSiteRef.current(role, {
          lat: Number(ll.lat.toFixed(5)),
          lng: Number(ll.lng.toFixed(5)),
        });
        window.setTimeout(() => {
          handle.dragging = false;
        }, 60);
      });

      btn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        if (handle.dragging) return;
        setCtxMenu(null);
        const next = selectedSiteRef.current === role ? null : role;
        onSelectSiteRef.current(next);
      });

      btn.addEventListener('keydown', (e) => {
        const deltas: Record<string, [number, number]> = {
          ArrowLeft: [-2, 0],
          ArrowRight: [2, 0],
          ArrowUp: [0, -2],
          ArrowDown: [0, 2],
        };
        const delta = deltas[e.key];
        if (!delta) return;
        e.preventDefault();
        e.stopPropagation();
        const step = e.shiftKey ? 5 : 1;
        const pos = map.project(marker.getLngLat());
        const nextLl = map.unproject([pos.x + delta[0] * step, pos.y + delta[1] * step]);
        onMoveSiteRef.current(role, {
          lat: Number(nextLl.lat.toFixed(5)),
          lng: Number(nextLl.lng.toFixed(5)),
        });
      });

      return handle;
    };

    siteMarkersRef.current = {
      tx: createSiteMarker('tx'),
      repeater: createSiteMarker('repeater'),
      rx: createSiteMarker('rx'),
    };

    mapRef.current = map;

    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => {
        map.resize();
        updateQuickPopoverScreenPos();
      });
      ro.observe(el);
    }

    return () => {
      ro?.disconnect();
      Object.values(siteMarkersRef.current).forEach((h) => h?.marker.remove());
      siteMarkersRef.current = {};
      hazardMarkersRef.current.forEach((m) => m.remove());
      hazardMarkersRef.current = [];
      hoverMarkerRef.current?.remove();
      hoverMarkerRef.current = null;
      map.remove();
      mapRef.current = null;
    };
  }, [syncPathLayers, syncTerrainAndSky, updateQuickPopoverScreenPos]);

  // Basemap switch
  useEffect(() => {
    const map = mapRef.current;
    if (!map || appliedBasemapRef.current === basemap) return;
    appliedBasemapRef.current = basemap;
    styleReadyRef.current = false;
    map.setStyle(getMapStyle(basemap));
  }, [basemap]);

  // 3D Terrain / 2D Flat switch
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (styleReadyRef.current) {
      syncTerrainAndSky(map);
      map.easeTo({
        pitch: is3D ? 52 : 0,
        bearing: is3D ? -16 : 0,
        duration: 480,
      });
    }
  }, [is3D, syncTerrainAndSky]);

  // Sync RF GeoJSON layers, site markers, and hazard pins
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (styleReadyRef.current) {
      syncPathLayers(map);
    }

    const syncRoleMarker = (role: SiteRole, visible: boolean) => {
      const handle = siteMarkersRef.current[role];
      if (!handle) return;
      if (!visible) {
        handle.marker.remove();
        return;
      }
      const site = scenario[role];
      handle.pill.textContent = `${roleShortLabel(role)} · ${site.antennaHeightM}m`;
      handle.btn.dataset.selected = selectedSiteRole === role ? 'true' : 'false';
      handle.btn.title = `${roleShortLabel(role)}: ${site.name} (${site.antennaHeightM}m AGL) — Click to edit or drag`;
      handle.marker.setLngLat([site.coords.lng, site.coords.lat]);
      if (!handle.marker.getElement().isConnected) {
        handle.marker.addTo(map);
      }
    };

    syncRoleMarker('tx', true);
    syncRoleMarker('repeater', scenario.mode === 'relay');
    syncRoleMarker('rx', true);

    hazardMarkersRef.current.forEach((m) => m.remove());
    hazardMarkersRef.current = [];
    for (const hop of analysis.hops) {
      if (hop.worstPoint && hop.minClearanceRatio < 0.6) {
        const badge = document.createElement('div');
        badge.className = 'ls-hazard-badge';
        badge.textContent = '!';
        badge.title = `Worst Clearance (${hop.hopId.toUpperCase()}): ${(hop.minClearanceRatio * 100).toFixed(0)}% F1 @ ${hop.worstPoint.distanceKm.toFixed(1)} km`;
        const hm = new Marker({ element: badge, anchor: 'center' })
          .setLngLat([hop.worstPoint.lng, hop.worstPoint.lat])
          .addTo(map);
        hazardMarkersRef.current.push(hm);
      }
    }

    const fitKey = `${scenario.id}:${scenario.mode}`;
    if (lastScenarioKeyRef.current !== fitKey) {
      const animate = lastScenarioKeyRef.current !== '';
      lastScenarioKeyRef.current = fitKey;
      fitAllSites(animate);
    }

    updateQuickPopoverScreenPos();
  }, [
    scenario,
    analysis,
    selectedHopId,
    selectedSiteRole,
    syncPathLayers,
    fitAllSites,
    updateQuickPopoverScreenPos,
  ]);

  // Explicit fit trigger from toolbar or command palette
  useEffect(() => {
    if (fitTrigger > 0) {
      fitAllSites(true);
    }
  }, [fitTrigger, fitAllSites]);

  // Focus specific site from inspector card
  useEffect(() => {
    if (!focusSiteTrigger || !mapRef.current) return;
    const site = scenarioRef.current[focusSiteTrigger.role];
    mapRef.current.flyTo({
      center: [site.coords.lng, site.coords.lat],
      zoom: Math.max(mapRef.current.getZoom(), 12.6),
      pitch: is3DRef.current ? 56 : 0,
      duration: 550,
    });
  }, [focusSiteTrigger]);

  // Chart <-> Map synchronized hover reticle
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (!hoveredPoint) {
      if (hoverMarkerRef.current) {
        hoverMarkerRef.current.remove();
        hoverMarkerRef.current = null;
      }
      return;
    }

    if (!hoverMarkerRef.current) {
      const reticle = document.createElement('div');
      reticle.className = 'ls-hover-reticle';
      hoverMarkerRef.current = new Marker({
        element: reticle,
        anchor: 'center',
      })
        .setLngLat([hoveredPoint.lng, hoveredPoint.lat])
        .addTo(map);
    } else {
      hoverMarkerRef.current.setLngLat([hoveredPoint.lng, hoveredPoint.lat]);
    }
  }, [hoveredPoint]);

  // Close quick popover / context menu on Escape
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setCtxMenu(null);
        onSelectSiteRef.current(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const selectedSiteData = useMemo(() => {
    if (!selectedSiteRole) return null;
    if (selectedSiteRole === 'repeater' && scenario.mode !== 'relay') return null;
    const site = scenario[selectedSiteRole];
    const groundM =
      selectedSiteRole === 'tx'
        ? (analysis.hops[0]?.txSite.groundElevationM ?? site.groundElevationM)
        : selectedSiteRole === 'repeater'
          ? (analysis.hops[0]?.rxSite.groundElevationM ?? site.groundElevationM)
          : (analysis.hops[analysis.hops.length - 1]?.rxSite.groundElevationM ??
            site.groundElevationM);
    return { site, groundM };
  }, [selectedSiteRole, scenario, analysis]);

  const mapBottomInsetPx = useMemo(() => {
    if (zenMode || fresnelState === 'minimized') return 68;
    const svgH = fresnelState === 'expanded' ? 330 : fresnelHeightPx;
    return svgH + 114;
  }, [zenMode, fresnelState, fresnelHeightPx]);

  return (
    <div
      ref={wrapperRef}
      className="relative w-full h-[360px] sm:h-[420px] lg:h-full overflow-hidden"
      style={
        {
          '--map-bottom-inset': `${mapBottomInsetPx}px`,
        } as React.CSSProperties
      }
    >
      <div
        ref={containerRef}
        className="w-full h-full"
        aria-label="Interactive RF topology map (right-click to move sites)"
      />

      {/* Reposition MapLibre bottom-right attribution safely above Fresnel drawer */}
      <style>{`
        @media (min-width: 1024px) {
          .maplibregl-ctrl-bottom-right {
            bottom: var(--map-bottom-inset, 64px) !important;
            transition: bottom 200ms var(--ease-out);
          }
        }
      `}</style>

      {/* Basemap Selector Pill — sits cleanly below KpiRibbon on 1024-1279px and inline right at >=1280px */}
      {!zenMode && (
        <div className="absolute top-3 lg:top-[118px] xl:top-[68px] right-[58px] z-10 flex items-center gap-1.5 pointer-events-auto">
          <div
            role="group"
            aria-label="Map basemap"
            className="rf-hud-surface rounded-xl p-1 flex items-center gap-0.5"
          >
            {(Object.keys(BASEMAPS) as BasemapId[]).map((id) => (
              <button
                key={id}
                type="button"
                aria-pressed={basemap === id}
                onClick={() => onChangeBasemap(id)}
                className="rf-seg-btn text-[11px] px-2 py-1"
              >
                {BASEMAPS[id].label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Right Floating Map Camera & Terrain Rail (Felt-style vertical stack) */}
      <div
        role="group"
        aria-label="Map camera and terrain controls"
        className={`absolute ${zenMode ? 'top-3' : 'top-3 lg:top-[68px]'} right-3 z-10 flex flex-col gap-1.5 pointer-events-auto`}
      >
        <div className="rf-hud-surface rounded-xl p-1 flex flex-col items-center gap-1">
          <button
            type="button"
            onClick={onToggle3D}
            aria-pressed={is3D}
            className={`rf-seg-btn w-8 h-8 !p-0 font-mono-num text-[11px] font-bold`}
            title={is3D ? 'Switch to 2D flat map' : 'Enable 3D terrain relief'}
          >
            {is3D ? '3D' : '2D'}
          </button>

          <button
            type="button"
            onClick={() => fitAllSites(true)}
            className="rf-icon-btn !border-0 !bg-transparent !shadow-none"
            title="Fit all sites in view"
            aria-label="Fit path"
          >
            <Maximize2 className="w-3.5 h-3.5" aria-hidden="true" />
          </button>

          <span className="w-5 h-px" style={{ backgroundColor: 'var(--border-subtle)' }} />

          <button
            type="button"
            onClick={() => mapRef.current?.zoomIn({ duration: 220 })}
            className="rf-icon-btn !border-0 !bg-transparent !shadow-none"
            title="Zoom in"
            aria-label="Zoom in"
          >
            <Plus className="w-3.5 h-3.5" aria-hidden="true" />
          </button>

          <button
            type="button"
            onClick={() => mapRef.current?.zoomOut({ duration: 220 })}
            className="rf-icon-btn !border-0 !bg-transparent !shadow-none"
            title="Zoom out"
            aria-label="Zoom out"
          >
            <Minus className="w-3.5 h-3.5" aria-hidden="true" />
          </button>

          <button
            type="button"
            onClick={() =>
              mapRef.current?.easeTo({
                bearing: 0,
                pitch: is3D ? 45 : 0,
                duration: 360,
              })
            }
            className="rf-icon-btn !border-0 !bg-transparent !shadow-none"
            title="Reset map north & bearing"
            aria-label="Reset compass north"
          >
            <Compass
              className="w-3.5 h-3.5 transition-transform duration-150"
              style={{ transform: `rotate(${-bearingDeg}deg)` }}
              aria-hidden="true"
            />
          </button>
        </div>
      </div>

      {/* Hop Line Hover Tooltip */}
      {hoveredHopTooltip && (
        <div
          className="rf-hud-surface-strong rounded-lg px-2.5 py-1.5 text-[11px] font-mono-num pointer-events-none absolute z-30"
          style={{
            left: `${hoveredHopTooltip.x + 14}px`,
            top: `${Math.max(72, hoveredHopTooltip.y - 42)}px`,
          }}
        >
          <div className="font-semibold text-[11px]">{hoveredHopTooltip.label}</div>
          <div style={{ color: 'var(--text-secondary)' }}>
            {hoveredHopTooltip.distanceKm.toFixed(2)} km · Margin{' '}
            {hoveredHopTooltip.fadeMarginDb >= 0 ? '+' : ''}
            {hoveredHopTooltip.fadeMarginDb.toFixed(1)} dB · {hoveredHopTooltip.clearancePct}% F1
          </div>
        </div>
      )}

      {/* On-Map Marker Quick-Edit Popover */}
      {selectedSiteData && popoverScreenPos && (
        <div
          className="ls-quick-popover absolute z-30 w-[264px] p-3 text-xs space-y-2.5 pointer-events-auto"
          style={{
            left: `${popoverScreenPos.x}px`,
            top: `${popoverScreenPos.y}px`,
            transform: 'translate(-50%, -100%)',
          }}
          role="dialog"
          aria-label={`Quick edit ${selectedSiteData.site.name}`}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span
                className="px-1.5 py-0.5 rounded font-mono-num text-[10px] font-bold text-white shrink-0"
                style={{ backgroundColor: roleColorHex(selectedSiteData.site.role) }}
              >
                {roleShortLabel(selectedSiteData.site.role)}
              </span>
              <div className="min-w-0">
                <div className="font-semibold truncate">{selectedSiteData.site.name}</div>
                <div className="font-mono-num text-[10.5px]" style={{ color: 'var(--text-muted)' }}>
                  Ground {selectedSiteData.groundM.toFixed(0)}m ASL · Tip{' '}
                  {(selectedSiteData.groundM + selectedSiteData.site.antennaHeightM).toFixed(0)}m
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onSelectSite(null)}
              className="rf-icon-btn !min-inline-size-[24px] !min-block-size-[24px] !p-0.5 shrink-0"
              aria-label="Close quick site editor"
            >
              <X className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px]">
              <span style={{ color: 'var(--text-secondary)' }}>Tower Height (AGL)</span>
              <span className="font-mono-num font-bold text-xs">
                {selectedSiteData.site.antennaHeightM} m
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() =>
                  onUpdateSiteHeight(
                    selectedSiteData.site.role,
                    Math.max(1, selectedSiteData.site.antennaHeightM - 5),
                  )
                }
                className="rf-btn-subtle px-1.5 py-1 font-mono-num text-[10.5px]"
                aria-label="Decrease tower height by 5 meters"
              >
                -5m
              </button>
              <input
                type="range"
                min={1}
                max={200}
                step={1}
                aria-label="Quick tower height slider"
                value={Math.min(200, selectedSiteData.site.antennaHeightM)}
                onChange={(e) =>
                  onUpdateSiteHeight(selectedSiteData.site.role, Number(e.target.value))
                }
                className="flex-1 cursor-pointer"
              />
              <button
                type="button"
                onClick={() =>
                  onUpdateSiteHeight(
                    selectedSiteData.site.role,
                    Math.min(400, selectedSiteData.site.antennaHeightM + 5),
                  )
                }
                className="rf-btn-subtle px-1.5 py-1 font-mono-num text-[10.5px]"
                aria-label="Increase tower height by 5 meters"
              >
                +5m
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onEditInInspector(selectedSiteData.site.role)}
            className="rf-btn-subtle w-full py-1.5 text-[11px]"
          >
            <SlidersHorizontal className="w-3 h-3" aria-hidden="true" />
            <span>Edit Full Site Specs in Inspector</span>
          </button>
        </div>
      )}

      {/* Right-Click Context Menu */}
      {ctxMenu && (
        <div
          className="ls-ctx-menu absolute z-30 w-[196px] p-2 space-y-1.5 text-xs pointer-events-auto"
          style={{ left: `${ctxMenu.x}px`, top: `${ctxMenu.y}px` }}
          role="menu"
          aria-label="Map location actions"
        >
          <div
            className="font-mono-num text-[10.5px] px-1.5 py-0.5 truncate"
            style={{ color: 'var(--text-muted)' }}
          >
            {ctxMenu.lat.toFixed(5)}, {ctxMenu.lng.toFixed(5)}
          </div>

          <div className="flex flex-col gap-1">
            {(
              [
                { role: 'tx', label: 'Set TX here', color: 'var(--role-tx)' },
                ...(scenario.mode === 'relay'
                  ? [{ role: 'repeater' as const, label: 'Set Repeater here', color: 'var(--role-rpt)' }]
                  : []),
                { role: 'rx', label: 'Set RX here', color: 'var(--role-rx)' },
              ] as Array<{ role: SiteRole; label: string; color: string }>
            ).map((item) => (
              <button
                key={item.role}
                type="button"
                onClick={() => {
                  onMoveSite(item.role, { lat: ctxMenu.lat, lng: ctxMenu.lng });
                  setCtxMenu(null);
                }}
                className="rf-btn-subtle w-full !justify-start px-2 py-1.5 text-[11.5px]"
              >
                <span
                  className="inline-block w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: item.color }}
                  aria-hidden="true"
                />
                <span>{item.label}</span>
              </button>
            ))}

            <button
              type="button"
              onClick={() => {
                const text = `${ctxMenu.lat.toFixed(5)}, ${ctxMenu.lng.toFixed(5)}`;
                void navigator.clipboard?.writeText(text);
                onNotify?.(`Copied coordinates: ${text}`);
                setCtxMenu(null);
              }}
              className="rf-btn-ghost w-full !justify-start px-2 py-1 text-[11px]"
            >
              <Copy className="w-3 h-3 shrink-0" aria-hidden="true" />
              <span>Copy coordinates</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
