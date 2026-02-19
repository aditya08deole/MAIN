import { useState } from 'react';
import { adminService } from '../../../services/admin';
import { Loader2 } from 'lucide-react';

export const AddCustomerForm = ({ onSubmit, onCancel }: { onSubmit: (data: any) => void; onCancel: () => void }) => {
    const [formData, setFormData] = useState({ name: '', email: '', phone: '', password: '', community: '' });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleChange = (field: string, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const result = await adminService.createCustomer({
                name: formData.name,
                email: formData.email,
                community_id: formData.community,
                password: formData.password,
                contact_number: formData.phone
            });
            onSubmit(result);
        } catch (err) {
            setError('Failed to create customer. Please try again.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const inputCls = "w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-800 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none transition-all placeholder:text-slate-400";
    const labelCls = "block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2";

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
                <div className="p-3 bg-red-50 border border-red-100 text-red-600 text-xs rounded-lg">
                    {error}
                </div>
            )}

            <div>
                <label className={labelCls}>Full Name</label>
                <input
                    value={formData.name}
                    onChange={e => handleChange('name', e.target.value)}
                    placeholder="e.g. John Doe"
                    className={inputCls}
                    disabled={loading}
                />
            </div>
            <div>
                <label className={labelCls}>Email Address</label>
                <input
                    type="email"
                    value={formData.email}
                    onChange={e => handleChange('email', e.target.value)}
                    placeholder="client@example.com"
                    className={inputCls}
                    disabled={loading}
                />
            </div>
            <div>
                <label className={labelCls}>Temp Password</label>
                <input
                    type="password"
                    value={formData.password}
                    onChange={e => handleChange('password', e.target.value)}
                    placeholder="••••••••"
                    className={inputCls}
                    disabled={loading}
                />
            </div>
            <div>
                <label className={labelCls}>Contact Number</label>
                <input
                    value={formData.phone}
                    onChange={e => handleChange('phone', e.target.value)}
                    placeholder="+91 98765 43210"
                    className={inputCls}
                    disabled={loading}
                />
            </div>
            <div>
                <label className={labelCls}>Assign to Community</label>
                <select
                    value={formData.community}
                    onChange={e => handleChange('community', e.target.value)}
                    className={inputCls}
                    disabled={loading}
                >
                    <option value="">Select Community</option>
                    <option value="1">Greenwood Heights</option>
                    <option value="2">Cyber Towers</option>
                </select>
            </div>

            <div className="flex justify-end gap-3 pt-4">
                <button
                    type="button"
                    onClick={onCancel}
                    disabled={loading}
                    className="px-4 py-2 text-sm font-bold text-slate-500 hover:text-slate-800 transition-colors"
                >
                    Cancel
                </button>
                <button
                    type="submit"
                    disabled={!formData.name || !formData.email || !formData.community || loading}
                    className="flex items-center gap-2 px-6 py-2 bg-purple-600 text-white text-sm font-bold rounded-xl hover:bg-purple-700 transition-colors disabled:opacity-50"
                >
                    {loading && <Loader2 size={14} className="animate-spin" />}
                    {loading ? 'Registering...' : 'Register Customer'}
                </button>
            </div>
        </form>
    );
};
