import { useState, useEffect } from 'react';
import {
    Download, Search, Shield
} from 'lucide-react';
import { getAuditLogs, exportAuditLogs, type AuditLog } from '../services/audit';

export default function AuditLogsPage() {
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');

    useEffect(() => {
        fetchLogs();
    }, []);

    const fetchLogs = async () => {
        try {
            setLoading(true);
            const data = await getAuditLogs();
            setLogs(data);
        } catch (err) {
            console.error("Failed to fetch audit logs", err);
        } finally {
            setLoading(false);
        }
    };

    const filteredLogs = logs.filter(log =>
        log.action.toLowerCase().includes(search.toLowerCase()) ||
        log.user?.email.toLowerCase().includes(search.toLowerCase()) ||
        log.resource_type.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                        <Shield className="w-6 h-6 text-blue-600" /> Audit Logs
                    </h1>
                    <p className="text-slate-500">Track system activity and security events.</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => exportAuditLogs()}
                        className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors shadow-sm"
                    >
                        <Download className="w-4 h-4" /> Export CSV
                    </button>
                </div>
            </div>

            {/* Filters (Basic) */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex gap-4">
                <div className="flex-1 relative">
                    <Search className="absolute left-3 top-2.5 w-5 h-5 text-slate-400" />
                    <input
                        placeholder="Search by action, user, or resource..."
                        className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
            </div>

            {/* Data Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50 border-b border-slate-200">
                            <tr>
                                <th className="p-4 text-xs font-bold text-slate-500 uppercase">Timestamp</th>
                                <th className="p-4 text-xs font-bold text-slate-500 uppercase">User</th>
                                <th className="p-4 text-xs font-bold text-slate-500 uppercase">Action</th>
                                <th className="p-4 text-xs font-bold text-slate-500 uppercase">Resource</th>
                                <th className="p-4 text-xs font-bold text-slate-500 uppercase">Details</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr><td colSpan={5} className="p-8 text-center text-slate-500">Loading logs...</td></tr>
                            ) : filteredLogs.length === 0 ? (
                                <tr><td colSpan={5} className="p-8 text-center text-slate-400 italic">No logs found matching your criteria.</td></tr>
                            ) : (
                                filteredLogs.map(log => (
                                    <tr key={log.id} className="hover:bg-slate-50 transition-colors group">
                                        <td className="p-4 text-sm text-slate-500 whitespace-nowrap font-mono">
                                            {new Date(log.timestamp).toLocaleString()}
                                        </td>
                                        <td className="p-4">
                                            <div className="font-medium text-slate-700">{log.user?.full_name || 'Unknown'}</div>
                                            <div className="text-xs text-slate-400">{log.user?.email}</div>
                                        </td>
                                        <td className="p-4">
                                            <span className="bg-blue-50 text-blue-700 px-2 py-1 rounded-md text-xs font-bold uppercase tracking-wide">
                                                {log.action}
                                            </span>
                                        </td>
                                        <td className="p-4 text-sm text-slate-600">
                                            <span className="text-xs text-slate-400 uppercase mr-1">{log.resource_type}:</span>
                                            {log.resource_id}
                                        </td>
                                        <td className="p-4 text-xs text-slate-500 font-mono">
                                            {log.details ? JSON.stringify(log.details) : '-'}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
