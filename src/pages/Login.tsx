import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, LogIn, UserPlus, Shield, ShoppingBag, Users, ArrowLeft } from 'lucide-react';
import clsx from 'clsx';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import type { UserRole } from '../types/database';

type Mode = 'signin' | 'register';
type LoginStep = 'role-selection' | 'credentials';

const Login = () => {
    // ─── State ───────────────────────────────────────────────────────────────
    const [step, setStep] = useState<LoginStep>('role-selection');
    const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);

    const [mode, setMode] = useState<Mode>('signin');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [displayName, setDisplayName] = useState('');
    const [showPass, setShowPass] = useState(false);
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const navigate = useNavigate();
    const { login: loginFn, signup: signupFn } = useAuth();

    // ─── Handlers ────────────────────────────────────────────────────────────

    const handleRoleSelect = (role: UserRole) => {
        setSelectedRole(role);
        setStep('credentials');
        setError('');
        // Pre-fill email for demo convenience if desired, or leave blank
        if (role === 'superadmin') setEmail('ritik@evaratech.com');
        else setEmail('');
    };

    const handleBack = () => {
        setStep('role-selection');
        setSelectedRole(null);
        setError('');
    };

    const switchMode = (m: Mode) => {
        setMode(m);
        setError('');
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        const timeoutPromise = new Promise<{ timeout: true }>((_, reject) =>
            setTimeout(() => reject(new Error('Request timed out. Please check your connection.')), 10000)
        );

        try {
            if (mode === 'signin') {
                // Race login against timeout
                const result = await Promise.race([
                    loginFn(email, password),
                    timeoutPromise
                ]) as Awaited<ReturnType<typeof loginFn>>;

                if (result.success) {
                    if (selectedRole === 'superadmin') {
                        // ─── DEV BYPASS CHECK ───
                        const DEV_ADMINS = ['ritik@evaratech.com', 'yasha@evaratech.com', 'aditya@evaratech.com', 'admin@evara.com'];
                        if (DEV_ADMINS.includes(email)) {
                            navigate('/dashboard'); // User requested Dashboard first
                            return;
                        }

                        // Strict Check with timeout (Real Users)
                        const { data: { user } } = await supabase.auth.getUser();
                        if (user) {
                            const { data: profile, error: profileError } = await supabase
                                .from('users_profiles')
                                .select('role')
                                .eq('id', user.id)
                                .single(); // This might fail if no profile, but we check error

                            if (profileError) {
                                console.error('Profile fetch error:', profileError);
                                throw new Error('Failed to verify user profile.');
                            }

                            const p = profile as any;
                            if (p?.role === 'superadmin') {
                                navigate('/dashboard'); // User requested Dashboard first
                            } else {
                                await supabase.auth.signOut();
                                setError('Access Denied: You are not a Super Admin.');
                            }
                        } else {
                            setError('Authentication failed. Please try again.');
                        }
                    } else {
                        navigate('/dashboard');
                    }
                } else {
                    setError(result.error ?? 'Invalid credentials.');
                }
            } else {
                if (!displayName.trim()) {
                    setError('Please enter your name.');
                    setIsLoading(false);
                    return;
                }
                const result = await Promise.race([
                    signupFn(email, password, displayName.trim()),
                    timeoutPromise
                ]) as Awaited<ReturnType<typeof signupFn>>;

                if (result.success) {
                    navigate('/dashboard');
                } else {
                    setError(result.error ?? 'Registration failed.');
                }
            }
        } catch (err: any) {
            console.error('Login error:', err);
            setError(err.message || 'An unexpected error occurred.');
        } finally {
            setIsLoading(false);
        }
    };

    // ─── Render: Role Selection ──────────────────────────────────────────────

    if (step === 'role-selection') {
        return (
            <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
                <div className="text-center mb-10">
                    <img src="/evara-logo.png" alt="EvaraTech" className="w-24 h-24 mx-auto mb-4 object-contain" />
                    <h1 className="text-4xl font-extrabold text-blue-900 mb-2">Welcome to EvaraTech</h1>
                    <p className="text-slate-500 text-lg">Select your portal to continue</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl w-full">
                    {/* Super Admin Card */}
                    <button
                        onClick={() => handleRoleSelect('superadmin')}
                        className="group bg-white p-8 rounded-3xl shadow-sm border border-slate-200 hover:shadow-xl hover:border-blue-300 transition-all text-left relative overflow-hidden"
                    >
                        <div className="absolutetop-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                            <Shield size={120} className="text-blue-600" />
                        </div>
                        <div className="w-14 h-14 bg-blue-100 rounded-2xl flex items-center justify-center mb-6 text-blue-600 group-hover:scale-110 transition-transform">
                            <Shield size={28} />
                        </div>
                        <h3 className="text-xl font-bold text-slate-800 mb-2 group-hover:text-blue-700">Super Admin</h3>
                        <p className="text-sm text-slate-500 leading-relaxed">
                            Full system control, user management, and global analytics.
                        </p>
                    </button>

                    {/* Distributor Card */}
                    <button
                        onClick={() => handleRoleSelect('distributor')}
                        className="group bg-white p-8 rounded-3xl shadow-sm border border-slate-200 hover:shadow-xl hover:border-purple-300 transition-all text-left relative overflow-hidden"
                    >
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                            <ShoppingBag size={120} className="text-purple-600" />
                        </div>
                        <div className="w-14 h-14 bg-purple-100 rounded-2xl flex items-center justify-center mb-6 text-purple-600 group-hover:scale-110 transition-transform">
                            <ShoppingBag size={28} />
                        </div>
                        <h3 className="text-xl font-bold text-slate-800 mb-2 group-hover:text-purple-700">Distributor</h3>
                        <p className="text-sm text-slate-500 leading-relaxed">
                            Manage assigned nodes, view localized data, and generate reports.
                        </p>
                    </button>

                    {/* Customer Card */}
                    <button
                        onClick={() => handleRoleSelect('customer')}
                        className="group bg-white p-8 rounded-3xl shadow-sm border border-slate-200 hover:shadow-xl hover:border-green-300 transition-all text-left relative overflow-hidden"
                    >
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                            <Users size={120} className="text-green-600" />
                        </div>
                        <div className="w-14 h-14 bg-green-100 rounded-2xl flex items-center justify-center mb-6 text-green-600 group-hover:scale-110 transition-transform">
                            <Users size={28} />
                        </div>
                        <h3 className="text-xl font-bold text-slate-800 mb-2 group-hover:text-green-700">Customer</h3>
                        <p className="text-sm text-slate-500 leading-relaxed">
                            Monitor your water usage, view status, and receive alerts.
                        </p>
                    </button>
                </div>
            </div>
        );
    }

    // ─── Render: Credentials Form ────────────────────────────────────────────

    const isSuperAdmin = selectedRole === 'superadmin';

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
            <div className="w-full max-w-lg">
                <button
                    onClick={handleBack}
                    className="flex items-center gap-2 text-slate-500 hover:text-slate-800 mb-6 font-medium transition-colors"
                >
                    <ArrowLeft size={18} /> Back to Role Selection
                </button>

                <div className="text-center mb-8">
                    <div className={clsx(
                        'w-16 h-16 mx-auto rounded-2xl flex items-center justify-center mb-4',
                        selectedRole === 'superadmin' ? 'bg-blue-100 text-blue-600' :
                            selectedRole === 'distributor' ? 'bg-purple-100 text-purple-600' :
                                'bg-green-100 text-green-600'
                    )}>
                        {selectedRole === 'superadmin' ? <Shield size={32} /> :
                            selectedRole === 'distributor' ? <ShoppingBag size={32} /> :
                                <Users size={32} />}
                    </div>
                    <h1 className="text-3xl font-bold text-slate-900 capitalize">{selectedRole} Login</h1>
                    <p className="text-sm text-slate-500 mt-1">Enter your credentials to access the dashboard</p>
                </div>

                <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
                    {/* Tab Switcher (Only for non-superadmin, or if you want to allow registration) */}
                    {!isSuperAdmin && (
                        <div className="flex border-b border-slate-100">
                            <button
                                onClick={() => switchMode('signin')}
                                className={clsx(
                                    'flex-1 py-4 text-sm font-bold transition-all flex items-center justify-center gap-2',
                                    mode === 'signin'
                                        ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50'
                                        : 'text-slate-400'
                                )}
                            >
                                <LogIn size={16} /> Sign In
                            </button>
                            <button
                                onClick={() => switchMode('register')}
                                className={clsx(
                                    'flex-1 py-4 text-sm font-bold transition-all flex items-center justify-center gap-2',
                                    mode === 'register'
                                        ? 'text-green-600 border-b-2 border-green-600 bg-green-50/50'
                                        : 'text-slate-400'
                                )}
                            >
                                <UserPlus size={16} /> Create Account
                            </button>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="p-8 space-y-5">
                        {mode === 'register' && !isSuperAdmin && (
                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-2">Full Name</label>
                                <input
                                    type="text"
                                    value={displayName}
                                    onChange={e => setDisplayName(e.target.value)}
                                    placeholder="e.g. John Doe"
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-sm outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10 transition-all font-medium"
                                    required
                                />
                            </div>
                        )}

                        <div>
                            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-2">Email Address</label>
                            <input
                                type="email"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                placeholder="name@company.com"
                                className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-sm outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10 transition-all font-medium"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-2">Password</label>
                            <div className="relative">
                                <input
                                    type={showPass ? 'text' : 'password'}
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-sm outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-500/10 transition-all font-medium pr-12"
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPass(!showPass)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                >
                                    {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                        </div>

                        {error && (
                            <div className="px-4 py-3 rounded-xl bg-red-50 text-red-600 text-sm font-medium border border-red-100 flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={isLoading}
                            className={clsx(
                                "w-full py-3.5 rounded-xl text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20 transition-all hover:-translate-y-0.5",
                                isSuperAdmin ? "bg-slate-900 hover:bg-slate-800" : "bg-blue-600 hover:bg-blue-700"
                            )}
                        >
                            {isLoading ? (
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <>
                                    {mode === 'signin' ? <LogIn size={18} /> : <UserPlus size={18} />}
                                    {mode === 'signin' ? 'Sign In to Dashboard' : 'Create Account'}
                                </>
                            )}
                        </button>
                    </form>
                </div>

                <p className="text-center text-xs text-slate-400 mt-8 font-medium">
                    Protected by EvaraTech Secure Access • © 2025
                </p>
            </div>
        </div>
    );
};

export default Login;
