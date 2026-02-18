import { useState } from 'react';
import { Search, Filter, Droplets, Waves, Gauge, MapPin, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';

// ─── Node registry — every asset from the map ───────────────────────────────

type NodeCategory = 'OHT' | 'Sump' | 'Borewell' | 'GovtBorewell' | 'PumpHouse';
type AnalyticsType = 'EvaraTank' | 'EvaraDeep' | 'EvaraFlow';

interface NodeRecord {
    id: string;
    name: string;
    category: NodeCategory;
    analytics: AnalyticsType;
    location: string;
    capacity: string;
    status: 'Online' | 'Offline';
}

const ALL_NODES: NodeRecord[] = [
    // ── Pump Houses → EvaraFlow ──
    { id: 'PH-01', name: 'Pump House 1', category: 'PumpHouse', analytics: 'EvaraFlow', location: 'ATM Gate', capacity: '4.98L L', status: 'Online' },
    { id: 'PH-02', name: 'Pump House 2', category: 'PumpHouse', analytics: 'EvaraFlow', location: 'Guest House', capacity: '75k L', status: 'Online' },
    { id: 'PH-03', name: 'Pump House 3', category: 'PumpHouse', analytics: 'EvaraFlow', location: 'Staff Qtrs', capacity: '55k L', status: 'Online' },
    { id: 'PH-04', name: 'Pump House 4', category: 'PumpHouse', analytics: 'EvaraFlow', location: 'Bakul', capacity: '2.00L L', status: 'Online' },

    // ── Sumps → EvaraTank ──
    { id: 'SUMP-S1',  name: 'Sump S1',  category: 'Sump', analytics: 'EvaraTank', location: 'Bakul',       capacity: '2.00L L',    status: 'Online' },
    { id: 'SUMP-S2',  name: 'Sump S2',  category: 'Sump', analytics: 'EvaraTank', location: 'Palash',      capacity: '1.10L L',    status: 'Online' },
    { id: 'SUMP-S3',  name: 'Sump S3',  category: 'Sump', analytics: 'EvaraTank', location: 'NBH',         capacity: '1.00L L',    status: 'Online' },
    { id: 'SUMP-S4',  name: 'Sump S4',  category: 'Sump', analytics: 'EvaraTank', location: 'Central',     capacity: '4.98L L',    status: 'Online' },
    { id: 'SUMP-S5',  name: 'Sump S5',  category: 'Sump', analytics: 'EvaraTank', location: 'Blk A&B',     capacity: '55k L',      status: 'Online' },
    { id: 'SUMP-S6',  name: 'Sump S6',  category: 'Sump', analytics: 'EvaraTank', location: 'Guest House', capacity: '10k L',      status: 'Online' },
    { id: 'SUMP-S7',  name: 'Sump S7',  category: 'Sump', analytics: 'EvaraTank', location: 'Pump House',  capacity: '43k L',      status: 'Online' },
    { id: 'SUMP-S8',  name: 'Sump S8',  category: 'Sump', analytics: 'EvaraTank', location: 'Football',    capacity: '12k L',      status: 'Online' },
    { id: 'SUMP-S9',  name: 'Sump S9',  category: 'Sump', analytics: 'EvaraTank', location: 'Felicity',    capacity: '15k L',      status: 'Online' },
    { id: 'SUMP-S10', name: 'Sump S10', category: 'Sump', analytics: 'EvaraTank', location: 'FSQ A&B',     capacity: '34k+31k',    status: 'Online' },
    { id: 'SUMP-S11', name: 'Sump S11', category: 'Sump', analytics: 'EvaraTank', location: 'FSQ C,D,E',   capacity: '1.5L+60k',   status: 'Online' },

    // ── Overhead Tanks → EvaraTank ──
    { id: 'OHT-1',  name: 'Bakul OHT',           category: 'OHT', analytics: 'EvaraTank', location: 'Bakul',       capacity: '2 Units',  status: 'Online' },
    { id: 'OHT-2',  name: 'Parijat OHT',          category: 'OHT', analytics: 'EvaraTank', location: 'Parijat',     capacity: '2 Units',  status: 'Online' },
    { id: 'OHT-3',  name: 'Kadamba OHT',           category: 'OHT', analytics: 'EvaraTank', location: 'Kadamba',     capacity: '2 Units',  status: 'Online' },
    { id: 'OHT-4',  name: 'NWH Block C OHT',       category: 'OHT', analytics: 'EvaraTank', location: 'NWH Block C', capacity: '1 Unit',   status: 'Online' },
    { id: 'OHT-5',  name: 'NWH Block B OHT',       category: 'OHT', analytics: 'EvaraTank', location: 'NWH Block B', capacity: '1 Unit',   status: 'Online' },
    { id: 'OHT-6',  name: 'NWH Block A OHT',       category: 'OHT', analytics: 'EvaraTank', location: 'NWH Block A', capacity: '1 Unit',   status: 'Online' },
    { id: 'OHT-7',  name: 'Palash Nivas OHT',      category: 'OHT', analytics: 'EvaraTank', location: 'Palash Nivas', capacity: '4 Units', status: 'Online' },
    { id: 'OHT-8',  name: 'Anand Nivas OHT',       category: 'OHT', analytics: 'EvaraTank', location: 'Anand Nivas', capacity: '2 Units',  status: 'Online' },
    { id: 'OHT-9',  name: 'Budha Nivas OHT',       category: 'OHT', analytics: 'EvaraTank', location: 'Budha Nivas', capacity: '2 Units',  status: 'Online' },
    { id: 'OHT-10', name: 'C Block OHT',            category: 'OHT', analytics: 'EvaraTank', location: 'C Block',     capacity: '3 Units',  status: 'Online' },
    { id: 'OHT-11', name: 'D Block OHT',            category: 'OHT', analytics: 'EvaraTank', location: 'D Block',     capacity: '3 Units',  status: 'Online' },
    { id: 'OHT-12', name: 'E Block OHT',            category: 'OHT', analytics: 'EvaraTank', location: 'E Block',     capacity: '3 Units',  status: 'Online' },
    { id: 'OHT-13', name: 'Vindhya OHT',            category: 'OHT', analytics: 'EvaraTank', location: 'Vindhya',     capacity: 'Mixed',    status: 'Online' },
    { id: 'OHT-14', name: 'Himalaya OHT (KRB)',     category: 'OHT', analytics: 'EvaraTank', location: 'Himalaya',    capacity: 'Borewell', status: 'Online' },

    // ── IIIT Borewells → EvaraDeep ──
    { id: 'BW-P1',   name: 'Borewell P1',   category: 'Borewell',     analytics: 'EvaraDeep', location: 'Block C,D,E', capacity: '5 HP',       status: 'Offline' },
    { id: 'BW-P2',   name: 'Borewell P2',   category: 'Borewell',     analytics: 'EvaraDeep', location: 'Agri Farm',   capacity: '12.5 HP',    status: 'Offline' },
    { id: 'BW-P3',   name: 'Borewell P3',   category: 'Borewell',     analytics: 'EvaraDeep', location: 'Palash',      capacity: '5 HP',       status: 'Offline' },
    { id: 'BW-P4',   name: 'Borewell P4',   category: 'Borewell',     analytics: 'EvaraDeep', location: 'Vindhya',     capacity: '--',         status: 'Offline' },
    { id: 'BW-P5',   name: 'Borewell P5',   category: 'Borewell',     analytics: 'EvaraDeep', location: 'Nilgiri',     capacity: '5 HP',       status: 'Online' },
    { id: 'BW-P6',   name: 'Borewell P6',   category: 'Borewell',     analytics: 'EvaraDeep', location: 'Bakul',       capacity: '5/7.5 HP',   status: 'Offline' },
    { id: 'BW-P7',   name: 'Borewell P7',   category: 'Borewell',     analytics: 'EvaraDeep', location: 'Volleyball',  capacity: 'N/A',        status: 'Offline' },
    { id: 'BW-P8',   name: 'Borewell P8',   category: 'Borewell',     analytics: 'EvaraDeep', location: 'Palash',      capacity: '7.5 HP',     status: 'Online' },
    { id: 'BW-P9',   name: 'Borewell P9',   category: 'Borewell',     analytics: 'EvaraDeep', location: 'Girls Blk A', capacity: '7.5 HP',     status: 'Online' },
    { id: 'BW-P10',  name: 'Borewell P10',  category: 'Borewell',     analytics: 'EvaraDeep', location: 'Parking NW',  capacity: '5 HP',       status: 'Online' },
    { id: 'BW-P10A', name: 'Borewell P10A', category: 'Borewell',     analytics: 'EvaraDeep', location: 'Agri Farm',   capacity: '--',         status: 'Offline' },
    { id: 'BW-P11',  name: 'Borewell P11',  category: 'Borewell',     analytics: 'EvaraDeep', location: 'Blk C,D,E',  capacity: '5 HP',       status: 'Offline' },

    // ── Govt Borewells → EvaraDeep ──
    { id: 'BW-G1', name: 'Govt Borewell 1', category: 'GovtBorewell', analytics: 'EvaraDeep', location: 'Palash',        capacity: '5 HP',   status: 'Offline' },
    { id: 'BW-G2', name: 'Govt Borewell 2', category: 'GovtBorewell', analytics: 'EvaraDeep', location: 'Palash',        capacity: '1.5 HP', status: 'Offline' },
    { id: 'BW-G3', name: 'Govt Borewell 3', category: 'GovtBorewell', analytics: 'EvaraDeep', location: 'Vindhaya C4',   capacity: '5 HP',   status: 'Online' },
    { id: 'BW-G4', name: 'Govt Borewell 4', category: 'GovtBorewell', analytics: 'EvaraDeep', location: 'Entrance',      capacity: 'N/A',    status: 'Offline' },
    { id: 'BW-G5', name: 'Govt Borewell 5', category: 'GovtBorewell', analytics: 'EvaraDeep', location: 'Entrance',      capacity: 'N/A',    status: 'Offline' },
    { id: 'BW-G6', name: 'Govt Borewell 6', category: 'GovtBorewell', analytics: 'EvaraDeep', location: 'Bamboo House',  capacity: 'N/A',    status: 'Offline' },
    { id: 'BW-G7', name: 'Govt Borewell 7', category: 'GovtBorewell', analytics: 'EvaraDeep', location: 'Football',      capacity: 'N/A',    status: 'Offline' },
];

// ─── Category config ─────────────────────────────────────────────────────────

const CATEGORY_CONFIG: Record<NodeCategory, {
    label: string;
    icon: React.ReactNode;
    color: string;
    bg: string;
    badge: string;
    dot: string;
}> = {
    OHT: {
        label: 'Overhead Tank',
        icon: <Droplets size={20} />,
        color: 'text-blue-600',
        bg: 'bg-blue-50',
        badge: 'bg-blue-100 text-blue-700',
        dot: 'bg-blue-500',
    },
    Sump: {
        label: 'Sump',
        icon: <Waves size={20} />,
        color: 'text-emerald-600',
        bg: 'bg-emerald-50',
        badge: 'bg-emerald-100 text-emerald-700',
        dot: 'bg-emerald-500',
    },
    Borewell: {
        label: 'Borewell (IIIT)',
        icon: (
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="5" r="2" /><line x1="12" y1="7" x2="12" y2="20" />
                <line x1="9" y1="11" x2="12" y2="14" /><line x1="15" y1="11" x2="12" y2="14" />
            </svg>
        ),
        color: 'text-amber-600',
        bg: 'bg-amber-50',
        badge: 'bg-amber-100 text-amber-700',
        dot: 'bg-amber-500',
    },
    GovtBorewell: {
        label: 'Borewell (Govt)',
        icon: (
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="5" r="2" /><line x1="12" y1="7" x2="12" y2="20" />
                <line x1="9" y1="11" x2="12" y2="14" /><line x1="15" y1="11" x2="12" y2="14" />
            </svg>
        ),
        color: 'text-slate-600',
        bg: 'bg-slate-100',
        badge: 'bg-slate-200 text-slate-700',
        dot: 'bg-slate-500',
    },
    PumpHouse: {
        label: 'Pump House',
        icon: <Gauge size={20} />,
        color: 'text-purple-600',
        bg: 'bg-purple-50',
        badge: 'bg-purple-100 text-purple-700',
        dot: 'bg-purple-500',
    },
};

const ANALYTICS_CONFIG: Record<AnalyticsType, {
    label: string;
    desc: string;
    icon: React.ReactNode;
    activeBg: string;
    activeText: string;
    activeBorder: string;
    badge: string;
    dot: string;
}> = {
    EvaraTank: {
        label: 'EvaraTank',
        desc: 'OHTs & Sumps',
        icon: <Droplets size={16} />,
        activeBg: 'bg-indigo-600',
        activeText: 'text-white',
        activeBorder: 'border-indigo-600',
        badge: 'bg-indigo-50 text-indigo-600 border border-indigo-200',
        dot: 'bg-indigo-500',
    },
    EvaraDeep: {
        label: 'EvaraDeep',
        desc: 'Borewells',
        icon: (
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="5" r="2" /><line x1="12" y1="7" x2="12" y2="20" />
                <line x1="9" y1="11" x2="12" y2="14" /><line x1="15" y1="11" x2="12" y2="14" />
            </svg>
        ),
        activeBg: 'bg-sky-600',
        activeText: 'text-white',
        activeBorder: 'border-sky-600',
        badge: 'bg-sky-50 text-sky-700 border border-sky-200',
        dot: 'bg-sky-500',
    },
    EvaraFlow: {
        label: 'EvaraFlow',
        desc: 'Pump Houses',
        icon: <Waves size={16} />,
        activeBg: 'bg-cyan-600',
        activeText: 'text-white',
        activeBorder: 'border-cyan-600',
        badge: 'bg-cyan-50 text-cyan-700 border border-cyan-200',
        dot: 'bg-cyan-500',
    },
};

// ─── Component ───────────────────────────────────────────────────────────────

const AllNodes = () => {
    const [search, setSearch] = useState('');
    const [analyticsFilter, setAnalyticsFilter] = useState<AnalyticsType | 'all'>('all');
    const [statusFilter, setStatusFilter] = useState<'all' | 'Online' | 'Offline'>('all');

    const filtered = ALL_NODES.filter(n => {
        const matchAnalytics = analyticsFilter === 'all' || n.analytics === analyticsFilter;
        const matchStatus    = statusFilter === 'all' || n.status === statusFilter;
        const q = search.toLowerCase();
        const matchSearch = !q || n.name.toLowerCase().includes(q) || n.location.toLowerCase().includes(q) || n.id.toLowerCase().includes(q);
        return matchAnalytics && matchStatus && matchSearch;
    });

    const onlineCount  = ALL_NODES.filter(n => n.status === 'Online').length;
    const offlineCount = ALL_NODES.filter(n => n.status === 'Offline').length;

    return (
        <div className="min-h-full bg-slate-50">
            {/* ── Top Header Bar ── */}
            <div className="bg-white border-b border-slate-200 px-8 py-5">
                <div className="max-w-screen-2xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight">All Nodes</h1>
                        <p className="text-sm text-slate-500 mt-0.5">
                            All infrastructure assets deployed on campus — {ALL_NODES.length} total
                        </p>
                    </div>

                    {/* Stats */}
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 bg-green-50 border border-green-200 px-4 py-2 rounded-xl">
                            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                            <span className="text-sm font-bold text-green-700">{onlineCount} Online</span>
                        </div>
                        <div className="flex items-center gap-2 bg-red-50 border border-red-200 px-4 py-2 rounded-xl">
                            <span className="w-2 h-2 rounded-full bg-red-400"></span>
                            <span className="text-sm font-bold text-red-700">{offlineCount} Offline</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-screen-2xl mx-auto px-8 py-6 space-y-6">

                {/* ── Search + Status filter ── */}
                <div className="flex flex-col sm:flex-row gap-3">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input
                            type="text"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Search by name, location or ID…"
                            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400/30 focus:border-blue-400 transition-all"
                        />
                        {search && (
                            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                                <X size={14} />
                            </button>
                        )}
                    </div>

                    <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl p-1">
                        <Filter size={15} className="text-slate-400 ml-2" />
                        {(['all', 'Online', 'Offline'] as const).map(s => (
                            <button
                                key={s}
                                onClick={() => setStatusFilter(s)}
                                className={clsx(
                                    'px-3 py-1.5 rounded-lg text-xs font-semibold transition-all',
                                    statusFilter === s
                                        ? s === 'Online'  ? 'bg-green-500 text-white'
                                        : s === 'Offline' ? 'bg-red-500 text-white'
                                        : 'bg-slate-800 text-white'
                                        : 'text-slate-500 hover:bg-slate-100'
                                )}
                            >
                                {s === 'all' ? 'All Status' : s}
                            </button>
                        ))}
                    </div>
                </div>

                {/* ── Analytics Type Tabs ── */}
                <div className="flex flex-wrap gap-3">
                    {/* All tab */}
                    <button
                        onClick={() => setAnalyticsFilter('all')}
                        className={clsx(
                            'flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold border transition-all',
                            analyticsFilter === 'all'
                                ? 'bg-slate-800 text-white border-slate-800 shadow-sm'
                                : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                        )}
                    >
                        All Nodes
                        <span className={clsx(
                            'text-[11px] font-bold px-1.5 py-0.5 rounded-md',
                            analyticsFilter === 'all' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                        )}>
                            {ALL_NODES.length}
                        </span>
                    </button>

                    {/* EvaraTank / EvaraDeep / EvaraFlow tabs */}
                    {(Object.keys(ANALYTICS_CONFIG) as AnalyticsType[]).map(key => {
                        const cfg = ANALYTICS_CONFIG[key];
                        const count = ALL_NODES.filter(n => n.analytics === key).length;
                        const active = analyticsFilter === key;
                        return (
                            <button
                                key={key}
                                onClick={() => setAnalyticsFilter(key)}
                                className={clsx(
                                    'flex items-center gap-2.5 px-5 py-2.5 rounded-xl text-sm font-semibold border transition-all shadow-sm',
                                    active
                                        ? `${cfg.activeBg} ${cfg.activeText} ${cfg.activeBorder}`
                                        : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                                )}
                            >
                                <span className={active ? 'text-white/90' : 'text-slate-400'}>
                                    {cfg.icon}
                                </span>
                                <span>{cfg.label}</span>
                                <span className={clsx(
                                    'text-[11px] font-bold px-1.5 py-0.5 rounded-md',
                                    active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                                )}>
                                    {count}
                                </span>
                                {active && (
                                    <span className="text-[10px] font-medium opacity-75 ml-0.5">
                                        — {cfg.desc}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>

                {/* ── Results count ── */}
                <p className="text-xs text-slate-400 font-medium">
                    Showing {filtered.length} of {ALL_NODES.length} nodes
                </p>

                {/* ── Grid ── */}
                {filtered.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                        {filtered.map(node => {
                            const cfg    = CATEGORY_CONFIG[node.category];
                            const anCfg  = ANALYTICS_CONFIG[node.analytics];
                            const isOnline = node.status === 'Online';
                            return (
                                <Link
                                    key={node.id}
                                    to={`/node/${node.id}`}
                                    className="group bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-200 overflow-hidden flex flex-col"
                                >
                                    {/* Card top accent — analytics color */}
                                    <div className={clsx('h-1 w-full', anCfg.dot)} />

                                    <div className="p-5 flex flex-col flex-1">
                                        {/* Icon + status */}
                                        <div className="flex items-start justify-between mb-4">
                                            <div className={clsx(
                                                'w-11 h-11 rounded-2xl flex items-center justify-center transition-colors',
                                                cfg.bg, cfg.color,
                                                'group-hover:scale-110 transition-transform duration-200'
                                            )}>
                                                {cfg.icon}
                                            </div>
                                            <span className={clsx(
                                                'flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full',
                                                isOnline ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
                                            )}>
                                                <span className={clsx('w-1.5 h-1.5 rounded-full', isOnline ? 'bg-green-500 animate-pulse' : 'bg-red-400')} />
                                                {node.status}
                                            </span>
                                        </div>

                                        {/* Name + ID */}
                                        <h3 className="font-bold text-slate-800 text-base leading-snug mb-1 group-hover:text-blue-600 transition-colors">
                                            {node.name}
                                        </h3>
                                        <p className="text-xs text-slate-400 font-mono mb-3">{node.id}</p>

                                        {/* Category + analytics badges */}
                                        <div className="flex flex-wrap gap-1.5 mb-4">
                                            <span className={clsx('text-[11px] font-semibold px-2 py-0.5 rounded-md', cfg.badge)}>
                                                {cfg.label}
                                            </span>
                                            <span className={clsx('text-[11px] font-semibold px-2 py-0.5 rounded-md', anCfg.badge)}>
                                                {node.analytics}
                                            </span>
                                        </div>

                                        {/* Location + capacity */}
                                        <div className="mt-auto pt-3 border-t border-slate-50 flex items-center justify-between">
                                            <div className="flex items-center gap-1.5 text-xs text-slate-500">
                                                <MapPin size={12} />
                                                <span className="font-medium">{node.location}</span>
                                            </div>
                                            <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                                                {node.capacity}
                                            </span>
                                        </div>
                                    </div>

                                    {/* View Analytics footer */}
                                    <div className={clsx(
                                        'px-5 py-3 text-center text-xs font-bold tracking-wide transition-colors',
                                        'bg-slate-50 text-slate-400 group-hover:bg-blue-600 group-hover:text-white'
                                    )}>
                                        View Analytics →
                                    </div>
                                </Link>
                            );
                        })}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center py-24 text-center">
                        <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mb-4">
                            <Search size={28} className="text-slate-300" />
                        </div>
                        <h3 className="text-slate-600 font-semibold mb-1">No nodes found</h3>
                        <p className="text-slate-400 text-sm">Try adjusting your search or filter</p>
                        <button
                            onClick={() => { setSearch(''); setAnalyticsFilter('all'); setStatusFilter('all'); }}
                            className="mt-4 text-sm text-blue-600 font-semibold hover:underline"
                        >
                            Clear all filters
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AllNodes;
