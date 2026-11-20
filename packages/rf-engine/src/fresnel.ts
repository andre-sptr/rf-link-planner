import { EARTH_RADIUS_KM } from './geodesy.js';
import type {
  FresnelPoint,
  PathSamplePoint,
  TowerHeightRecommendation,
} from './types.js';

export const SPEED_OF_LIGHT_MHZ_M = 299.792458;

function roundUpHalfMeter(value: number): number {
  if (value <= 0) return 0;
  return Math.ceil(value * 2) / 2;
}

/**
 * Earth curvature bulge (meters) at distances d1Km and d2Km with effective radius factor k.
 */
export function calculateEarthBulgeM(
  d1Km: number,
  d2Km: number,
  kFactor: number,
): number {
  if (
    !Number.isFinite(d1Km) ||
    !Number.isFinite(d2Km) ||
    !Number.isFinite(kFactor) ||
    d1Km <= 0 ||
    d2Km <= 0 ||
    kFactor <= 0
  ) {
    return 0;
  }

  const d1M = d1Km * 1000;
  const d2M = d2Km * 1000;
  const earthRadiusM = EARTH_RADIUS_KM * 1000;
  return (d1M * d2M) / (2 * kFactor * earthRadiusM);
}

/**
 * n-th Fresnel zone radius (meters) at distances d1Km and d2Km for frequencyMhz.
 */
export function calculateFresnelRadiusM(
  d1Km: number,
  d2Km: number,
  frequencyMhz: number,
  zone = 1,
): number {
  if (
    !Number.isFinite(d1Km) ||
    !Number.isFinite(d2Km) ||
    !Number.isFinite(frequencyMhz) ||
    d1Km <= 0 ||
    d2Km <= 0 ||
    frequencyMhz <= 0 ||
    zone <= 0
  ) {
    return 0;
  }

  const wavelengthM = SPEED_OF_LIGHT_MHZ_M / frequencyMhz;
  const d1M = d1Km * 1000;
  const d2M = d2Km * 1000;
  return Math.sqrt((zone * wavelengthM * d1M * d2M) / (d1M + d2M));
}

/**
 * ITU-R P.526-15 single knife-edge diffraction attenuation (dB) for Fresnel-Kirchhoff parameter nu.
 * Positive nu indicates terrain rises above the direct LOS ray.
 */
export function calculateKnifeEdgeLossDb(nu: number): number {
  if (!Number.isFinite(nu) || nu <= -0.78) {
    return 0;
  }

  const term = Math.sqrt((nu - 0.1) * (nu - 0.1) + 1) + nu - 0.1;
  if (term <= 0) {
    return 0;
  }
  return Math.max(0, 6.9 + 20 * Math.log10(term));
}

export interface FresnelProfileAnalysis {
  points: FresnelPoint[];
  maxFresnel1RadiusM: number;
  minClearanceM: number;
  minClearanceRatio: number;
  worstPoint: FresnelPoint | null;
  worstNu: number;
  diffractionLossDb: number;
  heightAdvisor: TowerHeightRecommendation;
}

/**
 * Evaluates terrain elevation, Earth bulge, clutter, LOS ray, 1st/60% Fresnel clearance,
 * single knife-edge diffraction loss, and closed-form tower height optimization.
 */
export function analyzeFresnelProfile(
  pathPoints: PathSamplePoint[],
  elevationsM: number[],
  txHeightAglM: number,
  rxHeightAglM: number,
  frequencyMhz: number,
  kFactor: number,
  clutterHeightM: number,
): FresnelProfileAnalysis {
  const n = pathPoints.length;
  if (n < 2) {
    return {
      points: [],
      maxFresnel1RadiusM: 0,
      minClearanceM: 0,
      minClearanceRatio: 0,
      worstPoint: null,
      worstNu: -2,
      diffractionLossDb: 0,
      heightAdvisor: {
        needed: false,
        extraTxOnlyM: 0,
        extraRxOnlyM: 0,
        extraBalancedM: 0,
        worstDistanceKm: 0,
      },
    };
  }

  const totalDistanceKm = pathPoints[n - 1]?.distanceKm ?? 0;
  const txGround = elevationsM[0] ?? 0;
  const rxGround = elevationsM[n - 1] ?? 0;
  const txTipM = txGround + Math.max(0, txHeightAglM);
  const rxTipM = rxGround + Math.max(0, rxHeightAglM);
  const safeClutter = Math.max(0, clutterHeightM);

  const points: FresnelPoint[] = [];
  let maxFresnel1RadiusM = 0;

  for (let i = 0; i < n; i++) {
    const sample = pathPoints[i]!;
    const groundElevationM = elevationsM[i] ?? 0;
    const isInterior = i > 0 && i < n - 1;
    const clutter = isInterior ? safeClutter : 0;

    const d1Km = sample.distanceKm;
    const d2Km = Math.max(0, totalDistanceKm - d1Km);
    const earthBulgeM = calculateEarthBulgeM(d1Km, d2Km, kFactor);
    const effectiveTerrainM = groundElevationM + clutter + earthBulgeM;

    const t = sample.fraction;
    const losHeightM = txTipM * (1 - t) + rxTipM * t;

    const fresnel1RadiusM = calculateFresnelRadiusM(d1Km, d2Km, frequencyMhz, 1);
    const fresnel60RadiusM = 0.6 * fresnel1RadiusM;
    if (fresnel1RadiusM > maxFresnel1RadiusM) {
      maxFresnel1RadiusM = fresnel1RadiusM;
    }

    const clearanceM = losHeightM - effectiveTerrainM;
    const clearanceRatio =
      fresnel1RadiusM > 0
        ? clearanceM / fresnel1RadiusM
        : clearanceM >= 0
          ? 1
          : -1;
    const nu =
      fresnel1RadiusM > 0
        ? (-clearanceM * Math.SQRT2) / fresnel1RadiusM
        : clearanceM < 0
          ? 5
          : -2;

    points.push({
      index: i,
      lat: sample.lat,
      lng: sample.lng,
      distanceKm: d1Km,
      fraction: t,
      groundElevationM,
      clutterHeightM: clutter,
      earthBulgeM,
      effectiveTerrainM,
      losHeightM,
      fresnel1RadiusM,
      fresnel60RadiusM,
      fresnel1UpperM: losHeightM + fresnel1RadiusM,
      fresnel1LowerM: losHeightM - fresnel1RadiusM,
      fresnel60LowerM: losHeightM - fresnel60RadiusM,
      clearanceM,
      clearanceRatio,
      nu,
    });
  }

  let worstPoint: FresnelPoint | null = null;
  let minClearanceRatio = Number.POSITIVE_INFINITY;
  let minClearanceM = Number.POSITIVE_INFINITY;
  let worstNu = Number.NEGATIVE_INFINITY;

  let maxDeficitBalanced = 0;
  let maxDeficitTxOnly = 0;
  let maxDeficitRxOnly = 0;
  let txOnlyFeasible = true;
  let rxOnlyFeasible = true;

  for (let i = 1; i < n - 1; i++) {
    const pt = points[i]!;
    if (pt.nu > worstNu) {
      worstNu = pt.nu;
      worstPoint = pt;
    }
    if (pt.clearanceRatio < minClearanceRatio) {
      minClearanceRatio = pt.clearanceRatio;
    }
    if (pt.clearanceM < minClearanceM) {
      minClearanceM = pt.clearanceM;
    }

    const deficit = 0.6 * pt.fresnel1RadiusM - pt.clearanceM;
    if (deficit > 0) {
      if (deficit > maxDeficitBalanced) {
        maxDeficitBalanced = deficit;
      }
      if (1 - pt.fraction > 0.05) {
        maxDeficitTxOnly = Math.max(maxDeficitTxOnly, deficit / (1 - pt.fraction));
      } else {
        txOnlyFeasible = false;
      }
      if (pt.fraction > 0.05) {
        maxDeficitRxOnly = Math.max(maxDeficitRxOnly, deficit / pt.fraction);
      } else {
        rxOnlyFeasible = false;
      }
    }
  }

  if (n === 2) {
    minClearanceRatio = 1;
    minClearanceM = Math.min(txHeightAglM, rxHeightAglM);
    worstNu = -2;
  }

  const diffractionLossDb = calculateKnifeEdgeLossDb(worstNu);
  const extraBalancedM = roundUpHalfMeter(maxDeficitBalanced);

  const extraTxOnlyM =
    extraBalancedM === 0
      ? 0
      : txOnlyFeasible && maxDeficitTxOnly <= 500
        ? roundUpHalfMeter(maxDeficitTxOnly)
        : null;
  const extraRxOnlyM =
    extraBalancedM === 0
      ? 0
      : rxOnlyFeasible && maxDeficitRxOnly <= 500
        ? roundUpHalfMeter(maxDeficitRxOnly)
        : null;

  return {
    points,
    maxFresnel1RadiusM,
    minClearanceM: Number.isFinite(minClearanceM) ? minClearanceM : 0,
    minClearanceRatio: Number.isFinite(minClearanceRatio) ? minClearanceRatio : 1,
    worstPoint,
    worstNu: Number.isFinite(worstNu) ? worstNu : -2,
    diffractionLossDb,
    heightAdvisor: {
      needed: extraBalancedM > 0,
      extraTxOnlyM,
      extraRxOnlyM,
      extraBalancedM,
      worstDistanceKm: worstPoint?.distanceKm ?? 0,
    },
  };
}
