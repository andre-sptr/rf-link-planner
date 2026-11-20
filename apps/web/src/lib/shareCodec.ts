import {
  CABLE_LIBRARY,
  DEMO_SCENARIOS,
  cloneScenario,
  type CableTypeId,
  type HataEnvironment,
  type LinkMode,
  type LinkScenario,
  type PropagationModelId,
  type SiteNode,
} from '@linksight/rf-engine';

function toBase64Url(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function fromBase64Url(encoded: string): string {
  const padded = encoded
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .padEnd(Math.ceil(encoded.length / 4) * 4, '=');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder().decode(bytes);
}

function clampNum(value: unknown, fallback: number, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, value));
}

function sanitizeString(value: unknown, fallback: string, maxLen = 80): string {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed.slice(0, maxLen) : fallback;
}

function sanitizeSite(raw: unknown, fallback: SiteNode): SiteNode {
  if (!raw || typeof raw !== 'object') return fallback;
  const obj = raw as Record<string, unknown>;
  const coordsObj =
    obj.coords && typeof obj.coords === 'object'
      ? (obj.coords as Record<string, unknown>)
      : {};

  const cableCandidate = obj.cableType;
  const cableType: CableTypeId =
    typeof cableCandidate === 'string' && cableCandidate in CABLE_LIBRARY
      ? (cableCandidate as CableTypeId)
      : fallback.cableType;

  return {
    ...fallback,
    name: sanitizeString(obj.name, fallback.name, 60),
    coords: {
      lat: clampNum(coordsObj.lat, fallback.coords.lat, -85, 85),
      lng: clampNum(coordsObj.lng, fallback.coords.lng, -180, 180),
    },
    groundElevationM: clampNum(
      obj.groundElevationM,
      fallback.groundElevationM,
      -500,
      9000,
    ),
    antennaHeightM: clampNum(obj.antennaHeightM, fallback.antennaHeightM, 1, 400),
    antennaGainDbi: clampNum(obj.antennaGainDbi, fallback.antennaGainDbi, -10, 50),
    cableType,
    cableLengthM: clampNum(obj.cableLengthM, fallback.cableLengthM, 0, 500),
    connectorLossDb: clampNum(obj.connectorLossDb, fallback.connectorLossDb, 0, 20),
    duplexerLossDb: clampNum(obj.duplexerLossDb, fallback.duplexerLossDb, 0, 20),
    txPowerDbm: clampNum(obj.txPowerDbm, fallback.txPowerDbm, -10, 70),
    rxSensitivityDbm: clampNum(
      obj.rxSensitivityDbm,
      fallback.rxSensitivityDbm,
      -150,
      -20,
    ),
  };
}

export function sanitizeScenario(raw: unknown): LinkScenario | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  const base = cloneScenario(DEMO_SCENARIOS[0]!);

  if (!obj.tx || !obj.rx || !obj.propagation) {
    return null;
  }

  const mode: LinkMode = obj.mode === 'ptp' || obj.mode === 'relay' ? obj.mode : base.mode;
  const propRaw = obj.propagation as Record<string, unknown>;
  const model: PropagationModelId =
    propRaw.model === 'fspl-diffraction' || propRaw.model === 'okumura-hata'
      ? propRaw.model
      : base.propagation.model;
  const hataEnvironment: HataEnvironment =
    propRaw.hataEnvironment === 'urban' ||
    propRaw.hataEnvironment === 'suburban' ||
    propRaw.hataEnvironment === 'rural'
      ? propRaw.hataEnvironment
      : base.propagation.hataEnvironment;

  return {
    id: sanitizeString(obj.id, `custom-${Date.now()}`, 60),
    name: sanitizeString(obj.name, 'Shared RF Link', 80),
    description: sanitizeString(obj.description, '', 240),
    mode,
    tx: sanitizeSite(obj.tx, base.tx),
    repeater: sanitizeSite(obj.repeater, base.repeater),
    rx: sanitizeSite(obj.rx, base.rx),
    propagation: {
      frequencyMhz: clampNum(
        propRaw.frequencyMhz,
        base.propagation.frequencyMhz,
        30,
        60000,
      ),
      model,
      hataEnvironment,
      kFactor: clampNum(propRaw.kFactor, base.propagation.kFactor, 0.4, 5),
      clutterHeightM: clampNum(
        propRaw.clutterHeightM,
        base.propagation.clutterHeightM,
        0,
        80,
      ),
      rainMarginDb: clampNum(propRaw.rainMarginDb, base.propagation.rainMarginDb, 0, 40),
      targetFadeMarginDb: clampNum(
        propRaw.targetFadeMarginDb,
        base.propagation.targetFadeMarginDb,
        0,
        50,
      ),
      sampleCount: Math.round(
        clampNum(propRaw.sampleCount, base.propagation.sampleCount, 20, 100),
      ),
    },
  };
}

export function encodeScenarioToParam(scenario: LinkScenario): string {
  return toBase64Url(JSON.stringify(scenario));
}

export function decodeScenarioFromParam(param: string): LinkScenario | null {
  if (!param || param.length > 16_000) return null;
  try {
    const parsed: unknown = JSON.parse(fromBase64Url(param));
    return sanitizeScenario(parsed);
  } catch {
    return null;
  }
}
