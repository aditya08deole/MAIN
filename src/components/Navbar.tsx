import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Database, LogOut, Sparkles, Crown } from 'lucide-react';
import clsx from 'clsx';
import { useAuth } from '../context/AuthContext';
import { usePlan } from '../hooks/usePlan';
import { RolePreviewButton } from './RolePreviewButton';

const ROLE_COLORS: Record<string, string> = {
    superadmin: '#DC2626',
    distributor: '#2563EB',
    customer: '#16A34A',
};

const Navbar = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { user, logout, isAuthenticated } = useAuth();
    const { } = usePlan();

    const navItems = [
        { name: 'DASHBOARD', path: '/dashboard', icon: LayoutDashboard },
        { name: 'ALL NODES', path: '/nodes', icon: Database },
        { name: 'AI ASSISTANT', path: '/ai', icon: Sparkles },
        ...(user?.role === 'superadmin' ? [{ name: 'SUPER ADMIN', path: '/superadmin', icon: Crown }] : []),
        ...(isAuthenticated ? [{ name: 'ADMINISTRATION', path: '/admin', icon: LayoutDashboard }] : []),
    ];

    const handleLogout = async () => {
        await logout();
        navigate('/login');
    };

    return (
        <nav className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 sticky top-0 z-40 shadow-sm">
            <div className="flex items-center gap-2">
                <img src="/evara-logo.png" alt="EvaraTech" className="w-9 h-9 object-contain" />
                <span className="text-xl font-bold bg-gradient-to-r from-[var(--color-evara-blue)] to-[var(--color-evara-green)] bg-clip-text text-transparent">
                    EvaraTech
                </span>
            </div>

            <div className="flex items-center gap-1">
                {navItems.map((item) => {
                    const isActive = location.pathname === item.path;
                    return (
                        <Link
                            key={item.path}
                            to={item.path}
                            className={clsx(
                                "px-4 py-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-all duration-200 relative",
                                isActive
                                    ? "bg-[var(--color-evara-blue)] text-white shadow-md shadow-blue-500/20"
                                    : "text-slate-600 hover:bg-slate-50 hover:text-[var(--color-evara-blue)]"
                            )}
                        >
                            <item.icon size={18} />
                            {item.name}
                        </Link>
                    );
                })}
            </div>

            <div className="flex items-center gap-3">
                {isAuthenticated && user ? (
                    <>
                        <RolePreviewButton />
                        <Link
                            to="/admin"
                            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all hover:shadow-md"
                            style={{
                                background: `${ROLE_COLORS[user.role]}12`,
                                color: ROLE_COLORS[user.role],
                                border: `1.5px solid ${ROLE_COLORS[user.role]}40`,
                            }}
                        >
                            <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold" style={{ background: ROLE_COLORS[user.role] }}>
                                {user.displayName[0]}
                            </div>
                            {user.displayName}
                        </Link>
                        <button
                            onClick={handleLogout}
                            className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-red-50 hover:text-red-500 transition-colors"
                            title="Logout"
                        >
                            <LogOut size={16} />
                        </button>
                    </>
                ) : (
                    <Link
                        to="/login"
                        className="px-4 py-2 rounded-lg bg-[var(--color-evara-blue)] text-white text-sm font-medium hover:shadow-md transition-all"
                    >
                        Login
                    </Link>
                )}
            </div>
        </nav>
    );
};

export default Navbar;
