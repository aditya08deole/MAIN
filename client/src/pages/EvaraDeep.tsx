import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import NodeNotConfigured from '../components/NodeNotConfigured';
import { deviceService } from '../services/DeviceService';
import { useTelemetry } from '../hooks/useTelemetry';
import ReactECharts from 'echarts-for-react';
import './EvaraDeep.css';

interface EvaraDeepProps {
    embedded?: boolean;
    nodeId?: string;
}

const EvaraDeep = ({ embedded = false, nodeId: nodeIdProp }: EvaraDeepProps) => {
    const { id: routeId } = useParams<{ id: string }>();
    const nodeId = nodeIdProp || routeId;
    const [config, setConfig] = useState<any>(null);
    const { data: telemetry, loading: telLoading } = useTelemetry(nodeId);

    useEffect(() => {
        if (!nodeId) return;
        deviceService.getDeviceDetails(nodeId).then(setConfig).catch(console.error);
    }, [nodeId]);

    if (!config && !telLoading) return <NodeNotConfigured analyticsType="EvaraDeep" />;

    const waterLevel = typeof telemetry?.values?.level === 'number' ? telemetry.values.level : 0;
    const current = telemetry?.values?.current as number || 0;
    const voltage = telemetry?.values?.voltage as number || 0;
    const depth = 145 - (waterLevel / 100) * 10; // Simple inverse mapping for visualization

    const radarOption = {
        radar: {
            indicator: [
                { name: 'Monsoon', max: 100 },
                { name: 'Winter', max: 100 },
                { name: 'Summer', max: 100 },
                { name: 'Pre-Mon', max: 100 }
            ],
            shape: 'circle'
        },
        series: [{
            type: 'radar',
            data: [{ value: [90, 70, 40, 55], name: 'Seasonal Level' }],
            areaStyle: { color: 'rgba(56, 189, 248, 0.4)' },
            lineStyle: { color: '#38BDF8' }
        }]
    };

    const lineOption = {
        tooltip: { trigger: 'axis' },
        xAxis: { type: 'category', data: ['Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov'] },
        yAxis: { type: 'value' },
        series: [{
            data: [160, 155, 140, 138, 142, waterLevel],
            type: 'line',
            smooth: true,
            areaStyle: { color: 'rgba(15, 23, 42, 0.1)' },
            itemStyle: { color: '#0F172A' }
        }]
    };

    return (
        <div className={`glass-dashboard w-full px-[32px] md:px-[40px] pt-[110px] pb-8 min-h-screen${embedded ? ' ed-embedded' : ''}`}>
            {/* SVG Noise Overlay */}
            {!embedded && <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }}></div>}

            <div className="max-w-[1440px] w-full mx-auto relative z-10 flex flex-col gap-[24px]">
                <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-[32px]">
                    <div>
                        <h1 className="text-[36px] font-[600] tracking-[-0.5px] text-[#1F2937] leading-tight">{config?.name || 'Borewell'} — Source Analysis</h1>
                        <p className="text-[14px] text-gray-500 mt-1">Heartbeat: {waterLevel.toFixed(1)}m | Blueprint: {config?.id}</p>
                    </div>
                </header>

                <div className="grid grid-cols-12 gap-[24px]">
                    <div className="apple-glass-card col-span-12 xl:col-span-6 p-[24px] flex flex-col justify-between h-[150px]">
                        <div className="apple-glass-content h-full flex flex-col justify-between">
                            <div className="glass-title">Current Depth</div>
                            <div className="glass-number text-[#16A34A]">{depth.toFixed(1)}m</div>
                            <div className="glass-secondary">Stable source</div>
                        </div>
                    </div>

                    <div className="apple-glass-card col-span-12 xl:col-span-6 p-[24px] flex flex-col justify-between h-[150px]">
                        <div className="apple-glass-content h-full flex flex-col justify-between">
                            <div className="glass-title">Current / Voltage</div>
                            <div className="flex gap-2 items-center mt-1">
                                <span className="glass-number !text-[28px]">{current} A</span>
                                <span className="text-[#1F2937] opacity-30 text-2xl font-light">|</span>
                                <span className="glass-number !text-[28px]">{voltage} V</span>
                            </div>
                        </div>
                    </div>

                    <div className="apple-glass-card col-span-12 p-[24px]">
                        <div className="apple-glass-content">
                            <div className="glass-title mb-4">Sustainability Trend</div>
                            <ReactECharts option={lineOption} style={{ height: '250px' }} />
                        </div>
                    </div>

                    <div className="apple-glass-card col-span-12 p-[24px]">
                        <div className="apple-glass-content">
                            <div className="glass-title mb-4">Seasonal metrics</div>
                            <ReactECharts option={radarOption} style={{ height: '250px' }} />
                        </div>
                    </div>

                    <div className="apple-glass-card col-span-12 p-[24px]">
                        <div className="apple-glass-content">
                            <div className="glass-title mb-4">Sustainability report</div>
                            <div className="grid grid-cols-2 gap-[16px]">
                                <div className="apple-glass-inner p-[16px] flex flex-col items-center justify-center">
                                    <span className="text-3xl">🌱</span>
                                    <span className="text-[11px] font-[600] mt-2 text-[#1F2937] opacity-80 uppercase">Healthy Source</span>
                                </div>
                                <div className="apple-glass-inner p-[16px] flex flex-col items-center justify-center">
                                    <span className="text-3xl">🛡️</span>
                                    <span className="text-[11px] font-[600] mt-2 text-[#1F2937] opacity-80 uppercase">Secure Supply</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default EvaraDeep;
