import { useState } from 'react';
import { X, MapPin, Building2, Mail, Phone } from 'lucide-react';
import { useRegions } from '../hooks/useRegions';
import { useCreateCommunity } from '../hooks/useCommunities';
import { useToast } from './ToastProvider';

interface AddCommunityFormProps {
    onClose: () => void;
    onSuccess?: () => void;
}

export default function AddCommunityForm({ onClose, onSuccess }: AddCommunityFormProps) {
    const { regions, isLoading: loadingRegions } = useRegions();
    const createCommunity = useCreateCommunity();
    const { showToast } = useToast();

    const [formData, setFormData] = useState({
        name: '',
        region_id: '',
        address: '',
        contact_email: '',
        contact_phone: '',
    });

    const [errors, setErrors] = useState<Record<string, string>>({});

    const validate = () => {
        const newErrors: Record<string, string> = {};
        
        if (!formData.name.trim()) {
            newErrors.name = 'Community name is required';
        }
        if (!formData.region_id) {
            newErrors.region_id = 'Region is required';
        }
        if (!formData.address.trim()) {
            newErrors.address = 'Address is required';
        }
        if (formData.contact_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.contact_email)) {
            newErrors.contact_email = 'Invalid email format';
        }
        if (formData.contact_phone && !/^\+?[\d\s-()]+$/.test(formData.contact_phone)) {
            newErrors.contact_phone = 'Invalid phone format';
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

        try {
            await createCommunity.mutateAsync(formData);
            showToast('Community Successfully Added', 'success');
            onSuccess?.();
            onClose();
        } catch (error: any) {
            showToast(error.response?.data?.detail || 'Failed to create community', 'error');
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
                            <Building2 className="text-blue-600" size={20} />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-slate-900">Add Community</h2>
                            <p className="text-sm text-slate-500">Create a new community in your region</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center transition-colors"
                    >
                        <X size={20} className="text-slate-500" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-5">
                    {/* Region Selection */}
                    <div>
                        <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
                            <MapPin size={16} />
                            Region *
                        </label>
                        <select
                            value={formData.region_id}
                            onChange={(e) => setFormData({ ...formData, region_id: e.target.value })}
                            className={`w-full px-4 py-3 rounded-xl border ${
                                errors.region_id ? 'border-red-300 bg-red-50' : 'border-slate-200'
                            } focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all`}
                            disabled={loadingRegions}
                        >
                            <option value="">Select a region</option>
                            {regions?.map((region) => (
                                <option key={region.id} value={region.id}>
                                    {region.name}, {region.state}
                                </option>
                            ))}
                        </select>
                        {errors.region_id && (
                            <p className="text-xs text-red-600 mt-1">{errors.region_id}</p>
                        )}
                    </div>

                    {/* Community Name */}
                    <div>
                        <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
                            <Building2 size={16} />
                            Community Name *
                        </label>
                        <input
                            type="text"
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            placeholder="e.g., Green Valley Apartments"
                            className={`w-full px-4 py-3 rounded-xl border ${
                                errors.name ? 'border-red-300 bg-red-50' : 'border-slate-200'
                            } focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all`}
                        />
                        {errors.name && (
                            <p className="text-xs text-red-600 mt-1">{errors.name}</p>
                        )}
                    </div>

                    {/* Address */}
                    <div>
                        <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
                            <MapPin size={16} />
                            Address *
                        </label>
                        <textarea
                            value={formData.address}
                            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                            placeholder="Full address with landmarks"
                            rows={3}
                            className={`w-full px-4 py-3 rounded-xl border ${
                                errors.address ? 'border-red-300 bg-red-50' : 'border-slate-200'
                            } focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all resize-none`}
                        />
                        {errors.address && (
                            <p className="text-xs text-red-600 mt-1">{errors.address}</p>
                        )}
                    </div>

                    {/* Contact Email */}
                    <div>
                        <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
                            <Mail size={16} />
                            Contact Email
                        </label>
                        <input
                            type="email"
                            value={formData.contact_email}
                            onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
                            placeholder="community@example.com"
                            className={`w-full px-4 py-3 rounded-xl border ${
                                errors.contact_email ? 'border-red-300 bg-red-50' : 'border-slate-200'
                            } focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all`}
                        />
                        {errors.contact_email && (
                            <p className="text-xs text-red-600 mt-1">{errors.contact_email}</p>
                        )}
                    </div>

                    {/* Contact Phone */}
                    <div>
                        <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
                            <Phone size={16} />
                            Contact Phone
                        </label>
                        <input
                            type="tel"
                            value={formData.contact_phone}
                            onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
                            placeholder="+91 98765 43210"
                            className={`w-full px-4 py-3 rounded-xl border ${
                                errors.contact_phone ? 'border-red-300 bg-red-50' : 'border-slate-200'
                            } focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all`}
                        />
                        {errors.contact_phone && (
                            <p className="text-xs text-red-600 mt-1">{errors.contact_phone}</p>
                        )}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-6 py-3 rounded-xl border border-slate-200 text-slate-700 font-semibold hover:bg-slate-50 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={createCommunity.isPending}
                            className="flex-1 px-6 py-3 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            {createCommunity.isPending ? 'Creating...' : 'Create Community'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
