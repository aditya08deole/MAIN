import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, ZoomControl } from 'react-leaflet';
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

const blueIcon   = makeIcon('#2563eb');
const greenIcon  = makeIcon('#16a34a');
const purpleIcon = makeIcon('#9333ea');
const amberIcon  = makeIcon('#d97706', 20);
const redIcon    = makeIcon('#ef4444', 20);
// slateIcon used for govt borewells not shown in mini-map

// ─── Map Data — all assets matching Home.tsx ─────────────────────────────────

const IIITH_CENTER: [number, number] = [17.4456, 78.3490];

const pumpHouses = [
    { id: 'PH-01', name: 'Pump House 1', location: 'ATM Gate',    coordinates: [17.4456,  78.3516 ] as [number, number] },
    { id: 'PH-02', name: 'Pump House 2', location: 'Guest House', coordinates: [17.44608, 78.34925] as [number, number] },
    { id: 'PH-03', name: 'Pump House 3', location: 'Staff Qtrs',  coordinates: [17.4430,  78.3487 ] as [number, number] },
    { id: 'PH-04', name: 'Pump House 4', location: 'Bakul',       coordinates: [17.4481,  78.3489 ] as [number, number] },
];

const sumps = [
    { id: 'SUMP-S1',  name: 'Sump S1',  coordinates: [17.448097, 78.349060] as [number, number] },
    { id: 'SUMP-S2',  name: 'Sump S2',  coordinates: [17.444919, 78.346195] as [number, number] },
    { id: 'SUMP-S3',  name: 'Sump S3',  coordinates: [17.446779, 78.346996] as [number, number] },
    { id: 'SUMP-S4',  name: 'Sump S4',  coordinates: [17.445630, 78.351593] as [number, number] },
    { id: 'SUMP-S5',  name: 'Sump S5',  coordinates: [17.444766, 78.350087] as [number, number] },
    { id: 'SUMP-S6',  name: 'Sump S6',  coordinates: [17.445498, 78.350202] as [number, number] },
    { id: 'SUMP-S7',  name: 'Sump S7',  coordinates: [17.44597,  78.34906 ] as [number, number] },
    { id: 'SUMP-S8',  name: 'Sump S8',  coordinates: [17.446683, 78.348995] as [number, number] },
    { id: 'SUMP-S9',  name: 'Sump S9',  coordinates: [17.446613, 78.346487] as [number, number] },
    { id: 'SUMP-S10', name: 'Sump S10', coordinates: [17.443076, 78.348737] as [number, number] },
    { id: 'SUMP-S11', name: 'Sump S11', coordinates: [17.444773, 78.347797] as [number, number] },
];

const ohts = [
    { id: 'OHT-1',  name: 'Bakul OHT',        coordinates: [17.448045, 78.348438] as [number, number] },
    { id: 'OHT-2',  name: 'Parijat OHT',       coordinates: [17.447547, 78.347752] as [number, number] },
    { id: 'OHT-3',  name: 'Kadamba OHT',        coordinates: [17.446907, 78.347178] as [number, number] },
    { id: 'OHT-4',  name: 'NWH Blk C OHT',      coordinates: [17.447675, 78.347430] as [number, number] },
    { id: 'OHT-5',  name: 'NWH Blk B OHT',      coordinates: [17.447391, 78.347172] as [number, number] },
    { id: 'OHT-6',  name: 'NWH Blk A OHT',      coordinates: [17.447081, 78.346884] as [number, number] },
    { id: 'OHT-7',  name: 'Palash OHT',         coordinates: [17.445096, 78.345966] as [number, number] },
    { id: 'OHT-8',  name: 'Anand Nivas OHT',    coordinates: [17.443976, 78.348432] as [number, number] },
    { id: 'OHT-9',  name: 'Budha Nivas OHT',    coordinates: [17.443396, 78.348500] as [number, number] },
    { id: 'OHT-10', name: 'C Block OHT',         coordinates: [17.443387, 78.347834] as [number, number] },
    { id: 'OHT-11', name: 'D Block OHT',         coordinates: [17.443914, 78.347773] as [number, number] },
    { id: 'OHT-12', name: 'E Block OHT',         coordinates: [17.444391, 78.347958] as [number, number] },
    { id: 'OHT-13', name: 'Vindhya OHT',         coordinates: [17.44568,  78.34973 ] as [number, number] },
    { id: 'OHT-14', name: 'Himalaya OHT (KRB)', coordinates: [17.44525,  78.34966 ] as [number, number] },
];

const borewells = [
    { id: 'BW-P1',  name: 'Borewell P1',  working: false, coordinates: [17.443394, 78.348117] as [number, number] },
    { id: 'BW-P2',  name: 'Borewell P2',  working: false, coordinates: [17.443093, 78.348936] as [number, number] },
    { id: 'BW-P3',  name: 'Borewell P3',  working: false, coordinates: [17.444678, 78.347234] as [number, number] },
    { id: 'BW-P5',  name: 'Borewell P5',  working: true,  coordinates: [17.447783, 78.349040] as [number, number] },
    { id: 'BW-P8',  name: 'Borewell P8',  working: true,  coordinates: [17.445139, 78.345277] as [number, number] },
    { id: 'BW-P9',  name: 'Borewell P9',  working: true,  coordinates: [17.446922, 78.346699] as [number, number] },
    { id: 'BW-P10', name: 'Borewell P10', working: true,  coordinates: [17.443947, 78.350139] as [number, number] },
    { id: 'BW-P6',  name: 'Borewell P6',  working: false, coordinates: [17.448335, 78.348594] as [number, number] },
    { id: 'BW-P7',  name: 'Borewell P7',  working: false, coordinates: [17.445847, 78.346416] as [number, number] },
    { id: 'BW-G3',  name: 'Govt BW 3',    working: true,  coordinates: [17.446188, 78.350067] as [number, number] },
    { id: 'BW-G6',  name: 'Govt BW 6',    working: false, coordinates: [17.445584, 78.347148] as [number, number] },
    { id: 'BW-G7',  name: 'Govt BW 7',    working: false, coordinates: [17.446115, 78.348536] as [number, number] },
];

const pipelines: Array<{ positions: [number, number][]; color: string; name: string }> = [
    { name: 'PH2 - OBH/PALASH',  color: '#00b4d8', positions: [[17.446057, 78.349256], [17.445482, 78.348250], [17.446306, 78.347208], [17.445050, 78.345986]] },
    { name: 'PH2 - KADAMBA/NBH', color: '#00b4d8', positions: [[17.446885, 78.347174], [17.446583, 78.346873], [17.446302, 78.347211]] },
    { name: 'PH2 - HIMALAYA',    color: '#00b4d8', positions: [[17.446056, 78.349253], [17.445883, 78.349082], [17.445328, 78.349734], [17.445248, 78.349661]] },
    { name: 'PH2 - VINDYA',      color: '#00b4d8', positions: [[17.446050, 78.349258], [17.445661, 78.349731]] },
    { name: 'PH2 - PARIJAT/NGH', color: '#00b4d8', positions: [[17.446051, 78.349247], [17.447117, 78.347980], [17.447551, 78.347794]] },
    { name: 'PH1 - PH3',         color: '#00b4d8', positions: [[17.445565, 78.351568], [17.445402, 78.351081], [17.442973, 78.348713]] },
    { name: 'PH1 - PH4',         color: '#00b4d8', positions: [[17.445575, 78.351598], [17.447747, 78.348591], [17.448093, 78.348908]] },
    { name: 'PH4 - BAKUL OHT',   color: '#00b4d8', positions: [[17.448103, 78.348890], [17.448006, 78.348428]] },
    { name: 'PH3 - BLOCK B',     color: '#00b4d8', positions: [[17.443007, 78.348664], [17.443396, 78.348488]] },
    { name: 'PH3 - BLOCK A',     color: '#00b4d8', positions: [[17.443985, 78.348433], [17.443415, 78.349082], [17.443140, 78.348804]] },
    { name: 'BW P5 - SUMP S1',   color: '#000080', positions: [[17.447797, 78.349013], [17.448091, 78.349042]] },
    { name: 'BW P8 - SUMP S2',   color: '#000080', positions: [[17.445120, 78.345291], [17.444911, 78.346206]] },
    { name: 'BW P9 - SUMP S3',   color: '#000080', positions: [[17.446868, 78.346714], [17.446715, 78.346984]] },
    { name: 'BW P10 - SUMP S5',  color: '#000080', positions: [[17.443927, 78.350157], [17.444701, 78.350068]] },
];

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

const MiniMap = ({ onExpand }: { onExpand: () => void }) => (
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
            {sumps.map(s => <Marker key={s.id} position={s.coordinates} icon={greenIcon} />)}

            {/* All OHTs — blue */}
            {ohts.map(o => <Marker key={o.id} position={o.coordinates} icon={blueIcon} />)}

            {/* All Borewells — amber (working) / red (not working) */}
            {borewells.map(bw => (
                <Marker key={bw.id} position={bw.coordinates} icon={bw.working ? amberIcon : redIcon} />
            ))}

            {/* Pump Houses — purple (on top) */}
            {pumpHouses.map(p => <Marker key={p.id} position={p.coordinates} icon={purpleIcon} />)}
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

// ─── Main Dashboard ───────────────────────────────────────────────────────────

const Dashboard = () => {
    const { user, loading } = useAuth();
    const navigate = useNavigate();
    const [now] = useState(() => new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }));
    const [isNavigating, setIsNavigating] = useState(false);

    if (loading) {
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

    const stats = {
        deployed: 5, onlineStatus: 2, totalStatus: 5,
        consumption: '1.2M', saved: '350k',
        tanks: 2, flow: 1, deep: 2, alerts: 1,
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
            <div className="flex-none flex items-center justify-between mb-4">
                <h1 className="text-3xl font-extrabold text-blue-600 tracking-tight">System Dashboard</h1>
                <span className="text-sm font-semibold text-slate-400">Last updated: <span className="text-slate-600">{now}</span></span>
            </div>

            {/* ── Top Row — fixed height so cards never over-stretch ── */}
            <div className="flex-none grid grid-cols-12 gap-4 mb-4" style={{ height: '260px' }}>

                {/* Left 8 cols: stacked KPI rows */}
                <div className="col-span-8 flex flex-col gap-3 h-full">

                    {/* Row 1 — 4 main KPI cards */}
                    <div className="flex-1 grid grid-cols-4 gap-3">
                        {/* Total Deployed */}
                        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm px-5 py-4 flex flex-col justify-between">
                            <div className="flex justify-between items-center">
                                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Total Deployed</span>
                                <Layers size={18} className="text-blue-400 flex-shrink-0" />
                            </div>
                            <div className="text-4xl font-extrabold text-slate-800 leading-none">{stats.deployed}</div>
                            <span className="text-xs font-semibold text-slate-400">Devices active</span>
                        </div>

                        {/* Online Status */}
                        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm px-5 py-4 flex flex-col justify-between">
                            <div className="flex justify-between items-center">
                                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Online</span>
                                <Activity size={18} className="text-green-400 flex-shrink-0" />
                            </div>
                            <div className="flex items-baseline gap-1 leading-none">
                                <span className="text-4xl font-extrabold text-slate-800">{stats.onlineStatus}</span>
                                <span className="text-xl font-bold text-slate-400">/{stats.totalStatus}</span>
                            </div>
                            <span className="text-xs font-semibold text-green-500">System healthy</span>
                        </div>

                        {/* Consumption */}
                        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm px-5 py-4 flex flex-col justify-between">
                            <div className="flex justify-between items-center">
                                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Consumption</span>
                                <Droplets size={18} className="text-cyan-400 flex-shrink-0" />
                            </div>
                            <div className="text-4xl font-extrabold text-slate-800 leading-none">{stats.consumption}</div>
                            <span className="text-xs font-semibold text-slate-400">Litres / month</span>
                        </div>

                        {/* Saved */}
                        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm px-5 py-4 flex flex-col justify-between">
                            <div className="flex justify-between items-center">
                                <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Saved</span>
                                <ArrowUpRight size={18} className="text-emerald-400 flex-shrink-0" />
                            </div>
                            <div className="text-4xl font-extrabold text-emerald-600 leading-none">{stats.saved}</div>
                            <span className="text-xs font-semibold text-emerald-500">↑ vs last month</span>
                        </div>
                    </div>

                    {/* Row 2 — 4 device-type counters */}
                    <div className="grid grid-cols-4 gap-3" style={{ height: '60px' }}>
                        <div className="bg-white rounded-xl border border-slate-100 shadow-sm px-4 flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Tanks</span>
                            <span className="text-2xl font-extrabold text-blue-600">{stats.tanks}</span>
                        </div>
                        <div className="bg-white rounded-xl border border-slate-100 shadow-sm px-4 flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Flow</span>
                            <span className="text-2xl font-extrabold text-cyan-600">{stats.flow}</span>
                        </div>
                        <div className="bg-white rounded-xl border border-slate-100 shadow-sm px-4 flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Deep</span>
                            <span className="text-2xl font-extrabold text-purple-600">{stats.deep}</span>
                        </div>
                        <div className="bg-white rounded-xl border-l-4 border-l-red-500 border border-red-100 shadow-sm px-4 flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">Alerts</span>
                            <span className="text-2xl font-extrabold text-red-600">{stats.alerts}</span>
                        </div>
                    </div>
                </div>

                {/* Right 4 cols: Map */}
                <div className="col-span-4 h-full">
                    <MiniMap onExpand={handleMapClick} />
                </div>
            </div>

            {/* ── Bottom Row — fills remaining space, 3 columns ── */}
            <div className="flex-1 min-h-0 grid grid-cols-3 gap-4">

                {/* Col 1: Device Fleet */}
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col overflow-hidden">
                    <div className="px-5 py-4 border-b border-slate-50 flex justify-between items-center flex-none">
                        <div>
                            <h2 className="text-base font-extrabold text-slate-800 flex items-center gap-2">
                                <Server size={18} className="text-blue-500" /> Device Fleet
                            </h2>
                        </div>
                        <button className="text-blue-500 hover:text-blue-600 transition-colors font-bold text-xl">+</button>
                    </div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar">
                        <table className="w-full text-left">
                            <thead className="sticky top-0 bg-white z-10">
                                <tr className="border-b border-slate-50 text-[10px] font-extrabold text-slate-400 uppercase tracking-widest">
                                    <th className="px-4 py-3">Device</th>
                                    <th className="px-4 py-3">Status</th>
                                    <th className="px-4 py-3 text-right">Health</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50 text-sm">
                                {deviceFleet.map(dev => (
                                    <tr key={dev.id} className="hover:bg-slate-50/60 transition-colors">
                                        <td className="px-4 py-3">
                                            <div className="font-bold text-slate-700">{dev.name}</div>
                                            <div className="text-[10px] text-blue-400 font-mono">{dev.type}</div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className={`flex items-center gap-1.5 font-bold text-[11px] ${dev.status === 'Online' ? 'text-green-600' :
                                                dev.status === 'Alert' ? 'text-red-600' :
                                                    dev.status === 'Maintenance' ? 'text-amber-600' : 'text-slate-500'
                                                }`}>
                                                <div className={`w-1.5 h-1.5 rounded-full ${dev.status === 'Online' ? 'bg-green-500' :
                                                    dev.status === 'Alert' ? 'bg-red-500' :
                                                        dev.status === 'Maintenance' ? 'bg-amber-500' : 'bg-slate-400'
                                                    }`} />
                                                {dev.status}
                                            </div>
                                            <div className="text-[10px] text-slate-400 mt-0.5">{dev.lastComm}</div>
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <div className={`font-bold text-xs ${dev.health > 90 ? 'text-green-600' : dev.health > 50 ? 'text-amber-600' : 'text-red-600'}`}>
                                                {dev.health}%
                                            </div>
                                            <div className="w-full h-1 bg-slate-100 rounded-full mt-1 overflow-hidden">
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
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col overflow-hidden">
                    <div className="px-5 py-4 border-b border-slate-50 flex justify-between items-center flex-none">
                        <div>
                            <h2 className="text-base font-extrabold text-slate-800 flex items-center gap-2">
                                <AlertTriangle size={18} className="text-red-500" /> Alerts
                            </h2>
                        </div>
                        <span className="px-2.5 py-1 bg-red-50 text-red-600 font-extrabold text-[10px] rounded-full">3 New</span>
                    </div>
                    <div className="flex-1 overflow-y-auto p-3 space-y-1 custom-scrollbar">
                        {alertsList.map(a => (
                            <div key={a.id} className="p-3 hover:bg-slate-50 rounded-xl transition-colors cursor-pointer group border border-transparent hover:border-slate-100">
                                <div className="flex justify-between items-start mb-1">
                                    <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                                        <AlertTriangle size={12} className="text-amber-500 flex-shrink-0" />
                                        {a.title}
                                    </div>
                                    <span className="text-[10px] text-slate-400 font-medium whitespace-nowrap ml-2">{a.time}</span>
                                </div>
                                <p className="text-[11px] text-slate-500 pl-5 group-hover:text-slate-700 transition-colors leading-relaxed">{a.msg}</p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Col 3: Quick Reports */}
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm flex flex-col overflow-hidden">
                    <div className="px-5 py-4 border-b border-slate-50 flex-none">
                        <h2 className="text-base font-extrabold text-slate-800 flex items-center gap-2">
                            <FileText size={18} className="text-purple-500" /> Quick Reports
                        </h2>
                    </div>
                    <div className="flex-1 p-4 flex flex-col gap-3 overflow-y-auto custom-scrollbar">
                        <button className="w-full flex items-center gap-4 p-4 bg-slate-50 rounded-xl border border-slate-100 hover:border-blue-200 hover:bg-blue-50 transition-all text-left group">
                            <div className="p-2.5 bg-white rounded-xl shadow-sm text-slate-400 group-hover:text-blue-500 transition-colors">
                                <Download size={18} />
                            </div>
                            <div>
                                <div className="text-sm font-bold text-slate-700 group-hover:text-blue-700">Daily Report</div>
                                <div className="text-[10px] text-slate-400 font-medium">Download PDF Format</div>
                            </div>
                        </button>
                        <button className="w-full flex items-center gap-4 p-4 bg-slate-50 rounded-xl border border-slate-100 hover:border-purple-200 hover:bg-purple-50 transition-all text-left group">
                            <div className="p-2.5 bg-white rounded-xl shadow-sm text-slate-400 group-hover:text-purple-500 transition-colors">
                                <Download size={18} />
                            </div>
                            <div>
                                <div className="text-sm font-bold text-slate-700 group-hover:text-purple-700">Custom Export</div>
                                <div className="text-[10px] text-slate-400 font-medium">Excel / CSV Format</div>
                            </div>
                        </button>

                        <div className="mt-auto bg-purple-50 p-4 rounded-xl border border-purple-100">
                            <div className="flex items-center gap-2 mb-1.5">
                                <Clock size={12} className="text-purple-500" />
                                <span className="text-[10px] font-extrabold text-purple-700 uppercase tracking-wider">Scheduled</span>
                            </div>
                            <p className="text-[11px] font-medium text-purple-700 leading-snug">
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

