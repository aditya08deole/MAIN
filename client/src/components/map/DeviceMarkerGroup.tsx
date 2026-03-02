/**
 * DeviceMarkerGroup — renders filtered Leaflet markers with popups for a
 * single asset category.  Replaces 5 near-identical marker blocks that were
 * duplicated in Home.tsx.
 */
import { Marker, Popup } from 'react-leaflet';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { isOnline, getAssetButtonClass, getDeviceIcon, fullIcons } from '../../utils/mapIcons';
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

                return (
                    <Marker key={device.id} position={[device.latitude!, device.longitude!]} icon={icon}>
                        <Popup>
                            <div className="p-2 min-w-[150px]">
                                <h3 className="font-bold text-slate-800 text-sm mb-1">{device.name}</h3>
                                {device.capacity && (
                                    <p className="text-xs text-slate-600 mb-1">Capacity: {device.capacity}</p>
                                )}
                                <div className="mb-3">
                                    <span className={clsx(
                                        "text-[10px] font-bold px-2 py-0.5 rounded-full inline-block",
                                        isOnline(device.status) ? "text-green-600 bg-green-50" : "text-slate-600 bg-slate-100"
                                    )}>
                                        {device.status}
                                    </span>
                                </div>
                                <Link
                                    to={getDeviceAnalyticsRoute(device as any)}
                                    className={clsx(
                                        "block w-full text-center text-white text-xs font-bold py-1.5 px-3 rounded transition-colors",
                                        getAssetButtonClass(device.asset_type)
                                    )}
                                >
                                    View Details
                                </Link>
                            </div>
                        </Popup>
                    </Marker>
                );
            })}
        </>
    );
};

export default DeviceMarkerGroup;
