
import { useState, useEffect } from 'react';
import { Users, Edit2, Save, X } from 'lucide-react';
import { adminService, type Profile } from '../services/admin';
import type { UserRole } from '../types/database';

export default function UserManagementPage() {
    const [users, setUsers] = useState<Profile[]>([]);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [selectedRole, setSelectedRole] = useState<UserRole>('customer');

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        try {
            // setLoading(true);
            const data = await adminService.getCustomers();
            setUsers(data);
        } catch (err) {
            console.error("Failed to fetch users", err);
        } finally {
            // setLoading(false);
        }
    };

    const startEdit = (user: Profile) => {
        setEditingId(user.id);
        setSelectedRole(user.role as UserRole);
    };

    const saveRole = async () => {
        if (!editingId) return;
        try {
            await adminService.updateProfileRole(editingId, selectedRole);
            setUsers(users.map(u => u.id === editingId ? { ...u, role: selectedRole } : u));
            setEditingId(null);
        } catch {
            alert("Failed to update role");
        }
    };

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            <div className="flex items-center gap-4 mb-6">
                <Users className="w-8 h-8 text-blue-600" />
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">User Management</h1>
                    <p className="text-slate-500">Manage user access and roles.</p>
                </div>
            </div>

            <div className="apple-glass-card rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                <table className="w-full text-left">
                    <thead className="apple-glass-inner border-b border-slate-200">
                        <tr>
                            <th className="p-4 text-xs font-bold text-slate-500 uppercase">User</th>
                            <th className="p-4 text-xs font-bold text-slate-500 uppercase">Email</th>
                            <th className="p-4 text-xs font-bold text-slate-500 uppercase">Current Role</th>
                            <th className="p-4 text-xs font-bold text-slate-500 uppercase text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {users.map(user => (
                            <tr key={user.id} className="hover:bg-white/30 transition-colors">
                                <td className="p-4 font-medium text-slate-700">{user.full_name || 'N/A'}</td>
                                <td className="p-4 text-slate-500">{user.email}</td>
                                <td className="p-4">
                                    {editingId === user.id ? (
                                        <select
                                            className="p-1 border rounded text-sm"
                                            value={selectedRole}
                                            onChange={(e) => setSelectedRole(e.target.value as UserRole)}
                                        >
                                            <option value="superadmin">Super Admin</option>
                                            <option value="distributor">Distributor</option>
                                            <option value="customer">Customer</option>
                                            <option value="operator">Operator</option>
                                            <option value="viewer">Viewer</option>
                                        </select>
                                    ) : (
                                        <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded-md text-xs font-bold uppercase tracking-wide border border-slate-200">
                                            {user.role}
                                        </span>
                                    )}
                                </td>
                                <td className="p-4 text-right">
                                    {editingId === user.id ? (
                                        <div className="flex justify-end gap-2">
                                            <button onClick={saveRole} className="p-1 text-green-600 hover:bg-green-50 rounded"><Save className="w-4 h-4" /></button>
                                            <button onClick={() => setEditingId(null)} className="p-1 text-red-600 hover:bg-red-50 rounded"><X className="w-4 h-4" /></button>
                                        </div>
                                    ) : (
                                        <button onClick={() => startEdit(user)} className="p-1 text-blue-600 hover:bg-blue-50 rounded">
                                            <Edit2 className="w-4 h-4" />
                                        </button>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
