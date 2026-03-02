import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import NodeNotConfigured from '../components/NodeNotConfigured';
import { deviceService } from '../services/DeviceService';
import { useTelemetry } from '../hooks/useTelemetry';
import ReactECharts from 'echarts-for-react';
import './EvaraFlow.css';

interface EvaraFlowProps {
    embedded?: boolean;
    nodeId?: string;
}

const EvaraFlow = ({ embedded = false, nodeId: nodeIdProp }: EvaraFlowProps) => {
    const { id: routeId } = useParams<{ id: string }>();
    const nodeId = nodeIdProp || routeId;
    const [config, setConfig] = useState<any>(null);
    const { data: telemetry, loading: telLoading } = useTelemetry(nodeId);

    useEffect(() => {
        if (!nodeId) return;
        deviceService.getDeviceDetails(nodeId).then(setConfig).catch(console.error);
    }, [nodeId]);

    if (!config && !telLoading) return <NodeNotConfigured analyticsType="EvaraFlow" />;

    const flowRate = telemetry?.values?.flow_rate as number || 0;
    const totalFlow = telemetry?.values?.total_flow as number || 0;

    const chartOption = {
        tooltip: { trigger: 'axis' },
        grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
        xAxis: { type: 'category', boundaryGap: false, data: ['12pm', '1pm', '2pm', '3pm', '4pm', 'now'] },
        yAxis: { type: 'value' },
        series: [{
            name: 'Flow Rate',
            type: 'line',
            smooth: true,
            areaStyle: { color: 'rgba(14, 165, 233, 0.2)' },
            itemStyle: { color: '#0EA5E9' },
            data: [12, 15, 11, 14, 13, flowRate]
        }]
    };

    return (
        <div className={`glass-dashboard w-full px-[32px] md:px-[40px] pt-[110px] pb-8 min-h-screen${embedded ? ' ef-embedded' : ''}`}>
            {/* SVG Noise Overlay */}
            {!embedded && <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }}></div>}

            <div className="max-w-[1440px] w-full mx-auto relative z-10 flex flex-col gap-[24px]">
                <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-[32px]">
                    <div>
                        <h1 className="text-[36px] font-[600] tracking-[-0.5px] text-[#1F2937] leading-tight">{config?.name || 'Flow'} Analytics</h1>
                        <p className="text-[14px] text-gray-500 mt-1">Heartbeat: {flowRate.toFixed(1)} L/Min | Blueprint: {config?.id}</p>
                    </div>
                </header>

                <div className="grid grid-cols-12 gap-[24px]">
                    <div className="apple-glass-card col-span-12 xl:col-span-6 p-[24px] flex flex-col justify-between h-[150px]">
                        <div className="apple-glass-content h-full flex flex-col justify-between">
                            <div className="glass-title">Instant Flow</div>
                            <div className="glass-number text-[#0EA5E9]">{flowRate.toFixed(1)}</div>
                            <div className="glass-secondary">Liters/Minute</div>
                        </div>
                    </div>

                    <div className="apple-glass-card col-span-12 xl:col-span-6 p-[24px] flex flex-col justify-between h-[150px]">
                        <div className="apple-glass-content h-full flex flex-col justify-between">
                            <div className="glass-title">Daily Total</div>
                            <div className="glass-number">{totalFlow.toLocaleString()}</div>
                            <div className="glass-secondary">Liters today</div>
                        </div>
                    </div>

                    <div className="apple-glass-card col-span-12 p-[24px]">
                        <div className="apple-glass-content">
                            <div className="glass-title mb-4">Consumption trend</div>
                            <ReactECharts option={chartOption} style={{ height: '300px' }} />
                        </div>
                    </div>

                    <div className="apple-glass-card col-span-12 p-[24px]">
                        <div className="apple-glass-content">
                            <div className="glass-title mb-4">System Integrity</div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-[16px]">
                                <div className="apple-glass-inner p-[16px] flex justify-between items-center">
                                    <span className="text-[13px] font-medium text-[#1F2937] opacity-80">Leak Detection</span>
                                    <span className="px-[8px] py-[4px] rounded-[10px] text-[11px] font-[600] bg-[rgba(22,163,74,0.1)] border border-[rgba(22,163,74,0.2)] text-[#16A34A] shadow-sm uppercase">Secure</span>
                                </div>
                                <div className="apple-glass-inner p-[16px] flex justify-between items-center">
                                    <span className="text-[13px] font-medium text-[#1F2937] opacity-80">Spike Alert</span>
                                    <span className="px-[8px] py-[4px] rounded-[10px] text-[11px] font-[600] bg-[rgba(255,255,255,0.4)] border border-[rgba(255,255,255,0.5)] shadow-sm uppercase">None</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default EvaraFlow;
