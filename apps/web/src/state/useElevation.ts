import { useEffect, useMemo, useState } from 'react';
import {
  generateSyntheticElevationM,
  sampleGreatCirclePath,
  type Coordinates,
  type ElevationProfileResponse,
  type ElevationSource,
  type LinkScenario,
  type ScenarioElevationsInput,
} from '@linksight/rf-engine';

export interface ElevationState {
  elevations: ScenarioElevationsInput;
  source: ElevationSource;
  degraded: boolean;
  loading: boolean;
  cacheHitRatio: number;
}

function buildSyntheticForPath(
  a: Coordinates,
  b: Coordinates,
  count: number,
): number[] {
  return sampleGreatCirclePath(a, b, count).map((pt) =>
    generateSyntheticElevationM(pt.lat, pt.lng),
  );
}

async function fetchProfilePoints(
  points: Array<{ lat: number; lng: number }>,
  signal: AbortSignal,
): Promise<ElevationProfileResponse> {
  const res = await fetch('/api/elevation/profile', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ points }),
    signal,
  });

  if (!res.ok) {
    throw new Error(`Elevation API HTTP ${res.status}`);
  }

  return (await res.json()) as ElevationProfileResponse;
}

export function useElevation(scenario: LinkScenario): ElevationState {
  const { mode, tx, repeater, rx, propagation } = scenario;
  const count = propagation.sampleCount;

  const syntheticBaseline = useMemo<ScenarioElevationsInput>(() => {
    if (mode === 'ptp') {
      return {
        direct: buildSyntheticForPath(tx.coords, rx.coords, count),
      };
    }
    return {
      hop1: buildSyntheticForPath(tx.coords, repeater.coords, count),
      hop2: buildSyntheticForPath(repeater.coords, rx.coords, count),
      direct: buildSyntheticForPath(tx.coords, rx.coords, count),
    };
  }, [
    mode,
    tx.coords.lat,
    tx.coords.lng,
    repeater.coords.lat,
    repeater.coords.lng,
    rx.coords.lat,
    rx.coords.lng,
    count,
  ]);

  const [state, setState] = useState<ElevationState>({
    elevations: syntheticBaseline,
    source: 'synthetic-fallback',
    degraded: false,
    loading: true,
    cacheHitRatio: 0,
  });

  useEffect(() => {
    const controller = new AbortController();
    setState((prev) => ({ ...prev, loading: true }));

    const timer = window.setTimeout(async () => {
      try {
        if (mode === 'ptp') {
          const pts = sampleGreatCirclePath(tx.coords, rx.coords, count).map(
            (p) => ({ lat: p.lat, lng: p.lng }),
          );
          const resp = await fetchProfilePoints(pts, controller.signal);
          if (controller.signal.aborted) return;

          setState({
            elevations: { direct: resp.elevations },
            source: resp.source,
            degraded: resp.degraded,
            loading: false,
            cacheHitRatio: resp.cacheHitRatio,
          });
          return;
        }

        const hop1Pts = sampleGreatCirclePath(
          tx.coords,
          repeater.coords,
          count,
        ).map((p) => ({ lat: p.lat, lng: p.lng }));
        const hop2Pts = sampleGreatCirclePath(
          repeater.coords,
          rx.coords,
          count,
        ).map((p) => ({ lat: p.lat, lng: p.lng }));
        const directPts = sampleGreatCirclePath(tx.coords, rx.coords, count).map(
          (p) => ({ lat: p.lat, lng: p.lng }),
        );

        const [relayResp, directResp] = await Promise.all([
          fetchProfilePoints([...hop1Pts, ...hop2Pts], controller.signal),
          fetchProfilePoints(directPts, controller.signal),
        ]);

        if (controller.signal.aborted) return;

        const hop1Elev = relayResp.elevations.slice(0, hop1Pts.length);
        const hop2Elev = relayResp.elevations.slice(hop1Pts.length);

        setState({
          elevations: {
            hop1: hop1Elev,
            hop2: hop2Elev,
            direct: directResp.elevations,
          },
          source:
            relayResp.degraded || directResp.degraded
              ? 'synthetic-fallback'
              : relayResp.source,
          degraded: relayResp.degraded || directResp.degraded,
          loading: false,
          cacheHitRatio: Number(
            ((relayResp.cacheHitRatio + directResp.cacheHitRatio) / 2).toFixed(2),
          ),
        });
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          return;
        }
        setState({
          elevations: syntheticBaseline,
          source: 'synthetic-fallback',
          degraded: true,
          loading: false,
          cacheHitRatio: 0,
        });
      }
    }, 250);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [
    mode,
    tx.coords.lat,
    tx.coords.lng,
    repeater.coords.lat,
    repeater.coords.lng,
    rx.coords.lat,
    rx.coords.lng,
    count,
    syntheticBaseline,
  ]);

  return state;
}
