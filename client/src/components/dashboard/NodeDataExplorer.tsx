import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
    Droplet, Activity, Zap,
    ChevronRight,
    Search, Filter
} from 'lucide-react';
import clsx from 'clsx';
import { getDeviceAnalyticsRoute } from '../../utils/deviceRouting';

type NodeType = 'tank' | 'flow' | 'deep';

interface NodeData {
    id: string;
    name: string;
    type: NodeType;
    status: 'Online' | 'Offline';
    isStale: boolean;
    lastSeen?: string;
    metrics: Record<string, any>;
    location?: string;
    device?: string;
}

import { StaleDataBadge } from '../ui/StaleDataBadge';

interface NodeDataExplorerProps {
    nodes: NodeData[];
    className?: string;
}

export const NodeDataExplorer = (props: NodeDataExplorerProps) => {
    const { nodes, className } = props;
    const [activeType, setActiveType] = useState<NodeType>('tank');
    const [activeLocation, setActiveLocation] = useState<string>('all');
    const [activeDevice, setActiveDevice] = useState<string>('all');

    const uniqueLocations = Array.from(new Set(nodes.map(n => n.location).filter(Boolean))) as string[];
    const uniqueDevices = Array.from(new Set(nodes.map(n => n.device).filter(Boolean))) as string[];

    const filteredNodes = nodes.filter(n => {
        if (n.type !== activeType) return false;
        if (activeLocation !== 'all' && n.location !== activeLocation) return false;
        if (activeDevice !== 'all' && n.device !== activeDevice) return false;
        return true;
    });

    const types = [
        { id: 'tank', label: 'EvaraTank', icon: Droplet },
        { id: 'flow', label: 'EvaraFlow', icon: Activity },
        { id: 'deep', label: 'EvaraDeep', icon: Zap },
    ];

    return (
        <div className={clsx("apple-glass-card p-[20px] rounded-[50px] flex flex-col", className)}>
            {/* Top Bar / Filter */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4 shrink-0">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
                        <Filter size={18} className="text-blue-500" />
                    </div>
                    <div>
                        <h3 className="text-[15px] font-[800] text-[#1f2937]/80 uppercase tracking-[0.05em] leading-none mb-1">Node Data Explorer</h3>
                        <p className="text-[11px] text-gray-400 font-bold uppercase tracking-tight">Multi-node real-time telemetry comparison</p>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 self-start">
                    <div className="flex p-1.5 bg-gray-100/50 rounded-[24px] border border-gray-200/30 backdrop-blur-sm">
                        {types.map((type) => (
                            <button
                                key={type.id}
                                onClick={() => setActiveType(type.id as NodeType)}
                                className={clsx(
                                    "flex items-center gap-2 px-6 py-2 rounded-[20px] text-[13px] font-bold transition-all duration-300",
                                    activeType === type.id
                                        ? "bg-white text-blue-600 shadow-sm border border-white/50"
                                        : "text-gray-500 hover:text-gray-700 hover:bg-white/30"
                                )}
                            >
                                <type.icon size={14} />
                                {type.label}
                            </button>
                        ))}
                    </div>

                    <select
                        value={activeLocation}
                        onChange={(e) => setActiveLocation(e.target.value)}
                        className="bg-white/60 border border-gray-200/50 text-[12px] font-bold text-gray-600 rounded-[20px] px-4 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500/50 appearance-none shadow-sm cursor-pointer hover:bg-white"
                        style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' fill=\'none\' stroke=\'%236b7280\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\' viewBox=\'0 0 24 24\'%3E%3Cpath d=\'m6 9 6 6 6-6\'/%3E%3C/svg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center', paddingRight: '32px' }}
                    >
                        <option value="all">All Locations</option>
                        {uniqueLocations.map(loc => <option key={loc} value={loc}>{loc}</option>)}
                    </select>

                    <select
                        value={activeDevice}
                        onChange={(e) => setActiveDevice(e.target.value)}
                        className="bg-white/60 border border-gray-200/50 text-[12px] font-bold text-gray-600 rounded-[20px] px-4 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500/50 appearance-none shadow-sm cursor-pointer hover:bg-white"
                        style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' fill=\'none\' stroke=\'%236b7280\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\' viewBox=\'0 0 24 24\'%3E%3Cpath d=\'m6 9 6 6 6-6\'/%3E%3C/svg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center', paddingRight: '32px' }}
                    >
                        <option value="all">All Devices</option>
                        {uniqueDevices.map(dev => <option key={dev} value={dev}>{dev}</option>)}
                    </select>
                </div>
            </div>

            {/* Dynamic Grid - Scrollable internally */}
            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar min-h-0">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6 pb-4">
                    {filteredNodes.length > 0 ? filteredNodes.map((node) => (
                        <div key={node.id} className="apple-glass-inner p-4 rounded-[32px] hover:scale-[1.02] transition-transform duration-300 border border-white/40 shadow-sm flex flex-col justify-between h-[160px]">
                            <div>
                                <div className="flex justify-between items-start mb-1">
                                    <span className="text-[11px] font-bold text-gray-400 uppercase tracking-tighter">
                                        {node.type === 'tank' ? 'EvaraTank' : node.type === 'flow' ? 'EvaraFlow' : 'EvaraDeep'}
                                    </span>
                                    <div className="scale-75 origin-top-right -mt-1 -mr-1">
                                        <StaleDataBadge isStale={node.isStale} lastSeen={node.lastSeen} />
                                    </div>
                                </div>
                                <h4 className="text-[15px] font-bold text-gray-800 truncate mb-4">{node.name}</h4>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                {Object.entries(node.metrics).map(([key, val]) => (
                                    <div key={key} className="flex flex-col">
                                        <span className="text-[9px] uppercase font-bold text-gray-400 tracking-wider mb-1">{key}</span>
                                        <div className="flex items-baseline gap-1">
                                            <span className="text-[16px] font-[600] text-gray-800">{val}</span>
                                            <span className="text-[10px] text-gray-400">
                                                {activeType === 'tank' && key === 'Level' ? '%' :
                                                    activeType === 'flow' && key === 'Rate' ? 'm/s' :
                                                        activeType === 'deep' && key === 'Voltage' ? 'V' : ''}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="mt-auto pt-3 flex justify-end">
                                <Link
                                    to={getDeviceAnalyticsRoute({
                                        id: node.id,
                                        analytics_template: node.type === 'tank' ? 'EvaraTank' : node.type === 'flow' ? 'EvaraFlow' : 'EvaraDeep',
                                    })}
                                    className="text-[11px] font-bold text-blue-500 flex items-center gap-1 group hover:text-blue-700 transition-colors"
                                >
                                    Full Analytics <ChevronRight size={12} className="group-hover:translate-x-1 transition-transform" />
                                </Link>
                            </div>
                        </div>
                    )) : (
                        <div className="col-span-full py-12 flex flex-col items-center justify-center opacity-30 italic text-gray-500">
                            <Search size={32} className="mb-2" />
                            <span>No nodes of this type found in current scope.</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default NodeDataExplorer;
