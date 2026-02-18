
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    ArrowLeft, Cpu, Activity,
    Download, Power, RefreshCw
} from 'lucide-react';
import { getDeviceDetails, updateDeviceShadow, exportDeviceReadings, type DeviceDetails } from '../services/devices';

export default function DeviceDetailsPage() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [device, setDevice] = useState<DeviceDetails | null>(null);
    const [loading, setLoading] = useState(true);
    const [toggling, setToggling] = useState(false);

    useEffect(() => {
        if (id) fetchDevice(id);
    }, [id]);

    const fetchDevice = async (nodeId: string) => {
        try {
            setLoading(true);
            const data = await getDeviceDetails(nodeId);
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
            await updateDeviceShadow(id, { pump_status: newState ? 'ON' : 'OFF' });

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
                        onClick={() => id && exportDeviceReadings(id)}
                        className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                    >
                        <Download className="w-4 h-4" /> Export Data
                    </button>
                    <button
                        onClick={() => id && fetchDevice(id)}
                        className="p-2 bg-white border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50"
                    >
                        <RefreshCw className="w-4 h-4" />
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Main Info Card */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6 md:col-span-2">
                    <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                        <Activity className="w-5 h-5 text-blue-500" /> Status & Controls
                    </h3>

                    <div className="grid grid-cols-2 gap-6">
                        <div className="p-4 bg-slate-50 rounded-lg">
                            <span className="text-xs font-bold text-slate-400 uppercase">Current Status</span>
                            <div className="text-xl font-bold text-slate-700 mt-1 capitalize">{device.status}</div>
                        </div>

                        <div className="p-4 bg-slate-50 rounded-lg flex items-center justify-between">
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
                <div className="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
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
