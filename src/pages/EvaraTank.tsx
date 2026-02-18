import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Chart, { type ChartConfiguration } from 'chart.js/auto';
import './EvaraTank.css';

interface EvaraTankProps {
    embedded?: boolean;
}

const EvaraTank = ({ embedded = false }: EvaraTankProps) => {
    const levelChartRef = useRef<HTMLCanvasElement>(null);
    const usageChartRef = useRef<HTMLCanvasElement>(null);
    const refillChartRef = useRef<HTMLCanvasElement>(null);

    // Refs to hold chart instances to destroy them on unmount/re-render
    const chartInstances = useRef<{
        level: Chart | null;
        usage: Chart | null;
        refill: Chart | null;
    }>({ level: null, usage: null, refill: null });

    const [filter, setFilter] = useState('live');
    const [kpiData, setKpiData] = useState({
        percent: 0,
        volume: 0,
        fillHeight: 0,
        level: 0,      // in cm
        meters: 0.85,  // total height in m
        lowAlert: { state: 'green', text: 'NORMAL' },
        overAlert: { state: 'green', text: 'MINIMAL' },
        rapidAlert: { state: 'green', text: 'NORMAL' },
        sensorAlert: { state: 'green', text: 'CONNECTED' },
    });

    const CHANNEL_ID = '3212670';
    const READ_API_KEY = 'UXORK5OUGJ2VK5PX';
    const TOTAL_HEIGHT_CM = 85;
    const MAX_CAPACITY = 500;
    const TARGET_SENSOR_VAL = 40;

    // Function to set filter
    const handleFilterChange = (newFilter: string) => {
        setFilter(newFilter);
        // In React, fetchData will satisfy the filter dependency or be called
    };

    useEffect(() => {
        const fetchData = async () => {
            let apiParams = '&results=15';
            if (filter === '1h') apiParams = '&minutes=60';
            if (filter === '6h') apiParams = '&minutes=360';
            if (filter === '24h') apiParams = '&minutes=1440';

            const url = `https://api.thingspeak.com/channels/${CHANNEL_ID}/feeds.json?api_key=${READ_API_KEY}${apiParams}`;

            try {
                const response = await fetch(url);
                const data = await response.json();
                const feeds = data.feeds;

                // Mock calculations based on user's script
                const sensorReading = TARGET_SENSOR_VAL; // Static mock from user code
                const currentLevel = TOTAL_HEIGHT_CM - sensorReading;
                const percentage = (currentLevel / TOTAL_HEIGHT_CM) * 100;
                // const meters = currentLevel / 100; // Unused in display update
                const volume = (percentage / 100) * MAX_CAPACITY;

                // Determine Alert States
                let low = { state: 'green', text: 'NORMAL' };
                if (percentage < 20) low = { state: 'orange', text: 'ATTENTION REQUIRED' };

                let over = { state: 'green', text: 'MINIMAL' };
                if (percentage > 90) over = { state: 'red', text: 'CRITICAL' };

                setKpiData({
                    percent: percentage,
                    volume: volume,
                    fillHeight: percentage,
                    level: currentLevel,
                    meters: 0.85,
                    lowAlert: low,
                    overAlert: over,
                    rapidAlert: { state: 'green', text: 'NORMAL' },
                    sensorAlert: { state: 'green', text: 'CONNECTED' }
                });


                // --- CHART COLOR LOGIC ---
                let borderColor = '#4F46E5';
                let bgColor = 'rgba(79, 70, 229, 0.1)';

                if (percentage > 70) {
                    borderColor = '#1e40af'; // Deep Blue
                    bgColor = 'rgba(30, 64, 175, 0.2)';
                } else if (percentage < 30) {
                    borderColor = '#38bdf8'; // Sky Blue
                    bgColor = 'rgba(56, 189, 248, 0.2)';
                }

                // Update Level Chart
                if (chartInstances.current.level) {
                    const labels = feeds.map((f: any) => {
                        let d = new Date(f.created_at);
                        return d.getHours() + ":" + (d.getMinutes() < 10 ? '0' : '') + d.getMinutes();
                    });
                    const points = feeds.map(() => currentLevel); // Mock data from script

                    chartInstances.current.level.data.labels = labels;
                    chartInstances.current.level.data.datasets[0].data = points;
                    chartInstances.current.level.data.datasets[0].borderColor = borderColor;
                    chartInstances.current.level.data.datasets[0].backgroundColor = bgColor;
                    chartInstances.current.level.update();
                }

            } catch (error) {
                console.error("Error:", error);
                setKpiData(prev => ({
                    ...prev,
                    sensorAlert: { state: 'red', text: 'DISCONNECTED' }
                }));
            }
        };

        // Initial Fetch
        fetchData();
        const interval = setInterval(fetchData, 15000); // 15s refresh

        return () => clearInterval(interval);
    }, [filter]);

    // Initialize Charts on Mount
    useEffect(() => {
        // 1. Level Chart
        if (levelChartRef.current) {
            if (chartInstances.current.level) chartInstances.current.level.destroy();

            const config: ChartConfiguration = {
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
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: { y: { beginAtZero: true, max: 85 } },
                    plugins: { legend: { display: false } }
                }
            };
            chartInstances.current.level = new Chart(levelChartRef.current, config);
        }

        // 2. Usage Chart
        if (usageChartRef.current) {
            if (chartInstances.current.usage) chartInstances.current.usage.destroy();

            const config: ChartConfiguration = {
                type: 'doughnut',
                data: {
                    labels: ['Normal', 'Abnormal'],
                    datasets: [{
                        data: [95, 5],
                        backgroundColor: ['#4F46E5', '#EF4444'],
                        borderWidth: 0
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    cutout: '80%',
                    plugins: { legend: { display: false } }
                } as any
            };
            chartInstances.current.usage = new Chart(usageChartRef.current, config);
        }

        // 3. Refill Chart
        if (refillChartRef.current) {
            if (chartInstances.current.refill) chartInstances.current.refill.destroy();

            const config: ChartConfiguration = {
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
            };
            chartInstances.current.refill = new Chart(refillChartRef.current, config);
        }

        return () => {
            Object.values(chartInstances.current).forEach(chart => chart?.destroy());
        };
    }, []);

    // Helper for alert classes
    const getAlertClass = (state: string) => {
        if (state === 'green') return { dot: 'et-alert-dot et-bg-green', text: 'et-alert-right et-status-green' };
        if (state === 'orange') return { dot: 'et-alert-dot et-bg-orange', text: 'et-alert-right et-status-orange' };
        if (state === 'red') return { dot: 'et-alert-dot et-bg-red', text: 'et-alert-right et-status-red' };
        return { dot: 'et-alert-dot', text: 'et-alert-right' };
    };

    return (
        <div className={`evara-tank-body${embedded ? ' et-embedded' : ''}`}>
            {!embedded && (
                <nav className="et-sidebar">
                    <Link to="/evaratank" style={{ textDecoration: 'none' }}>
                        <div style={{ width: '40px', height: '40px', background: '#4F46E5', borderRadius: '12px', marginBottom: '25px', boxShadow: '0 4px 12px rgba(79, 70, 229, 0.3)', cursor: 'pointer' }}></div>
                    </Link>
                    <Link to="/evaradeep" style={{ textDecoration: 'none' }}>
                        <div style={{ width: '24px', height: '24px', background: '#E2E8F0', borderRadius: '6px', marginBottom: '25px', cursor: 'pointer' }}></div>
                    </Link>
                    <Link to="/evaraflow" style={{ textDecoration: 'none' }}>
                        <div style={{ width: '24px', height: '24px', background: '#E2E8F0', borderRadius: '6px', marginBottom: '25px', cursor: 'pointer' }}></div>
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
                                <div className="et-water-fill" style={{ height: `${kpiData.fillHeight}%` }}></div>
                            </div>
                            <div>
                                <div className="et-kpi-label">Current Level</div>
                                <div className="et-percent-large">{kpiData.percent.toFixed(1)}%</div>
                                <div className="et-meter-subtext">Total: {kpiData.meters}m</div>
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
                        <div className="et-kpi-value">{kpiData.volume.toFixed(1)} L</div>
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
                                {['live', '1h', '6h', '24h'].map(f => (
                                    <button
                                        key={f}
                                        className={`et-filter-btn ${filter === f ? 'active' : ''}`}
                                        onClick={() => handleFilterChange(f)}
                                    >
                                        {f === 'live' ? 'Live' : f}
                                    </button>
                                ))}
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
                                    <div className={getAlertClass(kpiData.lowAlert.state).dot}></div>
                                    <span className="et-list-label">Low Water Level</span>
                                </div>
                                <div className={getAlertClass(kpiData.lowAlert.state).text}>{kpiData.lowAlert.text}</div>
                            </div>

                            <div className="et-list-item">
                                <div className="et-alert-left">
                                    <div className={getAlertClass(kpiData.overAlert.state).dot}></div>
                                    <span className="et-list-label">Overflow Risk</span>
                                </div>
                                <div className={getAlertClass(kpiData.overAlert.state).text}>{kpiData.overAlert.text}</div>
                            </div>

                            <div className="et-list-item">
                                <div className="et-alert-left">
                                    <div className={getAlertClass(kpiData.rapidAlert.state).dot}></div>
                                    <span className="et-list-label">Rapid Depletion</span>
                                </div>
                                <div className={getAlertClass(kpiData.rapidAlert.state).text}>{kpiData.rapidAlert.text}</div>
                            </div>

                            <div className="et-list-item">
                                <div className="et-alert-left">
                                    <div className={getAlertClass(kpiData.sensorAlert.state).dot}></div>
                                    <span className="et-list-label">Sensor/Device Offline</span>
                                </div>
                                <div className={getAlertClass(kpiData.sensorAlert.state).text}>{kpiData.sensorAlert.text}</div>
                            </div>

                        </div>
                    </div>

                </div>
            </main>
        </div>
    );
};

export default EvaraTank;
