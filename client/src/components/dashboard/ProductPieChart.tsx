import ReactECharts from 'echarts-for-react';
import { LayoutDashboard } from 'lucide-react';
import clsx from 'clsx';

interface ProductPieChartProps {
    tank: number;
    flow: number;
    deep: number;
    className?: string;
}

export const ProductPieChart = ({
    tank,
    flow,
    deep,
    className
}: ProductPieChartProps) => {
    const option = {
        tooltip: {
            trigger: 'item',
            backgroundColor: 'rgba(255, 255, 255, 0.9)',
            borderRadius: 12,
            padding: [10, 14],
            textStyle: {
                color: '#1F2937',
                fontSize: 12
            },
            borderWidth: 0,
            shadowBlur: 10,
            shadowColor: 'rgba(0,0,0,0.1)',
            formatter: '{b}: <b>{c}</b> ({d}%)'
        },
        legend: {
            show: false // Hidden as per "circle only" and "big"
        },
        series: [
            {
                name: 'Distribution',
                type: 'pie',
                radius: ['0%', '90%'], // Big circle
                center: ['50%', '50%'],
                avoidLabelOverlap: false,
                itemStyle: {
                    borderRadius: 10,
                    borderColor: 'rgba(255,255,255,0.4)',
                    borderWidth: 3
                },
                label: {
                    show: false
                },
                emphasis: {
                    scale: true,
                    scaleSize: 10,
                    itemStyle: {
                        shadowBlur: 20,
                        shadowOffsetX: 0,
                        shadowColor: 'rgba(0, 0, 0, 0.15)'
                    }
                },
                data: [
                    { value: tank, name: 'EvaraTank', itemStyle: { color: '#3A7AFE' } },
                    { value: flow, name: 'EvaraFlow', itemStyle: { color: '#0891B2' } },
                    { value: deep, name: 'EvaraDeep', itemStyle: { color: '#7C3AED' } }
                ],
                animationType: 'expansion',
                animationDuration: 1500,
                animationEasing: 'elasticOut'
            }
        ]
    };

    return (
        <div className={clsx("apple-glass-card p-[24px] rounded-[50px] flex flex-col h-full", className)}>
            <div className="flex justify-between items-center mb-3">
                <span className="text-[14px] font-[800] text-[#1f2937]/70 uppercase tracking-[0.1em] leading-none">Product Distribution</span>
                <LayoutDashboard size={18} className="text-gray-400/60" />
            </div>

            <div className="flex-1 flex flex-col items-center justify-center relative min-h-0">
                <div className="w-full max-w-[220px] aspect-square">
                    <ReactECharts
                        option={option}
                        style={{ height: '100%', width: '100%' }}
                        opts={{ renderer: 'svg' }}
                    />
                </div>
            </div>

            {/* Simple Legend */}
            <div className="flex flex-wrap justify-center gap-x-6 gap-y-2 mt-2">
                {[
                    { name: 'EvaraTank', color: '#3A7AFE' },
                    { name: 'EvaraFlow', color: '#0891B2' },
                    { name: 'EvaraDeep', color: '#7C3AED' }
                ].map((item) => (
                    <div key={item.name} className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                        <span className="text-[11px] font-[700] text-gray-500 uppercase tracking-tight">{item.name}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default ProductPieChart;
