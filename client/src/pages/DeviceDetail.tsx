import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, MapPin, Activity, Info } from 'lucide-react';
import { useDevices } from '../hooks/useDevices';
import clsx from 'clsx';

export default function DeviceDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { devices, loading } = useDevices();

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-slate-600">Loading device...</p>
                </div>
            </div>
        );
    }

    const device = devices.find(d => d.id === id);

    if (!device) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <h2 className="text-2xl font-bold text-slate-800 mb-2">Device Not Found</h2>
                    <p className="text-slate-600 mb-6">The device you're looking for doesn't exist.</p>
                    <Link to="/home" className="text-blue-600 hover:text-blue-700 font-semibold">
                        ← Back to Map
                    </Link>
                </div>
            </div>
        );
    }

    const statusColor = (status: string) => {
        if (status === 'Online' || status === 'Working' || status === 'Running' || status === 'Normal') {
            return 'bg-green-50 text-green-700 border-green-200';
        }
        return 'bg-red-50 text-red-700 border-red-200';
    };

    const assetTypeLabel = (type: string) => {
        switch (type) {
            case 'pump': return 'Pump House';
            case 'sump': return 'Sump';
            case 'tank': return 'Overhead Tank';
            case 'bore': return 'Borewell (IIIT)';
            case 'govt': return 'Borewell (Govt)';
            default: return type;
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 p-6">
            <div className="max-w-4xl mx-auto">
                {/* Header */}
                <div className="mb-6">
                    <button
                        onClick={() => navigate(-1)}
                        className="flex items-center gap-2 text-slate-600 hover:text-slate-900 mb-4 transition-colors"
                    >
                        <ArrowLeft size={20} />
                        <span className="font-medium">Back</span>
                    </button>
                    <h1 className="text-3xl font-bold text-slate-900">{device.name}</h1>
                    <p className="text-slate-600 mt-1">{assetTypeLabel(device.asset_type)}</p>
                </div>

                {/* Status Card */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
                    <div className="flex items-center justify-between mb-6">
                        <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                            <Activity size={24} className="text-blue-600" />
                            Status Overview
                        </h2>
                        <span className={clsx(
                            'px-4 py-2 rounded-full text-sm font-bold border',
                            statusColor(device.status)
                        )}>
                            {device.status}
                        </span>
                    </div>

                    <div className="grid grid-cols-2 gap-6">
                        <div>
                            <p className="text-sm text-slate-500 mb-1">Asset Type</p>
                            <p className="text-lg font-semibold text-slate-900">{assetTypeLabel(device.asset_type)}</p>
                        </div>
                        {device.asset_category && (
                            <div>
                                <p className="text-sm text-slate-500 mb-1">Category</p>
                                <p className="text-lg font-semibold text-slate-900">{device.asset_category}</p>
                            </div>
                        )}
                        {device.capacity && (
                            <div>
                                <p className="text-sm text-slate-500 mb-1">Capacity</p>
                                <p className="text-lg font-semibold text-slate-900">{device.capacity}</p>
                            </div>
                        )}
                        {device.specifications && (
                            <div>
                                <p className="text-sm text-slate-500 mb-1">Specifications</p>
                                <p className="text-lg font-semibold text-slate-900">{device.specifications}</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Location Card */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
                    <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2 mb-4">
                        <MapPin size={24} className="text-blue-600" />
                        Location
                    </h2>
                    <div className="grid grid-cols-2 gap-6">
                        <div>
                            <p className="text-sm text-slate-500 mb-1">Latitude</p>
                            <p className="text-lg font-semibold text-slate-900">{device.latitude.toFixed(6)}</p>
                        </div>
                        <div>
                            <p className="text-sm text-slate-500 mb-1">Longitude</p>
                            <p className="text-lg font-semibold text-slate-900">{device.longitude.toFixed(6)}</p>
                        </div>
                    </div>
                    <a
                        href={`https://www.google.com/maps?q=${device.latitude},${device.longitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-4 inline-block text-blue-600 hover:text-blue-700 font-semibold text-sm"
                    >
                        Open in Google Maps →
                    </a>
                </div>

                {/* Device Info Card */}
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
                    <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2 mb-4">
                        <Info size={24} className="text-blue-600" />
                        Device Information
                    </h2>
                    <div className="space-y-3">
                        <div className="flex justify-between py-2 border-b border-slate-100">
                            <span className="text-slate-600">Device ID</span>
                            <span className="font-mono text-sm text-slate-900">{device.id}</span>
                        </div>
                        <div className="flex justify-between py-2 border-b border-slate-100">
                            <span className="text-slate-600">Active Status</span>
                            <span className="text-slate-900">{device.is_active === 'true' ? 'Active' : 'Inactive'}</span>
                        </div>
                        {device.created_at && (
                            <div className="flex justify-between py-2">
                                <span className="text-slate-600">Created</span>
                                <span className="text-slate-900">{new Date(device.created_at).toLocaleDateString()}</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Actions */}
                <div className="mt-6 flex gap-4">
                    <Link
                        to="/home"
                        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors text-center"
                    >
                        View on Map
                    </Link>
                    <Link
                        to="/dashboard"
                        className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-3 px-6 rounded-lg transition-colors text-center"
                    >
                        Back to Dashboard
                    </Link>
                </div>
            </div>
        </div>
    );
}
