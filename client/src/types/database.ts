export type UserRole = 'superadmin' | 'distributor' | 'customer';
export type UserPlan = 'base' | 'plus' | 'pro';
export type NodeCategory = 'OHT' | 'Sump' | 'Borewell' | 'GovtBorewell' | 'PumpHouse' | 'FlowMeter';
export type AnalyticsType = 'EvaraTank' | 'EvaraDeep' | 'EvaraFlow';
export type NodeStatus = 'Online' | 'Offline' | 'Maintenance' | 'Alert';
export type PeriodType = 'hourly' | 'daily' | 'weekly' | 'monthly';

export interface UserProfileRow {
    id: string;
    email: string;
    display_name: string;
    role: UserRole;
    plan: UserPlan;
    created_by: string | null;
    distributor_id: string | null;
    created_at: string;
}

export interface NodeRow {
    id: string;
    node_key: string;
    label: string;
    category: NodeCategory;
    analytics_type: AnalyticsType;
    location_name: string;
    lat: number;
    lng: number;
    capacity: string;
    status: NodeStatus;
    thingspeak_channel_id: string | null;
    thingspeak_read_api_key: string | null;
    created_by: string | null;
    created_at: string;
}

export interface NodeAssignmentRow {
    id: string;
    node_id: string;
    user_id: string;
    assigned_by: string | null;
    assigned_at: string;
}

export interface PipelineRow {
    id: string;
    name: string;
    color: string;
    positions: [number, number][];
    created_by: string | null;
    created_at: string;
    updated_at: string;
}

export interface NodeAnalyticsRow {
    id: string;
    node_id: string;
    period_type: PeriodType;
    period_start: string;
    consumption_liters: number | null;
    avg_level_percent: number | null;
    peak_flow: number | null;
    metadata: any;
    created_at: string;
}

export interface AuditLogRow {
    id: string;
    user_id: string | null;
    action: string;
    entity_type: string;
    entity_id: string | null;
    metadata: any;
    created_at: string;
}

export type PipelineInsert = Database['public']['Tables']['pipelines']['Insert'];
export type PipelineUpdate = Database['public']['Tables']['pipelines']['Update'];

export type AuditLogInsert = Database['public']['Tables']['audit_logs']['Insert'];
export type AuditLogUpdate = Database['public']['Tables']['audit_logs']['Update'];

export interface Database {
    public: {
        Tables: {
            users_profiles: {
                Row: UserProfileRow;
                Insert: Partial<UserProfileRow>;
                Update: Partial<UserProfileRow>;
            };
            nodes: {
                Row: NodeRow;
                Insert: Partial<NodeRow>;
                Update: Partial<NodeRow>;
            };
            node_assignments: {
                Row: NodeAssignmentRow;
                Insert: Partial<NodeAssignmentRow>;
                Update: Partial<NodeAssignmentRow>;
            };
            pipelines: {
                Row: PipelineRow;
                Insert: Partial<PipelineRow>;
                Update: Partial<PipelineRow>;
            };
            node_analytics: {
                Row: NodeAnalyticsRow;
                Insert: Partial<NodeAnalyticsRow>;
                Update: Partial<NodeAnalyticsRow>;
            };
            audit_logs: {
                Row: AuditLogRow;
                Insert: Partial<AuditLogRow>;
                Update: Partial<AuditLogRow>;
            };
        };
        Views: Record<string, never>;
        Functions: Record<string, never>;
        Enums: Record<string, never>;
    };
}
