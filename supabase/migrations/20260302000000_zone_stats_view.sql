-- View: zone_detailed_stats
-- Description: Aggregates real-time statistics for geographic zones.

DROP VIEW IF EXISTS public.zone_detailed_stats;

CREATE OR REPLACE VIEW public.zone_detailed_stats AS
SELECT 
    z.id AS zone_id,
    z.name AS zone_name,
    z.state,
    z.country,
    COUNT(DISTINCT c.id) AS community_count,
    COUNT(DISTINCT cust.id) AS customer_count,
    COUNT(DISTINCT d.id) AS device_count,
    COUNT(DISTINCT CASE WHEN d.status = 'Online' THEN d.id END) AS online_devices,
    COUNT(DISTINCT CASE WHEN d.status != 'Online' THEN d.id END) AS offline_devices,
    CASE 
        WHEN COUNT(DISTINCT d.id) = 0 THEN 100
        ELSE ROUND((COUNT(DISTINCT CASE WHEN (d.status = 'Online' OR d.status = 'Maintenance') THEN d.id END)::float / GREATEST(COUNT(DISTINCT d.id), 1)::float) * 100)
    END AS health_percent
FROM 
    public.zones z
LEFT JOIN 
    public.communities c ON c.zone_id = z.id
LEFT JOIN 
    public.customers cust ON cust.community_id = c.id
LEFT JOIN 
    public.devices d ON d.community_id = c.id
GROUP BY 
    z.id, z.name, z.state, z.country;
