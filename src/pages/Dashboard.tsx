import { useState } from 'react';
import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import {
    Layers, Activity, Droplets, ArrowUpRight, AlertTriangle,
    Clock, FileText, Download,
    Maximize2, Server
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

// ─── Leaflet Icon Fix ─────────────────────────────────────────────────────────
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

L.Marker.prototype.options.icon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41],
});

const makeIcon = (color: string, size = 26) => L.divIcon({
    className: '',
    html: `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="${color}" stroke="#fff" stroke-width="2"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
    popupAnchor: [0, -size],
});

const blueIcon = makeIcon('#2563eb');
const greenIcon = makeIcon('#16a34a');
const purpleIcon = makeIcon('#9333ea');
const amberIcon = makeIcon('#d97706', 20);
const redIcon = makeIcon('#ef4444', 20);
// slateIcon used for govt borewells not shown in mini-map

// ─── Map Data — all assets matching Home.tsx ─────────────────────────────────

const IIITH_CENTER: [number, number] = [17.4456, 78.3490];

// ─── Map Data — Fetched via useNodes ─────────────────────────────────
// Hardcoded arrays removed in favor of useNodes hook


// ─── Mock Dashboard Data ──────────────────────────────────────────────────────

const deviceFleet = [
    { id: 'FT-001', name: 'EvaraTank #1', type: 'Tank', status: 'Online', health: 98, lastComm: '2 min ago', signal: 'Strong' },
    { id: 'ED-003', name: 'EvaraDeep #3', type: 'Borewell', status: 'Online', health: 97, lastComm: '5 min ago', signal: 'Good' },
    { id: 'EF-002', name: 'EvaraFlow #2', type: 'Flow', status: 'Alert', health: 67, lastComm: '1 min ago', signal: 'Strong' },
    { id: 'ET-004', name: 'EvaraTank #4', type: 'Tank', status: 'Offline', health: 0, lastComm: '3 hrs ago', signal: 'None' },
    { id: 'ED-005', name: 'EvaraDeep #5', type: 'Borewell', status: 'Maintenance', health: 45, lastComm: '30 min ago', signal: 'Weak' },
];

const alertsList = [
    { id: 1, title: 'EvaraFlow #2', msg: 'Flow rate exceeded 30 L/min threshold', time: '10 min ago' },
    { id: 2, title: 'EvaraTank #4', msg: 'Device not responding since 3 hours', time: '3 hrs ago' },
    { id: 3, title: 'EvaraDeep #5', msg: 'Signal strength dropped below 40%', time: '30 min ago' },
    { id: 4, title: 'EvaraTank #1', msg: 'Tank level approaching 95% capacity', time: '1 hr ago' },
    { id: 5, title: 'EvaraDeep #3', msg: 'Scheduled maintenance required', time: '2 hrs ago' },
];

// ─── Mini Map Widget ──────────────────────────────────────────────────────────

import { useNodes } from '../hooks/useNodes';
import type { NodeRow } from '../types/database';

// ─── Mini Map Widget ──────────────────────────────────────────────────────────

const MiniMap = ({ onExpand, nodes }: { onExpand: () => void, nodes: NodeRow[] }) => {
    const pumpHouses = nodes.filter(n => n.category === 'PumpHouse');
    const sumps = nodes.filter(n => n.category === 'Sump');
    const ohts = nodes.filter(n => n.category === 'OHT');
    const borewells = nodes.filter(n => n.category === 'Borewell' || n.category === 'GovtBorewell');

    return (
        <div className="relative w-full h-full rounded-2xl overflow-hidden border border-slate-200 shadow-sm group cursor-pointer" onClick={onExpand}>
            <MapContainer
                center={IIITH_CENTER}
                zoom={16}
                zoomControl={false}
                scrollWheelZoom={false}
                dragging={false}
                doubleClickZoom={false}
                attributionControl={false}
                className="w-full h-full"
                style={{ pointerEvents: 'none' }}
            >
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />

                {/* All Sumps — green */}
                {sumps.map(s => <Marker key={s.id} position={[s.lat, s.lng]} icon={greenIcon} />)}

                {/* All OHTs — blue */}
                {ohts.map(o => <Marker key={o.id} position={[o.lat, o.lng]} icon={blueIcon} />)}

                {/* All Borewells — amber (working) / red (not working) */}
                {borewells.map(bw => (
                    <Marker key={bw.id} position={[bw.lat, bw.lng]} icon={(bw.status === 'Online') ? amberIcon : redIcon} />
                ))}

                {/* Pump Houses — purple (on top) */}
                {pumpHouses.map(p => <Marker key={p.id} position={[p.lat, p.lng]} icon={purpleIcon} />)}
            </MapContainer>

            {/* Hover overlay */}
            <div className="absolute inset-0 bg-slate-900/0 group-hover:bg-slate-900/15 transition-all duration-300 flex items-center justify-center">
                <div className="opacity-0 group-hover:opacity-100 transition-all duration-300 bg-white/90 backdrop-blur-sm px-4 py-2.5 rounded-xl shadow-lg flex items-center gap-2 text-sm font-bold text-slate-700">
                    <Maximize2 size={16} /> Expand Map
                </div>
            </div>

            {/* Live badge */}
            <div className="absolute top-3 right-3 z-[400] bg-white/90 backdrop-blur-sm px-2 py-1 rounded-lg shadow-sm border border-slate-100 flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                <span className="text-[10px] font-bold text-slate-600">Live</span>
            </div>

            {/* Mini legend */}
            <div className="absolute bottom-3 left-3 z-[400] bg-white/90 backdrop-blur-sm px-2.5 py-2 rounded-xl shadow-sm border border-slate-100 flex flex-col gap-1">
                <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-purple-600 inline-block" /><span className="text-[10px] font-semibold text-slate-600">Pump House</span></div>
                <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-600 inline-block" /><span className="text-[10px] font-semibold text-slate-600">OHT</span></div>
                <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-600 inline-block" /><span className="text-[10px] font-semibold text-slate-600">Sump</span></div>
                <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-500 inline-block" /><span className="text-[10px] font-semibold text-slate-600">Borewell</span></div>
            </div>
        </div>
    );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

const Dashboard = () => {
    const { loading } = useAuth();
    const { nodes, loading: nodesLoading } = useNodes();
    const navigate = useNavigate();
    const [now] = useState(() => new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }));
    const [isNavigating, setIsNavigating] = useState(false);

    if (loading || nodesLoading) {
        return (
            <div className="h-screen w-screen flex items-center justify-center bg-slate-50">
                <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    const handleMapClick = () => {
        setIsNavigating(true);
        // Small delay to allow animation to start before navigation
        setTimeout(() => {
            navigate('/home');
        }, 300);
    };

    const onlineCount = nodes.filter(n => n.status === 'Online').length;
    const totalCount = nodes.length;
    const alertCount = nodes.filter(n => n.status === 'Alert' || n.status === 'Offline').length;

    // Derived stats from real nodes data + mock consumption/device types
    const tankNodes = nodes.filter(n => n.category === 'OHT' || n.category === 'Sump' || n.category === 'PumpHouse');
    const flowNodes = nodes.filter(n => n.category === 'FlowMeter');
    const deepNodes = nodes.filter(n => n.category === 'Borewell' || n.category === 'GovtBorewell');

    const stats = {
        deployed: totalCount,
        onlineStatus: onlineCount,
        totalStatus: totalCount,
        consumption: '1.2M', // Placeholder until consumption is tracked
        saved: '350k',
        tanks: {
            active: tankNodes.filter(n => n.status === 'Online').length,
            total: tankNodes.length
        },
        flow: {
            active: flowNodes.filter(n => n.status === 'Online').length,
            total: flowNodes.length
        },
        deep: {
            active: deepNodes.filter(n => n.status === 'Online').length,
            total: deepNodes.length
        },
        alerts: alertCount,
    };

    return (
        <div className="h-screen flex flex-col p-5 bg-slate-50 font-sans overflow-hidden">

            {/* Navigation Overlay Animation */}
            <div className={`fixed inset-0 bg-white z-[9999] pointer-events-none transition-opacity duration-300 ${isNavigating ? 'opacity-100' : 'opacity-0'}`}>
                <div className="absolute inset-0 flex items-center justify-center">
                    <div className="flex flex-col items-center gap-3">
                        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
                        <span className="text-lg font-bold text-blue-600">Opening Map...</span>
                    </div>
                </div>
            </div>

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

                    {/* Row 1 — 4 main KPI cards */}
                    <div className="flex-1 grid grid-cols-4 gap-4">
                        {/* Total Deployed */}
                        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm px-5 py-4 flex flex-col justify-between hover:shadow-md transition-shadow">
                            <div className="flex justify-between items-center">
                                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Total Deployed</span>
                                <Layers size={22} className="text-blue-400 flex-shrink-0" />
                            </div>
                            <div className="text-5xl font-extrabold text-slate-800 leading-none">{stats.deployed}</div>
                            <span className="text-xs font-semibold text-slate-400">Devices active</span>
                        </div>

                        {/* Online Status */}
                        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm px-5 py-4 flex flex-col justify-between hover:shadow-md transition-shadow">
                            <div className="flex justify-between items-center">
                                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Online</span>
                                <Activity size={22} className="text-green-400 flex-shrink-0" />
                            </div>
                            <div className="flex items-baseline gap-1 leading-none">
                                <span className="text-5xl font-extrabold text-slate-800">{stats.onlineStatus}</span>
                                <span className="text-2xl font-bold text-slate-400">/{stats.totalStatus}</span>
                            </div>
                            <span className="text-xs font-semibold text-green-500">System healthy</span>
                        </div>

                        {/* Consumption */}
                        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm px-5 py-4 flex flex-col justify-between hover:shadow-md transition-shadow">
                            <div className="flex justify-between items-center">
                                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Consumption</span>
                                <Droplets size={22} className="text-cyan-400 flex-shrink-0" />
                            </div>
                            <div className="text-5xl font-extrabold text-slate-800 leading-none">{stats.consumption}</div>
                            <span className="text-xs font-semibold text-slate-400">Litres / month</span>
                        </div>

                        {/* Saved */}
                        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm px-5 py-4 flex flex-col justify-between hover:shadow-md transition-shadow">
                            <div className="flex justify-between items-center">
                                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Saved</span>
                                <ArrowUpRight size={22} className="text-emerald-400 flex-shrink-0" />
                            </div>
                            <div className="text-5xl font-extrabold text-emerald-600 leading-none">{stats.saved}</div>
                            <span className="text-xs font-semibold text-emerald-500">↑ vs last month</span>
                        </div>
                    </div>

                    {/* Row 2 — 4 device-type counters */}
                    <div className="flex-1 grid grid-cols-4 gap-4">
                        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm px-5 flex flex-col justify-center items-start gap-1 hover:shadow-md transition-shadow">
                            <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Tanks</span>
                            <div className="flex items-baseline gap-1">
                                <span className="text-4xl font-extrabold text-blue-600">{stats.tanks.active}</span>
                                <span className="text-2xl font-bold text-slate-300">/{stats.tanks.total}</span>
                            </div>
                        </div>
                        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm px-5 flex flex-col justify-center items-start gap-1 hover:shadow-md transition-shadow">
                            <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Flow</span>
                            <div className="flex items-baseline gap-1">
                                <span className="text-4xl font-extrabold text-cyan-600">{stats.flow.active}</span>
                                <span className="text-2xl font-bold text-slate-300">/{stats.flow.total}</span>
                            </div>
                        </div>
                        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm px-5 flex flex-col justify-center items-start gap-1 hover:shadow-md transition-shadow">
                            <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Deep</span>
                            <div className="flex items-baseline gap-1">
                                <span className="text-4xl font-extrabold text-purple-600">{stats.deep.active}</span>
                                <span className="text-2xl font-bold text-slate-300">/{stats.deep.total}</span>
                            </div>
                        </div>
                        <div className="bg-white rounded-2xl border-l-4 border-l-red-500 border border-red-100 shadow-sm px-5 flex flex-col justify-center items-start gap-1 hover:shadow-md transition-shadow">
                            <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Alerts</span>
                            <span className="text-4xl font-extrabold text-red-600">{stats.alerts}</span>
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
                        <button className="text-blue-500 hover:text-blue-600 transition-colors font-bold text-2xl">+</button>
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
                                    <tr key={dev.id} className="hover:bg-slate-50/60 transition-colors">
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
                        <span className="px-3 py-1 bg-red-50 text-red-600 font-extrabold text-xs rounded-full">3 New</span>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                        {alertsList.map(a => (
                            <div key={a.id} className="p-4 hover:bg-slate-50 rounded-xl transition-colors cursor-pointer group border border-transparent hover:border-slate-100">
                                <div className="flex justify-between items-start mb-2">
                                    <div className="flex items-center gap-2 text-base font-bold text-slate-800">
                                        <AlertTriangle size={16} className="text-amber-500 flex-shrink-0" />
                                        {a.title}
                                    </div>
                                    <span className="text-xs text-slate-400 font-medium whitespace-nowrap ml-2">{a.time}</span>
                                </div>
                                <p className="text-sm text-slate-500 pl-6 group-hover:text-slate-700 transition-colors leading-relaxed">{a.msg}</p>
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

import ErrorBoundary from '../components/ErrorBoundary';

const DashboardWithBoundary = () => (
    <ErrorBoundary>
        <Dashboard />
    </ErrorBoundary>
);

export default DashboardWithBoundary;

