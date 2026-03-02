/**
 * StatusOverlayPanel — the "Infrastructure Status" side panel on the Home map.
 * Extracted from Home.tsx to reduce component size.
 */
import clsx from 'clsx';
import { Activity } from 'lucide-react';
import { isOnline } from '../../utils/mapIcons';
import type { MapDevice } from '../../hooks/useMapDevices';

interface AssetCategory {
    name: string;
    devices: MapDevice[];
    color: string;
    bg: string;
}

interface Props {
    visible: boolean;
    devices: MapDevice[];
    categories: AssetCategory[];
}

export const StatusOverlayPanel = ({ visible, devices, categories }: Props) => {
    const onlineCount = devices.filter(d => isOnline(d.status)).length;
    const offlineCount = devices.length - onlineCount;

    return (
        <div className={clsx(
            "absolute top-[260px] lg:top-[290px] right-4 z-[400] apple-glass-card/95 backdrop-blur-md rounded-2xl shadow-2xl border border-slate-200 w-80 transition-all duration-300 origin-top-right overflow-hidden",
            visible ? "opacity-100 scale-100 max-h-[600px]" : "opacity-0 scale-95 max-h-0 pointer-events-none"
        )}>
            <div className="p-5">
                <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
                    <Activity size={16} className="text-[var(--color-evara-blue)]" /> Infrastructure Status
                </h3>

                {/* Summary Stats */}
                <div className="grid grid-cols-3 gap-2 mb-4">
                    <div className="bg-green-50 rounded-lg p-2.5 text-center">
                        <div className="text-lg font-extrabold text-green-600">{onlineCount}</div>
                        <div className="text-[10px] font-semibold text-green-700">Online</div>
                    </div>
                    <div className="bg-red-50 rounded-lg p-2.5 text-center">
                        <div className="text-lg font-extrabold text-red-600">{offlineCount}</div>
                        <div className="text-[10px] font-semibold text-red-700">Offline</div>
                    </div>
                    <div className="bg-blue-50 rounded-lg p-2.5 text-center">
                        <div className="text-lg font-extrabold text-blue-600">{devices.length}</div>
                        <div className="text-[10px] font-semibold text-blue-700">Total</div>
                    </div>
                </div>

                {/* Asset Breakdown */}
                <div className="space-y-3">
                    {categories.map((asset, i) => {
                        const working = asset.devices.filter(d => isOnline(d.status)).length;
                        const total = asset.devices.length;
                        return (
                            <div key={i} className={clsx("rounded-xl p-3", asset.bg)}>
                                <div className="flex justify-between items-center mb-1.5">
                                    <span className="text-xs font-bold text-slate-700">{asset.name}</span>
                                    <span className="text-xs font-bold" style={{ color: asset.color }}>{working}/{total}</span>
                                </div>
                                <div className="w-full h-2 apple-glass-card rounded-full overflow-hidden">
                                    <div className="h-full rounded-full transition-all" style={{ width: `${total > 0 ? (working / total) * 100 : 0}%`, background: asset.color }} />
                                </div>
                                <div className="flex justify-between mt-1">
                                    <span className="text-[10px] text-green-600 font-semibold">{working} active</span>
                                    <span className="text-[10px] text-red-500 font-semibold">{total - working} down</span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

export default StatusOverlayPanel;
