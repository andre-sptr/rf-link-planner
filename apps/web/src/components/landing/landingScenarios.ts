import {
  DEMO_SCENARIOS,
  analyzeScenario,
  calculateBearingDeg,
  calculateDistanceKm,
  cloneScenario,
  type LinkAnalysisResult,
  type LinkMode,
  type LinkScenario,
  type ScenarioElevationsInput,
} from '@linksight/rf-engine';

export interface EvaluatedLandingScenario {
  scenario: LinkScenario;
  elevations: ScenarioElevationsInput;
  analysis: LinkAnalysisResult;
  bearingDeg: number;
  distanceKm: number;
  bandBadge: string;
  scaleLabel: string;
  shortTitle: string;
  corridorTag: string;
}

function buildCurve(count: number, fn: (f: number) => number): number[] {
  const out: number[] = [];
  for (let i = 0; i < count; i += 1) {
    const f = count <= 1 ? 0 : i / (count - 1);
    out.push(Math.round(fn(f) * 10) / 10);
  }
  return out;
}

function gaussian(f: number, center: number, width: number): number {
  const d = (f - center) / width;
  return Math.exp(-d * d);
}

/**
 * Deterministic physically realistic terrain elevation curves (meters ASL)
 * aligned with the ground elevations of the four curated Indonesian presets
 * so landing-page previews compute live physics with @linksight/rf-engine
 * without blocking initial paint on external elevation API calls.
 */
function getTerrainProfiles(scenario: LinkScenario): ScenarioElevationsInput {
  const n = scenario.propagation.sampleCount;

  switch (scenario.id) {
    case 'bandung-lembang-relay': {
      // Direct path crosses the 2,060m northern Bandung volcanic mountain wall
      const direct = buildCurve(n, (f) => {
        const base = 685 + (120 - 685) * f;
        const ridgeWall = 1660 * gaussian(f, 0.37, 0.14);
        const shoulder = 420 * gaussian(f, 0.56, 0.16);
        const undulation = Math.sin(f * Math.PI * 5) * 35;
        return Math.max(115, base + ridgeWall + shoulder + undulation);
      });
      // Hop 1: Bandung South basin climbing smoothly to Bukit Tunggul summit
      const hop1 = buildCurve(n, (f) => {
        const climb = 685 + (2150 - 685) * Math.pow(f, 1.45);
        const foothills = 110 * gaussian(f, 0.55, 0.18);
        return Math.max(680, climb - foothills * 0.35 + Math.sin(f * Math.PI * 4) * 18);
      });
      // Hop 2: Bukit Tunggul summit descending cleanly toward Subang Valley
      const hop2 = buildCurve(n, (f) => {
        const descent = 2150 + (120 - 2150) * Math.pow(f, 0.72);
        const dip = 190 * gaussian(f, 0.38, 0.22);
        return Math.max(115, descent - dip + Math.sin(f * Math.PI * 5) * 16);
      });
      return { direct, hop1, hop2 };
    }

    case 'pekanbaru-rumbai-uhf': {
      // Siak River basin with low central floodplain and modest northern rise
      const direct = buildCurve(n, (f) => {
        const trend = 17 + (36 - 17) * f;
        const riverDip = -14 * gaussian(f, 0.45, 0.14);
        const crest = 22 * gaussian(f, 0.78, 0.14);
        return Math.max(4, trend + riverDip + crest + Math.sin(f * Math.PI * 3) * 3);
      });
      const hop1 = buildCurve(n, (f) => 17 + (12 - 17) * f - 6 * gaussian(f, 0.52, 0.2));
      const hop2 = buildCurve(n, (f) => 12 + (36 - 12) * f + 14 * gaussian(f, 0.65, 0.2));
      return { direct, hop1, hop2 };
    }

    case 'sumatra-vhf-telemetry': {
      // 32 km rolling Sumatra ridge corridor where wide 152 MHz Fresnel radii graze mid-path rises
      const direct = buildCurve(n, (f) => {
        const trend = 17 + (48 - 17) * f;
        const ridge = 44 * gaussian(f, 0.48, 0.18) + 28 * gaussian(f, 0.73, 0.15);
        const ripple = Math.sin(f * Math.PI * 6) * 5;
        return Math.max(12, trend + ridge + ripple);
      });
      const hop1 = buildCurve(n, (f) => 17 + (35 - 17) * f + 24 * gaussian(f, 0.55, 0.22));
      const hop2 = buildCurve(n, (f) => 35 + (48 - 35) * f + 22 * gaussian(f, 0.5, 0.22));
      return { direct, hop1, hop2 };
    }

    case 'jakarta-depok-58ghz':
    default: {
      // Gentle urban climb from Kuningan (22m) south toward Depok (76m)
      const direct = buildCurve(n, (f) => {
        const trend = 22 + (76 - 22) * f;
        const urbanSwell = 16 * gaussian(f, 0.44, 0.2) + 12 * gaussian(f, 0.74, 0.16);
        return Math.max(18, trend + urbanSwell + Math.sin(f * Math.PI * 4) * 2.5);
      });
      const hop1 = buildCurve(n, (f) => 22 + (42 - 22) * f + 8 * gaussian(f, 0.5, 0.22));
      const hop2 = buildCurve(n, (f) => 42 + (76 - 42) * f + 10 * gaussian(f, 0.55, 0.22));
      return { direct, hop1, hop2 };
    }
  }
}

const SCENARIO_META: Record<
  string,
  { bandBadge: string; scaleLabel: string; shortTitle: string; corridorTag: string }
> = {
  'bandung-lembang-relay': {
    bandBadge: 'UHF 452.5 MHz · Relay',
    scaleLabel: '15 km',
    shortTitle: 'Bandung – Bukit Tunggul',
    corridorTag: 'UHF 452.5 MHz · Mountain Relay',
  },
  'pekanbaru-rumbai-uhf': {
    bandBadge: 'UHF 452.5 MHz · PtP',
    scaleLabel: '3 km',
    shortTitle: 'Pekanbaru – Rumbai',
    corridorTag: 'UHF 452.5 MHz · River Basin',
  },
  'sumatra-vhf-telemetry': {
    bandBadge: 'VHF 152.5 MHz · Long-Haul',
    scaleLabel: '10 km',
    shortTitle: 'Sumatra VHF Telemetry',
    corridorTag: 'VHF 152.5 MHz · 32 km SCADA',
  },
  'jakarta-depok-58ghz': {
    bandBadge: '5.8 GHz · Microwave',
    scaleLabel: '5 km',
    shortTitle: 'Jakarta – Depok 5.8 GHz',
    corridorTag: '5.8 GHz · Urban Microwave',
  },
};

export function evaluateLandingScenario(
  scenarioId: string,
  overrides?: { mode?: LinkMode; antennaHeightM?: number },
): EvaluatedLandingScenario {
  const base =
    DEMO_SCENARIOS.find((item) => item.id === scenarioId) ?? DEMO_SCENARIOS[0]!;
  const scenario = cloneScenario(base);

  if (overrides?.mode) {
    scenario.mode = overrides.mode;
  }
  if (typeof overrides?.antennaHeightM === 'number') {
    scenario.tx.antennaHeightM = overrides.antennaHeightM;
    scenario.rx.antennaHeightM = overrides.antennaHeightM;
    if (scenario.mode === 'relay') {
      scenario.repeater.antennaHeightM = overrides.antennaHeightM;
    }
  }

  const elevations = getTerrainProfiles(scenario);
  const analysis = analyzeScenario(scenario, elevations);
  const bearingDeg = calculateBearingDeg(scenario.tx.coords, scenario.rx.coords);
  const distanceKm = calculateDistanceKm(scenario.tx.coords, scenario.rx.coords);
  const meta = SCENARIO_META[scenario.id] ?? {
    bandBadge: `${scenario.propagation.frequencyMhz} MHz`,
    scaleLabel: '10 km',
    shortTitle: scenario.name,
    corridorTag: 'RF Link Corridor',
  };

  return {
    scenario,
    elevations,
    analysis,
    bearingDeg,
    distanceKm,
    ...meta,
  };
}

export function formatLatDms(lat: number): string {
  const abs = Math.abs(lat);
  const deg = Math.floor(abs);
  const min = (abs - deg) * 60;
  const hemi = lat >= 0 ? 'N' : 'S';
  return `${String(deg).padStart(2, '0')}°${min.toFixed(2).padStart(5, '0')}′ ${hemi}`;
}

export function formatLonDms(lng: number): string {
  const abs = Math.abs(lng);
  const deg = Math.floor(abs);
  const min = (abs - deg) * 60;
  const hemi = lng >= 0 ? 'E' : 'W';
  return `${String(deg).padStart(3, '0')}°${min.toFixed(2).padStart(5, '0')}′ ${hemi}`;
}

export function formatBearing(deg: number): string {
  return `${deg.toFixed(1).padStart(5, '0')}°`;
}

export function verdictLabel(verdict: string): string {
  switch (verdict) {
    case 'pass':
      return 'CLEAR';
    case 'marginal':
      return 'MARGINAL';
    case 'fail':
      return 'OBSTRUCTED';
    default:
      return 'INVALID';
  }
}
