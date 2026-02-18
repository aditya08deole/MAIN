import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import Chart, { type ChartConfiguration } from 'chart.js/auto';
import { useThingSpeak } from '../hooks/useThingSpeak';

import { STATIC_NODES } from '../data/staticData';
import './EvaraDeep.css';

interface EvaraDeepProps {
    embedded?: boolean;
    nodeId?: string;
}

const EvaraDeep = ({ embedded = false, nodeId }: EvaraDeepProps) => {
    // Add logging to debug potential rendering issues
    console.log("EvaraDeep component rendering...");

    const gwChartRef = useRef<HTMLCanvasElement>(null);
    const seasonalChartRef = useRef<HTMLCanvasElement>(null);
    const chartInstances = useRef<{
        gw: Chart | null;
        seasonal: Chart | null;
    }>({ gw: null, seasonal: null });

    const [filter] = useState('live');
    const [tsConfig, setTsConfig] = useState<{
        channelId: string | null;
        readApiKey: string | null;
    } | null>(null);

    // Fetch ThingSpeak config from Static Data
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
            setTsConfig({ channelId: null, readApiKey: null });
        }
    }, [nodeId]);

    useThingSpeak({
        channelId: tsConfig?.channelId ?? null,
        readApiKey: tsConfig?.readApiKey ?? null,
        filter
    });

    // Animation State
    const [waterColHeight, setWaterColHeight] = useState(0);

    useEffect(() => {
        // Trigger animation after mount
        const timer = setTimeout(() => {
            setWaterColHeight(65); // Target height from CSS/Mock
        }, 100);
        return () => clearTimeout(timer);
    }, []);

    useEffect(() => {
        // 1. Groundwater Chart (Line)
        if (gwChartRef.current) {
            if (chartInstances.current.gw) chartInstances.current.gw.destroy();

            // TODO(fake-data): replace with real ThingSpeak feeds data
            const config: ChartConfiguration = {
                type: 'line',
                data: {
                    labels: ['Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
                    datasets: [{
                        label: 'Water Level',
                        data: [160, 155, 140, 138, 142, 145, 148],
                        borderColor: '#0F172A',
                        backgroundColor: 'rgba(15, 23, 42, 0.05)',
                        fill: true,
                        tension: 0.3
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } }
                }
            };
            chartInstances.current.gw = new Chart(gwChartRef.current, config);
        }

        // 2. Seasonal Radar Chart
        if (seasonalChartRef.current) {
            if (chartInstances.current.seasonal) chartInstances.current.seasonal.destroy();

            // TODO(fake-data): replace with real ThingSpeak feeds data
            const config: ChartConfiguration = {
                type: 'radar',
                data: {
                    labels: ['Monsoon', 'Winter', 'Summer', 'Pre-Mon'],
                    datasets: [{
                        label: 'Level',
                        data: [90, 70, 40, 55],
                        backgroundColor: 'rgba(56, 189, 248, 0.2)',
                        borderColor: '#38BDF8'
                    }]
                },
                options: {
                    plugins: { legend: { display: false } },
                    scales: {
                        r: {
                            angleLines: {
                                display: false
                            },
                            suggestedMin: 0,
                            suggestedMax: 100
                        }
                    }
                }
            };
            chartInstances.current.seasonal = new Chart(seasonalChartRef.current, config);
        }

        return () => {
            Object.values(chartInstances.current).forEach(chart => chart?.destroy());
        };
    }, []);

    // if (noConfig) return <NodeNotConfigured analyticsType="EvaraDeep" />;

    return (
        <div className={`evara-deep-body${embedded ? ' ed-embedded' : ''}`}>
            {!embedded && (
                <nav className="ed-sidebar">
                    <Link to="/evaratank" style={{ textDecoration: 'none' }}>
                        <div style={{ width: '24px', height: '24px', background: '#E2E8F0', borderRadius: '6px', marginBottom: '25px', cursor: 'pointer' }}></div>
                    </Link>
                    <Link to="/evaradeep" style={{ textDecoration: 'none' }}>
                        <div style={{ width: '40px', height: '40px', background: '#0F172A', borderRadius: '12px', marginBottom: '25px', boxShadow: '0 4px 12px rgba(15, 23, 42, 0.3)', cursor: 'pointer' }}></div>
                    </Link>
                    <Link to="/evaraflow" style={{ textDecoration: 'none' }}>
                        <div style={{ width: '24px', height: '24px', background: '#E2E8F0', borderRadius: '6px', marginBottom: '25px', cursor: 'pointer' }}></div>
                    </Link>
                </nav>
            )}

            <main className="ed-main-content">
                <header className="ed-header">
                    <div className="ed-header-title">
                        <h1>EvaraDeep Analytics</h1>
                        <p>Borewell Health & Groundwater Monitoring</p>
                    </div>
                </header>

                <div className="ed-dashboard-grid">
                    <div className="ed-card">
                        <div className="ed-depth-display">
                            <div className="ed-borewell-shaft">
                                <div className="ed-water-column" style={{ height: `${waterColHeight}%`, transition: 'height 1s ease-out' }}></div>
                            </div>
                            <div>
                                <div className="ed-kpi-label">Current Depth</div>
                                <div className="ed-kpi-value">145m</div>
                                <div className="ed-kpi-sub" style={{ color: 'var(--ed-success)' }}>Static: 42m</div>
                            </div>
                        </div>
                    </div>

                    <div className="ed-card">
                        <div className="ed-kpi-label">Dynamic Level</div>
                        {/* TODO(fake-data): replace with real ThingSpeak feeds data */}
                        <div className="ed-kpi-value">58m</div>
                        <div className="ed-kpi-sub" style={{ color: 'var(--ed-warning)' }}>Pump Active</div>
                    </div>

                    <div className="ed-card">
                        <div className="ed-kpi-label">Recharge Rate</div>
                        {/* TODO(fake-data): replace with real ThingSpeak feeds data */}
                        <div className="ed-kpi-value">1.2m/hr</div>
                        <div className="ed-kpi-sub" style={{ color: 'var(--ed-secondary)' }}>↑ Stable</div>
                    </div>

                    <div className="ed-card">
                        <div className="ed-kpi-label">Sustainability</div>
                        {/* TODO(fake-data): replace with real ThingSpeak feeds data */}
                        <div className="ed-kpi-value">Optimal</div>
                        <div className="ed-kpi-sub" style={{ color: 'var(--ed-success)' }}>Healthy Source</div>
                    </div>

                    <div className="ed-card ed-span-3">
                        <h3 style={{ margin: '0 0 20px', fontSize: '16px' }}>Sustainability Trends</h3>
                        <div className="ed-chart-container">
                            <canvas ref={gwChartRef}></canvas>
                        </div>
                    </div>

                    <div className="ed-card">
                        <h3 style={{ margin: '0 0 20px', fontSize: '16px' }}>Seasonal Variation</h3>
                        <div className="ed-chart-container" style={{ height: '180px' }}>
                            <canvas ref={seasonalChartRef}></canvas>
                        </div>
                    </div>

                    <div className="ed-card ed-span-2">
                        <h3 style={{ margin: '0', fontSize: '16px' }}>Advanced Analytics</h3>
                        <div className="ed-analytics-pill-container">
                            <div className="ed-analytics-item">
                                <div className="ed-mini-graph">
                                    <div className="ed-bar" style={{ height: '40%' }}></div>
                                    <div className="ed-bar" style={{ height: '70%' }}></div>
                                    <div className="ed-bar" style={{ height: '100%' }}></div>
                                </div>
                                <span>Long-term<br />Groundwater</span>
                            </div>
                            <div className="ed-analytics-item">
                                <div className="ed-mini-graph">
                                    <div style={{ width: '30px', height: '30px', border: '3px solid var(--ed-secondary)', borderRadius: '50%', borderRightColor: 'transparent', transform: 'rotate(45deg)' }}></div>
                                </div>
                                <span>Seasonal<br />Variation</span>
                            </div>
                            <div className="ed-analytics-item">
                                <div className="ed-mini-graph">
                                    <div className="ed-bar" style={{ height: '100%', background: 'var(--ed-success)' }}></div>
                                    <div className="ed-bar" style={{ height: '80%', background: 'var(--ed-success)' }}></div>
                                    <div className="ed-bar" style={{ height: '90%', background: 'var(--ed-success)' }}></div>
                                </div>
                                <span>Borewell<br />Sustainability</span>
                            </div>
                        </div>
                    </div>

                    <div className="ed-card ed-span-2">
                        <h3 style={{ margin: '0', fontSize: '16px' }}>Use Cases</h3>
                        <div className="ed-use-case-row">
                            <div className="ed-case-tile">
                                <div className="ed-case-info">
                                    <div className="ed-case-icon">📍</div>
                                    <span className="ed-case-name">Borewell Monitoring</span>
                                </div>
                                <span className="ed-live-badge">LIVE</span>
                            </div>
                            <div className="ed-case-tile" style={{ borderLeftColor: 'var(--ed-primary)' }}>
                                <div className="ed-case-info">
                                    <div className="ed-case-icon">🛢️</div>
                                    <span className="ed-case-name">Underground Storage</span>
                                </div>
                                <span className="ed-live-badge">SECURE</span>
                            </div>
                            <div className="ed-case-tile" style={{ borderLeftColor: 'var(--ed-success)' }}>
                                <div className="ed-case-info">
                                    <div className="ed-case-icon">🌱</div>
                                    <span className="ed-case-name">Source Health Tracking</span>
                                </div>
                                <span className="ed-live-badge">GOOD</span>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default EvaraDeep;
