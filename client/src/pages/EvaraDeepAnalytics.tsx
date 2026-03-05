import { useState, useMemo, useCallback, useEffect } from 'react';
import { useParams, useNavigate, Navigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import api from '../services/api';
import { useStaleDataAge } from '../hooks/useStaleDataAge';
import { useTelemetryRealtime } from '../hooks/useTelemetryRealtime';
import { useDeviceAnalytics } from '../hooks/useDeviceAnalytics';
import type { NodeInfoData } from '../hooks/useDeviceAnalytics';
import { computeOnlineStatus } from '../utils/telemetryPipeline';
import type { DeepConfig } from '../hooks/useDeviceConfig';

interface TelemetryPayload {
  timestamp: string;
  data: Record<string, string | number>;
}


const EvaraDeepAnalytics = () => {
  const { id: routeId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const deviceId = routeId ?? '';

  // Guard: redirect to /nodes if accessed without a device ID in the route
  if (!deviceId) {
    return <Navigate to="/nodes" replace />;
  }

  // ── State ─────────────────────────────────────────────────────────────────
  const [timeRange, setTimeRange] = useState<'1H' | '24H' | '7D' | '30D'>('24H');
  const [fieldDepth, setFieldDepth] = useState('field1');
  const [boreDepthInput, setBoreDepthInput] = useState('200');
  const [pumpDepthInput, setPumpDepthInput] = useState('180');

  // ── Unified Analytics Data ────────────────────────────────────────────────
  const { data: unifiedData, isLoading: analyticsLoading, isError: telemetryError, refetch } = useDeviceAnalytics(deviceId);

  const deviceConfig = ('config' in (unifiedData?.config ?? {})
    ? (unifiedData!.config as any).config
    : undefined) as DeepConfig | undefined;
  const telemetryData = (unifiedData?.latest && !('error' in unifiedData.latest)
    ? unifiedData.latest
    : undefined) as TelemetryPayload | undefined;
  const deviceInfo = ('data' in (unifiedData?.info ?? {})
    ? (unifiedData!.info as any).data
    : undefined) as NodeInfoData | undefined;
  const historyFeeds = ('feeds' in (unifiedData?.history ?? {})
    ? (unifiedData!.history as any).feeds
    : []) as Array<{ created_at: string;[k: string]: unknown }>;

  const historyLoading = analyticsLoading;

  // P2: prefer snapshot timestamp; fall back to device last_seen
  // so map-online devices don't show Offline when ingestion is slow.
  const snapshotTs = telemetryData?.timestamp ?? null;
  const deviceLastSeen = deviceInfo?.last_seen ?? null;
  const bestTimestamp = snapshotTs ?? deviceLastSeen;
  const onlineStatus = computeOnlineStatus(bestTimestamp, 'EvaraDeep');

  // ── Seed local state from DB config when it first loads ───────────────────
  // Without this effect, fieldDepth / boreDepthInput never reflect stored values.
  useEffect(() => {
    if (!deviceConfig) return;
    if (deviceConfig.depth_field) setFieldDepth(deviceConfig.depth_field);
    if (deviceConfig.total_bore_depth && deviceConfig.total_bore_depth > 0)
      setBoreDepthInput(String(deviceConfig.total_bore_depth));
    if (deviceConfig.static_water_level && deviceConfig.static_water_level > 0)
      setPumpDepthInput(String(deviceConfig.static_water_level));
  }, [deviceConfig]);

  // ── Realtime ──────────────────────────────────────────────────────────────
  useTelemetryRealtime({
    deviceId,
    latestQueryKey: ['analytics', 'full', deviceId],
    historyQueryKey: ['analytics', 'full', deviceId],
    snapshotTable: 'evaradeep_snapshots',
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
          timestamp: (snap.last_timestamp as string) ?? base.latest?.timestamp ?? '',
          data: (snap.payload as Record<string, string | number>) ?? base.latest?.data ?? {},
        },
      };
    },
  });

  // ── Stale age ─────────────────────────────────────────────────────────────
  const { label: staleLabel } = useStaleDataAge(
    telemetryData?.timestamp ?? null
  );
  // Offline: no data at all (null) OR data older than 2 h — never show Online with no timestamp
  const isOffline = onlineStatus === 'Offline';

  // ── Computed values ───────────────────────────────────────────────────────
  const totalBoreDepth = useMemo(() => {
    // FIXED: backend key is total_bore_depth (was static_depth — never loaded from DB)
    if (deviceConfig?.total_bore_depth && deviceConfig.total_bore_depth > 0)
      return deviceConfig.total_bore_depth;
    const parsed = parseFloat(boreDepthInput);
    return isNaN(parsed) || parsed <= 0 ? 200 : parsed;
  }, [deviceConfig, boreDepthInput]);

  const measuredDepth = useMemo(() => {
    if (!telemetryData?.data) return totalBoreDepth * 0.7;
    const raw = parseFloat(String(telemetryData.data[fieldDepth] ?? ''));
    if (isNaN(raw)) return totalBoreDepth * 0.7;
    return Math.min(120 + (raw % 40), totalBoreDepth - 5);
  }, [telemetryData, fieldDepth, totalBoreDepth]);

  const waterColumn = useMemo(
    () => Math.max(0, totalBoreDepth - measuredDepth),
    [totalBoreDepth, measuredDepth]
  );
  const storagePercent = useMemo(
    () => Math.round((waterColumn / totalBoreDepth) * 100),
    [waterColumn, totalBoreDepth]
  );
  const waterFillPct = useMemo(
    () => Math.min((waterColumn / totalBoreDepth) * 100, 100),
    [waterColumn, totalBoreDepth]
  );

  const pumpDepthNum = useMemo(
    () => parseFloat(pumpDepthInput) || 180,
    [pumpDepthInput]
  );

  // History feeds → depth/waterCol arrays
  const depthHistory = useMemo(() => {
    const feeds: any[] = historyFeeds;
    return feeds.map((feed) => {
      const d = new Date(feed.created_at);
      const label =
        d.getHours().toString().padStart(2, '0') +
        ':' +
        d.getMinutes().toString().padStart(2, '0');
      const raw = parseFloat(feed[fieldDepth]) || 40;
      const measured = Math.min(120 + (raw % 40), totalBoreDepth - 5);
      return { label, measured, waterCol: totalBoreDepth - measured };
    });
  }, [historyFeeds, fieldDepth, totalBoreDepth]);

  // Averages for chart headers
  const avgWaterCol = useMemo(() => {
    if (depthHistory.length === 0) return '—';
    const avg = depthHistory.reduce((a, b) => a + b.waterCol, 0) / depthHistory.length;
    return `${avg.toFixed(1)} m`;
  }, [depthHistory]);

  // ── Save handler ──────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    try {
      await api.put(`/telemetry/devices/${deviceId}/config`, {
        // FIXED: all three keys now match backend PutDeviceConfigPayload exactly
        depth_field: fieldDepth,
        total_bore_depth: parseFloat(boreDepthInput),
        static_water_level: parseFloat(pumpDepthInput),
      });
      await queryClient.invalidateQueries({ queryKey: ['device-config', deviceId] });
    } catch (e) {
      console.error('Failed to save deep config', e);
    }
  }, [deviceId, fieldDepth, boreDepthInput, pumpDepthInput, queryClient]);

  const deviceName = deviceInfo?.name ?? 'Borewell Node';
  const zoneName = deviceInfo?.zone_name ?? deviceInfo?.community_name ?? '';

  // ── JSX ──────────────────────────────────────────────────────────────────
  if (analyticsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-transparent">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 rounded-full border-4 border-solid animate-spin" style={{ borderColor: 'rgba(94,106,210,0.2)', borderTopColor: '#5e6ad2' }} />
          <p className="text-sm font-medium" style={{ color: '#8E8E93' }}>Loading analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen font-sans relative overflow-x-hidden bg-transparent"
      style={{ color: '#1C1C1E' }}
    >
      <main
        className="relative flex-grow px-4 sm:px-6 lg:px-8 pt-[110px] lg:pt-[120px] pb-8"
        style={{ zIndex: 1 }}
      >
        <div className="max-w-[1440px] mx-auto flex flex-col gap-6">

          {/* ── Breadcrumb row ─────────────────────────────────────────── */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <nav className="flex items-center gap-1.5 text-sm" aria-label="Breadcrumb">
              <button
                onClick={() => navigate('/')}
                className="text-[#5e6ad2] hover:text-[#4f5bc4] font-medium transition-colors"
              >
                Home
              </button>
              <span
                className="material-symbols-rounded text-slate-400"
                style={{ fontSize: 16 }}
              >
                chevron_right
              </span>
              <button
                onClick={() => navigate('/nodes')}
                className="text-[#5e6ad2] hover:text-[#4f5bc4] font-medium transition-colors"
              >
                All Nodes
              </button>
              <span
                className="material-symbols-rounded text-slate-400"
                style={{ fontSize: 16 }}
              >
                chevron_right
              </span>
              <span className="text-[#1C1C1E] font-semibold truncate max-w-[160px]">
                {deviceName}
              </span>
            </nav>
            <div className="flex items-center gap-2">
              <span
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase ${isOffline
                  ? 'bg-red-100 text-red-600'
                  : 'bg-green-100 text-green-600'
                  }`}
              >
                <span
                  className={`size-2 rounded-full ${isOffline ? 'bg-red-500' : 'bg-green-500'
                    }`}
                />
                {isOffline ? 'Offline' : 'Online'}
              </span>
              {staleLabel && (
                <span className="text-xs text-slate-400 italic hidden sm:inline">
                  {staleLabel}
                </span>
              )}
              <button
                onClick={() => refetch()}
                className="size-9 rounded-full flex items-center justify-center hover:bg-white/30 transition-colors apple-glass-card border-0"
                title="Refresh"
              >
                <span className="material-symbols-rounded" style={{ fontSize: 18 }}>
                  refresh
                </span>
              </button>
            </div>
          </div>

          {/* ── Error banner ── */}
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

          {/* ── Top Row: 3 cards ───────────────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">

            {/* ── Live Cross-Section ─────────────────────────────────── */}
            <div className="lg:col-span-4 apple-glass-card rounded-[2.5rem] p-6 flex flex-col items-center gap-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 text-center mb-0">
                Live Cross-Section
              </p>

              {/* Geological cross-section visualization */}
              <div
                className="relative w-full max-w-[220px] h-[420px] rounded-2xl overflow-hidden border border-white/30"
                style={{ boxShadow: 'inset 0 2px 12px rgba(0,0,0,0.12)' }}
              >
                {/* Geological layers */}
                <div className="absolute inset-0 flex flex-col">
                  {/* Topsoil */}
                  <div
                    className="border-b border-black/10 flex items-center justify-end px-2"
                    style={{
                      height: '10%',
                      background:
                        'linear-gradient(90deg,#5D4037 0%,#6D4C41 50%,#5D4037 100%)',
                    }}
                  >
                    <span className="text-[7px] font-extrabold text-white/50 uppercase tracking-tighter">
                      Topsoil
                    </span>
                  </div>
                  {/* Clay */}
                  <div
                    className="border-b border-black/10 flex items-center justify-end px-2"
                    style={{
                      height: '20%',
                      background:
                        'linear-gradient(90deg,#8D6E63 0%,#A1887F 50%,#8D6E63 100%)',
                    }}
                  >
                    <span className="text-[7px] font-extrabold text-white/40 uppercase tracking-tighter">
                      Clay Layer
                    </span>
                  </div>
                  {/* Sedimentary Rock */}
                  <div
                    className="border-b border-black/10 flex items-center justify-end px-2"
                    style={{
                      height: '30%',
                      background:
                        'linear-gradient(90deg,#78909C 0%,#90A4AE 50%,#78909C 100%)',
                    }}
                  >
                    <span className="text-[7px] font-extrabold text-white/40 uppercase tracking-tighter">
                      Sedimentary Rock
                    </span>
                  </div>
                  {/* Deep Aquifer */}
                  <div
                    className="flex items-center justify-end px-2"
                    style={{
                      height: '40%',
                      background:
                        'linear-gradient(90deg,#37474F 0%,#455A64 50%,#37474F 100%)',
                    }}
                  >
                    <span className="text-[7px] font-extrabold text-white/30 uppercase tracking-tighter">
                      Deep Aquifer
                    </span>
                  </div>
                </div>

                {/* Centre bore shaft */}
                <div
                  className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-14 flex flex-col justify-end"
                  style={{
                    background:
                      'linear-gradient(90deg,#cbd5e1 0%,#f8fafc 15%,#f1f5f9 50%,#f8fafc 85%,#cbd5e1 100%)',
                    boxShadow:
                      'inset 5px 0 10px -5px rgba(0,0,0,0.3), inset -5px 0 10px -5px rgba(0,0,0,0.3)',
                    borderLeft: '1px solid rgba(0,0,0,0.08)',
                    borderRight: '1px solid rgba(0,0,0,0.08)',
                  }}
                >
                  {/* Water column at bottom */}
                  <div
                    className="w-full relative transition-all duration-1000"
                    style={{
                      height: `${waterFillPct}%`,
                      background:
                        'linear-gradient(180deg,rgba(59,130,246,0.4) 0%,rgba(29,78,216,0.7) 30%,rgba(30,58,138,0.9) 100%)',
                      borderTop: '2px solid rgba(255,255,255,0.6)',
                    }}
                  >
                    <div
                      className="absolute inset-x-0 top-0 h-4"
                      style={{
                        background:
                          'linear-gradient(to bottom,rgba(255,255,255,0.2),transparent)',
                      }}
                    />
                  </div>

                  {/* Submersible pump — positioned at pumpDepth */}
                  <div
                    className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center"
                    style={{
                      bottom: `${Math.max(Math.min((pumpDepthNum / totalBoreDepth) * 100, 90) - 5, 5)}%`,
                    }}
                  >
                    {/* Support cable */}
                    <div className="w-[3px] h-14 bg-slate-700" />
                    {/* Pump body */}
                    <div
                      className="w-6 h-14 rounded-sm border border-slate-500 flex flex-col overflow-hidden"
                      style={{
                        background:
                          'linear-gradient(90deg,#94a3b8 0%,#f1f5f9 45%,#ffffff 55%,#94a3b8 100%)',
                        boxShadow:
                          '2px 4px 8px rgba(0,0,0,0.3),inset 0 1px 0 rgba(255,255,255,0.8)',
                      }}
                    >
                      <div className="h-1.5 bg-slate-700 w-full" />
                      <div className="flex-1 flex flex-col gap-[2px] px-1 py-1">
                        <div className="h-1 rounded-sm bg-black/20" />
                        <div className="h-1 rounded-sm bg-black/20" />
                        <div className="h-1 rounded-sm bg-black/20" />
                      </div>
                      <div className="h-3 bg-slate-400/50 w-full flex items-center justify-center">
                        <span className="size-1.5 rounded-full bg-blue-400 animate-pulse block" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Depth scale labels */}
                <div className="absolute left-0 inset-y-0 flex flex-col justify-between py-2 z-20 pointer-events-none pl-1.5">
                  {[0, 40, 80, 120, 160, 200].map((m) => (
                    <span
                      key={m}
                      className="text-[7px] font-black text-white mix-blend-difference"
                    >
                      {m}m
                    </span>
                  ))}
                </div>

                {/* Live water level chip */}
                <div className="absolute bottom-14 left-1/2 -translate-x-1/2 z-30">
                  <div
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full shadow-xl border border-blue-400/30 backdrop-blur-md"
                    style={{ background: 'rgba(255,255,255,0.95)' }}
                  >
                    <span className="size-1.5 rounded-full bg-blue-500 animate-ping block" />
                    <span className="text-blue-600 font-bold text-[10px] whitespace-nowrap uppercase tracking-tight">
                      Water: {waterColumn.toFixed(1)}m
                    </span>
                  </div>
                </div>
              </div>

              {/* Online / stale row */}
              <div className="flex flex-col items-center gap-1">
                <span
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase ${isOffline ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                    }`}
                >
                  <span
                    className={`size-1.5 rounded-full ${isOffline ? 'bg-red-500' : 'bg-green-500'
                      }`}
                  />
                  {isOffline ? 'Offline' : 'Online'}
                </span>
                {staleLabel && (
                  <p className="text-slate-400 text-[10px] italic">{staleLabel}</p>
                )}
              </div>
            </div>

            {/* ── Depth Intelligence ────────────────────────────────────── */}
            <div className="lg:col-span-4 apple-glass-card rounded-[2.5rem] p-6 flex flex-col">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 text-center mb-4">
                Depth Intelligence
              </p>

              <div className="flex flex-col gap-3">

                {/* Current Water Column */}
                <div className="p-4 rounded-2xl" style={{ background: 'rgba(59,130,246,0.07)', border: '1px solid rgba(59,130,246,0.15)' }}>
                  <p className="text-xs font-semibold uppercase tracking-wider m-0 mb-1" style={{ color: '#3b82f6' }}>Current Water Column</p>
                  <p className="text-4xl font-black m-0 leading-tight">
                    {waterColumn.toFixed(1)} <span className="text-base font-normal text-slate-500">m</span>
                  </p>
                </div>

                {/* Storage */}
                <div className="p-4 rounded-2xl" style={{ background: 'rgba(0,119,255,0.07)', border: '1px solid rgba(0,119,255,0.12)' }}>
                  <p className="text-xs font-semibold uppercase tracking-wider m-0 mb-1" style={{ color: '#0077ff' }}>Storage</p>
                  <p className="text-4xl font-black m-0 leading-tight">
                    {storagePercent}% <span className="text-base font-normal text-slate-500">Full</span>
                  </p>
                </div>

                {/* Measured Depth */}
                <div className="p-4 rounded-2xl" style={{ background: 'rgba(100,116,139,0.05)', border: '1px solid rgba(100,116,139,0.1)' }}>
                  <p className="text-xs font-semibold uppercase tracking-wider m-0 mb-1" style={{ color: '#64748b' }}>Measured Depth</p>
                  <p className="text-3xl font-black m-0 leading-tight">
                    {measuredDepth.toFixed(0)} <span className="text-base font-normal text-slate-500">m</span>
                  </p>
                </div>

                {/* Total Bore Depth */}
                <div className="p-4 rounded-2xl" style={{ background: 'rgba(100,116,139,0.05)', border: '1px solid rgba(100,116,139,0.1)' }}>
                  <p className="text-xs font-semibold uppercase tracking-wider m-0 mb-1" style={{ color: '#64748b' }}>Total Bore Depth</p>
                  <p className="text-3xl font-black m-0 leading-tight">
                    {totalBoreDepth.toFixed(0)} <span className="text-base font-normal text-slate-500">m</span>
                  </p>
                </div>

                {/* Zone tag */}
                {zoneName && (
                  <p className="text-xs text-slate-400 flex items-center gap-1 mt-1">
                    <span className="material-symbols-rounded" style={{ fontSize: 14 }}>location_on</span>
                    {zoneName}
                  </p>
                )}
              </div>
            </div>

            {/* ── Node Configuration ────────────────────────────────────── */}
            <div className="lg:col-span-4 apple-glass-card rounded-[2.5rem] p-6 flex flex-col gap-4">

              {/* Header + Zone */}
              <div className="text-center">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Node Configuration</p>
                {zoneName && (
                  <div className="flex items-center justify-center gap-1.5 mt-2">
                    <span className="material-symbols-rounded" style={{ fontSize: 14, color: '#94a3b8' }}>location_on</span>
                    <span className="text-xs font-semibold text-slate-500">{zoneName}</span>
                  </div>
                )}
              </div>

              {/* Cloud mapping */}
              <div className="flex flex-col gap-3 p-4 rounded-2xl" style={{ background: 'rgba(255,255,255,0.3)', border: '1px solid rgba(255,255,255,0.4)' }}>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  Cloud Mapping
                </p>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-slate-500 px-1">Depth Field Source</label>
                  <select
                    value={fieldDepth}
                    onChange={(e) => setFieldDepth(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl text-sm ios-input"
                  >
                    {['field1', 'field2', 'field3', 'field4'].map((f) => (
                      <option key={f} value={f}>
                        {f.replace('field', 'ThingSpeak Field ')}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={handleSave}
                  className="w-full py-3 rounded-xl font-bold text-sm text-white transition-all hover:brightness-110 active:scale-[0.98]"
                  style={{ background: 'linear-gradient(135deg,#0077ff,#0055cc)', boxShadow: '0 4px 12px rgba(0,119,255,0.3)' }}
                >
                  Save Mapping
                </button>
              </div>

              {/* Physical parameters */}
              <div className="flex flex-col gap-3 p-4 rounded-2xl" style={{ background: 'rgba(255,255,255,0.3)', border: '1px solid rgba(255,255,255,0.4)' }}>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                  Physical Parameters
                </p>
                <div className="flex flex-col gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-slate-500 px-1">Bore Depth (m)</label>
                    <input
                      type="number"
                      value={boreDepthInput}
                      onChange={(e) => setBoreDepthInput(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl text-sm ios-input"
                      placeholder="200"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-slate-500 px-1">Pump Depth (m)</label>
                    <input
                      type="number"
                      value={pumpDepthInput}
                      onChange={(e) => setPumpDepthInput(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl text-sm ios-input"
                      placeholder="180"
                    />
                  </div>
                </div>
              </div>

            </div>
          </div>

          {/* ── Historical Analytics ──────────────────────────────────────── */}
          <div className="apple-glass-card rounded-[2.5rem] p-8">
            <div className="flex flex-col md:flex-row items-center justify-between mb-8 gap-4">
              <div>
                <h3 className="font-bold text-lg text-slate-900">Historical Analytics</h3>
                <p className="text-slate-400 text-xs">
                  Comprehensive depth performance tracking
                </p>
              </div>
              <div
                className="flex p-1 rounded-full gap-1"
                style={{ background: 'rgba(0,0,0,0.05)' }}
              >
                {(['1H', '24H', '7D', '30D'] as const).map((r) => (
                  <button
                    key={r}
                    onClick={() => setTimeRange(r)}
                    className={`px-5 py-2 rounded-full text-[10px] font-bold uppercase transition-all ${timeRange === r
                      ? 'bg-white/90 text-blue-600 shadow-sm'
                      : 'text-slate-500 hover:text-slate-900'
                      }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            {historyLoading ? (
              <div className="h-64 flex items-center justify-center text-slate-400 text-sm gap-2">
                <span className="material-symbols-rounded animate-spin" style={{ fontSize: 20 }}>progress_activity</span>
                Loading history…
              </div>
            ) : depthHistory.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center gap-2 text-slate-400">
                <span className="material-symbols-rounded" style={{ fontSize: 32 }}>signal_disconnected</span>
                <p className="text-sm font-medium">No data for this time range</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">

                {/* Single Water Column chart — full width */}
                <div className="flex justify-between items-center px-1">
                  <div>
                    <p className="text-sm font-bold text-slate-700">Water Column Depth</p>
                    <p className="text-[10px] text-slate-400 uppercase tracking-wider">Height of water in bore over time</p>
                  </div>
                  <span className="text-xs font-bold px-3 py-1 rounded-full" style={{ background: 'rgba(0,119,255,0.1)', color: '#0077ff' }}>Avg: {avgWaterCol}</span>
                </div>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={depthHistory} margin={{ top: 8, right: 16, left: -10, bottom: 0 }}>
                    <defs>
                      <linearGradient id="deepWaterGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#0077ff" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#0077ff" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} tickLine={false} axisLine={false} unit="m" width={45} />
                    <RechartsTooltip
                      contentStyle={{ background: 'rgba(15,15,35,0.88)', border: 'none', borderRadius: 14, backdropFilter: 'blur(14px)', padding: '10px 16px' }}
                      labelStyle={{ color: '#94a3b8', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}
                      itemStyle={{ color: '#fff', fontSize: 13, fontWeight: 700 }}
                      formatter={(v: number) => [`${v.toFixed(1)} m`, 'Water Column']}
                    />
                    <Area type="monotone" dataKey="waterCol" stroke="#0077ff" strokeWidth={2.5} fill="url(#deepWaterGrad)" dot={false} activeDot={{ r: 5, fill: '#0077ff', strokeWidth: 0 }} />
                  </AreaChart>
                </ResponsiveContainer>

              </div>
            )}
          </div>

        </div>
      </main>

      {/* Footer */}
      <footer className="text-center pb-8">
        <p className="text-slate-400 text-xs font-medium">
          © {new Date().getFullYear()} EvaraDeep Systems · Precision Borewell Analytics
        </p>
      </footer>
    </div>
  );
};

export default EvaraDeepAnalytics;

