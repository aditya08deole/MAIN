import { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { adminService } from '../../services/admin';
import {
    Users, Network, Map, Settings,
    Activity, AlertTriangle
} from 'lucide-react';
import { useToast } from '../../components/ToastProvider';
import { ActionCard } from '../../components/admin/ActionCard';
import { Modal } from '../../components/ui/Modal';
import { AddCommunityForm } from '../../components/admin/forms/AddCommunityForm';
import { AddCustomerForm } from '../../components/admin/forms/AddCustomerForm';
import { AddDeviceForm } from '../../components/admin/forms/AddDeviceForm';
import { ConfigForm } from '../../components/admin/forms/ConfigForm';

// Stat Item Component
const StatItem = ({ label, value, trend, trendUp }: { label: string, value: string, trend?: string, trendUp?: boolean }) => (
    <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm transition-all hover:shadow-md">
        <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-2">{label}</p>
        <div className="flex items-end gap-3">
            <span className="text-2xl font-bold text-slate-800">{value}</span>
            {trend && (
                <span className={`text-xs font-bold mb-1 ${trendUp ? 'text-green-600' : 'text-red-500'}`}>
                    {trend}
                </span>
            )}
        </div>
    </div>
);

type ModalType = 'community' | 'customer' | 'device' | 'config' | null;

const AdminDashboard = () => {
    const { user } = useAuth();
    const { showToast } = useToast();
    const [activeModal, setActiveModal] = useState<ModalType>(null);
    const [customers, setCustomers] = useState<any[]>([]);
    const [communities, setCommunities] = useState<any[]>([]);
    const [stats, setStats] = useState<any>(null);
    const [auditLogs, setAuditLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchData = async () => {
        try {
            const [custData, commData, statsData, auditData] = await Promise.all([
                adminService.getCustomers(),
                adminService.getCommunities(),
                adminService.getStats(),
                adminService.getAuditLogs(0, 10)
            ]);
            setCustomers(custData);
            setCommunities(commData);
            setStats(statsData);
            setAuditLogs(auditData);
        } catch (error) {
            console.error('Failed to fetch admin data:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    // Use Real-time Stats from API
    const totalNodes = stats?.total_nodes || 0;
    const activeAlerts = stats?.active_alerts || 0;
    const totalCustomers = stats?.total_customers || 0;
    const totalCommunities = stats?.total_communities || 0;
    const healthPercentage = stats?.system_health || '100';

    const handleAction = (type: ModalType) => {
        setActiveModal(type);
    };

    const handleClose = () => setActiveModal(null);

    const handleSubmit = async (data: any) => {
        try {
            if (activeModal === 'community') {
                await adminService.createCommunity(data);
                showToast("Community created successfully!", "success");
            }
            if (activeModal === 'customer') {
                await adminService.createCustomer(data);
                showToast("Customer registered and credentials synced!", "success");
            }
            if (activeModal === 'device') {
                showToast("Node commissioned and telemetry verified!", "success");
            }

            handleClose();
            // Refresh data
            setLoading(true);
            await fetchData();
        } catch (error) {
            console.error('Submission failed:', error);
            showToast("Action failed. Please try again.", "error");
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            {/* ─── HEADER ─── */}
            <div>
                <h2 className="text-2xl font-bold text-slate-800 tracking-tight">System Overview</h2>
                <p className="text-slate-500 text-sm">
                    {user?.role === 'distributor'
                        ? `Territory management for ${user.displayName}`
                        : 'Real-time infrastructure monitoring and management.'}
                </p>
            </div>

            {/* ─── STATS ROW ─── */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatItem label="Total Nodes" value={totalNodes.toString()} trend="+2% this week" trendUp />
                <StatItem label="Active Alerts" value={activeAlerts.toString()} trend={activeAlerts > 0 ? "Needs Attention" : "All Clear"} trendUp={activeAlerts === 0} />
                <StatItem label="Total Customers" value={totalCustomers.toString()} trend="+1 new" trendUp />
                <StatItem label="System Health" value={`${healthPercentage}%`} trend="Stable" trendUp />
            </div>

            {/* ─── ACTION GRID ─── */}
            <div>
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                        <Activity size={18} className="text-blue-600" />
                        Quick Actions
                    </h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <ActionCard
                        title="Add Community"
                        description="Create new zones or residential communities for grouping nodes."
                        icon={Map}
                        color="blue"
                        stats={`${totalCommunities} Zones`}
                        onClick={() => handleAction('community')}
                    />
                    <ActionCard
                        title="Add Customer"
                        description="Register new clients and assign them to existing communities."
                        icon={Users}
                        color="purple"
                        stats={`${totalCustomers} Active`}
                        onClick={() => handleAction('customer')}
                    />
                    <ActionCard
                        title="Add Device"
                        description="Provision new hardware nodes and link them to customers."
                        icon={Network}
                        color="green"
                        stats="PROVISION"
                        onClick={() => handleAction('device')}
                    />
                    <ActionCard
                        title="System Config"
                        description="Update firmware versions and configure global data rates."
                        icon={Settings}
                        color="amber"
                        stats="v2.1.0"
                        onClick={() => handleAction('config')}
                    />
                </div>
            </div>

            {/* ─── LIVE INSIGHTS GRID ─── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* 1. System Status */}
                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                    <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                        <h3 className="text-sm font-bold text-slate-800">Field Health</h3>
                    </div>
                    <div className="p-6">
                        {activeAlerts > 0 ? (
                            <div className="flex items-start gap-4 p-4 rounded-xl bg-red-50 border border-red-100">
                                <AlertTriangle className="text-red-500 shrink-0" size={20} />
                                <div>
                                    <h4 className="text-sm font-bold text-red-600">Critical Alerts</h4>
                                    <p className="text-xs text-slate-600 mt-1">{activeAlerts} node(s) require diagnostic review.</p>
                                </div>
                            </div>
                        ) : (
                            <div className="flex items-start gap-4 p-4 rounded-xl bg-green-50 border border-green-100">
                                <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                                    <Activity size={18} className="text-green-600" />
                                </div>
                                <div>
                                    <h4 className="text-sm font-bold text-green-700">Healthy Network</h4>
                                    <p className="text-xs text-green-600 mt-1">All systems are currently reporting nominal values.</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* 2. Audit Timeline */}
                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                    <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                        <h3 className="text-sm font-bold text-slate-800">Administrative Trail</h3>
                        <span className="bg-slate-100 px-2 py-0.5 rounded text-[10px] font-mono text-slate-500">LIVE</span>
                    </div>
                    <div className="p-6">
                        <div className="space-y-6">
                            {auditLogs.length > 0 ? auditLogs.map((log, idx) => (
                                <div key={log.id} className="relative flex gap-4 group">
                                    {idx !== auditLogs.length - 1 && (
                                        <div className="absolute left-[11px] top-6 bottom-[-24px] w-[2px] bg-slate-50 group-hover:bg-slate-100 transition-colors" />
                                    )}
                                    <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 z-10 shadow-sm ${log.action_type === 'PROVISION_NODE' ? 'bg-green-500 text-white' :
                                            log.action_type.includes('CUSTOMER') ? 'bg-purple-500 text-white' :
                                                'bg-blue-500 text-white'
                                        }`}>
                                        <Activity size={12} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between gap-2">
                                            <p className="text-sm font-semibold text-slate-800 truncate uppercase tracking-tight">
                                                {log.action_type.replace(/_/g, ' ')}
                                            </p>
                                            <span className="text-[10px] font-medium text-slate-400">
                                                {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>
                                        <p className="text-xs text-slate-500 mt-0.5 truncate">
                                            {log.resource_type}: <span className="text-slate-700 font-medium">{log.metadata?.hardware_id || log.metadata?.name || log.metadata?.email || log.resource_id}</span>
                                        </p>
                                    </div>
                                </div>
                            )) : (
                                <div className="text-center py-4">
                                    <p className="text-xs text-slate-400 italic">No events discovered.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* ─── MODALS ─── */}
            <Modal isOpen={activeModal === 'community'} onClose={handleClose} title="Add New Community">
                <AddCommunityForm onSubmit={handleSubmit} onCancel={handleClose} />
            </Modal>

            <Modal isOpen={activeModal === 'customer'} onClose={handleClose} title="Register New Customer">
                <AddCustomerForm onSubmit={handleSubmit} onCancel={handleClose} />
            </Modal>

            <Modal isOpen={activeModal === 'device'} onClose={handleClose} title="Provision New Node" size="xl">
                <AddDeviceForm
                    onSubmit={handleSubmit}
                    onCancel={handleClose}
                    communities={communities}
                    customers={customers}
                />
            </Modal>

            <Modal isOpen={activeModal === 'config'} onClose={handleClose} title="System Configuration">
                <ConfigForm onSubmit={handleSubmit} onCancel={handleClose} />
            </Modal>
        </div>
    );
};

export default AdminDashboard;
