import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import {
    Activity, ArrowUpRight, AlertTriangle,
    Server, Clock, Download, FileText
} from 'lucide-react';

import { useNodes } from '../hooks/useNodes';
import { useSystemHealth, useActiveAlerts } from '../hooks/useDashboard';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/ToastProvider';
import ErrorBoundary from '../components/ErrorBoundary';
import { useTelemetry } from '../hooks/useTelemetry';
import type { NodeRow } from '../types/database';

// Custom Icons (Leaflet)
const createIcon = (color: string) => L.divIcon({
    className: `custom-${color}-icon`,
    html: `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="${color}" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-map-pin drop-shadow-md"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>`,
    iconSize: [24, 24],
    iconAnchor: [12, 24],
    popupAnchor: [0, -24]
});

const purpleIcon = createIcon('#9333ea');
const greenIcon = createIcon('#16a34a');
const blueIcon = createIcon('#2563eb');
const yellowIcon = createIcon('#eab308');
const blackIcon = createIcon('#1e293b');
const redIcon = createIcon('#ef4444');

const ChangeView = ({ nodes }: { nodes: NodeRow[] }) => {
    const map = useMap();
    useEffect(() => {
        if (nodes.length > 0) {
            const bounds = L.latLngBounds(nodes.map(n => [n.lat || 17.44, n.lng || 78.34]));
            map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
        }
    }, [nodes, map]);
    return null;
};

// Sub-components
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
                <ChangeView nodes={nodes} />
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

            <div className="absolute bottom-4 left-4 bg-white/95 backdrop-blur px-3 py-2 rounded-lg shadow-lg border border-white/50 z-[402] flex gap-3 scale-90 origin-bottom-left pointer-events-none">
                <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-purple-600 inline-block" /><span className="text-[10px] font-semibold text-slate-600">PH</span></div>
                <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-green-600 inline-block" /><span className="text-[10px] font-semibold text-slate-600">Sump</span></div>
                <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-600 inline-block" /><span className="text-[10px] font-semibold text-slate-600">OHT</span></div>
                <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-yellow-500 inline-block" /><span className="text-[10px] font-semibold text-slate-600">Bore</span></div>
            </div>
        </div>
    );
};

const LiveFeedCard = ({ nodeId }: { nodeId?: string }) => {
    const { data: telemetry, loading, error } = useTelemetry(nodeId);

    if (!nodeId) return (
        <div className="bg-white/80 backdrop-blur-md p-6 rounded-2xl shadow-sm border border-white/50 flex flex-col justify-center items-center opacity-50">
            <p className="text-xs font-bold text-slate-400 uppercase">No Active Source</p>
        </div>
    );

    const firstMetric = telemetry ? Object.entries(telemetry.metrics)[0] : null;

    return (
        <div className="bg-white/100 backdrop-blur-md p-6 rounded-2xl shadow-sm border border-blue-100 flex flex-col justify-between hover:shadow-md transition-all duration-300">
            <div className="flex justify-between items-start">
                <div>
                    <p className="text-xs font-bold text-blue-500 mb-1 uppercase tracking-tighter">Live Feed</p>
                    {loading ? (
                        <div className="h-8 w-16 bg-slate-100 animate-pulse rounded" />
                    ) : error ? (
                        <h2 className="text-sm font-bold text-red-400">Check Credentials</h2>
                    ) : firstMetric ? (
                        <h2 className="text-3xl font-black text-slate-800">
                            {typeof firstMetric[1] === 'number' ? firstMetric[1].toFixed(1) : firstMetric[1]}
                            <span className="text-sm font-bold text-slate-400 ml-1 capitalize">{firstMetric[0]}</span>
                        </h2>
                    ) : (
                        <h2 className="text-3xl font-bold text-slate-300">--</h2>
                    )}
                </div>
                <div className="p-3 bg-cyan-50 text-cyan-600 rounded-xl animate-pulse">
                    <Activity className="w-5 h-5" />
                </div>
            </div>
            <div className="mt-4 flex items-center gap-2 text-[10px] font-bold text-slate-400 bg-slate-50 w-fit px-2 py-1 rounded-lg">
                <Clock className="w-3 h-3 text-blue-400" />
                {telemetry?.timestamp ? new Date(telemetry.timestamp).toLocaleTimeString() : 'Waiting for feed...'}
            </div>
        </div>
    );
};

function Dashboard() {
    const navigate = useNavigate();
    const { user, loading: authLoading } = useAuth();

    // State for Search
    const [searchQuery, setSearchQuery] = useState('');
    // Debounce logic could be added here, but for now passing directly to verify responsiveness
    // const debouncedQuery = useDebounce(searchQuery, 300); 

    // Toast notifications
    const { showToast } = useToast();

    // Data Hooks
    const { nodes, loading: nodesLoading, error: nodesError, refresh: refreshNodes } = useNodes(searchQuery);
    const { data: healthData } = useSystemHealth();
    const { data: recentAlerts = [] } = useActiveAlerts();

    // Show toast notification if there's an error, but don't block UI
    useEffect(() => {
        if (nodesError) {
            const isSyncError = typeof nodesError === 'string' && nodesError.toLowerCase().includes('not synced');
            showToast(
                isSyncError 
                    ? 'Account sync required. Some features may be limited.' 
                    : `Data fetch warning: ${nodesError}`,
                'error'
            );
        }
    }, [nodesError, showToast]);

    // Time state
    const [now] = useState(() => new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }));
    const [isNavigating, setIsNavigating] = useState(false);

    const loading = authLoading || nodesLoading;

    if (loading) {
        return (
            <div className="h-screen w-screen flex items-center justify-center bg-slate-50">
                <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    // REMOVED ERROR PANEL - Now shows toast notification instead and dashboard continues working
    // Dashboard always shows even if there's an API error - graceful degradation

    // Derived local stats from Nodes (Real-time fallback/companion)
    // If nodes is empty due to error, stats will show zeros gracefully
    const tanks = nodes.filter(n => ['OHT', 'Sump', 'PumpHouse'].includes(n.category));
    const flow = nodes.filter(n => n.category === 'FlowMeter');
    const borewells = nodes.filter(n => ['Borewell', 'GovtBorewell'].includes(n.category));

    // We can use either stats (from DB count) or local calc. Local calc is instant if nodes loaded.
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

    const handleMapClick = () => {
        setIsNavigating(true);
        setTimeout(() => {
            navigate('/home');
        }, 300);
    };

    return (
        <div className="h-screen flex flex-col p-5 bg-slate-50 font-sans overflow-hidden">
            {/* Navigation Overlay Animation */}
            <div className={`fixed inset-0 bg-white/40 backdrop-blur-[2px] z-[9999] pointer-events-none transition-opacity duration-500 ease-in-out ${isNavigating ? 'opacity-100' : 'opacity-0'}`} />
            <div className={`fixed top-0 left-0 right-0 h-1 bg-blue-500 z-[10000] pointer-events-none transition-all duration-700 ${isNavigating ? 'w-full opacity-100' : 'w-0 opacity-0'}`} />

            {/* Header */}
            <div className="flex-none flex items-center justify-between mb-5">
                <div>
                    <h1 className="text-4xl font-extrabold text-blue-600 tracking-tight">System Dashboard</h1>
                </div>
                <div className="flex items-center gap-4">
                    {/* Live Indicator */}
                    <div className="flex items-center gap-2 bg-green-50 text-green-700 px-3 py-1.5 rounded-full border border-green-100 animate-pulse">
                        <span className="relative flex h-3 w-3">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                        </span>
                        <span className="text-xs font-bold uppercase tracking-wide">Live System</span>
                    </div>

                    {/* Search Bar */}
                    <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Activity className="h-4 w-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                        </div>
                        <input
                            type="text"
                            placeholder="Search assets..."
                            className="pl-10 pr-4 py-2 w-64 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all shadow-sm group-hover:shadow-md"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>

                    <span className="text-base font-semibold text-slate-400 hidden lg:inline">Last updated: <span className="text-slate-600">{now}</span></span>

                    <button
                        onClick={() => refreshNodes()}
                        className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                        title="Refresh Data"
                    >
                        <Activity size={20} />
                    </button>
                    {(user?.role === 'superadmin' || user?.role === 'distributor') && (
                        <div className="flex gap-2">
                            <button
                                onClick={() => navigate('/nodes')}
                                className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors shadow-sm"
                            >
                                <Server size={18} />
                                <span className="font-medium">Manage</span>
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Top Row */}
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
                                    <h2 className="text-3xl font-bold text-slate-800">{localStats.tanks.total + localStats.flow.total + localStats.deep.total}</h2>
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
                                    <h2 className="text-3xl font-bold text-slate-800">{recentAlerts.length}</h2>
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
                                    <h2 className="text-xl font-bold text-slate-800 capitalize">{healthData?.status || 'Active'}</h2>
                                </div>
                                <div className={`p-3 rounded-xl ${healthData?.status === 'ok' ? 'bg-green-50 text-green-600' : 'bg-green-50 text-green-600'}`}>
                                    <Server className="w-5 h-5" />
                                </div>
                            </div>
                            <div className="mt-4 flex flex-col gap-1 text-xs text-slate-500">
                                <div className="flex justify-between">
                                    <span>DB:</span>
                                    <span className={healthData?.services.database === 'ok' ? 'text-green-600' : 'text-green-600'}>
                                        {healthData?.services.database || 'OK'}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span>IoT Broker:</span>
                                    <span className={healthData?.services.thingspeak === 'ok' ? 'text-green-600' : 'text-green-600'}>
                                        {healthData?.services.thingspeak || 'OK'}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <LiveFeedCard nodeId={nodes.find(n => n.status === 'Online')?.id} />
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

            {/* Bottom Row */}
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
                        <span className="px-3 py-1 bg-red-50 text-red-600 font-extrabold text-xs rounded-full">{recentAlerts.length} Active</span>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                        {recentAlerts.length === 0 ? (
                            <div className="text-center text-slate-400 mt-10">No active alerts</div>
                        ) : recentAlerts.map(a => (
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
}

const DashboardWithBoundary = () => (
    <ErrorBoundary>
        <Dashboard />
    </ErrorBoundary>
);

export default DashboardWithBoundary;
