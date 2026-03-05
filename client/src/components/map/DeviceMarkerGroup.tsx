/**
 * DeviceMarkerGroup — renders filtered Leaflet markers with a permanent
 * name label (always visible) and a glassmorphism hover popup.
 */
import { Marker, Popup, Tooltip } from 'react-leaflet';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { isOnline, getAssetButtonClass, getDeviceIcon, getAssetColor, fullIcons } from '../../utils/mapIcons';
import { getDeviceAnalyticsRoute } from '../../utils/deviceRouting';
import type { MapDevice } from '../../hooks/useMapDevices';

interface Props {
    devices: MapDevice[];
    activeFilter: string | null;
    /** Filter key(s) that should make this group visible. The group is also visible when activeFilter is null. */
    filterKeys: string[];
}

export const DeviceMarkerGroup = ({ devices, activeFilter, filterKeys }: Props) => {
    // Visibility check
    if (activeFilter !== null && !filterKeys.includes(activeFilter)) return null;

    return (
        <>
            {devices.map((device) => {
                const icon = getDeviceIcon(device.asset_type, device.status, fullIcons);
                const accentColor = getAssetColor(device.asset_type);
                const online = isOnline(device.status);

                return (
                    <Marker key={device.id} position={[device.latitude!, device.longitude!]} icon={icon}>
                        {/* Always-visible device name chip */}
                        <Tooltip
                            permanent
                            direction="top"
                            offset={[0, -20]}
                            className="device-name-label"
                        >
                            {device.name}
                        </Tooltip>

                        {/* Glassmorphism hover/click popup */}
                        <Popup className="leaflet-glass-popup" maxWidth={220} minWidth={190}>
                            <h3 className="font-black text-slate-900 text-[13px] leading-tight mb-1">{device.name}</h3>
                            {device.capacity && (
                                <p className="text-[11px] text-slate-500 mb-2">Capacity: {device.capacity}</p>
                            )}
                            <div className="flex items-center gap-2 mb-3">
                                <span className={clsx(
                                    "flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full",
                                    online ? "text-emerald-700 bg-emerald-100" : "text-slate-500 bg-slate-100"
                                )}>
                                    <span className={clsx(
                                        "inline-block w-1.5 h-1.5 rounded-full",
                                        online ? "bg-emerald-500 animate-pulse" : "bg-slate-400"
                                    )} />
                                    {device.status}
                                </span>
                            </div>
                            <Link
                                to={getDeviceAnalyticsRoute(device as any)}
                                className={clsx(
                                    "block w-full text-center text-white text-[11px] font-black py-2 px-3 rounded-lg transition-all hover:scale-[1.02] active:scale-[0.98] shadow-sm",
                                    getAssetButtonClass(device.asset_type)
                                )}
                            >
                                View Details →
                            </Link>
                        </Popup>
                    </Marker>
                );
            })}
        </>
    );
};

export default DeviceMarkerGroup;
