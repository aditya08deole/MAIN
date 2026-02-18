import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, MapPin, Cpu } from 'lucide-react';
import EvaraTank from './EvaraTank';
import EvaraDeep from './EvaraDeep';
import EvaraFlow from './EvaraFlow';
import clsx from 'clsx';

// ─── Shared node registry (mirrors AllNodes.tsx) ─────────────────────────────

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
    { id: 'PH-01', name: 'Pump House 1',        category: 'PumpHouse',    analytics: 'EvaraFlow',  location: 'ATM Gate',      capacity: '4.98L L',  status: 'Online' },
    { id: 'PH-02', name: 'Pump House 2',        category: 'PumpHouse',    analytics: 'EvaraFlow',  location: 'Guest House',   capacity: '75k L',    status: 'Online' },
    { id: 'PH-03', name: 'Pump House 3',        category: 'PumpHouse',    analytics: 'EvaraFlow',  location: 'Staff Qtrs',    capacity: '55k L',    status: 'Online' },
    { id: 'PH-04', name: 'Pump House 4',        category: 'PumpHouse',    analytics: 'EvaraFlow',  location: 'Bakul',         capacity: '2.00L L',  status: 'Online' },
    { id: 'SUMP-S1',  name: 'Sump S1',  category: 'Sump', analytics: 'EvaraTank', location: 'Bakul',         capacity: '2.00L L',  status: 'Online' },
    { id: 'SUMP-S2',  name: 'Sump S2',  category: 'Sump', analytics: 'EvaraTank', location: 'Palash',        capacity: '1.10L L',  status: 'Online' },
    { id: 'SUMP-S3',  name: 'Sump S3',  category: 'Sump', analytics: 'EvaraTank', location: 'NBH',           capacity: '1.00L L',  status: 'Online' },
    { id: 'SUMP-S4',  name: 'Sump S4',  category: 'Sump', analytics: 'EvaraTank', location: 'Central',       capacity: '4.98L L',  status: 'Online' },
    { id: 'SUMP-S5',  name: 'Sump S5',  category: 'Sump', analytics: 'EvaraTank', location: 'Blk A&B',       capacity: '55k L',    status: 'Online' },
    { id: 'SUMP-S6',  name: 'Sump S6',  category: 'Sump', analytics: 'EvaraTank', location: 'Guest House',   capacity: '10k L',    status: 'Online' },
    { id: 'SUMP-S7',  name: 'Sump S7',  category: 'Sump', analytics: 'EvaraTank', location: 'Pump House',    capacity: '43k L',    status: 'Online' },
    { id: 'SUMP-S8',  name: 'Sump S8',  category: 'Sump', analytics: 'EvaraTank', location: 'Football',      capacity: '12k L',    status: 'Online' },
    { id: 'SUMP-S9',  name: 'Sump S9',  category: 'Sump', analytics: 'EvaraTank', location: 'Felicity',      capacity: '15k L',    status: 'Online' },
    { id: 'SUMP-S10', name: 'Sump S10', category: 'Sump', analytics: 'EvaraTank', location: 'FSQ A&B',       capacity: '34k+31k',  status: 'Online' },
    { id: 'SUMP-S11', name: 'Sump S11', category: 'Sump', analytics: 'EvaraTank', location: 'FSQ C,D,E',     capacity: '1.5L+60k', status: 'Online' },
    { id: 'OHT-1',  name: 'Bakul OHT',         category: 'OHT', analytics: 'EvaraTank', location: 'Bakul',        capacity: '2 Units',  status: 'Online' },
    { id: 'OHT-2',  name: 'Parijat OHT',        category: 'OHT', analytics: 'EvaraTank', location: 'Parijat',      capacity: '2 Units',  status: 'Online' },
    { id: 'OHT-3',  name: 'Kadamba OHT',         category: 'OHT', analytics: 'EvaraTank', location: 'Kadamba',      capacity: '2 Units',  status: 'Online' },
    { id: 'OHT-4',  name: 'NWH Block C OHT',     category: 'OHT', analytics: 'EvaraTank', location: 'NWH Block C',  capacity: '1 Unit',   status: 'Online' },
    { id: 'OHT-5',  name: 'NWH Block B OHT',     category: 'OHT', analytics: 'EvaraTank', location: 'NWH Block B',  capacity: '1 Unit',   status: 'Online' },
    { id: 'OHT-6',  name: 'NWH Block A OHT',     category: 'OHT', analytics: 'EvaraTank', location: 'NWH Block A',  capacity: '1 Unit',   status: 'Online' },
    { id: 'OHT-7',  name: 'Palash Nivas OHT',    category: 'OHT', analytics: 'EvaraTank', location: 'Palash Nivas', capacity: '4 Units',  status: 'Online' },
    { id: 'OHT-8',  name: 'Anand Nivas OHT',     category: 'OHT', analytics: 'EvaraTank', location: 'Anand Nivas',  capacity: '2 Units',  status: 'Online' },
    { id: 'OHT-9',  name: 'Budha Nivas OHT',     category: 'OHT', analytics: 'EvaraTank', location: 'Budha Nivas',  capacity: '2 Units',  status: 'Online' },
    { id: 'OHT-10', name: 'C Block OHT',          category: 'OHT', analytics: 'EvaraTank', location: 'C Block',      capacity: '3 Units',  status: 'Online' },
    { id: 'OHT-11', name: 'D Block OHT',          category: 'OHT', analytics: 'EvaraTank', location: 'D Block',      capacity: '3 Units',  status: 'Online' },
    { id: 'OHT-12', name: 'E Block OHT',          category: 'OHT', analytics: 'EvaraTank', location: 'E Block',      capacity: '3 Units',  status: 'Online' },
    { id: 'OHT-13', name: 'Vindhya OHT',          category: 'OHT', analytics: 'EvaraTank', location: 'Vindhya',      capacity: 'Mixed',    status: 'Online' },
    { id: 'OHT-14', name: 'Himalaya OHT (KRB)',   category: 'OHT', analytics: 'EvaraTank', location: 'Himalaya',     capacity: 'Borewell', status: 'Online' },
    { id: 'BW-P1',   name: 'Borewell P1',   category: 'Borewell', analytics: 'EvaraDeep', location: 'Block C,D,E', capacity: '5 HP',     status: 'Offline' },
    { id: 'BW-P2',   name: 'Borewell P2',   category: 'Borewell', analytics: 'EvaraDeep', location: 'Agri Farm',   capacity: '12.5 HP',  status: 'Offline' },
    { id: 'BW-P3',   name: 'Borewell P3',   category: 'Borewell', analytics: 'EvaraDeep', location: 'Palash',      capacity: '5 HP',     status: 'Offline' },
    { id: 'BW-P4',   name: 'Borewell P4',   category: 'Borewell', analytics: 'EvaraDeep', location: 'Vindhya',     capacity: '--',       status: 'Offline' },
    { id: 'BW-P5',   name: 'Borewell P5',   category: 'Borewell', analytics: 'EvaraDeep', location: 'Nilgiri',     capacity: '5 HP',     status: 'Online' },
    { id: 'BW-P6',   name: 'Borewell P6',   category: 'Borewell', analytics: 'EvaraDeep', location: 'Bakul',       capacity: '5/7.5 HP', status: 'Offline' },
    { id: 'BW-P7',   name: 'Borewell P7',   category: 'Borewell', analytics: 'EvaraDeep', location: 'Volleyball',  capacity: 'N/A',      status: 'Offline' },
    { id: 'BW-P8',   name: 'Borewell P8',   category: 'Borewell', analytics: 'EvaraDeep', location: 'Palash',      capacity: '7.5 HP',   status: 'Online' },
    { id: 'BW-P9',   name: 'Borewell P9',   category: 'Borewell', analytics: 'EvaraDeep', location: 'Girls Blk A', capacity: '7.5 HP',   status: 'Online' },
    { id: 'BW-P10',  name: 'Borewell P10',  category: 'Borewell', analytics: 'EvaraDeep', location: 'Parking NW',  capacity: '5 HP',     status: 'Online' },
    { id: 'BW-P10A', name: 'Borewell P10A', category: 'Borewell', analytics: 'EvaraDeep', location: 'Agri Farm',   capacity: '--',       status: 'Offline' },
    { id: 'BW-P11',  name: 'Borewell P11',  category: 'Borewell', analytics: 'EvaraDeep', location: 'Blk C,D,E',  capacity: '5 HP',     status: 'Offline' },
    { id: 'BW-G1', name: 'Govt Borewell 1', category: 'GovtBorewell', analytics: 'EvaraDeep', location: 'Palash',       capacity: '5 HP',   status: 'Offline' },
    { id: 'BW-G2', name: 'Govt Borewell 2', category: 'GovtBorewell', analytics: 'EvaraDeep', location: 'Palash',       capacity: '1.5 HP', status: 'Offline' },
    { id: 'BW-G3', name: 'Govt Borewell 3', category: 'GovtBorewell', analytics: 'EvaraDeep', location: 'Vindhaya C4',  capacity: '5 HP',   status: 'Online' },
    { id: 'BW-G4', name: 'Govt Borewell 4', category: 'GovtBorewell', analytics: 'EvaraDeep', location: 'Entrance',     capacity: 'N/A',    status: 'Offline' },
    { id: 'BW-G5', name: 'Govt Borewell 5', category: 'GovtBorewell', analytics: 'EvaraDeep', location: 'Entrance',     capacity: 'N/A',    status: 'Offline' },
    { id: 'BW-G6', name: 'Govt Borewell 6', category: 'GovtBorewell', analytics: 'EvaraDeep', location: 'Bamboo House', capacity: 'N/A',    status: 'Offline' },
    { id: 'BW-G7', name: 'Govt Borewell 7', category: 'GovtBorewell', analytics: 'EvaraDeep', location: 'Football',     capacity: 'N/A',    status: 'Offline' },
];

// ─── Category label helpers ───────────────────────────────────────────────────

const CAT_LABEL: Record<NodeCategory, string> = {
    OHT:          'Overhead Tank',
    Sump:         'Sump',
    Borewell:     'Borewell (IIIT)',
    GovtBorewell: 'Borewell (Govt)',
    PumpHouse:    'Pump House',
};

const CAT_STYLES: Record<NodeCategory, { badge: string; accentBg: string; accentText: string }> = {
    OHT:          { badge: 'bg-blue-100 text-blue-700',    accentBg: 'from-blue-50 to-indigo-50',   accentText: 'text-blue-700' },
    Sump:         { badge: 'bg-emerald-100 text-emerald-700', accentBg: 'from-emerald-50 to-teal-50', accentText: 'text-emerald-700' },
    Borewell:     { badge: 'bg-amber-100 text-amber-700',  accentBg: 'from-amber-50 to-yellow-50',  accentText: 'text-amber-700' },
    GovtBorewell: { badge: 'bg-slate-200 text-slate-700',  accentBg: 'from-slate-50 to-gray-100',   accentText: 'text-slate-600' },
    PumpHouse:    { badge: 'bg-purple-100 text-purple-700', accentBg: 'from-purple-50 to-violet-50', accentText: 'text-purple-700' },
};

const ANALYTICS_LABEL: Record<AnalyticsType, { label: string; badge: string }> = {
    EvaraTank: { label: 'EvaraTank', badge: 'bg-indigo-100 text-indigo-700' },
    EvaraDeep: { label: 'EvaraDeep', badge: 'bg-sky-100 text-sky-700' },
    EvaraFlow: { label: 'EvaraFlow', badge: 'bg-cyan-100 text-cyan-700' },
};

// ─── NodeDetails (smart router) ───────────────────────────────────────────────

const NodeDetails = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();

    const node = ALL_NODES.find(n => n.id === id);

    // Unknown node — show graceful 404
    if (!node) {
        return (
            <div className="flex flex-col items-center justify-center h-full py-32 text-center bg-slate-50">
                <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mb-4">
                    <Cpu size={28} className="text-slate-300" />
                </div>
                <h2 className="text-lg font-bold text-slate-600 mb-1">Node not found</h2>
                <p className="text-sm text-slate-400 mb-6">ID: <span className="font-mono">{id}</span></p>
                <button
                    onClick={() => navigate('/nodes')}
                    className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors"
                >
                    <ArrowLeft size={15} /> Back to All Nodes
                </button>
            </div>
        );
    }

    const catStyles  = CAT_STYLES[node.category];
    const analLabel  = ANALYTICS_LABEL[node.analytics];
    const isOnline   = node.status === 'Online';

    return (
        <div className="flex flex-col min-h-full bg-slate-50">

            {/* ── Context header bar ── */}
            <div className={clsx('bg-gradient-to-r border-b border-slate-200 shadow-sm', catStyles.accentBg)}>
                <div className="max-w-screen-2xl mx-auto px-6 py-4 flex flex-col sm:flex-row sm:items-center gap-3">

                    {/* Back button */}
                    <button
                        onClick={() => navigate('/nodes')}
                        className="flex items-center gap-2 px-3 py-2 bg-white/80 hover:bg-white border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 transition-all shadow-sm self-start sm:self-auto flex-shrink-0"
                    >
                        <ArrowLeft size={15} /> All Nodes
                    </button>

                    {/* Node info */}
                    <div className="flex-1 flex flex-wrap items-center gap-3 min-w-0">
                        <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                                <h1 className="text-lg font-extrabold text-slate-800 leading-tight">{node.name}</h1>
                                <span className="font-mono text-xs text-slate-400 bg-white/70 px-2 py-0.5 rounded-md border border-slate-200">{node.id}</span>
                            </div>
                            <div className="flex items-center gap-1.5 mt-1 text-xs text-slate-500">
                                <MapPin size={11} />
                                <span className="font-medium">{node.location}</span>
                                <span className="text-slate-300">·</span>
                                <span>{node.capacity}</span>
                            </div>
                        </div>

                        {/* Badges */}
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className={clsx('text-[11px] font-bold px-2.5 py-1 rounded-lg', catStyles.badge)}>
                                {CAT_LABEL[node.category]}
                            </span>
                            <span className={clsx('text-[11px] font-bold px-2.5 py-1 rounded-lg', analLabel.badge)}>
                                {analLabel.label}
                            </span>
                            <span className={clsx(
                                'flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-lg',
                                isOnline ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
                            )}>
                                <span className={clsx('w-1.5 h-1.5 rounded-full', isOnline ? 'bg-green-500 animate-pulse' : 'bg-red-400')} />
                                {node.status}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Analytics page — rendered inline, no sidebar ── */}
            <div className="flex-1">
                {node.analytics === 'EvaraTank' && <EvaraTank embedded />}
                {node.analytics === 'EvaraDeep' && <EvaraDeep embedded />}
                {node.analytics === 'EvaraFlow' && <EvaraFlow embedded />}
            </div>
        </div>
    );
};

export default NodeDetails;
