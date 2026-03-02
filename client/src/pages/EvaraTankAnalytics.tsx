import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import api from '../services/api';
import { supabase } from '../lib/supabase';

// HARDCODED CONSTANTS FOR DEMO PURPOSES
// In production, these should be dynamically driven by the device configuration
const TARGET_DEVICE_ID = 'b4f94237-42f1-4f16-8a88-f52631d84bdc'; // KRB Tank
const TOTAL_HEIGHT_M = 13.16; // 1316 cm tank height
const MAX_CAPACITY = 500;

interface TelemetryPayload {
    timestamp: string;
    data: {
        entry_id: number;
        [key: string]: any;
    };
    // Backend-calculated metrics (for tanks)
    level_percentage?: number;
    temperature_value?: number;
    // Backend-calculated metrics (for flow)
    total_liters?: number;
    flow_rate?: number;
    // Backend-calculated metrics (for deep)
    depth_value?: number;
}

const EvaraTankAnalytics = () => {
    const [currentFilter, setCurrentFilter] = useState('live');
    const [percentage, setPercentage] = useState(0);
    const [volume, setVolume] = useState(0);

    const [alerts, setAlerts] = useState({
        low: { state: 'green', text: 'NORMAL' },
        over: { state: 'green', text: 'MINIMAL' },
        rapid: { state: 'green', text: 'NORMAL' },
        sensor: { state: 'green', text: 'CONNECTED' },
    });

    const [chartColors, setChartColors] = useState({ border: '#4F46E5', bg: 'rgba(79, 70, 229, 0.1)' });
    const [consumption, setConsumption] = useState({ daily: 0, weekly: 0, trend: 'stable' as 'up' | 'down' | 'stable' });

    // Optimized telemetry fetching with aggressive caching and auto-refresh
    const { data: telemetryData, isLoading: telemetryLoading, isError: telemetryError, error, refetch } = useQuery({
        queryKey: ['tank-telemetry', TARGET_DEVICE_ID],
        queryFn: async () => {
            console.log('🔄 Fetching latest telemetry...');
            const { data } = await api.get<TelemetryPayload>(`/telemetry/devices/${TARGET_DEVICE_ID}/telemetry/latest`);
            console.log('✅ Telemetry received:', data);
            return data;
        },
        staleTime: 30000, // Data considered fresh for 30 seconds
        cacheTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
        refetchInterval: 30000, // Auto-refresh every 30 seconds
        refetchOnWindowFocus: true,
        retry: 3,
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    });

    const { data: historyData, isLoading: historyLoading, refetch: refetchHistory } = useQuery({
        queryKey: ['tank-history', TARGET_DEVICE_ID],
        queryFn: async () => {
            console.log('📊 Fetching telemetry history...');
            const { data } = await api.get(`/telemetry/devices/${TARGET_DEVICE_ID}/telemetry/history?results=50`);
            console.log('✅ History received:', data?.feeds?.length, 'entries');
            return data;
        },
        staleTime: 60000, // History data fresh for 1 minute
        cacheTime: 10 * 60 * 1000,
        refetchInterval: 60000, // Refresh history every minute
        enabled: !!telemetryData, // Only fetch after telemetry loads
        retry: 2,
    });

    // Derive chart data directly from remote history
    const levelData = (historyData?.feeds || []).map((feed: any) => {
        let d = new Date(feed.created_at);
        const timeStr = d.getHours() + ":" + (d.getMinutes() < 10 ? '0' : '') + d.getMinutes();
        const rawDistance = parseFloat(feed.field1) || 40;
        const currentLevel = (TOTAL_HEIGHT_M * 100) - rawDistance;
        return { time: timeStr, level: currentLevel };
    });

    useEffect(() => {
        if (!telemetryData) {
            console.log('⏳ Waiting for telemetry data...');
            return;
        }

        console.log('🔍 Processing telemetry:', telemetryData);

        // Use backend-calculated percentage if available
        let calcPercentage: number;
        
        if ('level_percentage' in telemetryData && telemetryData.level_percentage !== null && telemetryData.level_percentage !== undefined) {
            // Use pre-calculated percentage from backend
            calcPercentage = Number(telemetryData.level_percentage);
            console.log('✅ Using backend-calculated percentage:', calcPercentage);
        } else {
            // Fallback to manual calculation (for backward compatibility)
            const rawDistance = telemetryData.data?.field1 ? Number(telemetryData.data.field1) : 34;
            const sensorReading = isNaN(rawDistance) ? 34 : rawDistance;
            const waterLevelCm = (TOTAL_HEIGHT_M * 100) - sensorReading;
            calcPercentage = Math.max(0, Math.min(100, (waterLevelCm / (TOTAL_HEIGHT_M * 100)) * 100));
            console.log('⚠️ Using fallback calculation:', { rawDistance, sensorReading, calcPercentage });
        }
        
        const calcVolume = (calcPercentage / 100) * MAX_CAPACITY;

        setPercentage(calcPercentage);
        setVolume(calcVolume);

        updateAlerts(calcPercentage);
        
        console.log('📈 Updated state:', { percentage: calcPercentage, volume: calcVolume });
    }, [telemetryData]);
    
    // Calculate consumption trends from historical data
    useEffect(() => {
        if (!historyData?.feeds || historyData.feeds.length < 2) return;
        
        const feeds = historyData.feeds;
        const recent = feeds.slice(-10); // Last 10 readings
        const older = feeds.slice(-20, -10); // Previous 10 readings
        
        // Calculate average levels
        const recentAvg = recent.reduce((sum: number, f: any) => sum + (parseFloat(f.field1) || 0), 0) / recent.length;
        const olderAvg = older.reduce((sum: number, f: any) => sum + (parseFloat(f.field1) || 0), 0) / (older.length || 1);
        
        // Sensor measures distance - lower value means MORE water (consumption decreasing)
        const trend = recentAvg < olderAvg - 2 ? 'down' : recentAvg > olderAvg + 2 ? 'up' : 'stable';
        
        // Estimate daily consumption (rough calculation based on level change)
        const dailyChange = Math.abs(recentAvg - olderAvg);
        const dailyConsumption = (dailyChange / 1316) * MAX_CAPACITY * 2; // Extrapolate to full day
        
        setConsumption({
            daily: Math.round(dailyConsumption),
            weekly: Math.round(dailyConsumption * 7),
            trend
        });
    }, [historyData]);

    // Realtime Subscriptions (Phase 3 Integration)
    useEffect(() => {
        // Subscribe to the centralized snapshot table
        const channel = supabase.channel(`public:device_telemetry_snapshots:${TARGET_DEVICE_ID}`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'device_telemetry_snapshots',
                    filter: `device_id=eq.${TARGET_DEVICE_ID}`
                },
                (payload) => {
                    console.log("Realtime Update Received!", payload);
                    // Force React Query to invalidate and cleanly merge the new state
                    refetch();
                    refetchHistory();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [TARGET_DEVICE_ID, refetch, refetchHistory]);


    const updateAlerts = (calcPercentage: number) => {
        let newAlerts = { ...alerts };
        if (calcPercentage < 20) { newAlerts.low = { state: 'orange', text: 'ATTENTION REQUIRED' }; }
        else { newAlerts.low = { state: 'green', text: 'NORMAL' }; }

        if (calcPercentage > 90) { newAlerts.over = { state: 'red', text: 'CRITICAL' }; }
        else { newAlerts.over = { state: 'green', text: 'MINIMAL' }; }

        newAlerts.sensor = { state: 'green', text: 'CONNECTED' };
        setAlerts(newAlerts);

        if (calcPercentage > 70) {
            setChartColors({ border: '#1e40af', bg: '#1e40af1a' });
        } else if (calcPercentage < 30) {
            setChartColors({ border: '#38bdf8', bg: '#38bdf81a' });
        } else {
            setChartColors({ border: '#4F46E5', bg: '#4F46E51a' });
        }
    }

    const getAlertColor = (state: string) => {
        if (state === 'green') return 'text-emerald-500 bg-emerald-500 shadow-[0_0_0_4px_rgba(34,197,94,0.2)]';
        if (state === 'orange') return 'text-amber-500 bg-amber-500 shadow-[0_0_0_4px_rgba(245,158,11,0.2)]';
        return 'text-red-500 bg-red-500 shadow-[0_0_0_4px_rgba(239,68,68,0.2)]';
    };

    const getAlertTextColor = (state: string) => {
        if (state === 'green') return 'text-emerald-500';
        if (state === 'orange') return 'text-amber-500';
        return 'text-red-500';
    };


    return (
        <div className="w-full pt-[140px] pb-12 px-8 min-h-screen bg-transparent font-['Plus_Jakarta_Sans',sans-serif]">
            <div className="w-full max-w-[1400px] mx-auto">
                <header className="mb-8 flex justify-between items-center">
                    <div>
                        <h1 className="text-[24px] font-bold text-slate-800 tracking-tight m-0">EvaraTank Analytics</h1>
                        <p className="text-[14px] text-slate-500 mt-1">Real-Time Water Monitoring System</p>
                    </div>
                    {telemetryLoading && (
                        <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 rounded-lg">
                            <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                            <span className="text-sm text-blue-600 font-medium">Loading data...</span>
                        </div>
                    )}
                    {telemetryError && (
                        <button 
                            onClick={() => refetch()} 
                            className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-sm font-medium transition-colors"
                        >
                            \u26a0\ufe0f Retry
                        </button>
                    )}
                </header>

                {telemetryError && (
                    <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl">
                        <p className="text-red-800 font-semibold">Failed to load telemetry data</p>
                        <p className="text-sm text-red-600 mt-1">{error instanceof Error ? error.message : 'Unknown error'}</p>
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">\n                    {/* Tank Display Card */}
                    <div className="apple-glass-card rounded-[20px] p-6 shadow-sm border border-slate-100 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md">
                        {telemetryLoading ? (
                            <div className="animate-pulse flex items-center gap-5">
                                <div className="w-[60px] h-[120px] bg-slate-200 rounded-xl"></div>
                                <div className="flex-1">
                                    <div className="h-3 bg-slate-200 rounded w-24 mb-2"></div>
                                    <div className="h-8 bg-slate-200 rounded w-20 mb-2"></div>
                                    <div className="h-3 bg-slate-200 rounded w-16"></div>
                                </div>
                            </div>
                        ) : (
                            <div className="flex items-center gap-5">
                                <div className="w-[60px] h-[120px] bg-slate-100 rounded-xl relative overflow-hidden border-2 border-slate-200">
                                    <div
                                        className="absolute bottom-0 w-full bg-gradient-to-t from-indigo-600 to-sky-500 transition-all duration-1000 ease-in-out"
                                        style={{ height: `${percentage}%` }}
                                    ></div>
                                </div>
                                <div>
                                    <div className="text-[13px] font-semibold text-slate-500 uppercase tracking-wide">Current Level</div>
                                    <div className="text-[32px] font-extrabold text-indigo-500 my-1 leading-none">{percentage.toFixed(1)}%</div>
                                    <div className="text-[14px] font-medium text-emerald-500">Total: {TOTAL_HEIGHT_M.toFixed(2)}m</div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* KPI Cards */}
                    <div className="apple-glass-card rounded-[20px] p-6 shadow-sm border border-slate-100 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md">
                        <div className="text-[13px] font-semibold text-slate-500 uppercase tracking-wide">Total Tank Volume</div>
                        <div className="text-[28px] font-bold text-indigo-600 my-2.5 leading-none">{MAX_CAPACITY} L</div>
                        <div className="text-[12px] text-slate-500">Max Capacity</div>
                    </div>

                    <div className="apple-glass-card rounded-[20px] p-6 shadow-sm border border-slate-100 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md">
                        {telemetryLoading ? (
                            <div className="animate-pulse">
                                <div className="h-3 bg-slate-200 rounded w-24 mb-3"></div>
                                <div className="h-8 bg-slate-200 rounded w-20 mb-2"></div>
                                <div className="h-3 bg-slate-200 rounded w-32"></div>
                            </div>
                        ) : (
                            <>
                                <div className="text-[13px] font-semibold text-slate-500 uppercase tracking-wide">Available Volume</div>
                                <div className="text-[28px] font-bold text-indigo-600 my-2.5 leading-none">{volume.toFixed(1)} L</div>
                                <div className="text-[12px] text-slate-500">Calculated Real-Time</div>
                            </>
                        )}
                    </div>

                    <div className="apple-glass-card rounded-[20px] p-6 shadow-sm border border-slate-100 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md">
                        {historyLoading ? (
                            <div className="animate-pulse">
                                <div className="h-3 bg-slate-200 rounded w-28 mb-3"></div>
                                <div className="h-8 bg-slate-200 rounded w-20 mb-2"></div>
                                <div className="h-3 bg-slate-200 rounded w-36"></div>
                            </div>
                        ) : (
                            <>
                                <div className="text-[13px] font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-2">
                                    Est. Consumption
                                    {consumption.trend === 'up' && <span className="text-red-500">\u2191</span>}
                                    {consumption.trend === 'down' && <span className="text-green-500">\u2193</span>}
                                    {consumption.trend === 'stable' && <span className="text-blue-500">\u2192</span>}
                                </div>
                                <div className="text-[28px] font-bold text-indigo-600 my-2.5 leading-none">{consumption.daily} L</div>
                                <div className="text-[12px] text-slate-500">Daily avg \u2022 {consumption.weekly}L weekly</div>
                            </>
                        )}
                    </div>

                    {/* Main Line Chart (Span 3) */}
                    <div className="col-span-1 md:col-span-2 xl:col-span-3 apple-glass-card rounded-[20px] p-6 shadow-sm border border-slate-100 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md">
                        <div className="flex justify-between items-center mb-5">
                            <h3 className="m-0 text-[16px] font-bold text-slate-800">Real-Time Water Level</h3>
                            <div className="bg-slate-100 p-1 rounded-lg flex gap-1">
                                {['live', '1h', '6h', '24h'].map((filter) => (
                                    <button
                                        key={filter}
                                        onClick={() => setCurrentFilter(filter)}
                                        className={clsx(
                                            "border-none px-3 py-1 rounded-md text-[12px] font-semibold transition-all cursor-pointer",
                                            currentFilter === filter ? "bg-white text-indigo-600 shadow-sm" : "bg-transparent text-slate-500 hover:bg-white/50"
                                        )}
                                    >
                                        {filter.charAt(0).toUpperCase() + filter.slice(1)}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="relative h-[250px] w-full">
                            {historyLoading ? (
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <div className="text-center">
                                        <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
                                        <p className="text-sm text-slate-500">Loading historical data...</p>
                                    </div>
                                </div>
                            ) : levelData.length === 0 ? (
                                <div className="absolute inset-0 flex items-center justify-center">
                                    <p className="text-slate-400">No historical data available</p>
                                </div>
                            ) : (
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={levelData}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                                        <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 12 }} dy={10} />
                                        <YAxis domain={[0, 'auto']} axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 12 }} dx={-10} />
                                        <RechartsTooltip
                                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)' }}
                                        />
                                        <Line
                                            type="monotone"
                                            dataKey="level"
                                            stroke={chartColors.border}
                                            strokeWidth={3}
                                            dot={false}
                                            activeDot={{ r: 6, fill: chartColors.border, stroke: '#fff', strokeWidth: 2 }}
                                            style={{ filter: `drop-shadow(0 4px 6px ${chartColors.bg})` }}
                                        />
                                    </LineChart>
                                </ResponsiveContainer>
                            )}
                        </div>
                    </div>

                    {/* Abnormal Usage Doughnut */}
                    <div className="apple-glass-card rounded-[20px] p-6 shadow-sm border border-slate-100 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md flex flex-col items-center">
                        <h3 className="m-0 mb-[15px] text-[14px] font-bold text-slate-800 w-full text-left">Abnormal Usage</h3>
                        <div className="relative h-[160px] w-full flex justify-center">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={[{ name: 'Normal', value: 95 }, { name: 'Abnormal', value: 5 }]}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={75}
                                        paddingAngle={2}
                                        dataKey="value"
                                        stroke="none"
                                    >
                                        <Cell fill="#4F46E5" />
                                        <Cell fill="#EF4444" />
                                    </Pie>
                                    <RechartsTooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }} />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="flex justify-center gap-[15px] mt-[10px] text-[12px] text-slate-500">
                            <div className="flex items-center gap-[5px]"><div className="w-2 h-2 rounded-full bg-indigo-600"></div> Normal</div>
                            <div className="flex items-center gap-[5px]"><div className="w-2 h-2 rounded-full bg-red-500"></div> Abnormal</div>
                        </div>
                    </div>

                    {/* Refill Cycles Ring */}
                    <div className="apple-glass-card rounded-[20px] p-6 shadow-sm border border-slate-100 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md">
                        <h3 className="m-0 mb-2.5 text-[14px] font-bold text-slate-500 uppercase tracking-wide">Refill Cycles</h3>
                        <div className="relative h-[140px] w-full flex justify-center items-center">
                            <div className="absolute inset-0 z-10">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={[{ name: 'Cycles', value: 2.4 }, { name: 'Remaining', value: 1.6 }]}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={55}
                                            outerRadius={70}
                                            dataKey="value"
                                            stroke="none"
                                            cornerRadius={20}
                                        >
                                            <Cell fill="#3B82F6" />
                                            <Cell fill="#F1F5F9" />
                                        </Pie>
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                            <div className="absolute text-center z-20 flex flex-col items-center justify-center">
                                <div className="text-[28px] font-bold text-blue-500 leading-none">2.4</div>
                                <div className="text-[11px] font-medium text-blue-500 mt-1">Avg/Day</div>
                            </div>
                        </div>
                    </div>

                    {/* Consumption Trends */}
                    <div className="apple-glass-card rounded-[20px] p-6 shadow-sm border border-slate-100 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md">
                        <h3 className="m-0 mb-[15px] text-[14px] font-bold text-slate-800">Consumption Trends</h3>
                        <div className="flex flex-col gap-0">
                            {[
                                { label: 'Last 24 Hours', val: '750 L' },
                                { label: 'Last 3 Days', val: '2,250 L' },
                                { label: 'Last 7 Days', val: '5,250 L' },
                                { label: 'Last 30 Days', val: '22,500 L' },
                            ].map((item, i) => (
                                <div key={i} className={clsx("flex justify-between items-center py-3", i !== 3 && "border-b border-slate-100")}>
                                    <span className="text-[14px] font-medium text-slate-500">{item.label}</span>
                                    <span className="text-[14px] font-bold text-indigo-600">{item.val}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* System Alerts */}
                    <div className="col-span-1 md:col-span-2 apple-glass-card rounded-[20px] p-6 shadow-sm border border-slate-100 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md">
                        <h3 className="m-0 mb-5 text-[16px] font-bold text-slate-800">System Alerts</h3>
                        <div className="flex flex-col gap-0 border border-slate-100 rounded-xl overflow-hidden bg-white/50 backdrop-blur-sm">
                            {[
                                { label: 'Low Water Level', key: 'low' },
                                { label: 'Overflow Risk', key: 'over' },
                                { label: 'Rapid Depletion', key: 'rapid' },
                                { label: 'Sensor/Device Offline', key: 'sensor' },
                            ].map((item, i) => {
                                const alertData = alerts[item.key as keyof typeof alerts];
                                return (
                                    <div key={i} className={clsx("flex justify-between items-center px-5 py-4", i !== 3 && "border-b border-slate-100")}>
                                        <div className="flex items-center gap-3">
                                            <div className={clsx("w-2.5 h-2.5 rounded-full transition-all duration-300", getAlertColor(alertData.state))}></div>
                                            <span className="text-[14px] font-semibold text-slate-700">{item.label}</span>
                                        </div>
                                        <div className={clsx("text-[12px] font-bold uppercase tracking-wide", getAlertTextColor(alertData.state))}>
                                            {alertData.text}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default EvaraTankAnalytics;
