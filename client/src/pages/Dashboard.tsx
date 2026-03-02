import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useDashboardSummary } from '../hooks/useDashboardSummary';
import { useMapDevices } from '../hooks/useMapDevices';
import { useMapPipelines } from '../hooks/useMapPipelines';
import { adminService } from '../services/admin';
import { ArrowUpRight, ListFilter, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';

// Operational Components
import KPIAuthoritativeCard from '../components/dashboard/KPIAuthoritativeCard';
import ProductPieChart from '../components/dashboard/ProductPieChart';
import AlertsActivityPanel from '../components/dashboard/AlertsActivityPanel';
import LiveLogsPanel from '../components/dashboard/LiveLogsPanel';
import NodeDataExplorer from '../components/dashboard/NodeDataExplorer';
import SharedMap from '../components/map/SharedMap';
import ErrorBoundary from '../components/ErrorBoundary';

/**
 * KPI Unit for simple metric display
 */
const KPIUnitCard = ({ label, value, trend, trendLabel, variant = 'default' }: any) => (
    <div className="apple-glass-card p-[20px] rounded-[30px] flex-1 flex flex-col justify-center shadow-sm">
        <span className="text-[12px] font-[800] text-[#1f2937]/70 uppercase tracking-[0.1em] mb-2">{label}</span>
        <div className="flex items-baseline gap-2">
            <h2 className={clsx(
                "text-[26px] font-[800] leading-none tracking-tight",
                variant === 'alert' ? "text-red-600" : "text-[#004ba0]"
            )}>
                {value}
            </h2>
            {trend !== undefined && (
                <span className="text-[10px] font-bold text-gray-400 uppercase">
                    {trend} {trendLabel}
                </span>
            )}
        </div>
    </div>
);

function Dashboard() {
    const { data: summary, isLoading: statsLoading } = useDashboardSummary();
    const { data: devices = [], isLoading: devicesLoading } = useMapDevices();
    const { pipelines } = useMapPipelines();
    const [showLogsDrawer, setShowLogsDrawer] = useState(false);

    const { data: auditLogs = [] } = useQuery({
        queryKey: ['dashboard_audit_logs'],
        queryFn: async () => {
            const logs = await adminService.getAuditLogs(15);
            return logs.map(l => ({
                id: l.id,
                device_id: l.resource_id || 'SYSTEM',
                event_type: l.action_type,
                timestamp: new Date(l.created_at).toLocaleTimeString(),
                severity: (l.action_type.toLowerCase().includes('critical') ? 'critical' :
                    l.action_type.toLowerCase().includes('warn') ? 'warning' : 'info') as 'critical' | 'warning' | 'info'
            }));
        },
        staleTime: 1000 * 60 * 5,
    });

    const isLoading = statsLoading || devicesLoading;

    // Map devices to Explorer format
    const explorerNodes = devices.map(d => {
        const lastSeen = d.last_seen;
        const lastSeenDate = lastSeen ? new Date(lastSeen) : null;
        const isStale = lastSeenDate
            ? (new Date().getTime() - lastSeenDate.getTime()) > 10 * 60 * 1000
            : true;

        return {
            id: d.id,
            name: d.label || d.name || d.node_key || 'Unknown Node',
            type: (d.asset_type === 'tank' || d.asset_type === 'sump' || (d as any).analytics_template === 'EvaraTank') ? 'tank' :
                ((d.asset_type === 'flow' || d.asset_type === 'flow_meter' || (d as any).analytics_template === 'EvaraFlow') ? 'flow' : 'deep') as 'tank' | 'flow' | 'deep',
            status: (d.status === 'Online' && !isStale ? 'Online' : 'Offline') as 'Online' | 'Offline',
            isStale,
            lastSeen: lastSeen || undefined,
            metrics: d.last_telemetry || {},
            location: d.name?.includes('Sector') ? 'Sector 1' : 'Main Campus',
            device: d.asset_category || d.asset_type || 'Sensor'
        };
    });

    const totalStale = explorerNodes.filter(n => n.isStale).length;
    const systemStatus = totalStale > (devices.length * 0.2) ? 'Attention' : 'Optimal';

    return (
        <div className="w-full h-screen overflow-hidden bg-transparent relative flex flex-col">
            <div className="absolute inset-0 opacity-[0.015] pointer-events-none z-0" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }}></div>

            <div className="flex-1 w-full px-8 pt-[110px] pb-[40px] overflow-hidden flex flex-col relative z-10 gap-[24px]">

                <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
                    <div>
                        <h1 className="text-[36px] font-[800] tracking-tight text-[#004ba0] leading-none mb-2">System Dashboard</h1>
                        <p className="text-[12px] text-blue-500 font-bold uppercase tracking-[0.2em] leading-none">REAL-TIME NETWORK INTELLIGENCE</p>
                    </div>

                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => setShowLogsDrawer(true)}
                            className="flex items-center gap-3 px-6 py-2.5 rounded-[24px] bg-white/40 hover:bg-white text-[13px] font-[800] text-blue-600 shadow-sm border border-white/60 transition-all backdrop-blur-md group"
                        >
                            <ListFilter size={16} className="group-hover:rotate-12 transition-transform" />
                            SEE LIVE SYSTEM LOGS
                        </button>

                        <div className="flex items-center gap-2 px-6 py-2.5 rounded-[24px] bg-white/60 border border-white/80 shadow-sm backdrop-blur-md">
                            <div className={clsx("w-2 h-2 rounded-full", isLoading ? "bg-amber-400 animate-pulse" : "bg-green-500 shadow-[0_0_10px_rgba(22,163,74,0.5)]")} />
                            <span className="text-[12px] font-[800] text-gray-600 uppercase tracking-tighter leading-none">Live System</span>
                        </div>
                    </div>
                </header>

                <div className="flex-1 grid grid-cols-12 gap-[24px] min-h-0" style={{ gridTemplateRows: '38% minmax(0, 1fr)' }}>

                    {/* ROW 1 */}
                    <div className="col-span-3 h-full">
                        <KPIAuthoritativeCard
                            total={summary?.total_devices || 0}
                            online={summary?.online_devices || 0}
                            offline={Math.max(0, (summary?.total_devices || 0) - (summary?.online_devices || 0))}
                            className="h-full"
                        />
                    </div>

                    <div className="col-span-3 h-full">
                        <AlertsActivityPanel
                            total={summary?.alerts_active || 0}
                            critical={summary?.alerts_critical || 0}
                            warning={summary?.alerts_warning || 0}
                            recentAlerts={auditLogs.slice(0, 3)}
                            className="h-full"
                        />
                    </div>

                    <div className="col-span-2 h-full flex flex-col gap-[24px]">
                        <div className="apple-glass-card p-[20px] rounded-[30px] flex-1 flex flex-col justify-center shadow-sm">
                            <span className="text-[12px] font-[800] text-[#1f2937]/70 uppercase tracking-[0.1em] mb-2">System Health</span>
                            <div className="flex items-center gap-2">
                                <span className={clsx(
                                    "w-3 h-3 rounded-full shadow-lg",
                                    systemStatus === 'Optimal' ? "bg-green-500 shadow-green-500/50" : "bg-amber-500 shadow-amber-500/50"
                                )} />
                                <span className="text-[18px] font-[800] text-gray-800 leading-none">{summary?.system_health || 100}%</span>
                            </div>
                        </div>
                        <KPIUnitCard
                            label="Active Alerts"
                            value={summary?.alerts_active || 0}
                            trend={summary?.alerts_critical || 0}
                            trendLabel="Critical"
                            variant="alert"
                        />
                    </div>

                    <div className="col-span-4 h-full relative group rounded-[50px] overflow-hidden border border-white/40 shadow-sm">
                        <SharedMap
                            devices={devices}
                            pipelines={pipelines}
                            height="100%"
                            showZoom={false}
                            className="h-full"
                        />
                        <div className="absolute top-4 right-4 z-[500]">
                            <Link
                                to="/map"
                                className="px-5 py-2 rounded-[20px] bg-white text-[11px] font-[800] text-blue-600 shadow-xl border border-white flex items-center gap-2 transition-all opacity-0 group-hover:opacity-100 uppercase tracking-widest"
                            >
                                Expand Map <ArrowUpRight size={14} />
                            </Link>
                        </div>
                    </div>

                    {/* ROW 2 */}
                    <div className="col-span-4 h-full">
                        <ProductPieChart
                            tank={devices.filter(d => (d as any).analytics_template === 'EvaraTank' || d.asset_type === 'tank' || d.asset_type === 'sump').length}
                            flow={devices.filter(d => (d as any).analytics_template === 'EvaraFlow' || d.asset_type === 'flow' || d.asset_type === 'flow_meter').length}
                            deep={devices.filter(d => (d as any).analytics_template === 'EvaraDeep' || d.asset_type === 'bore' || d.asset_type === 'govt').length}
                            className="h-full"
                        />
                    </div>

                    <div className="col-span-8 h-full min-h-0">
                        <NodeDataExplorer
                            nodes={explorerNodes}
                            className="h-full"
                        />
                    </div>
                </div>

                {showLogsDrawer && (
                    <div className="fixed inset-0 z-[1000] flex justify-end">
                        <div className="absolute inset-0 bg-black/10 backdrop-blur-[2px]" onClick={() => setShowLogsDrawer(false)} />
                        <aside className="w-full max-w-[450px] bg-white/80 backdrop-blur-2xl border-l border-white/40 shadow-2xl relative z-10 flex flex-col animate-in slide-in-from-right duration-500">
                            <div className="p-8 flex items-center justify-between border-b border-gray-100">
                                <div>
                                    <h3 className="text-[20px] font-[800] text-gray-800 tracking-tight leading-none mb-1">System Event Logs</h3>
                                    <p className="text-[12px] text-gray-400 font-bold uppercase tracking-widest leading-none">Real-time Telemetry Stream</p>
                                </div>
                                <button
                                    onClick={() => setShowLogsDrawer(false)}
                                    className="p-2 rounded-full hover:bg-gray-100 text-gray-400 transition-colors"
                                >
                                    <X size={24} />
                                </button>
                            </div>
                            <div className="flex-1 overflow-hidden p-4">
                                <LiveLogsPanel logs={auditLogs} className="h-full !bg-transparent !border-none !shadow-none !p-0" />
                            </div>
                        </aside>
                    </div>
                )}
            </div>
        </div>
    );
}

export default function DashboardWithBoundary() {
    return (
        <ErrorBoundary>
            <Dashboard />
        </ErrorBoundary>
    );
}
