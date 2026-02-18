import React, { useState } from 'react';
import { Plus, Server, MapPin, Radio, Activity, Database, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { createNode } from '../../services/devices';
import { NodeCategory, AnalyticsType } from '../../types/database';

const AdminNodes = () => {
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
    const [errorMsg, setErrorMsg] = useState('');

    const [formData, setFormData] = useState({
        label: '',
        node_key: '',
        category: 'OHT' as NodeCategory,
        location_name: '',
        lat: '',
        lng: '',
        capacity: '',
        thingspeak_channel_id: '',
        thingspeak_read_api_key: '',
    });

    const categories: NodeCategory[] = ['OHT', 'Sump', 'Borewell', 'GovtBorewell', 'PumpHouse', 'FlowMeter'];

    const handleSumbit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setStatus('idle');

        // Auto-assign analytics_type based on category
        let analytics_type: AnalyticsType = 'EvaraTank';
        if (formData.category === 'Borewell' || formData.category === 'GovtBorewell') analytics_type = 'EvaraDeep';
        if (formData.category === 'PumpHouse' || formData.category === 'FlowMeter') analytics_type = 'EvaraFlow';

        try {
            await createNode({
                ...formData,
                lat: parseFloat(formData.lat) || 0,
                lng: parseFloat(formData.lng) || 0,
                analytics_type,
                status: 'Online'
            });
            setStatus('success');
            setFormData({
                label: '',
                node_key: '',
                category: 'OHT',
                location_name: '',
                lat: '',
                lng: '',
                capacity: '',
                thingspeak_channel_id: '',
                thingspeak_read_api_key: '',
            });
        } catch (err: any) {
            setStatus('error');
            setErrorMsg(err.response?.data?.detail || "Failed to add device. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto p-4 md:p-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
                <div>
                    <h2 className="text-3xl font-bold text-slate-900">Infrastructure Asset Registry</h2>
                    <p className="text-slate-500 mt-1">Provision and manage nodes, tanks, and telemetry sources.</p>
                </div>
                <div className="flex items-center gap-2 bg-blue-50 text-blue-700 px-4 py-2 rounded-full text-sm font-semibold border border-blue-100">
                    <Database className="w-4 h-4" />
                    Supabase Live
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Main Form */}
                <div className="lg:col-span-2 space-y-6">
                    <form onSubmit={handleSumbit} className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
                        <div className="p-1 px-8 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest py-4">New Asset Provisioning</span>
                            <Server className="w-4 h-4 text-slate-300" />
                        </div>

                        <div className="p-8 space-y-6">
                            {status === 'success' && (
                                <div className="p-4 bg-green-50 border border-green-100 rounded-2xl flex items-center gap-3 text-green-700">
                                    <CheckCircle className="w-5 h-5 flex-shrink-0" />
                                    <span className="font-medium text-sm">Asset successfully registered in database.</span>
                                </div>
                            )}

                            {status === 'error' && (
                                <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-700">
                                    <AlertCircle className="w-5 h-5 flex-shrink-0" />
                                    <span className="font-medium text-sm">{errorMsg}</span>
                                </div>
                            )}

                            {/* Basic Details */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Label Name</label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="e.g. Pump House 1"
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all placeholder:text-slate-300 text-slate-700"
                                        value={formData.label}
                                        onChange={e => setFormData({ ...formData, label: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Device Code (Unique)</label>
                                    <input
                                        type="text"
                                        required
                                        placeholder="e.g. ph-01"
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all placeholder:text-slate-300 font-mono text-sm"
                                        value={formData.node_key}
                                        onChange={e => setFormData({ ...formData, node_key: e.target.value.toLowerCase() })}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Category</label>
                                    <select
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all appearance-none cursor-pointer"
                                        value={formData.category}
                                        onChange={e => setFormData({ ...formData, category: e.target.value as NodeCategory })}
                                    >
                                        {categories.map(cat => (
                                            <option key={cat} value={cat}>{cat}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Location Name</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. ATM Gate"
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all text-slate-700"
                                        value={formData.location_name}
                                        onChange={e => setFormData({ ...formData, location_name: e.target.value })}
                                    />
                                </div>
                            </div>

                            {/* GPS & Capacity */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Latitude</label>
                                    <div className="relative">
                                        <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                        <input
                                            type="text"
                                            placeholder="17.4456"
                                            className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all font-mono text-sm"
                                            value={formData.lat}
                                            onChange={e => setFormData({ ...formData, lat: e.target.value })}
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Longitude</label>
                                    <div className="relative">
                                        <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                        <input
                                            type="text"
                                            placeholder="78.3516"
                                            className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all font-mono text-sm"
                                            value={formData.lng}
                                            onChange={e => setFormData({ ...formData, lng: e.target.value })}
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Capacity</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. 5.0L L"
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all text-slate-700"
                                        value={formData.capacity}
                                        onChange={e => setFormData({ ...formData, capacity: e.target.value })}
                                    />
                                </div>
                            </div>

                            {/* ThingSpeak Integration */}
                            <div className="pt-4 border-t border-slate-100 mt-4">
                                <div className="flex items-center gap-2 mb-6">
                                    <Radio className="w-4 h-4 text-blue-500" />
                                    <h4 className="text-sm font-bold text-slate-700 uppercase">ThingSpeak Integration</h4>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Channel ID</label>
                                        <input
                                            type="text"
                                            placeholder="e.g. 3212670"
                                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all font-mono text-sm"
                                            value={formData.thingspeak_channel_id}
                                            onChange={e => setFormData({ ...formData, thingspeak_channel_id: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Read API Key</label>
                                        <input
                                            type="text"
                                            placeholder="e.g. UXORK5..."
                                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all font-mono text-sm"
                                            value={formData.thingspeak_read_api_key}
                                            onChange={e => setFormData({ ...formData, thingspeak_read_api_key: e.target.value })}
                                        />
                                    </div>
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-2 transition-all transform active:scale-[0.98] shadow-lg shadow-slate-200 disabled:opacity-50"
                            >
                                {loading ? (
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                ) : (
                                    <>
                                        <Plus className="w-5 h-5" />
                                        Register Infrastructure Asset
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                </div>

                {/* Info & Help */}
                <div className="space-y-6">
                    <div className="bg-gradient-to-br from-indigo-900 to-blue-900 rounded-3xl p-6 text-white shadow-xl shadow-blue-100">
                        <Activity className="w-10 h-10 text-blue-400 mb-4" />
                        <h3 className="text-xl font-bold mb-2">Live Sync</h3>
                        <p className="text-blue-100 text-sm leading-relaxed">
                            Assets added here are instantly available across all dashboard views. Ensure coordinates and ThingSpeak keys are verified before submission.
                        </p>
                    </div>

                    <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm">
                        <h4 className="text-xs font-bold text-slate-400 uppercase mb-4 tracking-widest">Analytics Mapping</h4>
                        <div className="space-y-4">
                            <div className="flex items-start gap-3">
                                <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 font-bold text-xs flex-shrink-0">T</div>
                                <div>
                                    <div className="text-sm font-bold text-slate-700">EvaraTank</div>
                                    <p className="text-xs text-slate-500">Auto-mapped for OHT & Sump</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3">
                                <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold text-xs flex-shrink-0">D</div>
                                <div>
                                    <div className="text-sm font-bold text-slate-700">EvaraDeep</div>
                                    <p className="text-xs text-slate-500">Auto-mapped for Borewells</p>
                                </div>
                            </div>
                            <div className="flex items-start gap-3">
                                <div className="w-8 h-8 rounded-lg bg-cyan-50 flex items-center justify-center text-cyan-600 font-bold text-xs flex-shrink-0">F</div>
                                <div>
                                    <div className="text-sm font-bold text-slate-700">EvaraFlow</div>
                                    <p className="text-xs text-slate-500">Auto-mapped for Pump Houses</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdminNodes;
