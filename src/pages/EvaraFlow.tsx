import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import Chart, { type ChartConfiguration } from 'chart.js/auto';
import './EvaraFlow.css';

const EvaraFlow = () => {
    // Add logging to debug potential rendering issues
    console.log("EvaraFlow component rendering...");

    const flowTrendChartRef = useRef<HTMLCanvasElement>(null);
    const usageDoughnutRef = useRef<HTMLCanvasElement>(null);
    const liveFlowBarRef = useRef<HTMLCanvasElement>(null);

    const chartInstances = useRef<{
        trend: Chart | null;
        usage: Chart | null;
        live: Chart | null;
    }>({ trend: null, usage: null, live: null });

    useEffect(() => {
        // 1. Flow Trend Chart (Line)
        if (flowTrendChartRef.current) {
            if (chartInstances.current.trend) chartInstances.current.trend.destroy();

            const config: ChartConfiguration = {
                type: 'line',
                data: {
                    labels: ['4am', '8am', '12pm', '4pm', '8pm', '12am'],
                    datasets: [{
                        label: 'Flow Rate',
                        data: [40, 120, 200, 150, 280, 60],
                        borderColor: '#0EA5E9',
                        backgroundColor: 'rgba(14, 165, 233, 0.1)',
                        fill: true,
                        tension: 0.4,
                        borderWidth: 3,
                        pointRadius: 5
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } }
                }
            };
            chartInstances.current.trend = new Chart(flowTrendChartRef.current, config);
        }

        // 2. Usage Doughnut Chart
        if (usageDoughnutRef.current) {
            if (chartInstances.current.usage) chartInstances.current.usage.destroy();

            const config: ChartConfiguration = {
                type: 'doughnut',
                data: {
                    labels: ['Peak', 'Standard'],
                    datasets: [{
                        label: 'Usage',
                        data: [45, 55],
                        backgroundColor: ['#0EA5E9', '#E2E8F0'],
                        borderWidth: 0
                    }]
                },
                options: {
                    cutout: '80%',
                    plugins: { legend: { display: false } }
                } as any
            };
            chartInstances.current.usage = new Chart(usageDoughnutRef.current, config);
        }

        // 3. Live Flow Bar Chart
        if (liveFlowBarRef.current) {
            if (chartInstances.current.live) chartInstances.current.live.destroy();

            const config: ChartConfiguration = {
                type: 'bar',
                data: {
                    labels: ['-5m', '-4m', '-3m', '-2m', '-1m', 'Now'],
                    datasets: [{
                        label: 'Flow',
                        data: [12, 14, 11, 15, 12, 12.5],
                        backgroundColor: '#7DD3FC',
                        borderRadius: 8
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } }
                }
            };
            chartInstances.current.live = new Chart(liveFlowBarRef.current, config);
        }

        return () => {
            Object.values(chartInstances.current).forEach(chart => chart?.destroy());
        };
    }, []);

    return (
        <div className="evara-flow-body">
            <nav className="ef-sidebar">
                <Link to="/evaratank" style={{ textDecoration: 'none' }}>
                    <div style={{ width: '24px', height: '24px', background: '#E2E8F0', borderRadius: '6px', marginBottom: '25px', cursor: 'pointer' }}></div>
                </Link>
                <Link to="/evaradeep" style={{ textDecoration: 'none' }}>
                    <div style={{ width: '24px', height: '24px', background: '#E2E8F0', borderRadius: '6px', marginBottom: '25px', cursor: 'pointer' }}></div>
                </Link>
                <Link to="/evaraflow" style={{ textDecoration: 'none' }}>
                    <div style={{ width: '40px', height: '40px', background: '#0EA5E9', borderRadius: '12px', marginBottom: '25px', boxShadow: '0 4px 12px rgba(14, 165, 233, 0.3)', cursor: 'pointer' }}></div>
                </Link>
            </nav>

            <main className="ef-main-content">
                <header className="ef-header">
                    <h1>EvaraFlow Analytics</h1>
                    <p>Water Flow Rate & Consumption Monitoring</p>
                </header>

                <div className="ef-dashboard-grid">
                    <div className="ef-card" style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <div className="ef-flow-visual"><div className="ef-flow-fill"></div></div>
                        <div>
                            <div className="ef-kpi-label">Instant Flow</div>
                            <div className="ef-kpi-value">12.5</div>
                            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--ef-primary)' }}>L/Min</div>
                        </div>
                    </div>

                    <div className="ef-card">
                        <div className="ef-kpi-label">Cumulative Usage</div>
                        <div className="ef-kpi-value">1,240 L</div>
                        <div className="ef-kpi-sub" style={{ color: 'var(--ef-text-muted)' }}>Today</div>
                    </div>

                    <div className="ef-card">
                        <div className="ef-kpi-label">Peak Flow</div>
                        <div className="ef-kpi-value">28.4 L</div>
                        <div className="ef-kpi-sub" style={{ color: 'var(--ef-warning)' }}>08:45 AM</div>
                    </div>

                    <div className="ef-card">
                        <div className="ef-kpi-label">Efficiency</div>
                        <div className="ef-kpi-value">94%</div>
                        <div className="ef-kpi-sub" style={{ color: 'var(--ef-success)' }}>Optimal Range</div>
                    </div>

                    <div className="ef-card ef-span-3">
                        <div className="ef-chart-header">
                            <h3 style={{ margin: 0, fontSize: '18px' }}>Consumption Trends</h3>
                            <div className="ef-nav-group">
                                <button className="ef-nav-btn active">Last 24h</button>
                                <button className="ef-nav-btn">Last 3d</button>
                                <button className="ef-nav-btn">Last 7d</button>
                                <button className="ef-nav-btn">Last 30d</button>
                            </div>
                        </div>
                        <div className="ef-chart-container">
                            <canvas ref={flowTrendChartRef}></canvas>
                        </div>
                    </div>

                    <div className="ef-card">
                        <h3 style={{ margin: '0 0 16px', fontSize: '16px' }}>Usage by Period</h3>
                        <div className="ef-chart-container" style={{ height: '180px' }}>
                            <canvas ref={usageDoughnutRef}></canvas>
                        </div>
                        <div style={{ marginTop: '16px', fontSize: '13px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                <span>Morning Peak</span><span style={{ fontWeight: 700 }}>45%</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span>Standard Usage</span><span style={{ fontWeight: 700 }}>55%</span>
                            </div>
                        </div>
                    </div>

                    <div className="ef-card ef-span-2">
                        <h3 style={{ margin: '0 0 16px', fontSize: '16px' }}>Instantaneous Flow Indicator</h3>
                        <div className="ef-chart-container" style={{ height: '160px' }}>
                            <canvas ref={liveFlowBarRef}></canvas>
                        </div>
                    </div>

                    <div className="ef-card ef-span-2">
                        <h3 style={{ margin: '0 0 16px', fontSize: '16px' }}>Flow Integrity Alerts</h3>
                        <div className="ef-alert-row">
                            <span><span className="ef-status-dot" style={{ background: 'var(--ef-success)' }}></span>Continuous Flow (Leak)</span>
                            <span style={{ fontWeight: 700, color: 'var(--ef-success)', fontSize: '12px' }}>SECURE</span>
                        </div>
                        <div className="ef-alert-row">
                            <span><span className="ef-status-dot" style={{ background: 'var(--ef-danger)' }}></span>Unusual Flow Spike</span>
                            <span style={{ fontWeight: 700, color: 'var(--ef-danger)', fontSize: '12px' }}>ALERT: 11:20 AM</span>
                        </div>
                        <div className="ef-alert-row">
                            <span><span className="ef-status-dot" style={{ background: 'var(--ef-warning)' }}></span>No-Flow Condition</span>
                            <span style={{ fontWeight: 700, color: 'var(--ef-warning)', fontSize: '12px' }}>VERIFYING...</span>
                        </div>
                        <div className="ef-alert-row">
                            <span><span className="ef-status-dot" style={{ background: 'var(--ef-success)' }}></span>Flow Direction Status</span>
                            <span style={{ fontWeight: 700, color: 'var(--ef-success)', fontSize: '12px' }}>NORMAL</span>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default EvaraFlow;
