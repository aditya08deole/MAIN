import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Activity, Droplets, Zap, Clock } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';

// Mock Data Generators
const generateTimeSeriesData = (points: number) => {
    return Array.from({ length: points }, (_, i) => ({
        time: `${i}:00`,
        value: Math.floor(Math.random() * 100) + 50,
        flow: Math.floor(Math.random() * 50) + 20,
    }));
};

const NodeDetails = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const data = generateTimeSeriesData(24);

    return (
        <div className="p-6 bg-slate-50 min-h-screen space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <button
                    onClick={() => navigate(-1)}
                    className="p-2 bg-white rounded-full shadow-sm hover:bg-slate-100 transition-colors"
                >
                    <ArrowLeft size={20} className="text-slate-600" />
                </button>
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Node Details: {id}</h1>
                    <p className="text-sm text-slate-500">Real-time monitoring and analytics</p>
                </div>
                <div className="ml-auto flex gap-3">
                    <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-bold flex items-center gap-2">
                        <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                        Live
                    </span>
                </div>
            </div>

            {/* Key Metrics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                    <div className="flex justify-between items-start mb-2">
                        <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
                            <Droplets size={20} />
                        </div>
                        <span className="text-xs font-medium text-slate-400">Total Flow</span>
                    </div>
                    <div className="text-2xl font-bold text-slate-800">450.2 KL</div>
                    <p className="text-xs text-green-600 flex items-center mt-1">
                        +12% <span className="text-slate-400 ml-1">vs yesterday</span>
                    </p>
                </div>

                <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                    <div className="flex justify-between items-start mb-2">
                        <div className="p-2 bg-purple-50 rounded-lg text-purple-600">
                            <Zap size={20} />
                        </div>
                        <span className="text-xs font-medium text-slate-400">Power Usage</span>
                    </div>
                    <div className="text-2xl font-bold text-slate-800">124 kWh</div>
                    <p className="text-xs text-green-600 flex items-center mt-1">
                        -5% <span className="text-slate-400 ml-1">efficiency</span>
                    </p>
                </div>

                <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                    <div className="flex justify-between items-start mb-2">
                        <div className="p-2 bg-orange-50 rounded-lg text-orange-600">
                            <Activity size={20} />
                        </div>
                        <span className="text-xs font-medium text-slate-400">Pressure</span>
                    </div>
                    <div className="text-2xl font-bold text-slate-800">4.2 Bar</div>
                    <p className="text-xs text-slate-400 flex items-center mt-1">
                        Normal Range
                    </p>
                </div>

                <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                    <div className="flex justify-between items-start mb-2">
                        <div className="p-2 bg-green-50 rounded-lg text-green-600">
                            <Clock size={20} />
                        </div>
                        <span className="text-xs font-medium text-slate-400">Runtime</span>
                    </div>
                    <div className="text-2xl font-bold text-slate-800">8h 12m</div>
                    <p className="text-xs text-slate-400 flex items-center mt-1">
                        Since last reset
                    </p>
                </div>
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Flow Rate Chart */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                    <h3 className="text-lg font-bold text-slate-800 mb-4">Flow Rate Analysis</h3>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={data}>
                                <defs>
                                    <linearGradient id="colorFlow" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1} />
                                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                                <Tooltip
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                />
                                <Area type="monotone" dataKey="flow" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorFlow)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Power Consumption Chart */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
                    <h3 className="text-lg font-bold text-slate-800 mb-4">Power Consumption</h3>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={data}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 12 }} />
                                <Tooltip
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                />
                                <Line type="monotone" dataKey="value" stroke="#8b5cf6" strokeWidth={3} dot={false} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default NodeDetails;
