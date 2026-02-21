import { useParams, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { ArrowLeft, MapPin, Cpu } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import api from '../services/api';
import EvaraTank from './EvaraTank';
import EvaraDeep from './EvaraDeep';
import EvaraFlow from './EvaraFlow';
import type { NodeRow, NodeCategory, AnalyticsType } from '../types/database';
import clsx from 'clsx';

interface MapDevice {
    id: string;
    name: string;
    asset_type: string;
    asset_category?: string;
    latitude: number;
    longitude: number;
    capacity?: string;
    specifications?: string;
    status: string;
}

// ─── Category label helpers ───────────────────────────────────────────────────

const ASSET_TYPE_LABELS: Record<string, string> = {
    pump: 'Pump House',
    sump: 'Sump',
    tank: 'Overhead Tank',
    bore: 'Borewell (IIIT)',
    govt: 'Borewell (Govt)',
};

const ASSET_TYPE_STYLES: Record<string, { badge: string; accentBg: string; accentText: string }> = {
    pump: { badge: 'bg-purple-100 text-purple-700', accentBg: 'from-purple-50 to-violet-50', accentText: 'text-purple-700' },
    sump: { badge: 'bg-emerald-100 text-emerald-700', accentBg: 'from-emerald-50 to-teal-50', accentText: 'text-emerald-700' },
    tank: { badge: 'bg-blue-100 text-blue-700', accentBg: 'from-blue-50 to-indigo-50', accentText: 'text-blue-700' },
    bore: { badge: 'bg-amber-100 text-amber-700', accentBg: 'from-amber-50 to-yellow-50', accentText: 'text-amber-700' },
    govt: { badge: 'bg-slate-200 text-slate-700', accentBg: 'from-slate-50 to-gray-100', accentText: 'text-slate-600' },
};

const CAT_LABEL: Record<NodeCategory, string> = {
    OHT: 'Overhead Tank',
    Sump: 'Sump',
    Borewell: 'Borewell (IIIT)',
    GovtBorewell: 'Borewell (Govt)',
    PumpHouse: 'Pump House',
    FlowMeter: 'Flow Meter',
};

const CAT_STYLES: Record<NodeCategory, { badge: string; accentBg: string; accentText: string }> = {
    OHT: { badge: 'bg-blue-100 text-blue-700', accentBg: 'from-blue-50 to-indigo-50', accentText: 'text-blue-700' },
    Sump: { badge: 'bg-emerald-100 text-emerald-700', accentBg: 'from-emerald-50 to-teal-50', accentText: 'text-emerald-700' },
    Borewell: { badge: 'bg-amber-100 text-amber-700', accentBg: 'from-amber-50 to-yellow-50', accentText: 'text-amber-700' },
    GovtBorewell: { badge: 'bg-slate-200 text-slate-700', accentBg: 'from-slate-50 to-gray-100', accentText: 'text-slate-600' },
    PumpHouse: { badge: 'bg-purple-100 text-purple-700', accentBg: 'from-purple-50 to-violet-50', accentText: 'text-purple-700' },
    FlowMeter: { badge: 'bg-cyan-100 text-cyan-700', accentBg: 'from-cyan-50 to-sky-50', accentText: 'text-cyan-700' },
};

const ANALYTICS_LABEL: Record<AnalyticsType, { label: string; badge: string }> = {
    EvaraTank: { label: 'EvaraTank', badge: 'bg-indigo-100 text-indigo-700' },
    EvaraDeep: { label: 'EvaraDeep', badge: 'bg-sky-100 text-sky-700' },
    EvaraFlow: { label: 'EvaraFlow', badge: 'bg-cyan-100 text-cyan-700' },
};

// ─── NodeDetails (smart router) ───────────────────────────────────────────────

import { STATIC_NODES } from '../data/staticData';

const NodeDetails = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();

    // Try to fetch from devices API first
    const { data: device, isLoading: deviceLoading, error: deviceError } = useQuery<MapDevice>({
        queryKey: ['device', id],
        queryFn: async () => {
            const response = await api.get<MapDevice[]>('/devices/map/all');
            const found = response.data.find(d => d.id === id);
            if (!found) throw new Error('Device not found in database');
            return found;
        },
        enabled: !!id,
        retry: 1,
    });

    // Fallback to static nodes if device not found
    const [node, setNode] = useState<NodeRow | null>(null);
    const [nodeLoading, setNodeLoading] = useState(false);

    useEffect(() => {
        if (!id || deviceLoading || device) return;

        // If device fetch failed, try static nodes
        if (deviceError) {
            setNodeLoading(true);
            setTimeout(() => {
                const foundNode = STATIC_NODES.find(n => n.node_key === id);
                setNode(foundNode || null);
                setNodeLoading(false);
            }, 100);
        }
    }, [id, deviceError, device, deviceLoading]);

    // Show device details if found
    if (device) {
        const styles = ASSET_TYPE_STYLES[device.asset_type] || ASSET_TYPE_STYLES.pump;
        const label = ASSET_TYPE_LABELS[device.asset_type] || device.asset_type;
        const isOnline = device.status === 'Online' || device.status === 'Working' || device.status === 'Running' || device.status === 'Normal';

        return (
            <div className="flex flex-col min-h-full bg-slate-50">
                <div className="p-6 max-w-4xl mx-auto w-full">
                    <button
                        onClick={() => navigate(-1)}
                        className="flex items-center gap-2 text-slate-600 hover:text-slate-900 mb-6 transition-colors"
                    >
                        <ArrowLeft size={20} />
                        <span className="font-semibold">Back</span>
                    </button>

                    <div className={clsx("bg-gradient-to-br rounded-3xl p-8 border border-slate-200 shadow-xl", styles.accentBg)}>
                        <div className="flex items-start gap-4 mb-6">
                            <div className={clsx("p-3 rounded-xl", isOnline ? "bg-green-500" : "bg-red-500")}>
                                <MapPin className="text-white" size={24} />
                            </div>
                            <div className="flex-1">
                                <h1 className="text-3xl font-extrabold text-slate-800 mb-2">{device.name}</h1>
                                <div className="flex gap-2 flex-wrap">
                                    <span className={clsx("px-3 py-1 rounded-full text-sm font-bold", styles.badge)}>
                                        {label}
                                    </span>
                                    {device.asset_category && (
                                        <span className="px-3 py-1 rounded-full text-sm font-bold bg-slate-100 text-slate-700">
                                            {device.asset_category}
                                        </span>
                                    )}
                                    <span className={clsx("px-3 py-1 rounded-full text-sm font-bold", isOnline ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700")}>
                                        {device.status}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {device.capacity && (
                                <div className="bg-white/80 backdrop-blur rounded-xl p-4">
                                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Capacity</p>
                                    <p className="text-xl font-extrabold text-slate-800">{device.capacity}</p>
                                </div>
                            )}
                            {device.specifications && (
                                <div className="bg-white/80 backdrop-blur rounded-xl p-4">
                                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Specifications</p>
                                    <p className="text-lg font-semibold text-slate-700">{device.specifications}</p>
                                </div>
                            )}
                            <div className="bg-white/80 backdrop-blur rounded-xl p-4">
                                <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Location</p>
                                <p className="text-sm font-mono text-slate-600">{device.latitude.toFixed(6)}, {device.longitude.toFixed(6)}</p>
                                <a
                                    href={`https://www.google.com/maps?q=${device.latitude},${device.longitude}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-600 hover:text-blue-700 text-xs font-medium mt-1 inline-block"
                                >
                                    View on Maps →
                                </a>
                            </div>
                            <div className="bg-white/80 backdrop-blur rounded-xl p-4">
                                <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-1">Device ID</p>
                                <p className="text-xs font-mono text-slate-600 break-all">{device.id}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // Loading state
    if (deviceLoading || nodeLoading) {
        return (
            <div className="flex flex-col items-center justify-center h-full py-32 text-center bg-slate-50">
                <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                <p className="text-slate-500 font-medium">Loading...</p>
            </div>
        );
    }

    // If no device and no node found, show 404
    if (!device && !node) {
        return (
            <div className="flex flex-col items-center justify-center h-full py-32 text-center bg-slate-50">
                <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mb-4">
                    <Cpu size={28} className="text-slate-300" />
                </div>
                <h2 className="text-lg font-bold text-slate-600 mb-1">Device not found</h2>
                <p className="text-sm text-slate-400 mb-6">ID: <span className="font-mono">{id}</span></p>
                <button
                    onClick={() => navigate(-1)}
                    className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors"
                >
                    <ArrowLeft size={15} /> Go Back
                </button>
            </div>
        );
    }

    // Render static node details if found (fallback for old nodes)
    if (node) {
        const catStyles = CAT_STYLES[node.category as NodeCategory];
        const analLabel = ANALYTICS_LABEL[node.analytics_type as AnalyticsType];
        const isOnline = node.status === 'Online';

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
                                    <h1 className="text-lg font-extrabold text-slate-800 leading-tight">{node.label}</h1>
                                    <span className="font-mono text-xs text-slate-400 bg-white/70 px-2 py-0.5 rounded-md border border-slate-200">{node.node_key}</span>
                                </div>
                                <div className="flex items-center gap-1.5 mt-1 text-xs text-slate-500">
                                    <MapPin size={11} />
                                    <span className="font-medium">{node.location_name}</span>
                                    <span className="text-slate-300">·</span>
                                    <span>{node.capacity}</span>
                                </div>
                            </div>

                            {/* Badges */}
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className={clsx('text-[11px] font-bold px-2.5 py-1 rounded-lg', catStyles.badge)}>
                                    {CAT_LABEL[node.category as NodeCategory]}
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
                    {node.analytics_type === 'EvaraTank' && <EvaraTank embedded nodeId={node.node_key} />}
                    {node.analytics_type === 'EvaraDeep' && <EvaraDeep embedded nodeId={node.node_key} />}
                    {node.analytics_type === 'EvaraFlow' && <EvaraFlow embedded nodeId={node.node_key} />}
                </div>
            </div>
        );
    }

    return null;
};

export default NodeDetails;
