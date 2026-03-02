import { useState } from 'react';
import { QrCode, Smartphone, CheckCircle, AlertCircle, ArrowRight } from 'lucide-react';
import { deviceService } from '../services/DeviceService';
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
            const result = await deviceService.claimDevice(token, hardwareId, label);
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
        <div className="glass-dashboard min-h-[80vh] flex items-center justify-center p-4">
            <div className="apple-glass-card max-w-md w-full !rounded-[24px]">

                {/* Header (Integrated into Glass) */}
                <div className="p-8 text-center relative overflow-hidden border-b border-[rgba(255,255,255,0.1)]">
                    <div className="relative z-10">
                        <div className="w-16 h-16 bg-[#1F2937] bg-opacity-5 backdrop-blur-md rounded-2xl border border-[rgba(255,255,255,0.2)] flex items-center justify-center mx-auto mb-4 shadow-sm">
                            <QrCode className="w-8 h-8 text-[#1F2937] opacity-80" />
                        </div>
                        <h1 className="text-[24px] font-[600] tracking-[-0.5px] text-[#1F2937]">Claim New Device</h1>
                        <p className="glass-secondary mt-2">Enter the provisioning token and hardware ID found on the device box.</p>
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

                    <div className="space-y-[16px]">
                        <div>
                            <label className="block text-[11px] font-[600] text-[#1F2937] opacity-70 uppercase mb-[8px]">Provisioning Token</label>
                            <input
                                type="text"
                                required
                                className="w-full p-[14px] bg-[rgba(255,255,255,0.3)] border border-[rgba(255,255,255,0.4)] rounded-[12px] focus:ring-2 focus:ring-[rgba(58,122,254,0.3)] focus:border-[#3A7AFE] outline-none transition-all font-mono text-[14px] text-[#1F2937] placeholder:text-[#1F2937] placeholder:opacity-40 shadow-sm"
                                placeholder="e.g. pr_abc123..."
                                value={token}
                                onChange={e => setToken(e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="block text-[11px] font-[600] text-[#1F2937] opacity-70 uppercase mb-[8px]">Hardware ID (MAC)</label>
                            <input
                                type="text"
                                required
                                className="w-full p-[14px] bg-[rgba(255,255,255,0.3)] border border-[rgba(255,255,255,0.4)] rounded-[12px] focus:ring-2 focus:ring-[rgba(58,122,254,0.3)] focus:border-[#3A7AFE] outline-none transition-all font-mono text-[14px] text-[#1F2937] placeholder:text-[#1F2937] placeholder:opacity-40 shadow-sm"
                                placeholder="e.g. AA:BB:CC:11:22:33"
                                value={hardwareId}
                                onChange={e => setHardwareId(e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="block text-[11px] font-[600] text-[#1F2937] opacity-70 uppercase mb-[8px]">Device Label</label>
                            <input
                                type="text"
                                required
                                className="w-full p-[14px] bg-[rgba(255,255,255,0.3)] border border-[rgba(255,255,255,0.4)] rounded-[12px] focus:ring-2 focus:ring-[rgba(58,122,254,0.3)] focus:border-[#3A7AFE] outline-none transition-all text-[14px] text-[#1F2937] placeholder:text-[#1F2937] placeholder:opacity-40 shadow-sm"
                                placeholder="e.g. North Tank - Block A"
                                value={label}
                                onChange={e => setLabel(e.target.value)}
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-[16px] btn-liquid-glass btn-liquid-glass-slate rounded-[12px] text-[15px] font-[600] flex items-center justify-center gap-2 transform active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
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

                <div className="p-4 text-center border-t border-[rgba(255,255,255,0.1)]">
                    <div className="flex items-center justify-center gap-[6px] opacity-60">
                        <Smartphone className="w-[14px] h-[14px] text-[#1F2937]" />
                        <span className="text-[11px] font-[500] text-[#1F2937]">Installer Mode v2.1</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
