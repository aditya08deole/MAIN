import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';
import { MapPin, Database, Droplet } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
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

const EvaraDeepAnalytics = () => {
    const [waterDepth, setWaterDepth] = useState(145);

    const radarData = [
        { subject: 'Monsoon', A: 90, fullMark: 100 },
        { subject: 'Winter', A: 70, fullMark: 100 },
        { subject: 'Summer', A: 40, fullMark: 100 },
        { subject: 'Pre-Mon', A: 55, fullMark: 100 },
    ];

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

    // Derive Deep Chart Data
    const rawFeeds = historyData?.feeds || [];
    const trendData = rawFeeds.map((feed: any) => {
        let d = new Date(feed.created_at);
        const timeStr = d.getHours() + ":" + (d.getMinutes() < 10 ? '0' : '') + d.getMinutes();
        const base = parseFloat(feed.field1) || 40;
        return { time: timeStr, value: 120 + (base % 40) };
    });

    useEffect(() => {
        if (!telemetryData) return;

        // Process Incoming telemetry
        // Synthesize depth from the feed value to create a dynamic number (using field1 for demo)
        const baseValue = parseFloat(telemetryData.data.field1) || 40;
        // Create a plausible depth between 120 and 160m based on the data
        const dynamicDepth = 120 + (baseValue % 40);
        setWaterDepth(dynamicDepth);
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
                    console.log("Realtime Update Received for Deep!", payload);
                    refetch();
                    refetchHistory();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [TARGET_DEVICE_ID, refetch]);


    // Calculate depth fill percentage for the CSS animation (max 200m)
    const fillPercentage = Math.min((waterDepth / 200) * 100, 100);

    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-slate-800 text-white text-xs font-bold px-3 py-2 rounded-lg shadow-xl border border-slate-700">
                    <p className="mb-1 text-slate-300">{label}</p>
                    <p className="text-[#38BDF8]">{`${payload[0].value.toFixed(1)}m`}</p>
                </div>
            );
        }
        return null;
    };

    return (
        <div className="w-full pt-[140px] pb-12 px-8 min-h-screen bg-slate-50 font-['Plus_Jakarta_Sans',sans-serif]">
            <div className="w-full max-w-[1400px] mx-auto">
                <header className="mb-8">
                    <h1 className="text-[28px] font-bold text-slate-900 tracking-tight m-0">EvaraDeep Analytics</h1>
                    <p className="text-[14px] text-slate-500 mt-1">Borewell Health & Groundwater Monitoring</p>
                </header>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-6">
                    {/* Depth Card */}
                    <div className="apple-glass-card rounded-[24px] p-6 shadow-sm border border-slate-100 flex items-center gap-5 transition-all hover:-translate-y-0.5 hover:shadow-md">
                        <div className="w-[50px] h-[120px] bg-slate-100 rounded-[12px] relative overflow-hidden border-2 border-slate-200">
                            <div
                                className="absolute bottom-0 w-full bg-gradient-to-t from-blue-900 to-blue-500 rounded-b-[10px] transition-all duration-1000 ease-in-out"
                                style={{ height: `${fillPercentage}%` }}
                            ></div>
                        </div>
                        <div>
                            <div className="text-[12px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Current Depth</div>
                            <div className="text-[32px] font-bold text-slate-900 leading-none mb-1">{waterDepth.toFixed(0)}m</div>
                            <div className="text-[12px] font-bold text-emerald-500">Static: 42m</div>
                        </div>
                    </div>

                    {/* KPI Cards */}
                    <div className="apple-glass-card rounded-[24px] p-6 shadow-sm border border-slate-100 transition-all hover:-translate-y-0.5 hover:shadow-md">
                        <div className="text-[12px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Dynamic Level</div>
                        <div className="text-[32px] font-bold text-slate-900 leading-none my-2">58m</div>
                        <div className="text-[13px] text-amber-500 font-bold mt-1">Pump Active</div>
                    </div>

                    <div className="apple-glass-card rounded-[24px] p-6 shadow-sm border border-slate-100 transition-all hover:-translate-y-0.5 hover:shadow-md">
                        <div className="text-[12px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Recharge Rate</div>
                        <div className="text-[32px] font-bold text-slate-900 leading-none my-2">1.2m/hr</div>
                        <div className="text-[13px] text-[#38BDF8] font-bold mt-1">↑ Stable</div>
                    </div>

                    <div className="apple-glass-card rounded-[24px] p-6 shadow-sm border border-slate-100 transition-all hover:-translate-y-0.5 hover:shadow-md">
                        <div className="text-[12px] font-semibold text-slate-500 uppercase tracking-wide mb-1">Sustainability</div>
                        <div className="text-[32px] font-bold text-slate-900 leading-none my-2">Optimal</div>
                        <div className="text-[13px] text-emerald-500 font-bold mt-1">Healthy Source</div>
                    </div>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 mb-6">
                    {/* Sustainability Trends Chart */}
                    <div className="xl:col-span-3 apple-glass-card rounded-[24px] p-6 shadow-sm border border-slate-100">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-[18px] font-bold text-slate-800 m-0">Sustainability Trends</h3>
                        </div>
                        <div className="h-[300px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={trendData} margin={{ top: 10, right: 10, bottom: 0, left: -20 }}>
                                    <defs>
                                        <filter id="glowDeep" x="-20%" y="-20%" width="140%" height="140%">
                                            <feGaussianBlur stdDeviation="3" result="blur" />
                                            <feComposite in="SourceGraphic" in2="blur" operator="over" />
                                        </filter>
                                        <linearGradient id="colorDeep" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#0F172A" stopOpacity={0.15} />
                                            <stop offset="95%" stopColor="#0F172A" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                                    <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 12, fontWeight: 600 }} dy={10} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748B', fontSize: 12, fontWeight: 600 }} dx={-10} domain={[120, 180]} />
                                    <RechartsTooltip content={<CustomTooltip />} cursor={{ stroke: '#CBD5E1', strokeWidth: 1, strokeDasharray: '4 4' }} />
                                    <Line
                                        type="monotone"
                                        dataKey="value"
                                        stroke="#0F172A"
                                        strokeWidth={3}
                                        dot={{ r: 4, fill: '#0F172A', strokeWidth: 2, stroke: '#fff' }}
                                        activeDot={{ r: 6, strokeWidth: 0, fill: '#0F172A' }}
                                        filter="url(#glowDeep)"
                                    />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Seasonal Radar */}
                    <div className="apple-glass-card rounded-[24px] p-6 shadow-sm border border-slate-100 flex flex-col items-center">
                        <div className="w-full flex justify-start mb-2">
                            <h3 className="text-[16px] font-bold text-slate-800 m-0 text-left w-full">Seasonal Variation</h3>
                        </div>
                        <div className="h-[220px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
                                    <PolarGrid stroke="#E2E8F0" />
                                    <PolarAngleAxis dataKey="subject" tick={{ fill: '#64748B', fontSize: 11, fontWeight: 600 }} />
                                    <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                                    <Radar name="Seasonal" dataKey="A" stroke="#38BDF8" fill="#38BDF8" fillOpacity={0.2} strokeWidth={2} />
                                    <RechartsTooltip />
                                </RadarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
                    {/* Advanced Analytics */}
                    <div className="xl:col-span-2 apple-glass-card rounded-[24px] p-6 shadow-sm border border-slate-100">
                        <h3 className="text-[16px] font-bold text-slate-800 m-0 mb-4">Advanced Analytics</h3>
                        <div className="grid grid-cols-3 gap-4">
                            <div className="bg-slate-100/50 p-4 rounded-2xl text-center hover:bg-sky-50 transition-colors cursor-pointer border border-slate-200">
                                <div className="h-10 flex items-end justify-center gap-1 mb-3">
                                    <div className="w-2 rounded bg-[#38BDF8]" style={{ height: '40%' }}></div>
                                    <div className="w-2 rounded bg-[#38BDF8]" style={{ height: '70%' }}></div>
                                    <div className="w-2 rounded bg-[#38BDF8]" style={{ height: '100%' }}></div>
                                </div>
                                <span className="text-[12px] font-bold text-slate-800 leading-tight block">Long-term<br />Groundwater</span>
                            </div>
                            <div className="bg-slate-100/50 p-4 rounded-2xl text-center hover:bg-sky-50 transition-colors cursor-pointer border border-slate-200">
                                <div className="h-10 flex items-center justify-center mb-3">
                                    <div className="w-8 h-8 rounded-full border-4 border-[#38BDF8] border-r-transparent rotate-45"></div>
                                </div>
                                <span className="text-[12px] font-bold text-slate-800 leading-tight block">Seasonal<br />Variation</span>
                            </div>
                            <div className="bg-slate-100/50 p-4 rounded-2xl text-center hover:bg-sky-50 transition-colors cursor-pointer border border-slate-200">
                                <div className="h-10 flex items-end justify-center gap-1 mb-3">
                                    <div className="w-2 rounded bg-emerald-500" style={{ height: '100%' }}></div>
                                    <div className="w-2 rounded bg-emerald-500" style={{ height: '80%' }}></div>
                                    <div className="w-2 rounded bg-emerald-500" style={{ height: '90%' }}></div>
                                </div>
                                <span className="text-[12px] font-bold text-slate-800 leading-tight block">Borewell<br />Sustainability</span>
                            </div>
                        </div>
                    </div>

                    {/* Use Cases */}
                    <div className="xl:col-span-2 apple-glass-card rounded-[24px] p-6 shadow-sm border border-slate-100">
                        <h3 className="text-[16px] font-bold text-slate-800 m-0 mb-4">Use Cases</h3>
                        <div className="flex flex-col gap-3">
                            <div className="flex items-center justify-between p-3 px-4 bg-slate-100/50 rounded-2xl border-l-[4px] border-[#38BDF8]">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center shadow-sm text-[#38BDF8]">
                                        <MapPin size={18} />
                                    </div>
                                    <span className="text-[14px] font-bold text-slate-800">Borewell Monitoring</span>
                                </div>
                                <span className="bg-emerald-100 text-emerald-600 px-2 py-1 rounded-[10px] text-[10px] font-black tracking-wide">LIVE</span>
                            </div>

                            <div className="flex items-center justify-between p-3 px-4 bg-slate-100/50 rounded-2xl border-l-[4px] border-slate-900">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center shadow-sm text-slate-900">
                                        <Database size={18} />
                                    </div>
                                    <span className="text-[14px] font-bold text-slate-800">Underground Storage</span>
                                </div>
                                <span className="bg-emerald-100 text-emerald-600 px-2 py-1 rounded-[10px] text-[10px] font-black tracking-wide">SECURE</span>
                            </div>

                            <div className="flex items-center justify-between p-3 px-4 bg-slate-100/50 rounded-2xl border-l-[4px] border-emerald-500">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center shadow-sm text-emerald-500">
                                        <Droplet size={18} />
                                    </div>
                                    <span className="text-[14px] font-bold text-slate-800">Source Health Tracking</span>
                                </div>
                                <span className="bg-emerald-100 text-emerald-600 px-2 py-1 rounded-[10px] text-[10px] font-black tracking-wide">GOOD</span>
                            </div>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default EvaraDeepAnalytics;
