import { useState, useEffect, useRef } from 'react';
import { Search, Filter, Droplets, Waves, Gauge, MapPin, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { useNodes } from '../hooks/useNodes';
import { useToast } from '../components/ToastProvider';
import { getDeviceAnalyticsRoute } from '../utils/deviceRouting';
import type { NodeCategory, AnalyticsType } from '../types/database';

// TODO(fake-data): ALL_NODES was hardcoded array, now using useNodes() Supabase hook

// ─── Category config ─────────────────────────────────────────────────────────

export const CATEGORY_CONFIG: Record<NodeCategory, {
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
    FlowMeter: {
        label: 'Flow Meter',
        icon: <Waves size={20} />,
        color: 'text-cyan-600',
        bg: 'bg-cyan-50',
        badge: 'bg-cyan-100 text-cyan-700',
        dot: 'bg-cyan-500',
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
        icon: <img src="/tank.png" className="w-4 h-4 object-contain" alt="EvaraTank" />,
        activeBg: 'bg-indigo-600',
        activeText: 'text-white',
        activeBorder: 'border-indigo-600',
        badge: 'bg-indigo-50 text-indigo-600 border border-indigo-200',
        dot: 'bg-indigo-500',
    },
    EvaraDeep: {
        label: 'EvaraDeep',
        desc: 'Borewells',
        icon: <img src="/borewell.png" className="w-4 h-4 object-contain" alt="EvaraDeep" />,
        activeBg: 'bg-sky-600',
        activeText: 'text-white',
        activeBorder: 'border-sky-600',
        badge: 'bg-sky-50 text-sky-700 border border-sky-200',
        dot: 'bg-sky-500',
    },
    EvaraFlow: {
        label: 'EvaraFlow',
        desc: 'Pump Houses',
        icon: <img src="/meter.png" className="w-4 h-4 object-contain" alt="EvaraFlow" />,
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

    const { showToast } = useToast();
    const { nodes, loading, error } = useNodes();

    // Track shown errors to prevent notification spam
    const shownErrorsRef = useRef<Set<string>>(new Set());

    // Show toast notification ONCE per unique error - prevents flooding
    useEffect(() => {
        if (error && !shownErrorsRef.current.has(error)) {
            shownErrorsRef.current.add(error);
            showToast(`Unable to fetch nodes: ${error}`, 'error');
        }
    }, [error, showToast]);

    const filtered = nodes.filter(n => {
        const matchAnalytics = analyticsFilter === 'all' || n.analytics_template === analyticsFilter;
        const matchStatus = statusFilter === 'all' || n.status === statusFilter;
        const q = search.toLowerCase();
        const matchSearch = !q || n.label.toLowerCase().includes(q) || (n.location_name || '').toLowerCase().includes(q) || n.node_key.toLowerCase().includes(q);
        return matchAnalytics && matchStatus && matchSearch;
    });

    const onlineCount = nodes.filter(n => n.status === 'Online').length;
    const offlineCount = nodes.filter(n => n.status === 'Offline').length;

    return (
        <div className="min-h-screen bg-transparent relative flex flex-col pt-[96px] lg:pt-[112px]">
            {/* SVG Noise Overlay */}
            <div className="absolute inset-0 opacity-[0.015] pointer-events-none z-0" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")` }}></div>

            {/* ── Top Header Bar ── */}
            <div className="px-6 lg:px-10 py-6 relative z-10">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                    <div>
                        <h1 className="text-[34px] font-[800] tracking-tight text-[#004ba0] leading-none mb-1.5" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", Arial, sans-serif', letterSpacing: '-0.04em' }}>All Nodes</h1>
                        {loading ? (
                            <p className="text-[12px] text-blue-500 font-bold uppercase tracking-[0.15em] opacity-80">Loading infrastructure...</p>
                        ) : (
                            <p className="text-[12px] text-blue-500 font-bold uppercase tracking-[0.15em] opacity-80">
                                {nodes.length} TOTAL ASSETS DEPLOYED — REAL-TIME NETWORK
                            </p>
                        )}
                    </div>

                    {/* Stats */}
                    {!loading && (
                        <div className="flex items-center gap-2">
                            <div className="flex items-center gap-2 bg-white/40 backdrop-blur-md border border-white/60 px-3 py-1.5 rounded-full shadow-sm">
                                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                                <span className="text-[12px] font-[800] text-green-700 uppercase tracking-tight">{onlineCount} Online</span>
                            </div>
                            <div className="flex items-center gap-2 bg-white/40 backdrop-blur-md border border-white/60 px-3 py-1.5 rounded-full shadow-sm">
                                <span className="w-1.5 h-1.5 rounded-full bg-red-400"></span>
                                <span className="text-[12px] font-[800] text-red-700 uppercase tracking-tight">{offlineCount} Offline</span>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <div className="px-6 lg:px-10 py-4 space-y-5 relative z-10 w-full">

                {/* ── Search + Status filter ── */}
                <div className="flex flex-col lg:flex-row items-center justify-start gap-3 w-full">
                    <div className="relative w-full max-w-sm group">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-blue-400 group-focus-within:text-blue-600 transition-colors" size={16} />
                        <input
                            type="text"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Search assets…"
                            className="w-full pl-10 pr-4 py-2.5 bg-white/40 backdrop-blur-xl border border-white/60 rounded-[18px] text-[14px] font-[600] focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-400/50 transition-all shadow-sm placeholder:text-slate-400"
                            style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", Arial, sans-serif' }}
                        />
                        {search && (
                            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-blue-500 transition-colors">
                                <X size={14} />
                            </button>
                        )}
                    </div>

                    <div className="flex items-center gap-1 bg-white/60 backdrop-blur-xl border border-white/80 rounded-[16px] p-1 shadow-sm">
                        <div className="px-2.5 text-slate-400">
                            <Filter size={14} />
                        </div>
                        {(['all', 'Online', 'Offline'] as const).map(s => (
                            <button
                                key={s}
                                onClick={() => setStatusFilter(s)}
                                className={clsx(
                                    'px-3.5 py-1.5 rounded-[12px] text-[11px] font-[800] transition-all uppercase tracking-tight',
                                    statusFilter === s
                                        ? s === 'Online' ? 'btn-liquid-glass btn-liquid-glass-green'
                                            : s === 'Offline' ? 'btn-liquid-glass btn-liquid-glass-red'
                                                : 'btn-liquid-glass btn-liquid-glass-slate'
                                        : 'text-slate-500 hover:bg-white/40'
                                )}
                            >
                                {s === 'all' ? 'All Assets' : s}
                            </button>
                        ))}
                    </div>
                </div>

                {/* ── Analytics Type Tabs ── */}
                <div className="flex flex-wrap items-center justify-start gap-3">
                    {/* All tab */}
                    <button
                        onClick={() => setAnalyticsFilter('all')}
                        className={clsx(
                            'flex items-center gap-2 px-4 py-2.5 rounded-[15px] text-[12px] font-[800] border transition-all uppercase tracking-tight',
                            analyticsFilter === 'all'
                                ? 'btn-liquid-glass btn-liquid-glass-slate'
                                : 'bg-white/60 backdrop-blur-xl text-slate-600 border-white/80 hover:border-white hover:bg-white/80 shadow-sm'
                        )}
                    >
                        All Nodes
                        <span className={clsx(
                            'text-[10px] font-[900] px-1.5 py-0.5 rounded-full',
                            analyticsFilter === 'all' ? 'bg-white/20 text-white' : 'bg-blue-100 text-[#004ba0]'
                        )}>
                            {nodes.length}
                        </span>
                    </button>

                    {/* EvaraTank / EvaraDeep / EvaraFlow tabs */}
                    {(Object.keys(ANALYTICS_CONFIG) as AnalyticsType[]).map(key => {
                        const cfg = ANALYTICS_CONFIG[key];
                        const count = nodes.filter(n => n.analytics_template === key).length;
                        const active = analyticsFilter === key;

                        // Map template to liquid glass color
                        const liquidColorClass =
                            key === 'EvaraTank' ? 'btn-liquid-glass-indigo' :
                                key === 'EvaraDeep' ? 'btn-liquid-glass-sky' :
                                    'btn-liquid-glass-cyan';

                        return (
                            <button
                                key={key}
                                onClick={() => setAnalyticsFilter(key)}
                                className={clsx(
                                    'flex items-center gap-2 px-4 py-2.5 rounded-[15px] text-[12px] font-[800] border transition-all uppercase tracking-tight shadow-sm',
                                    active
                                        ? `btn-liquid-glass ${liquidColorClass}`
                                        : 'bg-white/60 backdrop-blur-xl text-slate-600 border-white/80 hover:border-white hover:bg-white/80'
                                )}
                            >
                                <span className={active ? 'text-white/90' : 'text-slate-400'}>
                                    {cfg.icon}
                                </span>
                                <span>{cfg.label}</span>
                                <span className={clsx(
                                    'text-[10px] font-[900] px-1.5 py-0.5 rounded-full',
                                    active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                                )}>
                                    {count}
                                </span>
                            </button>
                        );
                    })}
                </div>

                {/* ── Results count ── */}
                <div className="w-full flex justify-start">
                    <p className="text-[11px] text-blue-700 font-[800] btn-liquid-glass btn-liquid-glass-slate px-4 py-1.5 rounded-full uppercase tracking-widest shadow-sm" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", Arial, sans-serif' }}>
                        Displaying {filtered.length} nodes
                    </p>
                </div>

                {/* ── Grid ── */}
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-24 text-center">
                        <div className="w-10 h-10 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin"></div>
                        <p className="text-slate-500 font-bold mt-4 uppercase tracking-widest text-[12px]">Processing Network Nodes...</p>
                    </div>
                ) : filtered.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-5 w-full">
                        {filtered.map(node => {
                            const cfg = CATEGORY_CONFIG[(node.category as NodeCategory) || 'OHT'] || CATEGORY_CONFIG['OHT'];
                            const anCfg = ANALYTICS_CONFIG[node.analytics_template as keyof typeof ANALYTICS_CONFIG] || ANALYTICS_CONFIG['EvaraTank'];
                            const isOnline = node.status === 'Online';
                            return (
                                <Link
                                    key={node.node_key}
                                    to={getDeviceAnalyticsRoute({ id: node.node_key, analytics_template: node.analytics_template || undefined, device_type: node.category || undefined })}
                                    className="group apple-glass-card flex flex-col"
                                >
                                    <div className="p-5 flex flex-col flex-1">
                                        {/* Icon + status */}
                                        <div className="flex items-start justify-between mb-4">
                                            <div className={clsx(
                                                'w-11 h-11 rounded-2xl flex items-center justify-center overflow-hidden transition-all',
                                                cfg.bg,
                                                'group-hover:scale-110 transition-transform duration-200'
                                            )}>
                                                {node.analytics_template === 'EvaraTank' ? (
                                                    <img src="/tank.png" className="w-8 h-8 object-contain" alt="Tank" />
                                                ) : node.analytics_template === 'EvaraDeep' ? (
                                                    <img src="/borewell.png" className="w-8 h-8 object-contain" alt="Borewell" />
                                                ) : node.analytics_template === 'EvaraFlow' ? (
                                                    <img src="/meter.png" className="w-8 h-8 object-contain" alt="Flow Meter" />
                                                ) : (
                                                    <span className={cfg.color}>{cfg.icon}</span>
                                                )}
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
                                        <h3 className="font-[700] text-slate-800 text-[16px] leading-snug mb-1 group-hover:text-blue-600 transition-colors" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Helvetica Neue", Arial, sans-serif', letterSpacing: '-0.02em' }}>
                                            {node.label}
                                        </h3>
                                        <p className="text-[11px] text-slate-400 font-mono font-[600] mb-3">{node.node_key}</p>

                                        {/* Category + analytics badges */}
                                        <div className="flex flex-wrap gap-1.5 mb-4">
                                            <span className={clsx('text-[12px] font-semibold px-2 py-0.5 rounded-md', cfg.badge)}>
                                                {cfg.label}
                                            </span>
                                            <span className={clsx('text-[12px] font-semibold px-2 py-0.5 rounded-md', anCfg.badge)}>
                                                {node.analytics_template}
                                            </span>
                                        </div>

                                        {/* Location + capacity */}
                                        <div className="mt-auto pt-3 border-t border-slate-50 flex items-center justify-between">
                                            <div className="flex items-center gap-1.5 text-xs text-slate-500">
                                                <MapPin size={12} />
                                                <span className="font-medium">{node.location_name}</span>
                                            </div>
                                            <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md">
                                                {node.capacity}
                                            </span>
                                        </div>
                                    </div>

                                    {/* View Analytics footer */}
                                    <div className={clsx(
                                        'px-5 py-3 text-center text-xs font-bold tracking-wide transition-all border-t border-white/40',
                                        'bg-white/40 text-slate-400 group-hover:btn-liquid-glass group-hover:bg-blue-500/60 group-hover:text-white'
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
