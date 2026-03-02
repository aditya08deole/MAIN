import { MapContainer, TileLayer, Marker, Polyline, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import type { MapDevice, TelemetrySnapshot } from '../../services/DeviceService';
import type { MapPipeline } from '../../hooks/useMapPipelines';
import { getDeviceAnalyticsRoute } from '../../utils/deviceRouting';
import clsx from 'clsx';
import { twMerge } from 'tailwind-merge';

// Fix leaflet default icons
// @ts-ignore
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// â”€â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

interface SharedMapProps {
    devices: MapDevice[];
    pipelines: MapPipeline[];
    height?: string;
    showZoom?: boolean;
    className?: string;
    activeFilter?: string | null;
    activePipeline?: string | null;
}

interface HoverPanel {
    device: MapDevice;
    x: number;
    y: number;
}

// â”€â”€â”€ Badge Icon Factory â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function buildBadgeIcon(template: string, status: string): L.DivIcon {
    const isOnline = status === 'Online';
    const statusDot = isOnline ? '#10b981' : '#94a3b8';

    // Use the actual PNG device images directly
    const imgSrc =
        template === 'EvaraTank' ? '/tank.png' :
        template === 'EvaraDeep' ? '/borewell.png' :
        template === 'EvaraFlow' ? '/meter.png' :
        '/tank.png';



    const html = `<div style="position:relative;width:52px;height:52px;display:flex;align-items:center;justify-content:center;">
  <img src="${imgSrc}" style="width:50px;height:50px;object-fit:contain;display:block;filter:drop-shadow(0 3px 8px rgba(0,0,0,0.35)) drop-shadow(0 1px 3px rgba(0,0,0,0.25));" />
  <div style="position:absolute;bottom:0px;right:0px;width:13px;height:13px;border-radius:50%;background:${statusDot};border:2.5px solid #fff;box-shadow:0 2px 8px ${statusDot}90;"></div>
</div>`;

    return L.divIcon({
        className: 'evara-map-badge',
        html,
        iconSize: [52, 52],
        iconAnchor: [26, 26],
        popupAnchor: [0, -30],
    });
}

// â”€â”€â”€ Mini Telemetry Viz â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const MiniTelemetryViz = ({ device }: { device: MapDevice }) => {
    const snap = (device as any).telemetry_snapshot as TelemetrySnapshot | null | undefined;
    const template = (device as any).analytics_template || '';

    if (!snap) return (
        <div style={{ fontSize: '11px', color: '#94a3b8', fontStyle: 'italic', marginTop: '8px' }}>
            No telemetry available
        </div>
    );

    if (template === 'EvaraTank') {
        const pct = snap.level_percentage ?? 0;
        const barColor = pct > 60 ? '#22c55e' : pct > 30 ? '#f59e0b' : '#ef4444';
        return (
            <div style={{ marginTop: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontSize: '10px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Water Level</span>
                    <span style={{ fontSize: '13px', fontWeight: 800, color: '#1e293b' }}>{pct.toFixed(1)}%</span>
                </div>
                <div style={{ height: '6px', background: 'rgba(0,0,0,0.07)', borderRadius: '6px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${Math.min(100, Math.max(0, pct))}%`, background: barColor, borderRadius: '6px' }} />
                </div>
            </div>
        );
    }

    if (template === 'EvaraDeep') {
        const depth = snap.depth_value ?? 0;
        const pct = Math.min(100, (depth / 100) * 100);
        return (
            <div style={{ marginTop: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontSize: '10px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Depth</span>
                    <span style={{ fontSize: '13px', fontWeight: 800, color: '#1e293b' }}>{depth.toFixed(1)} m</span>
                </div>
                <div style={{ height: '6px', background: 'rgba(0,0,0,0.07)', borderRadius: '6px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: '#0ea5e9', borderRadius: '6px' }} />
                </div>
            </div>
        );
    }

    if (template === 'EvaraFlow') {
        const rate = snap.flow_rate ?? 0;
        const total = snap.total_liters ?? 0;
        return (
            <div style={{ marginTop: '10px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div style={{ background: 'rgba(6,182,212,0.08)', borderRadius: '10px', padding: '7px 9px' }}>
                    <div style={{ fontSize: '9px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '3px' }}>Flow Rate</div>
                    <div style={{ fontSize: '15px', fontWeight: 800, color: '#0891b2' }}>{rate.toFixed(2)}</div>
                    <div style={{ fontSize: '9px', color: '#94a3b8', fontWeight: 600 }}>mÂ³/hr</div>
                </div>
                <div style={{ background: 'rgba(6,182,212,0.08)', borderRadius: '10px', padding: '7px 9px' }}>
                    <div style={{ fontSize: '9px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '3px' }}>Total</div>
                    <div style={{ fontSize: '15px', fontWeight: 800, color: '#0891b2' }}>{total >= 1000 ? (total / 1000).toFixed(1) + 'k' : total.toFixed(0)}</div>
                    <div style={{ fontSize: '9px', color: '#94a3b8', fontWeight: 600 }}>liters</div>
                </div>
            </div>
        );
    }

    return null;
};

// â”€â”€â”€ Glassmorphism Hover Panel (portal) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const DeviceHoverPanel = ({ device, x, y, onNavigate }: {
    device: MapDevice; x: number; y: number; onNavigate: (r: string) => void;
}) => {
    const template = (device as any).analytics_template || device.asset_type || 'Sensor Node';
    const isOnline = device.status === 'Online';
    const route = getDeviceAnalyticsRoute({ id: device.id, analytics_template: (device as any).analytics_template, asset_type: device.asset_type ?? undefined });
    const accent = template === 'EvaraTank' ? '#4f46e5' : template === 'EvaraDeep' ? '#0ea5e9' : '#06b6d4';

    const panelW = 224;
    const panelH = 160; // conservative height so popup sits just above icon
    // Center horizontally over icon, appear above it (icon anchor is center, so icon top = y - 24)
    const cx = Math.min(Math.max(x - panelW / 2, 8), window.innerWidth - panelW - 8);
    const cy = Math.max(y - panelH - 24, 8);

    return createPortal(
        <div style={{
            position: 'fixed', left: cx, top: cy, width: panelW, zIndex: 9999,
            background: 'rgba(255,255,255,0.88)',
            backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(255,255,255,0.55)',
            borderRadius: '20px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.13),0 1px 4px rgba(0,0,0,0.06)',
            padding: '14px 16px',
            pointerEvents: 'none',
            animation: 'hoverFadeIn 0.18s ease-out',
        }}>
            <style>{`@keyframes hoverFadeIn{from{opacity:0;transform:translateY(4px) scale(0.97)}to{opacity:1;transform:translateY(0) scale(1)}}`}</style>
            <div style={{ position: 'absolute', top: 0, left: 16, right: 16, height: '2px', background: accent, borderRadius: '2px' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: '6px', marginBottom: '6px' }}>
                <div>
                    <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 800, color: '#1e293b', letterSpacing: '-0.01em', lineHeight: 1.2 }}>
                        {device.label || device.name || device.node_key || 'Unnamed'}
                    </h3>
                    <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#64748b', fontWeight: 600 }}>{template}</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: isOnline ? 'rgba(34,197,94,0.1)' : 'rgba(148,163,184,0.12)', borderRadius: '999px', padding: '3px 8px', flexShrink: 0 }}>
                    <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: isOnline ? '#22c55e' : '#94a3b8' }} />
                    <span style={{ fontSize: '9px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.06em', color: isOnline ? '#16a34a' : '#64748b' }}>{device.status}</span>
                </div>
            </div>
            <div style={{ height: '1px', background: 'rgba(0,0,0,0.06)', margin: '6px 0' }} />
            <MiniTelemetryViz device={device} />
            <div style={{ marginTop: '12px', pointerEvents: 'auto' }}>
                <button
                    onClick={() => onNavigate(route)}
                    style={{ width: '100%', padding: '7px 0', background: accent, color: '#fff', borderRadius: '10px', fontSize: '11px', fontWeight: 700, border: 'none', cursor: 'pointer', letterSpacing: '0.3px' }}
                >
                    View Details
                </button>
            </div>
        </div>,
        document.body
    );
};

// â”€â”€â”€ SharedMap â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const SharedMap = ({
    devices, pipelines,
    height = "400px", showZoom = true,
    className, activeFilter = null, activePipeline = null,
}: SharedMapProps) => {
    const [mapBounds, setMapBounds] = useState<L.LatLngBoundsExpression | null>(null);
    const [hoverPanel, setHoverPanel] = useState<HoverPanel | null>(null);
    const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const navigate = useNavigate();

    const filteredDevices = useMemo(
        () => activeFilter
            ? devices.filter(d => (d as any).analytics_template === activeFilter || d.asset_type === activeFilter)
            : devices,
        [devices, activeFilter]
    );

    const filteredPipelines = useMemo(
        () => activePipeline ? pipelines.filter(p => p.id === activePipeline) : pipelines,
        [pipelines, activePipeline]
    );

    // Pre-build icons keyed by template+status â€” avoids rebuilding per-marker per-render
    const iconMap = useMemo(() => {
        const m = new Map<string, L.DivIcon>();
        for (const d of filteredDevices) {
            const t = (d as any).analytics_template || d.asset_type || '';
            const k = `${t}__${d.status}`;
            if (!m.has(k)) m.set(k, buildBadgeIcon(t, d.status));
        }
        return m;
    }, [filteredDevices]);

    useEffect(() => {
        console.log('[SharedMap] Total devices:', devices.length, '| Filtered:', filteredDevices.length);
        const points = filteredDevices
            .filter(d => d.latitude && d.longitude)
            .map(d => [d.latitude!, d.longitude!] as L.LatLngExpression);
        console.log('[SharedMap] Devices with coordinates:', points.length);
        if (points.length > 0) setMapBounds(L.latLngBounds(points).pad(0.1));
    }, [devices.length, filteredDevices]);

    const cancelClose = useCallback(() => {
        if (closeTimer.current) { clearTimeout(closeTimer.current); closeTimer.current = null; }
    }, []);

    return (
        <>
            <div
                style={{ height }}
                className={twMerge(clsx("w-full rounded-[24px] overflow-hidden border border-white/20 shadow-inner z-[1]", className))}
            >
                <MapContainer
                    bounds={mapBounds || [[17.44, 78.34], [17.45, 78.35]]}
                    zoom={13}
                    style={{ height: '100%', width: '100%' }}
                    zoomControl={showZoom}
                    scrollWheelZoom={true}
                >
                    <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />

                    {filteredDevices.map((device) => {
                        if (!device.latitude || !device.longitude) return null;
                        const t = (device as any).analytics_template || device.asset_type || '';
                        const icon = iconMap.get(`${t}__${device.status}`) ?? buildBadgeIcon(t, device.status);
                        return (
                            <Marker
                                key={device.id}
                                position={[device.latitude, device.longitude]}
                                icon={icon}
                                eventHandlers={{
                                    mouseover: (e) => {
                                        if (closeTimer.current) clearTimeout(closeTimer.current);
                                        const marker = e.target as any;
                                        const map = marker._map;
                                        const cp = map.latLngToContainerPoint(marker.getLatLng());
                                        const rect = (map.getContainer() as HTMLElement).getBoundingClientRect();
                                        setHoverPanel({ device, x: rect.left + cp.x, y: rect.top + cp.y });
                                        closeTimer.current = setTimeout(() => setHoverPanel(null), 5000);
                                    },
                                    mouseout: () => {
                                        // Do NOT close immediately — let the 5s timer close it
                                    },
                                }}
                            />
                        );
                    })}

                    {filteredPipelines.map((pipeline) => (
                        <Polyline
                            key={pipeline.id}
                            positions={pipeline.positions as L.LatLngExpression[]}
                            pathOptions={{
                                color: pipeline.status === 'Active' ? '#3b82f6' : '#94a3b8',
                                weight: 3, opacity: 0.6,
                                dashArray: pipeline.status === 'Active' ? undefined : '10, 10',
                            }}
                        >
                            <Popup>
                                <div className="p-1">
                                    <h3 className="font-bold text-sm">{pipeline.name}</h3>
                                    <p className="text-xs text-gray-400">Status: {pipeline.status}</p>
                                </div>
                            </Popup>
                        </Polyline>
                    ))}
                </MapContainer>
            </div>

            {hoverPanel && (
                <DeviceHoverPanel
                    device={hoverPanel.device}
                    x={hoverPanel.x}
                    y={hoverPanel.y}
                    onNavigate={(route) => { cancelClose(); setHoverPanel(null); navigate(route); }}
                />
            )}
        </>
    );
};

export default SharedMap;
