import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { adminService } from '../../../services/admin';
import { ChevronRight, User, MapPin, ArrowLeft, AlertCircle } from 'lucide-react';
import type { RegionRow, CommunityRow, UserProfileRow, DeviceRow } from '../../../types/database';

type CustomerWithDevices = UserProfileRow & {
    devices?: Pick<DeviceRow, 'id' | 'status' | 'analytics_template' | 'node_key'>[];
    distributor_id?: string;
};

const RegionCustomers = () => {
    const { regionId } = useParams(); // regionId is the zone name
    const navigate = useNavigate();
    const { user } = useAuth();
    const [communities, setCommunities] = useState<CommunityRow[]>([]);
    const [customers, setCustomers] = useState<CustomerWithDevices[]>([]);
    const [regionData, setRegionData] = useState<RegionRow | null>(null);
    const [loading, setLoading] = useState(true);


    useEffect(() => {
        const fetchData = async () => {
            try {
                const [commData, custData, regData] = await Promise.all([
                    adminService.getCommunities(),
                    adminService.getCustomers(),
                    adminService.getRegions()
                ]);
                setCommunities(commData as CommunityRow[]);
                setCustomers(custData as CustomerWithDevices[]);
                setRegionData((regData as RegionRow[]).find(r => r.id === regionId) || null);
            } catch (error) {
                console.error('Failed to fetch zone customers data:', error);

            } finally {
                setLoading(false);

            }
        };
        fetchData();
    }, [regionId]);

    // Filter Logic: Important bugfix -> use zone_id
    const regionComms = communities.filter(c => c.zone_id === regionId);
    const regionCommIds = regionComms.map(c => c.id);
    let regionCustomers = customers.filter(cust => cust.community_id && regionCommIds.includes(cust.community_id));

    if (user?.role === 'distributor') {
        regionCustomers = regionCustomers.filter(c => c.distributor_id === user.id);
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    return (
        <div className="glass-dashboard min-h-screen p-8">
            {/* Breadcrumb */}
            <div className="flex items-center gap-[8px] text-[13px] text-[#1F2937] opacity-60 mb-[16px] font-[500] tracking-wide">
                <span onClick={() => navigate('/superadmin/zones')} className="hover:opacity-100 cursor-pointer transition-opacity">Zones</span>
                <ChevronRight size={14} className="opacity-50" />
                <span className="font-[600] text-[#1F2937] opacity-100">{regionData?.name || 'Loading Zone...'}</span>
            </div>

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-[24px]">
                <div>
                    <h2 className="text-[28px] font-[600] tracking-[-0.5px] text-[#1F2937] leading-tight">{regionData?.name || 'Unknown Zone'} Customers</h2>
                    <p className="glass-secondary mt-1">Managing all subscribers in the {regionData?.name || 'selected'} operational area.</p>
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
                                <th className="px-6 py-5">Customer Profile</th>
                                <th className="px-6 py-5">Geographic Assignment</th>
                                <th className="px-6 py-5">Platform Status</th>
                                <th className="px-6 py-5">Provisioned Devices</th>
                                <th className="px-6 py-5 text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[rgba(255,255,255,0.1)]">
                            {regionCustomers.map((customer) => {
                                const community = regionComms.find(c => c.id === customer.community_id);
                                const hasAlert = customer.devices?.some(d => d.status === 'alert');


                                return (
                                    <tr
                                        key={customer.id}

                                        onClick={() => navigate(`/superadmin/customers/${customer.id}`)}

                                        className="group hover:bg-[rgba(255,255,255,0.2)] transition-colors cursor-pointer"
                                    >
                                        <td className="px-6 py-5">
                                            <div className="flex items-center gap-4">
                                                <div className="w-11 h-11 rounded-[12px] bg-[rgba(255,255,255,0.3)] flex items-center justify-center text-[#1F2937] opacity-80 border border-[rgba(255,255,255,0.4)] shadow-sm group-hover:scale-105 transition-transform">
                                                    <User size={20} className="opacity-70" />
                                                </div>
                                                <div>
                                                    <p className="font-[600] text-slate-800 text-[14px] group-hover:text-[#3A7AFE] transition-colors block">{customer.full_name || customer.display_name || 'Unnamed Client'}</p>
                                                    <p className="text-[11px] text-[#1F2937] opacity-50 font-mono tracking-tighter uppercase mt-0.5">{customer.email || 'No email provided'}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-5">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-[8px] bg-[rgba(255,255,255,0.3)] border border-[rgba(255,255,255,0.4)] flex items-center justify-center opacity-80 shadow-sm">
                                                    <MapPin size={14} className="text-[#1F2937]" />
                                                </div>
                                                <div>
                                                    <p className="text-[13px] font-[500] text-[#1F2937] opacity-90">{community?.name || 'Unassigned'}</p>
                                                    <p className="text-[10px] text-[#1F2937] opacity-50 font-mono uppercase tracking-widest">{community?.city || 'Zone Context'}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            {hasAlert ? (
                                                <span className="inline-flex items-center gap-[6px] px-2.5 py-1 rounded-[8px] bg-[rgba(239,68,68,0.1)] text-[#EF4444] text-[11px] font-[600] border border-[rgba(239,68,68,0.2)] shadow-sm">
                                                    <AlertCircle size={12} /> CRITICAL
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-[6px] px-2.5 py-1 rounded-[8px] bg-[rgba(22,163,74,0.1)] text-[#16A34A] text-[11px] font-[600] border border-[rgba(22,163,74,0.2)] shadow-sm">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-[#16A34A]" /> STABLE
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <div className="flex -space-x-2">
                                                    {(customer.devices || []).map((dev) => (
                                                        <div
                                                            key={dev.id}
                                                            className={`w-7 h-7 rounded-[8px] border border-[rgba(255,255,255,0.4)] shadow-sm flex items-center justify-center text-[10px] text-white font-[600] ${dev.analytics_template === 'EvaraTank' ? 'bg-[#3A7AFE]' :
                                                                dev.analytics_template === 'EvaraFlow' ? 'bg-[#06B6D4]' : 'bg-[#6366F1]'
                                                                }`}

                                                            title={dev.analytics_template || undefined}
                                                        >
                                                            {dev.analytics_template?.[5] || 'D'}
                                                        </div>
                                                    ))}
                                                </div>
                                                <span className="text-[12px] font-[500] text-[#1F2937] opacity-60 ml-1">
                                                    {customer.devices?.length || 0} Nodes
                                                </span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <ChevronRight size={18} className="text-[#1F2937] opacity-30 group-hover:text-[#3A7AFE] group-hover:opacity-100 transition-colors inline-block" />
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>

                    {regionCustomers.length === 0 && (
                        <div className="p-16 text-center">
                            <div className="w-16 h-16 bg-[rgba(255,255,255,0.3)] border border-[rgba(255,255,255,0.4)] shadow-sm rounded-[16px] flex items-center justify-center mx-auto mb-4">
                                <User size={32} className="text-[#1F2937] opacity-50" />
                            </div>
                            <h4 className="text-[18px] font-[600] text-[#1F2937]">No Customers Found</h4>
                            <p className="glass-secondary max-w-xs mx-auto mt-1">There are no customers registered in this zone's communities yet.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default RegionCustomers;
