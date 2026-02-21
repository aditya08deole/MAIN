import { useState } from 'react';
import { X, Cpu, MapPin, Building2, Key, Gauge } from 'lucide-react';
import { useCommunities } from '../hooks/useCommunities';
import { useRegions } from '../hooks/useRegions';
import { useToast } from './ToastProvider';
import axios from 'axios';

interface AddDeviceFormProps {
    onClose: () => void;
    onSuccess?: () => void;
}

const DEVICE_TYPES = [
    { value: 'tank', label: 'Tank', suggestedTemplate: 'EvaraTank' },
    { value: 'deep', label: 'Deep Well', suggestedTemplate: 'EvaraDeep' },
    { value: 'flow', label: 'Flow Meter', suggestedTemplate: 'EvaraFlow' },
    { value: 'pump', label: 'Pump', suggestedTemplate: 'EvaraFlow' },
    { value: 'sump', label: 'Sump', suggestedTemplate: 'EvaraTank' },
    { value: 'bore', label: 'Borewell', suggestedTemplate: 'EvaraDeep' },
    { value: 'govt', label: 'Government Supply', suggestedTemplate: 'EvaraFlow' },
];

const ANALYTICS_TEMPLATES = ['EvaraTank', 'EvaraDeep', 'EvaraFlow'];

export default function AddDeviceForm({ onClose, onSuccess }: AddDeviceFormProps) {
    const { regions, isLoading: loadingRegions } = useRegions();
    const { showToast } = useToast();

    const [selectedRegion, setSelectedRegion] = useState<string>('');
    const { communities, isLoading: loadingCommunities } = useCommunities(selectedRegion || undefined);

    const [formData, setFormData] = useState({
        name: '',
        device_type: '',
        physical_category: '',
        analytics_template: '',
        community_id: '',
        latitude: '',
        longitude: '',
        capacity: '',
        specifications: '',
        thingspeak_channel_id: '',
        thingspeak_read_key: '',
        thingspeak_write_key: '',
    });

    const [errors, setErrors] = useState<Record<string, string>>({});
    const [validatingThingSpeak, setValidatingThingSpeak] = useState(false);

    const handleDeviceTypeChange = (deviceType: string) => {
        const device = DEVICE_TYPES.find(d => d.value === deviceType);
        setFormData({
            ...formData,
            device_type: deviceType,
            analytics_template: device?.suggestedTemplate || '',
        });
    };

    const validateThingSpeakChannel = async () => {
        const { thingspeak_channel_id, thingspeak_read_key } = formData;
        
        if (!thingspeak_channel_id || !thingspeak_read_key) return true;

        setValidatingThingSpeak(true);
        try {
            const response = await axios.get(
                `https://api.thingspeak.com/channels/${thingspeak_channel_id}/feeds.json?api_key=${thingspeak_read_key}&results=1`
            );
            
            if (response.data && response.data.channel) {
                showToast('ThingSpeak channel validated successfully', 'success');
                return true;
            }
            return false;
        } catch (error) {
            showToast('Invalid ThingSpeak channel or API key', 'error');
            return false;
        } finally {
            setValidatingThingSpeak(false);
        }
    };

    const validate = () => {
        const newErrors: Record<string, string> = {};
        
        if (!formData.name.trim()) {
            newErrors.name = 'Device name is required';
        }
        if (!formData.device_type) {
            newErrors.device_type = 'Device type is required';
        }
        if (!formData.analytics_template) {
            newErrors.analytics_template = 'Analytics template is required';
        }
        if (!formData.community_id) {
            newErrors.community_id = 'Community is required';
        }
        if (!formData.latitude) {
            newErrors.latitude = 'Latitude is required';
        } else if (isNaN(Number(formData.latitude)) || Number(formData.latitude) < -90 || Number(formData.latitude) > 90) {
            newErrors.latitude = 'Invalid latitude (-90 to 90)';
        }
        if (!formData.longitude) {
            newErrors.longitude = 'Longitude is required';
        } else if (isNaN(Number(formData.longitude)) || Number(formData.longitude) < -180 || Number(formData.longitude) > 180) {
            newErrors.longitude = 'Invalid longitude (-180 to 180)';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!validate()) {
            showToast('Please fix validation errors', 'error');
            return;
        }

        // Validate ThingSpeak if provided
        if (formData.thingspeak_channel_id && formData.thingspeak_read_key) {
            const isValid = await validateThingSpeakChannel();
            if (!isValid) return;
        }

        try {
            const token = localStorage.getItem('token');
            await axios.post('/api/v1/devices', {
                name: formData.name,
                device_type: formData.device_type,
                physical_category: formData.physical_category || null,
                analytics_template: formData.analytics_template,
                community_id: formData.community_id,
                latitude: parseFloat(formData.latitude),
                longitude: parseFloat(formData.longitude),
                capacity: formData.capacity || null,
                specifications: formData.specifications || null,
                thingspeak_channel_id: formData.thingspeak_channel_id || null,
                thingspeak_read_key: formData.thingspeak_read_key || null,
                thingspeak_write_key: formData.thingspeak_write_key || null,
                asset_type: formData.device_type, // For backward compatibility
                asset_category: 'Water Management',
                status: 'Online',
                is_active: true,
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            showToast('Device Successfully Added', 'success');
            onSuccess?.();
            onClose();
        } catch (error: any) {
            showToast(error.response?.data?.detail || 'Failed to create device', 'error');
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
                            <Cpu className="text-purple-600" size={20} />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-slate-900">Add Device</h2>
                            <p className="text-sm text-slate-500">Register a new IoT device</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center transition-colors">
                        <X size={20} className="text-slate-500" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        {/* Device Name */}
                        <div className="md:col-span-2">
                            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
                                <Cpu size={16} />
                                Device Name *
                            </label>
                            <input
                                type="text"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                placeholder="e.g., Tank A - Block 1"
                                className={`w-full px-4 py-3 rounded-xl border ${errors.name ? 'border-red-300 bg-red-50' : 'border-slate-200'} focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all`}
                            />
                            {errors.name && <p className="text-xs text-red-600 mt-1">{errors.name}</p>}
                        </div>

                        {/* Device Type */}
                        <div>
                            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
                                <Gauge size={16} />
                                Device Type *
                            </label>
                            <select
                                value={formData.device_type}
                                onChange={(e) => handleDeviceTypeChange(e.target.value)}
                                className={`w-full px-4 py-3 rounded-xl border ${errors.device_type ? 'border-red-300 bg-red-50' : 'border-slate-200'} focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all`}
                            >
                                <option value="">Select device type</option>
                                {DEVICE_TYPES.map((type) => (
                                    <option key={type.value} value={type.value}>{type.label}</option>
                                ))}
                            </select>
                            {errors.device_type && <p className="text-xs text-red-600 mt-1">{errors.device_type}</p>}
                        </div>

                        {/* Analytics Template */}
                        <div>
                            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
                                Analytics Template *
                            </label>
                            <select
                                value={formData.analytics_template}
                                onChange={(e) => setFormData({ ...formData, analytics_template: e.target.value })}
                                className={`w-full px-4 py-3 rounded-xl border ${errors.analytics_template ? 'border-red-300 bg-red-50' : 'border-slate-200'} focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all`}
                            >
                                <option value="">Select template</option>
                                {ANALYTICS_TEMPLATES.map((template) => (
                                    <option key={template} value={template}>{template}</option>
                                ))}
                            </select>
                            {errors.analytics_template && <p className="text-xs text-red-600 mt-1">{errors.analytics_template}</p>}
                        </div>

                        {/* Physical Category */}
                        <div>
                            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
                                Physical Category
                            </label>
                            <input
                                type="text"
                                value={formData.physical_category}
                                onChange={(e) => setFormData({ ...formData, physical_category: e.target.value })}
                                placeholder="e.g., Underground, Rooftop"
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all"
                            />
                        </div>

                        {/* Region */}
                        <div>
                            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
                                <MapPin size={16} />
                                Region
                            </label>
                            <select
                                value={selectedRegion}
                                onChange={(e) => {
                                    setSelectedRegion(e.target.value);
                                    setFormData({ ...formData, community_id: '' });
                                }}
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all"
                                disabled={loadingRegions}
                            >
                                <option value="">All Regions</option>
                                {regions?.map((region) => (
                                    <option key={region.id} value={region.id}>{region.name}, {region.state}</option>
                                ))}
                            </select>
                        </div>

                        {/* Community */}
                        <div className="md:col-span-2">
                            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
                                <Building2 size={16} />
                                Community *
                            </label>
                            <select
                                value={formData.community_id}
                                onChange={(e) => setFormData({ ...formData, community_id: e.target.value })}
                                className={`w-full px-4 py-3 rounded-xl border ${errors.community_id ? 'border-red-300 bg-red-50' : 'border-slate-200'} focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all`}
                                disabled={loadingCommunities}
                            >
                                <option value="">Select community</option>
                                {communities?.map((community) => (
                                    <option key={community.id} value={community.id}>{community.name}</option>
                                ))}
                            </select>
                            {errors.community_id && <p className="text-xs text-red-600 mt-1">{errors.community_id}</p>}
                        </div>

                        {/* Latitude */}
                        <div>
                            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
                                Latitude *
                            </label>
                            <input
                                type="text"
                                value={formData.latitude}
                                onChange={(e) => setFormData({ ...formData, latitude: e.target.value })}
                                placeholder="17.3850"
                                className={`w-full px-4 py-3 rounded-xl border ${errors.latitude ? 'border-red-300 bg-red-50' : 'border-slate-200'} focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all`}
                            />
                            {errors.latitude && <p className="text-xs text-red-600 mt-1">{errors.latitude}</p>}
                        </div>

                        {/* Longitude */}
                        <div>
                            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
                                Longitude *
                            </label>
                            <input
                                type="text"
                                value={formData.longitude}
                                onChange={(e) => setFormData({ ...formData, longitude: e.target.value })}
                                placeholder="78.4867"
                                className={`w-full px-4 py-3 rounded-xl border ${errors.longitude ? 'border-red-300 bg-red-50' : 'border-slate-200'} focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all`}
                            />
                            {errors.longitude && <p className="text-xs text-red-600 mt-1">{errors.longitude}</p>}
                        </div>

                        {/* Capacity */}
                        <div>
                            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
                                Capacity
                            </label>
                            <input
                                type="text"
                                value={formData.capacity}
                                onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
                                placeholder="e.g., 10000 L"
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all"
                            />
                        </div>

                        {/* Specifications */}
                        <div>
                            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
                                Specifications
                            </label>
                            <input
                                type="text"
                                value={formData.specifications}
                                onChange={(e) => setFormData({ ...formData, specifications: e.target.value })}
                                placeholder="Technical details"
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all"
                            />
                        </div>

                        {/* ThingSpeak Section */}
                        <div className="md:col-span-2 border-t pt-5 mt-2">
                            <h3 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
                                <Key size={16} />
                                ThingSpeak Integration (Optional)
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <label className="text-xs font-semibold text-slate-600 mb-1 block">Channel ID</label>
                                    <input
                                        type="text"
                                        value={formData.thingspeak_channel_id}
                                        onChange={(e) => setFormData({ ...formData, thingspeak_channel_id: e.target.value })}
                                        placeholder="2719876"
                                        className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-slate-600 mb-1 block">Read API Key</label>
                                    <input
                                        type="text"
                                        value={formData.thingspeak_read_key}
                                        onChange={(e) => setFormData({ ...formData, thingspeak_read_key: e.target.value })}
                                        placeholder="ABC123XYZ"
                                        className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-semibold text-slate-600 mb-1 block">Write API Key</label>
                                    <input
                                        type="text"
                                        value={formData.thingspeak_write_key}
                                        onChange={(e) => setFormData({ ...formData, thingspeak_write_key: e.target.value })}
                                        placeholder="DEF456UVW"
                                        className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-purple-500"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3 pt-6 mt-6 border-t">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-6 py-3 rounded-xl border border-slate-200 text-slate-700 font-semibold hover:bg-slate-50 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={validatingThingSpeak}
                            className="flex-1 px-6 py-3 rounded-xl bg-purple-600 text-white font-semibold hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            {validatingThingSpeak ? 'Validating...' : 'Create Device'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
