import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { adminService } from '../../../services/admin';
import { supabase } from '../../../lib/supabase';
import { ChevronRight, User, Smartphone, AlertCircle, ArrowLeft } from 'lucide-react';
import type { RegionRow, CommunityRow } from '../../../types/database';

const CommunityCustomers = () => {
    const { communityId } = useParams();
    const navigate = useNavigate();
    const [community, setCommunity] = useState<CommunityRow | null>(null);
    const [regionData, setRegionData] = useState<RegionRow | null>(null);
    const [clients, setClients] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);


    useEffect(() => {
        const fetchData = async () => {
            if (!communityId) return;
            try {
                const commRes = await (supabase.from('communities') as any).select('*, zones(*)').eq('id', communityId).single();
                const clientRes = await adminService.getClients(communityId);

                if (commRes.data) {
                    const data = commRes.data as any;
                    setCommunity(data as CommunityRow);
                    setRegionData(data.zones as unknown as RegionRow);
                }
                setClients(clientRes as any[]);
            } catch (error) {
                console.error('Failed to fetch community clients:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [communityId]);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    if (!community) return <div className="p-8 text-center text-slate-500">Community not found</div>;

    return (
        <div className="space-y-6">
            {/* Breadcrumb */}
            <div className="flex items-center gap-2 text-sm text-slate-500 mb-4 tracking-wide font-medium">
                <span onClick={() => navigate('/superadmin/zones')} className="hover:text-blue-600 cursor-pointer transition-colors">Zones</span>
                <ChevronRight size={14} className="text-slate-400" />
                <span onClick={() => navigate(`/superadmin/zones/${regionData?.id}`)} className="hover:text-blue-600 cursor-pointer transition-colors truncate max-w-[150px]">{regionData?.name || 'Loading Zone...'}</span>
                <ChevronRight size={14} className="text-slate-400" />
                <span className="font-bold text-slate-800">{community.name}</span>
            </div>

            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-extrabold text-slate-800 tracking-tight">{community.name}</h2>
                    <p className="text-slate-500 mt-1">Manage residents and their assigned devices in this community.</p>
                </div>
                <button
                    onClick={() => navigate(`/superadmin/zones/${regionData?.id}`)}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-white/30 text-sm font-bold shadow-sm transition-all hover:shadow"
                >
                    <ArrowLeft size={16} /> Back to Zone
                </button>
            </div>

            <div className="apple-glass-card rounded-3xl border border-slate-200/80 overflow-hidden shadow-sm">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="apple-glass-inner border-b border-slate-200/80 text-[10px] font-extrabold text-slate-500 uppercase tracking-widest">
                            <th className="px-6 py-5">Customer Profile</th>
                            <th className="px-6 py-5">Contact Details</th>
                            <th className="px-6 py-5">Assigned Hardware</th>
                            <th className="px-6 py-5">Network Status</th>
                            <th className="px-6 py-5 text-right">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {clients.map((client) => (
                            <tr
                                key={client.id}
                                onClick={() => navigate(`/superadmin/customers/${client.id}`)}
                                className="group hover:bg-blue-50/50 transition-colors cursor-pointer"
                            >
                                <td className="px-6 py-5">
                                    <div className="flex items-center gap-4">
                                        <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-indigo-50 to-indigo-100/50 flex items-center justify-center text-indigo-600 border border-indigo-200/50 shadow-inner group-hover:scale-105 transition-transform">
                                            <User size={20} />
                                        </div>
                                        <div>
                                            <span className="font-extrabold text-slate-800 text-[15px] group-hover:text-indigo-600 transition-colors block">
                                                {client.name || 'Unnamed Client'}
                                            </span>
                                            <span className="text-[11px] text-slate-400 font-mono tracking-tighter uppercase block mt-0.5">{client.id.substring(0, 8)}</span>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-5">
                                    <div>
                                        <p className="text-[13px] text-slate-700 font-bold">{client.email || 'No email'}</p>
                                        <p className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest mt-0.5">{client.phone || 'No Phone'}</p>
                                    </div>
                                </td>
                                <td className="px-6 py-5">
                                    <div className="flex items-center gap-2 text-[13px] font-bold text-slate-600">
                                        <div className="w-8 h-8 rounded-lg apple-glass-inner border border-slate-100 flex items-center justify-center">
                                            <Smartphone size={14} className="text-slate-400" />
                                        </div>
                                        {client.devices?.length || 0} Nodes
                                    </div>
                                </td>
                                <td className="px-6 py-5">
                                    {client.devices && client.devices.length > 0 && client.devices.some((d: any) => d.status === 'alert') ? (
                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-50 text-red-600 text-xs font-bold border border-red-100">
                                            <AlertCircle size={12} /> Alert
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-50 text-green-600 text-xs font-bold border border-green-100">
                                            <div className="w-1.5 h-1.5 rounded-full bg-green-500" /> Active
                                        </span>
                                    )}
                                </td>
                                <td className="px-6 py-5 text-right">
                                    <span className="text-xs font-bold text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity">View Profile</span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {clients.length === 0 && (
                    <div className="p-12 text-center text-slate-500">
                        No customers found in this community.
                    </div>
                )}
            </div>
        </div>
    );
};

export default CommunityCustomers;
