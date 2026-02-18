import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Users, User, Settings, Crown, Key, Globe, Database, Monitor, Bell, FileText, ChevronDown } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

/* ─── Data ─── */
const distributors = [
    { id: 'DST-001', name: 'HydroServe Solutions', region: 'Hyd North', nodes: 48, customers: 120, status: 'Active' },
    { id: 'DST-002', name: 'AquaLink Partners', region: 'Hyd South', nodes: 36, customers: 89, status: 'Active' },
    { id: 'DST-003', name: 'WaterGrid Dist.', region: 'Secunderabad', nodes: 24, customers: 65, status: 'Active' },
    { id: 'DST-004', name: 'FlowTech Networks', region: 'Kukatpally', nodes: 18, customers: 42, status: 'Suspended' },
];
const customers = [
    { id: 'CUST-1001', name: 'Sunrise Apartments', type: 'Residential', devices: 3, status: 'Active' },
    { id: 'CUST-1002', name: 'TechPark Office', type: 'Commercial', devices: 8, status: 'Active' },
    { id: 'CUST-1003', name: 'Green Valley', type: 'Residential', devices: 12, status: 'Active' },
    { id: 'CUST-1004', name: 'Metro Hospital', type: 'Institutional', devices: 5, status: 'Active' },
    { id: 'CUST-1005', name: 'Lake View Villa', type: 'Residential', devices: 1, status: 'Inactive' },
];

const ROLE_TAB_MAP: Record<string, string> = { superadmin: 'Command', distributor: 'Distributor', customer: 'Customer' };

/* ─── Widget Card Component ─── */
const Widget = ({ icon: Icon, iconBg, title, summary, expanded, onClick, children }: {
    icon: any; iconBg: string; title: string; summary: string;
    expanded: boolean; onClick: () => void; children: React.ReactNode;
}) => (
    <div
        onClick={onClick}
        style={{
            background: expanded ? '#FFF' : 'rgba(255,255,255,0.9)',
            backdropFilter: 'blur(20px)',
            borderRadius: '24px',
            border: expanded ? '1.5px solid #CBD5E1' : '1px solid rgba(226,232,240,0.8)',
            cursor: 'pointer',
            transition: 'all 0.4s cubic-bezier(0.25, 0.8, 0.25, 1)',
            boxShadow: expanded
                ? '0 25px 50px -12px rgba(0, 0, 0, 0.15)'
                : '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03)',
            overflow: 'hidden',
            gridColumn: expanded ? 'span 2' : 'span 1',
            gridRow: expanded ? 'span 2' : 'span 1',
            display: 'flex',
            flexDirection: 'column',
            position: 'relative',
        }}
    >
        {/* ── Expanded Header ── */}
        {expanded ? (
            <div style={{
                padding: '20px 24px',
                display: 'flex', alignItems: 'center', gap: '16px',
                borderBottom: '1px solid #F1F5F9',
                flexShrink: 0,
            }}>
                <div style={{
                    width: '44px', height: '44px', borderRadius: '12px',
                    background: iconBg,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                    boxShadow: `0 4px 10px ${iconBg}40`
                }}>
                    <Icon size={22} color="#FFF" />
                </div>
                <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: '16px', color: '#1E293B' }}>{title}</div>
                    <div style={{ fontSize: '13px', color: '#64748B' }}>{summary}</div>
                </div>
                <ChevronDown size={20} color="#94A3B8" style={{ transform: 'rotate(180deg)' }} />
            </div>
        ) : (
            /* ── Collapsed Content (Large Icon) ── */
            <div style={{
                flex: 1, display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                gap: '16px', padding: '20px',
            }}>
                <div style={{
                    width: '80px', height: '80px', borderRadius: '20px',
                    background: `${iconBg}15`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'transform 0.3s ease',
                }}>
                    <Icon size={40} color={iconBg} />
                </div>
                <div style={{ textAlign: 'center' }}>
                    <div style={{ fontWeight: 800, fontSize: '18px', color: '#334155' }}>{title}</div>
                    <div style={{ fontSize: '13px', color: '#94A3B8', marginTop: '4px', fontWeight: 500 }}>{summary}</div>
                </div>
            </div>
        )}

        {/* ── Expanded Content Body ── */}
        {expanded && (
            <div
                onClick={e => e.stopPropagation()}
                style={{
                    padding: '24px',
                    flex: 1,
                    overflow: 'auto',
                    minHeight: 0,
                    animation: 'fadeIn 0.3s ease-out'
                }}
            >
                {children}
            </div>
        )}
    </div>
);

/* ─── Utility Components ─── */
const Row = ({ label, sub, right, dot }: { label: string; sub: string; right?: React.ReactNode; dot?: string }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 0', borderBottom: '1px solid #F8FAFC' }}>
        {dot && <div style={{ width: 8, height: 8, borderRadius: '50%', background: dot, flexShrink: 0 }} />}
        <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600, fontSize: '13px', color: '#1E293B' }}>{label}</div>
            <div style={{ fontSize: '11px', color: '#64748B' }}>{sub}</div>
        </div>
        {right}
    </div>
);

const StatPill = ({ icon, value, label, color }: { icon: string; value: string; label: string; color: string }) => (
    <div style={{ textAlign: 'center', padding: '12px 8px', background: '#F8FAFC', borderRadius: '12px' }}>
        <div style={{ fontSize: '18px', marginBottom: '4px' }}>{icon}</div>
        <div style={{ fontSize: '18px', fontWeight: 800, color }}>{value}</div>
        <div style={{ fontSize: '11px', color: '#64748B', fontWeight: 600 }}>{label}</div>
    </div>
);

/* ─── Admin Page ─── */
const Admin = () => {
    const { user, isAuthenticated } = useAuth();
    const navigate = useNavigate();
    const [expanded, setExpanded] = useState<string | null>(null);
    const [demoPlan, setDemoPlan] = useState<string>('base');

    useEffect(() => {
        if (!isAuthenticated) navigate('/login', { replace: true });
        if (user?.plan) setDemoPlan(user.plan);
    }, [isAuthenticated, navigate, user]);

    const activeTab = user ? ROLE_TAB_MAP[user.role] : 'Command';
    // User Plan Logic
    const tabs = [
        { name: 'Command', subtitle: 'Super Admin', icon: Crown, color: '#DC2626', border: '#FECACA' },
        { name: 'Distributor', subtitle: 'Operational', icon: Shield, color: '#2563EB', border: '#BFDBFE' },
        { name: 'Customer', subtitle: 'End User', icon: User, color: '#16A34A', border: '#BBF7D0' },
    ];
    const t = tabs.find(x => x.name === activeTab)!;

    const toggle = (key: string) => setExpanded(prev => prev === key ? null : key);

    if (!isAuthenticated) return null;

    return (
        <div style={{
            height: 'calc(100vh - 64px)', display: 'flex', flexDirection: 'column',
            padding: '24px', gap: '20px', overflow: 'hidden', background: '#F8FAFC',
        }}>
            {/* ── Header bar ── */}
            <div style={{
                display: 'flex', alignItems: 'center', gap: '16px', flexShrink: 0,
                background: '#FFF',
                borderRadius: '16px', padding: '16px 24px',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)'
            }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: t.color, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 4px 10px ${t.color}40` }}>
                    <t.icon size={20} color="#FFF" />
                </div>
                <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
                    <div>
                        <span style={{ fontWeight: 800, fontSize: '18px', color: '#1E293B' }}>Administration</span>
                        <span style={{ fontSize: '13px', marginLeft: '10px', background: `${t.color}15`, color: t.color, padding: '4px 8px', borderRadius: '6px', fontWeight: 700 }}>
                            {t.subtitle} Mode
                        </span>
                    </div>
                    {user?.role === 'customer' && (
                        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px', background: '#F1F5F9', padding: '4px 8px', borderRadius: '12px' }}>
                            <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748B' }}>Simulate Plan:</span>
                            <select
                                value={demoPlan}
                                onChange={(e) => setDemoPlan(e.target.value)}
                                style={{
                                    padding: '4px 8px', borderRadius: '8px', border: '1px solid #CBD5E1',
                                    fontSize: '12px', fontWeight: 700, outline: 'none', cursor: 'pointer'
                                }}
                            >
                                <option value="base">BASE</option>
                                <option value="plus">PLUS</option>
                                <option value="pro">PRO</option>
                            </select>
                        </div>
                    )}
                </div>
            </div>

            {/* ── Widget Grid ── */}
            <div style={{
                flex: 1, display: 'grid', gap: '20px', minHeight: 0,
                gridTemplateColumns: 'repeat(3, 1fr)',
                gridAutoRows: 'minmax(180px, 1fr)', // Ensure min height to prevent cutting
                gridAutoFlow: 'dense', // Key for "adjusting in remaining space"
                overflow: 'auto',
                paddingBottom: '20px'
            }}>
                {/* ════════ SUPER ADMIN ════════ */}
                {activeTab === 'Command' && (<>
                    <Widget icon={Users} iconBg="#DC2626" title="Entity Management" summary="4 distributors · 5 customers"
                        expanded={expanded === 'sa-entity'} onClick={() => toggle('sa-entity')}>
                        <div style={{ paddingTop: '10px' }}>
                            <div style={{ fontSize: '11px', fontWeight: 700, color: '#1E40AF', marginBottom: '4px' }}>Distributors</div>
                            {distributors.map(d => (
                                <Row key={d.id} label={d.name} sub={`${d.region} · ${d.nodes} nodes`} dot={d.status === 'Active' ? '#22C55E' : '#94A3B8'} />
                            ))}
                            <div style={{ fontSize: '11px', fontWeight: 700, color: '#166534', margin: '8px 0 4px' }}>Customers</div>
                            {customers.map(c => (
                                <Row key={c.id} label={c.name} sub={`${c.type} · ${c.devices} dev`} dot={c.status === 'Active' ? '#22C55E' : '#94A3B8'} />
                            ))}
                        </div>
                    </Widget>

                    <Widget icon={Key} iconBg="#DC2626" title="Device Assignment" summary="Assign devices to entities"
                        expanded={expanded === 'sa-assign'} onClick={() => toggle('sa-assign')}>
                        <div style={{ paddingTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {['Device', 'Distributor', 'Customer'].map(l => (
                                <div key={l}>
                                    <label style={{ fontSize: '11px', fontWeight: 600, color: '#64748B', marginBottom: '2px', display: 'block' }}>{l}</label>
                                    <select style={{ width: '100%', padding: '6px 8px', border: '1px solid #E2E8F0', borderRadius: '8px', fontSize: '12px', background: '#F8FAFC' }}>
                                        <option>Select {l}...</option>
                                    </select>
                                </div>
                            ))}
                            <button style={{ padding: '8px', background: '#DC2626', color: '#FFF', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>Assign Device</button>
                        </div>
                    </Widget>

                    <Widget icon={Settings} iconBg="#DC2626" title="System Configuration" summary="Thresholds · Sampling · Firmware"
                        expanded={expanded === 'sa-config'} onClick={() => toggle('sa-config')}>
                        <div style={{ paddingTop: '10px' }}>
                            {[
                                { label: 'Tank Max', val: '95%' }, { label: 'Tank Min', val: '15%' },
                                { label: 'Flow Max', val: '30 L/min' }, { label: 'Sampling Tank', val: '30s' },
                                { label: 'Sampling Deep', val: '60s' }, { label: 'Sampling Flow', val: '15s' },
                            ].map((c, i) => (
                                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #F8FAFC' }}>
                                    <span style={{ fontSize: '12px', color: '#475569' }}>{c.label}</span>
                                    <span style={{ fontSize: '12px', fontWeight: 700, color: '#DC2626' }}>{c.val}</span>
                                </div>
                            ))}
                        </div>
                    </Widget>

                    <Widget icon={Globe} iconBg="#DC2626" title="System Analytics" summary="1,248 devices · 4 regions"
                        expanded={expanded === 'sa-analytics'} onClick={() => toggle('sa-analytics')}>
                        <div style={{ paddingTop: '10px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                            <StatPill icon="📡" value="1,248" label="Devices" color="#2563EB" />
                            <StatPill icon="✅" value="1,048" label="Online" color="#16A34A" />
                            <StatPill icon="⚠️" value="38" label="Critical" color="#EF4444" />
                            <StatPill icon="💤" value="20" label="Offline" color="#94A3B8" />
                        </div>
                    </Widget>

                    <Widget icon={FileText} iconBg="#DC2626" title="System Logs" summary="Recent login & device events"
                        expanded={expanded === 'sa-logs'} onClick={() => toggle('sa-logs')}>
                        <div style={{ paddingTop: '10px' }}>
                            {[
                                { user: 'Arjun Reddy', action: 'Logged in', time: '2m ago' },
                                { user: 'Priya Sharma', action: 'Logged in', time: '15m ago' },
                                { user: 'ET-001', action: 'Connected', time: '1m ago' },
                                { user: 'EF-002', action: 'Signal weak', time: '5m ago' },
                                { user: 'Firmware v2.4', action: 'Pushed', time: '6h ago' },
                            ].map((l, i) => (
                                <Row key={i} label={l.user} sub={l.action} right={<span style={{ fontSize: '10px', color: '#94A3B8' }}>{l.time}</span>} />
                            ))}
                        </div>
                    </Widget>

                    <Widget icon={Monitor} iconBg="#DC2626" title="Device Overview" summary="Health & distribution"
                        expanded={expanded === 'sa-overview'} onClick={() => toggle('sa-overview')}>
                        <div style={{ paddingTop: '10px' }}>
                            {distributors.map((d, i) => (
                                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid #F8FAFC', fontSize: '12px' }}>
                                    <span style={{ color: '#475569' }}>{d.name}</span>
                                    <span style={{ fontWeight: 700, color: '#2563EB' }}>{d.nodes} nodes</span>
                                </div>
                            ))}
                        </div>
                    </Widget>
                </>)}

                {/* ════════ DISTRIBUTOR ════════ */}
                {activeTab === 'Distributor' && (<>
                    <Widget icon={Users} iconBg="#2563EB" title="Manage Entities" summary="120 customers · 3 locations · 5 techs"
                        expanded={expanded === 'dt-entity'} onClick={() => toggle('dt-entity')}>
                        <div style={{ paddingTop: '10px' }}>
                            {[
                                { name: 'Sunrise Apartments', sub: 'Residential · 3 dev' },
                                { name: 'TechPark Office', sub: 'Commercial · 8 dev' },
                                { name: 'Green Valley', sub: 'Residential · 12 dev' },
                            ].map((c, i) => <Row key={i} label={c.name} sub={c.sub} dot="#22C55E" />)}
                        </div>
                    </Widget>

                    <Widget icon={Key} iconBg="#2563EB" title="Device Assignment" summary="Assign & register devices"
                        expanded={expanded === 'dt-assign'} onClick={() => toggle('dt-assign')}>
                        <div style={{ paddingTop: '10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <select style={{ width: '100%', padding: '6px 8px', border: '1px solid #E2E8F0', borderRadius: '8px', fontSize: '12px', background: '#F8FAFC' }}>
                                <option>Select Device...</option>
                            </select>
                            <select style={{ width: '100%', padding: '6px 8px', border: '1px solid #E2E8F0', borderRadius: '8px', fontSize: '12px', background: '#F8FAFC' }}>
                                <option>Select Customer...</option>
                            </select>
                            <button style={{ padding: '7px', background: '#2563EB', color: '#FFF', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>Assign</button>
                        </div>
                    </Widget>

                    <Widget icon={Monitor} iconBg="#2563EB" title="Device Analytics" summary="48 deployed · 42 online"
                        expanded={expanded === 'dt-analytics'} onClick={() => toggle('dt-analytics')}>
                        <div style={{ paddingTop: '10px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                            <StatPill icon="📡" value="48" label="Deployed" color="#2563EB" />
                            <StatPill icon="✅" value="42" label="Online" color="#16A34A" />
                            <StatPill icon="⚠️" value="3" label="Alerts" color="#EF4444" />
                            <StatPill icon="💚" value="87%" label="Health" color="#059669" />
                        </div>
                    </Widget>

                    <Widget icon={Bell} iconBg="#EF4444" title="Alerts" summary="3 active alerts"
                        expanded={expanded === 'dt-alerts'} onClick={() => toggle('dt-alerts')}>
                        <div style={{ paddingTop: '10px' }}>
                            {[
                                { icon: '🚨', title: 'ET-003 offline', time: '5m ago' },
                                { icon: '⚠️', title: 'EF-002 flow spike', time: '20m ago' },
                                { icon: '✅', title: 'ET-001 back online', time: '2h ago' },
                            ].map((a, i) => (
                                <Row key={i} label={`${a.icon} ${a.title}`} sub="" right={<span style={{ fontSize: '10px', color: '#94A3B8' }}>{a.time}</span>} />
                            ))}
                        </div>
                    </Widget>

                    <Widget icon={FileText} iconBg="#2563EB" title="Export Reports" summary="PDF & Excel reports"
                        expanded={expanded === 'dt-reports'} onClick={() => toggle('dt-reports')}>
                        <div style={{ paddingTop: '10px' }}>
                            {['Daily Usage (PDF)', 'Weekly Health (Excel)', 'Alert Summary (PDF)', 'Customer Report (Excel)'].map((r, i) => (
                                <div key={i} style={{ padding: '5px 0', borderBottom: '1px solid #F8FAFC', fontSize: '12px', color: '#475569', display: 'flex', justifyContent: 'space-between' }}>
                                    <span>{r}</span>
                                    <span style={{ fontSize: '10px', color: '#2563EB', fontWeight: 600, cursor: 'pointer' }}>↓</span>
                                </div>
                            ))}
                        </div>
                    </Widget>

                    <Widget icon={Shield} iconBg="#2563EB" title="Installation Status" summary="5 deployments tracked"
                        expanded={expanded === 'dt-install'} onClick={() => toggle('dt-install')}>
                        <div style={{ paddingTop: '10px' }}>
                            {[
                                { device: 'ET-006', status: 'Completed', color: '#16A34A' },
                                { device: 'EF-007', status: 'In Progress', color: '#2563EB' },
                                { device: 'ED-008', status: 'Scheduled', color: '#D97706' },
                                { device: 'ET-009', status: 'Completed', color: '#16A34A' },
                            ].map((r, i) => (
                                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid #F8FAFC' }}>
                                    <span style={{ fontSize: '12px', fontWeight: 600, color: '#2563EB' }}>{r.device}</span>
                                    <span style={{ fontSize: '10px', fontWeight: 700, color: r.color }}>{r.status}</span>
                                </div>
                            ))}
                        </div>
                    </Widget>
                </>)}

                {/* ════════ CUSTOMER ════════ */}
                {activeTab === 'Customer' && (<>
                    <Widget icon={Key} iconBg="#16A34A" title="Login Method" summary="Mobile OTP · Email active"
                        expanded={expanded === 'cu-login'} onClick={() => toggle('cu-login')}>
                        <div style={{ paddingTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {[{ icon: '📱', label: 'Mobile OTP', sub: 'SMS-based' }, { icon: '📧', label: 'Email', sub: 'Password / magic link' }].map((m, i) => (
                                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#F0FDF4', borderRadius: '10px', padding: '10px', border: '1px solid #BBF7D0' }}>
                                    <span style={{ fontSize: '20px' }}>{m.icon}</span>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontWeight: 700, fontSize: '12px', color: '#166534' }}>{m.label}</div>
                                        <div style={{ fontSize: '10px', color: '#64748B' }}>{m.sub}</div>
                                    </div>
                                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#22C55E' }} />
                                </div>
                            ))}
                        </div>
                    </Widget>

                    <Widget icon={Monitor} iconBg="#16A34A" title="My Devices" summary="3 registered · 2 online"
                        expanded={expanded === 'cu-devices'} onClick={() => toggle('cu-devices')}>
                        <div style={{ paddingTop: '10px' }}>
                            {[
                                { name: 'Kitchen Tank', id: 'ET-001', status: 'Online', health: 98, val: '72%' },
                                { name: 'Main Line Flow', id: 'EF-002', status: 'Online', health: 91, val: '245 L/hr' },
                                { name: 'Borewell', id: 'ED-003', status: 'Alert', health: 67, val: '185m' },
                            ].map((d, i) => (
                                <div key={i} style={{ background: '#F8FAFC', borderRadius: '10px', padding: '8px 10px', marginBottom: '6px', border: '1px solid #E2E8F0' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                                        <span style={{ fontWeight: 700, fontSize: '12px', color: '#1E293B' }}>{d.name}</span>
                                        <span style={{ fontSize: '9px', fontWeight: 700, padding: '1px 6px', borderRadius: '4px', background: d.status === 'Online' ? '#DCFCE7' : '#FEE2E2', color: d.status === 'Online' ? '#16A34A' : '#DC2626' }}>{d.status}</span>
                                    </div>
                                    <div style={{ fontSize: '10px', color: '#94A3B8' }}>{d.id} · Health {d.health}%</div>
                                    <div style={{ fontSize: '16px', fontWeight: 800, color: '#16A34A', marginTop: '2px' }}>{d.val}</div>
                                </div>
                            ))}
                        </div>
                    </Widget>

                    <Widget icon={Database} iconBg="#0EA5E9" title="Consumption" summary="1,820 L today · ₹2,430 est."
                        expanded={expanded === 'cu-consumption'} onClick={() => toggle('cu-consumption')}>
                        <div style={{ paddingTop: '10px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                            <StatPill icon="💧" value="1,820 L" label="Today" color="#0EA5E9" />
                            <StatPill icon="📊" value="12.4K" label="Week" color="#2563EB" />
                            <StatPill icon="📈" value="48.6K" label="Month" color="#7C3AED" />
                            <StatPill icon="💰" value="₹2,430" label="Cost" color="#D97706" />
                        </div>
                    </Widget>

                    <Widget icon={FileText} iconBg="#7C3AED" title="Historical Trends" summary="Last 7 days usage data"
                        expanded={expanded === 'cu-trends'} onClick={() => toggle('cu-trends')}>
                        <div style={{ paddingTop: '10px' }}>
                            {[
                                { date: '12 Feb', usage: '2,450 L', trend: '↑ +3%', c: '#16A34A' },
                                { date: '11 Feb', usage: '2,320 L', trend: '↑ +1%', c: '#16A34A' },
                                { date: '10 Feb', usage: '2,580 L', trend: '↓ -2%', c: '#DC2626' },
                                { date: '9 Feb', usage: '2,400 L', trend: '→ 0%', c: '#64748B' },
                                { date: '8 Feb', usage: '2,200 L', trend: '↑ +5%', c: '#16A34A' },
                            ].map((r, i) => (
                                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid #F8FAFC', fontSize: '12px' }}>
                                    <span style={{ color: '#1E293B', fontWeight: 600 }}>{r.date}</span>
                                    <span style={{ color: '#475569' }}>{r.usage}</span>
                                    <span style={{ fontWeight: 700, color: r.c }}>{r.trend}</span>
                                </div>
                            ))}
                        </div>
                    </Widget>

                    <Widget icon={Bell} iconBg="#EF4444" title="Alerts" summary="2 active notifications"
                        expanded={expanded === 'cu-alerts'} onClick={() => toggle('cu-alerts')}>
                        <div style={{ paddingTop: '10px' }}>
                            {[
                                { icon: '⚠️', title: 'Low Tank Level', msg: 'Below 30%', time: '15m' },
                                { icon: '🚨', title: 'Abnormal Flow', msg: '42 L/min', time: '1h' },
                                { icon: 'ℹ️', title: 'Maintenance', msg: '14 Feb', time: '3h' },
                                { icon: '✅', title: 'Tank Refilled', msg: '95%', time: 'Yday' },
                            ].map((a, i) => (
                                <Row key={i} label={`${a.icon} ${a.title}`} sub={a.msg} right={<span style={{ fontSize: '10px', color: '#94A3B8' }}>{a.time}</span>} />
                            ))}
                        </div>
                    </Widget>

                    <Widget icon={FileText} iconBg="#16A34A" title="Reports" summary="Download usage reports"
                        expanded={expanded === 'cu-reports'} onClick={() => toggle('cu-reports')}>
                        <div style={{ paddingTop: '10px' }}>
                            {['Daily Usage (PDF)', 'Weekly Consumption (Excel)', 'Monthly Summary (PDF)', 'Alert History (Excel)', 'Device Health (PDF)'].map((r, i) => (
                                <div key={i} style={{ padding: '5px 0', borderBottom: '1px solid #F8FAFC', fontSize: '12px', color: '#475569', display: 'flex', justifyContent: 'space-between' }}>
                                    <span>{r}</span>
                                    <span style={{ fontSize: '10px', color: '#16A34A', fontWeight: 600, cursor: 'pointer' }}>↓</span>
                                </div>
                            ))}
                        </div>
                    </Widget>
                </>)}
            </div>
        </div>
    );
};

export default Admin;
