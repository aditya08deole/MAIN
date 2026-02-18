import { useState } from 'react';
import { QrCode, Smartphone, CheckCircle, AlertCircle, ArrowRight } from 'lucide-react';
import { claimDevice } from '../services/provisioning';
import { useNavigate } from 'react-router-dom';

export default function ProvisioningPage() {
    const navigate = useNavigate();
    const [token, setToken] = useState('');
    const [hardwareId, setHardwareId] = useState('');
    const [label, setLabel] = useState('');
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
    const [message, setMessage] = useState('');

    const handleClaim = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setStatus('idle');
        try {
            const result = await claimDevice(token, hardwareId, label);
            setStatus('success');
            setMessage(result.message);
            setTimeout(() => navigate('/dashboard'), 2000);
        } catch (err: any) {
            setStatus('error');
            setMessage(err.response?.data?.detail || "Failed to claim device. Please check your token.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-[80vh] flex items-center justify-center p-4">
            <div className="bg-white max-w-md w-full rounded-2xl shadow-xl border border-slate-200 overflow-hidden">

                {/* Header */}
                <div className="p-8 bg-gradient-to-br from-blue-600 to-indigo-700 text-center text-white relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
                    <div className="relative z-10">
                        <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center mx-auto mb-4">
                            <QrCode className="w-8 h-8 text-white" />
                        </div>
                        <h1 className="text-2xl font-bold">Claim New Device</h1>
                        <p className="text-blue-100 mt-2 text-sm">Enter the provisioning token and hardware ID found on the device box.</p>
                    </div>
                </div>

                {/* Form */}
                <form onSubmit={handleClaim} className="p-8 space-y-6">

                    {status === 'success' && (
                        <div className="p-4 bg-green-50 rounded-xl flex items-start gap-3 border border-green-100 animate-in fade-in slide-in-from-top-2">
                            <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                            <div>
                                <h4 className="font-bold text-green-800 text-sm">Success!</h4>
                                <p className="text-xs text-green-600 mt-1">{message}</p>
                            </div>
                        </div>
                    )}

                    {status === 'error' && (
                        <div className="p-4 bg-red-50 rounded-xl flex items-start gap-3 border border-red-100 animate-in fade-in slide-in-from-top-2">
                            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                            <div>
                                <h4 className="font-bold text-red-800 text-sm">Error</h4>
                                <p className="text-xs text-red-600 mt-1">{message}</p>
                            </div>
                        </div>
                    )}

                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Provisioning Token</label>
                            <input
                                type="text"
                                required
                                className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all font-mono text-sm"
                                placeholder="e.g. pr_abc123..."
                                value={token}
                                onChange={e => setToken(e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Hardware ID (MAC)</label>
                            <input
                                type="text"
                                required
                                className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all font-mono text-sm"
                                placeholder="e.g. AA:BB:CC:11:22:33"
                                value={hardwareId}
                                onChange={e => setHardwareId(e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Device Label</label>
                            <input
                                type="text"
                                required
                                className="w-full p-3 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                                placeholder="e.g. North Tank - Block A"
                                value={label}
                                onChange={e => setLabel(e.target.value)}
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-4 bg-slate-900 text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-slate-800 transform active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-slate-200"
                    >
                        {loading ? (
                            <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                        ) : (
                            <>
                                Complete Setup <ArrowRight className="w-4 h-4" />
                            </>
                        )}
                    </button>
                </form>

                <div className="p-4 bg-slate-50 text-center text-xs text-slate-400 border-t border-slate-100">
                    <Smartphone className="w-4 h-4 mx-auto mb-1 text-slate-300" />
                    Installer Mode v2.1
                </div>
            </div>
        </div>
    );
}
