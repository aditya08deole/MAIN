/**
 * MapLegend — the bottom-left filter/index panel on the Home map.
 * Extracted from Home.tsx to reduce component size.
 */
import clsx from 'clsx';
import { Layers } from 'lucide-react';

interface FilterItem {
    key: string;
    label: string;
    fill: string;
    activeBg: string;
    activeRing: string;
}

const ASSET_FILTERS: FilterItem[] = [
    { key: 'EvaraTank', label: 'EvaraTank', fill: '#4f46e5', activeBg: 'bg-indigo-100', activeRing: 'ring-indigo-400' },
    { key: 'EvaraDeep', label: 'EvaraDeep', fill: '#0ea5e9', activeBg: 'bg-sky-100', activeRing: 'ring-sky-400' },
    { key: 'EvaraFlow', label: 'EvaraFlow', fill: '#06b6d4', activeBg: 'bg-cyan-100', activeRing: 'ring-cyan-400' },
];

const SVG_ICON = (fill: string) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill={fill} stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-map-pin">
        <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
        <circle cx="12" cy="10" r="3" />
    </svg>
);

interface Props {
    showIndex: boolean;
    setShowIndex: (v: boolean) => void;
    activeFilter: string | null;
    onFilterClick: (filter: string) => void;
    activePipeline: string | null;
    onPipelineClick: (pipeline: string) => void;
}

export const MapLegend = ({ showIndex, setShowIndex, activeFilter, onFilterClick, activePipeline, onPipelineClick }: Props) => (
    <div className="absolute bottom-6 left-6 z-[1000] flex flex-col items-start pointer-events-none">
        {/* Toggle Button */}
        <button
            onClick={() => setShowIndex(!showIndex)}
            className="apple-glass-card p-3 rounded-full shadow-lg border border-slate-200 text-slate-500 hover:text-[var(--color-evara-blue)] mb-2 pointer-events-auto transition-colors hover:shadow-xl"
            title={showIndex ? "Hide Index" : "Show Index"}
        >
            <Layers size={20} />
        </button>

        {/* Index Card */}
        <div className={clsx(
            "apple-glass-card rounded-[20px] shadow-2xl border border-slate-200 w-[340px] flex flex-col transition-all duration-300 origin-bottom-left overflow-hidden pointer-events-auto",
            showIndex ? "opacity-100 scale-100 max-h-[500px]" : "opacity-0 scale-95 max-h-0"
        )}>
            <div className="p-5">
                <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 cursor-pointer hover:text-[var(--color-evara-blue)] transition-colors" onClick={() => onFilterClick('')}>ASSETS <span className="font-normal normal-case text-slate-300">— Tanks &amp; Borewells &amp; Flow Meters</span></h2>
                <div className="grid grid-cols-2 gap-x-2 gap-y-3">
                    {ASSET_FILTERS.map((f) => (
                        <div
                            key={f.key}
                            className={clsx(
                                "flex items-center gap-2 cursor-pointer rounded-lg px-2 py-1.5 transition-all",
                                activeFilter === f.key ? `${f.activeBg} ring-1 ${f.activeRing} shadow-[0_0_12px_rgba(58,122,254,0.3)]` : 'hover:bg-white/40'
                            )}
                            onClick={() => onFilterClick(f.key)}
                        >
                            <div className={clsx("w-8 h-8 rounded-full flex items-center justify-center shadow-sm shrink-0 transition-transform", activeFilter === f.key && "scale-110", f.activeBg)}>
                                {SVG_ICON(f.fill)}
                            </div>
                            <span className="text-[13px] font-semibold text-slate-700 leading-tight">{f.label}</span>
                        </div>
                    ))}
                </div>

                <div className="my-3 border-t border-slate-100" />

                <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">PIPELINES</h2>

                <div className="grid grid-cols-2 gap-x-2 gap-y-3">
                    <div className={clsx("flex items-center gap-2 cursor-pointer rounded-lg px-2 py-1.5 transition-all", activePipeline === 'watersupply' ? 'bg-cyan-100 ring-1 ring-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.4)]' : 'hover:bg-white/40')} onClick={() => onPipelineClick('watersupply')}>
                        <div className={clsx("w-8 h-8 flex flex-col items-center justify-center rounded-full bg-cyan-50 shadow-sm shrink-0 transition-transform", activePipeline === 'watersupply' && "scale-110")}><div className="w-5 h-1 bg-[#00b4d8] rounded-full shadow-sm" /></div>
                        <span className="text-[13px] font-semibold text-slate-700 leading-tight">Water Supply</span>
                    </div>

                    <div className={clsx("flex items-center gap-2 cursor-pointer rounded-lg px-2 py-1.5 transition-all", activePipeline === 'borewellwater' ? 'bg-indigo-100 ring-1 ring-indigo-400 shadow-[0_0_12px_rgba(99,102,241,0.4)]' : 'hover:bg-white/40')} onClick={() => onPipelineClick('borewellwater')}>
                        <div className={clsx("w-8 h-8 flex flex-col items-center justify-center rounded-full bg-indigo-50 shadow-sm shrink-0 transition-transform", activePipeline === 'borewellwater' && "scale-110")}><div className="w-5 h-1 bg-[#000080] rounded-full shadow-sm" /></div>
                        <span className="text-[13px] font-semibold text-slate-700 leading-tight">Borewell Water</span>
                    </div>
                </div>
            </div>
        </div>
    </div>
);

export default MapLegend;
