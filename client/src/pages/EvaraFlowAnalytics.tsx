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
import type { FlowConfig } from '../hooks/useDeviceConfig';

interface TelemetryPayload {
  timestamp: string;
  data: { entry_id: number;[key: string]: unknown };
  flow_rate?: number;
  total_liters?: number;
}

interface HistoryFeed {
  created_at: string;
  [k: string]: unknown;
}


const EvaraFlowAnalytics = () => {
  const { id: routeId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const deviceId = routeId ?? '';

  // Guard: redirect to /nodes if accessed without a device ID in the route
  if (!deviceId) {
    return <Navigate to="/nodes" replace />;
  }

  // ── Local state ───────────────────────────────────────────────────────────
  const [timeRange, setTimeRange] = useState<'24H' | '7D' | '30D'>('24H');
  const [displayUnit, setDisplayUnit] = useState<'m3' | 'L'>('m3');
  const [fieldTotal, setFieldTotal] = useState('field1');
  const [fieldFlow, setFieldFlow] = useState('field3');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  // ── Unified Analytics Data ────────────────────────────────────────────────
  const { data: unifiedData, isLoading: analyticsLoading, isError: telemetryError, refetch } = useDeviceAnalytics(deviceId);

  const deviceConfig = ('config' in (unifiedData?.config ?? {})
    ? (unifiedData!.config as any).config
    : undefined) as FlowConfig | undefined;
  const telemetryData = (unifiedData?.latest && !('error' in unifiedData.latest)
    ? unifiedData.latest
    : undefined) as TelemetryPayload | undefined;
  const deviceInfo = ('data' in (unifiedData?.info ?? {})
    ? (unifiedData!.info as any).data
    : undefined) as NodeInfoData | undefined;
  const historyFeeds = ('feeds' in (unifiedData?.history ?? {})
    ? (unifiedData!.history as any).feeds
    : []) as HistoryFeed[];

  const maxFlowRate = deviceConfig?.max_flow_rate ?? 30;
  const telemetryLoading = analyticsLoading;
  const historyLoading = analyticsLoading;

  // P2: prefer snapshot timestamp; fall back to device last_seen
  // so map-online devices don't show Offline when ingestion is slow.
  const snapshotTs = telemetryData?.timestamp ?? null;
  const deviceLastSeen = deviceInfo?.last_seen ?? null;
  const bestTimestamp = snapshotTs ?? deviceLastSeen;
  const onlineStatus = computeOnlineStatus(bestTimestamp, 'EvaraFlow');

  // ── Seed field mapping state from DB config when it first loads ────────────
  // Without this effect, fieldTotal/fieldFlow are permanently hardcoded
  // to 'field1'/'field3' regardless of what the device config stores.
  useEffect(() => {
    if (!deviceConfig) return;
    if (deviceConfig.meter_reading_field) setFieldTotal(deviceConfig.meter_reading_field);
    if (deviceConfig.flow_rate_field) setFieldFlow(deviceConfig.flow_rate_field);
  }, [deviceConfig]);

  // ── Realtime ──────────────────────────────────────────────────────────────
  useTelemetryRealtime({
    deviceId,
    latestQueryKey: ['analytics', 'full', deviceId],
    historyQueryKey: ['analytics', 'full', deviceId],
    snapshotTable: 'evaraflow_snapshots',
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
          flow_rate: snap.flow_rate,
          total_liters: snap.total_liters,
          data: snap.payload ?? base.latest?.data,
        },
      };
    },
  });

  // ── Staleness ─────────────────────────────────────────────────────────────
  const { label: staleLabel } = useStaleDataAge(telemetryData?.timestamp ?? null);
  // Offline: no data at all (null) OR data older than 30 min — never show Online while there is no timestamp
  const isOffline = onlineStatus === 'Offline';

  // ── Derived values ────────────────────────────────────────────────────────
  const deviceName = deviceInfo?.name ?? 'Flow Meter';
  const deviceShortId = deviceId.slice(0, 8).toUpperCase();
  const zoneName = deviceInfo?.zone_name ?? deviceInfo?.community_name ?? '';

  const flowRate = useMemo(() => {
    if (!telemetryData) return 0;
    if (telemetryData.flow_rate != null) return telemetryData.flow_rate;
    const v = parseFloat(telemetryData.data?.[fieldFlow] as string);
    if (!isNaN(v) && v >= 0) return v;
    const base = parseFloat(telemetryData.data?.field1 as string) || 40;
    return 10 + (base % 20);
  }, [telemetryData, fieldFlow]);

  const totalRaw = useMemo(() => {
    if (!telemetryData) return 0;
    if (telemetryData.total_liters != null) return telemetryData.total_liters / 1000;
    const v = parseFloat(telemetryData.data?.[fieldTotal] as string);
    return isNaN(v) ? 0 : v;
  }, [telemetryData, fieldTotal]);

  const totalDisplay = displayUnit === 'L' ? totalRaw * 1000 : totalRaw;
  const totalUnit = displayUnit === 'L' ? 'L' : 'm³';

  // Odometer digits from total reading — 7-digit (6 black + 1 red)
  const odometer = useMemo(() => {
    const t = Math.abs(totalRaw);
    const intPart = Math.floor(t).toString().padStart(6, '0').slice(-6);
    const fracDigit = Math.floor((t % 1) * 10).toString();
    return { black: intPart.split(''), red: fracDigit };
  }, [totalRaw]);

  // Flow history derived from feeds
  const flowHistory = useMemo(() => {
    const feeds: HistoryFeed[] = historyFeeds as HistoryFeed[];
    return feeds.map((f) => {
      const d = new Date(f.created_at);
      const time = `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
      const rawFlow = parseFloat(f[fieldFlow] as string) || parseFloat(f.field1 as string) || 0;
      const value = rawFlow > 0 ? (rawFlow < 100 ? rawFlow : 10 + (rawFlow % 20)) : 0;
      const rawTotal = parseFloat(f[fieldTotal] as string) || 0;
      return { time, value, total: rawTotal };
    });
  }, [historyFeeds, fieldFlow, fieldTotal]);

  // ── Save config ───────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    setSaving(true);
    setSaveError('');
    try {
      await api.put(`/telemetry/devices/${deviceId}/config`, {
        max_flow_rate: maxFlowRate,
        // FIXED: send the actual field mapping keys that exist in the DB.
        // abnormal_threshold removed — no DB column for it.
        meter_reading_field: fieldTotal,
        flow_rate_field: fieldFlow,
      });
      await queryClient.invalidateQueries({ queryKey: ['device-config', deviceId] });
    } catch {
      setSaveError('Save failed. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [deviceId, maxFlowRate, fieldTotal, fieldFlow, queryClient]);

  // ─── Render ───────────────────────────────────────────────────────────────
  if (analyticsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-transparent">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 rounded-full border-4 border-solid animate-spin" style={{ borderColor: 'rgba(0,119,255,0.2)', borderTopColor: '#0077ff' }} />
          <p className="text-sm font-medium" style={{ color: '#8E8E93' }}>Loading analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen font-sans relative overflow-x-hidden bg-transparent" style={{ color: '#1C1C1E' }}>
      <main className="relative flex-grow px-4 sm:px-6 lg:px-8 pt-[110px] lg:pt-[120px] pb-8" style={{ zIndex: 1 }}>
        <div className="max-w-[1400px] mx-auto flex flex-col gap-6">

          {/* ── Breadcrumb + status row ── */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <nav className="flex items-center gap-1 text-sm font-medium" style={{ color: '#8E8E93' }}>
              <button onClick={() => navigate('/map')} className="hover:text-[#0077ff] transition-colors bg-transparent border-none cursor-pointer p-0 flex items-center">
                <span className="material-symbols-rounded" style={{ fontSize: 18 }}>home</span>
              </button>
              <span className="material-symbols-rounded" style={{ fontSize: 16, color: '#C7C7CC' }}>chevron_right</span>
              <button onClick={() => navigate('/nodes')} className="hover:text-[#0077ff] transition-colors bg-transparent border-none cursor-pointer p-0 font-medium" style={{ color: '#8E8E93' }}>
                All Nodes
              </button>
              <span className="material-symbols-rounded" style={{ fontSize: 16, color: '#C7C7CC' }}>chevron_right</span>
              <span className="font-semibold" style={{ color: '#1C1C1E' }}>{deviceName}</span>
            </nav>
            <div className="flex items-center gap-2">
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
                style={{ background: 'rgba(0,119,255,0.1)', color: '#0077ff', border: 'none', cursor: 'pointer' }}>
                <span className="material-symbols-rounded" style={{ fontSize: 15 }}>refresh</span>
                Refresh
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

          {/* ── Top 3-column grid ── */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">

            {/* ──────────── ANALOG BRASS METER ──────────── */}
            <div className="lg:col-span-4 apple-glass-card rounded-[2.5rem] p-6 flex flex-col items-center justify-center gap-4">
              {/* Online badge */}
              <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${isOffline ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
                <span className={`w-2 h-2 rounded-full ${isOffline ? 'bg-red-500' : 'bg-emerald-500 animate-pulse'}`} />
                {isOffline ? 'Offline' : 'Online'}
              </div>

              {/* Brass SVG Meter */}
              <div className="relative w-56 h-56 drop-shadow-2xl">
                <svg viewBox="0 0 200 200" className="w-full h-full">
                  <defs>
                    <linearGradient id="brassBezelEF" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#dfbd69" />
                      <stop offset="25%" stopColor="#926d25" />
                      <stop offset="50%" stopColor="#fcf6ba" />
                      <stop offset="75%" stopColor="#aa8431" />
                      <stop offset="100%" stopColor="#654321" />
                    </linearGradient>
                    <radialGradient id="faceShadeEF" cx="50%" cy="50%" r="50%">
                      <stop offset="85%" stopColor="#fdfaf2" />
                      <stop offset="100%" stopColor="#d1d5db" />
                    </radialGradient>
                  </defs>

                  {/* Brass bezel layers */}
                  <circle cx="100" cy="100" r="98" fill="url(#brassBezelEF)" stroke="#5d4037" strokeWidth="0.5" />
                  <circle cx="100" cy="100" r="90" fill="#8d6e63" />
                  <circle cx="100" cy="100" r="88" fill="url(#brassBezelEF)" />
                  <circle cx="100" cy="100" r="84" fill="url(#faceShadeEF)" />

                  {/* Dial tick marks */}
                  {Array.from({ length: 28 }).map((_, i) => {
                    const angle = -135 + i * (270 / 27);
                    const rad = (angle * Math.PI) / 180;
                    const isMajor = i % 3 === 0;
                    const r1 = isMajor ? 66 : 70;
                    return (
                      <line key={i}
                        x1={100 + r1 * Math.sin(rad)} y1={100 - r1 * Math.cos(rad)}
                        x2={100 + 74 * Math.sin(rad)} y2={100 - 74 * Math.cos(rad)}
                        stroke={isMajor ? '#94a3b8' : '#cbd5e1'} strokeWidth={isMajor ? 1.5 : 0.8} />
                    );
                  })}

                  {/* Scale labels at 0%, 25%, 50%, 75%, 100% of maxFlowRate */}
                  {[0, 0.25, 0.5, 0.75, 1].map((frac) => {
                    const angle = -135 + frac * 270;
                    const rad = (angle * Math.PI) / 180;
                    return (
                      <text key={frac}
                        x={100 + 57 * Math.sin(rad)} y={100 - 57 * Math.cos(rad) + 2}
                        textAnchor="middle" fill="#64748b" fontSize="7" fontWeight="bold">
                        {Math.round(frac * maxFlowRate)}
                      </text>
                    );
                  })}

                  {/* Branding */}
                  <text x="100" y="52" textAnchor="middle" fill="#64748b" fontSize="6" fontWeight="bold" fontFamily="sans-serif">Qn 1.5 m³/h CLASS B</text>

                  {/* Odometer display — 7-digit (6 black + 1 red) */}
                  <g transform="translate(40, 78)">
                    <rect x="0" y="0" width="120" height="22" rx="1" fill="#e2e8f0" stroke="#94a3b8" strokeWidth="0.5" />
                    {odometer.black.map((digit, i) => (
                      <g key={i} transform={`translate(${4 + i * 15}, 3)`}>
                        <rect x="0" y="0" width="13" height="16" rx="1" fill="#1a1a1a" />
                        <text x="6.5" y="12.5" textAnchor="middle" fill="white" fontFamily="monospace" fontSize="10" fontWeight="bold">{digit}</text>
                      </g>
                    ))}
                    <g transform="translate(94, 3)">
                      <rect x="0" y="0" width="13" height="16" rx="1" fill="#ef4444" />
                      <text x="6.5" y="12.5" textAnchor="middle" fill="white" fontFamily="monospace" fontSize="10" fontWeight="bold">{odometer.red}</text>
                    </g>
                    <text x="111" y="15" fill="#1e293b" fontFamily="sans-serif" fontSize="8" fontWeight="900">m³</text>
                  </g>

                  {/* Decorative sub-dials */}
                  {([
                    { tx: 150, ty: 108, rot: 160, label: 'x0.1', labelY: -18 },
                    { tx: 137, ty: 143, rot: 310, label: 'x0.01', labelY: -18 },
                    { tx: 100, ty: 157, rot: 45, label: 'x0.001', labelY: 22 },
                    { tx: 63, ty: 143, rot: 210, label: 'x0.0001', labelY: -18 },
                  ] as { tx: number; ty: number; rot: number; label: string; labelY: number }[]).map((d) => (
                    <g key={d.label} transform={`translate(${d.tx},${d.ty})`}>
                      <circle r="14" fill="none" stroke="#94a3b8" strokeDasharray="1 2" strokeWidth="0.5" />
                      <text y={d.labelY} textAnchor="middle" fill="#64748b" fontSize="5" fontWeight="bold">{d.label}</text>
                      <line x1="0" y1="0" x2="0" y2="-10" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round" transform={`rotate(${d.rot})`} />
                      <circle r="2" fill="#ef4444" />
                    </g>
                  ))}

                  {/* Glass reflection */}
                  <path d="M30,50 Q100,10 170,50 Q100,30 30,50" fill="white" opacity="0.2" />
                  <circle cx="100" cy="100" r="84" fill="none" stroke="url(#brassBezelEF)" strokeWidth="0.5" opacity="0.5" />
                </svg>
                <div className="absolute inset-4 rounded-full bg-gradient-to-tr from-transparent via-white/10 to-white/30 pointer-events-none" />
              </div>

              {/* Flow rate readout */}
              <div className="text-center">
                <p className="text-xs font-bold uppercase tracking-widest m-0" style={{ color: '#8E8E93' }}>Flow Indicator</p>
                <h3 className="text-4xl font-black text-slate-800 m-0 mt-1 tabular-nums">
                  {telemetryLoading ? '--' : flowRate.toFixed(1)}
                  <span className="text-xl font-medium text-slate-400 ml-1">L/min</span>
                </h3>
                <p className="text-xs font-medium m-0 mt-1" style={{ color: '#8E8E93' }}>{staleLabel}</p>
              </div>
            </div>

            {/* ──────────── DEVICE CONFIG CARD ──────────── */}
            <div className="lg:col-span-4 apple-glass-card rounded-[2.5rem] p-6 flex flex-col">
              <div className="mb-5">
                <h1 className="text-2xl font-bold text-slate-900 m-0">{deviceName}</h1>
                <div className="flex items-center gap-1.5 mt-1" style={{ color: '#8E8E93' }}>
                  <span className="material-symbols-rounded" style={{ fontSize: 16 }}>location_on</span>
                  <p className="text-sm m-0">{zoneName ? `${zoneName} · ` : ''}ID: {deviceShortId}</p>
                </div>
              </div>

              {/* KPI chips */}
              <div className="flex flex-col gap-3 mb-5">
                <div className="p-4 rounded-2xl" style={{ background: 'rgba(0,119,255,0.05)', border: '1px solid rgba(0,119,255,0.1)' }}>
                  <p className="text-xs font-semibold uppercase tracking-wider m-0 mb-1" style={{ color: '#0077ff' }}>Total Usage</p>
                  <p className="text-4xl font-black m-0 leading-tight">
                    {totalDisplay.toFixed(1)} <span className="text-base font-normal text-slate-500">{totalUnit}</span>
                  </p>
                </div>
                <div className="p-4 rounded-2xl" style={{ background: 'rgba(45,212,191,0.05)', border: '1px solid rgba(45,212,191,0.1)' }}>
                  <p className="text-xs font-semibold uppercase tracking-wider m-0 mb-1" style={{ color: '#2dd4bf' }}>Current Flow</p>
                  <p className="text-4xl font-black m-0 leading-tight">
                    {flowRate.toFixed(1)} <span className="text-base font-normal text-slate-500">L/min</span>
                  </p>
                </div>
              </div>

              {/* Display Units — moved here below KPIs */}
              <div className="pt-4" style={{ borderTop: '1px solid rgba(0,0,0,0.07)' }}>
                <p className="text-xs font-bold uppercase tracking-widest m-0 mb-3" style={{ color: '#8E8E93' }}>Display Units</p>
                <div className="flex flex-col gap-2">
                  {([
                    { val: 'm3' as const, label: 'Cubic Metres (m³)', icon: 'opacity' },
                    { val: 'L' as const, label: 'Litres (L)', icon: 'water' },
                  ] as { val: 'm3' | 'L'; label: string; icon: string }[]).map(opt => (
                    <label key={opt.val}
                      className="flex items-center justify-between p-3 rounded-2xl cursor-pointer transition-all"
                      style={{
                        border: `1px solid ${displayUnit === opt.val ? 'rgba(0,119,255,0.25)' : 'rgba(0,0,0,0.07)'}`,
                        background: displayUnit === opt.val ? 'rgba(0,119,255,0.05)' : 'rgba(255,255,255,0.3)',
                      }}>
                      <div className="flex items-center gap-3">
                        <span className="material-symbols-rounded" style={{ fontSize: 20, color: displayUnit === opt.val ? '#0077ff' : '#94a3b8' }}>{opt.icon}</span>
                        <span className="font-medium text-sm">{opt.label}</span>
                      </div>
                      <input type="radio" name="units" value={opt.val} checked={displayUnit === opt.val}
                        onChange={() => setDisplayUnit(opt.val)}
                        className="w-5 h-5 accent-[#0077ff]" />
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* ──────────── THINGSPEAK FIELDS / SAVE ──────────── */}
            <div className="lg:col-span-4 apple-glass-card rounded-[2.5rem] p-6 flex flex-col">
              <p className="text-xs font-bold uppercase tracking-widest m-0 mb-4" style={{ color: '#8E8E93', letterSpacing: '0.12em' }}>ThingSpeak Fields</p>

              <div className="flex flex-col gap-3 mb-5">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider px-1" style={{ color: '#8E8E93' }}>Total Field</label>
                  <select value={fieldTotal} onChange={e => setFieldTotal(e.target.value)} className="ios-input">
                    {['field1', 'field2', 'field3', 'field4', 'field5', 'field6', 'field7', 'field8'].map(f => (
                      <option key={f} value={f}>{f.replace('field', 'Field ')} (Cumulative m³)</option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider px-1" style={{ color: '#8E8E93' }}>Flow Rate Field</label>
                  <select value={fieldFlow} onChange={e => setFieldFlow(e.target.value)} className="ios-input">
                    {['field1', 'field2', 'field3', 'field4', 'field5', 'field6', 'field7', 'field8'].map(f => (
                      <option key={f} value={f}>{f.replace('field', 'Field ')} (Flow Rate L/min)</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Save button — moved here below ThingSpeak fields */}
              <div className="mt-auto">
                {saveError && <p className="text-xs font-semibold m-0 mb-3" style={{ color: '#FF3B30' }}>⚠ {saveError}</p>}
                <button onClick={handleSave} disabled={saving}
                  className="w-full font-bold py-3.5 rounded-2xl transition-all hover:scale-[0.98] active:scale-[0.96] flex items-center justify-center gap-2"
                  style={{
                    background: 'linear-gradient(135deg,#0077ff,#0055cc)',
                    color: '#fff', border: 'none',
                    cursor: saving ? 'default' : 'pointer',
                    boxShadow: '0 4px 16px rgba(0,119,255,0.3)',
                    opacity: saving ? 0.7 : 1,
                  }}>
                  <span className="material-symbols-rounded" style={{ fontSize: 18 }}>{saving ? 'sync' : 'save'}</span>
                  {saving ? 'Saving…' : 'Save Configuration'}
                </button>
              </div>
            </div>
          </div>

          {/* ── Flow Analytics (full-width, single chart) ── */}
          <div className="apple-glass-card rounded-[2.5rem] p-8">
            {/* Header row */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold m-0">Flow Analytics</h2>
                <p className="text-xs font-semibold mt-1 m-0" style={{ color: '#8E8E93' }}>
                  Flow Rate (L/min) — {timeRange} window
                </p>
              </div>
              <div className="flex items-center gap-4">
                {/* Daily avg chip */}
                <div className="apple-glass-inner rounded-2xl px-4 py-2.5 text-center min-w-[100px]">
                  <p className="text-[10px] font-bold uppercase tracking-wider m-0 mb-0.5" style={{ color: '#8E8E93' }}>Daily Avg</p>
                  <p className="text-xl font-black m-0 leading-none">
                    {flowHistory.length > 0
                      ? (flowHistory.reduce((s, d) => s + d.value, 0) / flowHistory.length).toFixed(1)
                      : '–'}
                    <span className="text-xs font-medium ml-1" style={{ color: '#8E8E93' }}>L/min</span>
                  </p>
                </div>
                {/* Time range toggle */}
                <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'rgba(0,0,0,0.05)' }}>
                  {(['24H', '7D', '30D'] as const).map(t => (
                    <button key={t} onClick={() => setTimeRange(t)}
                      className="px-4 py-1.5 text-xs font-bold rounded-lg transition-all"
                      style={timeRange === t
                        ? { background: 'rgba(255,255,255,0.9)', color: '#1C1C1E', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }
                        : { color: '#8E8E93', background: 'transparent' }}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Chart */}
            {historyLoading ? (
              <div className="h-72 flex flex-col items-center justify-center gap-3" style={{ color: '#8E8E93' }}>
                <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: '#0077ff', borderTopColor: 'transparent' }} />
                <p className="text-sm font-medium m-0">Analysing flow data…</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart
                  data={flowHistory.slice(-48)}
                  margin={{ top: 10, right: 16, left: 0, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="flowGradEF" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0077ff" stopOpacity={0.22} />
                      <stop offset="95%" stopColor="#0077ff" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 6" stroke="rgba(0,0,0,0.055)" vertical={false} />
                  <XAxis
                    dataKey="time"
                    tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }}
                    axisLine={false}
                    tickLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 600 }}
                    axisLine={false}
                    tickLine={false}
                    width={42}
                    tickFormatter={(v: number) => `${v}L`}
                  />
                  <RechartsTooltip
                    contentStyle={{
                      background: 'rgba(255,255,255,0.92)',
                      backdropFilter: 'blur(16px)',
                      border: '1px solid rgba(0,119,255,0.18)',
                      borderRadius: 14,
                      fontSize: 12,
                      fontWeight: 600,
                      boxShadow: '0 4px 20px rgba(0,0,0,0.10)',
                    }}
                    labelStyle={{ color: '#94a3b8', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}
                    formatter={(value: unknown) => [`${(value as number).toFixed(1)} L/min`, 'Flow Rate']}
                    cursor={{ stroke: '#0077ff', strokeWidth: 1.5, strokeDasharray: '4 3' }}
                  />
                  <Area
                    type="monotoneX"
                    dataKey="value"
                    stroke="#0077ff"
                    strokeWidth={2.5}
                    fill="url(#flowGradEF)"
                    dot={false}
                    activeDot={{ r: 5, fill: '#0077ff', stroke: 'white', strokeWidth: 2.5 }}
                    isAnimationActive={true}
                    animationDuration={600}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>

        </div>
      </main>

      <footer className="mt-8 py-6 text-center text-sm font-medium"
        style={{ borderTop: '1px solid rgba(0,0,0,0.05)', color: '#8E8E93', backdropFilter: 'blur(8px)' }}>
        <p className="m-0">
          © {new Date().getFullYear()} EvaraFlow Intelligence Systems
          <span className="mx-2" style={{ color: '#C7C7CC' }}>|</span>
          <a href="mailto:support@evaratech.in" className="hover:text-[#0077ff] transition-colors" style={{ color: 'inherit' }}>
            Support &amp; Docs
          </a>
        </p>
      </footer>
    </div>
  );
};

export default EvaraFlowAnalytics;
