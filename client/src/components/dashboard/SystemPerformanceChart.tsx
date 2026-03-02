import ReactECharts from 'echarts-for-react';
import { useTelemetry } from '../../hooks/useTelemetry';

interface Props {
    nodeId?: string;
    title?: string;
}

const SystemPerformanceChart: React.FC<Props> = ({ nodeId, title = "System Performance" }) => {
    const { data: telemetry, loading } = useTelemetry(nodeId);

    if (loading) return <div className="h-[300px] w-full apple-glass-inner animate-pulse rounded-2xl" />;

    const option = {
        title: {
            text: title,
            textStyle: { fontWeight: 'bold', fontSize: 16 }
        },
        tooltip: {
            trigger: 'axis',
            axisPointer: { type: 'cross', label: { backgroundColor: '#6a7985' } }
        },
        grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
        xAxis: [
            {
                type: 'category',
                boundaryGap: false,
                data: telemetry?.timestamp ? [new Date(telemetry.timestamp).toLocaleTimeString()] : ['Waiting...']
            }
        ],
        yAxis: [
            {
                type: 'value'
            }
        ],
        series: Object.entries(telemetry?.values || {}).map(([key, value]) => ({
            name: key,
            type: 'line',
            stack: 'Total',
            areaStyle: {},
            emphasis: { focus: 'series' },
            data: [value]
        }))
    };

    return (
        <div className="apple-glass-card p-6 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
            <ReactECharts option={option} style={{ height: '300px', width: '100%' }} />
        </div>
    );
};

export default SystemPerformanceChart;
