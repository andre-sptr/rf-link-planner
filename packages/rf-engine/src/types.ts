export interface Coordinates {
  lat: number;
  lng: number;
}

export type SiteRole = 'tx' | 'repeater' | 'rx';

export type CableTypeId =
  | 'INTEGRATED'
  | 'LDF5-50A'
  | 'LDF4-50A'
  | 'LMR-400'
  | 'LMR-240'
  | 'RG-213'
  | 'RG-58';

export type PropagationModelId = 'fspl-diffraction' | 'okumura-hata';

export type HataEnvironment = 'urban' | 'suburban' | 'rural';

export type LinkMode = 'ptp' | 'relay';

export type LinkVerdict = 'pass' | 'marginal' | 'fail' | 'invalid';

export type ElevationSource =
  | 'srtm30m'
  | 'open-meteo-90m'
  | 'mixed-cache'
  | 'synthetic-fallback';

export interface SiteNode {
  id: string;
  name: string;
  role: SiteRole;
  coords: Coordinates;
  groundElevationM: number;
  antennaHeightM: number;
  antennaGainDbi: number;
  cableType: CableTypeId;
  cableLengthM: number;
  connectorLossDb: number;
  duplexerLossDb: number;
  txPowerDbm: number;
  rxSensitivityDbm: number;
}

export interface PropagationSettings {
  frequencyMhz: number;
  model: PropagationModelId;
  hataEnvironment: HataEnvironment;
  kFactor: number;
  clutterHeightM: number;
  rainMarginDb: number;
  targetFadeMarginDb: number;
  sampleCount: number;
}

export interface LinkScenario {
  id: string;
  name: string;
  description: string;
  mode: LinkMode;
  tx: SiteNode;
  repeater: SiteNode;
  rx: SiteNode;
  propagation: PropagationSettings;
}

export interface PathSamplePoint {
  index: number;
  lat: number;
  lng: number;
  distanceKm: number;
  fraction: number;
}

export interface FresnelPoint {
  index: number;
  lat: number;
  lng: number;
  distanceKm: number;
  fraction: number;
  groundElevationM: number;
  clutterHeightM: number;
  earthBulgeM: number;
  effectiveTerrainM: number;
  losHeightM: number;
  fresnel1RadiusM: number;
  fresnel60RadiusM: number;
  fresnel1UpperM: number;
  fresnel1LowerM: number;
  fresnel60LowerM: number;
  clearanceM: number;
  clearanceRatio: number;
  nu: number;
}

export interface TowerHeightRecommendation {
  needed: boolean;
  extraTxOnlyM: number;
  extraRxOnlyM: number;
  extraBalancedM: number;
  worstDistanceKm: number;
}

export interface BudgetLineItem {
  id: string;
  label: string;
  valueDb: number;
  unit: 'dBm' | 'dB';
  category: 'tx' | 'path' | 'rx' | 'summary';
  note?: string;
}

export interface HopAnalysis {
  hopId: 'direct' | 'hop1' | 'hop2';
  label: string;
  txSite: SiteNode;
  rxSite: SiteNode;
  distanceKm: number;
  forwardAzimuthDeg: number;
  reverseAzimuthDeg: number;
  eirpDbm: number;
  txCableLossDb: number;
  rxCableLossDb: number;
  fsplDb: number;
  diffractionLossDb: number;
  modelPathLossDb: number;
  totalPathLossDb: number;
  rslDbm: number;
  fadeMarginDb: number;
  maxFresnel1RadiusM: number;
  minClearanceM: number;
  minClearanceRatio: number;
  worstPoint: FresnelPoint | null;
  worstNu: number;
  points: FresnelPoint[];
  heightAdvisor: TowerHeightRecommendation;
  budgetItems: BudgetLineItem[];
  warnings: string[];
  verdict: LinkVerdict;
}

export interface RelayComparison {
  directFadeMarginDb: number;
  relayBottleneckFadeMarginDb: number;
  fadeMarginGainDb: number;
  directMinClearanceRatio: number;
  relayBottleneckClearanceRatio: number;
  clearanceGainPercent: number;
  directVerdict: LinkVerdict;
  relayVerdict: LinkVerdict;
}

export interface LinkAnalysisResult {
  mode: LinkMode;
  overallVerdict: LinkVerdict;
  bottleneckFadeMarginDb: number;
  bottleneckClearanceRatio: number;
  totalDistanceKm: number;
  hops: HopAnalysis[];
  directReference?: HopAnalysis;
  relayComparison?: RelayComparison;
}

export interface ElevationProfileResponse {
  elevations: number[];
  source: ElevationSource;
  cacheHitRatio: number;
  degraded: boolean;
}
