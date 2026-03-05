/**
 * Shared Leaflet map icon factories.
 *
 * Used by Home.tsx (full-size) and Dashboard.tsx (mini).
 * Uses the exact custom SVG templates provided by the user.
 */
import L from 'leaflet';

// ── SVG templates ────────────────────────────────────────────────────────

const pumpSvg = () =>
    `<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" style="width: 100%; height: 100%; padding: 4px;">
        <path fill="#ffffff" d="M40 90 L100 35 L160 90 V170 Q160 180 150 180 H50 Q40 180 40 170 Z"/>
        <rect x="130" y="45" width="20" height="45" rx="5" fill="#ffffff"/>
        <path fill="none" stroke="#5e2a7b" stroke-width="10" stroke-linecap="round" stroke-linejoin="round" d="M50 95 L100 50 L150 95"/>
        <path fill="none" stroke="#5e2a7b" stroke-width="10" stroke-linecap="round" stroke-linejoin="round" d="M100 100 C80 130 80 145 80 155 C80 170 90 180 100 180 C110 180 120 155 C120 145 120 130 100 100 Z"/>
        <ellipse cx="100" cy="165" rx="40" ry="12" fill="none" stroke="#5e2a7b" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;

const sumpSvg = () =>
    `<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" style="width: 100%; height: 100%; padding: 4px;">
       <path d="M45 60 L70 150 H130 L155 60" fill="none" stroke="white" stroke-width="15" stroke-linejoin="round" stroke-linecap="round"/>
       <path d="M70 105 Q80 95 90 105 Q100 95 110 105 Q120 95 130 105 L130 150 H70 Z" fill="white"/>
    </svg>`;

const tankSvg = () =>
    `<svg viewBox="0 0 200 340" xmlns="http://www.w3.org/2000/svg" style="width: 100%; height: 100%; padding: 4px;">
        <polygon points="40,90 100,40 160,90" fill="#1f7fd4" stroke="white" stroke-width="8"/>
        <rect x="55" y="90" width="90" height="20" fill="#ffffff"/>
        <rect x="45" y="110" width="110" height="110" rx="10" fill="#ffffff" stroke="white" stroke-width="8"/>
        <path d="M100 135 C75 170 80 190 100 200 C120 190 125 170 100 135 Z" fill="none" stroke="#0b4f82" stroke-width="10"/>
        <rect x="35" y="220" width="130" height="20" fill="#ffffff"/>
        <line x1="55" y1="240" x2="30" y2="330" fill="none" stroke="#ffffff" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
        <line x1="145" y1="240" x2="170" y2="330" fill="none" stroke="#ffffff" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
        <line x1="30" y1="280" x2="170" y2="240" fill="none" stroke="#ffffff" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
        <line x1="30" y1="240" x2="170" y2="280" fill="none" stroke="#ffffff" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
        <line x1="50" y1="330" x2="150" y2="270" fill="none" stroke="#ffffff" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
        <line x1="50" y1="270" x2="150" y2="330" fill="none" stroke="#ffffff" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;

const boreSvg = (strokeWidth = 20) =>
    `<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" style="width: 100%; height: 100%; padding: 4px;">
      <path d="M40 40 H90 V160" fill="none" stroke="white" stroke-width="${strokeWidth}" stroke-linecap="round"/>
      <path d="M160 40 H110 V160" fill="none" stroke="white" stroke-width="${strokeWidth}" stroke-linecap="round"/>
      <path d="M100 20 V140" fill="none" stroke="white" stroke-width="${strokeWidth}" stroke-linecap="round"/>
      <circle cx="100" cy="145" r="${strokeWidth}" fill="white"/>
    </svg>`;

// ── Factory ─────────────────────────────────────────────────────────────

const createCustomIcon = (svgFn: () => string, bgColor: string, size = 30) => {
    return L.divIcon({
        className: 'custom-map-marker',
        html: `<div style="
            background-color: ${bgColor}; 
            width: ${size}px; 
            height: ${size}px; 
            display: flex; 
            align-items: center; 
            justify-content: center; 
            border: 2px solid white; 
            border-radius: 50%; 
            box-shadow: 0 3px 6px rgba(0,0,0,0.4); 
            transition: transform 0.2s;
        ">${svgFn()}</div>`,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
        popupAnchor: [0, -size / 2],
    });
};

/** Creates a per-device icon without a status dot. */
const createDynamicIcon = (svgFn: () => string, bgColor: string, size: number, _online: boolean) => {
    return L.divIcon({
        className: 'custom-map-marker',
        html: `<div style="
            position: relative;
            background-color: ${bgColor};
            width: ${size}px;
            height: ${size}px;
            display: flex;
            align-items: center;
            justify-content: center;
            border: 2px solid white;
            border-radius: 50%;
            box-shadow: 0 3px 6px rgba(0,0,0,0.4);
            transition: transform 0.2s;
        ">${svgFn()}</div>`,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
        popupAnchor: [0, -size / 2],
    });
};

// ── Pre-built icon sets ─────────────────────────────────────────────────
// Colors from user styles: 
// bg-pump: #5e2a7b
// bg-sump: #3E9A3E
// bg-tank: #0b4f82
// bg-bore: #E53935
// bg-govt: #000000
// grey/not-working: #8A8A8A

export const fullIcons = {
    pump: createCustomIcon(pumpSvg, '#5e2a7b', 34),
    sump: createCustomIcon(sumpSvg, '#3E9A3E', 34),
    tank: createCustomIcon(tankSvg, '#0b4f82', 34),
    bore: createCustomIcon(() => boreSvg(20), '#E53935', 34),
    govt: createCustomIcon(() => boreSvg(20), '#000000', 34),
    notWorking: createCustomIcon(() => boreSvg(15), '#8A8A8A', 34),
} as const;

export const miniIcons = {
    pump: createCustomIcon(pumpSvg, '#5e2a7b', 24),
    sump: createCustomIcon(sumpSvg, '#3E9A3E', 24),
    tank: createCustomIcon(tankSvg, '#0b4f82', 24),
    bore: createCustomIcon(() => boreSvg(20), '#E53935', 24),
    govt: createCustomIcon(() => boreSvg(20), '#000000', 24),
    notWorking: createCustomIcon(() => boreSvg(15), '#8A8A8A', 24),
} as const;

// ── Status helpers ──────────────────────────────────────────────────────
const ONLINE_STATUSES = ['Online', 'Working', 'Running', 'Normal', 'Flowing', 'Active'] as const;
const OFFLINE_STATUSES = ['Offline', 'Not Working', 'Alert', 'Critical', 'Maintenance'] as const;

export const isOnline = (status: string) =>
    (ONLINE_STATUSES as readonly string[]).includes(status);

export const isOffline = (status: string) =>
    (OFFLINE_STATUSES as readonly string[]).includes(status);

/** Pick the correct icon based on asset_type and status.
 *  Returns a dynamically-created icon with a green (online) or gray (offline) status dot.
 */
export const getDeviceIcon = (assetType: string | null, status: string, iconSet = fullIcons) => {
    const online = isOnline(status);
    const size = (iconSet as unknown) === (miniIcons as unknown) ? 24 : 34;
    switch (assetType) {
        case 'pump': return createDynamicIcon(pumpSvg, '#5e2a7b', size, online);
        case 'sump': return createDynamicIcon(sumpSvg, '#3E9A3E', size, online);
        case 'tank': return createDynamicIcon(tankSvg, '#0b4f82', size, online);
        case 'bore': return createDynamicIcon(() => boreSvg(20), '#E53935', size, online);
        case 'govt': return createDynamicIcon(() => boreSvg(20), '#000000', size, online);
        default:     return createDynamicIcon(sumpSvg, '#3E9A3E', size, online);
    }
};

/** Color string from asset_type (for inline styles, badges, etc.) */
export const getAssetColor = (assetType: string | null): string => {
    switch (assetType) {
        case 'pump': return '#9333ea';
        case 'sump': return '#16a34a';
        case 'tank': return '#2563eb';
        case 'bore': return '#eab308';
        case 'govt': return '#1e293b';
        default: return '#2563eb';
    }
};

/** Tailwind button bg class from asset_type */
export const getAssetButtonClass = (assetType: string | null): string => {
    switch (assetType) {
        case 'pump': return 'bg-purple-600 hover:bg-purple-700';
        case 'sump': return 'bg-green-600 hover:bg-green-700';
        case 'tank': return 'bg-blue-600 hover:bg-blue-700';
        case 'bore': return 'bg-yellow-600 hover:bg-yellow-700';
        case 'govt': return 'bg-slate-700 hover:bg-slate-800';
        default: return 'bg-blue-600 hover:bg-blue-700';
    }
};
