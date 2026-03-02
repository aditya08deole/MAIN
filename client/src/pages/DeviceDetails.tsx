
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    ArrowLeft, Cpu, Activity,
    Download, Power, RefreshCw, Clock
} from 'lucide-react';
import { deviceService, type DeviceDetails } from '../services/DeviceService';
import { useTelemetry } from '../hooks/useTelemetry';

export default function DeviceDetailsPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [device, setDevice] = useState<DeviceDetails | null>(null);
    const [loading, setLoading] = useState(true);
    const [toggling, setToggling] = useState(false);
    const { data: telemetry, loading: telemetryLoading, error: telemetryError } = useTelemetry(id);

    useEffect(() => {
        if (id) fetchDevice(id);
    }, [id]);

    const fetchDevice = async (nodeId: string) => {
        try {
            setLoading(true);
            const data = await deviceService.getDeviceDetails(nodeId);
            setDevice(data);
        } catch (err) {
            console.error("Error fetching device:", err);
        } finally {
            setLoading(false);
        }
    };

    const handleToggle = async (currentState: boolean) => {
        if (!device || !id) return;
        try {
            setToggling(true);
            const newState = !currentState;
            // Updating 'pump_status' as an example control
            // const result = await updateDeviceShadow(id, { pump_status: newState ? 'ON' : 'OFF' });
            await deviceService.updateDeviceShadow(id!, { pump_status: newState ? 'ON' : 'OFF' });

            // Optimistic update or refetch
            setDevice(prev => prev ? {
                ...prev,
                shadow_state: { ...prev.shadow_state, desired: { ...prev.shadow_state?.desired, pump_status: newState ? 'ON' : 'OFF' }, reported: prev.shadow_state?.reported || {} }
            } : null);

        } catch (err) {
            console.error("Failed to update shadow:", err);
            alert("Failed to send command to device.");
        } finally {
            setToggling(false);
        }
    };

    if (loading) return <div className="p-8 text-center text-slate-500">Loading device details...</div>;
    if (!device) return <div className="p-8 text-center text-red-500">Device not found</div>;

    const isPumpOn = device.shadow_state?.desired?.pump_status === 'ON';

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <button onClick={() => navigate(-1)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                    <ArrowLeft className="w-5 h-5 text-slate-600" />
                </button>
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">{device.label}</h1>
                    <p className="text-sm text-slate-500 font-mono">{device.id}</p>
                </div>
                <div className="ml-auto flex gap-2">
                    <button
                        onClick={() => id && deviceService.exportDeviceReadings(id)}
                        className="flex items-center gap-2 px-4 py-2 apple-glass-card border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-white/30 transition-colors"
                    >
                        <Download className="w-4 h-4" /> Export Data
                    </button>
                    <button
                        onClick={() => id && fetchDevice(id)}
                        className="p-2 apple-glass-card border border-slate-200 rounded-lg text-slate-600 hover:bg-white/30"
                    >
                        <RefreshCw className="w-4 h-4" />
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Main Info Card */}
                <div className="apple-glass-card rounded-xl shadow-sm border border-slate-100 p-6 md:col-span-2">
                    <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                        <Activity className="w-5 h-5 text-blue-500" /> Status & Controls
                    </h3>

                    <div className="grid grid-cols-2 gap-6">
                        <div className="p-4 apple-glass-inner rounded-lg">
                            <span className="text-xs font-bold text-slate-400 uppercase">Current Status</span>
                            <div className="text-xl font-bold text-slate-700 mt-1 capitalize">{device.status}</div>
                        </div>

                        <div className="p-4 apple-glass-inner rounded-lg flex items-center justify-between">
                            <div>
                                <span className="text-xs font-bold text-slate-400 uppercase">Pump Control</span>
                                <div className="text-sm font-medium text-slate-600 mt-1">
                                    {toggling ? "Sending..." : (isPumpOn ? "Running" : "Stopped")}
                                </div>
                            </div>
                            <button
                                onClick={() => handleToggle(isPumpOn)}
                                disabled={toggling}
                                className={`p-3 rounded-full transition-all duration-300 ${isPumpOn ? 'bg-green-100 text-green-600 shadow-inner' : 'bg-slate-200 text-slate-400 shadow-sm'}`}
                            >
                                <Power className="w-6 h-6" />
                            </button>
                        </div>
                    </div>

                    {/* Real-Time Telemetry Grid */}
                    <div className="mt-8">
                        <h4 className="text-sm font-bold text-slate-400 uppercase mb-4 tracking-wider">Live Metrics</h4>
                        {telemetryLoading && !telemetry ? (
                            <div className="animate-pulse flex space-x-4">
                                <div className="h-20 bg-slate-100 rounded-xl flex-1"></div>
                                <div className="h-20 bg-slate-100 rounded-xl flex-1"></div>
                            </div>
                        ) : telemetryError ? (
                            <div className="p-4 bg-red-50 text-red-600 rounded-xl text-xs font-medium border border-red-100">
                                {telemetryError} (ThingSpeak Handshake Required)
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div className="p-4 bg-blue-50/50 rounded-xl border border-blue-100 transition-all hover:shadow-sm">
                                    <div className="text-[10px] font-extrabold text-blue-400 uppercase tracking-tighter">Signal Strength</div>
                                    <div className="text-2xl font-black text-blue-700 mt-1">
                                        {telemetry?.values?.signal_strength || 'N/A'}
                                    </div>
                                </div>
                                <div className="p-4 bg-blue-50/50 rounded-xl border border-blue-100 transition-all hover:shadow-sm">
                                    <div className="text-[10px] font-extrabold text-blue-400 uppercase tracking-tighter">Water Level</div>
                                    <div className="text-2xl font-black text-blue-700 mt-1">
                                        {telemetry?.values?.level || 'N/A'}
                                    </div>
                                </div>
                                {Object.keys(telemetry?.values || {}).length === 0 && (
                                    <div className="col-span-full text-center py-6 text-slate-400 text-sm italic">
                                        No live metrics registered for this device yet.
                                    </div>
                                )}
                            </div>
                        )}
                        <p className="text-[10px] text-slate-400 mt-4 flex items-center gap-1.5">
                            <Clock size={12} /> Last valid feed: {telemetry?.timestamp ? new Date(telemetry.timestamp).toLocaleString() : 'Never'}
                        </p>
                    </div>

                    {/* Shadow State Debug (Optional) */}
                    <div className="mt-6">
                        <details className="text-xs text-slate-400 cursor-pointer">
                            <summary>View Device Shadow State</summary>
                            <pre className="mt-2 bg-slate-900 text-slate-50 p-3 rounded-lg overflow-auto max-h-40">
                                {JSON.stringify(device.shadow_state, null, 2)}
                            </pre>
                        </details>
                    </div>
                </div>

                {/* Metadata Card */}
                <div className="apple-glass-card rounded-xl shadow-sm border border-slate-100 p-6">
                    <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                        <Cpu className="w-5 h-5 text-purple-500" /> System Info
                    </h3>
                    <div className="space-y-4">
                        <div className="flex justify-between items-center py-2 border-b border-slate-50">
                            <span className="text-sm text-slate-500">Firmware</span>
                            <span className="text-sm font-medium text-slate-700">{device.firmware_version || 'v1.0.0'}</span>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b border-slate-50">
                            <span className="text-sm text-slate-500">Calibration</span>
                            <span className="text-sm font-medium text-slate-700">{device.calibration_factor || '1.0'}x</span>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b border-slate-50">
                            <span className="text-sm text-slate-500">Maintenance</span>
                            <span className="text-sm font-medium text-slate-700">
                                {device.last_maintenance_date ? new Date(device.last_maintenance_date).toLocaleDateString() : 'N/A'}
                            </span>
                        </div>
                        <div className="flex justify-between items-center py-2 border-b border-slate-50">
                            <span className="text-sm text-slate-500">Location</span>
                            <span className="text-sm font-medium text-slate-700">{device.location_name || 'Unknown'}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
