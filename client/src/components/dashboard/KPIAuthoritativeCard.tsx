import { Shield } from 'lucide-react';
import clsx from 'clsx';

interface KPIAuthoritativeCardProps {
    total: number;
    online: number;
    offline: number;
    health?: number;
    className?: string;
}

export const KPIAuthoritativeCard = ({
    total,
    online,
    offline,
    className
}: KPIAuthoritativeCardProps) => {
    const onlinePadding = total > 0 ? (online / total) * 100 : 0;
    const healthPercent = total > 0 ? Math.round((online / total) * 100) : 0;

    return (
        <div className={clsx("apple-glass-card p-[20px] rounded-[50px] flex flex-col justify-between h-full", className)}>
            <div>
                <div className="flex justify-between items-start mb-2">
                    <span className="text-[14px] font-[800] text-[#1f2937]/70 uppercase tracking-[0.1em]">Total Devices</span>
                    <div className="w-8 h-8 rounded-full bg-blue-50/50 flex items-center justify-center border border-blue-100/20">
                        <Shield size={16} className="text-blue-500" />
                    </div>
                </div>
                <h2 className="text-[36px] font-[700] text-[#1F2937] leading-none tracking-tight mb-2">{total.toLocaleString()}</h2>
            </div>

            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <div className="flex-1 flex flex-col gap-1 items-start">
                        <div className="flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-[#16A34A] shadow-[0_0_10px_rgba(22,163,74,0.4)]" />
                            <span className="text-[14px] font-[700] text-gray-700">{online}</span>
                        </div>
                        <span className="text-[10px] text-gray-400 font-bold uppercase tracking-tighter">Online Devices</span>
                    </div>

                    <div className="h-8 w-[1px] bg-gray-200/50 mx-4" />

                    <div className="flex-1 flex flex-col gap-1 items-end">
                        <div className="flex items-center gap-2">
                            <span className="text-[14px] font-[700] text-gray-700">{offline}</span>
                            <span className="w-2.5 h-2.5 rounded-full bg-[#E5484D] shadow-[0_0_10px_rgba(229,72,77,0.4)]" />
                        </div>
                        <span className="text-[10px] text-gray-400 font-bold uppercase tracking-tighter text-right">Offline Devices</span>
                    </div>
                </div>

                <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-[800] text-[#1F2937] uppercase tracking-wider">{healthPercent}% <span className="text-gray-400 ml-1">System Health</span></span>
                </div>

                {/* Segmented Health Bar */}
                <div className="h-[8px] w-full rounded-full bg-gray-100/50 overflow-hidden flex">
                    <div
                        className="h-full transition-all duration-1000 ease-out bg-[#16A34A]"
                        style={{ width: `${onlinePadding}%` }}
                    />
                    <div
                        className="h-full transition-all duration-1000 ease-out bg-[#E5484D]"
                        style={{ width: `${100 - onlinePadding}%` }}
                    />
                </div>
            </div>
        </div>
    );
};

export default KPIAuthoritativeCard;
