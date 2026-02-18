import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import {
    Activity, Droplets, ArrowUpRight, AlertTriangle,
    Server, Clock, Download, FileText
} from 'lucide-react';

import { useNodes } from '../hooks/useNodes';
import { useAuth } from '../context/AuthContext';
import ErrorBoundary from '../components/ErrorBoundary';
import type { NodeRow } from '../types/database';
import { getSystemHealth, type SystemHealth } from '../services/dashboard';
import { getActiveAlerts, type AlertHistory } from '../services/alerts';

// Custom Purple Icon (Pump House)
const purpleIcon = L.divIcon({
    className: 'custom-purple-icon',
    html: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="#9333ea" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-map-pin drop-shadow-md"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>`,
    iconSize: [24, 24],
    iconAnchor: [12, 24],
    popupAnchor: [0, -24]
});

// Custom Green Icon (Sump)
const greenIcon = L.divIcon({
    className: 'custom-green-icon',
    html: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="#16a34a" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-map-pin drop-shadow-md"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>`,
    iconSize: [24, 24],
    iconAnchor: [12, 24],
    popupAnchor: [0, -24]
});

// Custom Blue Icon (OHT)
const blueIcon = L.divIcon({
    className: 'custom-blue-icon',
    html: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="#2563eb" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-map-pin drop-shadow-md"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>`,
    iconSize: [24, 24],
    iconAnchor: [12, 24],
    popupAnchor: [0, -24]
});

// Custom Yellow Icon (Borewell)
const yellowIcon = L.divIcon({
    className: 'custom-yellow-icon',
    html: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="#eab308" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-map-pin drop-shadow-md"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>`,
    iconSize: [24, 24],
    iconAnchor: [12, 24],
    popupAnchor: [0, -24]
});

// Custom Black Icon (Govt Borewell)
const blackIcon = L.divIcon({
    className: 'custom-black-icon',
    html: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="#1e293b" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-map-pin drop-shadow-md"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>`,
    iconSize: [24, 24],
    iconAnchor: [12, 24],
    popupAnchor: [0, -24]
});

// Custom Red Icon (Alert/Offline)
const redIcon = L.divIcon({
    className: 'custom-red-icon',
    html: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="#ef4444" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-map-pin drop-shadow-md"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>`,
    iconSize: [24, 24],
    iconAnchor: [12, 24],
    popupAnchor: [0, -24]
});

// ─── MiniMap Component ────────────────────────────────────────────────────────
const MiniMap = ({ onExpand, nodes }: { onExpand: () => void, nodes: NodeRow[] }) => {
    return (
        <div
            className="relative h-full w-full rounded-2xl overflow-hidden border border-slate-200 shadow-sm group hover:shadow-md hover:ring-2 hover:ring-blue-100 transition-all duration-300"
        >
            <MapContainer
                center={[17.4456, 78.3490]}
                zoom={14}
                className="h-full w-full"
                zoomControl={true}
                dragging={true}
                doubleClickZoom={true}
                scrollWheelZoom={true}
                attributionControl={false}
            >
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                {nodes.map(node => {
                    let icon = blueIcon;
                    if (node.status === 'Alert' || node.status === 'Offline') icon = redIcon;
                    else if (node.category === 'PumpHouse') icon = purpleIcon;
                    else if (node.category === 'Sump') icon = greenIcon;
                    else if (node.category === 'OHT') icon = blueIcon;
                    else if (node.category === 'Borewell') icon = yellowIcon;
                    else if (node.category === 'GovtBorewell') icon = blackIcon;

                    return (
                        <Marker
                            key={node.id}
                            position={[node.lat || 17.44, node.lng || 78.34]}
                            icon={icon}
                        />
                    );
                })}
            </MapContainer>

            {/* Click-to-Expand Interaction Layer */}
            {/* We place a button that is only visible/active on the edges or as a clear cue, 
                but to satisfy "click anywhere", we'll put a button that covers the map 
                but allows clicks to pass through if we use pointer-events-none on map elements? 
                Actually, the cleanest way is a hover button. */}
            <button
                onClick={onExpand}
                className="absolute inset-0 z-[400] bg-transparent hover:bg-blue-600/5 transition-colors group cursor-pointer flex items-center justify-center"
                title="Open Full Map"
            >
                <div className="bg-white/90 backdrop-blur text-blue-600 px-4 py-2 rounded-xl shadow-xl opacity-0 group-hover:opacity-100 transform translate-y-2 group-hover:translate-y-0 transition-all duration-300 flex items-center gap-2 font-bold z-[401]">
                    <ArrowUpRight size={20} />
                    Open Full Map
                </div>
            </button>

            {/* Legend (Simplified) */}
            <div className="absolute bottom-4 left-4 bg-white/95 backdrop-blur px-3 py-2 rounded-lg shadow-lg border border-white/50 z-[402] flex gap-3 scale-90 origin-bottom-left pointer-events-none">
                <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-purple-600 inline-block" /><span className="text-[10px] font-semibold text-slate-600">PH</span></div>
                <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-green-600 inline-block" /><span className="text-[10px] font-semibold text-slate-600">Sump</span></div>
                <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-600 inline-block" /><span className="text-[10px] font-semibold text-slate-600">OHT</span></div>
                <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-yellow-500 inline-block" /><span className="text-[10px] font-semibold text-slate-600">Bore</span></div>
            </div>
        </div>
    );
};

// ─── Main Dashboard ───────────────────────────────────────────────────────────

const Dashboard = () => {
    const { loading } = useAuth();
    const { nodes, loading: nodesLoading } = useNodes();
    const navigate = useNavigate();
    const [now] = useState(() => new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }));
    const [isNavigating, setIsNavigating] = useState(false);

    const [health, setHealth] = useState<SystemHealth | null>(null);
    const [activeAlerts, setActiveAlerts] = useState<AlertHistory[]>([]);

    useEffect(() => {
        getSystemHealth().then(setHealth).catch(console.error);
        getActiveAlerts().then(setActiveAlerts).catch(console.error);
    }, []);

    // Derived stats from Nodes (Real-time)
    const tanks = nodes.filter(n => ['OHT', 'Sump', 'PumpHouse'].includes(n.category));
    const flow = nodes.filter(n => n.category === 'FlowMeter');
    const borewells = nodes.filter(n => ['Borewell', 'GovtBorewell'].includes(n.category));

    const localStats = {
        tanks: { active: tanks.filter(n => n.status === 'Online').length, total: tanks.length },
        flow: { active: flow.filter(n => n.status === 'Online').length, total: flow.length },
        deep: { active: borewells.filter(n => n.status === 'Online').length, total: borewells.length },
        alerts: nodes.filter(n => n.status === 'Alert' || n.status === 'Offline').length
    };

    const deviceFleet = nodes.slice(0, 5).map(n => ({
        id: n.id,
        name: n.label || n.id,
        type: n.category,
        status: n.status,
        lastComm: 'Just now', // Mock
        health: n.status === 'Online' ? 95 : 40 // Mock
    }));

    if (loading || nodesLoading) {
        return (
            <div className="h-screen w-screen flex items-center justify-center bg-slate-50">
                <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    const handleMapClick = () => {
        setIsNavigating(true);
        setTimeout(() => {
            navigate('/home');
        }, 300);
    };

    return (
        <div className="h-screen flex flex-col p-5 bg-slate-50 font-sans overflow-hidden">

            {/* Navigation Overlay Animation */}
            {/* Navigation Overlay Animation - Simple & Clean */}
            <div className={`fixed inset-0 bg-white/40 backdrop-blur-[2px] z-[9999] pointer-events-none transition-opacity duration-500 ease-in-out ${isNavigating ? 'opacity-100' : 'opacity-0'}`} />

            <div className={`fixed top-0 left-0 right-0 h-1 bg-blue-500 z-[10000] pointer-events-none transition-all duration-700 ${isNavigating ? 'w-full opacity-100' : 'w-0 opacity-0'}`} />

            {/* ── Header ── */}
            <div className="flex-none flex items-center justify-between mb-5">
                <h1 className="text-4xl font-extrabold text-blue-600 tracking-tight">System Dashboard</h1>
                <span className="text-base font-semibold text-slate-400">Last updated: <span className="text-slate-600">{now}</span></span>
            </div>

            {/* ── Top Row ── */}
            {/* Reduced height to 250px for strict no-scroll */}
            <div className="flex-none grid grid-cols-12 gap-4 mb-4" style={{ height: '250px' }}>

                {/* Left 8 cols: stacked KPI rows */}
                <div className="col-span-8 flex flex-col gap-4 h-full">

                    {/* Top Row: Stats & Health */}
                    <div className="col-span-12 grid grid-cols-1 md:grid-cols-4 gap-6">
                        {/* Stat Cards */}
                        <div className="bg-white/80 backdrop-blur-md p-6 rounded-2xl shadow-sm border border-white/50 flex flex-col justify-between hover:shadow-md transition-all duration-300">
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className="text-sm font-medium text-slate-500 mb-1">Total Assets</p>
                                    <h2 className="text-3xl font-bold text-slate-800">{nodes.length}</h2>
                                </div>
                                <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                                    <Activity className="w-5 h-5" />
                                </div>
                            </div>
                            <div className="mt-4 flex items-center gap-2 text-xs font-medium text-green-600 bg-green-50 w-fit px-2 py-1 rounded-lg">
                                <span className="w-1.5 h-1.5 rounded-full bg-green-600"></span>
                                All Systems Operational
                            </div>
                        </div>

                        <div className="bg-white/80 backdrop-blur-md p-6 rounded-2xl shadow-sm border border-white/50 flex flex-col justify-between hover:shadow-md transition-all duration-300">
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className="text-sm font-medium text-slate-500 mb-1">Active Alerts</p>
                                    <h2 className="text-3xl font-bold text-slate-800">{activeAlerts.length}</h2>
                                </div>
                                <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
                                    <AlertTriangle className="w-5 h-5" />
                                </div>
                            </div>
                            <div className="mt-4 flex items-center gap-2 text-xs font-medium text-slate-500 cursor-pointer" onClick={() => navigate('/alerts')}>
                                View all alerts &rarr;
                            </div>
                        </div>

                        <div className="bg-white/80 backdrop-blur-md p-6 rounded-2xl shadow-sm border border-white/50 flex flex-col justify-between hover:shadow-md transition-all duration-300">
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className="text-sm font-medium text-slate-500 mb-1">System Health</p>
                                    <h2 className="text-xl font-bold text-slate-800 capitalize">{health?.status || 'Active'}</h2>
                                </div>
                                <div className={`p-3 rounded-xl ${health?.status === 'ok' ? 'bg-green-50 text-green-600' : 'bg-green-50 text-green-600'}`}>
                                    <Server className="w-5 h-5" />
                                </div>
                            </div>
                            <div className="mt-4 flex flex-col gap-1 text-xs text-slate-500">
                                <div className="flex justify-between">
                                    <span>DB:</span>
                                    <span className={health?.services.database === 'ok' ? 'text-green-600' : 'text-green-600'}>
                                        {health?.services.database || 'OK'}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span>IoT Broker:</span>
                                    <span className={health?.services.thingspeak === 'ok' ? 'text-green-600' : 'text-green-600'}>
                                        {health?.services.thingspeak || 'OK'}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Placeholder for future stat */}
                        <div className="bg-white/80 backdrop-blur-md p-6 rounded-2xl shadow-sm border border-white/50 flex flex-col justify-between hover:shadow-md transition-all duration-300 opacity-50">
                            <div className="flex justify-between items-start">
                                <div>
                                    <p className="text-sm font-medium text-slate-500 mb-1">Water Saved</p>
                                    <h2 className="text-3xl font-bold text-slate-800">--</h2>
                                </div>
                                <div className="p-3 bg-cyan-50 text-cyan-600 rounded-xl">
                                    <Droplets className="w-5 h-5" />
                                </div>
                            </div>
                            <div className="mt-4 text-xs font-medium text-slate-400">Coming Soon</div>
                        </div>
                    </div>
                    {/* Row 2 — 4 device-type counters */}
                    <div className="flex-1 grid grid-cols-4 gap-4">
                        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm px-5 flex flex-col justify-center items-start gap-1 hover:shadow-md transition-shadow">
                            <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Tanks</span>
                            <div className="flex items-baseline gap-1">
                                <span className="text-4xl font-extrabold text-blue-600">{localStats.tanks.active}</span>
                                <span className="text-2xl font-bold text-slate-300">/{localStats.tanks.total}</span>
                            </div>
                        </div>
                        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm px-5 flex flex-col justify-center items-start gap-1 hover:shadow-md transition-shadow">
                            <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Flow</span>
                            <div className="flex items-baseline gap-1">
                                <span className="text-4xl font-extrabold text-cyan-600">{localStats.flow.active}</span>
                                <span className="text-2xl font-bold text-slate-300">/{localStats.flow.total}</span>
                            </div>
                        </div>
                        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm px-5 flex flex-col justify-center items-start gap-1 hover:shadow-md transition-shadow">
                            <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Deep</span>
                            <div className="flex items-baseline gap-1">
                                <span className="text-4xl font-extrabold text-purple-600">{localStats.deep.active}</span>
                                <span className="text-2xl font-bold text-slate-300">/{localStats.deep.total}</span>
                            </div>
                        </div>
                        <div className="bg-white rounded-2xl border-l-4 border-l-red-500 border border-red-100 shadow-sm px-5 flex flex-col justify-center items-start gap-1 hover:shadow-md transition-shadow">
                            <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Alerts</span>
                            <span className="text-4xl font-extrabold text-red-600">{localStats.alerts}</span>
                        </div>
                    </div>
                </div>

                {/* Right 4 cols: Map */}
                <div className="col-span-4 h-full">
                    <MiniMap onExpand={handleMapClick} nodes={nodes} />
                </div>
            </div>

            {/* ── Bottom Row — INCREASED FONTS as requested ── */}
            <div className="flex-1 min-h-0 grid grid-cols-3 gap-4">

                {/* Col 1: Device Fleet */}
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col overflow-hidden hover:shadow-md transition-shadow">
                    <div className="px-5 py-4 border-b border-slate-50 flex justify-between items-center flex-none">
                        <div>
                            <h2 className="text-xl font-extrabold text-slate-800 flex items-center gap-2">
                                <Server size={24} className="text-blue-500" /> Device Fleet
                            </h2>
                        </div>
                        <button className="text-blue-500 hover:text-blue-600 transition-colors font-bold text-2xl" onClick={() => navigate('/home')}>+</button>
                    </div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                        <table className="w-full text-left">
                            <thead className="sticky top-0 bg-white z-10">
                                <tr className="border-b border-slate-50 text-xs font-extrabold text-slate-400 uppercase tracking-widest">
                                    <th className="px-5 py-3">Device</th>
                                    <th className="px-5 py-3">Status</th>
                                    <th className="px-5 py-3 text-right">Health</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50 text-base">
                                {deviceFleet.map(dev => (
                                    <tr key={dev.id} className="hover:bg-slate-50/60 transition-colors cursor-pointer" onClick={() => navigate(`/devices/${dev.id}`)}>
                                        <td className="px-5 py-4">
                                            <div className="font-bold text-slate-700 text-base">{dev.name}</div>
                                            <div className="text-xs text-blue-400 font-mono">{dev.type}</div>
                                        </td>
                                        <td className="px-5 py-4">
                                            <div className={`flex items-center gap-2 font-bold text-sm ${dev.status === 'Online' ? 'text-green-600' :
                                                dev.status === 'Alert' ? 'text-red-600' :
                                                    dev.status === 'Maintenance' ? 'text-amber-600' : 'text-slate-500'
                                                }`}>
                                                <div className={`w-2 h-2 rounded-full ${dev.status === 'Online' ? 'bg-green-500' :
                                                    dev.status === 'Alert' ? 'bg-red-500' :
                                                        dev.status === 'Maintenance' ? 'bg-amber-500' : 'bg-slate-400'
                                                    }`} />
                                                {dev.status}
                                            </div>
                                            <div className="text-xs text-slate-400 mt-1">{dev.lastComm}</div>
                                        </td>
                                        <td className="px-5 py-4 text-right">
                                            <div className={`font-bold text-sm ${dev.health > 90 ? 'text-green-600' : dev.health > 50 ? 'text-amber-600' : 'text-red-600'}`}>
                                                {dev.health}%
                                            </div>
                                            <div className="w-full h-1.5 bg-slate-100 rounded-full mt-1.5 overflow-hidden">
                                                <div className={`h-full rounded-full ${dev.health > 90 ? 'bg-green-500' : dev.health > 50 ? 'bg-amber-500' : 'bg-red-500'}`} style={{ width: `${dev.health}%` }} />
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Col 2: Alerts */}
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col overflow-hidden hover:shadow-md transition-shadow">
                    <div className="px-5 py-4 border-b border-slate-50 flex justify-between items-center flex-none">
                        <div>
                            <h2 className="text-xl font-extrabold text-slate-800 flex items-center gap-2">
                                <AlertTriangle size={24} className="text-red-500" /> Alerts
                            </h2>
                        </div>
                        <span className="px-3 py-1 bg-red-50 text-red-600 font-extrabold text-xs rounded-full">{activeAlerts.length} Active</span>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                        {activeAlerts.length === 0 ? (
                            <div className="text-center text-slate-400 mt-10">No active alerts</div>
                        ) : activeAlerts.map(a => (
                            <div key={a.id} className="p-4 hover:bg-slate-50 rounded-xl transition-colors cursor-pointer group border border-transparent hover:border-slate-100">
                                <div className="flex justify-between items-start mb-2">
                                    <div className="flex items-center gap-2 text-base font-bold text-slate-800">
                                        <AlertTriangle size={16} className="text-amber-500 flex-shrink-0" />
                                        {a.rule?.name || 'Alert'}
                                    </div>
                                    <span className="text-xs text-slate-400 font-medium whitespace-nowrap ml-2">{new Date(a.triggered_at).toLocaleTimeString()}</span>
                                </div>
                                <p className="text-sm text-slate-500 pl-6 group-hover:text-slate-700 transition-colors leading-relaxed">
                                    Value {a.value_at_time} {a.rule?.condition} {a.rule?.threshold}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Col 3: Quick Reports */}
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col overflow-hidden hover:shadow-md transition-shadow">
                    <div className="px-5 py-4 border-b border-slate-50 flex-none">
                        <h2 className="text-xl font-extrabold text-slate-800 flex items-center gap-2">
                            <FileText size={24} className="text-purple-500" /> Quick Reports
                        </h2>
                    </div>
                    <div className="flex-1 p-5 flex flex-col gap-4 overflow-y-auto custom-scrollbar">
                        <button className="w-full flex items-center gap-5 p-5 bg-slate-50 rounded-xl border border-slate-100 hover:border-blue-200 hover:bg-blue-50 transition-all text-left group">
                            <div className="p-3 bg-white rounded-xl shadow-sm text-slate-400 group-hover:text-blue-500 transition-colors">
                                <Download size={24} />
                            </div>
                            <div>
                                <div className="text-lg font-bold text-slate-700 group-hover:text-blue-700">Daily Report</div>
                                <div className="text-sm text-slate-400 font-medium">Download PDF Format</div>
                            </div>
                        </button>
                        <button className="w-full flex items-center gap-5 p-5 bg-slate-50 rounded-xl border border-slate-100 hover:border-purple-200 hover:bg-purple-50 transition-all text-left group">
                            <div className="p-3 bg-white rounded-xl shadow-sm text-slate-400 group-hover:text-purple-500 transition-colors">
                                <Download size={24} />
                            </div>
                            <div>
                                <div className="text-lg font-bold text-slate-700 group-hover:text-purple-700">Custom Export</div>
                                <div className="text-sm text-slate-400 font-medium">Excel / CSV Format</div>
                            </div>
                        </button>

                        <div className="mt-auto bg-purple-50 p-5 rounded-xl border border-purple-100">
                            <div className="flex items-center gap-2 mb-2">
                                <Clock size={16} className="text-purple-500" />
                                <span className="text-xs font-extrabold text-purple-700 uppercase tracking-wider">Scheduled</span>
                            </div>
                            <p className="text-sm font-medium text-purple-700 leading-snug">
                                Monthly compliance report will be generated on <strong>28th Feb</strong>.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

const DashboardWithBoundary = () => (
    <ErrorBoundary>
        <Dashboard />
    </ErrorBoundary>
);

export default DashboardWithBoundary;

