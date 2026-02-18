import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Chart from 'chart.js/auto';
import NodeNotConfigured from '../components/NodeNotConfigured';
import { STATIC_NODES } from '../data/staticData';
import './EvaraTank.css';

interface EvaraTankProps {
    embedded?: boolean;
    nodeId?: string;
}

const EvaraTank = ({ embedded = false, nodeId }: EvaraTankProps) => {
    // Chart Refs
    const levelChartRef = useRef<HTMLCanvasElement>(null);
    const usageChartRef = useRef<HTMLCanvasElement>(null);
    const refillChartRef = useRef<HTMLCanvasElement>(null);

    // Chart Instances
    const chartInstances = useRef<{
        level: Chart | null;
        usage: Chart | null;
        refill: Chart | null;
    }>({ level: null, usage: null, refill: null });

    // State
    const [filter, setFilter] = useState('live');
    const [tsConfig, setTsConfig] = useState<{
        channelId: string | null;
        readApiKey: string | null;
    } | null>(null);

    const [data, setData] = useState({
        percent: 0,
        volume: 0,
        fillHeight: 0,
        meters: 0.85,  // Total height in m
        lowAlert: { state: 'green', text: 'NORMAL' },
        overAlert: { state: 'green', text: 'MINIMAL' },
        rapidAlert: { state: 'green', text: 'NORMAL' },
        sensorAlert: { state: 'green', text: 'CONNECTED' },
    });

    // Constants from user snippet
    const TOTAL_HEIGHT_CM = 85;
    const TOTAL_HEIGHT_M = 0.85;
    const MAX_CAPACITY = 500;
    const TARGET_SENSOR_VAL = 40;

    // 1. Fetch Config from Static Data
    useEffect(() => {
        if (!nodeId) {
            setTsConfig({ channelId: null, readApiKey: null });
            return;
        }
        const node = STATIC_NODES.find(n => n.id === nodeId || n.node_key === nodeId);
        if (node) {
            setTsConfig({
                channelId: node.thingspeak_channel_id ?? null,
                readApiKey: node.thingspeak_read_api_key ?? null,
            });
        } else {
            console.warn("Node not found:", nodeId);
            setTsConfig({ channelId: null, readApiKey: null });
        }
    }, [nodeId]);

    // 2. Initialize Charts
    useEffect(() => {
        // Level Chart
        if (levelChartRef.current) {
            if (chartInstances.current.level) chartInstances.current.level.destroy();
            chartInstances.current.level = new Chart(levelChartRef.current, {
                type: 'line',
                data: {
                    labels: [],
                    datasets: [{
                        label: 'Level (cm)',
                        data: [],
                        borderColor: '#4F46E5',
                        backgroundColor: 'rgba(79, 70, 229, 0.1)',
                        fill: true,
                        tension: 0.3
                    }]
                },
                options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, max: 85 } }, plugins: { legend: { display: false } } }
            });
        }

        // Usage Chart
        if (usageChartRef.current) {
            if (chartInstances.current.usage) chartInstances.current.usage.destroy();
            chartInstances.current.usage = new Chart(usageChartRef.current, {
                type: 'doughnut',
                data: { labels: ['Normal', 'Abnormal'], datasets: [{ data: [95, 5], backgroundColor: ['#4F46E5', '#EF4444'], borderWidth: 0 }] },
                options: { responsive: true, maintainAspectRatio: false, cutout: '80%', plugins: { legend: { display: false } } } as any
            });
        }

        // Refill Chart
        if (refillChartRef.current) {
            if (chartInstances.current.refill) chartInstances.current.refill.destroy();
            chartInstances.current.refill = new Chart(refillChartRef.current, {
                type: 'doughnut',
                data: {
                    labels: ['Cycles', 'Remaining'],
                    datasets: [{
                        data: [2.4, 1.6],
                        backgroundColor: ['#3B82F6', '#F1F5F9'],
                        borderWidth: 0,
                        borderRadius: 20
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    cutout: '85%',
                    plugins: { legend: { display: false }, tooltip: { enabled: false } },
                    animation: { animateScale: true, animateRotate: true } as any
                } as any
            });
        }

        return () => {
            Object.values(chartInstances.current).forEach(chart => chart?.destroy());
        };
    }, []);

    // 3. Data Fetching Loop
    useEffect(() => {
        if (!tsConfig?.channelId || !tsConfig?.readApiKey) return;

        const fetchData = async () => {
            let apiParams = '&results=15';
            if (filter === '1h') apiParams = '&minutes=60';
            if (filter === '6h') apiParams = '&minutes=360';
            if (filter === '24h') apiParams = '&minutes=1440';

            const url = `https://api.thingspeak.com/channels/${tsConfig.channelId}/feeds.json?api_key=${tsConfig.readApiKey}${apiParams}`;

            try {
                const response = await fetch(url);
                const json = await response.json();
                const feeds = json.feeds;

                // Static mock logic from snippet (mimicking the user's JS logic)
                const sensorReading = TARGET_SENSOR_VAL;
                const currentLevel = TOTAL_HEIGHT_CM - sensorReading;
                const percentage = (currentLevel / TOTAL_HEIGHT_CM) * 100;
                const volume = (percentage / 100) * MAX_CAPACITY;

                // Alert Logic
                let low = { state: 'green', text: 'NORMAL' };
                if (percentage < 20) low = { state: 'orange', text: 'ATTENTION REQUIRED' };

                let over = { state: 'green', text: 'MINIMAL' };
                if (percentage > 90) over = { state: 'red', text: 'CRITICAL' };

                // Update State
                setData(prev => ({
                    ...prev,
                    percent: percentage,
                    volume: volume,
                    fillHeight: percentage,
                    lowAlert: low,
                    overAlert: over,
                    sensorAlert: { state: 'green', text: 'CONNECTED' }
                }));

                // Update Charts
                if (chartInstances.current.level) {
                    // Color Logic
                    let borderColor = '#4F46E5';
                    let bgColor = 'rgba(79, 70, 229, 0.1)';

                    if (percentage > 70) {
                        borderColor = '#1e40af'; // Deep Blue
                        bgColor = 'rgba(30, 64, 175, 0.2)';
                    } else if (percentage < 30) {
                        borderColor = '#38bdf8'; // Sky Blue
                        bgColor = 'rgba(56, 189, 248, 0.2)';
                    }

                    chartInstances.current.level.data.datasets[0].borderColor = borderColor;
                    chartInstances.current.level.data.datasets[0].backgroundColor = bgColor;

                    const labels = feeds.map((f: any) => {
                        let d = new Date(f.created_at);
                        return d.getHours() + ":" + (d.getMinutes() < 10 ? '0' : '') + d.getMinutes();
                    });
                    // Mock data mapping as per snippet
                    const points = feeds.map(() => currentLevel);

                    chartInstances.current.level.data.labels = labels;
                    chartInstances.current.level.data.datasets[0].data = points;
                    chartInstances.current.level.update();
                }

            } catch (error) {
                console.error("Error:", error);
                setData(prev => ({ ...prev, sensorAlert: { state: 'red', text: 'DISCONNECTED' } }));
            }
        };

        fetchData();
        const interval = setInterval(fetchData, 15000); // 15s polling
        return () => clearInterval(interval);

    }, [tsConfig, filter]);


    // Helper for alert classes
    const getAlertClass = (state: string) => {
        if (state === 'green') return { dot: 'et-alert-dot et-bg-green', text: 'et-alert-right et-status-green' };
        if (state === 'orange') return { dot: 'et-alert-dot et-bg-orange', text: 'et-alert-right et-status-orange' };
        if (state === 'red') return { dot: 'et-alert-dot et-bg-red', text: 'et-alert-right et-status-red' };
        return { dot: 'et-alert-dot', text: 'et-alert-right' };
    };

    if (!tsConfig?.channelId && !embedded) return <NodeNotConfigured analyticsType="EvaraTank" />;

    return (
        <div className={`evara-tank-body${embedded ? ' et-embedded' : ''}`}>
            {!embedded && (
                <nav className="et-sidebar">
                    <Link to="/evaratank" style={{ textDecoration: 'none' }}>
                        <div style={{ width: '40px', height: '40px', background: 'var(--primary)', borderRadius: '12px', marginBottom: '25px' }}></div>
                    </Link>
                    <Link to="/evaradeep" style={{ textDecoration: 'none' }}>
                        <div style={{ width: '32px', height: '32px', background: '#E2E8F0', borderRadius: '10px', marginBottom: '25px' }}></div>
                    </Link>
                    <Link to="/evaraflow" style={{ textDecoration: 'none' }}>
                        <div style={{ width: '32px', height: '32px', background: '#E2E8F0', borderRadius: '10px', marginBottom: '25px' }}></div>
                    </Link>
                </nav>
            )}

            <main className="et-main-content">
                <header className="et-header">
                    <div className="et-header-title">
                        <h1>EvaraTank Analytics</h1>
                        <p>Real-Time Water Monitoring System</p>
                    </div>
                </header>

                <div className="et-dashboard-grid">

                    <div className="et-card">
                        <div className="et-tank-display">
                            <div className="et-tank-tube">
                                <div className="et-water-fill" style={{ height: `${data.fillHeight}%` }}></div>
                            </div>
                            <div>
                                <div className="et-kpi-label">Current Level</div>
                                <div className="et-percent-large">{data.percent.toFixed(1)}%</div>
                                <div className="et-meter-subtext">Total: {TOTAL_HEIGHT_M}m</div>
                            </div>
                        </div>
                    </div>

                    <div className="et-card">
                        <div className="et-kpi-label">Total Tank Volume</div>
                        <div className="et-kpi-value">500 L</div>
                        <div className="et-kpi-sub">Max Capacity</div>
                    </div>

                    <div className="et-card">
                        <div className="et-kpi-label">Available Volume</div>
                        <div className="et-kpi-value">{data.volume.toFixed(1)} L</div>
                        <div className="et-kpi-sub">Calculated Real-Time</div>
                    </div>

                    <div className="et-card">
                        <div className="et-kpi-label">Est. Consumption</div>
                        <div className="et-kpi-value">750 L</div>
                        <div className="et-kpi-sub">Daily Calculation (1.5 Cycles)</div>
                    </div>

                    <div className="et-card et-span-3">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h3 style={{ margin: 0, fontSize: '16px' }}>Real-Time Water Level</h3>
                            <div className="et-filter-group">
                                <button className={`et-filter-btn ${filter === 'live' ? 'active' : ''}`} onClick={() => setFilter('live')}>Live</button>
                                <button className={`et-filter-btn ${filter === '1h' ? 'active' : ''}`} onClick={() => setFilter('1h')}>1h</button>
                                <button className={`et-filter-btn ${filter === '6h' ? 'active' : ''}`} onClick={() => setFilter('6h')}>6h</button>
                                <button className={`et-filter-btn ${filter === '24h' ? 'active' : ''}`} onClick={() => setFilter('24h')}>24h</button>
                            </div>
                        </div>
                        <div className="et-chart-container">
                            <canvas ref={levelChartRef}></canvas>
                        </div>
                    </div>

                    <div className="et-card">
                        <h3 style={{ margin: '0 0 15px', fontSize: '14px' }}>Abnormal Usage</h3>
                        <div className="et-doughnut-container">
                            <canvas ref={usageChartRef}></canvas>
                        </div>
                        <div className="et-chart-legend">
                            <div className="et-legend-item"><span className="et-dot" style={{ background: '#4F46E5' }}></span> Normal</div>
                            <div className="et-legend-item"><span className="et-dot" style={{ background: '#EF4444' }}></span> Abnormal</div>
                        </div>
                    </div>

                    <div className="et-card">
                        <h3 style={{ margin: '0 0 10px', fontSize: '14px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Refill Cycles</h3>
                        <div className="et-ring-container">
                            <canvas ref={refillChartRef}></canvas>
                            <div className="et-ring-center-text">
                                <div className="et-kpi-value" style={{ color: 'var(--blue-accent)', margin: 0 }}>2.4</div>
                                <div className="et-sub-blue" style={{ fontSize: '11px' }}>Avg/Day</div>
                            </div>
                        </div>
                    </div>

                    <div className="et-card">
                        <h3 style={{ margin: '0 0 15px', fontSize: '14px' }}>Consumption Trends</h3>
                        <div className="et-list-container">
                            <div className="et-list-item">
                                <span className="et-list-label" style={{ color: 'var(--text-muted)' }}>Last 24 Hours</span>
                                <span className="et-list-value-bold">750 L</span>
                            </div>
                            <div className="et-list-item">
                                <span className="et-list-label" style={{ color: 'var(--text-muted)' }}>Last 3 Days</span>
                                <span className="et-list-value-bold">2,250 L</span>
                            </div>
                            <div className="et-list-item">
                                <span className="et-list-label" style={{ color: 'var(--text-muted)' }}>Last 7 Days</span>
                                <span className="et-list-value-bold">5,250 L</span>
                            </div>
                            <div className="et-list-item">
                                <span className="et-list-label" style={{ color: 'var(--text-muted)' }}>Last 30 Days</span>
                                <span className="et-list-value-bold">22,500 L</span>
                            </div>
                        </div>
                    </div>

                    <div className="et-card et-span-2">
                        <h3 style={{ margin: '0 0 20px', fontSize: '16px' }}>System Alerts</h3>
                        <div className="et-list-container">

                            <div className="et-list-item">
                                <div className="et-alert-left">
                                    <div className={getAlertClass(data.lowAlert.state).dot}></div>
                                    <span className="et-list-label">Low Water Level</span>
                                </div>
                                <div className={getAlertClass(data.lowAlert.state).text}>{data.lowAlert.text}</div>
                            </div>

                            <div className="et-list-item">
                                <div className="et-alert-left">
                                    <div className={getAlertClass(data.overAlert.state).dot}></div>
                                    <span className="et-list-label">Overflow Risk</span>
                                </div>
                                <div className={getAlertClass(data.overAlert.state).text}>{data.overAlert.text}</div>
                            </div>

                            <div className="et-list-item">
                                <div className="et-alert-left">
                                    <div className={getAlertClass(data.rapidAlert.state).dot}></div>
                                    <span className="et-list-label">Rapid Depletion</span>
                                </div>
                                <div className={getAlertClass(data.rapidAlert.state).text}>{data.rapidAlert.text}</div>
                            </div>

                            <div className="et-list-item">
                                <div className="et-alert-left">
                                    <div className={getAlertClass(data.sensorAlert.state).dot}></div>
                                    <span className="et-list-label">Sensor/Device Offline</span>
                                </div>
                                <div className={getAlertClass(data.sensorAlert.state).text}>{data.sensorAlert.text}</div>
                            </div>

                        </div>
                    </div>

                </div>
            </main>
        </div>
    );
};

export default EvaraTank;
