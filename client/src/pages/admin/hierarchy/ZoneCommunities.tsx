import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { adminService } from '../../../services/admin';
import { supabase } from '../../../lib/supabase';
import { ChevronRight, Building, Wifi, ArrowLeft } from 'lucide-react';
import type { RegionRow, CommunityRow } from '../../../types/database';

type CommunityWithCount = CommunityRow & { node_count?: number }

const RegionCommunities = () => {
    const { regionId } = useParams(); // regionId is actually the zone name here
    const navigate = useNavigate();
    const [communities, setCommunities] = useState<CommunityWithCount[]>([]);
    const [regionData, setRegionData] = useState<RegionRow | null>(null);
    const [loading, setLoading] = useState(true);


    useEffect(() => {
        const fetchCommunitiesAndRegion = async () => {
            if (!regionId) return;
            try {
                const [comms, zone] = await Promise.all([
                    adminService.getCommunities(regionId),
                    adminService.getRegion(regionId)
                ]);

                setCommunities(comms as CommunityWithCount[]);
                setRegionData(zone as RegionRow);
            } catch (error) {
                console.error('Failed to fetch communities:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchCommunitiesAndRegion();
    }, [regionId]);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    return (
        <div className="glass-dashboard min-h-screen p-8">
            {/* Breadcrumb-ish Header */}
            <div className="flex items-center gap-[8px] text-[13px] text-[#1F2937] opacity-60 mb-[16px] tracking-wide font-[500]">
                <span onClick={() => navigate('/superadmin/zones')} className="hover:opacity-100 cursor-pointer transition-opacity">Zones</span>
                <ChevronRight size={14} className="opacity-50" />
                <span className="font-[600] text-[#1F2937] opacity-100">{regionData?.name || 'Loading Zone...'}</span>
            </div>

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-[24px]">
                <div>
                    <h2 className="text-[28px] font-[600] tracking-[-0.5px] text-[#1F2937] leading-tight">{regionData?.name || 'Unknown Zone'} Communities</h2>
                    <p className="glass-secondary mt-1">Select a community to manage customers and devices inside this precise zone.</p>
                </div>
                <button
                    onClick={() => navigate('/superadmin/zones')}
                    className="flex items-center gap-[8px] px-4 py-2 rounded-[12px] border border-[rgba(255,255,255,0.4)] bg-[rgba(255,255,255,0.3)] text-[#1F2937] opacity-80 hover:bg-[rgba(255,255,255,0.5)] text-[13px] font-[600] shadow-sm transition-all"
                >
                    <ArrowLeft size={16} /> Back
                </button>
            </div>

            <div className="apple-glass-card">
                <div className="apple-glass-content">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-[rgba(255,255,255,0.1)] text-[11px] font-[600] text-[#1F2937] opacity-70 uppercase tracking-wider">
                                <th className="px-6 py-5">Community Name</th>
                                <th className="px-6 py-5">Zone / Area</th>
                                <th className="px-6 py-5">Infrastructure Nodes</th>
                                <th className="px-6 py-5">System Health</th>
                                <th className="px-6 py-5 text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[rgba(255,255,255,0.1)]">
                            {communities.map((community) => (
                                <tr
                                    key={community.id}
                                    onClick={() => navigate(`/superadmin/communities/${community.id}`)}
                                    className="group hover:bg-[rgba(255,255,255,0.2)] transition-colors cursor-pointer"
                                >
                                    <td className="px-6 py-5">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-[12px] bg-[rgba(255,255,255,0.3)] flex items-center justify-center text-[#1F2937] opacity-80 border border-[rgba(255,255,255,0.4)] shadow-sm group-hover:scale-105 transition-transform">
                                                <Building size={18} />
                                            </div>
                                            <div>
                                                <span className="font-[600] text-slate-800 text-[14px] group-hover:text-[#3A7AFE] transition-colors block">
                                                    {community.name}
                                                </span>
                                                <span className="text-[11px] text-[#1F2937] opacity-50 font-mono tracking-tighter uppercase">{community.id?.substring(0, 8)}</span>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-[13px] text-[#1F2937] font-[500] opacity-90">
                                        {community.address || community.pincode || 'N/A'}
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2 text-[13px] text-[#1F2937] opacity-80">
                                            <Wifi size={14} className="opacity-50" />
                                            {community.node_count || 0} Nodes
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                            <div className="w-16 h-1.5 rounded-full bg-[rgba(255,255,255,0.3)] overflow-hidden shadow-inner">
                                                <div
                                                    className="h-full rounded-full bg-[#16A34A]"
                                                    style={{ width: '100%' }}
                                                />
                                            </div>
                                            <span className="text-[12px] font-[600] text-[#16A34A]">
                                                100%
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <ChevronRight size={18} className="text-[#1F2937] opacity-30 group-hover:text-[#3A7AFE] group-hover:opacity-100 transition-all inline-block" />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    {communities.length === 0 && (
                        <div className="p-12 text-center text-[#1F2937] opacity-50 font-[500]">
                            No communities found in this zone.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default RegionCommunities;
