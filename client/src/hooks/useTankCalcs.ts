/**
 * useTankCalcs — Physics-correct tank telemetry calculations
 *
 * Sensor physics:
 *   The ultrasonic sensor is mounted at the TOP of the tank.
 *   field1 = distance from sensor to water surface (empty gap in cm).
 *   waterColumnCm = tankHeightCm - field1
 *   percentage    = clamp(waterColumnCm / tankHeightCm, 0, 1) * 100
 *
 * Volume:
 *   Cylinder:     π × r² × h × 1000  (m³ → litres)
 *   Rectangular:  l × b × h × 1000   (m³ → litres)
 *   If capacity_liters is set, that value is used as capacityLiters.
 *
 * All dimensions stored in metres in the DB.
 */

import { useMemo } from 'react';
import type { TankConfig } from './useDeviceConfig';

// ── Helpers ─────────────────────────────────────────────────────────────────

function clamp(v: number, lo: number, hi: number): number {
    return Math.max(lo, Math.min(hi, v));
}

/** Derived capacity in litres from tank geometry. */
export function calcCapacityLiters(config: TankConfig): number {
    if (config.capacity_liters && config.capacity_liters > 0) {
        return config.capacity_liters;
    }
    const h = config.height_m ?? 0;
    if (config.tank_shape === 'cylinder') {
        const r = config.radius_m ?? 0;
        return Math.PI * r * r * h * 1000;
    }
    // rectangular (default)
    const l = config.length_m ?? 0;
    const b = config.breadth_m ?? 0;
    return l * b * h * 1000;
}

/** Convert raw sensor depth (cm, empty gap from top) → percentage filled (0-100). */
export function sensorDepthToPercent(sensorDepthCm: number, tankHeightCm: number): number {
    const waterCm = clamp(tankHeightCm - sensorDepthCm, 0, tankHeightCm);
    return tankHeightCm > 0 ? (waterCm / tankHeightCm) * 100 : 0;
}

/** Format litres smart: ≥1000 L → KL with 2 dp, else L with 0 dp. */
export function formatVolume(liters: number): string {
    if (liters >= 1000) return `${(liters / 1000).toFixed(2)} KL`;
    return `${Math.round(liters)} L`;
}

// ── Main hook ────────────────────────────────────────────────────────────────

interface TelemetryFeed {
    created_at?: string;
    field1?: string | null;
    level_percentage?: number | string | null;
    temperature_value?: number | string | null;
}

interface TankCalcsInput {
    /** TankConfig from useDeviceConfig — may be undefined while loading */
    config: TankConfig | undefined;
    /** Latest telemetry payload from backend */
    telemetryData: {
        data?: { field1?: string | number | null };
        level_percentage?: number | string | null;
        temperature_value?: number | string | null;
    } | null | undefined;
    /** History feeds array from /telemetry/history */
    historyFeeds: TelemetryFeed[] | undefined;
    /** Fallback tank height in metres if config not yet loaded */
    fallbackHeightM?: number;
}

interface TankCalcsResult {
    /** 0-100, e.g. 73.4 */
    percentage: number;
    /** in litres */
    volumeLiters: number;
    /** in litres — total physical capacity */
    capacityLiters: number;
    /** human-readable volume string ("83.25 KL" or "523 L") */
    volumeStr: string;
    /** human-readable capacity string */
    capacityStr: string;
    /** temperature in °C, null if unavailable */
    temperatureCelsius: number | null;
    /** history array for level % chart */
    levelData: { time: string; level: number }[];
    /** history array for volume chart (in litres) */
    volumeData: { time: string; volume: number }[];
    /** estimated daily consumption in litres */
    dailyConsumptionL: number;
    /** estimated weekly consumption in litres */
    weeklyConsumptionL: number;
    /** trend direction */
    trend: 'up' | 'down' | 'stable';
}

export function useTankCalcs({
    config,
    telemetryData,
    historyFeeds,
    fallbackHeightM = 13.16,
}: TankCalcsInput): TankCalcsResult {
    const tankHeightM  = config?.height_m ?? fallbackHeightM;
    const tankHeightCm = tankHeightM * 100;

    // ── Capacity ──────────────────────────────────────────────────────────────
    const capacityLiters = useMemo(() => {
        if (!config) return 0;
        return calcCapacityLiters(config);
    }, [config]);

    // ── Current percentage & volume ───────────────────────────────────────────
    const { percentage, volumeLiters, temperatureCelsius } = useMemo(() => {
        if (!telemetryData) return { percentage: 0, volumeLiters: 0, temperatureCelsius: null };

        let pct: number;
        if (telemetryData.level_percentage != null) {
            pct = clamp(Number(telemetryData.level_percentage), 0, 100);
        } else {
            const raw = Number(telemetryData.data?.field1 ?? 0);
            pct = sensorDepthToPercent(isNaN(raw) ? 0 : raw, tankHeightCm);
        }

        const cap = capacityLiters > 0 ? capacityLiters : fallbackHeightM * 1000; // rough fallback
        const vol = clamp((pct / 100) * cap, 0, cap);

        const temp = telemetryData.temperature_value != null
            ? Number(telemetryData.temperature_value)
            : null;

        return { percentage: pct, volumeLiters: vol, temperatureCelsius: isNaN(temp!) ? null : temp };
    }, [telemetryData, tankHeightCm, capacityLiters, fallbackHeightM]);

    // ── History charts ────────────────────────────────────────────────────────
    const { levelData, volumeData } = useMemo(() => {
        const feeds = historyFeeds ?? [];
        const levelArr: { time: string; level: number }[] = [];
        const volArr:   { time: string; volume: number }[] = [];

        for (const feed of feeds) {
            const d = new Date(feed.created_at ?? '');
            const timeStr = `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;

            let lvl: number;
            if (feed.level_percentage != null) {
                lvl = clamp(Number(feed.level_percentage), 0, 100);
            } else {
                const raw = Number(feed.field1 ?? 0);
                lvl = sensorDepthToPercent(isNaN(raw) ? 0 : raw, tankHeightCm);
            }

            const cap = capacityLiters > 0 ? capacityLiters : fallbackHeightM * 1000;
            const vol = clamp((lvl / 100) * cap, 0, cap);

            levelArr.push({ time: timeStr, level: Math.round(lvl * 10) / 10 });
            volArr.push({ time: timeStr, volume: Math.round(vol * 10) / 10 });
        }

        return { levelData: levelArr, volumeData: volArr };
    }, [historyFeeds, tankHeightCm, capacityLiters, fallbackHeightM]);

    // ── Consumption trend ─────────────────────────────────────────────────────
    const { dailyConsumptionL, weeklyConsumptionL, trend } = useMemo(() => {
        const feeds = historyFeeds ?? [];
        if (feeds.length < 2) return { dailyConsumptionL: 0, weeklyConsumptionL: 0, trend: 'stable' as const };

        const recent = feeds.slice(-10);
        const older  = feeds.slice(-20, -10);

        const getLvl = (f: TelemetryFeed) => {
            if (f.level_percentage != null) return clamp(Number(f.level_percentage), 0, 100);
            const raw = Number(f.field1 ?? 0);
            return sensorDepthToPercent(isNaN(raw) ? 0 : raw, tankHeightCm);
        };

        const recentAvg = recent.reduce((s, f) => s + getLvl(f), 0) / recent.length;
        const olderAvg  = older.length ? older.reduce((s, f) => s + getLvl(f), 0) / older.length : recentAvg;

        const tr: 'up' | 'down' | 'stable' = recentAvg > olderAvg + 2 ? 'up' : recentAvg < olderAvg - 2 ? 'down' : 'stable';
        const cap = capacityLiters > 0 ? capacityLiters : fallbackHeightM * 1000;
        const daily = Math.round(Math.abs(recentAvg - olderAvg) / 100 * cap * 2);

        return { dailyConsumptionL: daily, weeklyConsumptionL: daily * 7, trend: tr };
    }, [historyFeeds, tankHeightCm, capacityLiters, fallbackHeightM]);

    return {
        percentage,
        volumeLiters,
        capacityLiters,
        volumeStr: formatVolume(volumeLiters),
        capacityStr: formatVolume(capacityLiters),
        temperatureCelsius,
        levelData,
        volumeData,
        dailyConsumptionL,
        weeklyConsumptionL,
        trend,
    };
}
