import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { adminService } from '../../../services/admin';
import { ChevronRight, Activity, ArrowLeft, Mail, Phone, MapPin, Box } from 'lucide-react';

const CustomerDetails = () => {
    const { customerId } = useParams();
    const navigate = useNavigate();
    const [client, setClient] = useState<any | null>(null);
    const [loading, setLoading] = useState(true);


    useEffect(() => {
        const fetchData = async () => {
            if (!customerId) return;
            try {
                const data = await adminService.getClient(customerId);
                if (data) setClient(data);
            } catch (error) {
                console.error('Failed to fetch client details:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [customerId]);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    if (!client) return <div className="p-8 text-center text-slate-500">Customer not found</div>;

    const community = client.communities;
    const zone = community?.zones;

    return (
        <div className="space-y-6">
            {/* Breadcrumb */}
            <div className="flex items-center gap-2 text-sm text-slate-500 mb-4 overflow-hidden">
                <span onClick={() => navigate('/superadmin/zones')} className="hover:text-blue-600 cursor-pointer shrink-0">Zones</span>
                <ChevronRight size={14} className="shrink-0" />
                <span onClick={() => navigate(`/superadmin/zones/${zone?.id}`)} className="hover:text-blue-600 cursor-pointer truncate max-w-[100px]">{zone?.name || 'Zone'}</span>
                <ChevronRight size={14} className="shrink-0" />
                <span onClick={() => navigate(`/superadmin/communities/${community?.id}`)} className="hover:text-blue-600 cursor-pointer truncate max-w-[100px]">{community?.name || 'Community'}</span>
                <ChevronRight size={14} className="shrink-0" />
                <span className="font-bold text-slate-800 truncate">{client.name}</span>
            </div>

            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800">{client.name}</h2>
                    <p className="text-slate-500">Customer Profile & Device Management</p>
                </div>
                <button
                    onClick={() => navigate(`/superadmin/communities/${community?.id}`)}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-white/30 text-sm font-medium"
                >
                    <ArrowLeft size={16} /> Back
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Profile Card */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="apple-glass-card p-6 rounded-2xl border border-slate-200 shadow-sm">
                        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Contact Details</h3>

                        <div className="space-y-4">
                            <div className="flex items-start gap-3">
                                <div className="p-2 rounded-lg bg-blue-50 text-blue-600 mt-1">
                                    <Mail size={16} />
                                </div>
                                <div>
                                    <p className="text-xs text-slate-500 font-bold uppercase">Email Address</p>
                                    <p className="text-slate-800 font-medium">{client.email || 'N/A'}</p>
                                </div>
                            </div>

                            <div className="flex items-start gap-3">
                                <div className="p-2 rounded-lg bg-green-50 text-green-600 mt-1">
                                    <Phone size={16} />
                                </div>
                                <div>
                                    <p className="text-xs text-slate-500 font-bold uppercase">Phone Number</p>
                                    <p className="text-slate-800 font-medium">{client.phone || 'N/A'}</p>
                                </div>
                            </div>

                            <div className="flex items-start gap-3">
                                <div className="p-2 rounded-lg bg-purple-50 text-purple-600 mt-1">
                                    <MapPin size={16} />
                                </div>
                                <div>
                                    <p className="text-xs text-slate-500 font-bold uppercase">Community</p>
                                    <p className="text-slate-800 font-medium">{community?.name || 'N/A'}</p>
                                    <p className="text-xs text-slate-400">{zone?.name || ''}</p>
                                </div>
                            </div>

                            {client.address && (
                                <div className="flex items-start gap-3">
                                    <div className="p-2 rounded-lg bg-orange-50 text-orange-600 mt-1">
                                        <MapPin size={16} />
                                    </div>
                                    <div>
                                        <p className="text-xs text-slate-500 font-bold uppercase">Address</p>
                                        <p className="text-slate-800 font-medium">{client.address}</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Devices List */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="apple-glass-card p-6 rounded-2xl border border-slate-200 shadow-sm">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Assigned Devices</h3>
                            <button className="text-xs font-bold text-blue-600 hover:text-blue-700">+ Add Device</button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {(client.devices || []).map((device: any) => (
                                <div key={device.id} className="p-4 rounded-xl border border-slate-200 hover:border-blue-300 hover:shadow-md transition-all apple-glass-inner">
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="flex items-center gap-3">
                                            <div className={`p-2 rounded-lg ${
                                                device.analytics_template === 'EvaraTank' ? 'bg-indigo-100 text-indigo-600' :
                                                device.analytics_template === 'EvaraFlow' ? 'bg-cyan-100 text-cyan-600' :
                                                'bg-sky-100 text-sky-600'
                                            }`}>
                                                <Box size={20} />
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-slate-800">{device.label || device.node_key}</h4>
                                                <p className="text-xs text-slate-400">{device.analytics_template}</p>
                                                <p className="text-xs text-slate-500 font-mono">{device.node_key}</p>
                                            </div>
                                        </div>
                                        <div className={`px-2 py-1 rounded text-[10px] font-bold uppercase border ${
                                            device.status === 'Online' ? 'bg-green-100 text-green-700 border-green-200' :
                                            'bg-slate-200 text-slate-600 border-slate-300'
                                        }`}>
                                            {device.status || 'Offline'}
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-between text-xs text-slate-500 mt-4 pt-4 border-t border-slate-200/60">
                                        <span className="flex items-center gap-1">
                                            <Activity size={12} /> Last Seen
                                        </span>
                                        <span className="font-medium text-slate-700">Recently</span>
                                    </div>

                                    <button className="w-full mt-3 py-2 rounded-lg apple-glass-card border border-slate-200 text-xs font-bold text-slate-600 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-colors">
                                        Configure Device
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CustomerDetails;
