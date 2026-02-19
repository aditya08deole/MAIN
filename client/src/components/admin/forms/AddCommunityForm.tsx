import { useState } from 'react';
import { adminService } from '../../../services/admin';
import { Loader2 } from 'lucide-react';

export const AddCommunityForm = ({ onSubmit, onCancel }: { onSubmit: (data: any) => void; onCancel: () => void }) => {
    const [name, setName] = useState('');
    const [region, setRegion] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            // Call API
            const result = await adminService.createCommunity({ name, region });
            onSubmit(result);
        } catch (err) {
            setError('Failed to create community. Server unreachable?');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const inputCls = "w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-slate-800 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none transition-all placeholder:text-slate-400";
    const labelCls = "block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2";

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
                <div className="p-3 bg-red-50 border border-red-100 text-red-600 text-xs rounded-lg">
                    {error}
                </div>
            )}

            <div>
                <label className={labelCls}>Community Name</label>
                <input
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="e.g. Greenwood Heights"
                    className={inputCls}
                    autoFocus
                    disabled={loading}
                />
            </div>
            <div>
                <label className={labelCls}>Region / Zone</label>
                <div className="relative">
                    <input
                        list="region-options"
                        value={region}
                        onChange={e => setRegion(e.target.value)}
                        placeholder="Select or Type New Region"
                        className={inputCls}
                        disabled={loading}
                    />
                    <datalist id="region-options">
                        <option value="Hyderabad North" />
                        <option value="Hyderabad South" />
                        <option value="Hyderabad West (Hitech)" />
                        <option value="Bangalore East" />
                        <option value="Bangalore South" />
                        <option value="Visakhapatnam" />
                    </datalist>
                </div>
                <p className="text-[10px] text-slate-400 mt-1 ml-1">
                    * Type a new name to create a new region.
                </p>
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
                    disabled={!name || !region || loading}
                    className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {loading && <Loader2 size={14} className="animate-spin" />}
                    {loading ? 'Creating...' : 'Create Community'}
                </button>
            </div>
        </form>
    );
};
