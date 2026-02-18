import { Server, Activity, Search, Filter } from 'lucide-react';
import { Link } from 'react-router-dom';

const AllNodes = () => {
    // Mock data for nodes
    const nodes = [
        { id: 'NOD-001', name: 'Main Tank Monitor', type: 'EvaraTank', location: 'Block A', status: 'Online', battery: '85%' },
        { id: 'NOD-002', name: 'Deep Well Pump', type: 'EvaraDeep', location: 'Agri Farm', status: 'Online', battery: '92%' },
        { id: 'NOD-003', name: 'West Wing Flow', type: 'EvaraFlow', location: 'Gate 2', status: 'Offline', battery: '12%' },
        { id: 'NOD-004', name: 'Roof Sump C', type: 'EvaraTank', location: 'Block C', status: 'Online', battery: '95%' },
        { id: 'NOD-005', name: 'North Boundary', type: 'EvaraFlow', location: 'Entry', status: 'Online', battery: '88%' },
    ];

    return (
        <div className="p-6 bg-slate-50 min-h-full">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-2xl font-extrabold text-slate-800">All Nodes</h1>
                    <p className="text-sm text-slate-500">Manage and monitor all deployed hardware devices</p>
                </div>
                <div className="flex gap-2">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input
                            type="text"
                            placeholder="Search nodes..."
                            className="pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                        />
                    </div>
                    <button className="p-2 bg-white border border-slate-200 rounded-xl text-slate-600 hover:bg-slate-50 transition-colors">
                        <Filter size={18} />
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {nodes.map((node) => (
                    <Link
                        key={node.id}
                        to={`/node/${node.id}`}
                        className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-all group"
                    >
                        <div className="flex justify-between items-start mb-4">
                            <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl group-hover:bg-blue-600 group-hover:text-white transition-colors">
                                <Server size={24} />
                            </div>
                            <div className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${node.status === 'Online' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                                }`}>
                                {node.status}
                            </div>
                        </div>
                        <h3 className="font-bold text-slate-800 text-lg mb-1">{node.name}</h3>
                        <div className="text-xs text-slate-500 font-medium mb-4 flex items-center gap-2">
                            <span className="px-2 py-0.5 bg-slate-100 rounded-md">{node.type}</span>
                            <span>•</span>
                            <span>{node.location}</span>
                        </div>
                        <div className="flex items-center justify-between pt-4 border-t border-slate-50">
                            <div className="flex items-center gap-2 text-xs text-slate-400">
                                <Activity size={12} />
                                <span>Health: Excellent</span>
                            </div>
                            <div className="text-xs font-bold text-slate-700">
                                {node.battery}
                            </div>
                        </div>
                    </Link>
                ))}
            </div>
        </div>
    );
};

export default AllNodes;
