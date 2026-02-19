import { useState } from 'react';
import { adminService } from '../../../services/admin';
import { Loader2, Database, Wifi, MapPin, Settings2, User, ChevronRight, Check } from 'lucide-react';

interface AddDeviceFormProps {
    onSubmit: (data: any) => void;
    onCancel: () => void;
    communities: any[];
    customers: any[];
}

export const AddDeviceForm = ({ onSubmit, onCancel, communities, customers }: AddDeviceFormProps) => {
    const [step, setStep] = useState(1); // 1 = Identity, 2 = Config
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Form State
    const [formData, setFormData] = useState({
        hardware_id: '',
        device_label: '',
        device_type: 'tank', // physical category
        analytics_type: 'EvaraTank', // software template
        community_id: '',
        customer_id: '',
        lat: '',
        long: '',
        thingspeak: {
            channel_id: '',
            read_api_key: '',
            write_api_key: '',
            field_mapping: {
                level: 'field1',
                battery: 'field2',
                signal: 'field3'
            } as Record<string, string>
        },
        config: {
            capacity: '',
            max_depth: '',
            static_depth: '',
            dynamic_depth: '',
            recharge_threshold: '',
            pipe_diameter: '',
            max_flow_rate: ''
        }
    });

    const filteredCustomers = customers.filter(c => !formData.community_id || c.community_id === formData.community_id);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            // Prepare payload
            const payload: any = {
                hardware_id: formData.hardware_id,
                device_label: formData.device_label,
                device_type: formData.device_type,
                analytics_type: formData.analytics_type,
                community_id: formData.community_id || null,
                customer_id: formData.customer_id || null,
                lat: formData.lat ? parseFloat(formData.lat) : null,
                long: formData.long ? parseFloat(formData.long) : null,
                thingspeak_mapping: formData.thingspeak.channel_id ? {
                    channel_id: formData.thingspeak.channel_id,
                    read_api_key: formData.thingspeak.read_api_key,
                    write_api_key: formData.thingspeak.write_api_key,
                    field_mapping: formData.thingspeak.field_mapping
                } : null
            };

            // Add specialized config
            const cfg = formData.config;
            if (formData.analytics_type === 'EvaraTank') {
                payload.config_tank = {
                    capacity: parseInt(cfg.capacity) || 0,
                    max_depth: parseFloat(cfg.max_depth) || 0
                };
            } else if (formData.analytics_type === 'EvaraDeep') {
                payload.config_deep = {
                    static_depth: parseFloat(cfg.static_depth) || 0,
                    dynamic_depth: parseFloat(cfg.dynamic_depth) || 0,
                    recharge_threshold: parseFloat(cfg.recharge_threshold) || 0
                };
            } else if (formData.analytics_type === 'EvaraFlow') {
                payload.config_flow = {
                    pipe_diameter: parseFloat(cfg.pipe_diameter) || 0,
                    max_flow_rate: parseFloat(cfg.max_flow_rate) || 0
                };
            }

            const result = await adminService.createDevice(payload);
            onSubmit(result);
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Failed to provision device.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const inputCls = "w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:border-green-500 focus:ring-1 focus:ring-green-500 outline-none transition-all";
    const labelCls = "block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 ml-1";
    const sectionTitleCls = "flex items-center gap-2 text-xs font-bold text-slate-800 uppercase tracking-wider mb-4 border-l-4 border-green-500 pl-3";

    const StepIndicator = ({ current }: { current: number }) => (
        <div className="flex items-center justify-center gap-4 mb-6">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${current >= 1 ? 'bg-green-600 text-white' : 'bg-slate-200 text-slate-500'}`}>1</div>
            <div className={`w-16 h-1 rounded-full transition-all ${current >= 2 ? 'bg-green-600' : 'bg-slate-200'}`} />
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${current >= 2 ? 'bg-green-600 text-white' : 'bg-slate-200 text-slate-500'}`}>2</div>
        </div>
    );

    return (
        <div className="flex flex-col h-[75vh]">
            <StepIndicator current={step} />

            {error && (
                <div className="mb-4 p-4 bg-red-50 border border-red-100 text-red-600 text-xs rounded-xl flex items-center gap-3 shrink-0">
                    <span className="w-2 h-2 rounded-full bg-red-500" />
                    {error}
                </div>
            )}

            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-1 pr-3 scrollbar-hide">

                {/* STEP 1: IDENTITY & CONTEXT */}
                {step === 1 && (
                    <div className="space-y-8 animate-fadeIn">
                        {/* 1. Basic Identity */}
                        <div>
                            <h3 className={sectionTitleCls}><Database size={14} /> Basic Identity</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className={labelCls}>Hardware ID</label>
                                    <input
                                        required
                                        value={formData.hardware_id}
                                        onChange={e => setFormData({ ...formData, hardware_id: e.target.value })}
                                        placeholder="EV-TNK-001"
                                        className={inputCls}
                                        autoFocus
                                    />
                                </div>
                                <div>
                                    <label className={labelCls}>Device Label</label>
                                    <input
                                        required
                                        value={formData.device_label}
                                        onChange={e => setFormData({ ...formData, device_label: e.target.value })}
                                        placeholder="Main Sump"
                                        className={inputCls}
                                    />
                                </div>
                                <div>
                                    <label className={labelCls}>Physical Category</label>
                                    <select
                                        className={inputCls}
                                        value={formData.device_type}
                                        onChange={e => setFormData({ ...formData, device_type: e.target.value })}
                                    >
                                        <option value="tank">Tank / Container</option>
                                        <option value="deep">Deep Well / Borewell</option>
                                        <option value="flow">Pipeline / Meter</option>
                                        <option value="custom">Custom Sensor</option>
                                    </select>
                                </div>
                                <div>
                                    <label className={labelCls}>Analytics Template</label>
                                    <select
                                        className={inputCls}
                                        value={formData.analytics_type}
                                        onChange={e => setFormData({ ...formData, analytics_type: e.target.value })}
                                    >
                                        <option value="EvaraTank">EvaraTank (Level/Vol)</option>
                                        <option value="EvaraDeep">EvaraDeep (Drawdown)</option>
                                        <option value="EvaraFlow">EvaraFlow (Consumption)</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* 2. Hierarchy & Ownership */}
                        <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100">
                            <h3 className={sectionTitleCls}><User size={14} /> Assignment</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className={labelCls}>Community</label>
                                    <select
                                        className={inputCls}
                                        value={formData.community_id}
                                        onChange={e => setFormData({ ...formData, community_id: e.target.value, customer_id: '' })}
                                    >
                                        <option value="">Select Community</option>
                                        {communities.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className={labelCls}>Customer Account</label>
                                    <select
                                        className={inputCls}
                                        value={formData.customer_id}
                                        onChange={e => setFormData({ ...formData, customer_id: e.target.value })}
                                    >
                                        <option value="">Select Customer</option>
                                        {filteredCustomers.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* STEP 2: TELEMETRY & CONFIG */}
                {step === 2 && (
                    <div className="space-y-8 animate-fadeIn">
                        {/* 3. Telemetry (ThingSpeak) */}
                        <div>
                            <h3 className={sectionTitleCls}><Wifi size={14} /> Telemetry Handshake</h3>
                            <div className="bg-white p-5 rounded-2xl border border-slate-200">
                                <div className="grid grid-cols-2 gap-4 mb-4">
                                    <div className="col-span-2">
                                        <label className={labelCls}>ThingSpeak Channel ID</label>
                                        <input
                                            required
                                            value={formData.thingspeak.channel_id}
                                            onChange={e => setFormData({
                                                ...formData,
                                                thingspeak: { ...formData.thingspeak, channel_id: e.target.value }
                                            })}
                                            placeholder="e.g. 2489123"
                                            className={inputCls}
                                            autoFocus
                                        />
                                    </div>
                                    <div>
                                        <label className={labelCls}>Read API Key</label>
                                        <input
                                            value={formData.thingspeak.read_api_key}
                                            onChange={e => setFormData({
                                                ...formData,
                                                thingspeak: { ...formData.thingspeak, read_api_key: e.target.value }
                                            })}
                                            placeholder="ABC123XYZ"
                                            className={inputCls}
                                        />
                                    </div>
                                    <div>
                                        <label className={labelCls}>Write API Key (Optional)</label>
                                        <input
                                            value={formData.thingspeak.write_api_key}
                                            onChange={e => setFormData({
                                                ...formData,
                                                thingspeak: { ...formData.thingspeak, write_api_key: e.target.value }
                                            })}
                                            placeholder="Optional"
                                            className={inputCls}
                                        />
                                    </div>
                                </div>
                                <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-100">
                                    <p className={labelCls} style={{ marginBottom: '8px' }}>Field Parameter Mapping</p>
                                    <div className="grid grid-cols-3 gap-2">
                                        {Object.entries(formData.thingspeak.field_mapping).map(([param, mapped]) => (
                                            <div key={param}>
                                                <label className="text-[9px] font-bold text-blue-600 block mb-1 uppercase pl-1">{param}</label>
                                                <select
                                                    className="w-full text-xs p-1.5 border border-blue-200 rounded-lg outline-none bg-white"
                                                    value={mapped}
                                                    onChange={e => setFormData({
                                                        ...formData,
                                                        thingspeak: {
                                                            ...formData.thingspeak,
                                                            field_mapping: { ...formData.thingspeak.field_mapping, [param]: e.target.value }
                                                        }
                                                    })}
                                                >
                                                    {[1, 2, 3, 4, 5, 6, 7, 8].map(n => <option key={n} value={`field${n}`}>Field {n}</option>)}
                                                </select>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* 4. Physical Specs */}
                        <div>
                            <h3 className={sectionTitleCls}><Settings2 size={14} /> Physical Specifications</h3>
                            <div className="p-5 bg-green-50/30 rounded-2xl border border-green-100">
                                {formData.analytics_type === 'EvaraTank' && (
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className={labelCls}>Capacity (Liters)</label>
                                            <input
                                                type="number"
                                                value={formData.config.capacity}
                                                onChange={e => setFormData({ ...formData, config: { ...formData.config, capacity: e.target.value } })}
                                                className={inputCls}
                                            />
                                        </div>
                                        <div>
                                            <label className={labelCls}>Max Depth (Meters)</label>
                                            <input
                                                type="number"
                                                step="0.1"
                                                value={formData.config.max_depth}
                                                onChange={e => setFormData({ ...formData, config: { ...formData.config, max_depth: e.target.value } })}
                                                className={inputCls}
                                            />
                                        </div>
                                    </div>
                                )}
                                {formData.analytics_type === 'EvaraDeep' && (
                                    <div className="grid grid-cols-3 gap-4">
                                        <div>
                                            <label className={labelCls}>Static Level (m)</label>
                                            <input
                                                type="number"
                                                value={formData.config.static_depth}
                                                onChange={e => setFormData({ ...formData, config: { ...formData.config, static_depth: e.target.value } })}
                                                className={inputCls}
                                            />
                                        </div>
                                        <div>
                                            <label className={labelCls}>Dynamic Level (m)</label>
                                            <input
                                                type="number"
                                                value={formData.config.dynamic_depth}
                                                onChange={e => setFormData({ ...formData, config: { ...formData.config, dynamic_depth: e.target.value } })}
                                                className={inputCls}
                                            />
                                        </div>
                                        <div>
                                            <label className={labelCls}>Recharge Thres.</label>
                                            <input
                                                type="number"
                                                value={formData.config.recharge_threshold}
                                                onChange={e => setFormData({ ...formData, config: { ...formData.config, recharge_threshold: e.target.value } })}
                                                className={inputCls}
                                            />
                                        </div>
                                    </div>
                                )}
                                {formData.analytics_type === 'EvaraFlow' && (
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className={labelCls}>Pipe Diameter (mm)</label>
                                            <input
                                                type="number"
                                                value={formData.config.pipe_diameter}
                                                onChange={e => setFormData({ ...formData, config: { ...formData.config, pipe_diameter: e.target.value } })}
                                                className={inputCls}
                                            />
                                        </div>
                                        <div>
                                            <label className={labelCls}>Max Flow (m³/h)</label>
                                            <input
                                                type="number"
                                                value={formData.config.max_flow_rate}
                                                onChange={e => setFormData({ ...formData, config: { ...formData.config, max_flow_rate: e.target.value } })}
                                                className={inputCls}
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* 5. Geography */}
                        <div className="mb-4">
                            <h3 className={sectionTitleCls}><MapPin size={14} /> Geographic Placement</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className={labelCls}>Latitude</label>
                                    <input
                                        type="number"
                                        step="0.000001"
                                        value={formData.lat}
                                        onChange={e => setFormData({ ...formData, lat: e.target.value })}
                                        placeholder="e.g. 17.448"
                                        className={inputCls}
                                    />
                                </div>
                                <div>
                                    <label className={labelCls}>Longitude</label>
                                    <input
                                        type="number"
                                        step="0.000001"
                                        value={formData.long}
                                        onChange={e => setFormData({ ...formData, long: e.target.value })}
                                        placeholder="e.g. 78.384"
                                        className={inputCls}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </form>

            {/* ACTION BAR */}
            <div className="shrink-0 mt-4 pt-4 border-t border-slate-100 flex justify-end gap-3 bg-white">
                <button
                    type="button"
                    onClick={step === 1 ? onCancel : () => setStep(1)}
                    disabled={loading}
                    className="px-6 py-2.5 text-sm font-bold text-slate-500 hover:text-slate-800 transition-colors"
                >
                    {step === 1 ? 'Discard' : 'Back'}
                </button>

                {step === 1 ? (
                    <button
                        type="button"
                        onClick={() => setStep(2)}
                        disabled={!formData.hardware_id || !formData.device_label}
                        className="flex items-center gap-2 px-8 py-2.5 bg-blue-600 text-white text-sm font-bold rounded-2xl hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all disabled:opacity-50"
                    >
                        Next Step <ChevronRight size={16} />
                    </button>
                ) : (
                    <button
                        type="submit"
                        onClick={handleSubmit}
                        disabled={loading}
                        className="flex items-center gap-3 px-8 py-2.5 bg-green-600 text-white text-sm font-bold rounded-2xl hover:bg-green-700 shadow-lg shadow-green-200 transition-all disabled:opacity-50"
                    >
                        {loading && <Loader2 size={16} className="animate-spin" />}
                        {loading ? 'Commissioning...' : 'Commission Node'}
                    </button>
                )}
            </div>
        </div>
    );
};
