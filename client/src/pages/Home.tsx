import { MapContainer, TileLayer, Marker, Popup, ZoomControl, Polyline } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { useState } from 'react';
import { Activity, LayoutDashboard, Layers } from 'lucide-react';
import clsx from 'clsx';
import { Link } from 'react-router-dom';
import { useMapDevices } from '../hooks/useMapDevices';
import { useMapPipelines } from '../hooks/useMapPipelines';
import L from 'leaflet';

// Fix for default marker icon in React-Leaflet
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

// Custom Purple Icon
const purpleIcon = L.divIcon({
    className: 'custom-purple-icon',
    html: `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="#9333ea" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-map-pin drop-shadow-md"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>`,
    iconSize: [40, 40],
    iconAnchor: [20, 40],
    popupAnchor: [0, -40]
});

// Custom Green Icon (for Sumps)
const sumpIcon = L.divIcon({
    className: 'custom-green-icon',
    html: `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="#16a34a" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-map-pin drop-shadow-md"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>`,
    iconSize: [40, 40],
    iconAnchor: [20, 40],
    popupAnchor: [0, -40]
});

// Custom Blue Icon (for OHTs)
const blueIcon = L.divIcon({
    className: 'custom-blue-icon',
    html: `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="#2563eb" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-map-pin drop-shadow-md"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>`,
    iconSize: [40, 40],
    iconAnchor: [20, 40],
    popupAnchor: [0, -40]
});

// Custom Yellow Icon (for Borewells)
const yellowIcon = L.divIcon({
    className: 'custom-yellow-icon',
    html: `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="#eab308" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-map-pin drop-shadow-md"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>`,
    iconSize: [40, 40],
    iconAnchor: [20, 40],
    popupAnchor: [0, -40]
});

// Custom Black Icon (for Govt Borewells)
const blackIcon = L.divIcon({
    className: 'custom-black-icon',
    html: `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="#1e293b" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-map-pin drop-shadow-md"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>`,
    iconSize: [40, 40],
    iconAnchor: [20, 40],
    popupAnchor: [0, -40]
});

// Custom Red Icon (for Non-Working Borewells)
const redIcon = L.divIcon({
    className: 'custom-red-icon',
    html: `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="#ef4444" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-map-pin drop-shadow-md"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>`,
    iconSize: [40, 40],
    iconAnchor: [20, 40],
    popupAnchor: [0, -40]
});

export const Home = () => {
    const [showIndex, setShowIndex] = useState(false);
    const [showStatusOverview, setShowStatusOverview] = useState(false);
    const [showSystemDashboard, setShowSystemDashboard] = useState(false);
    const [activeFilter, setActiveFilter] = useState<string | null>(null);
    const [activePipeline, setActivePipeline] = useState<string | null>(null);

    const { devices, loading: devicesLoading } = useMapDevices();
    const { pipelines, loading: pipelinesLoading } = useMapPipelines();

    if (devicesLoading || pipelinesLoading) {
        return <div className="flex items-center justify-center h-screen">Loading map data...</div>;
    }

    const handleFilterClick = (filter: string) => {
        setActiveFilter(prev => prev === filter ? null : filter);
    };

    const handlePipelineClick = (pipeline: string) => {
        setActivePipeline(prev => prev === pipeline ? null : pipeline);
    };

    // Derived state for filtering (map asset_type to categories)
    const pumpHouses = devices.filter(d => d.asset_type === 'pump');
    const sumps = devices.filter(d => d.asset_type === 'sump');
    const ohts = devices.filter(d => d.asset_type === 'tank');
    const borewells = devices.filter(d => d.asset_type === 'bore');
    const govtBorewells = devices.filter(d => d.asset_type === 'govt');

    // Combine for counts
    const onlineNodes = devices.filter(d => d.status === 'Online' || d.status === 'Working' || d.status === 'Running' || d.status === 'Normal');
    const offlineNodes = devices.filter(d => d.status === 'Offline' || d.status === 'Not Working' || d.status === 'Alert' || d.status === 'Maintenance' || d.status === 'Critical');


    // Center Map on PH-01
    const position: [number, number] = [17.4456, 78.3490];

    return (
        <div className="relative w-full h-[calc(100vh-64px)] flex flex-col">
            {/* Map Container */}
            <div className="flex-1 relative z-0">
                <MapContainer
                    center={position}
                    zoom={17} // Zoomed in to see pipelines better
                    scrollWheelZoom={true}
                    zoomControl={false}
                    className="w-full h-full"
                >
                    <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />

                    {/* Pipelines */}
                    {pipelines.filter(pipe => {
                        if (activePipeline === null) return false;
                        if (activePipeline === 'watersupply') return pipe.name.includes('PH'); // Heuristic or add type to DB
                        if (activePipeline === 'borewellwater') return pipe.name.includes('PIPE');
                        return false;
                    }).map((pipe) => (
                        <Polyline
                            key={pipe.id}
                            positions={pipe.positions}
                            pathOptions={{ color: pipe.color, weight: 4, opacity: 0.8 }}
                        >
                            <Popup>
                                <div className="p-2">
                                    <h3 className="font-bold text-slate-800">{pipe.name}</h3>
                                    {/* <p className="text-xs text-slate-500">{pipe.type}</p> */}
                                </div>
                            </Popup>
                        </Polyline>
                    ))}
                    {/* Pump House Markers (Purple Pins) */}
                    {(activeFilter === null || activeFilter === 'pumphouse') && pumpHouses.map((ph) => (
                        <Marker key={ph.id} position={[ph.latitude!, ph.longitude!]} icon={purpleIcon}>
                            <Popup>
                                <div className="p-2 min-w-[150px]">
                                    <h3 className="font-bold text-slate-800 text-sm mb-1">{ph.name}</h3>
                                    {ph.capacity && (
                                        <p className="text-xs text-slate-600 mb-1">Capacity: {ph.capacity}</p>
                                    )}
                                    <div className="mb-3">
                                        <span className={clsx(
                                            "text-[10px] font-bold px-2 py-0.5 rounded-full inline-block",
                                            (ph.status === 'Online' || ph.status === 'Working' || ph.status === 'Running' || ph.status === 'Normal') ? "text-green-600 bg-green-50" : "text-red-600 bg-red-50"
                                        )}>
                                            {ph.status}
                                        </span>
                                    </div>
                                    <Link to={`/node/${ph.id}`} className="block w-full text-center bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold py-1.5 px-3 rounded transition-colors">
                                        View Details
                                    </Link>
                                </div>
                            </Popup>
                        </Marker>
                    ))}

                    {/* Sumps Markers (Green Pins) */}
                    {(activeFilter === null || activeFilter === 'sump') && sumps.map((sump) => (
                        <Marker key={sump.id} position={[sump.latitude!, sump.longitude!]} icon={sumpIcon}>
                            <Popup>
                                <div className="p-2 min-w-[150px]">
                                    <h3 className="font-bold text-slate-800 text-sm mb-1">{sump.name}</h3>
                                    {sump.capacity && (
                                        <p className="text-xs text-slate-600 mb-1">Capacity: {sump.capacity}</p>
                                    )}
                                    <div className="mb-3">
                                        <span className={clsx(
                                            "text-[10px] font-bold px-2 py-0.5 rounded-full inline-block",
                                            (sump.status === 'Online' || sump.status === 'Working' || sump.status === 'Running' || sump.status === 'Normal') ? "text-green-600 bg-green-50" : "text-red-600 bg-red-50"
                                        )}>
                                            {sump.status}
                                        </span>
                                    </div>
                                    <Link to={`/node/${sump.id}`} className="block w-full text-center bg-green-600 hover:bg-green-700 text-white text-xs font-bold py-1.5 px-3 rounded transition-colors">
                                        View Details
                                    </Link>
                                </div>
                            </Popup>
                        </Marker>
                    ))}

                    {/* OHT Markers (Blue Pins) */}
                    {(activeFilter === null || activeFilter === 'oht') && ohts.map((oht) => (
                        <Marker key={oht.id} position={[oht.latitude!, oht.longitude!]} icon={blueIcon}>
                            <Popup>
                                <div className="p-2 min-w-[150px]">
                                    <h3 className="font-bold text-slate-800 text-sm mb-1">{oht.name}</h3>
                                    {oht.capacity && (
                                        <p className="text-xs text-slate-600 mb-1">Capacity: {oht.capacity}</p>
                                    )}
                                    <div className="mb-3">
                                        <span className={clsx(
                                            "text-[10px] font-bold px-2 py-0.5 rounded-full inline-block",
                                            (oht.status === 'Online' || oht.status === 'Working' || oht.status === 'Running' || oht.status === 'Normal') ? "text-blue-600 bg-blue-50" : "text-red-600 bg-red-50"
                                        )}>
                                            {oht.status}
                                        </span>
                                    </div>
                                    <Link to={`/node/${oht.id}`} className="block w-full text-center bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold py-1.5 px-3 rounded transition-colors">
                                        View Details
                                    </Link>
                                </div>
                            </Popup>
                        </Marker>
                    ))}

                    {/* Borewell Markers (Yellow Pins) */}
                    {(activeFilter === null || activeFilter === 'borewell' || activeFilter === 'nonworking') && borewells.filter(bw => {
                        if (activeFilter === 'nonworking') return bw.status === 'Offline' || bw.status === 'Not Working' || bw.status === 'Alert' || bw.status === 'Critical';
                        if (activeFilter === 'borewell') return true;
                        return true;
                    }).map((bw) => (
                        <Marker key={bw.id} position={[bw.latitude!, bw.longitude!]} icon={(bw.status === 'Offline' || bw.status === 'Not Working' || bw.status === 'Alert' || bw.status === 'Critical') ? redIcon : yellowIcon}>
                            <Popup>
                                <div className="p-2 min-w-[150px]">
                                    <h3 className="font-bold text-slate-800">{bw.name}</h3>
                                    {bw.capacity && (
                                        <p className="text-xs text-slate-600 mb-1">Capacity: {bw.capacity}</p>
                                    )}
                                    <div className="mb-3">
                                        <span className={clsx(
                                            "text-[10px] font-bold px-2 py-0.5 rounded-full inline-block",
                                            (bw.status === 'Online' || bw.status === 'Working' || bw.status === 'Running' || bw.status === 'Normal') ? "text-green-600 bg-green-50" : "text-red-600 bg-red-50"
                                        )}>
                                            {bw.status}
                                        </span>
                                    </div>
                                    <Link to={`/node/${bw.id}`} className="block w-full text-center bg-yellow-600 hover:bg-yellow-700 text-white text-xs font-bold py-1.5 px-3 rounded transition-colors">
                                        View Details
                                    </Link>
                                </div>
                            </Popup>
                        </Marker>
                    ))}

                    {/* Govt Borewell Markers (Black Pins) */}
                    {(activeFilter === null || activeFilter === 'govtborewell' || activeFilter === 'nonworking') && govtBorewells.filter(bw => {
                        if (activeFilter === 'nonworking') return bw.status === 'Offline' || bw.status === 'Not Working' || bw.status === 'Alert' || bw.status === 'Critical';
                        if (activeFilter === 'govtborewell') return true;
                        return true;
                    }).map((bw) => (
                        <Marker key={bw.id} position={[bw.latitude!, bw.longitude!]} icon={(bw.status === 'Offline' || bw.status === 'Not Working' || bw.status === 'Alert' || bw.status === 'Critical') ? redIcon : blackIcon}>
                            <Popup>
                                <div className="p-2 min-w-[150px]">
                                    <h3 className="font-bold text-slate-800 text-sm mb-1">{bw.name}</h3>
                                    {bw.capacity && (
                                        <p className="text-xs text-slate-600 mb-1">Capacity: {bw.capacity}</p>
                                    )}
                                    <div className="mb-3">
                                        <span className={clsx(
                                            "text-[10px] font-bold px-2 py-0.5 rounded-full inline-block",
                                            (bw.status === 'Online' || bw.status === 'Working' || bw.status === 'Running' || bw.status === 'Normal') ? "text-green-600 bg-green-50" : "text-red-600 bg-red-50"
                                        )}>
                                            {bw.status}
                                        </span>
                                    </div>
                                    <Link to={`/node/${bw.id}`} className="block w-full text-center bg-slate-700 hover:bg-slate-800 text-white text-xs font-bold py-1.5 px-3 rounded transition-colors">
                                        View Details
                                    </Link>
                                </div>
                            </Popup>
                        </Marker>
                    ))}

                    {/* Custom Zoom Control Position */}
                    <ZoomControl position="bottomright" />
                </MapContainer>

                {/* Overlay Buttons */}
                <div className="absolute top-4 right-4 flex flex-col gap-3 z-[400]">
                    <button onClick={() => { setShowStatusOverview(!showStatusOverview); setShowSystemDashboard(false); }} className={clsx("bg-white/90 backdrop-blur-md p-3 rounded-xl shadow-lg border border-slate-200 hover:bg-white transition-all group flex items-center gap-3", showStatusOverview && "ring-2 ring-blue-400")}>
                        <div className={clsx("w-10 h-10 rounded-full flex items-center justify-center transition-colors", showStatusOverview ? "bg-[var(--color-evara-blue)] text-white" : "bg-blue-50 text-[var(--color-evara-blue)] group-hover:bg-[var(--color-evara-blue)] group-hover:text-white")}>
                            <Activity size={20} />
                        </div>
                        <span className="font-semibold text-slate-700 pr-2">Status Overview</span>
                    </button>

                    <button onClick={() => { setShowSystemDashboard(!showSystemDashboard); setShowStatusOverview(false); }} className={clsx("bg-white/90 backdrop-blur-md p-3 rounded-xl shadow-lg border border-slate-200 hover:bg-white transition-all group flex items-center gap-3", showSystemDashboard && "ring-2 ring-green-400")}>
                        <div className={clsx("w-10 h-10 rounded-full flex items-center justify-center transition-colors", showSystemDashboard ? "bg-[var(--color-evara-green)] text-white" : "bg-green-50 text-[var(--color-evara-green)] group-hover:bg-[var(--color-evara-green)] group-hover:text-white")}>
                            <LayoutDashboard size={20} />
                        </div>
                        <span className="font-semibold text-slate-700 pr-2">System Dashboard</span>
                    </button>
                </div>

                {/* Status Overview Panel */}
                <div className={clsx(
                    "absolute top-28 right-4 z-[400] bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-slate-200 w-80 transition-all duration-300 origin-top-right overflow-hidden",
                    showStatusOverview ? "opacity-100 scale-100 max-h-[600px]" : "opacity-0 scale-95 max-h-0 pointer-events-none"
                )}>
                    <div className="p-5">
                        <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
                            <Activity size={16} className="text-[var(--color-evara-blue)]" /> Infrastructure Status
                        </h3>

                        {/* Summary Stats */}
                        <div className="grid grid-cols-3 gap-2 mb-4">
                            <div className="bg-green-50 rounded-lg p-2.5 text-center">
                                <div className="text-lg font-extrabold text-green-600">{onlineNodes.length}</div>
                                <div className="text-[10px] font-semibold text-green-700">Online</div>
                            </div>
                            <div className="bg-red-50 rounded-lg p-2.5 text-center">
                                <div className="text-lg font-extrabold text-red-600">{offlineNodes.length}</div>
                                <div className="text-[10px] font-semibold text-red-700">Offline</div>
                            </div>
                            <div className="bg-blue-50 rounded-lg p-2.5 text-center">
                                <div className="text-lg font-extrabold text-blue-600">{devices.length}</div>
                                <div className="text-[10px] font-semibold text-blue-700">Total</div>
                            </div>
                        </div>

                        {/* Asset Breakdown */}
                        <div className="space-y-3">
                            {[
                                { name: 'Pump Houses', total: pumpHouses.length, working: pumpHouses.filter(p => p.status === 'Online' || p.status === 'Working' || p.status === 'Running' || p.status === 'Normal').length, color: '#9333ea', bg: 'bg-purple-50' },
                                { name: 'Sumps', total: sumps.length, working: sumps.filter(s => s.status === 'Online' || s.status === 'Working' || s.status === 'Running' || s.status === 'Normal').length, color: '#16a34a', bg: 'bg-green-50' },
                                { name: 'Overhead Tanks', total: ohts.length, working: ohts.filter(o => o.status === 'Online' || o.status === 'Working' || o.status === 'Running' || o.status === 'Normal').length, color: '#2563eb', bg: 'bg-blue-50' },
                                { name: 'Borewells (IIIT)', total: borewells.length, working: borewells.filter(b => b.status === 'Online' || b.status === 'Working' || b.status === 'Running' || b.status === 'Normal').length, color: '#eab308', bg: 'bg-yellow-50' },
                                { name: 'Borewells (Govt)', total: govtBorewells.length, working: govtBorewells.filter(b => b.status === 'Online' || b.status === 'Working' || b.status === 'Running' || b.status === 'Normal').length, color: '#1e293b', bg: 'bg-slate-50' },
                            ].map((asset, i) => (
                                <div key={i} className={clsx("rounded-xl p-3", asset.bg)}>
                                    <div className="flex justify-between items-center mb-1.5">
                                        <span className="text-xs font-bold text-slate-700">{asset.name}</span>
                                        <span className="text-xs font-bold" style={{ color: asset.color }}>{asset.working}/{asset.total}</span>
                                    </div>
                                    <div className="w-full h-2 bg-white rounded-full overflow-hidden">
                                        <div className="h-full rounded-full transition-all" style={{ width: `${asset.total > 0 ? (asset.working / asset.total) * 100 : 0}%`, background: asset.color }}></div>
                                    </div>
                                    <div className="flex justify-between mt-1">
                                        <span className="text-[10px] text-green-600 font-semibold">{asset.working} active</span>
                                        <span className="text-[10px] text-red-500 font-semibold">{asset.total - asset.working} down</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* System Dashboard Panel */}
                <div className={clsx(
                    "absolute top-28 right-4 z-[400] bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-slate-200 w-80 transition-all duration-300 origin-top-right overflow-hidden",
                    showSystemDashboard ? "opacity-100 scale-100 max-h-[700px]" : "opacity-0 scale-95 max-h-0 pointer-events-none"
                )}>
                    <div className="p-5">
                        <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
                            <LayoutDashboard size={16} className="text-[var(--color-evara-green)]" /> System Dashboard
                        </h3>

                        {/* Water Consumption - Dynamic Placeholder */}
                        <div className="bg-gradient-to-r from-blue-50 to-cyan-50 rounded-xl p-3 mb-3">
                            <div className="text-[10px] font-bold text-slate-500 uppercase mb-1">Total Capacity</div>
                            <div className="text-2xl font-extrabold text-blue-700">-- <span className="text-sm font-bold text-slate-400">Litres</span></div>
                            <div className="text-[10px] text-green-600 font-semibold mt-0.5">Realtime data fetching...</div>
                        </div>

                        {/* System Health Metrics */}
                        <div className="grid grid-cols-2 gap-2 mb-3">
                            <div className="bg-green-50 rounded-lg p-2.5">
                                <div className="text-[10px] font-bold text-slate-500">Uptime</div>
                                <div className="text-lg font-extrabold text-green-600">99.8%</div>
                            </div>
                            <div className="bg-orange-50 rounded-lg p-2.5">
                                <div className="text-[10px] font-bold text-slate-500">Active Alerts</div>
                                <div className="text-lg font-extrabold text-orange-600">{offlineNodes.length}</div>
                            </div>
                            <div className="bg-purple-50 rounded-lg p-2.5">
                                <div className="text-[10px] font-bold text-slate-500">Pipelines</div>
                                <div className="text-lg font-extrabold text-purple-600">{pipelines.length}</div>
                            </div>
                            <div className="bg-cyan-50 rounded-lg p-2.5">
                                <div className="text-[10px] font-bold text-slate-500">System Status</div>
                                <div className="text-lg font-extrabold text-cyan-600">{devicesLoading ? 'Loading' : 'Active'}</div>
                            </div>
                        </div>

                        {/* Pipeline Network */}
                        <div className="bg-slate-50 rounded-xl p-3 mb-3">
                            <div className="text-[10px] font-bold text-slate-500 uppercase mb-2">Pipeline Network</div>
                            <div className="flex justify-between items-center mb-1">
                                <span className="text-xs text-slate-600">Water Supply Lines</span>
                                {/* Filter by checking naming convention or adding type to DB in future */}
                                <span className="text-xs font-bold text-cyan-600">{pipelines.filter(p => !p.name.includes('PIPE')).length} active</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-xs text-slate-600">Borewell Lines</span>
                                <span className="text-xs font-bold text-indigo-600">{pipelines.filter(p => p.name.includes('PIPE')).length} active</span>
                            </div>
                        </div>

                        {/* Recent Activity */}
                        <div className="bg-slate-50 rounded-xl p-3">
                            <div className="text-[10px] font-bold text-slate-500 uppercase mb-2">Recent Activity</div>
                            <div className="space-y-2">
                                {/* TODO: Fetch from audit_logs */}
                                <div className="text-xs text-slate-400 italic">No recent activity detected.</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Index Corner Panel (Assets & Nodes) */}
            <div className="absolute bottom-6 left-6 z-[1000] flex flex-col items-start pointer-events-none">
                {/* Toggle Button */}
                <button
                    onClick={() => setShowIndex(!showIndex)}
                    className="bg-white p-3 rounded-full shadow-lg border border-slate-200 text-slate-500 hover:text-[var(--color-evara-blue)] mb-2 pointer-events-auto transition-colors hover:shadow-xl"
                    title={showIndex ? "Hide Index" : "Show Index"}
                >
                    <Layers size={20} />
                </button>

                {/* Index Card */}
                <div className={clsx(
                    "bg-white rounded-2xl shadow-2xl border border-slate-200 w-64 flex flex-col transition-all duration-300 origin-bottom-left overflow-hidden pointer-events-auto",
                    showIndex ? "opacity-100 scale-100 max-h-[500px]" : "opacity-0 scale-95 max-h-0"
                )}>
                    <div className="p-4">
                        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 cursor-pointer hover:text-[var(--color-evara-blue)] transition-colors" onClick={() => setActiveFilter(null)}>ASSETS</h2>
                        <div className="space-y-3">
                            {/* Pump House */}
                            <div className={clsx("flex items-center gap-3 cursor-pointer rounded-lg px-2 py-1 transition-all", activeFilter === 'pumphouse' ? 'bg-purple-100 ring-2 ring-purple-400' : 'hover:bg-slate-50')} onClick={() => handleFilterClick('pumphouse')}>
                                <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 shadow-sm">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="#9333ea" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-map-pin"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></svg>
                                </div>
                                <span className="text-sm font-semibold text-slate-700">Pump House</span>
                            </div>

                            {/* Sump */}
                            <div className={clsx("flex items-center gap-3 cursor-pointer rounded-lg px-2 py-1 transition-all", activeFilter === 'sump' ? 'bg-green-100 ring-2 ring-green-400' : 'hover:bg-slate-50')} onClick={() => handleFilterClick('sump')}>
                                <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-green-600 shadow-sm">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="#16a34a" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-map-pin"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></svg>
                                </div>
                                <span className="text-sm font-semibold text-slate-700">Sump</span>
                            </div>

                            {/* Overhead Tank */}
                            <div className={clsx("flex items-center gap-3 cursor-pointer rounded-lg px-2 py-1 transition-all", activeFilter === 'oht' ? 'bg-blue-100 ring-2 ring-blue-400' : 'hover:bg-slate-50')} onClick={() => handleFilterClick('oht')}>
                                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 shadow-sm">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="#2563eb" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-map-pin"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></svg>
                                </div>
                                <span className="text-sm font-semibold text-slate-700">Overhead Tank</span>
                            </div>

                            {/* Borewell (IIIT) */}
                            <div className={clsx("flex items-center gap-3 cursor-pointer rounded-lg px-2 py-1 transition-all", activeFilter === 'borewell' ? 'bg-yellow-100 ring-2 ring-yellow-400' : 'hover:bg-slate-50')} onClick={() => handleFilterClick('borewell')}>
                                <div className="w-8 h-8 rounded-full bg-yellow-100 flex items-center justify-center text-yellow-600 shadow-sm">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="#eab308" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-map-pin"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></svg>
                                </div>
                                <span className="text-sm font-semibold text-slate-700">Borewell (IIIT)</span>
                            </div>

                            {/* Borewell (Govt) */}
                            <div className={clsx("flex items-center gap-3 cursor-pointer rounded-lg px-2 py-1 transition-all", activeFilter === 'govtborewell' ? 'bg-slate-200 ring-2 ring-slate-400' : 'hover:bg-slate-50')} onClick={() => handleFilterClick('govtborewell')}>
                                <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-700 shadow-sm">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="#1e293b" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-map-pin"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></svg>
                                </div>
                                <span className="text-sm font-semibold text-slate-700">Borewell (Govt)</span>
                            </div>

                            {/* Non-Working */}
                            <div className={clsx("flex items-center gap-3 cursor-pointer rounded-lg px-2 py-1 transition-all", activeFilter === 'nonworking' ? 'bg-red-100 ring-2 ring-red-400' : 'hover:bg-slate-50')} onClick={() => handleFilterClick('nonworking')}>
                                <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center text-red-600 shadow-sm">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="#ef4444" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-map-pin"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></svg>
                                </div>
                                <span className="text-sm font-semibold text-slate-700">Non-Working</span>
                            </div>
                        </div>

                        <div className="my-2 border-t border-slate-100"></div>

                        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">PIPELINES</h2>

                        {/* Water Supply */}
                        <div className={clsx("flex items-center gap-3 cursor-pointer rounded-lg px-2 py-1 transition-all", activePipeline === 'watersupply' ? 'bg-cyan-100 ring-2 ring-cyan-400' : 'hover:bg-slate-50')} onClick={() => handlePipelineClick('watersupply')}>
                            <div className="w-8 h-8 flex items-center justify-center">
                                <div className="w-full h-1 bg-[#00b4d8] rounded-full shadow-sm"></div>
                            </div>
                            <span className="text-sm font-semibold text-slate-700">Water Supply</span>
                        </div>

                        {/* Borewell Water */}
                        <div className={clsx("flex items-center gap-3 cursor-pointer rounded-lg px-2 py-1 transition-all", activePipeline === 'borewellwater' ? 'bg-indigo-100 ring-2 ring-indigo-400' : 'hover:bg-slate-50')} onClick={() => handlePipelineClick('borewellwater')}>
                            <div className="w-8 h-8 flex items-center justify-center">
                                <div className="w-full h-1 bg-[#000080] rounded-full shadow-sm"></div>
                            </div>
                            <span className="text-sm font-semibold text-slate-700">Borewell Water</span>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
};
