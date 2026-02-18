import { useState } from 'react';
import { Eye } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import type { UserRole, UserPlan } from '../context/AuthContext';

export const RolePreviewButton = () => {
    const { user } = useAuth();
    const [isOpen, setIsOpen] = useState(false);

    // Only show for super admins
    if (user?.role !== 'superadmin') return null;

    const previewOptions = [
        { role: 'customer' as UserRole, plan: 'base' as UserPlan, label: 'Customer (Base)' },
        { role: 'customer' as UserRole, plan: 'plus' as UserPlan, label: 'Customer (Plus)' },
        { role: 'customer' as UserRole, plan: 'pro' as UserPlan, label: 'Customer (Pro)' },
        { role: 'distributor' as UserRole, label: 'Distributor' },
    ];

    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="px-3 py-1.5 bg-orange-100 hover:bg-orange-200 text-orange-700 text-xs font-bold rounded-lg flex items-center gap-2 transition-all border border-orange-200"
            >
                <Eye size={14} />
                Preview Mode
            </button>

            {isOpen && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)}></div>
                    <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-lg border border-slate-200 py-2 z-50">
                        <div className="px-3 py-2 text-[10px] font-bold text-slate-500 uppercase tracking-wide border-b border-slate-100">
                            Preview as Role
                        </div>
                        {previewOptions.map((option) => (
                            <button
                                key={`${option.role}-${option.plan || 'default'}`}
                                onClick={() => {
                                    // TODO: Implement preview mode
                                    console.log('Preview as:', option.role, option.plan);
                                    setIsOpen(false);
                                }}
                                className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50 transition-colors text-slate-700 font-medium"
                            >
                                {option.label}
                            </button>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
};
