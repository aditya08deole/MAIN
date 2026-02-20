import { useState, useEffect } from 'react';
import { adminService } from '../../../services/admin';
import { Loader2, MapPin, Plus } from 'lucide-react';

export const AddCommunityForm = ({ onSubmit, onCancel }: { onSubmit: (data: any) => void; onCancel: () => void }) => {
    const [name, setName] = useState('');
    const [region, setRegion] = useState('');
    const [city, setCity] = useState('');
    const [existingRegions, setExistingRegions] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Fetch existing regions from database
    useEffect(() => {
        const fetchRegions = async () => {
            try {
                const [communities, distributors] = await Promise.all([
                    adminService.getCommunities(),
                    adminService.getDistributors().catch(() => [])
                ]);
                
                // Extract unique regions from both communities and distributors
                const regions = new Set<string>();
                communities.forEach((c: any) => c.region && regions.add(c.region));
                distributors.forEach((d: any) => d.region && regions.add(d.region));
                
                setExistingRegions(Array.from(regions).sort());
            } catch (err) {
                console.warn('Could not fetch regions:', err);
                // Continue with empty list - user can type new ones
            }
        };
        
        fetchRegions();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            // Call API
            const result = await adminService.createCommunity({ name, region, city });
            onSubmit(result);
        } catch (err: any) {
            setError(err.response?.data?.detail || 'Failed to create community. Please try again.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const inputCls = "w-full px-4 py-3 bg-white border border-slate-300 rounded-xl text-slate-800 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all placeholder:text-slate-400";
    const labelCls = "block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2";

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
                <div className="p-4 bg-red-50 border border-red-100 text-red-700 text-sm rounded-xl flex items-start gap-3">
                    <span className="text-red-500">⚠️</span>
                    <span>{error}</span>
                </div>
            )}

            <div>
                <label className={labelCls}>
                    <MapPin className="inline w-3 h-3 mr-1" />
                    Community Name *
                </label>
                <input
                    required
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="e.g. Greenwood Heights, Prestige Apartments"
                    className={inputCls}
                    autoFocus
                    disabled={loading}
                />
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label className={labelCls}>Region / Zone *</label>
                    <div className="relative">
                        <input
                            required
                            list="region-options"
                            value={region}
                            onChange={e => setRegion(e.target.value)}
                            placeholder="Select existing or type new"
                            className={inputCls}
                            disabled={loading}
                        />
                        <datalist id="region-options">
                            {existingRegions.map(r => <option key={r} value={r} />)}
                        </datalist>
                        <Plus className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    </div>
                    <p className="text-[10px] text-blue-500 mt-1.5 ml-1 font-medium">
                        <Plus className="inline w-3 h-3" /> Type a new name to create a new region automatically
                    </p>
                </div>

                <div>
                    <label className={labelCls}>City (Optional)</label>
                    <input
                        value={city}
                        onChange={e => setCity(e.target.value)}
                        placeholder="e.g. Hyderabad, Bangalore"
                        className={inputCls}
                        disabled={loading}
                    />
                </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                    type="button"
                    onClick={onCancel}
                    disabled={loading}
                    className="px-5 py-2.5 text-sm font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-all"
                >
                    Cancel
                </button>
                <button
                    type="submit"
                    disabled={!name || !region || loading}
                    className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white text-sm font-bold rounded-xl hover:from-blue-700 hover:to-blue-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-200"
                >
                    {loading && <Loader2 size={16} className="animate-spin" />}
                    {loading ? 'Creating...' : 'Create Community'}
                </button>
            </div>
        </form>
    );
};
