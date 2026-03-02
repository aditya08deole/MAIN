import { AlertTriangle, Clock } from 'lucide-react';
import clsx from 'clsx';

interface AlertEvent {
    id: string;
    device_id: string;
    event_type: string;
    timestamp: string;
    severity: 'critical' | 'warning' | 'info';
}

interface AlertsActivityPanelProps {
    total: number;
    critical: number;
    warning: number;
    recentAlerts?: AlertEvent[];
    className?: string;
}

export const AlertsActivityPanel = ({
    total,
    critical,
    warning,
    recentAlerts = [],
    className
}: AlertsActivityPanelProps) => {
    return (
        <div className={clsx("apple-glass-card p-[20px] rounded-[50px] h-full flex flex-col", className)}>
            <div className="flex justify-between items-start mb-1">
                <span className="text-[14px] font-[800] text-[#1f2937]/70 uppercase tracking-[0.1em]">Alerts & Activity</span>
                <AlertTriangle size={16} className={clsx(total > 0 ? "text-red-500" : "text-gray-400")} />
            </div>

            <div className="flex items-center gap-6 mb-2">
                <div className="flex flex-col">
                    <h2 className={clsx("text-[36px] font-[700] leading-none tracking-tight", total > 0 ? "text-[#E5484D]" : "text-[#1F2937]")}>{total}</h2>
                    <span className="text-[11px] font-medium text-gray-400 uppercase tracking-widest mt-1">Active</span>
                </div>
                <div className="h-10 w-[1px] bg-gray-200/50" />
                <div className="space-y-1">
                    <div className="flex items-center gap-2">
                        <span className="text-[14px] font-bold text-[#E5484D]">{critical}</span>
                        <span className="text-[12px] text-gray-500 font-medium">Critical</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-[14px] font-bold text-[#F59E0B]">{warning}</span>
                        <span className="text-[12px] text-gray-500 font-medium">Warning</span>
                    </div>
                </div>
            </div>

            <div className="mt-auto space-y-2">
                {recentAlerts.length > 0 ? recentAlerts.slice(0, 3).map((alert) => (
                    <div key={alert.id} className="flex items-center justify-between p-2 rounded-2xl bg-white/30 border border-white/20 shadow-sm backdrop-blur-sm">
                        <div className="flex flex-col">
                            <span className="text-[11px] font-bold text-gray-700">{alert.device_id}</span>
                            <span className="text-[10px] text-gray-400">{alert.event_type}</span>
                        </div>
                        <div className="flex flex-col items-end">
                            <span className={clsx(
                                "px-1.5 py-0.5 rounded-lg text-[9px] font-bold uppercase tracking-tighter",
                                alert.severity === 'critical' ? "bg-red-50 text-red-500 border border-red-100" :
                                    alert.severity === 'warning' ? "bg-amber-50 text-amber-600 border border-amber-100" :
                                        "bg-blue-50 text-blue-500 border border-blue-100"
                            )}>
                                {alert.severity}
                            </span>
                            <span className="text-[9px] text-gray-400 mt-1 flex items-center gap-1">
                                <Clock size={8} /> {alert.timestamp}
                            </span>
                        </div>
                    </div>
                )) : (
                    <div className="text-center py-4">
                        <span className="text-[12px] text-gray-400 italic">No urgent activity reported</span>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AlertsActivityPanel;
