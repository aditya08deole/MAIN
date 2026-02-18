import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Crown, Shield, User, Eye, EyeOff, LogIn } from 'lucide-react';
import clsx from 'clsx';
import { useAuth } from '../context/AuthContext';
import type { UserRole } from '../context/AuthContext';

const roles: { id: UserRole; name: string; subtitle: string; icon: typeof Crown; color: string; bg: string; border: string; gradient: string; hint: string }[] = [
    {
        id: 'superadmin',
        name: 'Super Admin',
        subtitle: 'Command Authority',
        icon: Crown,
        color: '#DC2626',
        bg: '#FEF2F2',
        border: '#FECACA',
        gradient: 'linear-gradient(135deg, #DC2626 0%, #EF4444 50%, #F87171 100%)',
        hint: 'admin / admin123',
    },
    {
        id: 'distributor',
        name: 'Distributor',
        subtitle: 'Operational Partner',
        icon: Shield,
        color: '#2563EB',
        bg: '#EFF6FF',
        border: '#BFDBFE',
        gradient: 'linear-gradient(135deg, #1D4ED8 0%, #2563EB 50%, #3B82F6 100%)',
        hint: 'distributor / dist123',
    },
    {
        id: 'customer',
        name: 'Customer',
        subtitle: 'End User',
        icon: User,
        color: '#16A34A',
        bg: '#F0FDF4',
        border: '#BBF7D0',
        gradient: 'linear-gradient(135deg, #15803D 0%, #16A34A 50%, #22C55E 100%)',
        hint: 'Base: customer/base123 | Plus: customer_plus/plus123 | Pro: customer_pro/pro123',
    },
];

const Login = () => {
    const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const navigate = useNavigate();
    const { login } = useAuth();

    const selectedRoleData = roles.find(r => r.id === selectedRole);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedRole) {
            setError('Please select a role first');
            return;
        }
        setError('');
        setIsLoading(true);

        // Simulate network delay
        await new Promise(res => setTimeout(res, 600));

        const success = login(username, password, selectedRole);
        if (success) {
            navigate('/admin');
        } else {
            setError('Invalid credentials. Please try again.');
        }
        setIsLoading(false);
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 flex items-center justify-center p-4">
            <div className="w-full max-w-lg">
                {/* Logo & Title */}
                <div className="text-center mb-8">
                    <img src="/evara-logo.png" alt="EvaraTech" className="w-20 h-20 mx-auto mb-4 object-contain" />
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-[var(--color-evara-blue)] to-[var(--color-evara-green)] bg-clip-text text-transparent">
                        EvaraTech
                    </h1>
                    <p className="text-sm text-slate-500 mt-1">Smart Water Infrastructure — Admin Portal</p>
                </div>

                {/* Login Card */}
                <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
                    {/* Role Selection */}
                    <div className="p-6 pb-4">
                        <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4">Select Your Role</h2>
                        <div className="grid grid-cols-3 gap-3">
                            {roles.map((role) => {
                                const Icon = role.icon;
                                const isSelected = selectedRole === role.id;
                                return (
                                    <button
                                        key={role.id}
                                        onClick={() => { setSelectedRole(role.id); setError(''); }}
                                        className={clsx(
                                            "relative rounded-xl p-4 flex flex-col items-center gap-2 transition-all duration-300 cursor-pointer border-2",
                                            isSelected
                                                ? "shadow-lg scale-[1.02]"
                                                : "hover:shadow-md hover:scale-[1.01] border-transparent"
                                        )}
                                        style={isSelected ? {
                                            background: role.bg,
                                            borderColor: role.color,
                                        } : {
                                            background: '#f8fafc',
                                        }}
                                    >
                                        <div
                                            className="w-12 h-12 rounded-full flex items-center justify-center transition-all"
                                            style={isSelected ? {
                                                background: role.gradient,
                                                boxShadow: `0 4px 14px ${role.color}40`,
                                            } : {
                                                background: '#e2e8f0',
                                            }}
                                        >
                                            <Icon size={22} color={isSelected ? '#fff' : '#64748b'} />
                                        </div>
                                        <span className="text-xs font-bold" style={{ color: isSelected ? role.color : '#64748b' }}>
                                            {role.name}
                                        </span>
                                        <span className="text-[10px] text-slate-400">{role.subtitle}</span>
                                        {isSelected && (
                                            <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-bold" style={{ background: role.color }}>
                                                ✓
                                            </div>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Divider */}
                    <div className="mx-6 border-t border-slate-100"></div>

                    {/* Credentials Form */}
                    <form onSubmit={handleLogin} className="p-6 pt-4">
                        {selectedRoleData && (
                            <div className="mb-4 px-3 py-2 rounded-lg text-[11px] font-semibold whitespace-pre-wrap" style={{ background: selectedRoleData.bg, color: selectedRoleData.color }}>
                                Demo: {selectedRoleData.hint}
                            </div>
                        )}

                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Username</label>
                                <input
                                    type="text"
                                    value={username}
                                    onChange={(e) => setUsername(e.target.value)}
                                    placeholder="Enter username"
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Password</label>
                                <div className="relative">
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="Enter password"
                                        className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-sm text-slate-800 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all pr-12"
                                        required
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                                    >
                                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                            </div>
                        </div>

                        {error && (
                            <div className="mt-3 px-3 py-2 rounded-lg bg-red-50 text-red-600 text-xs font-semibold">
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={isLoading || !selectedRole}
                            className={clsx(
                                "w-full mt-5 py-3 rounded-xl text-white font-bold text-sm flex items-center justify-center gap-2 transition-all duration-300",
                                !selectedRole
                                    ? "bg-slate-300 cursor-not-allowed"
                                    : isLoading
                                        ? "opacity-70 cursor-wait"
                                        : "hover:shadow-lg hover:scale-[1.01] active:scale-[0.99]"
                            )}
                            style={selectedRoleData ? {
                                background: selectedRoleData.gradient,
                                boxShadow: selectedRole ? `0 4px 20px ${selectedRoleData.color}30` : undefined,
                            } : { background: '#cbd5e1' }}
                        >
                            {isLoading ? (
                                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            ) : (
                                <>
                                    <LogIn size={18} />
                                    Sign In{selectedRoleData ? ` as ${selectedRoleData.name}` : ''}
                                </>
                            )}
                        </button>
                    </form>
                </div>

                <p className="text-center text-xs text-slate-400 mt-6">
                    © 2025 EvaraTech — Smart Water Infrastructure
                </p>
            </div>
        </div>
    );
};

export default Login;
