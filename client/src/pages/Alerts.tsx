import { useState, useEffect } from 'react';
import {
    AlertTriangle, Plus, Trash2, CheckCircle, XCircle
} from 'lucide-react';
import {
    getAlertRules, createAlertRule, deleteAlertRule, getActiveAlerts,
    type AlertRule, type AlertHistory
} from '../services/alerts';
import { useNodes } from '../hooks/useNodes';

export default function AlertsPage() {
    const [rules, setRules] = useState<AlertRule[]>([]);
    const [activeAlerts, setActiveAlerts] = useState<AlertHistory[]>([]);
    const { nodes } = useNodes();

    // New Rule Form State
    const [showForm, setShowForm] = useState(false);
    const [newRule, setNewRule] = useState<Partial<AlertRule>>({
        condition: '>',
        enabled: true
    });

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const [rulesData, alertsData] = await Promise.all([
                getAlertRules(),
                getActiveAlerts()
            ]);
            setRules(rulesData);
            setActiveAlerts(alertsData);
        } catch (err) {
            console.error("Failed to fetch alerts data", err);
        } finally {
        }
    };

    const handleCreateRule = async () => {
        if (!newRule.name || !newRule.node_id || !newRule.metric || !newRule.threshold) {
            alert("Please fill all fields");
            return;
        }
        try {
            await createAlertRule(newRule as any);
            setShowForm(false);
            fetchData();
        } catch (err) {
            console.error("Failed to create rule", err);
        }
    };

    const handleDeleteRule = async (id: string) => {
        if (!confirm("Are you sure?")) return;
        try {
            await deleteAlertRule(id);
            setRules(prev => prev.filter(r => r.id !== id));
        } catch (err) {
            console.error("Failed to delete rule", err);
        }
    };

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-8">

            {/* Active Alerts Section */}
            <div className="bg-white rounded-2xl shadow-sm border border-red-100 overflow-hidden">
                <div className="p-6 bg-red-50 border-b border-red-100 flex items-center justify-between">
                    <h2 className="text-lg font-bold text-red-700 flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5" /> Active Alerts
                    </h2>
                    <span className="bg-red-200 text-red-800 text-xs font-bold px-2 py-1 rounded-full">
                        {activeAlerts.length}
                    </span>
                </div>
                <div className="divide-y divide-red-50">
                    {activeAlerts.length === 0 ? (
                        <div className="p-8 text-center text-slate-500">No active alerts (Safe Condition)</div>
                    ) : (
                        activeAlerts.map(alert => (
                            <div key={alert.id} className="p-4 flex items-center justify-between hover:bg-red-50/50 transition-colors">
                                <div>
                                    <h4 className="font-semibold text-slate-800">{alert.rule.name}</h4>
                                    <p className="text-sm text-slate-500">
                                        Value: <span className="font-mono font-bold text-red-600">{alert.value_at_time}</span>
                                        {' '}(Threshold: {alert.rule.condition} {alert.rule.threshold})
                                    </p>
                                </div>
                                <div className="text-right">
                                    <div className="text-xs font-bold text-red-500 uppercase tracking-wide">Critical</div>
                                    <div className="text-xs text-slate-400">{new Date(alert.triggered_at).toLocaleTimeString()}</div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Rules Management Section */}
            <div>
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold text-slate-800">Alert Rules</h2>
                    <button
                        onClick={() => setShowForm(!showForm)}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
                    >
                        <Plus className="w-4 h-4" /> New Rule
                    </button>
                </div>

                {showForm && (
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm mb-6 animate-in slide-in-from-top-4">
                        <h3 className="text-sm font-bold text-slate-500 uppercase mb-4">Define Notification Logic</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                            <input
                                placeholder="Rule Name (e.g. Tank 1 Low Level)"
                                className="p-2 border rounded-lg"
                                onChange={e => setNewRule({ ...newRule, name: e.target.value })}
                            />
                            <select
                                className="p-2 border rounded-lg"
                                onChange={e => setNewRule({ ...newRule, node_id: e.target.value })}
                            >
                                <option value="">Select Node...</option>
                                {nodes.map(n => <option key={n.id} value={n.id}>{n.label || n.id}</option>)}
                            </select>
                            <input
                                placeholder="Metric key (e.g. level, temp)"
                                className="p-2 border rounded-lg"
                                onChange={e => setNewRule({ ...newRule, metric: e.target.value })}
                            />
                            <div className="flex gap-2">
                                <select
                                    className="p-2 border rounded-lg"
                                    onChange={e => setNewRule({ ...newRule, condition: e.target.value as any })}
                                >
                                    <option value=">">&gt;</option>
                                    <option value="<">&lt;</option>
                                    <option value="==">=</option>
                                </select>
                                <input
                                    type="number"
                                    placeholder="Threshold"
                                    className="p-2 border rounded-lg w-full"
                                    onChange={e => setNewRule({ ...newRule, threshold: Number(e.target.value) })}
                                />
                            </div>
                            <button
                                onClick={handleCreateRule}
                                className="bg-green-600 text-white rounded-lg font-medium hover:bg-green-700"
                            >
                                Save Rule
                            </button>
                        </div>
                    </div>
                )}

                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50 border-b border-slate-200">
                            <tr>
                                <th className="p-4 text-xs font-bold text-slate-500 uppercase">Rule Name</th>
                                <th className="p-4 text-xs font-bold text-slate-500 uppercase">Conditions</th>
                                <th className="p-4 text-xs font-bold text-slate-500 uppercase">Target Node</th>
                                <th className="p-4 text-xs font-bold text-slate-500 uppercase">Status</th>
                                <th className="p-4 text-xs font-bold text-slate-500 uppercase text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {rules.map(rule => (
                                <tr key={rule.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="p-4 font-medium text-slate-700">{rule.name}</td>
                                    <td className="p-4 text-slate-600 font-mono text-sm">
                                        {rule.metric} <span className="text-blue-600 font-bold">{rule.condition}</span> {rule.threshold}
                                    </td>
                                    <td className="p-4 text-slate-600 text-sm">{rule.node_id}</td>
                                    <td className="p-4">
                                        {rule.enabled ?
                                            <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded-full flex w-fit items-center gap-1"><CheckCircle className="w-3 h-3" /> Active</span> :
                                            <span className="text-xs font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded-full flex w-fit items-center gap-1"><XCircle className="w-3 h-3" /> Disabled</span>
                                        }
                                    </td>
                                    <td className="p-4 text-right">
                                        <button
                                            onClick={() => handleDeleteRule(rule.id)}
                                            className="p-2 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded-lg transition-colors"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {rules.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="p-8 text-center text-slate-400 italic">No rules defined yet.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
