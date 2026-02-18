
import type { NodeRow, PipelineRow } from '../types/database';

export const STATIC_NODES: NodeRow[] = [
    // --- PUMP HOUSES ---
    {
        id: 'PH-01', node_key: 'ph-01', label: 'Pump House 1', category: 'PumpHouse', analytics_type: 'EvaraFlow',
        location_name: 'ATM Gate', lat: 17.4456, lng: 78.3516, capacity: '4.98L L', status: 'Online',
        thingspeak_channel_id: null, thingspeak_read_api_key: null, created_by: 'system', created_at: new Date().toISOString()
    },
    {
        id: 'PH-02', node_key: 'ph-02', label: 'Pump House 2', category: 'PumpHouse', analytics_type: 'EvaraFlow',
        location_name: 'Guest House', lat: 17.44608, lng: 78.34925, capacity: '75k L', status: 'Online',
        thingspeak_channel_id: null, thingspeak_read_api_key: null, created_by: 'system', created_at: new Date().toISOString()
    },
    {
        id: 'PH-03', node_key: 'ph-03', label: 'Pump House 3', category: 'PumpHouse', analytics_type: 'EvaraFlow',
        location_name: 'Staff Qtrs', lat: 17.4430, lng: 78.3487, capacity: '55k L', status: 'Online',
        thingspeak_channel_id: null, thingspeak_read_api_key: null, created_by: 'system', created_at: new Date().toISOString()
    },
    {
        id: 'PH-04', node_key: 'ph-04', label: 'Pump House 4', category: 'PumpHouse', analytics_type: 'EvaraFlow',
        location_name: 'Bakul', lat: 17.4481, lng: 78.3489, capacity: '2.00L L', status: 'Online',
        thingspeak_channel_id: null, thingspeak_read_api_key: null, created_by: 'system', created_at: new Date().toISOString()
    },

    // --- SUMPS ---
    {
        id: 'SUMP-S1', node_key: 'sump-s1', label: 'Sump S1', category: 'Sump', analytics_type: 'EvaraTank',
        location_name: 'Bakul', lat: 17.448097, lng: 78.349060, capacity: '2.00L L', status: 'Online',
        thingspeak_channel_id: null, thingspeak_read_api_key: null, created_by: 'system', created_at: new Date().toISOString()
    },
    {
        id: 'SUMP-S2', node_key: 'sump-s2', label: 'Sump S2', category: 'Sump', analytics_type: 'EvaraTank',
        location_name: 'Palash', lat: 17.444919, lng: 78.346195, capacity: '1.10L L', status: 'Online',
        thingspeak_channel_id: null, thingspeak_read_api_key: null, created_by: 'system', created_at: new Date().toISOString()
    },
    {
        id: 'SUMP-S3', node_key: 'sump-s3', label: 'Sump S3', category: 'Sump', analytics_type: 'EvaraTank',
        location_name: 'NBH', lat: 17.446779, lng: 78.346996, capacity: '1.00L L', status: 'Online',
        thingspeak_channel_id: null, thingspeak_read_api_key: null, created_by: 'system', created_at: new Date().toISOString()
    },
    {
        id: 'SUMP-S4', node_key: 'sump-s4', label: 'Sump S4 (Main Sump)', category: 'Sump', analytics_type: 'EvaraTank',
        location_name: 'Central', lat: 17.445630, lng: 78.351593, capacity: '4.98L L', status: 'Online',
        thingspeak_channel_id: null, thingspeak_read_api_key: null, created_by: 'system', created_at: new Date().toISOString()
    },
    {
        id: 'SUMP-S5', node_key: 'sump-s5', label: 'Sump S5', category: 'Sump', analytics_type: 'EvaraTank',
        location_name: 'Blk A&B', lat: 17.444766, lng: 78.350087, capacity: '55k L', status: 'Online',
        thingspeak_channel_id: null, thingspeak_read_api_key: null, created_by: 'system', created_at: new Date().toISOString()
    },
    {
        id: 'SUMP-S6', node_key: 'sump-s6', label: 'Sump S6', category: 'Sump', analytics_type: 'EvaraTank',
        location_name: 'Guest House', lat: 17.445498, lng: 78.350202, capacity: '10k L', status: 'Online',
        thingspeak_channel_id: null, thingspeak_read_api_key: null, created_by: 'system', created_at: new Date().toISOString()
    },
    {
        id: 'SUMP-S7', node_key: 'sump-s7', label: 'Sump S7', category: 'Sump', analytics_type: 'EvaraTank',
        location_name: 'Pump House', lat: 17.44597, lng: 78.34906, capacity: '43k L', status: 'Online',
        thingspeak_channel_id: null, thingspeak_read_api_key: null, created_by: 'system', created_at: new Date().toISOString()
    },
    {
        id: 'SUMP-S8', node_key: 'sump-s8', label: 'Sump S8', category: 'Sump', analytics_type: 'EvaraTank',
        location_name: 'Football', lat: 17.446683, lng: 78.348995, capacity: '12k L', status: 'Online',
        thingspeak_channel_id: null, thingspeak_read_api_key: null, created_by: 'system', created_at: new Date().toISOString()
    },
    {
        id: 'SUMP-S9', node_key: 'sump-s9', label: 'Sump S9', category: 'Sump', analytics_type: 'EvaraTank',
        location_name: 'Felicity', lat: 17.446613, lng: 78.346487, capacity: '15k L', status: 'Online',
        thingspeak_channel_id: null, thingspeak_read_api_key: null, created_by: 'system', created_at: new Date().toISOString()
    },
    {
        id: 'SUMP-S10', node_key: 'sump-s10', label: 'Sump S10', category: 'Sump', analytics_type: 'EvaraTank',
        location_name: 'FSQ A&B', lat: 17.443076, lng: 78.348737, capacity: '34k+31k', status: 'Online',
        thingspeak_channel_id: null, thingspeak_read_api_key: null, created_by: 'system', created_at: new Date().toISOString()
    },
    {
        id: 'SUMP-S11', node_key: 'sump-s11', label: 'Sump S11', category: 'Sump', analytics_type: 'EvaraTank',
        location_name: 'FSQ C,D,E', lat: 17.444773, lng: 78.347797, capacity: '1.5L+60k', status: 'Online',
        thingspeak_channel_id: null, thingspeak_read_api_key: null, created_by: 'system', created_at: new Date().toISOString()
    },

    // --- OVERHEAD TANKS ---
    {
        id: 'OHT-1', node_key: 'oht-1', label: 'Bakul OHT', category: 'OHT', analytics_type: 'EvaraTank',
        location_name: 'Bakul', lat: 17.448045, lng: 78.348438, capacity: '2 Units', status: 'Online',
        thingspeak_channel_id: '3212670', thingspeak_read_api_key: 'UXORK5OUGJ2VK5PX', created_by: 'system', created_at: new Date().toISOString()
    },
    {
        id: 'OHT-2', node_key: 'oht-2', label: 'Parijat OHT', category: 'OHT', analytics_type: 'EvaraTank',
        location_name: 'Parijat', lat: 17.447547, lng: 78.347752, capacity: '2 Units', status: 'Online',
        thingspeak_channel_id: null, thingspeak_read_api_key: null, created_by: 'system', created_at: new Date().toISOString()
    },
    {
        id: 'OHT-3', node_key: 'oht-3', label: 'Kadamba OHT', category: 'OHT', analytics_type: 'EvaraTank',
        location_name: 'Kadamba', lat: 17.446907, lng: 78.347178, capacity: '2 Units', status: 'Online',
        thingspeak_channel_id: null, thingspeak_read_api_key: null, created_by: 'system', created_at: new Date().toISOString()
    },
    {
        id: 'OHT-4', node_key: 'oht-4', label: 'NWH Block C OHT', category: 'OHT', analytics_type: 'EvaraTank',
        location_name: 'NWH Block C', lat: 17.447675, lng: 78.347430, capacity: '1 Unit', status: 'Online',
        thingspeak_channel_id: null, thingspeak_read_api_key: null, created_by: 'system', created_at: new Date().toISOString()
    },
    {
        id: 'OHT-5', node_key: 'oht-5', label: 'NWH Block B OHT', category: 'OHT', analytics_type: 'EvaraTank',
        location_name: 'NWH Block B', lat: 17.447391, lng: 78.347172, capacity: '1 Unit', status: 'Online',
        thingspeak_channel_id: null, thingspeak_read_api_key: null, created_by: 'system', created_at: new Date().toISOString()
    },
    {
        id: 'OHT-6', node_key: 'oht-6', label: 'NWH Block A OHT', category: 'OHT', analytics_type: 'EvaraTank',
        location_name: 'NWH Block A', lat: 17.447081, lng: 78.346884, capacity: '1 Unit', status: 'Online',
        thingspeak_channel_id: null, thingspeak_read_api_key: null, created_by: 'system', created_at: new Date().toISOString()
    },
    {
        id: 'OHT-7', node_key: 'oht-7', label: 'Palash Nivas OHT', category: 'OHT', analytics_type: 'EvaraTank',
        location_name: 'Palash', lat: 17.445096, lng: 78.345966, capacity: '4 Units', status: 'Online',
        thingspeak_channel_id: null, thingspeak_read_api_key: null, created_by: 'system', created_at: new Date().toISOString()
    },
    {
        id: 'OHT-8', node_key: 'oht-8', label: 'Anand Nivas OHT', category: 'OHT', analytics_type: 'EvaraTank',
        location_name: 'Anand', lat: 17.443976, lng: 78.348432, capacity: '2 Units', status: 'Online',
        thingspeak_channel_id: null, thingspeak_read_api_key: null, created_by: 'system', created_at: new Date().toISOString()
    },
    {
        id: 'OHT-9', node_key: 'oht-9', label: 'Budha Nivas OHT', category: 'OHT', analytics_type: 'EvaraTank',
        location_name: 'Budha', lat: 17.443396, lng: 78.348500, capacity: '2 Units', status: 'Online',
        thingspeak_channel_id: null, thingspeak_read_api_key: null, created_by: 'system', created_at: new Date().toISOString()
    },
    {
        id: 'OHT-10', node_key: 'oht-10', label: 'C Block OHT', category: 'OHT', analytics_type: 'EvaraTank',
        location_name: 'Block C', lat: 17.443387, lng: 78.347834, capacity: '3 Units', status: 'Online',
        thingspeak_channel_id: null, thingspeak_read_api_key: null, created_by: 'system', created_at: new Date().toISOString()
    },
    {
        id: 'OHT-11', node_key: 'oht-11', label: 'D Block OHT', category: 'OHT', analytics_type: 'EvaraTank',
        location_name: 'Block D', lat: 17.443914, lng: 78.347773, capacity: '3 Units', status: 'Online',
        thingspeak_channel_id: null, thingspeak_read_api_key: null, created_by: 'system', created_at: new Date().toISOString()
    },
    {
        id: 'OHT-12', node_key: 'oht-12', label: 'E Block OHT', category: 'OHT', analytics_type: 'EvaraTank',
        location_name: 'Block E', lat: 17.444391, lng: 78.347958, capacity: '3 Units', status: 'Online',
        thingspeak_channel_id: null, thingspeak_read_api_key: null, created_by: 'system', created_at: new Date().toISOString()
    },
    {
        id: 'OHT-13', node_key: 'oht-13', label: 'Vindhya OHT', category: 'OHT', analytics_type: 'EvaraTank',
        location_name: 'Vindhya', lat: 17.44568, lng: 78.34973, capacity: 'Mixed', status: 'Online',
        thingspeak_channel_id: null, thingspeak_read_api_key: null, created_by: 'system', created_at: new Date().toISOString()
    },
    {
        id: 'OHT-14', node_key: 'oht-14', label: 'Himalaya OHT', category: 'OHT', analytics_type: 'EvaraTank',
        location_name: 'Himalaya', lat: 17.44525, lng: 78.34966, capacity: '1 Unit', status: 'Online',
        thingspeak_channel_id: null, thingspeak_read_api_key: null, created_by: 'system', created_at: new Date().toISOString()
    },

    // --- BOREWELLS (IIIT) ---
    {
        id: 'BW-P1', node_key: 'bw-p1', label: 'Borewell P1', category: 'Borewell', analytics_type: 'EvaraDeep',
        location_name: 'Block C,D,E', lat: 17.443394, lng: 78.348117, capacity: '5 HP', status: 'Offline',
        thingspeak_channel_id: null, thingspeak_read_api_key: null, created_by: 'system', created_at: new Date().toISOString()
    },
    {
        id: 'BW-P2', node_key: 'bw-p2', label: 'Borewell P2', category: 'Borewell', analytics_type: 'EvaraDeep',
        location_name: 'Agri Farm', lat: 17.443093, lng: 78.348936, capacity: '12.5 HP', status: 'Offline',
        thingspeak_channel_id: null, thingspeak_read_api_key: null, created_by: 'system', created_at: new Date().toISOString()
    },
    {
        id: 'BW-P3', node_key: 'bw-p3', label: 'Borewell P3', category: 'Borewell', analytics_type: 'EvaraDeep',
        location_name: 'Palash', lat: 17.444678, lng: 78.347234, capacity: '5 HP', status: 'Offline',
        thingspeak_channel_id: null, thingspeak_read_api_key: null, created_by: 'system', created_at: new Date().toISOString()
    },
    {
        id: 'BW-P4', node_key: 'bw-p4', label: 'Borewell P4', category: 'Borewell', analytics_type: 'EvaraDeep',
        location_name: 'Vindhya', lat: 17.446649, lng: 78.350578, capacity: '--', status: 'Offline',
        thingspeak_channel_id: null, thingspeak_read_api_key: null, created_by: 'system', created_at: new Date().toISOString()
    },
    {
        id: 'BW-P5', node_key: 'bw-p5', label: 'Borewell P5', category: 'Borewell', analytics_type: 'EvaraDeep',
        location_name: 'Nilgiri', lat: 17.447783, lng: 78.349040, capacity: '5 HP', status: 'Online',
        thingspeak_channel_id: null, thingspeak_read_api_key: null, created_by: 'system', created_at: new Date().toISOString()
    },
    {
        id: 'BW-P6', node_key: 'bw-p6', label: 'Borewell P6', category: 'Borewell', analytics_type: 'EvaraDeep',
        location_name: 'Bakul', lat: 17.448335, lng: 78.348594, capacity: '7.5 HP', status: 'Offline',
        thingspeak_channel_id: null, thingspeak_read_api_key: null, created_by: 'system', created_at: new Date().toISOString()
    },
    {
        id: 'BW-P7', node_key: 'bw-p7', label: 'Borewell P7', category: 'Borewell', analytics_type: 'EvaraDeep',
        location_name: 'Volleyball', lat: 17.445847, lng: 78.346416, capacity: 'N/A', status: 'Offline',
        thingspeak_channel_id: null, thingspeak_read_api_key: null, created_by: 'system', created_at: new Date().toISOString()
    },
    {
        id: 'BW-P8', node_key: 'bw-p8', label: 'Borewell P8', category: 'Borewell', analytics_type: 'EvaraDeep',
        location_name: 'Palash', lat: 17.445139, lng: 78.345277, capacity: '7.5 HP', status: 'Online',
        thingspeak_channel_id: null, thingspeak_read_api_key: null, created_by: 'system', created_at: new Date().toISOString()
    },
    {
        id: 'BW-P9', node_key: 'bw-p9', label: 'Borewell P9', category: 'Borewell', analytics_type: 'EvaraDeep',
        location_name: 'Girls Blk A', lat: 17.446922, lng: 78.346699, capacity: '7.5 HP', status: 'Online',
        thingspeak_channel_id: null, thingspeak_read_api_key: null, created_by: 'system', created_at: new Date().toISOString()
    },
    {
        id: 'BW-P10', node_key: 'bw-p10', label: 'Borewell P10', category: 'Borewell', analytics_type: 'EvaraDeep',
        location_name: 'Parking NW', lat: 17.443947, lng: 78.350139, capacity: '5 HP', status: 'Online',
        thingspeak_channel_id: null, thingspeak_read_api_key: null, created_by: 'system', created_at: new Date().toISOString()
    },
    {
        id: 'BW-P10A', node_key: 'bw-p10a', label: 'Borewell P10A', category: 'Borewell', analytics_type: 'EvaraDeep',
        location_name: 'Agri Farm', lat: 17.443451, lng: 78.349635, capacity: '--', status: 'Offline',
        thingspeak_channel_id: null, thingspeak_read_api_key: null, created_by: 'system', created_at: new Date().toISOString()
    },
    {
        id: 'BW-P11', node_key: 'bw-p11', label: 'Borewell P11', category: 'Borewell', analytics_type: 'EvaraDeep',
        location_name: 'Blk C,D,E', lat: 17.444431, lng: 78.347649, capacity: '5 HP', status: 'Offline',
        thingspeak_channel_id: null, thingspeak_read_api_key: null, created_by: 'system', created_at: new Date().toISOString()
    },

    // --- BOREWELLS (GOVT) ---
    {
        id: 'BW-G1', node_key: 'bw-g1', label: 'Borewell G1', category: 'GovtBorewell', analytics_type: 'EvaraDeep',
        location_name: 'Palash', lat: 17.444601, lng: 78.345459, capacity: '5 HP', status: 'Offline',
        thingspeak_channel_id: null, thingspeak_read_api_key: null, created_by: 'system', created_at: new Date().toISOString()
    },
    {
        id: 'BW-G2', node_key: 'bw-g2', label: 'Borewell G2', category: 'GovtBorewell', analytics_type: 'EvaraDeep',
        location_name: 'Palash', lat: 17.445490, lng: 78.346838, capacity: '1.5 HP', status: 'Offline',
        thingspeak_channel_id: null, thingspeak_read_api_key: null, created_by: 'system', created_at: new Date().toISOString()
    },
    {
        id: 'BW-G3', node_key: 'bw-g3', label: 'Borewell G3', category: 'GovtBorewell', analytics_type: 'EvaraDeep',
        location_name: 'Vindhaya C4', lat: 17.446188, lng: 78.350067, capacity: '5 HP', status: 'Online',
        thingspeak_channel_id: null, thingspeak_read_api_key: null, created_by: 'system', created_at: new Date().toISOString()
    },
    {
        id: 'BW-G4', node_key: 'bw-g4', label: 'Borewell G4', category: 'GovtBorewell', analytics_type: 'EvaraDeep',
        location_name: 'Entrance', lat: 17.447111, lng: 78.350151, capacity: 'N/A', status: 'Offline',
        thingspeak_channel_id: null, thingspeak_read_api_key: null, created_by: 'system', created_at: new Date().toISOString()
    },
    {
        id: 'BW-G5', node_key: 'bw-g5', label: 'Borewell G5', category: 'GovtBorewell', analytics_type: 'EvaraDeep',
        location_name: 'Entrance', lat: 17.446311, lng: 78.351042, capacity: 'N/A', status: 'Offline',
        thingspeak_channel_id: null, thingspeak_read_api_key: null, created_by: 'system', created_at: new Date().toISOString()
    },
    {
        id: 'BW-G6', node_key: 'bw-g6', label: 'Borewell G6', category: 'GovtBorewell', analytics_type: 'EvaraDeep',
        location_name: 'Bamboo House', lat: 17.445584, lng: 78.347148, capacity: 'N/A', status: 'Offline',
        thingspeak_channel_id: null, thingspeak_read_api_key: null, created_by: 'system', created_at: new Date().toISOString()
    },
    {
        id: 'BW-G7', node_key: 'bw-g7', label: 'Borewell G7', category: 'GovtBorewell', analytics_type: 'EvaraDeep',
        location_name: 'Football', lat: 17.446115, lng: 78.348536, capacity: 'N/A', status: 'Offline',
        thingspeak_channel_id: null, thingspeak_read_api_key: null, created_by: 'system', created_at: new Date().toISOString()
    },
];

export const STATIC_PIPELINES: PipelineRow[] = [
    {
        id: 'PL-01', name: 'PH2 - OBH/PALASH', color: '#00b4d8',
        positions: [[17.446057, 78.349256], [17.445482, 78.348250], [17.446306, 78.347208], [17.445050, 78.345986]],
        created_by: 'system', created_at: new Date().toISOString(), updated_at: new Date().toISOString()
    },
    {
        id: 'PL-02', name: 'PH2 - KADAMBA/NBH', color: '#00b4d8',
        positions: [[17.446885, 78.347174], [17.446583, 78.346873], [17.446302, 78.347211]],
        created_by: 'system', created_at: new Date().toISOString(), updated_at: new Date().toISOString()
    },
    {
        id: 'PL-03', name: 'PH2 - HIMALAYA', color: '#00b4d8',
        positions: [[17.446056, 78.349253], [17.445883, 78.349082], [17.445328, 78.349734], [17.445248, 78.349661]],
        created_by: 'system', created_at: new Date().toISOString(), updated_at: new Date().toISOString()
    },
    {
        id: 'PL-04', name: 'PH2 - VINDYA', color: '#00b4d8',
        positions: [[17.446050, 78.349258], [17.445661, 78.349731]],
        created_by: 'system', created_at: new Date().toISOString(), updated_at: new Date().toISOString()
    },
    {
        id: 'PL-05', name: 'PH2 - PARIJAT/NGH', color: '#00b4d8',
        positions: [[17.446051, 78.349247], [17.447117, 78.347980], [17.447270, 78.348123], [17.447551, 78.347794]],
        created_by: 'system', created_at: new Date().toISOString(), updated_at: new Date().toISOString()
    },
    {
        id: 'PL-06', name: 'PH3 - BLOCK B', color: '#00b4d8',
        positions: [[17.443007, 78.348664], [17.443140, 78.348804], [17.443396, 78.348488]],
        created_by: 'system', created_at: new Date().toISOString(), updated_at: new Date().toISOString()
    },
    {
        id: 'PL-07', name: 'PH3 - BLOCK A', color: '#00b4d8',
        positions: [[17.443985, 78.348433], [17.443415, 78.349082], [17.443140, 78.348804]],
        created_by: 'system', created_at: new Date().toISOString(), updated_at: new Date().toISOString()
    },
    {
        id: 'PL-08', name: 'PH1 - PH4', color: '#00b4d8',
        positions: [[17.445575, 78.351598], [17.445769, 78.350952], [17.447747, 78.348591], [17.448093, 78.348908]],
        created_by: 'system', created_at: new Date().toISOString(), updated_at: new Date().toISOString()
    },
    {
        id: 'PL-09', name: 'PH1 - PH3', color: '#00b4d8',
        positions: [[17.445565, 78.351568], [17.445402, 78.351081], [17.442973, 78.348713]],
        created_by: 'system', created_at: new Date().toISOString(), updated_at: new Date().toISOString()
    },
    {
        id: 'PL-10', name: 'PH1 - PH2', color: '#00b4d8',
        positions: [[17.446070, 78.349252], [17.446702, 78.349832]],
        created_by: 'system', created_at: new Date().toISOString(), updated_at: new Date().toISOString()
    },
    {
        id: 'PL-11', name: 'PH4 - BAKUL OHT', color: '#00b4d8',
        positions: [[17.448103, 78.348890], [17.447824, 78.348636], [17.448006, 78.348428]],
        created_by: 'system', created_at: new Date().toISOString(), updated_at: new Date().toISOString()
    },
    {
        id: 'PL-12', name: 'PH4 - NWH Block C', color: '#00b4d8',
        positions: [[17.447827, 78.348632], [17.447144, 78.347988], [17.447614, 78.347462]],
        created_by: 'system', created_at: new Date().toISOString(), updated_at: new Date().toISOString()
    },
    {
        id: 'PL-13', name: 'PH4 - NWH Block B', color: '#00b4d8',
        positions: [[17.447147, 78.347989], [17.446898, 78.347750], [17.447350, 78.347202]],
        created_by: 'system', created_at: new Date().toISOString(), updated_at: new Date().toISOString()
    },
    {
        id: 'PL-14', name: 'PH4 - NWH Block A', color: '#00b4d8',
        positions: [[17.446897, 78.347747], [17.446582, 78.347440], [17.447044, 78.346897]],
        created_by: 'system', created_at: new Date().toISOString(), updated_at: new Date().toISOString()
    },

    // --- BOREWELL PIPELINES ---
    {
        id: 'PIPE-P5-S1', name: 'PIPE-P5-S1', color: '#d62828',
        positions: [[17.447797, 78.349013], [17.448091, 78.349042]],
        created_by: 'system', created_at: new Date().toISOString(), updated_at: new Date().toISOString()
    },
    {
        id: 'PIPE-P5-S7', name: 'PIPE-P5-S7', color: '#d62828',
        positions: [[17.447780, 78.349018], [17.446921, 78.349951], [17.445962, 78.349090]],
        created_by: 'system', created_at: new Date().toISOString(), updated_at: new Date().toISOString()
    },
    {
        id: 'PIPE-P8-S2', name: 'PIPE-P8-S2', color: '#d62828',
        positions: [[17.445120, 78.345291], [17.444911, 78.346206]],
        created_by: 'system', created_at: new Date().toISOString(), updated_at: new Date().toISOString()
    },
    {
        id: 'PIPE-P9-S3', name: 'PIPE-P9-S3', color: '#d62828',
        positions: [[17.446868, 78.346714], [17.446715, 78.346915], [17.446715, 78.346984]],
        created_by: 'system', created_at: new Date().toISOString(), updated_at: new Date().toISOString()
    },
    {
        id: 'PIPE-P10-S5', name: 'PIPE-P10-S5', color: '#d62828',
        positions: [[17.443927, 78.350157], [17.444322, 78.349693], [17.444701, 78.350068]],
        created_by: 'system', created_at: new Date().toISOString(), updated_at: new Date().toISOString()
    }
];
