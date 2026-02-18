import { MapContainer, TileLayer, Marker, Popup, ZoomControl, Polyline } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { useState } from 'react';
import { Activity, LayoutDashboard, Layers } from 'lucide-react';
import clsx from 'clsx';
import { Link } from 'react-router-dom';
import L from 'leaflet';

// Fix for default marker icon in React-Leaflet
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

// Custom Purple Icon
const purpleIcon = L.divIcon({
    className: 'custom-purple-icon',
    html: `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="#9333ea" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-map-pin drop-shadow-md"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>`,
    iconSize: [40, 40],
    iconAnchor: [20, 40],
    popupAnchor: [0, -40]
});

// Custom Green Icon (for Sumps)
const sumpIcon = L.divIcon({
    className: 'custom-green-icon',
    html: `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="#16a34a" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-map-pin drop-shadow-md"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>`,
    iconSize: [40, 40],
    iconAnchor: [20, 40],
    popupAnchor: [0, -40]
});

// Custom Blue Icon (for OHTs)
const blueIcon = L.divIcon({
    className: 'custom-blue-icon',
    html: `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="#2563eb" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-map-pin drop-shadow-md"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>`,
    iconSize: [40, 40],
    iconAnchor: [20, 40],
    popupAnchor: [0, -40]
});

// Custom Yellow Icon (for Borewells)
const yellowIcon = L.divIcon({
    className: 'custom-yellow-icon',
    html: `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="#eab308" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-map-pin drop-shadow-md"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>`,
    iconSize: [40, 40],
    iconAnchor: [20, 40],
    popupAnchor: [0, -40]
});

// Custom Black Icon (for Govt Borewells)
const blackIcon = L.divIcon({
    className: 'custom-black-icon',
    html: `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="#1e293b" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-map-pin drop-shadow-md"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>`,
    iconSize: [40, 40],
    iconAnchor: [20, 40],
    popupAnchor: [0, -40]
});

// Custom Red Icon (for Non-Working Borewells)
const redIcon = L.divIcon({
    className: 'custom-red-icon',
    html: `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="#ef4444" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-map-pin drop-shadow-md"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>`,
    iconSize: [40, 40],
    iconAnchor: [20, 40],
    popupAnchor: [0, -40]
});

export const Home = () => {
    const [showIndex, setShowIndex] = useState(false);
    const [showStatusOverview, setShowStatusOverview] = useState(false);
    const [showSystemDashboard, setShowSystemDashboard] = useState(false);
    const [activeFilter, setActiveFilter] = useState<string | null>(null);
    const [activePipeline, setActivePipeline] = useState<string | null>(null);

    const handleFilterClick = (filter: string) => {
        setActiveFilter(prev => prev === filter ? null : filter);
    };

    const handlePipelineClick = (pipeline: string) => {
        setActivePipeline(prev => prev === pipeline ? null : pipeline);
    };

    // Pump House Data (Gachibowli Area)
    const pumpHouses = [
        {
            id: 'PH-01',
            name: 'Pump House 1',
            type: 'Primary Hub',
            location: 'ATM Gate',
            capacity: '4.98L L',
            status: 'Running',
            coordinates: [17.4456, 78.3516] as [number, number]
        },
        {
            id: 'PH-02',
            name: 'Pump House 2',
            type: 'Secondary',
            location: 'Guest House',
            capacity: '75k L',
            status: 'Running',
            coordinates: [17.44608, 78.34925] as [number, number]
        },
        {
            id: 'PH-03',
            name: 'Pump House 3',
            type: 'FSQ Node',
            location: 'Staff Qtrs',
            capacity: '55k L',
            status: 'Running',
            coordinates: [17.4430, 78.3487] as [number, number]
        },
        {
            id: 'PH-04',
            name: 'Pump House 4',
            type: 'Hostel Node',
            location: 'Bakul',
            capacity: '2.00L L',
            status: 'Running',
            coordinates: [17.4481, 78.3489] as [number, number]
        }
    ];

    // Sump Data
    const sumps = [
        { id: 'SUMP-S1', name: 'Sump S1', type: 'Hostel Sump', location: 'Bakul', capacity: '2.00L L', status: 'Normal', coordinates: [17.448097, 78.349060] as [number, number] },
        { id: 'SUMP-S2', name: 'Sump S2', type: 'Hostel Sump', location: 'Palash', capacity: '1.10L L', status: 'Normal', coordinates: [17.444919, 78.346195] as [number, number] },
        { id: 'SUMP-S3', name: 'Sump S3', type: 'Hostel Sump', location: 'NBH', capacity: '1.00L L', status: 'Normal', coordinates: [17.446779, 78.346996] as [number, number] },
        { id: 'SUMP-S4', name: 'Sump S4', type: 'Main Sump', location: 'Central', capacity: '4.98L L', status: 'Normal', coordinates: [17.445630, 78.351593] as [number, number] },
        { id: 'SUMP-S5', name: 'Sump S5', type: 'Block Sump', location: 'Blk A&B', capacity: '55k L', status: 'Normal', coordinates: [17.444766, 78.350087] as [number, number] },
        { id: 'SUMP-S6', name: 'Sump S6', type: 'Guest Sump', location: 'Guest House', capacity: '10k L', status: 'Normal', coordinates: [17.445498, 78.350202] as [number, number] },
        { id: 'SUMP-S7', name: 'Sump S7', type: 'Pump Sump', location: 'Pump House', capacity: '43k L', status: 'Normal', coordinates: [17.44597, 78.34906] as [number, number] },
        { id: 'SUMP-S8', name: 'Sump S8', type: 'Ground Sump', location: 'Football', capacity: '12k L', status: 'Normal', coordinates: [17.446683, 78.348995] as [number, number] },
        { id: 'SUMP-S9', name: 'Sump S9', type: 'Felicity Sump', location: 'Felicity', capacity: '15k L', status: 'Normal', coordinates: [17.446613, 78.346487] as [number, number] },
        { id: 'SUMP-S10', name: 'Sump S10', type: 'FSQ Sump', location: 'FSQ A&B', capacity: '34k+31k', status: 'Normal', coordinates: [17.443076, 78.348737] as [number, number] },
        { id: 'SUMP-S11', name: 'Sump S11', type: 'FSQ Sump', location: 'FSQ C,D,E', capacity: '1.5L+60k', status: 'Normal', coordinates: [17.444773, 78.347797] as [number, number] }
    ];

    // OHT Data
    const ohts = [
        { id: 'OHT-1', name: 'Bakul OHT', type: 'OHT Pair', location: 'Bakul', capacity: '2 Units', status: 'Normal', coordinates: [17.448045, 78.348438] as [number, number] },
        { id: 'OHT-2', name: 'Parijat OHT', type: 'OHT Pair', location: 'Parijat', capacity: '2 Units', status: 'Normal', coordinates: [17.447547, 78.347752] as [number, number] },
        { id: 'OHT-3', name: 'Kadamba OHT', type: 'OHT Pair', location: 'Kadamba', capacity: '2 Units', status: 'Normal', coordinates: [17.446907, 78.347178] as [number, number] },
        { id: 'OHT-4', name: 'NWH Block C OHT', type: 'OHT', location: 'NWH Block C', capacity: '1 Unit', status: 'Normal', coordinates: [17.447675, 78.347430] as [number, number] },
        { id: 'OHT-5', name: 'NWH Block B OHT', type: 'OHT', location: 'NWH Block B', capacity: '1 Unit', status: 'Normal', coordinates: [17.447391, 78.347172] as [number, number] },
        { id: 'OHT-6', name: 'NWH Block A OHT', type: 'OHT', location: 'NWH Block A', capacity: '1 Unit', status: 'Normal', coordinates: [17.447081, 78.346884] as [number, number] },
        { id: 'OHT-7', name: 'Palash Nivas OHT 7', type: 'OHT Cluster', location: 'Palash Nivas', capacity: '4 Units', status: 'Normal', coordinates: [17.445096, 78.345966] as [number, number] },
        { id: 'OHT-8', name: 'Anand Nivas OHT 8', type: 'OHT Pair', location: 'Anand Nivas', capacity: '2 Units', status: 'Normal', coordinates: [17.443976, 78.348432] as [number, number] },
        { id: 'OHT-9', name: 'Budha Nivas OHT 9', type: 'OHT Pair', location: 'Budha Nivas', capacity: '2 Units', status: 'Normal', coordinates: [17.443396, 78.348500] as [number, number] },
        { id: 'OHT-10', name: 'C Block OHT 10', type: 'OHT Cluster', location: 'C Block', capacity: '3 Units', status: 'Normal', coordinates: [17.443387, 78.347834] as [number, number] },
        { id: 'OHT-11', name: 'D Block OHT 11', type: 'OHT Cluster', location: 'D Block', capacity: '3 Units', status: 'Normal', coordinates: [17.443914, 78.347773] as [number, number] },
        { id: 'OHT-12', name: 'E Block OHT 12', type: 'OHT Cluster', location: 'E Block', capacity: '3 Units', status: 'Normal', coordinates: [17.444391, 78.347958] as [number, number] },
        { id: 'OHT-13', name: 'Vindhya OHT', type: 'OHT Cluster', location: 'Vindhya', capacity: 'Mixed', status: 'Normal', coordinates: [17.44568, 78.34973] as [number, number] },
        { id: 'OHT-14', name: 'Himalaya OHT (KRB)', type: 'OHT', location: 'Himalaya', capacity: 'Borewell', status: 'Normal', coordinates: [17.44525, 78.34966] as [number, number] }
    ];

    // Borewell Data
    const borewells = [
        { id: 'BW-P1', name: 'Borewell P1', type: 'IIIT Bore', location: 'Block C,D,E', capacity: '5 HP', status: 'Not Working', coordinates: [17.443394, 78.348117] as [number, number] },
        { id: 'BW-P2', name: 'Borewell P2', type: 'IIIT Bore', location: 'Agri Farm', capacity: '12.5 HP', status: 'Not Working', coordinates: [17.443093, 78.348936] as [number, number] },
        { id: 'BW-P3', name: 'Borewell P3', type: 'IIIT Bore', location: 'Palash', capacity: '5 HP', status: 'Not Working', coordinates: [17.444678, 78.347234] as [number, number] },
        { id: 'BW-P4', name: 'Borewell P4', type: 'IIIT Bore', location: 'Vindhya', capacity: '--', status: 'Not Working', coordinates: [17.446649, 78.350578] as [number, number] },
        { id: 'BW-P5', name: 'Borewell P5', type: 'IIIT Bore', location: 'Nilgiri', capacity: '5 HP', status: 'Working', coordinates: [17.447783, 78.349040] as [number, number] },
        { id: 'BW-P6', name: 'Borewell P6', type: 'IIIT Bore', location: 'Bakul', capacity: '5/7.5 HP', status: 'Not Working', coordinates: [17.448335, 78.348594] as [number, number] },
        { id: 'BW-P7', name: 'Borewell P7', type: 'IIIT Bore', location: 'Volleyball', capacity: 'N/A', status: 'Not Working', coordinates: [17.445847, 78.346416] as [number, number] },
        { id: 'BW-P8', name: 'Borewell P8', type: 'IIIT Bore', location: 'Palash', capacity: '7.5 HP', status: 'Working', coordinates: [17.445139, 78.345277] as [number, number] },
        { id: 'BW-P9', name: 'Borewell P9', type: 'IIIT Bore', location: 'Girls Blk A', capacity: '7.5 HP', status: 'Working', coordinates: [17.446922, 78.346699] as [number, number] },
        { id: 'BW-P10', name: 'Borewell P10', type: 'IIIT Bore', location: 'Parking NW', capacity: '5 HP', status: 'Working', coordinates: [17.443947, 78.350139] as [number, number] },
        { id: 'BW-P10A', name: 'Borewell P10A', type: 'IIIT Bore', location: 'Agri Farm', capacity: '--', status: 'Not Working', coordinates: [17.443451, 78.349635] as [number, number] },
        { id: 'BW-P11', name: 'Borewell P11', type: 'IIIT Bore', location: 'Blk C,D,E', capacity: '5 HP', status: 'Not Working', coordinates: [17.444431, 78.347649] as [number, number] }
    ];

    // Govt Borewell Data
    const govtBorewells = [
        { id: 'BW-G1', name: 'Borewell 1', type: 'Govt Bore', location: 'Palash', capacity: '5 HP', status: 'Not Working', coordinates: [17.444601, 78.345459] as [number, number] },
        { id: 'BW-G2', name: 'Borewell 2', type: 'Govt Bore', location: 'Palash', capacity: '1.5 HP', status: 'Not Working', coordinates: [17.445490, 78.346838] as [number, number] },
        { id: 'BW-G3', name: 'Borewell 3', type: 'Govt Bore', location: 'Vindhaya C4', capacity: '5 HP', status: 'Working', coordinates: [17.446188, 78.350067] as [number, number] },
        { id: 'BW-G4', name: 'Borewell 4', type: 'Govt Bore', location: 'Entrance', capacity: 'N/A', status: 'Not Working', coordinates: [17.447111, 78.350151] as [number, number] },
        { id: 'BW-G5', name: 'Borewell 5', type: 'Govt Bore', location: 'Entrance', capacity: 'N/A', status: 'Not Working', coordinates: [17.446311, 78.351042] as [number, number] },
        { id: 'BW-G6', name: 'Borewell 6', type: 'Govt Bore', location: 'Bamboo House', capacity: 'N/A', status: 'Not Working', coordinates: [17.445584, 78.347148] as [number, number] },
        { id: 'BW-G7', name: 'Borewell 7', type: 'Govt Bore', location: 'Football', capacity: 'N/A', status: 'Not Working', coordinates: [17.446115, 78.348536] as [number, number] }
    ];

    // Combine for Index
    // Link all arrays if needed for search later, but currently unused in render
    // const allNodes = [...pumpHouses, ...sumps, ...ohts, ...borewells, ...govtBorewells];

    // Pipeline Data (GeoJSON Features)
    const pipelineFeatures = [
        { type: "Feature", properties: { name: "PH2 - OBH/PALASH", type: "Water Supply", color: "#00b4d8" }, geometry: { type: "LineString", coordinates: [[17.446057476630784, 78.3492569095647], [17.445482194972044, 78.34825099866276], [17.44630656687505, 78.34720892666434], [17.445050104381707, 78.34598638379146]] } },
        { type: "Feature", properties: { name: "PH2 - KADAMBA/NBH", type: "Water Supply", color: "#00b4d8" }, geometry: { type: "LineString", coordinates: [[17.4468858335199, 78.34717428867077], [17.446583646976833, 78.34687317239377], [17.446302774851645, 78.34721168790577]] } },
        { type: "Feature", properties: { name: "PH2 - HIMALAYA", type: "Water Supply", color: "#00b4d8" }, geometry: { type: "LineString", coordinates: [[17.44605617669069, 78.34925379742043], [17.445883817839018, 78.34908273787016], [17.44532883606179, 78.34973473021046], [17.44524815714857, 78.3496616935484]] } },
        { type: "Feature", properties: { name: "PH2 - VINDYA", type: "Water Supply", color: "#00b4d8" }, geometry: { type: "LineString", coordinates: [[17.446050296030123, 78.349258777606], [17.44566149363318, 78.34973190965451]] } },
        { type: "Feature", properties: { name: "PH2 - PARIJAT/NGH", type: "Water Supply", color: "#00b4d8" }, geometry: { type: "LineString", coordinates: [[17.446051955076115, 78.34924741075247], [17.447117930045437, 78.34798068042636], [17.447270012848705, 78.34812314046127], [17.447551631476756, 78.34779469227817]] } },
        { type: "Feature", properties: { name: "PH1 - PH3", type: "Water Supply", color: "#00b4d8" }, geometry: { type: "LineString", coordinates: [[17.445565496370946, 78.35156809621168], [17.445402935739253, 78.3510818505751], [17.44297366973413, 78.34871393327182]] } },
        { type: "Feature", properties: { name: "PH3 - BLOCK B", type: "Water Supply", color: "#00b4d8" }, geometry: { type: "LineString", coordinates: [[17.443007256799305, 78.3486649229556], [17.443140183708365, 78.34880425711145], [17.443396542473252, 78.34848826715137]] } },
        { type: "Feature", properties: { name: "PH3 - BLOCK A", type: "Water Supply", color: "#00b4d8" }, geometry: { type: "LineString", coordinates: [[17.443985216799305, 78.3484335287335], [17.44341553199783, 78.34908292542195], [17.443140183708365, 78.34880425711145]] } },
        { type: "Feature", properties: { name: "PH1 - PH4", type: "Water Supply", color: "#00b4d8" }, geometry: { type: "LineString", coordinates: [[17.44557532910399, 78.35159848364157], [17.44576982116662, 78.35095289614935], [17.447747056552885, 78.34859125482501], [17.448093307337402, 78.34890811607835]] } },
        { type: "Feature", properties: { name: "PH4 - BAKUL OHT", type: "Water Supply", color: "#00b4d8" }, geometry: { type: "LineString", coordinates: [[17.4481030150547, 78.34889099161575], [17.44782419439771, 78.34863663284784], [17.448006849815854, 78.34842828429481]] } },
        { type: "Feature", properties: { name: "PH4 - NWH Block C", type: "Water Supply", color: "#00b4d8" }, geometry: { type: "LineString", coordinates: [[17.447827892848082, 78.34863200557686], [17.44714473747763, 78.34798863298869], [17.44761440706972, 78.34746274583108]] } },
        { type: "Feature", properties: { name: "PH4 - NWH Block B", type: "Water Supply", color: "#00b4d8" }, geometry: { type: "LineString", coordinates: [[17.44714716987866, 78.34798944843249], [17.446898400205413, 78.34775073198728], [17.447350593243257, 78.3472021023727]] } },
        { type: "Feature", properties: { name: "PH4 - NWH Block A", type: "Water Supply", color: "#00b4d8" }, geometry: { type: "LineString", coordinates: [[17.44689799488779, 78.34774710095786], [17.44658242120913, 78.34744051382114], [17.44704423616315, 78.346897993527019]] } },
        { type: "Feature", properties: { name: "PH1 - PH2", type: "Water Supply", color: "#00b4d8" }, geometry: { type: "LineString", coordinates: [[17.44607018219577, 78.34925227266547], [17.446702074561657, 78.34983216194138]] } },

        // Borewell Pipelines (Navy Blue)
        { type: "Feature", properties: { name: "PIPE-P5-S1", type: "Borewell Water", color: "#000080" }, geometry: { type: "LineString", coordinates: [[17.447797, 78.349013], [17.448091, 78.349042]] } },
        { type: "Feature", properties: { name: "PIPE-P5-S7", type: "Borewell Water", color: "#000080" }, geometry: { type: "LineString", coordinates: [[17.447780, 78.349018], [17.446921, 78.349951], [17.445962, 78.349090]] } },
        { type: "Feature", properties: { name: "PIPE-P8-S2", type: "Borewell Water", color: "#000080" }, geometry: { type: "LineString", coordinates: [[17.445120, 78.345291], [17.444911, 78.346206]] } },
        { type: "Feature", properties: { name: "PIPE-P9-S3", type: "Borewell Water", color: "#000080" }, geometry: { type: "LineString", coordinates: [[17.446868, 78.346714], [17.446715, 78.346915], [17.446715, 78.346984]] } },
        { type: "Feature", properties: { name: "PIPE-P10-S5", type: "Borewell Water", color: "#000080" }, geometry: { type: "LineString", coordinates: [[17.443927, 78.350157], [17.444322, 78.349693], [17.444701, 78.350068]] } }
    ];

    // Center Map on PH-01
    const position: [number, number] = [17.4456, 78.3490];

    return (
        <div className="relative w-full h-[calc(100vh-64px)] flex flex-col">
            {/* Map Container */}
            <div className="flex-1 relative z-0">
                <MapContainer
                    center={position}
                    zoom={17} // Zoomed in to see pipelines better
                    scrollWheelZoom={true}
                    zoomControl={false}
                    className="w-full h-full"
                >
                    <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />

                    {/* Pipelines */}
                    {pipelineFeatures.filter(pipe => {
                        if (activePipeline === null) return false;
                        if (activePipeline === 'watersupply') return pipe.properties.type === 'Water Supply';
                        if (activePipeline === 'borewellwater') return pipe.properties.type === 'Borewell Water';
                        return false;
                    }).map((pipe, idx) => (
                        <Polyline
                            key={idx}
                            positions={pipe.geometry.coordinates as [number, number][]}
                            pathOptions={{ color: pipe.properties.color, weight: 4, opacity: 0.8 }}
                        >
                            <Popup>
                                <div className="p-2">
                                    <h3 className="font-bold text-slate-800">{pipe.properties.name}</h3>
                                    <p className="text-xs text-slate-500">{pipe.properties.type}</p>
                                </div>
                            </Popup>
                        </Polyline>
                    ))}
                    {/* Pump House Markers (Purple Pins) */}
                    {(activeFilter === null || activeFilter === 'pumphouse') && pumpHouses.map((ph) => (
                        <Marker key={ph.id} position={ph.coordinates} icon={purpleIcon}>
                            <Popup>
                                <div className="p-2 min-w-[150px]">
                                    <h3 className="font-bold text-slate-800 text-sm mb-1">{ph.name}</h3>
                                    <div className="mb-3">
                                        <span className="text-[10px] font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full inline-block">
                                            {ph.status}
                                        </span>
                                    </div>
                                    <Link
                                        to={`/node/${ph.id}`}
                                        className="block w-full text-center bg-blue-600 !text-white text-xs font-semibold py-1.5 rounded-lg hover:bg-blue-700 transition-colors"
                                        style={{ color: 'white' }}
                                    >
                                        View Details
                                    </Link>
                                </div>
                            </Popup>
                        </Marker>
                    ))}

                    {/* Sumps Markers (Green Pins) */}
                    {(activeFilter === null || activeFilter === 'sump') && sumps.map((sump) => (
                        <Marker key={sump.id} position={sump.coordinates} icon={sumpIcon}>
                            <Popup>
                                <div className="p-2 min-w-[150px]">
                                    <h3 className="font-bold text-slate-800 text-sm mb-1">{sump.name}</h3>
                                    <div className="mb-3">
                                        <span className="text-[10px] font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full inline-block">
                                            {sump.status}
                                        </span>
                                    </div>
                                    <Link
                                        to={`/node/${sump.id}`}
                                        className="block w-full text-center bg-blue-600 !text-white text-xs font-semibold py-1.5 rounded-lg hover:bg-blue-700 transition-colors"
                                        style={{ color: 'white' }}
                                    >
                                        View Details
                                    </Link>
                                </div>
                            </Popup>
                        </Marker>
                    ))}

                    {/* OHT Markers (Blue Pins) */}
                    {(activeFilter === null || activeFilter === 'oht') && ohts.map((oht) => (
                        <Marker key={oht.id} position={oht.coordinates} icon={blueIcon}>
                            <Popup>
                                <div className="p-2 min-w-[150px]">
                                    <h3 className="font-bold text-slate-800 text-sm mb-1">{oht.name}</h3>
                                    <div className="mb-3">
                                        <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full inline-block">
                                            {oht.status}
                                        </span>
                                    </div>
                                    <Link
                                        to={`/node/${oht.id}`}
                                        className="block w-full text-center bg-blue-600 !text-white text-xs font-semibold py-1.5 rounded-lg hover:bg-blue-700 transition-colors"
                                        style={{ color: 'white' }}
                                    >
                                        View Details
                                    </Link>
                                </div>
                            </Popup>
                        </Marker>
                    ))}

                    {/* Borewell Markers (Yellow Pins) */}
                    {(activeFilter === null || activeFilter === 'borewell' || activeFilter === 'nonworking') && borewells.filter(bw => {
                        if (activeFilter === 'nonworking') return bw.status === 'Not Working';
                        if (activeFilter === 'borewell') return true;
                        return true;
                    }).map((bw) => (
                        <Marker key={bw.id} position={bw.coordinates} icon={bw.status === 'Not Working' ? redIcon : yellowIcon}>
                            <Popup>
                                <div className="p-2 min-w-[150px]">
                                    <h3 className="font-bold text-slate-800 text-sm mb-1">{bw.name}</h3>
                                    <div className="mb-3">
                                        <span className={clsx(
                                            "text-[10px] font-bold px-2 py-0.5 rounded-full inline-block",
                                            bw.status === 'Working' ? "text-green-600 bg-green-50" : "text-red-600 bg-red-50"
                                        )}>
                                            {bw.status}
                                        </span>
                                    </div>
                                    <Link
                                        to={`/node/${bw.id}`}
                                        className="block w-full text-center bg-blue-600 !text-white text-xs font-semibold py-1.5 rounded-lg hover:bg-blue-700 transition-colors"
                                        style={{ color: 'white' }}
                                    >
                                        View Details
                                    </Link>
                                </div>
                            </Popup>
                        </Marker>
                    ))}

                    {/* Govt Borewell Markers (Black Pins) */}
                    {(activeFilter === null || activeFilter === 'govtborewell' || activeFilter === 'nonworking') && govtBorewells.filter(bw => {
                        if (activeFilter === 'nonworking') return bw.status === 'Not Working';
                        if (activeFilter === 'govtborewell') return true;
                        return true;
                    }).map((bw) => (
                        <Marker key={bw.id} position={bw.coordinates} icon={bw.status === 'Not Working' ? redIcon : blackIcon}>
                            <Popup>
                                <div className="p-2 min-w-[150px]">
                                    <h3 className="font-bold text-slate-800 text-sm mb-1">{bw.name}</h3>
                                    <div className="mb-3">
                                        <span className={clsx(
                                            "text-[10px] font-bold px-2 py-0.5 rounded-full inline-block",
                                            bw.status === 'Working' ? "text-green-600 bg-green-50" : "text-red-600 bg-red-50"
                                        )}>
                                            {bw.status}
                                        </span>
                                    </div>
                                    <Link
                                        to={`/node/${bw.id}`}
                                        className="block w-full text-center bg-blue-600 !text-white text-xs font-semibold py-1.5 rounded-lg hover:bg-blue-700 transition-colors"
                                        style={{ color: 'white' }}
                                    >
                                        View Details
                                    </Link>
                                </div>
                            </Popup>
                        </Marker>
                    ))}

                    {/* Custom Zoom Control Position */}
                    < ZoomControl position="bottomright" />
                </MapContainer>

                {/* Overlay Buttons */}
                <div className="absolute top-4 right-4 flex flex-col gap-3 z-[400]">
                    <button onClick={() => { setShowStatusOverview(!showStatusOverview); setShowSystemDashboard(false); }} className={clsx("bg-white/90 backdrop-blur-md p-3 rounded-xl shadow-lg border border-slate-200 hover:bg-white transition-all group flex items-center gap-3", showStatusOverview && "ring-2 ring-blue-400")}>
                        <div className={clsx("w-10 h-10 rounded-full flex items-center justify-center transition-colors", showStatusOverview ? "bg-[var(--color-evara-blue)] text-white" : "bg-blue-50 text-[var(--color-evara-blue)] group-hover:bg-[var(--color-evara-blue)] group-hover:text-white")}>
                            <Activity size={20} />
                        </div>
                        <span className="font-semibold text-slate-700 pr-2">Status Overview</span>
                    </button>

                    <button onClick={() => { setShowSystemDashboard(!showSystemDashboard); setShowStatusOverview(false); }} className={clsx("bg-white/90 backdrop-blur-md p-3 rounded-xl shadow-lg border border-slate-200 hover:bg-white transition-all group flex items-center gap-3", showSystemDashboard && "ring-2 ring-green-400")}>
                        <div className={clsx("w-10 h-10 rounded-full flex items-center justify-center transition-colors", showSystemDashboard ? "bg-[var(--color-evara-green)] text-white" : "bg-green-50 text-[var(--color-evara-green)] group-hover:bg-[var(--color-evara-green)] group-hover:text-white")}>
                            <LayoutDashboard size={20} />
                        </div>
                        <span className="font-semibold text-slate-700 pr-2">System Dashboard</span>
                    </button>
                </div>

                {/* Status Overview Panel */}
                <div className={clsx(
                    "absolute top-28 right-4 z-[400] bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-slate-200 w-80 transition-all duration-300 origin-top-right overflow-hidden",
                    showStatusOverview ? "opacity-100 scale-100 max-h-[600px]" : "opacity-0 scale-95 max-h-0 pointer-events-none"
                )}>
                    <div className="p-5">
                        <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
                            <Activity size={16} className="text-[var(--color-evara-blue)]" /> Infrastructure Status
                        </h3>

                        {/* Summary Stats */}
                        <div className="grid grid-cols-3 gap-2 mb-4">
                            <div className="bg-green-50 rounded-lg p-2.5 text-center">
                                <div className="text-lg font-extrabold text-green-600">{pumpHouses.length + sumps.length + ohts.length + borewells.filter(b => b.status === 'Working').length + govtBorewells.filter(b => b.status === 'Working').length}</div>
                                <div className="text-[10px] font-semibold text-green-700">Online</div>
                            </div>
                            <div className="bg-red-50 rounded-lg p-2.5 text-center">
                                <div className="text-lg font-extrabold text-red-600">{borewells.filter(b => b.status === 'Not Working').length + govtBorewells.filter(b => b.status === 'Not Working').length}</div>
                                <div className="text-[10px] font-semibold text-red-700">Offline</div>
                            </div>
                            <div className="bg-blue-50 rounded-lg p-2.5 text-center">
                                <div className="text-lg font-extrabold text-blue-600">{pumpHouses.length + sumps.length + ohts.length + borewells.length + govtBorewells.length}</div>
                                <div className="text-[10px] font-semibold text-blue-700">Total</div>
                            </div>
                        </div>

                        {/* Asset Breakdown */}
                        <div className="space-y-3">
                            {[
                                { name: 'Pump Houses', total: pumpHouses.length, working: pumpHouses.filter(p => p.status === 'Running').length, color: '#9333ea', bg: 'bg-purple-50' },
                                { name: 'Sumps', total: sumps.length, working: sumps.filter(s => s.status === 'Normal').length, color: '#16a34a', bg: 'bg-green-50' },
                                { name: 'Overhead Tanks', total: ohts.length, working: ohts.filter(o => o.status === 'Normal').length, color: '#2563eb', bg: 'bg-blue-50' },
                                { name: 'Borewells (IIIT)', total: borewells.length, working: borewells.filter(b => b.status === 'Working').length, color: '#eab308', bg: 'bg-yellow-50' },
                                { name: 'Borewells (Govt)', total: govtBorewells.length, working: govtBorewells.filter(b => b.status === 'Working').length, color: '#1e293b', bg: 'bg-slate-50' },
                            ].map((asset, i) => (
                                <div key={i} className={clsx("rounded-xl p-3", asset.bg)}>
                                    <div className="flex justify-between items-center mb-1.5">
                                        <span className="text-xs font-bold text-slate-700">{asset.name}</span>
                                        <span className="text-xs font-bold" style={{ color: asset.color }}>{asset.working}/{asset.total}</span>
                                    </div>
                                    <div className="w-full h-2 bg-white rounded-full overflow-hidden">
                                        <div className="h-full rounded-full transition-all" style={{ width: `${asset.total > 0 ? (asset.working / asset.total) * 100 : 0}%`, background: asset.color }}></div>
                                    </div>
                                    <div className="flex justify-between mt-1">
                                        <span className="text-[10px] text-green-600 font-semibold">{asset.working} active</span>
                                        <span className="text-[10px] text-red-500 font-semibold">{asset.total - asset.working} down</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* System Dashboard Panel */}
                <div className={clsx(
                    "absolute top-28 right-4 z-[400] bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl border border-slate-200 w-80 transition-all duration-300 origin-top-right overflow-hidden",
                    showSystemDashboard ? "opacity-100 scale-100 max-h-[700px]" : "opacity-0 scale-95 max-h-0 pointer-events-none"
                )}>
                    <div className="p-5">
                        <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
                            <LayoutDashboard size={16} className="text-[var(--color-evara-green)]" /> System Dashboard
                        </h3>

                        {/* Water Consumption */}
                        <div className="bg-gradient-to-r from-blue-50 to-cyan-50 rounded-xl p-3 mb-3">
                            <div className="text-[10px] font-bold text-slate-500 uppercase mb-1">Today's Water Consumption</div>
                            <div className="text-2xl font-extrabold text-blue-700">48,250 <span className="text-sm font-bold text-slate-400">Litres</span></div>
                            <div className="text-[10px] text-green-600 font-semibold mt-0.5">&#9650; 5.2% vs yesterday</div>
                        </div>

                        {/* System Health Metrics */}
                        <div className="grid grid-cols-2 gap-2 mb-3">
                            <div className="bg-green-50 rounded-lg p-2.5">
                                <div className="text-[10px] font-bold text-slate-500">Uptime</div>
                                <div className="text-lg font-extrabold text-green-600">99.8%</div>
                            </div>
                            <div className="bg-orange-50 rounded-lg p-2.5">
                                <div className="text-[10px] font-bold text-slate-500">Avg Pressure</div>
                                <div className="text-lg font-extrabold text-orange-600">3.2 <span className="text-[10px]">bar</span></div>
                            </div>
                            <div className="bg-purple-50 rounded-lg p-2.5">
                                <div className="text-[10px] font-bold text-slate-500">Flow Rate</div>
                                <div className="text-lg font-extrabold text-purple-600">145 <span className="text-[10px]">L/min</span></div>
                            </div>
                            <div className="bg-cyan-50 rounded-lg p-2.5">
                                <div className="text-[10px] font-bold text-slate-500">Water Quality</div>
                                <div className="text-lg font-extrabold text-cyan-600">Good</div>
                            </div>
                        </div>

                        {/* Pipeline Network */}
                        <div className="bg-slate-50 rounded-xl p-3 mb-3">
                            <div className="text-[10px] font-bold text-slate-500 uppercase mb-2">Pipeline Network</div>
                            <div className="flex justify-between items-center mb-1">
                                <span className="text-xs text-slate-600">Water Supply Lines</span>
                                <span className="text-xs font-bold text-cyan-600">{pipelineFeatures.filter(p => p.properties.type === 'Water Supply').length} active</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-xs text-slate-600">Borewell Lines</span>
                                <span className="text-xs font-bold text-indigo-600">{pipelineFeatures.filter(p => p.properties.type === 'Borewell Water').length} active</span>
                            </div>
                        </div>

                        {/* Recent Activity */}
                        <div className="bg-slate-50 rounded-xl p-3">
                            <div className="text-[10px] font-bold text-slate-500 uppercase mb-2">Recent Activity</div>
                            <div className="space-y-2">
                                {[
                                    { text: 'PH-01 pump cycle completed', time: '2 min ago', dotColor: 'bg-green-500' },
                                    { text: 'BW-P5 borewell refill started', time: '8 min ago', dotColor: 'bg-blue-500' },
                                    { text: 'OHT-3 level reached 95%', time: '15 min ago', dotColor: 'bg-purple-500' },
                                    { text: 'SUMP-S4 maintenance alert', time: '32 min ago', dotColor: 'bg-orange-500' },
                                ].map((item, i) => (
                                    <div key={i} className="flex items-start gap-2">
                                        <div className={clsx("w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0", item.dotColor)}></div>
                                        <div>
                                            <div className="text-[11px] font-semibold text-slate-700">{item.text}</div>
                                            <div className="text-[10px] text-slate-400">{item.time}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Index Corner Panel (Assets & Nodes) */}
            <div className="absolute bottom-6 left-6 z-[1000] flex flex-col items-start pointer-events-none">
                {/* Toggle Button */}
                <button
                    onClick={() => setShowIndex(!showIndex)}
                    className="bg-white p-3 rounded-full shadow-lg border border-slate-200 text-slate-500 hover:text-[var(--color-evara-blue)] mb-2 pointer-events-auto transition-colors hover:shadow-xl"
                    title={showIndex ? "Hide Index" : "Show Index"}
                >
                    <Layers size={20} />
                </button>

                {/* Index Card */}
                <div className={clsx(
                    "bg-white rounded-2xl shadow-2xl border border-slate-200 w-64 flex flex-col transition-all duration-300 origin-bottom-left overflow-hidden pointer-events-auto",
                    showIndex ? "opacity-100 scale-100 max-h-[500px]" : "opacity-0 scale-95 max-h-0"
                )}>
                    <div className="p-4">
                        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 cursor-pointer hover:text-[var(--color-evara-blue)] transition-colors" onClick={() => setActiveFilter(null)}>ASSETS</h2>
                        <div className="space-y-3">
                            {/* Pump House */}
                            <div className={clsx("flex items-center gap-3 cursor-pointer rounded-lg px-2 py-1 transition-all", activeFilter === 'pumphouse' ? 'bg-purple-100 ring-2 ring-purple-400' : 'hover:bg-slate-50')} onClick={() => handleFilterClick('pumphouse')}>
                                <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 shadow-sm">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="#9333ea" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-map-pin"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></svg>
                                </div>
                                <span className="text-sm font-semibold text-slate-700">Pump House</span>
                            </div>

                            {/* Sump */}
                            <div className={clsx("flex items-center gap-3 cursor-pointer rounded-lg px-2 py-1 transition-all", activeFilter === 'sump' ? 'bg-green-100 ring-2 ring-green-400' : 'hover:bg-slate-50')} onClick={() => handleFilterClick('sump')}>
                                <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center text-green-600 shadow-sm">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="#16a34a" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-map-pin"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></svg>
                                </div>
                                <span className="text-sm font-semibold text-slate-700">Sump</span>
                            </div>

                            {/* Overhead Tank */}
                            <div className={clsx("flex items-center gap-3 cursor-pointer rounded-lg px-2 py-1 transition-all", activeFilter === 'oht' ? 'bg-blue-100 ring-2 ring-blue-400' : 'hover:bg-slate-50')} onClick={() => handleFilterClick('oht')}>
                                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 shadow-sm">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="#2563eb" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-map-pin"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></svg>
                                </div>
                                <span className="text-sm font-semibold text-slate-700">Overhead Tank</span>
                            </div>

                            {/* Borewell (IIIT) */}
                            <div className={clsx("flex items-center gap-3 cursor-pointer rounded-lg px-2 py-1 transition-all", activeFilter === 'borewell' ? 'bg-yellow-100 ring-2 ring-yellow-400' : 'hover:bg-slate-50')} onClick={() => handleFilterClick('borewell')}>
                                <div className="w-8 h-8 rounded-full bg-yellow-100 flex items-center justify-center text-yellow-600 shadow-sm">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="#eab308" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-map-pin"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></svg>
                                </div>
                                <span className="text-sm font-semibold text-slate-700">Borewell (IIIT)</span>
                            </div>

                            {/* Borewell (Govt) */}
                            <div className={clsx("flex items-center gap-3 cursor-pointer rounded-lg px-2 py-1 transition-all", activeFilter === 'govtborewell' ? 'bg-slate-200 ring-2 ring-slate-400' : 'hover:bg-slate-50')} onClick={() => handleFilterClick('govtborewell')}>
                                <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-700 shadow-sm">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="#1e293b" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-map-pin"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></svg>
                                </div>
                                <span className="text-sm font-semibold text-slate-700">Borewell (Govt)</span>
                            </div>

                            {/* Non-Working */}
                            <div className={clsx("flex items-center gap-3 cursor-pointer rounded-lg px-2 py-1 transition-all", activeFilter === 'nonworking' ? 'bg-red-100 ring-2 ring-red-400' : 'hover:bg-slate-50')} onClick={() => handleFilterClick('nonworking')}>
                                <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center text-red-600 shadow-sm">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="#ef4444" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-map-pin"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></svg>
                                </div>
                                <span className="text-sm font-semibold text-slate-700">Non-Working</span>
                            </div>
                        </div>

                        <div className="my-2 border-t border-slate-100"></div>

                        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">PIPELINES</h2>

                        {/* Water Supply */}
                        <div className={clsx("flex items-center gap-3 cursor-pointer rounded-lg px-2 py-1 transition-all", activePipeline === 'watersupply' ? 'bg-cyan-100 ring-2 ring-cyan-400' : 'hover:bg-slate-50')} onClick={() => handlePipelineClick('watersupply')}>
                            <div className="w-8 h-8 flex items-center justify-center">
                                <div className="w-full h-1 bg-[#00b4d8] rounded-full shadow-sm"></div>
                            </div>
                            <span className="text-sm font-semibold text-slate-700">Water Supply</span>
                        </div>

                        {/* Borewell Water */}
                        <div className={clsx("flex items-center gap-3 cursor-pointer rounded-lg px-2 py-1 transition-all", activePipeline === 'borewellwater' ? 'bg-indigo-100 ring-2 ring-indigo-400' : 'hover:bg-slate-50')} onClick={() => handlePipelineClick('borewellwater')}>
                            <div className="w-8 h-8 flex items-center justify-center">
                                <div className="w-full h-1 bg-[#000080] rounded-full shadow-sm"></div>
                            </div>
                            <span className="text-sm font-semibold text-slate-700">Borewell Water</span>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
};
