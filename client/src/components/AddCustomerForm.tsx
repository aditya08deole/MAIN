import { useState, useMemo } from 'react';
import { X, User, Mail, Lock, Building2, MapPin, Loader2, AlertCircle, CheckCircle, Shield } from 'lucide-react';
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

    // Sort regions alphabetically
    const sortedRegions = useMemo(() => {
        return regions ? [...regions].sort((a, b) => a.name.localeCompare(b.name)) : [];
    }, [regions]);

    const [formData, setFormData] = useState({
        display_name: '',
        email: '',
        password: '',
        confirmPassword: '',
        community_id: '',
    });

    const [errors, setErrors] = useState<Record<string, string>>({});

    // Password strength calculation
    const getPasswordStrength = (password: string) => {
        if (!password) return { score: 0, label: '', color: '' };
        let score = 0;
        if (password.length >= 8) score++;
        if (password.length >= 12) score++;
        if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
        if (/\d/.test(password)) score++;
        if (/[^a-zA-Z0-9]/.test(password)) score++;

        if (score <= 2) return { score, label: 'Weak', color: 'bg-red-500' };
        if (score <= 3) return { score, label: 'Fair', color: 'bg-orange-500' };
        if (score <= 4) return { score, label: 'Good', color: 'bg-blue-500' };
        return { score, label: 'Strong', color: 'bg-green-500' };
    };

    const passwordStrength = getPasswordStrength(formData.password);

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
        if (formData.password !== formData.confirmPassword) {
            newErrors.confirmPassword = 'Passwords do not match';
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
                <form onSubmit={handleSubmit} className="p-6">
                    {/* Loading State */}
                    {loadingRegions && (
                        <div className="flex items-center justify-center py-8">
                            <Loader2 className="animate-spin text-green-600" size={32} />
                            <span className="ml-3 text-slate-600">Loading data...</span>
                        </div>
                    )}

                    {!loadingRegions && (
                        <div className="space-y-6">
                            {/* SECTION: Account Details */}
                            <div>
                                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">Account Details</h3>
                                <div className="space-y-4">
                                    {/* Display Name */}
                                    <div>
                                        <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
                                            <User size={16} className="text-green-600" />
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
                                            <p className="text-xs text-red-600 mt-1.5 flex items-center gap-1">
                                                <AlertCircle size={12} />
                                                {errors.display_name}
                                            </p>
                                        )}
                                    </div>

                                    {/* Email */}
                                    <div>
                                        <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
                                            <Mail size={16} className="text-green-600" />
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
                                            <p className="text-xs text-red-600 mt-1.5 flex items-center gap-1">
                                                <AlertCircle size={12} />
                                                {errors.email}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* SECTION: Security */}
                            <div className="border-t pt-6">
                                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                                    <Shield size={14} />
                                    Security
                                </h3>
                                <div className="space-y-4">
                                    {/* Password */}
                                    <div>
                                        <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
                                            <Lock size={16} className="text-green-600" />
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
                                            <p className="text-xs text-red-600 mt-1.5 flex items-center gap-1">
                                                <AlertCircle size={12} />
                                                {errors.password}
                                            </p>
                                        )}
                                        {/* Password Strength Indicator */}
                                        {formData.password && (
                                            <div className="mt-2">
                                                <div className="flex items-center justify-between text-xs mb-1">
                                                    <span className="text-slate-600">Password Strength</span>
                                                    <span className={`font-semibold ${passwordStrength.label === 'Strong' ? 'text-green-600' : passwordStrength.label === 'Weak' ? 'text-red-600' : 'text-slate-600'}`}>
                                                        {passwordStrength.label}
                                                    </span>
                                                </div>
                                                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                                    <div 
                                                        className={`h-full ${passwordStrength.color} transition-all duration-300`}
                                                        style={{ width: `${(passwordStrength.score / 5) * 100}%` }}
                                                    />
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Confirm Password */}
                                    <div>
                                        <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
                                            <CheckCircle size={16} className="text-green-600" />
                                            Confirm Password *
                                        </label>
                                        <input
                                            type="password"
                                            value={formData.confirmPassword}
                                            onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                                            placeholder="Re-enter password"
                                            className={`w-full px-4 py-3 rounded-xl border ${
                                                errors.confirmPassword ? 'border-red-300 bg-red-50' : 'border-slate-200'
                                            } focus:outline-none focus:ring-2 focus:ring-green-500 transition-all`}
                                        />
                                        {errors.confirmPassword && (
                                            <p className="text-xs text-red-600 mt-1.5 flex items-center gap-1">
                                                <AlertCircle size={12} />
                                                {errors.confirmPassword}
                                            </p>
                                        )}
                                        {formData.confirmPassword && formData.password === formData.confirmPassword && (
                                            <p className="text-xs text-green-600 mt-1.5 flex items-center gap-1">
                                                <CheckCircle size={12} />
                                                Passwords match
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* SECTION: Community Assignment */}
                            <div className="border-t pt-6">
                                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">Community Assignment</h3>
                                <div className="space-y-4">
                                    {/* Region (for filtering communities) */}
                                    <div>
                                        <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
                                            <MapPin size={16} className="text-green-600" />
                                            Filter by Region (Optional)
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
                                            {sortedRegions.map((region) => (
                                                <option key={region.id} value={region.id}>
                                                    {region.name}, {region.state}
                                                </option>
                                            ))}
                                        </select>
                                        <p className="text-xs text-slate-500 mt-1.5">Filter communities by region for easier selection</p>
                                    </div>

                                    {/* Community Selection */}
                                    <div>
                                        <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 mb-2">
                                            <Building2 size={16} className="text-green-600" />
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
                                            {loadingCommunities && <option disabled>Loading communities...</option>}
                                            {!loadingCommunities && communities && communities.length === 0 && (
                                                <option disabled>No communities available</option>
                                            )}
                                            {communities?.map((community) => (
                                                <option key={community.id} value={community.id}>
                                                    {community.name}
                                                </option>
                                            ))}
                                        </select>
                                        {errors.community_id && (
                                            <p className="text-xs text-red-600 mt-1.5 flex items-center gap-1">
                                                <AlertCircle size={12} />
                                                {errors.community_id}
                                            </p>
                                        )}
                                        {communities && communities.length > 0 && (
                                            <p className="text-xs text-slate-500 mt-1.5">
                                                {communities.length} {communities.length === 1 ? 'community' : 'communities'} available
                                            </p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-3 pt-6 mt-6 border-t">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-6 py-3 rounded-xl border-2 border-slate-200 text-slate-700 font-semibold hover:bg-slate-50 transition-all"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={createCustomer.isPending || loadingRegions}
                            className="flex-1 px-6 py-3 rounded-xl bg-green-600 text-white font-semibold hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-green-500/30 flex items-center justify-center gap-2"
                        >
                            {createCustomer.isPending && <Loader2 className="animate-spin" size={18} />}
                            {createCustomer.isPending ? 'Creating Account...' : 'Create Customer'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
