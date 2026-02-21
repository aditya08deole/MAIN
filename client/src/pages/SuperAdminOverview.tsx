import { useState } from 'react';
import {
    Users, User, Network, RefreshCw, Eye, Plus, Trash2, ChevronRight,
    Home, Shield, Activity, AlertCircle,
    MapPin, Zap, Radio
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Navigate } from 'react-router-dom';
import { useCommunities } from '../hooks/useCommunities';
import AddCommunityForm from '../components/AddCommunityForm';
import AddCustomerForm from '../components/AddCustomerForm';
import AddDeviceForm from '../components/AddDeviceForm';

// ─── Types ────────────────────────────────────────────────────────────────────

type View = 'home' | 'addNode';

interface AuditEntry {
    id: number;
    action: string;
    time: string;
    type: 'success' | 'warning' | 'info' | 'error';
}

// ─── Mock Data ────────────────────────────────────────────────────────────────

const INITIAL_AUDIT: AuditEntry[] = [];

// ─── Live Audit Trail Sidebar ─────────────────────────────────────────────────

const AuditTrail = ({ entries, onRefresh }: { entries: AuditEntry[]; onRefresh: () => void }) => (
    <div className="w-72 flex-shrink-0 bg-white border border-slate-200 rounded-2xl shadow-sm flex flex-col overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <div>
                <h3 className="text-sm font-bold text-slate-800">Live Audit Trail</h3>
                <p className="text-[10px] text-slate-400 mt-0.5">All system actions logged here</p>
            </div>
            <button
                onClick={onRefresh}
                className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-blue-500 transition-colors"
                title="Refresh"
            >
                <RefreshCw size={14} />
            </button>
        </div>
        <div className="flex-1 overflow-y-auto p-3">
            {entries.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center py-12">
                    <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center mb-3">
                        <Activity size={18} className="text-slate-300" />
                    </div>
                    <p className="text-xs font-semibold text-slate-400">No recent activity.</p>
                    <p className="text-[10px] text-slate-300 mt-0.5">Actions will appear here.</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {entries.map(e => (
                        <div key={e.id} className="flex items-start gap-2.5 p-2.5 bg-slate-50 rounded-xl">
                            <div className={`mt-0.5 w-1.5 h-1.5 rounded-full flex-shrink-0 ${e.type === 'success' ? 'bg-green-500' :
                                e.type === 'warning' ? 'bg-amber-500' :
                                    e.type === 'error' ? 'bg-red-500' : 'bg-blue-500'
                                }`} />
                            <div className="flex-1 min-w-0">
                                <p className="text-[11px] font-semibold text-slate-700 leading-tight">{e.action}</p>
                                <p className="text-[10px] text-slate-400 mt-0.5">{e.time}</p>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    </div>
);

// ─── Stat Card ────────────────────────────────────────────────────────────────

const StatCard = ({ icon: Icon, label, count, accent }: {
    icon: React.ElementType;
    label: string;
    count: number;
    accent: string;
}) => (
    <div className={`flex-1 bg-white border-2 ${accent} rounded-2xl p-5 shadow-sm`}>
        <div className="flex items-center gap-2 mb-3">
            <Icon size={16} className="text-slate-500" />
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{label}</span>
        </div>
        <div className="text-4xl font-extrabold text-slate-800">{count}</div>
    </div>
);

// ─── Section Header ───────────────────────────────────────────────────────────

const SectionLabel = ({ label, action }: { label: string; action?: React.ReactNode }) => (
    <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50 border-b border-slate-100">
        <span className="text-[10px] font-extrabold text-blue-600 uppercase tracking-widest">{label}</span>
        {action}
    </div>
);

// ─── Row Item ─────────────────────────────────────────────────────────────────

const RowItem = ({ label, actions }: { label: string; actions: React.ReactNode }) => (
    <div className="flex items-center justify-between px-4 py-3.5 hover:bg-slate-50 transition-colors border-b border-slate-50 last:border-0">
        <span className="text-sm font-semibold text-slate-700">{label}</span>
        <div className="flex items-center gap-3">{actions}</div>
    </div>
);

// ─── Action Buttons ───────────────────────────────────────────────────────────

const BtnAdd = ({ onClick }: { onClick?: () => void }) => (
    <button onClick={onClick} className="flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-700 transition-colors">
        <Plus size={13} /> Add
    </button>
);

const BtnView = ({ onClick }: { onClick?: () => void }) => (
    <button onClick={onClick} className="flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-slate-700 transition-colors">
        <Eye size={13} /> View
    </button>
);

const BtnDelete = ({ onClick }: { onClick?: () => void }) => (
    <button onClick={onClick} className="flex items-center gap-1 text-xs font-bold text-red-500 hover:text-red-600 transition-colors">
        <Trash2 size={13} /> Delete
    </button>
);

// ─── Toggle Switch ────────────────────────────────────────────────────────────

const Toggle = ({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) => (
    <label className="flex items-center gap-2 cursor-pointer select-none">
        <div
            onClick={() => onChange(!checked)}
            className={`relative w-9 h-5 rounded-full transition-colors ${checked ? 'bg-blue-500' : 'bg-slate-200'}`}
        >
            <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${checked ? 'translate-x-4' : ''}`} />
        </div>
        <span className="text-xs font-semibold text-slate-600">{label}</span>
    </label>
);

// ─── Add Node Form ────────────────────────────────────────────────────────────

const AddNodeForm = ({ onBack, onDeploy }: { onBack: () => void; onDeploy: (name: string) => void }) => {
    const [nodeName, setNodeName] = useState('');
    const [location, setLocation] = useState('');
    const [coords, setCoords] = useState('17.4449,78.3498');
    const [samplingRate, setSamplingRate] = useState('60');
    const [critLow, setCritLow] = useState('20');
    const [critHigh, setCritHigh] = useState('90');
    const [active, setActive] = useState(true);
    const [smsAlerts, setSmsAlerts] = useState(false);
    const [showDashboard, setShowDashboard] = useState(true);
    const [invertLogic, setInvertLogic] = useState(false);
    const [channelId, setChannelId] = useState('');
    const [apiKey, setApiKey] = useState('');
    const [fieldMap, setFieldMap] = useState('');

    const inputCls = "w-full px-3 py-2.5 text-sm bg-white border border-slate-200 rounded-xl text-slate-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all placeholder:text-slate-300";
    const labelCls = "block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5";

    return (
        <div className="flex-1 overflow-y-auto">
            {/* Breadcrumb */}
            <div className="flex items-center gap-2 mb-5 text-xs text-slate-500">
                <button onClick={onBack} className="flex items-center gap-1 hover:text-blue-600 transition-colors font-semibold">
                    <Home size={13} /> Home
                </button>
                <ChevronRight size={13} />
                <span className="text-slate-700 font-bold">Add Node</span>
            </div>

            <h2 className="text-xl font-extrabold text-slate-800 mb-1">Provision New Node</h2>
            <p className="text-xs text-slate-400 mb-6">Fill in the details to add a new monitoring node</p>

            <div className="space-y-4">
                {/* 01. Identity */}
                <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                    <div className="flex items-center gap-2 px-5 py-3.5 border-b border-slate-100 bg-slate-50">
                        <MapPin size={14} className="text-blue-500" />
                        <span className="text-[10px] font-extrabold text-blue-600 uppercase tracking-widest">01. Identity</span>
                    </div>
                    <div className="p-5 grid grid-cols-2 gap-4">
                        <div>
                            <label className={labelCls}>Node Name *</label>
                            <input value={nodeName} onChange={e => setNodeName(e.target.value)} placeholder="e.g. Tank Monitor 01" className={inputCls} />
                        </div>
                        <div>
                            <label className={labelCls}>Location</label>
                            <input value={location} onChange={e => setLocation(e.target.value)} placeholder="e.g. Building A" className={inputCls} />
                        </div>
                        <div>
                            <label className={labelCls}>Coordinates (lat, lng)</label>
                            <input value={coords} onChange={e => setCoords(e.target.value)} className={inputCls} />
                        </div>
                        <div>
                            <label className={labelCls}>Sampling Rate (seconds)</label>
                            <input value={samplingRate} onChange={e => setSamplingRate(e.target.value)} type="number" className={inputCls} />
                        </div>
                    </div>
                </div>

                {/* 02. Thresholds & Alerts */}
                <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                    <div className="flex items-center gap-2 px-5 py-3.5 border-b border-slate-100 bg-slate-50">
                        <AlertCircle size={14} className="text-blue-500" />
                        <span className="text-[10px] font-extrabold text-blue-600 uppercase tracking-widest">02. Thresholds & Alerts</span>
                    </div>
                    <div className="p-5">
                        <div className="grid grid-cols-2 gap-4 mb-5">
                            <div>
                                <label className={labelCls}>Critical Low (%)</label>
                                <input value={critLow} onChange={e => setCritLow(e.target.value)} type="number" className={inputCls} />
                            </div>
                            <div>
                                <label className={labelCls}>Critical High (%)</label>
                                <input value={critHigh} onChange={e => setCritHigh(e.target.value)} type="number" className={inputCls} />
                            </div>
                        </div>
                        <div className="flex flex-wrap gap-6">
                            <Toggle checked={active} onChange={setActive} label="Active" />
                            <Toggle checked={smsAlerts} onChange={setSmsAlerts} label="SMS Alerts" />
                            <Toggle checked={showDashboard} onChange={setShowDashboard} label="Show Dashboard" />
                            <Toggle checked={invertLogic} onChange={setInvertLogic} label="Invert Logic" />
                        </div>
                    </div>
                </div>

                {/* 03. Source — ThingSpeak Channel */}
                <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                    <div className="flex items-center gap-2 px-5 py-3.5 border-b border-slate-100 bg-slate-50">
                        <Radio size={14} className="text-blue-500" />
                        <span className="text-[10px] font-extrabold text-blue-600 uppercase tracking-widest">Source #1 — ThingSpeak Channel</span>
                    </div>
                    <div className="p-5 space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className={labelCls}>Channel ID *</label>
                                <input value={channelId} onChange={e => setChannelId(e.target.value)} placeholder="e.g. 123456" className={inputCls} />
                            </div>
                            <div>
                                <label className={labelCls}>Read API Key *</label>
                                <div className="flex gap-2">
                                    <input value={apiKey} onChange={e => setApiKey(e.target.value)} type="password" placeholder="••••••••" className={`${inputCls} flex-1`} />
                                    <button className="px-4 py-2.5 bg-blue-600 text-white text-xs font-bold rounded-xl hover:bg-blue-700 transition-colors">
                                        Fetch
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Signal Mapping */}
                        <div>
                            <label className={labelCls}>Signal Mapping</label>
                            <div className="flex items-center gap-3">
                                <span className="text-xs font-bold text-slate-400">#1</span>
                                <select className={`${inputCls} flex-1`} value={fieldMap} onChange={e => setFieldMap(e.target.value)}>
                                    <option value="">Select Field</option>
                                    <option value="field1">Field 1</option>
                                    <option value="field2">Field 2</option>
                                    <option value="field3">Field 3</option>
                                    <option value="field4">Field 4</option>
                                </select>
                                <span className="text-slate-300">→</span>
                                <select className={`${inputCls} flex-1`}>
                                    <option>None / Empty</option>
                                    <option>Water Level</option>
                                    <option>Flow Rate</option>
                                    <option>Pressure</option>
                                    <option>Temperature</option>
                                </select>
                            </div>
                            <button className="mt-2 text-xs font-bold text-blue-600 hover:text-blue-700 transition-colors flex items-center gap-1">
                                <Plus size={12} /> Add Mapping
                            </button>
                        </div>
                    </div>
                </div>

                {/* Add Another Source */}
                <button className="w-full py-3.5 border-2 border-dashed border-slate-200 rounded-2xl text-xs font-bold text-slate-400 hover:border-blue-300 hover:text-blue-500 hover:bg-blue-50 transition-all flex items-center justify-center gap-2">
                    <Plus size={14} /> Add Another Source / Channel
                </button>

                {/* Actions */}
                <div className="flex items-center gap-3 pt-2 pb-6">
                    <button
                        onClick={() => nodeName && onDeploy(nodeName)}
                        className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700 transition-colors shadow-sm hover:shadow-md disabled:opacity-50"
                        disabled={!nodeName}
                    >
                        <Zap size={16} /> Deploy Node
                    </button>
                    <button
                        onClick={onBack}
                        className="px-5 py-3 text-sm font-bold text-slate-500 hover:text-slate-700 transition-colors"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );
};

// ─── Main Component ───────────────────────────────────────────────────────────

const SuperAdminOverview = () => {
    const { user } = useAuth();
    const { communities: dbCommunities } = useCommunities();
    
    const [view, setView] = useState<View>('home');
    const communities = dbCommunities || [];
    const [auditLog, setAuditLog] = useState<AuditEntry[]>(INITIAL_AUDIT);
    const [adminCount] = useState(0);
    const [customerCount] = useState(0);
    const [showCommunityForm, setShowCommunityForm] = useState(false);
    const [showCustomerForm, setShowCustomerForm] = useState(false);
    const [showDeviceForm, setShowDeviceForm] = useState(false);

    if (user?.role !== 'superadmin') {
        return <Navigate to="/dashboard" replace />;
    }

    const addAudit = (action: string, type: AuditEntry['type'] = 'info') => {
        const now = new Date();
        const time = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
        setAuditLog(prev => [{ id: Date.now(), action, time, type }, ...prev].slice(0, 50));
    };

    const handleAddCommunity = () => {
        setShowCommunityForm(true);
        addAudit('Opening add community form', 'info');
    };

    const handleDeleteCommunity = (name: string) => {
        if (!confirm(`Delete "${name}"?`)) return;
        // TODO: Implement delete API
        addAudit(`Community "${name}" deletion requested`, 'warning');
    };

    const handleDeployNode = (name: string) => {
        addAudit(`Node "${name}" deployed`, 'success');
        setView('home');
    };

    const totalNodes = 0; // TODO: Fetch actual node count from API

    return (
        <div className="flex gap-5 p-6 bg-slate-50 min-h-screen">

            {/* ── Main Content ── */}
            <div className="flex-1 flex flex-col min-w-0">

                {/* Page Header */}
                <div className="mb-6">
                    <div className="flex items-center gap-2 mb-1">
                        <Shield size={20} className="text-blue-600" />
                        <h1 className="text-xl font-extrabold text-slate-800 tracking-tight">Super Admin Console</h1>
                    </div>
                    <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">System Configuration & Signal Routing</p>
                </div>

                {view === 'home' ? (
                    <>
                        {/* ── Stat Cards ── */}
                        <div className="flex gap-4 mb-7">
                            <StatCard icon={Users} label="Admins" count={adminCount} accent="border-blue-200" />
                            <StatCard icon={User} label="Customers" count={customerCount} accent="border-pink-200" />
                            <StatCard icon={Network} label="Nodes" count={totalNodes} accent="border-amber-200" />
                        </div>
                        {/* Quick Actions Bar */}
                        <div className="flex gap-3 mb-6">
                            <button
                                onClick={() => { setShowCommunityForm(true); addAudit('Opening community form', 'info'); }}
                                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700 transition-all hover:shadow-lg"
                            >
                                <Plus size={18} /> Add Community
                            </button>
                            <button
                                onClick={() => { setShowCustomerForm(true); addAudit('Opening customer form', 'info'); }}
                                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white text-sm font-bold rounded-xl hover:bg-green-700 transition-all hover:shadow-lg"
                            >
                                <Plus size={18} /> Add Customer
                            </button>
                            <button
                                onClick={() => { setShowDeviceForm(true); addAudit('Opening device form', 'info'); }}
                                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-purple-600 text-white text-sm font-bold rounded-xl hover:bg-purple-700 transition-all hover:shadow-lg"
                            >
                                <Plus size={18} /> Add Device
                            </button>
                        </div>
                        {/* ── Site Administration ── */}
                        <div className="mb-2">
                            <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest mb-3">Site Administration</p>
                        </div>

                        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden space-y-0 divide-y divide-slate-100">

                            {/* Authentication & Authorization */}
                            <div>
                                <SectionLabel label="Authentication & Authorization" />
                                <RowItem
                                    label="Admins"
                                    actions={<>
                                        <BtnAdd onClick={() => addAudit('Admin add initiated', 'info')} />
                                        <BtnView />
                                    </>}
                                />
                                <RowItem
                                    label="Customers"
                                    actions={<>
                                        <BtnAdd onClick={() => { setShowCustomerForm(true); addAudit('Opening customer form', 'info'); }} />
                                        <BtnView />
                                    </>}
                                />
                            </div>

                            {/* Nodes & Communities */}
                            <div>
                                <SectionLabel
                                    label="Nodes & Communities"
                                    action={
                                        <button
                                            onClick={handleAddCommunity}
                                            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-[10px] font-bold rounded-lg hover:bg-blue-700 transition-colors"
                                        >
                                            <Plus size={11} /> Add Community
                                        </button>
                                    }
                                />
                                {communities.length === 0 ? (
                                    <div className="px-4 py-6 text-center text-xs text-slate-400">No communities yet. Add one above.</div>
                                ) : (
                                    communities.map(c => (
                                        <RowItem
                                            key={c.id}
                                            label={c.name}
                                            actions={<>
                                                <BtnAdd onClick={() => { setShowDeviceForm(true); addAudit(`Opening device form for ${c.name}`, 'info'); }} />
                                                <span className="text-[10px] text-slate-300">|</span>
                                                <BtnView />
                                                <span className="text-[10px] text-slate-300">|</span>
                                                <BtnDelete onClick={() => handleDeleteCommunity(c.name)} />
                                            </>}
                                        />
                                    ))
                                )}
                            </div>

                            {/* Data */}
                            <div>
                                <SectionLabel label="Data" />
                                <RowItem
                                    label="10 Minute Data"
                                    actions={<BtnView onClick={() => addAudit('Viewed 10-min data', 'info')} />}
                                />
                                <RowItem
                                    label="Hourly Data"
                                    actions={<BtnView onClick={() => addAudit('Viewed hourly data', 'info')} />}
                                />
                                <RowItem
                                    label="Daily Reports"
                                    actions={<BtnView onClick={() => addAudit('Viewed daily reports', 'info')} />}
                                />
                            </div>

                            {/* System */}
                            <div>
                                <SectionLabel label="System" />
                                <RowItem
                                    label="Device Firmware"
                                    actions={<>
                                        <BtnView />
                                        <BtnAdd />
                                    </>}
                                />
                                <RowItem
                                    label="Alert Rules"
                                    actions={<>
                                        <BtnView />
                                        <BtnAdd />
                                    </>}
                                />
                            </div>
                        </div>
                    </>
                ) : (
                    <AddNodeForm
                        onBack={() => setView('home')}
                        onDeploy={handleDeployNode}
                    />
                )}
            </div>

            {/* ── Audit Trail Sidebar ── */}
            <AuditTrail
                entries={auditLog}
                onRefresh={() => addAudit('Audit trail refreshed', 'info')}
            />

            {/* ── Form Modals ── */}
            {showCommunityForm && (
                <AddCommunityForm
                    onClose={() => setShowCommunityForm(false)}
                    onSuccess={() => addAudit('Community added successfully', 'success')}
                />
            )}
            {showCustomerForm && (
                <AddCustomerForm
                    onClose={() => setShowCustomerForm(false)}
                    onSuccess={() => addAudit('Customer added successfully', 'success')}
                />
            )}
            {showDeviceForm && (
                <AddDeviceForm
                    onClose={() => setShowDeviceForm(false)}
                    onSuccess={() => addAudit('Device added successfully', 'success')}
                />
            )}
        </div>
    );
};

export default SuperAdminOverview;
