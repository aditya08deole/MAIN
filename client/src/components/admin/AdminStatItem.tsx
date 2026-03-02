interface StatItemProps {
    label: string;
    value: string;
    trend?: string;
    trendUp?: boolean;
}

export const AdminStatItem = ({ label, value, trend, trendUp }: StatItemProps) => (
    <div className="apple-glass-card p-5 rounded-2xl border border-slate-100 shadow-sm transition-all hover:shadow-md">
        <p className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-2">{label}</p>
        <div className="flex items-end gap-3">
            <span className="text-2xl font-bold text-slate-800">{value}</span>
            {trend && (
                <span className={`text-xs font-bold mb-1 ${trendUp ? 'text-green-600' : 'text-red-500'}`}>
                    {trend}
                </span>
            )}
        </div>
    </div>
);
