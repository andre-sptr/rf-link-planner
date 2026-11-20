import { analyzeFresnelProfile } from './fresnel.js';
import {
  calculateBearingDeg,
  calculateDistanceKm,
  sampleGreatCirclePath,
} from './geodesy.js';
import {
  calculateCableLossDb,
  calculateFsplDb,
  calculateOkumuraHataLossDb,
} from './propagation.js';
import type {
  BudgetLineItem,
  HopAnalysis,
  LinkAnalysisResult,
  LinkScenario,
  LinkVerdict,
  PropagationSettings,
  RelayComparison,
  SiteNode,
} from './types.js';

export interface ScenarioElevationsInput {
  direct?: number[];
  hop1?: number[];
  hop2?: number[];
}

function worstVerdict(a: LinkVerdict, b: LinkVerdict): LinkVerdict {
  const rank: Record<LinkVerdict, number> = {
    invalid: 3,
    fail: 2,
    marginal: 1,
    pass: 0,
  };
  return rank[a] >= rank[b] ? a : b;
}

function evaluateHopVerdict(
  model: PropagationSettings['model'],
  fadeMarginDb: number,
  targetFadeMarginDb: number,
  minClearanceRatio: number,
): LinkVerdict {
  if (fadeMarginDb < 0) return 'fail';

  if (model === 'fspl-diffraction') {
    if (minClearanceRatio < 0) return 'fail';
    if (minClearanceRatio >= 0.6 && fadeMarginDb >= targetFadeMarginDb) {
      return 'pass';
    }
    return 'marginal';
  }

  return fadeMarginDb >= targetFadeMarginDb ? 'pass' : 'marginal';
}

export function analyzeHop(
  hopId: 'direct' | 'hop1' | 'hop2',
  label: string,
  txSite: SiteNode,
  rxSite: SiteNode,
  elevationsM: number[],
  propagation: PropagationSettings,
): HopAnalysis {
  const distanceKm = calculateDistanceKm(txSite.coords, rxSite.coords);
  const forwardAzimuthDeg = calculateBearingDeg(txSite.coords, rxSite.coords);
  const reverseAzimuthDeg = calculateBearingDeg(rxSite.coords, txSite.coords);

  const txCableLossDb = calculateCableLossDb(
    txSite.cableType,
    txSite.cableLengthM,
    propagation.frequencyMhz,
  );
  const rxCableLossDb = calculateCableLossDb(
    rxSite.cableType,
    rxSite.cableLengthM,
    propagation.frequencyMhz,
  );

  const txTotalLineLoss =
    txCableLossDb + txSite.connectorLossDb + txSite.duplexerLossDb;
  const rxTotalLineLoss =
    rxCableLossDb + rxSite.connectorLossDb + rxSite.duplexerLossDb;

  const eirpDbm = txSite.txPowerDbm - txTotalLineLoss + txSite.antennaGainDbi;

  if (distanceKm <= 0.001) {
    return {
      hopId,
      label,
      txSite,
      rxSite,
      distanceKm: 0,
      forwardAzimuthDeg: 0,
      reverseAzimuthDeg: 0,
      eirpDbm,
      txCableLossDb,
      rxCableLossDb,
      fsplDb: 0,
      diffractionLossDb: 0,
      modelPathLossDb: 0,
      totalPathLossDb: 0,
      rslDbm: 0,
      fadeMarginDb: 0,
      maxFresnel1RadiusM: 0,
      minClearanceM: 0,
      minClearanceRatio: 0,
      worstPoint: null,
      worstNu: 0,
      points: [],
      heightAdvisor: {
        needed: false,
        extraTxOnlyM: 0,
        extraRxOnlyM: 0,
        extraBalancedM: 0,
        worstDistanceKm: 0,
      },
      budgetItems: [],
      warnings: ['TX and RX coordinates are identical or closer than 1 meter.'],
      verdict: 'invalid',
    };
  }

  const sampleCount = Math.max(2, elevationsM.length || propagation.sampleCount);
  const pathPoints = sampleGreatCirclePath(txSite.coords, rxSite.coords, sampleCount);
  const resolvedElevations =
    elevationsM.length === pathPoints.length
      ? elevationsM
      : pathPoints.map((_, idx) => elevationsM[idx] ?? 0);

  const fresnel = analyzeFresnelProfile(
    pathPoints,
    resolvedElevations,
    txSite.antennaHeightM,
    rxSite.antennaHeightM,
    propagation.frequencyMhz,
    propagation.kFactor,
    propagation.clutterHeightM,
  );

  const fsplDb = calculateFsplDb(distanceKm, propagation.frequencyMhz);
  const warnings: string[] = [];

  let modelPathLossDb = fsplDb + fresnel.diffractionLossDb;
  let modelLabel = 'FSPL + ITU-R P.526 Diffraction';

  if (propagation.model === 'okumura-hata') {
    const hata = calculateOkumuraHataLossDb({
      distanceKm,
      frequencyMhz: propagation.frequencyMhz,
      txHeightM: txSite.antennaHeightM,
      rxHeightM: rxSite.antennaHeightM,
      environment: propagation.hataEnvironment,
    });
    modelPathLossDb = hata.lossDb;
    modelLabel =
      hata.variant === 'cost-231-hata' ? 'COST-231 Hata' : 'Okumura-Hata';
    warnings.push(...hata.warnings);
  } else if (fresnel.minClearanceRatio < 0.6) {
    warnings.push(
      `1st Fresnel clearance drops to ${(fresnel.minClearanceRatio * 100).toFixed(0)}% at ${fresnel.heightAdvisor.worstDistanceKm.toFixed(1)} km (target >= 60%).`,
    );
  }

  const rainMarginDb = Math.max(0, propagation.rainMarginDb);
  const totalPathLossDb = modelPathLossDb + rainMarginDb;

  const rslDbm =
    eirpDbm - totalPathLossDb + rxSite.antennaGainDbi - rxTotalLineLoss;
  const fadeMarginDb = rslDbm - rxSite.rxSensitivityDbm;

  const verdict = evaluateHopVerdict(
    propagation.model,
    fadeMarginDb,
    propagation.targetFadeMarginDb,
    fresnel.minClearanceRatio,
  );

  const budgetItems: BudgetLineItem[] = [
    {
      id: 'tx-power',
      label: 'Transmitter Output Power',
      valueDb: txSite.txPowerDbm,
      unit: 'dBm',
      category: 'tx',
    },
    {
      id: 'tx-cable',
      label: `TX Coax Loss (${txSite.cableType}, ${txSite.cableLengthM} m)`,
      valueDb: -txCableLossDb,
      unit: 'dB',
      category: 'tx',
    },
    {
      id: 'tx-misc',
      label: 'TX Connector + Duplexer Loss',
      valueDb: -(txSite.connectorLossDb + txSite.duplexerLossDb),
      unit: 'dB',
      category: 'tx',
    },
    {
      id: 'tx-ant',
      label: 'TX Antenna Gain',
      valueDb: txSite.antennaGainDbi,
      unit: 'dB',
      category: 'tx',
      note: 'dBi',
    },
    {
      id: 'eirp',
      label: 'Effective Isotropic Radiated Power (EIRP)',
      valueDb: eirpDbm,
      unit: 'dBm',
      category: 'summary',
    },
    {
      id: 'fspl',
      label:
        propagation.model === 'fspl-diffraction'
          ? 'Free Space Path Loss (FSPL)'
          : `${modelLabel} Path Loss`,
      valueDb:
        propagation.model === 'fspl-diffraction' ? -fsplDb : -modelPathLossDb,
      unit: 'dB',
      category: 'path',
    },
    ...(propagation.model === 'fspl-diffraction'
      ? [
          {
            id: 'diffraction',
            label: 'ITU-R P.526 Knife-Edge Diffraction Loss',
            valueDb: -fresnel.diffractionLossDb,
            unit: 'dB' as const,
            category: 'path' as const,
            note: `ν = ${fresnel.worstNu.toFixed(2)}`,
          },
        ]
      : []),
    {
      id: 'rain',
      label: 'Atmospheric / Rain Attenuation Margin',
      valueDb: -rainMarginDb,
      unit: 'dB',
      category: 'path',
    },
    {
      id: 'rx-ant',
      label: 'RX Antenna Gain',
      valueDb: rxSite.antennaGainDbi,
      unit: 'dB',
      category: 'rx',
      note: 'dBi',
    },
    {
      id: 'rx-cable',
      label: `RX Coax Loss (${rxSite.cableType}, ${rxSite.cableLengthM} m)`,
      valueDb: -rxCableLossDb,
      unit: 'dB',
      category: 'rx',
    },
    {
      id: 'rx-misc',
      label: 'RX Connector + Duplexer Loss',
      valueDb: -(rxSite.connectorLossDb + rxSite.duplexerLossDb),
      unit: 'dB',
      category: 'rx',
    },
    {
      id: 'rsl',
      label: 'Received Signal Level (RSL)',
      valueDb: rslDbm,
      unit: 'dBm',
      category: 'summary',
    },
    {
      id: 'rx-sens',
      label: 'Receiver Sensitivity Threshold',
      valueDb: rxSite.rxSensitivityDbm,
      unit: 'dBm',
      category: 'rx',
    },
    {
      id: 'fade-margin',
      label: 'Link Fade Margin',
      valueDb: fadeMarginDb,
      unit: 'dB',
      category: 'summary',
      note: `Target ≥ ${propagation.targetFadeMarginDb} dB`,
    },
  ];

  const txWithGround: SiteNode = {
    ...txSite,
    groundElevationM: resolvedElevations[0] ?? txSite.groundElevationM,
  };
  const rxWithGround: SiteNode = {
    ...rxSite,
    groundElevationM:
      resolvedElevations[resolvedElevations.length - 1] ?? rxSite.groundElevationM,
  };

  return {
    hopId,
    label,
    txSite: txWithGround,
    rxSite: rxWithGround,
    distanceKm,
    forwardAzimuthDeg,
    reverseAzimuthDeg,
    eirpDbm,
    txCableLossDb,
    rxCableLossDb,
    fsplDb,
    diffractionLossDb: fresnel.diffractionLossDb,
    modelPathLossDb,
    totalPathLossDb,
    rslDbm,
    fadeMarginDb,
    maxFresnel1RadiusM: fresnel.maxFresnel1RadiusM,
    minClearanceM: fresnel.minClearanceM,
    minClearanceRatio: fresnel.minClearanceRatio,
    worstPoint: fresnel.worstPoint,
    worstNu: fresnel.worstNu,
    points: fresnel.points,
    heightAdvisor: fresnel.heightAdvisor,
    budgetItems,
    warnings,
    verdict,
  };
}

export function analyzeScenario(
  scenario: LinkScenario,
  elevations: ScenarioElevationsInput,
): LinkAnalysisResult {
  if (scenario.mode === 'ptp') {
    const hop = analyzeHop(
      'direct',
      `${scenario.tx.name} → ${scenario.rx.name}`,
      scenario.tx,
      scenario.rx,
      elevations.direct ?? [],
      scenario.propagation,
    );

    return {
      mode: 'ptp',
      overallVerdict: hop.verdict,
      bottleneckFadeMarginDb: hop.fadeMarginDb,
      bottleneckClearanceRatio: hop.minClearanceRatio,
      totalDistanceKm: hop.distanceKm,
      hops: [hop],
    };
  }

  const hop1 = analyzeHop(
    'hop1',
    `Hop 1: ${scenario.tx.name} → ${scenario.repeater.name}`,
    scenario.tx,
    scenario.repeater,
    elevations.hop1 ?? [],
    scenario.propagation,
  );

  const hop2 = analyzeHop(
    'hop2',
    `Hop 2: ${scenario.repeater.name} → ${scenario.rx.name}`,
    scenario.repeater,
    scenario.rx,
    elevations.hop2 ?? [],
    scenario.propagation,
  );

  const directReference = analyzeHop(
    'direct',
    `Direct Reference: ${scenario.tx.name} → ${scenario.rx.name}`,
    scenario.tx,
    scenario.rx,
    elevations.direct ?? [],
    scenario.propagation,
  );

  const overallVerdict = worstVerdict(hop1.verdict, hop2.verdict);
  const bottleneckFadeMarginDb = Math.min(hop1.fadeMarginDb, hop2.fadeMarginDb);
  const bottleneckClearanceRatio = Math.min(
    hop1.minClearanceRatio,
    hop2.minClearanceRatio,
  );

  const relayComparison: RelayComparison = {
    directFadeMarginDb: directReference.fadeMarginDb,
    relayBottleneckFadeMarginDb: bottleneckFadeMarginDb,
    fadeMarginGainDb: bottleneckFadeMarginDb - directReference.fadeMarginDb,
    directMinClearanceRatio: directReference.minClearanceRatio,
    relayBottleneckClearanceRatio: bottleneckClearanceRatio,
    clearanceGainPercent:
      (bottleneckClearanceRatio - directReference.minClearanceRatio) * 100,
    directVerdict: directReference.verdict,
    relayVerdict: overallVerdict,
  };

  return {
    mode: 'relay',
    overallVerdict,
    bottleneckFadeMarginDb,
    bottleneckClearanceRatio,
    totalDistanceKm: hop1.distanceKm + hop2.distanceKm,
    hops: [hop1, hop2],
    directReference,
    relayComparison,
  };
}
