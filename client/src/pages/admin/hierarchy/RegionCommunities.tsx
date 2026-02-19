import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { adminService } from '../../../services/admin';
import { ChevronRight, Building, Wifi, ArrowLeft } from 'lucide-react';

const RegionCommunities = () => {
    const { regionId } = useParams(); // regionId is actually the region name here
    const navigate = useNavigate();
    const [communities, setCommunities] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchCommunities = async () => {
            try {
                const data = await adminService.getCommunities();
                // Filter by region name (URL parameter)
                const regionComms = data.filter((c: any) => c.region === regionId);
                setCommunities(regionComms);
            } catch (error) {
                console.error('Failed to fetch communities:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchCommunities();
    }, [regionId]);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Breadcrumb-ish Header */}
            <div className="flex items-center gap-2 text-sm text-slate-500 mb-4">
                <span onClick={() => navigate('/superadmin/regions')} className="hover:text-blue-600 cursor-pointer">Regions</span>
                <ChevronRight size={14} />
                <span className="font-bold text-slate-800">{regionId}</span>
            </div>

            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800">{regionId} Communities</h2>
                    <p className="text-slate-500">Select a community to manage customers and devices.</p>
                </div>
                <button
                    onClick={() => navigate('/superadmin/regions')}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm font-medium"
                >
                    <ArrowLeft size={16} /> Back
                </button>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-500 uppercase tracking-wider">
                            <th className="px-6 py-4">Community Name</th>
                            <th className="px-6 py-4">Zone / Area</th>
                            <th className="px-6 py-4">Infrastructure Nodes</th>
                            <th className="px-6 py-4">System Health</th>
                            <th className="px-6 py-4 text-right">Action</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {communities.map((community: any) => (
                            <tr
                                key={community.id}
                                onClick={() => navigate(`/superadmin/communities/${community.id}`)}
                                className="group hover:bg-blue-50/50 transition-colors cursor-pointer"
                            >
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600">
                                            <Building size={16} />
                                        </div>
                                        <span className="font-bold text-slate-800 group-hover:text-blue-600 transition-colors">
                                            {community.name}
                                        </span>
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-sm text-slate-600 font-medium">
                                    {community.city || 'N/A'}
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-2 text-sm text-slate-600">
                                        <Wifi size={14} className="text-slate-400" />
                                        {community.node_count || 0} Nodes
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-2">
                                        <div className="w-16 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                                            <div
                                                className="h-full rounded-full bg-green-500"
                                                style={{ width: '100%' }}
                                            />
                                        </div>
                                        <span className="text-xs font-bold text-green-600">
                                            100%
                                        </span>
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <ChevronRight size={18} className="text-slate-300 group-hover:text-blue-500 inline-block" />
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                {communities.length === 0 && (
                    <div className="p-12 text-center text-slate-500">
                        No communities found in this region.
                    </div>
                )}
            </div>
        </div>
    );
};

export default RegionCommunities;
