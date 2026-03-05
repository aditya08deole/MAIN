/**
 * tankCalculations.ts
 * Pure, dependency-free calculations for EvaraTank telemetry.
 *
 * Physics: the sensor is mounted at the TOP of the tank and measures
 * the AIR GAP (distance from sensor to water surface).
 *   water_height = tank_height − air_gap     (clamped [0, tank_height])
 *   level %      = water_height / tank_height × 100  (clamped [0, 100])
 *   volume       = (level% / 100) × capacity_litres  (clamped [0, capacity])
 */

export type TankShape = 'rectangular' | 'cylindrical' | 'sump';

export interface TankDimensions {
  tankShape: TankShape;
  /** metres */
  heightM: number;
  /** metres — rectangular / sump */
  lengthM?: number;
  /** metres — rectangular / sump */
  breadthM?: number;
  /** metres — cylindrical */
  radiusM?: number;
  /** explicit override in litres; takes precedence over computed value */
  capacityOverrideLitres?: number | null;
}

export interface TankMetrics {
  /** cm of water above tank floor */
  waterHeightCm: number;
  /** 0–100 */
  percentage: number;
  /** litres */
  volumeLitres: number;
  /** litres */
  capacityLitres: number;
  /** false when sensorReadingCm was null / negative / clearly invalid */
  isDataValid: boolean;
}

// ─────────────────────────────────────────────────────────────
// Capacity
// ─────────────────────────────────────────────────────────────

/**
 * Derived capacity in litres.
 * Uses capacityOverrideLitres when set; otherwise computes from geometry.
 * 1 m³ = 1 000 litres.
 */
export function computeCapacityLitres(dims: TankDimensions): number {
  if (dims.capacityOverrideLitres != null && dims.capacityOverrideLitres > 0) {
    return dims.capacityOverrideLitres;
  }

  const h = dims.heightM ?? 0;

  if (dims.tankShape === 'cylindrical') {
    const r = dims.radiusM ?? 0;
    return Math.PI * r * r * h * 1000;
  }

  // rectangular + sump
  const l = dims.lengthM ?? 0;
  const b = dims.breadthM ?? 0;
  return l * b * h * 1000;
}

// ─────────────────────────────────────────────────────────────
// Raw-sensor → derived values
// ─────────────────────────────────────────────────────────────

/**
 * Converts an air-gap sensor reading (cm) into water height above the floor (cm).
 * Result is clamped to [0, tankHeightCm].
 */
export function airGapToWaterHeight(airGapCm: number, tankHeightCm: number): number {
  return Math.max(0, Math.min(tankHeightCm, tankHeightCm - airGapCm));
}

/**
 * Water height (cm) → level percentage [0, 100].
 */
export function waterHeightToPercentage(waterHeightCm: number, tankHeightCm: number): number {
  if (tankHeightCm <= 0) return 0;
  return Math.max(0, Math.min(100, (waterHeightCm / tankHeightCm) * 100));
}

/**
 * Level percentage + capacity → volume in litres, clamped [0, capacity].
 */
export function percentageToVolume(pct: number, capacityLitres: number): number {
  return Math.max(0, Math.min(capacityLitres, (pct / 100) * capacityLitres));
}

// ─────────────────────────────────────────────────────────────
// Formatting
// ─────────────────────────────────────────────────────────────

/**
 * Human-friendly volume string.
 *   < 1 000 L  →  "XXX L"
 *   ≥ 1 000 L  →  "X.XX KL"
 */
export function formatVolume(litres: number): string {
  if (litres < 1000) {
    return `${Math.round(litres)} L`;
  }
  return `${(litres / 1000).toFixed(2)} KL`;
}

// ─────────────────────────────────────────────────────────────
// Full computation
// ─────────────────────────────────────────────────────────────

/**
 * Central entry point.
 * sensorReadingCm is the raw air-gap value from the sensor (field1 / depth_field).
 * Returns a full TankMetrics object; isDataValid signals whether the sensor value
 * was usable.
 */
export function computeTankMetrics(params: {
  sensorReadingCm: number | null;
  dims: TankDimensions;
}): TankMetrics {
  const { sensorReadingCm, dims } = params;
  const capacityLitres = computeCapacityLitres(dims);
  const tankHeightCm = dims.heightM * 100;

  const isDataValid =
    sensorReadingCm !== null &&
    isFinite(sensorReadingCm) &&
    sensorReadingCm >= 0 &&
    tankHeightCm > 0;

  if (!isDataValid) {
    return {
      waterHeightCm: 0,
      percentage: 0,
      volumeLitres: 0,
      capacityLitres,
      isDataValid: false,
    };
  }

  const waterHeightCm = airGapToWaterHeight(sensorReadingCm!, tankHeightCm);
  const percentage = Number(waterHeightToPercentage(waterHeightCm, tankHeightCm).toFixed(2));
  const volumeLitres = percentageToVolume(percentage, capacityLitres);

  return { waterHeightCm, percentage, volumeLitres, capacityLitres, isDataValid: true };
}
