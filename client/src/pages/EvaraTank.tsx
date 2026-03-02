import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import NodeNotConfigured from '../components/NodeNotConfigured';
import { deviceService } from '../services/DeviceService';
import { useTelemetry } from '../hooks/useTelemetry';

import TankLevelTrend from '../components/dashboard/TankLevelTrend';
import './EvaraTank.css';

interface EvaraTankProps {
    embedded?: boolean;
    nodeId?: string;
}

const EvaraTank = ({ embedded = false, nodeId: nodeIdProp }: EvaraTankProps) => {
    const { id: routeId } = useParams<{ id: string }>();
    const nodeId = nodeIdProp || routeId;
    const [config, setConfig] = useState<any>(null);
    const { data: telemetry, loading: telLoading } = useTelemetry(nodeId);

    useEffect(() => {
        if (!nodeId) return;
        deviceService.getDeviceDetails(nodeId).then(setConfig).catch(console.error);
    }, [nodeId]);

    if (!config && !telLoading) return <NodeNotConfigured analyticsType="EvaraTank" />;

    const battery = telemetry?.values?.battery as number || 0;
    const signal = telemetry?.values?.signal_strength as number || 0;
    const percentValue = typeof telemetry?.values?.level === 'number'
        ? telemetry.values.level
        : parseFloat(telemetry?.values?.level as any || '0');

    const percent = isNaN(percentValue) ? 0 : percentValue;
    const volume = (percent / 100) * 500; // Assuming 500L max
    const history = [
        { time: '12:00', level: 45 },
        { time: '13:00', level: 52 },
        { time: '14:00', level: 48 },
        { time: '15:00', level: 60 },
        { time: '16:00', level: percent }
    ];

    return (
        <div className={`glass-dashboard w-full px-[32px] md:px-[40px] pt-[110px] pb-8 min-h-screen${embedded ? ' et-embedded' : ''}`}>
            {/* SVG Noise Overlay */}
            {!embedded && <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }}></div>}

            <div className="max-w-[1440px] w-full mx-auto relative z-10 flex flex-col gap-[24px]">
                <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-[32px]">
                    <div>
                        <h1 className="text-[36px] font-[600] tracking-[-0.5px] text-[#1F2937] leading-tight">{config?.name || 'Tank'} — Digital Twin</h1>
                        <p className="text-[14px] text-gray-500 mt-1">Blueprint: {config?.id} | Heartbeat: Operational</p>
                    </div>
                </header>

                <div className="grid grid-cols-12 gap-[24px]">
                    <div className="apple-glass-card col-span-12 xl:col-span-8 p-[24px]">
                        <div className="apple-glass-content h-full">
                            <div className="w-full h-full min-h-[300px] flex items-end justify-center bg-sky-50 rounded-2xl overflow-hidden relative border border-sky-100/50">
                                <div className="absolute bottom-0 w-full bg-gradient-to-t from-blue-600 to-sky-400 opacity-80 transition-all duration-1000 ease-[cubic-bezier(0.4,0,0.2,1)]" style={{ height: `${percent}%` }}></div>
                                <div className="absolute inset-0 flex items-center justify-center font-black text-5xl text-slate-800 tracking-tighter drop-shadow-xl z-20">
                                    {percent.toFixed(1)}%
                                </div>
                                {/* Optional subtle grid or lines */}
                                <div className="absolute inset-x-0 bottom-1/4 h-[1px] bg-sky-900/10 border-t border-dashed z-10"></div>
                                <div className="absolute inset-x-0 bottom-2/4 h-[1px] bg-sky-900/10 border-t border-dashed z-10"></div>
                                <div className="absolute inset-x-0 bottom-3/4 h-[1px] bg-sky-900/10 border-t border-dashed z-10"></div>
                            </div>
                        </div>
                    </div>

                    <div className="col-span-12 xl:col-span-4 flex flex-col gap-[24px]">
                        <div className="apple-glass-card p-[24px] flex flex-col justify-between h-[150px]">
                            <div className="apple-glass-content h-full flex flex-col justify-between">
                                <div className="glass-title">Volume</div>
                                <div className="glass-number text-[#16A34A]">{volume.toFixed(1)} L</div>
                                <div className="glass-secondary">500L Capacity</div>
                            </div>
                        </div>

                        <div className="apple-glass-card p-[24px] flex flex-col justify-between h-[150px]">
                            <div className="apple-glass-content h-full flex flex-col justify-between">
                                <div className="glass-title">Status</div>
                                <div className={`glass-number ${percent < 20 ? 'text-[#EF4444]' : 'text-[#3A7AFE]'}`}>
                                    {percent < 20 ? 'Crit Low' : 'Normal'}
                                </div>
                                <div className="glass-secondary">Real-time Check</div>
                            </div>
                        </div>

                        <div className="apple-glass-card p-[24px] flex flex-col justify-between h-[150px]">
                            <div className="apple-glass-content h-full flex flex-col justify-between">
                                <div className="glass-title">Battery / Signal</div>
                                <div className="flex gap-2 items-center mt-1">
                                    <span className="glass-number !text-[28px]">{battery}%</span>
                                    <span className="text-[#1F2937] opacity-30 text-2xl font-light">|</span>
                                    <span className="glass-number !text-[28px]">{signal} dBm</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="apple-glass-card col-span-12 xl:col-span-9 p-[24px]">
                        <div className="apple-glass-content">
                            <div className="glass-title mb-4">Live Performance Trend</div>
                            <TankLevelTrend data={history} />
                        </div>
                    </div>

                    <div className="apple-glass-card col-span-12 xl:col-span-3 p-[24px]">
                        <div className="apple-glass-content h-full flex flex-col">
                            <div className="glass-title mb-4">Alert History</div>
                            <div className="space-y-[12px]">
                                {percent < 20 && (
                                    <div className="apple-glass-inner p-[12px] bg-[rgba(239,68,68,0.1)] border border-[rgba(239,68,68,0.2)]">
                                        <span className="text-[#EF4444] text-[12px] font-[600]">Low Water Alert - Just Now</span>
                                    </div>
                                )}
                                <div className="apple-glass-inner p-[12px]">
                                    <span className="text-[12px] font-[500] text-[#1F2937] opacity-80">System Check - OK</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default EvaraTank;
