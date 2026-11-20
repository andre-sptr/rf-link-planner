import type { CableTypeId, HataEnvironment } from './types.js';

export interface CableSpec {
  id: CableTypeId;
  label: string;
  /** Attenuation factor a * sqrt(f_MHz) + b * f_MHz in dB / 100 m */
  a: number;
  b: number;
  notes: string;
}

export const CABLE_LIBRARY: Record<CableTypeId, CableSpec> = {
  INTEGRATED: {
    id: 'INTEGRATED',
    label: 'Integrated Radio / Zero Feeder',
    a: 0,
    b: 0,
    notes: 'Radio mounted directly at antenna feedpoint',
  },
  'LDF5-50A': {
    id: 'LDF5-50A',
    label: 'LDF5-50A (7/8" Heliax)',
    a: 0.118,
    b: 0.00045,
    notes: 'Low-loss broadcast/trunking tower feeder',
  },
  'LDF4-50A': {
    id: 'LDF4-50A',
    label: 'LDF4-50A (1/2" Heliax)',
    a: 0.214,
    b: 0.0008,
    notes: 'Standard base station / repeater coaxial feeder',
  },
  'LMR-400': {
    id: 'LMR-400',
    label: 'LMR-400 Low-Loss',
    a: 0.398,
    b: 0.00085,
    notes: 'Flexible low-loss UHF/900 MHz jumper & short run',
  },
  'LMR-240': {
    id: 'LMR-240',
    label: 'LMR-240 Jumper',
    a: 0.79,
    b: 0.0012,
    notes: 'Thin flexible jumper cable',
  },
  'RG-213': {
    id: 'RG-213',
    label: 'RG-213/U',
    a: 0.63,
    b: 0.0029,
    notes: 'Legacy VHF/UHF solid-PE coax',
  },
  'RG-58': {
    id: 'RG-58',
    label: 'RG-58/U',
    a: 1.35,
    b: 0.0045,
    notes: 'High-loss thin jumper (avoid long UHF+ runs)',
  },
};

export function calculateCableLossPer100m(
  cableType: CableTypeId,
  frequencyMhz: number,
): number {
  const spec = CABLE_LIBRARY[cableType];
  if (!spec || spec.id === 'INTEGRATED' || frequencyMhz <= 0) {
    return 0;
  }
  return spec.a * Math.sqrt(frequencyMhz) + spec.b * frequencyMhz;
}

export function calculateCableLossDb(
  cableType: CableTypeId,
  lengthM: number,
  frequencyMhz: number,
): number {
  if (!Number.isFinite(lengthM) || lengthM <= 0 || frequencyMhz <= 0) {
    return 0;
  }
  return (calculateCableLossPer100m(cableType, frequencyMhz) * lengthM) / 100;
}

/**
 * Free Space Path Loss (FSPL) in dB for distanceKm and frequencyMhz.
 */
export function calculateFsplDb(
  distanceKm: number,
  frequencyMhz: number,
): number {
  if (
    !Number.isFinite(distanceKm) ||
    !Number.isFinite(frequencyMhz) ||
    distanceKm <= 0 ||
    frequencyMhz <= 0
  ) {
    return 0;
  }
  return 32.44177 + 20 * Math.log10(distanceKm) + 20 * Math.log10(frequencyMhz);
}

export interface HataInput {
  distanceKm: number;
  frequencyMhz: number;
  txHeightM: number;
  rxHeightM: number;
  environment: HataEnvironment;
}

export interface HataResult {
  lossDb: number;
  variant: 'okumura-hata' | 'cost-231-hata';
  warnings: string[];
}

/**
 * Okumura-Hata (150-1500 MHz) and COST-231 Hata (1500-2000 MHz) empirical path loss.
 * Clamps internal math inputs to avoid NaN while reporting domain warnings explicitly.
 */
export function calculateOkumuraHataLossDb(input: HataInput): HataResult {
  const warnings: string[] = [];

  if (input.frequencyMhz < 150 || input.frequencyMhz > 2000) {
    warnings.push(
      `Okumura-Hata / COST-231 valid range is 150–2000 MHz (active: ${input.frequencyMhz} MHz). Results are extrapolated.`,
    );
  }
  if (input.distanceKm < 1 || input.distanceKm > 20) {
    warnings.push(
      `Okumura-Hata distance range is 1–20 km (active: ${input.distanceKm.toFixed(2)} km). Consider FSPL + Diffraction for long/short LOS hops.`,
    );
  }
  if (input.txHeightM < 30 || input.txHeightM > 200) {
    warnings.push(
      `Hata base antenna height assumption is 30–200 m (TX: ${input.txHeightM} m).`,
    );
  }
  if (input.rxHeightM < 1 || input.rxHeightM > 10) {
    warnings.push(
      `Hata mobile/remote antenna height assumption is 1–10 m (RX: ${input.rxHeightM} m).`,
    );
  }

  const f = Math.max(30, input.frequencyMhz);
  const d = Math.max(0.1, input.distanceKm);
  const hb = Math.max(1, input.txHeightM);
  const hm = Math.max(1, input.rxHeightM);

  const logF = Math.log10(f);
  const logHb = Math.log10(hb);
  const logD = Math.log10(d);

  // Small/medium city mobile antenna correction factor a(hm)
  const aHmMedium = (1.1 * logF - 0.7) * hm - (1.56 * logF - 0.8);

  if (f <= 1500) {
    const lu =
      69.55 +
      26.16 * logF -
      13.82 * logHb -
      aHmMedium +
      (44.9 - 6.55 * logHb) * logD;

    let lossDb = lu;
    if (input.environment === 'suburban') {
      const term = Math.log10(f / 28);
      lossDb = lu - 2 * term * term - 5.4;
    } else if (input.environment === 'rural') {
      lossDb = lu - 4.78 * logF * logF + 18.33 * logF - 40.94;
    }

    return {
      lossDb: Math.max(0, lossDb),
      variant: 'okumura-hata',
      warnings,
    };
  }

  // COST-231 extension (1500 - 2000 MHz)
  const cm = input.environment === 'urban' ? 3 : 0;
  let lossDb =
    46.3 +
    33.9 * logF -
    13.82 * logHb -
    aHmMedium +
    (44.9 - 6.55 * logHb) * logD +
    cm;

  if (input.environment === 'suburban') {
    const term = Math.log10(f / 28);
    lossDb -= 2 * term * term + 5.4;
  } else if (input.environment === 'rural') {
    lossDb -= 4.78 * logF * logF - 18.33 * logF + 40.94;
  }

  return {
    lossDb: Math.max(0, lossDb),
    variant: 'cost-231-hata',
    warnings,
  };
}

export function wattsToDbm(watts: number): number {
  if (!Number.isFinite(watts) || watts <= 0) return -100;
  return 10 * Math.log10(watts * 1000);
}

export function dbmToWatts(dbm: number): number {
  if (!Number.isFinite(dbm)) return 0;
  return Math.pow(10, (dbm - 30) / 10);
}

export function dbdToDbi(dbd: number): number {
  return dbd + 2.15;
}

export function dbiToDbd(dbi: number): number {
  return dbi - 2.15;
}
