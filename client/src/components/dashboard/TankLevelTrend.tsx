import ReactECharts from 'echarts-for-react';

interface Props {
    data: { time: string; level: number }[];
}

const TankLevelTrend = ({ data }: Props) => {
    const option = {
        tooltip: { trigger: 'axis' },
        grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
        xAxis: {
            type: 'category',
            boundaryGap: false,
            data: data.map(d => d.time)
        },
        yAxis: { type: 'value', max: 100 },
        series: [
            {
                name: 'Water Level',
                type: 'line',
                smooth: true,
                areaStyle: {
                    color: {
                        type: 'linear',
                        x: 0, y: 0, x2: 0, y2: 1,
                        colorStops: [
                            { offset: 0, color: '#3B82F6' },
                            { offset: 1, color: 'rgba(59, 130, 246, 0.1)' }
                        ]
                    }
                },
                itemStyle: { color: '#3B82F6' },
                data: data.map(d => d.level)
            }
        ]
    };

    return <ReactECharts option={option} style={{ height: '300px', width: '100%' }} />;
};

export default TankLevelTrend;
