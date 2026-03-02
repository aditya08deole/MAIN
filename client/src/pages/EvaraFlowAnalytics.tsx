import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar } from 'recharts';
import { useQuery } from '@tanstack/react-query';
import clsx from 'clsx';
import api from '../services/api';
import { supabase } from '../lib/supabase';

// HARDCODED CONSTANTS FOR DEMO PURPOSES
// In production, these should be dynamically driven by the device configuration
const TARGET_DEVICE_ID = '07d573cc-93e1-45bd-8ffc-af518c8e2fb8';

interface TelemetryPayload {
    timestamp: string;
    data: {
        entry_id: number;
        [key: string]: any;
    }
}

const EvaraFlowAnalytics = () => {
    const [currentFilter, setCurrentFilter] = useState('24h');
    const [flowRate, setFlowRate] = useState(12.5);

    const pieData = [
        { name: 'Morning Peak', value: 45 },
        { name: 'Standard Usage', value: 55 },
    ];
    const COLORS = ['#0EA5E9', '#E2E8F0'];

    // Initial Hydration & Fallback Fetch driven by React Query
    const { data: telemetryData, refetch } = useQuery({
        queryKey: ['telemetry', TARGET_DEVICE_ID, 'latest'],
        queryFn: async () => {
            const { data } = await api.get<TelemetryPayload>(`/telemetry/devices/${TARGET_DEVICE_ID}/telemetry/latest`);
            return data;
        },
        refetchOnWindowFocus: false, // Refetch manually managed by realtime
        retry: 2,
    });

    const { data: historyData, refetch: refetchHistory } = useQuery({
        queryKey: ['telemetry', TARGET_DEVICE_ID, 'history'],
        queryFn: async () => {
            const { data } = await api.get(`/telemetry/devices/${TARGET_DEVICE_ID}/telemetry/history?results=30`);
            return data;
        },
        refetchOnWindowFocus: false,
        retry: 2,
    });

    // Derive Flow Chart Data
    const rawFeeds = historyData?.feeds || [];
    const flowData = rawFeeds.map((feed: any) => {
        let d = new Date(feed.created_at);
        const timeStr = d.getHours() + ":" + (d.getMinutes() < 10 ? '0' : '') + d.getMinutes();
        const fp = parseFloat(feed.field1) || 40;
        return { time: timeStr, value: 10 + (fp % 20) };
    });

    const liveFlowHistory = flowData.slice(-10);

    useEffect(() => {
        if (!telemetryData) return;

        // Process Incoming telemetry
        // Synthesize flow rate from the feed value to create a dynamic number (using field1 for demo)
        const baseValue = parseFloat(telemetryData.data.field1) || 40;
        // Create a plausible flow rate between 10 and 30 L/min based on the data
        const dynamicFlow = 10 + (baseValue % 20);
        setFlowRate(dynamicFlow);
    }, [telemetryData]);

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
                    console.log("Realtime Update Received for Flow!", payload);
                    refetch();
                    refetchHistory();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [TARGET_DEVICE_ID, refetch]);

    // Calculate flow fill percentage for the CSS animation (max 30 L/min)
    const fillPercentage = Math.min((flowRate / 30) * 100, 100);

    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-slate-800 text-white text-xs font-bold px-3 py-2 rounded-lg shadow-xl border border-slate-700">
                    <p className="mb-1 text-slate-300">{label}</p>
                    <p className="text-[#0EA5E9]">{`${payload[0].value.toFixed(1)} L/Min`}</p>
                </div>
            );
        }
        return null;
    };


    return (
        <div className="w-full pt-[140px] pb-12 px-8 min-h-screen bg-slate-50 font-['Plus_Jakarta_Sans',sans-serif]">
            <div className="w-full max-w-[1400px] mx-auto">
                <header className="mb-8">
                    <h1 className="text-[28px] font-bold text-slate-900 tracking-tight m-0">EvaraFlow Analytics</h1>
                    <p className="text-[14px] text-slate-500 mt-1">Water Flow Rate & Consumption Monitoring</p>
                </header>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-6">
                    {/* Instant Flow Card */}
                    <div className="apple-glass-card rounded-[24px] p-6 shadow-sm border border-slate-100 flex items-center gap-4 transition-all hover:-translate-y-0.5 hover:shadow-md">
                        <div className="w-[44px] h-[90px] bg-slate-100 rounded-[10px] relative overflow-hidden border border-slate-200">
                            <div
                                className="absolute bottom-0 w-full bg-gradient-to-t from-[#0EA5E9] to-[#7DD3FC] transition-all duration-1000 ease-in-out"
                                style={{ height: `${fillPercentage}%` }}
                            ></div>
                        </div>
                        <div>
                            <div className="text-[12px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Instant Flow</div>
                            <div className="text-[32px] font-bold text-[#0EA5E9] leading-none mb-1">{flowRate.toFixed(1)}</div>
                            <div className="text-[12px] font-bold text-[#0EA5E9]">L/Min</div>
                        </div>
                    </div>

                    {/* KPI Cards */}
                    <div className="apple-glass-card rounded-[24px] p-6 shadow-sm border border-slate-100 transition-all hover:-translate-y-0.5 hover:shadow-md">
                        <div className="text-[12px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Cumulative Usage</div>
                        <div className="text-[32px] font-bold text-[#0EA5E9] leading-none my-2">1,240 L</div>
                        <div className="text-[13px] text-slate-500 mt-1">Today</div>
                    </div>

                    <div className="apple-glass-card rounded-[24px] p-6 shadow-sm border border-slate-100 transition-all hover:-translate-y-0.5 hover:shadow-md">
                        <div className="text-[12px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Peak Flow</div>
                        <div className="text-[32px] font-bold text-[#0EA5E9] leading-none my-2">28.4 L</div>
                        <div className="text-[13px] text-amber-500 font-medium mt-1">08:45 AM</div>
                    </div>

                    <div className="apple-glass-card rounded-[24px] p-6 shadow-sm border border-slate-100 transition-all hover:-translate-y-0.5 hover:shadow-md">
                        <div className="text-[12px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Efficiency</div>
                        <div className="text-[32px] font-bold text-[#0EA5E9] leading-none my-2">94%</div>
                        <div className="text-[13px] text-emerald-500 font-bold mt-1">Optimal Range</div>
                    </div>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 mb-6">
                    {/* Consumption Trends Chart */}
                    <div className="xl:col-span-3 apple-glass-card rounded-[24px] p-6 shadow-sm border border-slate-100">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-[18px] font-bold text-slate-800 m-0">Consumption Trends</h3>
                            <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
                                {['Last 24h', 'Last 3d', 'Last 7d', 'Last 30d'].map((filter) => (
                                    <button
                                        key={filter}
                                        onClick={() => setCurrentFilter(filter)}
                                        className={clsx(
                                            "px-3 py-1.5 text-[12px] font-bold rounded-lg transition-all",
                                            currentFilter === filter
                                                ? "bg-[#0EA5E9] text-white shadow-sm"
                                                : "text-slate-500 hover:text-slate-700 bg-transparent"
                                        )}
                                    >
                                        {filter}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="h-[300px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={flowData} margin={{ top: 10, right: 10, bottom: 0, left: -20 }}>
                                    <defs>
                                        <filter id="glowFlow" x="-20%" y="-20%" width="140%" height="140%">
                                            <feGaussianBlur stdDeviation="4" result="blur" />
                                            <feComposite in="SourceGraphic" in2="blur" operator="over" />
                                        </filter>
                                        <linearGradient id="colorFlow" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#0EA5E9" stopOpacity={0.2} />
                                            <stop offset="95%" stopColor="#0EA5E9" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                                    <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 12, fontWeight: 600 }} dy={10} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 12, fontWeight: 600 }} dx={-10} />
                                    <RechartsTooltip content={<CustomTooltip />} cursor={{ stroke: '#CBD5E1', strokeWidth: 1, strokeDasharray: '4 4' }} />
                                    <Line
                                        type="monotone"
                                        dataKey="value"
                                        stroke="#0EA5E9"
                                        strokeWidth={4}
                                        dot={{ r: 5, fill: '#0EA5E9', strokeWidth: 2, stroke: '#fff' }}
                                        activeDot={{ r: 7, strokeWidth: 0, fill: '#0369A1' }}
                                        filter="url(#glowFlow)"
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Usage Doughnut */}
                    <div className="apple-glass-card rounded-[24px] p-6 shadow-sm border border-slate-100 flex flex-col items-center">
                        <div className="w-full flex justify-start mb-4">
                            <h3 className="text-[16px] font-bold text-slate-800 m-0 mb-4">Usage by Period</h3>
                        </div>
                        <div className="h-[180px] w-full relative">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={pieData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius="70%"
                                        outerRadius="90%"
                                        paddingAngle={0}
                                        dataKey="value"
                                        stroke="none"
                                    >
                                        {pieData.map((_, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <RechartsTooltip content={<CustomTooltip />} />
                                </PieChart>
                            </ResponsiveContainer>
                            <div className="absolute inset-0 flex items-center justify-center flex-col pointer-events-none">
                                <span className="text-[20px] font-black text-slate-800">100%</span>
                            </div>
                        </div>
                        <div className="mt-4 w-full flex flex-col gap-2">
                            <div className="flex justify-between items-center text-[13px]">
                                <span className="text-slate-600 flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-[#0EA5E9]"></div> Morning Peak</span>
                                <span className="font-bold text-slate-800">45%</span>
                            </div>
                            <div className="flex justify-between items-center text-[13px]">
                                <span className="text-slate-600 flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-slate-200"></div> Standard Usage</span>
                                <span className="font-bold text-slate-800">55%</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
                    {/* Live Flow Bar */}
                    <div className="xl:col-span-2 apple-glass-card rounded-[24px] p-6 shadow-sm border border-slate-100">
                        <h3 className="text-[16px] font-bold text-slate-800 m-0 mb-4">Instantaneous Flow Indicator</h3>
                        <div className="h-[160px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={liveFlowHistory} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                                    <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 12, fontWeight: 600 }} dy={5} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 12, fontWeight: 600 }} dx={-5} />
                                    <RechartsTooltip content={<CustomTooltip />} cursor={{ fill: '#F1F5F9' }} />
                                    <Bar dataKey="value" fill="#7DD3FC" radius={[6, 6, 6, 6]} maxBarSize={40}>
                                        {liveFlowHistory.map((_: any, index: number) => (
                                            <Cell key={`cell-${index}`} fill={index === liveFlowHistory.length - 1 ? '#0EA5E9' : '#7DD3FC'} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Flow Integrity Alerts */}
                    <div className="xl:col-span-2 apple-glass-card rounded-[24px] p-6 shadow-sm border border-slate-100">
                        <h3 className="text-[16px] font-bold text-slate-800 m-0 mb-4">Flow Integrity Alerts</h3>
                        <div className="flex flex-col">
                            <div className="flex justify-between items-center py-3 border-b border-slate-100">
                                <span className="flex items-center text-[14px] text-slate-700 font-medium">
                                    <div className="w-2 h-2 rounded-full bg-emerald-500 mr-2 shadow-[0_0_0_2px_rgba(34,197,94,0.2)]"></div>
                                    Continuous Flow (Leak)
                                </span>
                                <span className="text-[12px] font-extrabold text-emerald-500">SECURE</span>
                            </div>
                            <div className="flex justify-between items-center py-3 border-b border-slate-100">
                                <span className="flex items-center text-[14px] text-slate-700 font-medium">
                                    <div className="w-2 h-2 rounded-full bg-red-500 mr-2 shadow-[0_0_0_2px_rgba(239,68,68,0.2)]"></div>
                                    Unusual Flow Spike
                                </span>
                                <span className="text-[12px] font-extrabold text-red-500">ALERT: 11:20 AM</span>
                            </div>
                            <div className="flex justify-between items-center py-3 border-b border-slate-100">
                                <span className="flex items-center text-[14px] text-slate-700 font-medium">
                                    <div className="w-2 h-2 rounded-full bg-amber-500 mr-2 shadow-[0_0_0_2px_rgba(245,158,11,0.2)]"></div>
                                    No-Flow Condition
                                </span>
                                <span className="text-[12px] font-extrabold text-amber-500">VERIFYING...</span>
                            </div>
                            <div className="flex justify-between items-center py-3">
                                <span className="flex items-center text-[14px] text-slate-700 font-medium">
                                    <div className="w-2 h-2 rounded-full bg-emerald-500 mr-2 shadow-[0_0_0_2px_rgba(34,197,94,0.2)]"></div>
                                    Flow Direction Status
                                </span>
                                <span className="text-[12px] font-extrabold text-emerald-500">NORMAL</span>
                            </div>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default EvaraFlowAnalytics;
