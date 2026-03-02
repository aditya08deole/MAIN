import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Database, LogOut, Crown, Map } from 'lucide-react';
import clsx from 'clsx';
import { useAuth } from '../context/AuthContext';
import { useTenancy } from '../context/TenancyContext';

const Navbar = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { user, logout, isAuthenticated } = useAuth();
    useTenancy(); // Keep hook active for context side-effects if any

    const navItems = [
        { name: 'MAP', path: '/map', icon: Map },
        { name: 'DASHBOARD', path: '/dashboard', icon: LayoutDashboard },
        { name: 'ALL NODES', path: '/nodes', icon: Database },
        ...(user?.role === 'superadmin' ? [{ name: 'SUPER ADMIN', path: '/superadmin', icon: Crown }] : []),
        ...(isAuthenticated && user?.role === 'customer' ? [{ name: 'ADMINISTRATION', path: '/admin', icon: LayoutDashboard }] : []),
    ];

    const handleLogout = async () => {
        await logout();
        navigate('/login');
    };

    // Primary palette defined in the new specs
    const primaryActive = '#3A7AFE';
    const textPrimary = '#1A1F36';
    const textSecondary = 'rgba(26,31,54,0.65)';

    const primaryDarkActive = '#1D4ED8';

    return (
        <div className="fixed top-3 lg:top-[16px] left-1/2 -translate-x-1/2 z-[2000] w-[94%] md:w-[68%] max-w-[1140px] group transition-all duration-[220ms] ease-out hover:-translate-y-[2px]">
            <nav
                className="flex items-center justify-between w-full h-[74px] md:h-[86px] rounded-full px-5 md:px-8 transition-all duration-[220ms]"
                style={{
                    background: 'rgba(255, 255, 255, 0.2)',
                    backdropFilter: 'blur(40px) saturate(200%)',
                    WebkitBackdropFilter: 'blur(40px) saturate(200%)',
                    border: '1px solid rgba(255, 255, 255, 0.6)',
                    boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.1), inset 0 1px 0 0 rgba(255, 255, 255, 0.4)',
                }}
            >
                {/* Logo Section */}
                <div className="flex items-center gap-[8px] flex-shrink-0">
                    <img src="/evara-logo.png" alt="EvaraTech" className="w-[42px] h-[42px] object-contain drop-shadow-sm" />
                    <span
                        className="text-[22px] font-black hidden lg:block tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-[#0E79C1] via-[#00A3A6] to-[#2BC872]"
                    >
                        EvaraTech
                    </span>
                </div>

                {/* Nav Items Section */}
                <div className="flex items-center gap-1 md:gap-3 flex-nowrap mx-3 md:mx-4 flex-1 justify-center">
                    {navItems.map((item) => {
                        const isActive = item.path === '/dashboard'
                            ? location.pathname === '/dashboard'
                            : location.pathname.startsWith(item.path);

                        return (
                            <Link
                                key={item.path}
                                to={item.path}
                                className={clsx(
                                    "flex items-center gap-2 px-4 py-2.5 rounded-full font-bold tracking-tight text-[15px] flex-shrink-0 transition-all cursor-pointer whitespace-nowrap",
                                    "active:scale-[0.96] active:opacity-80"
                                )}
                                style={{
                                    background: isActive ? 'linear-gradient(135deg, rgba(37,99,235,0.25), rgba(29,78,216,0.4))' : 'transparent',
                                    backdropFilter: isActive ? 'blur(12px) saturate(180%)' : 'none',
                                    WebkitBackdropFilter: isActive ? 'blur(12px) saturate(180%)' : 'none',
                                    color: isActive ? primaryDarkActive : textSecondary,
                                    border: isActive ? '1px solid rgba(255,255,255,0.3)' : '1px solid transparent',
                                    boxShadow: isActive ? 'inset 0 1px 1px rgba(255,255,255,0.5), inset 0 -1px 2px rgba(29,78,216,0.3), 0 8px 16px rgba(29,78,216,0.3)' : 'none',
                                    transition: 'all 180ms cubic-bezier(0.4, 0, 0.2, 1)',
                                }}
                                onMouseEnter={(e) => {
                                    if (!isActive) {
                                        e.currentTarget.style.background = 'rgba(255,255,255,0.15)';
                                        e.currentTarget.style.border = '1px solid transparent';
                                    }
                                    if (!isActive) e.currentTarget.style.color = textPrimary;
                                }}
                                onMouseLeave={(e) => {
                                    if (!isActive) {
                                        e.currentTarget.style.background = 'transparent';
                                        e.currentTarget.style.border = '1px solid transparent';
                                    }
                                    if (!isActive) e.currentTarget.style.color = textSecondary;
                                }}
                            >
                                <item.icon
                                    size={23}
                                    strokeWidth={2}
                                    color={isActive ? primaryDarkActive : 'currentColor'}
                                    className="opacity-90"
                                />
                                <span className="hidden md:block">{item.name}</span>
                            </Link>
                        );
                    })}
                </div>

                <div className="flex items-center gap-3 flex-shrink-0">
                    {isAuthenticated && user ? (
                        <div className="flex items-center gap-3">
                            {/* Role badge removed, replaced with soft profile badge */}
                            <Link
                                to={user?.role === 'superadmin' ? "/superadmin/dashboard" : "/admin"}
                                className="flex items-center gap-[6px] transition-all hover:opacity-80 rounded-full px-2 py-1.5 hover:bg-white/20"
                            >
                                <div
                                    className="w-[42px] h-[42px] rounded-full flex items-center justify-center font-bold text-[15px] shadow-sm"
                                    style={{
                                        background: 'rgba(255,255,255,0.4)',
                                        color: primaryActive,
                                        border: '1px solid rgba(255,255,255,0.6)'
                                    }}
                                >
                                    {user.displayName[0].toUpperCase()}
                                </div>
                                <span
                                    className="hidden xl:block text-[15px] font-bold tracking-tight pr-1"
                                    style={{ color: textPrimary }}
                                >
                                    {user.displayName}
                                </span>
                            </Link>

                            {/* Minimal Logout */}
                            <button
                                onClick={handleLogout}
                                className="w-[42px] h-[42px] flex items-center justify-center opacity-60 hover:opacity-100 hover:bg-white/20 rounded-full transition-all duration-200"
                                style={{ color: textPrimary }}
                                title="Logout"
                            >
                                <LogOut size={22} strokeWidth={2} />
                            </button>
                        </div>
                    ) : (
                        <Link
                            to="/login"
                            className="px-6 py-2.5 rounded-full text-[15px] font-bold tracking-tight transition-all"
                            style={{
                                background: 'linear-gradient(to bottom, #3A7AFE, #2563EB)',
                                color: '#FFFFFF',
                                boxShadow: '0 4px 12px rgba(58,122,254,0.3), inset 0 1px 1px rgba(255,255,255,0.4)'
                            }}
                        >
                            Login
                        </Link>
                    )}
                </div>
            </nav>
        </div>
    );
};

export default Navbar;
