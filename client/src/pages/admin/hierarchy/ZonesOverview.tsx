import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { adminService } from '../../../services/admin';
import { Modal } from '../../../components/ui/Modal';
import { AddZoneForm } from '../../../components/admin/forms/AddZoneForm';
import { MapPin, Users, Building, AlertTriangle, ArrowRight, Plus, Globe, Hash } from 'lucide-react';
import type { RegionRow } from '../../../types/database';


interface RegionStat {
    zone_id: string;
    region_name: string;
    state?: string;
    community_count: number;
    customer_count: number;
    device_count: number;
    online_devices: number;
    offline_devices: number;
}

const RegionsOverview = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [zones, setRegions] = useState<RegionRow[]>([]);
    const [stats, setStats] = useState<RegionStat[]>([]);
    const [loading, setLoading] = useState(true);
    const [showCreateModal, setShowCreateModal] = useState(false);

    const fetchData = async () => {
        console.log('[DEBUG] fetchData Triggered. User:', user?.id);
        try {
            const [regionsData, statsData] = await Promise.all([
                adminService.getRegions(),
                adminService.getRegionStats().catch(err => {
                    console.error('[DEBUG] getRegionStats failed:', err);
                    return [];
                }),
            ]);

            console.log('[DEBUG] Fetch Results:', {
                regionsCount: regionsData?.length,
                statsCount: statsData?.length,
                zones: regionsData
            });

            setRegions(regionsData as RegionRow[]);
            setStats(statsData as RegionStat[]);
        } catch (error) {
            console.error('[DEBUG] Global Fetch Error:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (user) {
            console.log('[DEBUG] User confirmed, fetching data...', { role: user.role, email: user.email });
            fetchData();
        } else {
            console.log('[DEBUG] Waiting for user session...');
        }
    }, [user]);

    const getStatsForRegion = (regionId: string) => {
        const s = stats.find(st => st.zone_id === regionId);
        return {
            communities: s?.community_count || 0,
            customers: s?.customer_count || 0,
            devices: s?.device_count || 0,
            online: s?.online_devices || 0,
            offline: s?.offline_devices || 0,
        };
    };

    const handleRegionCreated = () => {
        setShowCreateModal(false);
        setLoading(true);
        fetchData();
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            </div>
        );
    }

    return (
        <div className="glass-dashboard min-h-screen p-8">
            {/* Header */}
            <div className="flex items-center justify-between mb-[32px]">
                <div>
                    <h2 className="text-[28px] font-[600] tracking-[-0.5px] text-[#1F2937] leading-tight">Operational Zones</h2>
                    <p className="glass-secondary mt-1">
                        {zones.length} zone{zones.length !== 1 ? 's' : ''} configured across the network.
                    </p>
                </div>
                {user?.role === 'superadmin' && (
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="flex items-center gap-[8px] px-5 py-[12px] bg-[#1F2937] text-white text-[13px] font-[600] rounded-[12px] hover:bg-[#111827] shadow-[0_8px_16px_rgba(31,41,55,0.2)] transition-all transform hover:-translate-y-[1px]"
                    >
                        <Plus size={16} />
                        Create New Zone
                    </button>
                )}
            </div>

            {/* Zone Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 stagger-children">
                {zones.map((zone) => {
                    const rs = getStatsForRegion(zone.id);
                    const healthPercent = rs.devices > 0
                        ? Math.round((rs.online / rs.devices) * 100)
                        : 100;

                    return (
                        <div
                            key={zone.id}
                            onClick={() => navigate(`/superadmin/zones/${zone.id}`)}
                            className="apple-glass-card group cursor-pointer"
                        >
                            <div className="apple-glass-content relative flex flex-col h-full">
                                {/* Background Icon */}
                                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity pointer-events-none">
                                    <MapPin size={80} className="text-[#3A7AFE]" />
                                </div>

                                {/* Header */}
                                <div className="flex items-start justify-between gap-3 mb-5">
                                    <div className="flex items-center gap-[12px]">
                                        <div className="w-[48px] h-[48px] rounded-[16px] bg-[rgba(255,255,255,0.3)] border border-[rgba(255,255,255,0.4)] flex items-center justify-center text-[#1F2937] opacity-80 font-[700] text-[15px] shadow-sm group-hover:scale-105 transition-transform duration-300">
                                            {(zone.name || '').split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase()}
                                        </div>
                                        <div>
                                            <h3 className="text-[16px] font-[600] text-[#1F2937] group-hover:text-[#3A7AFE] transition-colors">{zone.name}</h3>
                                            {zone.state && (
                                                <p className="text-[12px] text-[#1F2937] opacity-60 flex items-center gap-[4px] mt-1 font-[500]">
                                                    <Globe size={11} className="opacity-70" /> {zone.state}, {zone.country || 'India'}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                    {zone.zone_code && (
                                        <span className="px-[8px] py-[4px] bg-[rgba(255,255,255,0.4)] border border-[rgba(255,255,255,0.5)] text-[#1F2937] text-[10px] font-[700] rounded-[6px] uppercase shadow-sm">
                                            {zone.zone_code}
                                        </span>
                                    )}
                                </div>

                                {/* Description */}
                                {zone.description && (
                                    <p className="text-[13px] text-[#1F2937] opacity-70 mb-[20px] line-clamp-2 leading-relaxed">{zone.description}</p>
                                )}

                                {/* Stats */}
                                <div className="apple-glass-inner p-[16px] space-y-[12px] relative z-10 mb-[20px] flex-1">
                                    <div className="flex items-center justify-between text-[13px]">
                                        <span className="flex items-center gap-[8px] text-[#1F2937] opacity-70 font-[500]">
                                            <Building size={14} className="opacity-50" /> Communities
                                        </span>
                                        <span className="font-[600] text-[#1F2937]">{rs.communities}</span>
                                    </div>
                                    <div className="flex items-center justify-between text-[13px]">
                                        <span className="flex items-center gap-[8px] text-[#1F2937] opacity-70 font-[500]">
                                            <Users size={14} className="opacity-50" /> Customers
                                        </span>
                                        <span className="font-[600] text-[#1F2937]">{rs.customers}</span>
                                    </div>
                                    <div className="flex items-center justify-between text-[13px]">
                                        <span className="flex items-center gap-[8px] text-[#1F2937] opacity-70 font-[500]">
                                            <Hash size={14} className="opacity-50" /> Devices
                                        </span>
                                        <span className="font-[600] text-[#1F2937] flex items-center gap-[6px]">
                                            {rs.devices}
                                            {rs.devices > 0 && (
                                                <span className="text-[10px] font-[700] text-[#1F2937] opacity-60 bg-[rgba(255,255,255,0.4)] px-[6px] py-[2px] rounded-[4px] border border-[rgba(255,255,255,0.5)]">
                                                    {rs.online}↑ {rs.offline}↓
                                                </span>
                                            )}
                                        </span>
                                    </div>
                                </div>

                                {/* Health Bar */}
                                <div className="mt-auto">
                                    <div className="w-full h-[6px] bg-[rgba(255,255,255,0.3)] rounded-full overflow-hidden shadow-inner mb-[16px]">
                                        <div
                                            className={`h-full rounded-full transition-all ${healthPercent >= 80 ? 'bg-[#16A34A]' :
                                                healthPercent >= 50 ? 'bg-[#F59E0B]' : 'bg-[#EF4444]'
                                                }`}
                                            style={{ width: `${healthPercent}%` }}
                                        />
                                    </div>

                                    {/* Status Badge */}
                                    <div className="flex items-center justify-between border-t border-[rgba(255,255,255,0.1)] pt-[16px]">
                                        {rs.offline > 0 ? (
                                            <div className="flex items-center gap-[6px] text-[12px] font-[600] text-[#EF4444] bg-[rgba(239,68,68,0.1)] px-[12px] py-[6px] rounded-[8px] border border-[rgba(239,68,68,0.2)]">
                                                <AlertTriangle size={14} />
                                                {rs.offline} Offline
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-[6px] text-[12px] font-[600] text-[#16A34A] bg-[rgba(22,163,74,0.1)] px-[12px] py-[6px] rounded-[8px] border border-[rgba(22,163,74,0.2)]">
                                                <div className="w-[6px] h-[6px] rounded-full bg-[#16A34A]" />
                                                All Systems OK
                                            </div>
                                        )}

                                        <div className="flex items-center gap-[4px] text-[11px] font-[700] text-[#3A7AFE] uppercase tracking-wider opacity-80 group-hover:opacity-100 transition-opacity">
                                            <span>Enter</span>
                                            <ArrowRight size={14} className="transform group-hover:translate-x-1 transition-transform" />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}

                {/* Empty State */}
                {zones.length === 0 && (
                    <div className="col-span-full py-[100px] text-center bg-transparent">
                        <div className="bg-white/30 backdrop-blur-xl rounded-[32px] border border-white/40 p-12 max-w-lg mx-auto shadow-sm">
                            <MapPin className="mx-auto text-[#1F2937] opacity-20 mb-6" size={56} />
                            <h3 className="text-[20px] font-[600] text-[#1F2937] mb-2">No operational zones found.</h3>
                            <p className="text-[14px] text-[#4B5563] mb-8 font-[500]">Deploy and configure geographic zones to start managing your network infrastructure.</p>
                            {user?.role === 'superadmin' && (
                                <button
                                    onClick={() => setShowCreateModal(true)}
                                    className="px-8 py-[14px] bg-[#1F2937] text-white text-[14px] font-[600] rounded-[16px] hover:bg-[#111827] shadow-[0_8px_16px_rgba(31,41,55,0.15)] transition-all transform hover:-translate-y-[1px]"
                                >
                                    Create First Zone
                                </button>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Create Zone Modal */}
            <Modal
                isOpen={showCreateModal}
                onClose={() => setShowCreateModal(false)}
                title="Create New Zone / Zone"
            >
                <AddZoneForm
                    onSubmit={handleRegionCreated}
                    onCancel={() => setShowCreateModal(false)}
                />
            </Modal>
        </div>
    );
};

export default RegionsOverview;
