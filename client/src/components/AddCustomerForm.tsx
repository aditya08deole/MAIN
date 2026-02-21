import { useState } from 'react';
import { X, User, Mail, Lock, Building2, MapPin } from 'lucide-react';
import { useRegions } from '../hooks/useRegions';
import { useCommunities } from '../hooks/useCommunities';
import { useCreateCustomer } from '../hooks/useCustomers';
import { useToast } from './ToastProvider';

interface AddCustomerFormProps {
    onClose: () => void;
    onSuccess?: () => void;
}

export default function AddCustomerForm({ onClose, onSuccess }: AddCustomerFormProps) {
    const { regions, isLoading: loadingRegions } = useRegions();
    const createCustomer = useCreateCustomer();
    const { showToast } = useToast();

    const [selectedRegion, setSelectedRegion] = useState<string>('');
    const { communities, isLoading: loadingCommunities } = useCommunities(selectedRegion || undefined);

    const [formData, setFormData] = useState({
        display_name: '',
        email: '',
        password: '',
        community_id: '',
    });

    const [errors, setErrors] = useState<Record<string, string>>({});

    const validate = () => {
        const newErrors: Record<string, string> = {};
        
        if (!formData.display_name.trim()) {
            newErrors.display_name = 'Name is required';
        }
        if (!formData.email.trim()) {
            newErrors.email = 'Email is required';
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
            newErrors.email = 'Invalid email format';
        }
        if (!formData.password) {
            newErrors.password = 'Password is required';
        } else if (formData.password.length < 8) {
            newErrors.password = 'Password must be at least 8 characters';
        }
        if (!formData.community_id) {
            newErrors.community_id = 'Community is required';
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
            await createCustomer.mutateAsync({
                ...formData,
                role: 'customer',
            });
            showToast('Customer Successfully Added', 'success');
            onSuccess?.();
            onClose();
        } catch (error: any) {
            showToast(error.response?.data?.detail || 'Failed to create customer', 'error');
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
                            <User className="text-green-600" size={20} />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-slate-900">Add Customer</h2>
                            <p className="text-sm text-slate-500">Create a new customer account</p>
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
                    {/* Display Name */}
                    <div>
                        <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
                            <User size={16} />
                            Full Name *
                        </label>
                        <input
                            type="text"
                            value={formData.display_name}
                            onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                            placeholder="John Doe"
                            className={`w-full px-4 py-3 rounded-xl border ${
                                errors.display_name ? 'border-red-300 bg-red-50' : 'border-slate-200'
                            } focus:outline-none focus:ring-2 focus:ring-green-500 transition-all`}
                        />
                        {errors.display_name && (
                            <p className="text-xs text-red-600 mt-1">{errors.display_name}</p>
                        )}
                    </div>

                    {/* Email */}
                    <div>
                        <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
                            <Mail size={16} />
                            Email Address *
                        </label>
                        <input
                            type="email"
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            placeholder="john@example.com"
                            className={`w-full px-4 py-3 rounded-xl border ${
                                errors.email ? 'border-red-300 bg-red-50' : 'border-slate-200'
                            } focus:outline-none focus:ring-2 focus:ring-green-500 transition-all`}
                        />
                        {errors.email && (
                            <p className="text-xs text-red-600 mt-1">{errors.email}</p>
                        )}
                    </div>

                    {/* Password */}
                    <div>
                        <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
                            <Lock size={16} />
                            Password *
                        </label>
                        <input
                            type="password"
                            value={formData.password}
                            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                            placeholder="Min. 8 characters"
                            className={`w-full px-4 py-3 rounded-xl border ${
                                errors.password ? 'border-red-300 bg-red-50' : 'border-slate-200'
                            } focus:outline-none focus:ring-2 focus:ring-green-500 transition-all`}
                        />
                        {errors.password && (
                            <p className="text-xs text-red-600 mt-1">{errors.password}</p>
                        )}
                    </div>

                    {/* Region (for filtering communities) */}
                    <div>
                        <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
                            <MapPin size={16} />
                            Region
                        </label>
                        <select
                            value={selectedRegion}
                            onChange={(e) => {
                                setSelectedRegion(e.target.value);
                                setFormData({ ...formData, community_id: '' }); // Reset community when region changes
                            }}
                            className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-green-500 transition-all"
                            disabled={loadingRegions}
                        >
                            <option value="">All Regions</option>
                            {regions?.map((region) => (
                                <option key={region.id} value={region.id}>
                                    {region.name}, {region.state}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Community Selection */}
                    <div>
                        <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
                            <Building2 size={16} />
                            Community *
                        </label>
                        <select
                            value={formData.community_id}
                            onChange={(e) => setFormData({ ...formData, community_id: e.target.value })}
                            className={`w-full px-4 py-3 rounded-xl border ${
                                errors.community_id ? 'border-red-300 bg-red-50' : 'border-slate-200'
                            } focus:outline-none focus:ring-2 focus:ring-green-500 transition-all`}
                            disabled={loadingCommunities}
                        >
                            <option value="">Select a community</option>
                            {communities?.map((community) => (
                                <option key={community.id} value={community.id}>
                                    {community.name}
                                </option>
                            ))}
                        </select>
                        {errors.community_id && (
                            <p className="text-xs text-red-600 mt-1">{errors.community_id}</p>
                        )}
                        {!selectedRegion && !loadingCommunities && communities && communities.length > 10 && (
                            <p className="text-xs text-slate-500 mt-1">
                                Tip: Select a region to filter communities
                            </p>
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
                            disabled={createCustomer.isPending}
                            className="flex-1 px-6 py-3 rounded-xl bg-green-600 text-white font-semibold hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            {createCustomer.isPending ? 'Creating...' : 'Create Customer'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
