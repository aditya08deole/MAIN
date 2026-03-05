import { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, Navigate, useNavigate } from 'react-router-dom';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { useQueryClient } from '@tanstack/react-query';
import api from '../services/api';
import { useStaleDataAge } from '../hooks/useStaleDataAge';
import { useTelemetryRealtime } from '../hooks/useTelemetryRealtime';
import { useDeviceAnalytics } from '../hooks/useDeviceAnalytics';
import type { NodeInfoData } from '../hooks/useDeviceAnalytics';
import { computeOnlineStatus } from '../utils/telemetryPipeline';
import type { TankConfig } from '../hooks/useDeviceConfig';
import {
  computeCapacityLitres,
  computeTankMetrics,
  percentageToVolume,
  formatVolume,
} from '../utils/tankCalculations';
import type { TankShape } from '../utils/tankCalculations';

// ─── Constants ───────────────────────────────────────────────────────────────
// TARGET_DEVICE_ID removed — device is now read from the route param /evaratank/:id

// ─── Types ────────────────────────────────────────────────────────────────────
interface TelemetryPayload {
  timestamp: string;
  data: { entry_id: number;[key: string]: unknown };
  level_percentage?: number;
  temperature_value?: number;
  total_liters?: number;
}

interface HistoryFeed {
  created_at: string;
  level_percentage?: number | null;
  [k: string]: unknown;
}

interface LocalTankConfig {
  thingspeakChannelId: string;
  thingspeakReadKey: string;
  tankShape: TankShape;
  heightM: number;
  lengthM: number;
  breadthM: number;
  radiusM: number;
  capacityOverrideLitres: number | null;
  fieldDepth: string;
  fieldTemperature: string;
}

const DEFAULT_LOCAL_CFG: LocalTankConfig = {
  thingspeakChannelId: '',
  thingspeakReadKey: '',
  tankShape: 'rectangular',
  heightM: 13.16,
  lengthM: 5,
  breadthM: 5,
  radiusM: 1.5,
  capacityOverrideLitres: null,
  fieldDepth: 'field1',
  fieldTemperature: 'field2',
};

function serverConfigToLocal(cfg: TankConfig): LocalTankConfig {
  return {
    thingspeakChannelId: cfg.thingspeak_channel_id ?? '',
    thingspeakReadKey: '',   // never returned by the server for security
    tankShape: (cfg.tank_shape as TankShape) ?? DEFAULT_LOCAL_CFG.tankShape,
    heightM: cfg.height_m ?? DEFAULT_LOCAL_CFG.heightM,
    lengthM: cfg.length_m ?? DEFAULT_LOCAL_CFG.lengthM,
    breadthM: cfg.breadth_m ?? DEFAULT_LOCAL_CFG.breadthM,
    radiusM: cfg.radius_m ?? DEFAULT_LOCAL_CFG.radiusM,
    // FIXED: backend returns capacity_liters (not capacity_override_liters)
    capacityOverrideLitres: cfg.capacity_liters ?? null,
    // FIXED: backend returns water_level_field / temperature_field (not field_depth / field_temperature)
    fieldDepth: cfg.water_level_field ?? 'field1',
    fieldTemperature: cfg.temperature_field ?? 'field2',
  };
}

function localToApiBody(lc: LocalTankConfig) {
  return {
    thingspeak_channel_id: lc.thingspeakChannelId || undefined,
    thingspeak_read_key: lc.thingspeakReadKey || undefined,
    tank_shape: lc.tankShape,
    height_m: lc.heightM,
    length_m: lc.lengthM,
    breadth_m: lc.breadthM,
    radius_m: lc.radiusM,
    // FIXED: backend PUT /config expects capacity_liters (not capacity_override_liters)
    capacity_liters: lc.capacityOverrideLitres,
    // FIXED: backend PUT /config expects water_level_field / temperature_field
    water_level_field: lc.fieldDepth,
    temperature_field: lc.fieldTemperature,
  };
}

// ─── Sub-components ───────────────────────────────────────────────────────────
// Local AnimatedTank removed in favor of RealisticTank component

// ─── Main component ───────────────────────────────────────────────────────────
const EvaraTankAnalytics = () => {
  const { id: routeDeviceId } = useParams<{ id: string }>();
  const deviceId = routeDeviceId ?? '';
  const queryClient = useQueryClient();

  // ── Config panel form state ───────────────────────────────────────────────
  const [localCfg, setLocalCfg] = useState<LocalTankConfig>(DEFAULT_LOCAL_CFG);
  const [cfgDirty, setCfgDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // ── Unified Analytics Data ────────────────────────────────────────────────
  const { data: unifiedData, isLoading: analyticsLoading, isError: telemetryError, refetch } = useDeviceAnalytics(deviceId);

  const deviceConfig = ('config' in (unifiedData?.config ?? {})
    ? (unifiedData!.config as any).config
    : undefined) as TankConfig | undefined;
  const telemetryData = (unifiedData?.latest && !('error' in unifiedData.latest)
    ? unifiedData.latest
    : undefined) as TelemetryPayload | undefined;
  const deviceInfo = ('data' in (unifiedData?.info ?? {})
    ? (unifiedData!.info as any).data
    : undefined) as NodeInfoData | undefined;
  const historyFeeds = ('feeds' in (unifiedData?.history ?? {})
    ? (unifiedData!.history as any).feeds
    : []) as TelemetryPayload[];

  const telemetryLoading = analyticsLoading;
  const historyLoading = analyticsLoading;

  // P2: prefer snapshot timestamp; fall back to device last_seen so map-online
  // devices don't show Offline on analytics page when ingestion is slow.
  const snapshotTs = telemetryData?.timestamp ?? null;
  const deviceLastSeen = deviceInfo?.last_seen ?? null;
  const bestTimestamp = snapshotTs ?? deviceLastSeen;
  const onlineStatus = computeOnlineStatus(bestTimestamp, 'EvaraTank');

  useEffect(() => {
    if (deviceConfig) {
      setLocalCfg(serverConfigToLocal(deviceConfig));
      setCfgDirty(false);
    }
  }, [deviceConfig]);

  // ── Realtime subscription ─────────────────────────────────────────────────
  useTelemetryRealtime({
    deviceId: deviceId,
    latestQueryKey: ['analytics', 'full', deviceId],
    historyQueryKey: ['analytics', 'full', deviceId],
    snapshotTable: 'evaratank_snapshots',
    // P4: handle null _old (realtime update arrives before first load completes)
    snapshotMerger: (_old: unknown, snap: Record<string, unknown>) => {
      const base = (_old as any) ?? {
        info: null,
        config: null,
        latest: null,
        history: { feeds: [] },
      };
      return {
        ...base,
        latest: {
          ...(base.latest ?? {}),
          timestamp: snap.last_timestamp,
          level_percentage: snap.level_percentage,
          temperature_value: snap.temperature_value,
          data: snap.payload ?? base.latest?.data,
        },
      };
    },
  });

  // ── Stale-data age ────────────────────────────────────────────────────────
  const { label: staleLabel } = useStaleDataAge(telemetryData?.timestamp ?? null);
  const isOffline = onlineStatus === 'Offline';

  // ── Derive current metrics ────────────────────────────────────────────────
  const metrics = useMemo(() => {
    const backendPct = telemetryData?.level_percentage;
    // Backend also sends pre-computed volume_liters (via total_liters field)
    const backendVolume = telemetryData?.total_liters ?? null;

    if (backendPct != null && isFinite(backendPct)) {
      const capacityLitres = computeCapacityLitres({
        tankShape: localCfg.tankShape, heightM: localCfg.heightM,
        lengthM: localCfg.lengthM, breadthM: localCfg.breadthM,
        radiusM: localCfg.radiusM, capacityOverrideLitres: localCfg.capacityOverrideLitres,
      });
      const pct = Math.max(0, Math.min(100, backendPct));
      // Prefer backend-computed volume; fall back to local computation
      const volumeLitres = (backendVolume != null && isFinite(backendVolume))
        ? backendVolume
        : percentageToVolume(pct, capacityLitres);
      return {
        waterHeightCm: (pct / 100) * localCfg.heightM * 100,
        percentage: pct,
        volumeLitres,
        capacityLitres,
        isDataValid: true,
      };
    }
    const rawField = telemetryData?.data?.[localCfg.fieldDepth] as string | number | undefined;
    const sensorCm = rawField != null ? parseFloat(String(rawField)) : null;
    return computeTankMetrics({
      sensorReadingCm: sensorCm !== null && isFinite(sensorCm) ? sensorCm : null,
      dims: { tankShape: localCfg.tankShape, heightM: localCfg.heightM, lengthM: localCfg.lengthM, breadthM: localCfg.breadthM, radiusM: localCfg.radiusM, capacityOverrideLitres: localCfg.capacityOverrideLitres },
    });
  }, [telemetryData, localCfg]);

  // ── Charts ────────────────────────────────────────────────────────────────
  const { levelChartData, volumeChartData } = useMemo(() => {
    const feeds: HistoryFeed[] = historyFeeds as unknown as HistoryFeed[];
    const capacity = metrics.capacityLitres;
    const tankHeightCm = localCfg.heightM * 100;
    const level: { time: string; level: number }[] = [];
    const volume: { time: string; volume: number }[] = [];
    for (const feed of feeds) {
      const d = new Date(feed.created_at);
      const time = `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
      let pct: number;
      if (feed.level_percentage != null) {
        pct = Math.max(0, Math.min(100, Number(feed.level_percentage)));
      } else if (tankHeightCm > 0) {
        // Fallback: compute from raw sensor distance field
        const rawDist = feed[localCfg.fieldDepth] as string | number | undefined;
        const distCm = rawDist != null ? parseFloat(String(rawDist)) : null;
        if (distCm != null && isFinite(distCm)) {
          const waterCm = Math.max(0, Math.min(tankHeightCm, tankHeightCm - distCm));
          pct = Math.round((waterCm / tankHeightCm) * 1000) / 10; // 1 dp
        } else {
          continue; // skip feeds where we can't compute anything
        }
      } else {
        continue; // skip when height is unknown
      }
      level.push({ time, level: Math.round(pct * 10) / 10 });
      volume.push({ time, volume: Math.round(percentageToVolume(pct, capacity)) });
    }
    return { levelChartData: level, volumeChartData: volume };
  }, [historyFeeds, metrics.capacityLitres, localCfg.fieldDepth, localCfg.heightM]);

  // ── Computed capacity preview ─────────────────────────────────────────────
  const previewCapacity = useMemo(
    () => computeCapacityLitres({ tankShape: localCfg.tankShape, heightM: localCfg.heightM, lengthM: localCfg.lengthM, breadthM: localCfg.breadthM, radiusM: localCfg.radiusM, capacityOverrideLitres: localCfg.capacityOverrideLitres }),
    [localCfg],
  );

  // ── Config save ───────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    setSaving(true); setSaveError(null);
    try {
      await api.put(`/telemetry/devices/${deviceId}/config`, localToApiBody(localCfg));
      await queryClient.invalidateQueries({ queryKey: ['device-config', deviceId] });
      await queryClient.invalidateQueries({ queryKey: ['telemetry', deviceId, 'latest'] });
      setCfgDirty(false);
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save config');
    } finally { setSaving(false); }
  }, [localCfg, queryClient, deviceId]);

  const handleReset = useCallback(() => {
    if (deviceConfig) { setLocalCfg(serverConfigToLocal(deviceConfig)); setCfgDirty(false); }
  }, [deviceConfig]);

  function patch(updates: Partial<LocalTankConfig>) {
    setLocalCfg((prev) => ({ ...prev, ...updates }));
    setCfgDirty(true);
  }

  // ── Derived display ───────────────────────────────────────────────────────
  const pct = metrics.percentage;


  // ── Device display helpers ─────────────────────────────────────────────
  const deviceName = deviceInfo?.name ?? 'Tank Device';
  const deviceShortId = deviceId.substring(0, 8).toUpperCase();

  // ── Volume unit for chart axis (dynamic L / KL) ─────────────────────
  const { volUnit, volDivisor } = useMemo(() => {
    const maxVol = Math.max(...volumeChartData.map(d => d.volume), 1);
    return maxVol >= 1000 ? { volUnit: 'KL', volDivisor: 1000 } : { volUnit: 'L', volDivisor: 1 };
  }, [volumeChartData]);

  // ── Trend display ─────────────────────────────────────────────────────
  // ── Trend direction ──────────────────────────────────────────────────────
  const trend = useMemo(() => {
    if (levelChartData.length < 3) return 'stable';
    const tail = levelChartData.slice(-3);
    const delta = tail[2].level - tail[0].level;
    return delta > 1.5 ? 'rising' : delta < -1.5 ? 'falling' : 'stable';
  }, [levelChartData]);

  // ── Trend display label/icon/color ────────────────────────────────────────
  const trendInfo = useMemo(() => {
    if (trend === 'rising') return { label: 'Filling', icon: 'arrow_upward', color: '#34C759', bg: 'rgba(52,199,89,0.12)' };
    if (trend === 'falling') return { label: 'Draining', icon: 'arrow_downward', color: '#FF3B30', bg: 'rgba(255,59,48,0.12)' };
    return { label: 'Stable', icon: 'remove', color: '#8E8E93', bg: 'rgba(142,142,147,0.12)' };
  }, [trend]);

  // ── Staleness label already extracted above (staleLabel) ──────────────────

  const navigate = useNavigate();

  // Guard: if no device id in route, redirect to /nodes
  if (!deviceId) return <Navigate to="/nodes" replace />;

  if (analyticsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-transparent">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 rounded-full border-4 border-solid animate-spin" style={{ borderColor: 'rgba(10,132,255,0.2)', borderTopColor: '#0A84FF' }} />
          <p className="text-sm font-medium" style={{ color: '#8E8E93' }}>Loading analytics...</p>
        </div>
      </div>
    );
  }

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen font-sans relative overflow-x-hidden bg-transparent" style={{ color: '#1C1C1E' }}>

      <main className="relative flex-grow px-4 sm:px-6 lg:px-8 pt-[110px] lg:pt-[120px] pb-8" style={{ zIndex: 1 }}>
        <div className="max-w-[1400px] mx-auto flex flex-col gap-6">

          {/* ── Breadcrumb + status row ── */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <nav className="flex items-center gap-1 text-sm font-medium" style={{ color: '#8E8E93' }}>
              <button onClick={() => navigate('/map')} className="hover:text-[#FF9500] transition-colors bg-transparent border-none cursor-pointer p-0 flex items-center">
                <span className="material-symbols-rounded" style={{ fontSize: 18 }}>home</span>
              </button>
              <span className="material-symbols-rounded" style={{ fontSize: 16, color: '#C7C7CC' }}>chevron_right</span>
              <button onClick={() => navigate('/nodes')} className="hover:text-[#FF9500] transition-colors bg-transparent border-none cursor-pointer p-0 font-medium" style={{ color: '#8E8E93' }}>
                All Nodes
              </button>
              <span className="material-symbols-rounded" style={{ fontSize: 16, color: '#C7C7CC' }}>chevron_right</span>
              <span className="font-semibold" style={{ color: '#1C1C1E' }}>{deviceName}</span>
            </nav>
            <div className="flex items-center gap-2">
              {/* Online/Offline pill */}
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold"
                style={{ background: isOffline ? 'rgba(255,59,48,0.1)' : 'rgba(52,199,89,0.1)', color: isOffline ? '#FF3B30' : '#34C759' }}>
                <span className="relative flex" style={{ width: 8, height: 8 }}>
                  {!isOffline && <span className="absolute inset-0 rounded-full" style={{ background: '#34C759', animation: 'ping 1.5s cubic-bezier(0,0,0.2,1) infinite', opacity: 0.75 }} />}
                  <span className="relative rounded-full block w-full h-full" style={{ background: isOffline ? '#FF3B30' : '#34C759' }} />
                </span>
                {isOffline ? 'Offline' : 'Online'}
              </div>
              <button onClick={() => refetch()}
                className="flex items-center gap-1.5 text-sm font-semibold rounded-full px-3 py-1.5 transition-all hover:scale-95"
                style={{ background: 'rgba(10,132,255,0.1)', color: '#0A84FF', border: 'none', cursor: 'pointer' }}>
                <span className="material-symbols-rounded" style={{ fontSize: 15 }}>refresh</span>
                Refresh
              </button>
            </div>
          </div>

          {/* ── Telemetry error banner ── */}
          {telemetryError && (
            <div className="rounded-2xl px-4 py-3 text-sm font-medium flex items-center justify-between gap-4"
              style={{ background: 'rgba(255,59,48,0.1)', color: '#FF3B30' }}>
              <div className="flex items-center gap-2">
                <span className="material-symbols-rounded" style={{ fontSize: 18 }}>warning</span>
                Failed to load latest telemetry. Retrying in background...
              </div>
              <button onClick={() => refetch()} className="px-3 py-1 bg-[#FF3B30] text-white rounded-full text-xs font-semibold border-none cursor-pointer hover:bg-red-600 transition-colors">
                Retry Now
              </button>
            </div>
          )}

          {/* ── Top 3-column grid ── */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">

            {/* ──────────── TANK VISUALIZER ──────────── */}
            <div className="lg:col-span-4 apple-glass-card rounded-[2.5rem] p-6 flex flex-col relative overflow-hidden">
              <div className="flex justify-between items-start mb-2 z-10">
                <div>
                  <h3 className="text-xl font-semibold m-0 leading-tight">{deviceName}</h3>
                  <p className="text-xs font-medium mt-0.5 m-0" style={{ color: '#8E8E93' }}>ID: {deviceShortId}</p>
                </div>
                <button className="rounded-full p-2 transition-colors"
                  style={{ background: 'rgba(0,0,0,0.05)', border: 'none', cursor: 'pointer', color: '#8E8E93' }}>
                  <span className="material-symbols-rounded" style={{ fontSize: 20 }}>more_horiz</span>
                </button>
              </div>

              {/* Tank graphic */}
              <div className="flex-grow flex items-center justify-center py-6 z-10">
                <div className="relative" style={{ width: 180, height: 260 }}>
                  {/* Glass tank body */}
                  <div className="absolute inset-0 rounded-[40px] overflow-hidden z-10 tank-glass"
                    style={{ border: '3px solid rgba(255,255,255,0.6)', boxShadow: '0 20px 40px rgba(0,0,0,0.1)' }}>
                    {/* Glass highlight strips */}
                    <div className="absolute top-0 bottom-0 left-2" style={{ width: 16, background: 'linear-gradient(90deg,rgba(255,255,255,0.6),transparent)', filter: 'blur(2px)', zIndex: 30 }} />
                    <div className="absolute top-0 bottom-0 right-1" style={{ width: 8, background: 'linear-gradient(270deg,rgba(255,255,255,0.4),transparent)', filter: 'blur(1px)', zIndex: 30 }} />

                    {/* Water fill — height driven by real pct */}
                    <div className="absolute bottom-0 left-0 right-0 overflow-hidden z-20"
                      style={{ height: telemetryLoading ? '50%' : `${pct}%`, transition: 'height 1.5s cubic-bezier(0.34,1.56,0.64,1)' }}>
                      {/* Ambient glow */}
                      <div className="absolute inset-0" style={{ background: 'rgba(10,132,255,0.18)', mixBlendMode: 'overlay', filter: 'blur(8px)' }} />
                      {/* Back wave */}
                      <div className="absolute bottom-0 w-[200%] h-full left-0" style={{ animation: 'ios-wave 8s linear infinite', opacity: 0.6 }}>
                        <svg viewBox="0 0 800 100" preserveAspectRatio="none" style={{ width: '100%', height: '100%' }}>
                          <defs>
                            <linearGradient id="wgBack" x1="0%" y1="0%" x2="0%" y2="100%">
                              <stop offset="0%" stopColor="#7dd3fc" /><stop offset="100%" stopColor="#0369a1" />
                            </linearGradient>
                          </defs>
                          <path d="M 0,30 Q 100,50 200,30 T 400,30 T 600,30 T 800,30 L 800,100 L 0,100 Z" fill="url(#wgBack)" />
                        </svg>
                      </div>
                      {/* Front wave */}
                      <div className="absolute bottom-0 w-[200%] h-full left-0" style={{ animation: 'ios-wave 5s linear infinite', opacity: 0.9 }}>
                        <svg viewBox="0 0 800 100" preserveAspectRatio="none" style={{ width: '100%', height: '100%' }}>
                          <defs>
                            <linearGradient id="wgFront" x1="0%" y1="0%" x2="0%" y2="100%">
                              <stop offset="0%" stopColor="#38bdf8" /><stop offset="50%" stopColor="#0ea5e9" /><stop offset="100%" stopColor="#0284c7" />
                            </linearGradient>
                          </defs>
                          <path d="M 0,40 Q 100,10 200,40 T 400,40 T 600,40 T 800,40 L 800,100 L 0,100 Z" fill="url(#wgFront)" />
                        </svg>
                      </div>
                      {/* Bubbles */}
                      {[{ l: '20%', s: 8, d: '0s' }, { l: '50%', s: 12, d: '1.5s' }, { l: '75%', s: 6, d: '0.8s' }, { l: '35%', s: 10, d: '2.2s' }].map((b, i) => (
                        <div key={i} className="absolute bottom-0 rounded-full"
                          style={{ left: b.l, width: b.s, height: b.s, background: 'rgba(255,255,255,0.4)', animation: `ios-bubble 4s ${b.d} ease-in-out infinite` }} />
                      ))}
                    </div>

                    {/* Ruler tick marks */}
                    <div className="absolute right-3 top-0 bottom-0 flex flex-col justify-between py-6 z-30" style={{ opacity: 0.6, width: 32 }}>
                      {[['100', true], ['', false], ['75', true], ['', false], ['50', true], ['', false], ['25', true], ['', false], ['0', true]].map(([lbl, show], i) => (
                        <div key={i} className="flex items-center justify-end gap-1">
                          {show && <span style={{ fontSize: 9, fontWeight: 700, fontFamily: 'monospace', color: '#475569' }}>{lbl}</span>}
                          <div style={{ width: show ? 8 : 4, height: 2, background: show ? '#94a3b8' : '#cbd5e1', borderRadius: 2 }} />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Tank base shadow */}
                  <div className="absolute -bottom-2 rounded-full" style={{ left: '10%', width: '80%', height: 16, background: '#d1d5db', filter: 'blur(6px)', zIndex: -1 }} />
                </div>
              </div>

              {/* Footer row */}
              <div className="flex justify-between items-center z-10 mt-auto pt-2">
                <span className="text-xs font-medium" style={{ color: '#8E8E93' }}>{staleLabel}</span>
                <span className="flex items-center gap-1 text-xs font-semibold rounded-md px-2 py-1"
                  style={{ color: '#0A84FF', background: 'rgba(10,132,255,0.1)' }}>
                  <span className="material-symbols-rounded" style={{ fontSize: 14 }}>sync</span> Live
                </span>
              </div>
            </div>

            {/* ──────────── CORE STATS ──────────── */}
            <div className="lg:col-span-4 apple-glass-card rounded-[2.5rem] p-8 flex flex-col relative group">
              <div className="absolute inset-0 rounded-[2.5rem] pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                style={{ background: 'linear-gradient(to bottom, rgba(10,132,255,0.04), transparent)' }} />

              <div className="flex flex-col items-center justify-center flex-grow gap-8 z-10">
                {/* Big percentage */}
                <div className="text-center">
                  <p className="text-xs font-bold uppercase tracking-widest m-0 mb-2" style={{ color: '#8E8E93', letterSpacing: '0.15em' }}>Current Level</p>
                  <div className="flex items-start justify-center">
                    <span className="font-bold leading-none tracking-tight"
                      style={{ fontSize: 88, background: 'linear-gradient(135deg,#1C1C1E,#636366)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                      {telemetryLoading ? '--' : Math.round(pct)}
                    </span>
                    <span className="font-semibold mt-3 ml-1" style={{ fontSize: 30, color: '#8E8E93' }}>%</span>
                  </div>
                  {/* Trend badge */}
                  <div className="mt-4 inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-semibold"
                    style={{ background: trendInfo.bg, color: trendInfo.color }}>
                    <span className="material-symbols-rounded" style={{ fontSize: 18 }}>{trendInfo.icon}</span>
                    {trendInfo.label}
                  </div>
                </div>

                {/* Divider */}
                <div className="w-full h-px" style={{ background: 'linear-gradient(90deg,transparent,rgba(0,0,0,0.08),transparent)' }} />

                {/* Volume + Capacity chips */}
                <div className="grid grid-cols-2 gap-4 w-full">
                  <div className="text-center rounded-2xl p-4" style={{ background: 'rgba(0,0,0,0.04)' }}>
                    <p className="text-xs font-bold uppercase tracking-wider m-0 mb-1" style={{ color: '#8E8E93', letterSpacing: '0.1em' }}>Volume</p>
                    <p className="text-xl font-bold m-0" style={{ color: '#1C1C1E' }}>
                      {formatVolume(metrics.volumeLitres)}
                    </p>
                  </div>
                  <div className="text-center rounded-2xl p-4" style={{ background: 'rgba(0,0,0,0.04)' }}>
                    <p className="text-xs font-bold uppercase tracking-wider m-0 mb-1" style={{ color: '#8E8E93', letterSpacing: '0.1em' }}>Capacity</p>
                    <p className="text-xl font-bold m-0" style={{ color: '#1C1C1E' }}>
                      {formatVolume(metrics.capacityLitres)}
                    </p>
                  </div>
                  {telemetryData?.temperature_value != null && (
                    <div className="col-span-2 text-center rounded-2xl p-3" style={{ background: 'rgba(255,149,0,0.08)' }}>
                      <p className="text-xs font-bold uppercase tracking-wider m-0 mb-0.5" style={{ color: '#FF9500', letterSpacing: '0.1em' }}>Temperature</p>
                      <p className="text-lg font-bold m-0" style={{ color: '#FF9500' }}>{telemetryData.temperature_value.toFixed(1)}°C</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ──────────── CONFIG PARAMS ──────────── */}
            <div className="lg:col-span-4 apple-glass-card rounded-[2.5rem] p-6 lg:p-8 flex flex-col">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold m-0 flex items-center gap-2">
                  <span className="flex items-center justify-center rounded-lg p-1.5"
                    style={{ background: 'rgba(255,149,0,0.1)', color: '#FF9500' }}>
                    <span className="material-symbols-rounded" style={{ fontSize: 20 }}>tune</span>
                  </span>
                  Parameters
                </h3>
                <button onClick={handleReset} disabled={!cfgDirty}
                  className="text-sm font-semibold transition-opacity bg-transparent border-none cursor-pointer"
                  style={{ color: '#0A84FF', opacity: cfgDirty ? 1 : 0.4 }}>
                  Reset
                </button>
              </div>

              <div className="flex flex-col gap-5 flex-grow">
                {/* ThingSpeak Connection — shown prominently when channel is missing */}
                <div className="flex flex-col gap-1.5">
                  <h4 className="text-xs font-bold uppercase tracking-wider m-0 ml-1 flex items-center gap-1"
                    style={{ color: localCfg.thingspeakChannelId ? '#8E8E93' : '#FF9500' }}>
                    {!localCfg.thingspeakChannelId && (
                      <span className="material-symbols-rounded" style={{ fontSize: 14 }}>warning</span>
                    )}
                    ThingSpeak Connection
                  </h4>
                  <input type="text" placeholder="Channel ID (e.g. 3212670)"
                    value={localCfg.thingspeakChannelId}
                    onChange={e => patch({ thingspeakChannelId: e.target.value })}
                    className="ios-input font-mono text-xs" />
                  <input type="password" placeholder="Read API Key (leave blank to keep existing)"
                    value={localCfg.thingspeakReadKey}
                    onChange={e => patch({ thingspeakReadKey: e.target.value })}
                    className="ios-input font-mono text-xs" />
                </div>

                {/* Segmented control: Overhead / Sump */}
                <div className="flex rounded-[14px] p-1 text-[13px] font-semibold relative" style={{ background: 'rgba(0,0,0,0.05)' }}>
                  {(['rectangular', 'sump'] as const).map((shape) => {
                    const isActive = localCfg.tankShape === shape || (shape === 'rectangular' && localCfg.tankShape === 'cylindrical');
                    return (
                      <button key={shape} type="button"
                        onClick={() => patch({ tankShape: shape })}
                        className="flex-1 py-2 rounded-[10px] transition-all"
                        style={{
                          border: isActive ? '1px solid rgba(0,0,0,0.05)' : 'none',
                          background: isActive ? 'rgba(255,255,255,0.9)' : 'transparent',
                          color: isActive ? '#1C1C1E' : '#8E8E93',
                          boxShadow: isActive ? '0 3px 8px rgba(0,0,0,0.12)' : 'none',
                          cursor: 'pointer',
                          fontWeight: 600,
                          fontSize: 13,
                        }}>
                        {shape === 'rectangular' ? 'Overhead' : 'Sump'}
                      </button>
                    );
                  })}
                </div>

                {/* Dimensions */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider m-0 ml-1" style={{ color: '#8E8E93' }}>Dimensions</h4>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: 'Length (m)', val: localCfg.lengthM, key: 'lengthM' as const, hidden: localCfg.tankShape === 'cylindrical' },
                      { label: 'Breadth (m)', val: localCfg.breadthM, key: 'breadthM' as const, hidden: localCfg.tankShape === 'cylindrical' },
                      { label: localCfg.tankShape === 'cylindrical' ? 'Radius (m)' : 'Height (m)', val: localCfg.tankShape === 'cylindrical' ? localCfg.radiusM : localCfg.heightM, key: localCfg.tankShape === 'cylindrical' ? 'radiusM' as const : 'heightM' as const, hidden: false },
                    ].filter(f => !f.hidden).map(f => (
                      <div key={f.key} className="flex flex-col gap-1.5">
                        <label className="text-xs font-medium ml-1" style={{ color: '#8E8E93', fontSize: 11 }}>{f.label}</label>
                        <input type="number" step="0.1" min="0.01" value={f.val}
                          onChange={e => patch({ [f.key]: parseFloat(e.target.value) || 0 })}
                          className="ios-input" />
                      </div>
                    ))}
                  </div>

                  {/* Capacity override */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium ml-1" style={{ color: '#8E8E93', fontSize: 11 }}>Capacity Override (L)</label>
                    <div className="relative">
                      <input type="number" min="0" step="100"
                        value={localCfg.capacityOverrideLitres ?? 0}
                        onChange={e => { const v = parseFloat(e.target.value) || 0; patch({ capacityOverrideLitres: v > 0 ? v : null }); }}
                        className="ios-input pr-10" />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-semibold" style={{ color: '#8E8E93' }}>L</span>
                    </div>
                  </div>

                  {/* Calculated max */}
                  <div className="rounded-xl px-3 py-2 text-sm font-semibold" style={{ background: 'rgba(10,132,255,0.08)', color: '#0A84FF' }}>
                    Calculated Max: <strong>{formatVolume(previewCapacity)}</strong>
                  </div>
                </div>

                {saveError && (
                  <p className="text-xs font-semibold m-0" style={{ color: '#FF3B30' }}>⚠ {saveError}</p>
                )}

                {/* Save button */}
                <div className="mt-auto pt-2">
                  <button onClick={handleSave} disabled={!cfgDirty || saving}
                    className="w-full font-semibold py-3.5 rounded-2xl transition-transform hover:scale-[0.98] active:scale-[0.96] flex items-center justify-center gap-2"
                    style={{
                      background: cfgDirty ? '#1C1C1E' : 'rgba(0,0,0,0.08)',
                      color: cfgDirty ? '#fff' : '#8E8E93',
                      border: 'none',
                      cursor: cfgDirty && !saving ? 'pointer' : 'default',
                      boxShadow: cfgDirty ? '0 4px 16px rgba(0,0,0,0.2)' : 'none',
                    }}>
                    <span className="material-symbols-rounded" style={{ fontSize: 18 }}>{saving ? 'sync' : 'save'}</span>
                    {saving ? 'Saving…' : 'Save Configuration'}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* ── Historical section ── */}
          <section>
            <div className="flex items-center justify-between mb-4 px-1">
              <h3 className="text-xl font-semibold m-0 flex items-center gap-2">
                Trends
                <span className="relative flex ml-1" style={{ width: 8, height: 8 }}>
                  <span className="absolute inset-0 rounded-full" style={{ background: '#0A84FF', animation: 'ping 1.5s cubic-bezier(0,0,0.2,1) infinite', opacity: 0.75 }} />
                  <span className="relative block rounded-full w-full h-full" style={{ background: '#0A84FF' }} />
                </span>
              </h3>
              {/* Time range indicator */}
              <div className="flex text-xs font-semibold rounded-xl p-1" style={{ background: 'rgba(0,0,0,0.05)' }}>
                {['24H', '7D', '30D'].map((t, i) => (
                  <span key={t} className="px-4 py-1.5 rounded-lg"
                    style={i === 0 ? { background: 'rgba(255,255,255,0.9)', color: '#1C1C1E', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' } : { color: '#8E8E93' }}>
                    {t}
                  </span>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

              {/* ── Level History chart ── */}
              <div className="apple-glass-card rounded-[2rem] p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h4 className="text-base font-semibold m-0 flex items-center gap-2">
                      Tank Level
                      <span className="px-2 py-0.5 rounded text-[9px] uppercase tracking-wider font-bold"
                        style={{ background: 'rgba(10,132,255,0.1)', color: '#0A84FF' }}>Live</span>
                    </h4>
                    <p className="text-xs m-0 mt-0.5" style={{ color: '#8E8E93' }}>Real-time tank capacity %</p>
                  </div>
                  <div className="flex items-center justify-center rounded-full"
                    style={{ width: 40, height: 40, background: 'rgba(10,132,255,0.1)', color: '#0A84FF' }}>
                    <span className="material-symbols-rounded">water</span>
                  </div>
                </div>

                {historyLoading ? (
                  <div className="flex items-center justify-center" style={{ height: 240, color: '#8E8E93', fontSize: 13, fontWeight: 600 }}>
                    Analyzing historical trends…
                  </div>
                ) : levelChartData.length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-3" style={{ height: 240 }}>
                    <span className="material-symbols-rounded" style={{ fontSize: 36, color: '#C7C7CC' }}>water_drop</span>
                    <p className="text-sm font-semibold m-0" style={{ color: '#8E8E93' }}>No level data yet</p>
                    {deviceConfig && !deviceConfig.thingspeak_channel_id ? (
                      <p className="text-xs font-semibold m-0 text-center px-6 rounded-xl py-2"
                        style={{ background: 'rgba(255,149,0,0.1)', color: '#FF9500' }}>
                        ⚠ No ThingSpeak channel configured for this device.
                        Go to Admin → Infrastructure and update the Channel ID &amp; Read Key.
                      </p>
                    ) : (
                      <p className="text-xs font-medium m-0 text-center px-4" style={{ color: '#C7C7CC' }}>
                        Waiting for first telemetry ingestion. Data will appear once ThingSpeak returns feeds.
                      </p>
                    )}
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={240}>
                    <AreaChart data={levelChartData.slice(-24)} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="tankLevelGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#0A84FF" stopOpacity={0.35} />
                          <stop offset="95%" stopColor="#0A84FF" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" vertical={false} />
                      <XAxis
                        dataKey="time"
                        tick={{ fontSize: 10, fontWeight: 600, fill: '#8E8E93' }}
                        axisLine={false} tickLine={false}
                        interval="preserveStartEnd"
                      />
                      <YAxis
                        domain={[0, 100]}
                        tick={{ fontSize: 10, fontWeight: 600, fill: '#8E8E93' }}
                        axisLine={false} tickLine={false}
                        tickFormatter={(v: number) => `${v}%`}
                        width={38}
                        ticks={[0, 25, 50, 75, 100]}
                      />
                      <Tooltip
                        contentStyle={{
                          background: 'rgba(255,255,255,0.95)',
                          border: 'none',
                          borderRadius: 12,
                          boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                          fontSize: 12,
                          fontWeight: 600,
                        }}
                        formatter={(v: number) => [`${v}%`, 'Level']}
                        labelStyle={{ color: '#8E8E93', fontSize: 11 }}
                      />
                      <Area
                        type="monotone"
                        dataKey="level"
                        stroke="#0A84FF"
                        strokeWidth={2.5}
                        fill="url(#tankLevelGrad)"
                        dot={false}
                        activeDot={{ r: 5, fill: '#0A84FF', stroke: '#fff', strokeWidth: 2 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* ── Volume Usage chart ── */}
              <div className="apple-glass-card rounded-[2rem] p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h4 className="text-base font-semibold m-0">Volume Usage</h4>
                    <p className="text-xs m-0 mt-0.5" style={{ color: '#8E8E93' }}>
                      Volume in {volUnit} · {volumeChartData.length} data points
                    </p>
                  </div>
                  <div className="flex items-center justify-center rounded-full"
                    style={{ width: 40, height: 40, background: 'rgba(255,149,0,0.1)', color: '#FF9500' }}>
                    <span className="material-symbols-rounded">water_full</span>
                  </div>
                </div>

                {historyLoading ? (
                  <div className="flex items-center justify-center" style={{ height: 240, color: '#8E8E93', fontSize: 13, fontWeight: 600 }}>
                    Calculating volumetric data…
                  </div>
                ) : volumeChartData.length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-2" style={{ height: 240 }}>
                    <span className="material-symbols-rounded" style={{ fontSize: 36, color: '#C7C7CC' }}>opacity</span>
                    <p className="text-sm font-semibold m-0" style={{ color: '#8E8E93' }}>No volume data yet</p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={240}>
                    <AreaChart data={volumeChartData.slice(-24)} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="tankVolGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#FF9500" stopOpacity={0.35} />
                          <stop offset="95%" stopColor="#FF9500" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" vertical={false} />
                      <XAxis
                        dataKey="time"
                        tick={{ fontSize: 10, fontWeight: 600, fill: '#8E8E93' }}
                        axisLine={false} tickLine={false}
                        interval="preserveStartEnd"
                      />
                      <YAxis
                        tick={{ fontSize: 10, fontWeight: 600, fill: '#8E8E93' }}
                        axisLine={false} tickLine={false}
                        tickFormatter={(v: number) =>
                          volDivisor === 1000
                            ? `${(v / 1000).toFixed(1)} KL`
                            : `${v} L`
                        }
                        width={52}
                      />
                      <Tooltip
                        contentStyle={{
                          background: 'rgba(255,255,255,0.95)',
                          border: 'none',
                          borderRadius: 12,
                          boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                          fontSize: 12,
                          fontWeight: 600,
                        }}
                        formatter={(v: number) => [
                          volDivisor === 1000
                            ? `${(v / 1000).toFixed(2)} KL`
                            : `${v} L`,
                          'Volume',
                        ]}
                        labelStyle={{ color: '#8E8E93', fontSize: 11 }}
                      />
                      <Area
                        type="monotone"
                        dataKey="volume"
                        stroke="#FF9500"
                        strokeWidth={2.5}
                        fill="url(#tankVolGrad)"
                        dot={false}
                        activeDot={{ r: 5, fill: '#FF9500', stroke: '#fff', strokeWidth: 2 }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </section>


        </div>
      </main>

      <footer className="mt-8 py-8 text-center text-sm font-medium"
        style={{ borderTop: '1px solid rgba(0,0,0,0.05)', color: '#8E8E93', backdropFilter: 'blur(8px)' }}>
        <p className="m-0">© {new Date().getFullYear()} EvaraTank Systems
          <span className="mx-2" style={{ color: '#C7C7CC' }}>|</span>
          <a href="mailto:support@evaratech.in" className="hover:text-[#FF9500] transition-colors" style={{ color: 'inherit' }}>Support &amp; Docs</a>
        </p>
      </footer>
    </div>
  );
};

export default EvaraTankAnalytics;

