import React, { useState, useMemo } from 'react';
import { Plus, Server, MapPin, Radio, Activity, Database, CheckCircle, AlertCircle, Loader2, Ruler, Waves } from 'lucide-react';
import { adminService } from '../../services/admin';
import type { NodeCategory, AnalyticsType } from '../../types/database';

const AdminNodes = () => {
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
    const [errorMsg, setErrorMsg] = useState('');
    const [createdId, setCreatedId] = useState<string | null>(null);

    const [formData, setFormData] = useState({
        label: '',
        node_key: '',
        category: 'OHT' as NodeCategory,
        location_name: '',
        lat: '',
        lng: '',
        thingspeak_channel_id: '',
        thingspeak_read_key: '',
        // Tank dimensions
        height_m: '',
        length_m: '',
        breadth_m: '',
        radius_m: '',
        capacity_liters: '',
        water_level_field: 'field1',
        temperature_field: 'field2',
        tank_shape: 'rectangular',
        // Deep-well fields
        total_bore_depth: '',
        static_water_level: '',
        depth_field: 'field2',
        // Flow fields
        pipe_diameter: '',
        max_flow_rate: '',
    });

    const categories: NodeCategory[] = ['OHT', 'Sump', 'Borewell', 'GovtBorewell', 'PumpHouse', 'FlowMeter'];

    // Derive analytics template from selected category
    const analyticsTemplate = useMemo<AnalyticsType>(() => {
        if (formData.category === 'Borewell' || formData.category === 'GovtBorewell') return 'EvaraDeep';
        if (formData.category === 'PumpHouse' || formData.category === 'FlowMeter') return 'EvaraFlow';
        return 'EvaraTank';
    }, [formData.category]);

    const isTank = analyticsTemplate === 'EvaraTank';
    const isDeep = analyticsTemplate === 'EvaraDeep';
    const isFlow = analyticsTemplate === 'EvaraFlow';

    const set = (field: string, value: string) => setFormData(prev => ({ ...prev, [field]: value }));

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setStatus('idle');
        setCreatedId(null);

        try {
            const result = await adminService.createDevice({
                label: formData.label,
                node_key: formData.node_key,
                location_name: formData.location_name,
                thingspeak_channel_id: formData.thingspeak_channel_id || null,
                thingspeak_read_key: formData.thingspeak_read_key || null,
                latitude: parseFloat(formData.lat) || null,
                longitude: parseFloat(formData.lng) || null,
                analytics_template: analyticsTemplate,
                // Tank
                ...(isTank && {
                    tank_shape: formData.tank_shape,
                    height_m: formData.height_m ? parseFloat(formData.height_m) : null,
                    length_m: formData.length_m ? parseFloat(formData.length_m) : null,
                    breadth_m: formData.breadth_m ? parseFloat(formData.breadth_m) : null,
                    radius_m: formData.radius_m ? parseFloat(formData.radius_m) : null,
                    capacity_liters: formData.capacity_liters ? parseFloat(formData.capacity_liters) : null,
                    water_level_field: formData.water_level_field || 'field1',
                    temperature_field: formData.temperature_field || 'field2',
                }),
                // Deep well
                ...(isDeep && {
                    depth_field: formData.depth_field || 'field2',
                    temperature_field: formData.temperature_field || 'field1',
                    total_bore_depth: formData.total_bore_depth ? parseFloat(formData.total_bore_depth) : null,
                    static_water_level: formData.static_water_level ? parseFloat(formData.static_water_level) : null,
                }),
                // Flow meter
                ...(isFlow && {
                    pipe_diameter: formData.pipe_diameter ? parseFloat(formData.pipe_diameter) : null,
                    max_flow_rate: formData.max_flow_rate ? parseFloat(formData.max_flow_rate) : null,
                }),
            });
            setCreatedId(result?.id || result?.data?.id || null);
            setStatus('success');
            setFormData({
                label: '', node_key: '', category: 'OHT', location_name: '',
                lat: '', lng: '', thingspeak_channel_id: '', thingspeak_read_key: '',
                height_m: '', length_m: '', breadth_m: '', radius_m: '', capacity_liters: '',
                water_level_field: 'field1', temperature_field: 'field2', tank_shape: 'rectangular',
                total_bore_depth: '', static_water_level: '', depth_field: 'field2',
                pipe_diameter: '', max_flow_rate: '',
            });
        } catch (err: any) {
            setStatus('error');
            setErrorMsg(err.response?.data?.detail || err.message || "Failed to add device. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const inputCls = "w-full px-4 py-3 apple-glass-inner border border-slate-200 rounded-xl focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 outline-none transition-all text-slate-700 placeholder:text-slate-300";
    const labelCls = "block text-xs font-bold text-slate-500 uppercase mb-2";

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
                    <form onSubmit={handleSubmit} className="apple-glass-card rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden">
                        <div className="p-1 px-8 apple-glass-inner border-b border-slate-100 flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-400 uppercase tracking-widest py-4">New Asset Provisioning</span>
                            <Server className="w-4 h-4 text-slate-300" />
                        </div>

                        <div className="p-8 space-y-6">
                            {status === 'success' && (
                                <div className="p-4 bg-green-50 border border-green-100 rounded-2xl flex flex-col gap-1 text-green-700">
                                    <div className="flex items-center gap-2">
                                        <CheckCircle className="w-5 h-5 flex-shrink-0" />
                                        <span className="font-bold text-sm">Asset successfully registered!</span>
                                    </div>
                                    {createdId && (
                                        <p className="text-xs text-green-600 font-mono pl-7">Device ID: {createdId}</p>
                                    )}
                                    <p className="text-xs text-green-600 pl-7">You can now navigate to this device from All Nodes to see live data.</p>
                                </div>
                            )}

                            {status === 'error' && (
                                <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-700">
                                    <AlertCircle className="w-5 h-5 flex-shrink-0" />
                                    <span className="font-medium text-sm">{errorMsg}</span>
                                </div>
                            )}

                            {/* ── Basic Info ── */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className={labelCls}>Label Name *</label>
                                    <input type="text" required placeholder="e.g. KRB Tank Block-A"
                                        className={inputCls} value={formData.label}
                                        onChange={e => set('label', e.target.value)} />
                                </div>
                                <div>
                                    <label className={labelCls}>Device Code (Unique) *</label>
                                    <input type="text" required placeholder="e.g. krb-tank-01"
                                        className={`${inputCls} font-mono text-sm`} value={formData.node_key}
                                        onChange={e => set('node_key', e.target.value.toLowerCase())} />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className={labelCls}>Category *</label>
                                    <select className={inputCls} value={formData.category}
                                        onChange={e => set('category', e.target.value)}>
                                        {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                                    </select>
                                    <p className="text-[10px] text-slate-400 mt-1">
                                        → Analytics: <span className="font-bold text-blue-600">{analyticsTemplate}</span>
                                    </p>
                                </div>
                                <div>
                                    <label className={labelCls}>Location Name</label>
                                    <input type="text" placeholder="e.g. ATM Gate"
                                        className={inputCls} value={formData.location_name}
                                        onChange={e => set('location_name', e.target.value)} />
                                </div>
                            </div>

                            {/* ── GPS ── */}
                            <div className="grid grid-cols-2 gap-6">
                                <div>
                                    <label className={labelCls}>Latitude</label>
                                    <div className="relative">
                                        <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                        <input type="number" step="any" placeholder="17.4456"
                                            className={`${inputCls} pl-10 font-mono text-sm`} value={formData.lat}
                                            onChange={e => set('lat', e.target.value)} />
                                    </div>
                                </div>
                                <div>
                                    <label className={labelCls}>Longitude</label>
                                    <div className="relative">
                                        <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                        <input type="number" step="any" placeholder="78.3516"
                                            className={`${inputCls} pl-10 font-mono text-sm`} value={formData.lng}
                                            onChange={e => set('lng', e.target.value)} />
                                    </div>
                                </div>
                            </div>

                            {/* ── ThingSpeak ── */}
                            <div className="pt-4 border-t border-slate-100">
                                <div className="flex items-center gap-2 mb-4">
                                    <Radio className="w-4 h-4 text-blue-500" />
                                    <h4 className="text-sm font-bold text-slate-700 uppercase">ThingSpeak Credentials</h4>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div>
                                        <label className={labelCls}>Channel ID *</label>
                                        <input type="text" required placeholder="e.g. 3212670"
                                            className={`${inputCls} font-mono text-sm`} value={formData.thingspeak_channel_id}
                                            onChange={e => set('thingspeak_channel_id', e.target.value)} />
                                    </div>
                                    <div>
                                        <label className={labelCls}>Read API Key *</label>
                                        <input type="text" required placeholder="e.g. UXORK5XXXXXXXX"
                                            className={`${inputCls} font-mono text-sm`} value={formData.thingspeak_read_key}
                                            onChange={e => set('thingspeak_read_key', e.target.value)} />
                                    </div>
                                </div>
                            </div>

                            {/* ── EvaraTank Dimensions ── */}
                            {isTank && (
                                <div className="pt-4 border-t border-slate-100">
                                    <div className="flex items-center gap-2 mb-4">
                                        <Ruler className="w-4 h-4 text-indigo-500" />
                                        <h4 className="text-sm font-bold text-slate-700 uppercase">Tank Dimensions</h4>
                                        <span className="text-[10px] bg-amber-100 text-amber-700 font-bold px-2 py-0.5 rounded-full ml-1">Required for level %</span>
                                    </div>
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
                                        <div>
                                            <label className={labelCls}>Height (m) *</label>
                                            <input type="number" step="0.01" min="0.1" placeholder="e.g. 2.5"
                                                className={`${inputCls} font-mono text-sm`} value={formData.height_m}
                                                onChange={e => set('height_m', e.target.value)} required />
                                        </div>
                                        <div>
                                            <label className={labelCls}>Length (m)</label>
                                            <input type="number" step="0.01" min="0" placeholder="e.g. 5.0"
                                                className={`${inputCls} font-mono text-sm`} value={formData.length_m}
                                                onChange={e => set('length_m', e.target.value)} />
                                        </div>
                                        <div>
                                            <label className={labelCls}>Breadth (m)</label>
                                            <input type="number" step="0.01" min="0" placeholder="e.g. 4.0"
                                                className={`${inputCls} font-mono text-sm`} value={formData.breadth_m}
                                                onChange={e => set('breadth_m', e.target.value)} />
                                        </div>
                                        <div>
                                            <label className={labelCls}>Capacity Override (L)</label>
                                            <input type="number" step="1" min="0" placeholder="Optional"
                                                className={`${inputCls} font-mono text-sm`} value={formData.capacity_liters}
                                                onChange={e => set('capacity_liters', e.target.value)} />
                                        </div>
                                        <div>
                                            <label className={labelCls}>Distance Field</label>
                                            <select className={`${inputCls} font-mono text-sm`} value={formData.water_level_field}
                                                onChange={e => set('water_level_field', e.target.value)}>
                                                {['field1','field2','field3','field4','field5','field6','field7','field8'].map(f => (
                                                    <option key={f} value={f}>{f}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className={labelCls}>Temp Field</label>
                                            <select className={`${inputCls} font-mono text-sm`} value={formData.temperature_field}
                                                onChange={e => set('temperature_field', e.target.value)}>
                                                {['field1','field2','field3','field4','field5','field6','field7','field8'].map(f => (
                                                    <option key={f} value={f}>{f}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                    <p className="text-xs text-slate-400 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
                                        ⚠ <strong>Height is critical</strong> — the sensor reports air-gap distance from the top. Level % = (Height − Distance) / Height × 100. If height is wrong, all readings will be wrong.
                                    </p>
                                </div>
                            )}

                            {/* ── EvaraDeep Dimensions ── */}
                            {isDeep && (
                                <div className="pt-4 border-t border-slate-100">
                                    <div className="flex items-center gap-2 mb-4">
                                        <Waves className="w-4 h-4 text-cyan-500" />
                                        <h4 className="text-sm font-bold text-slate-700 uppercase">Borewell / Well Parameters</h4>
                                    </div>
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                        <div>
                                            <label className={labelCls}>Total Bore Depth (m)</label>
                                            <input type="number" step="0.1" min="0" placeholder="e.g. 60"
                                                className={`${inputCls} font-mono text-sm`} value={formData.total_bore_depth}
                                                onChange={e => set('total_bore_depth', e.target.value)} />
                                        </div>
                                        <div>
                                            <label className={labelCls}>Static Water Level (m)</label>
                                            <input type="number" step="0.1" min="0" placeholder="e.g. 10"
                                                className={`${inputCls} font-mono text-sm`} value={formData.static_water_level}
                                                onChange={e => set('static_water_level', e.target.value)} />
                                        </div>
                                        <div>
                                            <label className={labelCls}>Distance Field</label>
                                            <select className={`${inputCls} font-mono text-sm`} value={formData.depth_field}
                                                onChange={e => set('depth_field', e.target.value)}>
                                                {['field1','field2','field3','field4','field5','field6','field7','field8'].map(f => (
                                                    <option key={f} value={f}>{f}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* ── EvaraFlow Dimensions ── */}
                            {isFlow && (
                                <div className="pt-4 border-t border-slate-100">
                                    <div className="flex items-center gap-2 mb-4">
                                        <Activity className="w-4 h-4 text-teal-500" />
                                        <h4 className="text-sm font-bold text-slate-700 uppercase">Flow Meter Parameters</h4>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className={labelCls}>Pipe Diameter (mm)</label>
                                            <input type="number" step="0.1" min="0" placeholder="e.g. 50"
                                                className={`${inputCls} font-mono text-sm`} value={formData.pipe_diameter}
                                                onChange={e => set('pipe_diameter', e.target.value)} />
                                        </div>
                                        <div>
                                            <label className={labelCls}>Max Flow Rate (L/h)</label>
                                            <input type="number" step="0.1" min="0" placeholder="e.g. 1000"
                                                className={`${inputCls} font-mono text-sm`} value={formData.max_flow_rate}
                                                onChange={e => set('max_flow_rate', e.target.value)} />
                                        </div>
                                    </div>
                                </div>
                            )}

                            <button type="submit" disabled={loading}
                                className="w-full btn-liquid-glass btn-liquid-glass-slate font-bold py-4 rounded-2xl flex items-center justify-center gap-2 transition-all transform active:scale-[0.98] disabled:opacity-50">
                                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                                    <><Plus className="w-5 h-5" /> Register Infrastructure Asset</>
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

                    <div className="apple-glass-card rounded-3xl border border-slate-100 p-6 shadow-sm">
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
