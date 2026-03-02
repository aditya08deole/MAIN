import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { adminService } from '../../services/admin';
import { User, Search, MapPin, Filter, Plus } from 'lucide-react';
import { Modal } from '../../components/ui/Modal';
import { AddCustomerForm } from '../../components/admin/forms/AddCustomerForm';

const AdminCustomers = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [search, setSearch] = useState('');
    const [clients, setClients] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);

    const fetchClients = async () => {
        try {
            const data = await adminService.getClients();
            setClients(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error('Failed to fetch clients:', error);
            setClients([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchClients(); }, []);

    const filteredClients = clients.filter(c => {
        const name  = (c.name  || '').toLowerCase();
        const email = (c.email || '').toLowerCase();
        return name.includes(search.toLowerCase()) || email.includes(search.toLowerCase());
    });

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    return (
        <div className="glass-dashboard min-h-screen p-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-[24px]">
                <div>
                    <h2 className="text-[28px] font-[600] tracking-[-0.5px] text-[#1F2937] leading-tight">Customer Management</h2>
                    <p className="glass-secondary mt-1">Global list of registered customers across all zones.</p>
                </div>

                <div className="flex items-center gap-3">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#1F2937] opacity-40" size={18} />
                        <input
                            type="text"
                            placeholder="Search customers..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="pl-10 pr-4 py-2 bg-[rgba(255,255,255,0.3)] border border-[rgba(255,255,255,0.4)] rounded-xl text-sm focus:ring-2 focus:ring-[rgba(58,122,254,0.3)] focus:border-[#3A7AFE] outline-none w-64 shadow-sm text-[#1F2937] placeholder:text-[#1F2937] placeholder:opacity-40 transition-all"
                        />
                    </div>
                    <button className="p-2 bg-[rgba(255,255,255,0.3)] border border-[rgba(255,255,255,0.4)] rounded-xl text-[#1F2937] opacity-80 hover:bg-[rgba(255,255,255,0.5)] shadow-sm transition-all">
                        <Filter size={18} />
                    </button>
                    {user?.role === 'superadmin' && (
                        <button
                            onClick={() => setShowAddModal(true)}
                            className="flex items-center gap-2 px-4 py-2 bg-[#1F2937] text-white text-[13px] font-[600] rounded-[12px] hover:bg-[#111827] shadow-sm transition-all"
                        >
                            <Plus size={16} /> Add Customer
                        </button>
                    )}
                </div>
            </div>

            <div className="apple-glass-card">
                <div className="apple-glass-content">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-[rgba(255,255,255,0.1)] text-[11px] font-[600] text-[#1F2937] opacity-70 uppercase tracking-wider">
                                <th className="px-6 py-4">Customer</th>
                                <th className="px-6 py-4">Location Context</th>
                                <th className="px-6 py-4">Contact</th>
                                <th className="px-6 py-4">Devices</th>
                                <th className="px-6 py-4 text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[rgba(255,255,255,0.1)]">
                            {filteredClients.map((client) => (
                                <tr
                                    key={client.id}
                                    onClick={() => navigate(`/superadmin/customers/${client.id}`)}
                                    className="group hover:bg-[rgba(255,255,255,0.2)] transition-colors cursor-pointer"
                                >
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-9 h-9 rounded-full bg-[rgba(255,255,255,0.3)] flex items-center justify-center text-[#1F2937] border border-[rgba(255,255,255,0.4)] shadow-sm">
                                                <User size={18} className="opacity-70" />
                                            </div>
                                            <div>
                                                <p className="text-[14px] font-[600] text-[#1F2937] group-hover:text-[#3A7AFE] transition-colors">
                                                    {client.name}
                                                </p>
                                                <p className="text-[11px] text-[#1F2937] opacity-50 font-mono tracking-tighter uppercase">{client.id.substring(0, 8)}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2 text-[13px]">
                                            <MapPin size={14} className="text-[#1F2937] opacity-50" />
                                            <div>
                                                <span className="text-[#1F2937] font-[500]">{client.communities?.name || 'Unknown Community'}</span>
                                                <span className="text-[#1F2937] opacity-40 mx-1">/</span>
                                                <span className="text-[#1F2937] opacity-60 text-[12px]">{client.communities?.zones?.name || 'No Zone'}</span>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="text-[13px] text-[#1F2937]">
                                            <p className="font-[500] opacity-90">{client.email || '—'}</p>
                                            <p className="opacity-60">{client.phone || 'N/A'}</p>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="text-[13px] font-[600] text-[#1F2937] bg-[rgba(255,255,255,0.4)] border border-[rgba(255,255,255,0.5)] px-2.5 py-1 rounded-[8px] shadow-sm">
                                            {client.devices?.length || 0}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <button className="text-[12px] font-[600] text-[#3A7AFE] border border-[rgba(58,122,254,0.3)] bg-[rgba(58,122,254,0.1)] px-3 py-1.5 rounded-[8px] opacity-0 group-hover:opacity-100 transition-all shadow-sm">
                                            Manage Profile
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {filteredClients.length === 0 && (
                    <div className="p-12 text-center">
                        <User className="mx-auto text-slate-300 mb-4" size={48} />
                        <p className="text-slate-500 font-medium">{loading ? 'Loading...' : 'No customers yet. Add your first customer.'}</p>
                    </div>
                )}
            </div>

            <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)} title="Add New Customer">
                <AddCustomerForm
                    onSubmit={() => { setShowAddModal(false); fetchClients(); }}
                    onCancel={() => setShowAddModal(false)}
                />
            </Modal>
        </div>
    );
};

export default AdminCustomers;
