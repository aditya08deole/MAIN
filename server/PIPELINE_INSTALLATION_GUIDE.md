# Pipeline & Infrastructure Data - Installation Guide

## Overview
This file adds all water infrastructure from the IIIT Hyderabad HTML map into your Supabase database:
- 4 Pump Houses
- 11 Sumps
- 14 Overhead Tanks (OHT)
- 12 IIIT Borewells  
- 7 Government Borewells
- 19 Pipelines (14 water supply + 5 borewell connections)

Total: **67 infrastructure entities**

## Installation Steps

### Option 1: Via Supabase Dashboard (Recommended)
1. Go to your Supabase project: https://supabase.com/dashboard/project/tihrvotigvaozizlcxse
2. Navigate to **SQL Editor**
3. Click **New Query**
4. Copy the entire contents of `PIPELINE_SEED_DATA.sql`
5. Paste into the editor
6. Click **Run** (or press Ctrl+Enter)
7. Verify: Check **Table Editor** → `nodes` table (should show ~50 nodes)
8. Verify: Check **Table Editor** → `pipelines` table (should show 19 pipelines)

### Option 2: Via psql Command Line
```bash
# Connect to your Supabase database
psql "postgresql://postgres.tihrvotigvaozizlcxse:evaratech@1010@aws-0-ap-south-1.pooler.supabase.com:6543/postgres"

# Run the seed file
\i server/PIPELINE_SEED_DATA.sql

# Verify
SELECT category, COUNT(*) FROM nodes GROUP BY category;
SELECT COUNT(*) FROM pipelines;
```

### Option 3: Via Python Script
```python
import psycopg2

conn = psycopg2.connect(
    host="aws-0-ap-south-1.pooler.supabase.com",
    port=6543,
    database="postgres",
    user="postgres.tihrvotigvaozizlcxse",
    password="evaratech@1010"
)

with open('server/PIPELINE_SEED_DATA.sql', 'r') as f:
    sql = f.read()
    
cursor = conn.cursor()
cursor.execute(sql)
conn. commit()
cursor.close()
conn.close()

print("✅ Pipeline data seeded successfully!")
```

## Verification Queries

After running the seed script, verify the data:

```sql
-- Check total nodes by category
SELECT category, COUNT(*) as count, 
       SUM(CASE WHEN status = 'Online' THEN 1 ELSE 0 END) as online
FROM nodes 
WHERE community_id = 'comm-iiit-campus'
GROUP BY category;

-- Expected output:
-- PumpHouse:     4 (4 online)
-- Sump:         11 (11 online)
-- OHT:          14 (14 online)
-- Borewell:     12 (4 online, 8 offline)
-- GovtBorewell:  7 (1 online, 6 offline)

-- Check pipelines
SELECT name, color FROM pipelines LIMIT 5;

-- Check distributor and community
SELECT id, name, region FROM distributors WHERE id = 'dist-iiit-hyd';
SELECT id, name, region FROM communities WHERE id = 'comm-iiit-campus';
```

## Map Display

After seeding, the nodes will appear on the dashboard map at:
- **Dashboard**: https://evara-dashboard.onrender.com/dashboard
- **Frontend**: https://evara-frontend.onrender.com/dashboard

**Map Coordinates**: IIIT Hyderabad Campus (17.445°N, 78.349°E)

### Marker Colors:
- 🟣 **Purple** - Pump Houses
- 🟢 **Green** - Sumps
- 🔵 **Blue** - Overhead Tanks (OHT)
- 🟡 **Yellow** - IIIT Borewells
- ⚫ **Black** - Government Borewells

### Pipeline Colors:
- 🔵 **Blue (#00b4d8)** - Water Supply Lines
- 🔴 **Red (#d62828)** - Borewell Water Lines

## Updating Existing Data

If you need to re-run the seed script, it's safe! The script uses:
```sql
ON CONFLICT (node_key) DO UPDATE SET ...
ON CONFLICT (id) DO UPDATE SET ...
```

This means:
- ✅ **Idempotent** - Can run multiple times safely
- ✅ **Updates existing** - Won't create duplicates
- ✅ **Preserves IDs** - Maintains referential integrity

## Customization

### Add Your Own Infrastructure

To add more nodes, follow this pattern:

```sql
INSERT INTO nodes (id, node_key, label, category, analytics_type, location_name, lat, lng, capacity, status, community_id, distributor_id, created_at) VALUES
('your-id', 'YOUR-KEY', 'Your Node Name', 'Sump', 'EvaraTank', 'Location', 17.445, 78.349, '50k L', 'Online', 'comm-iiit-campus', 'dist-iiit-hyd', NOW())
ON CONFLICT (node_key) DO UPDATE SET label = EXCLUDED.label;
```

### Add Pipelines

```sql
INSERT INTO pipelines (id, name, color, positions, created_at) VALUES
('your-pipe-id', 'Pipe Name', '#00b4d8', '[[78.349, 17.445], [78.350, 17.446]]'::jsonb, NOW())
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;
```

### Categories Available:
- `PumpHouse` - Motorized pumping stations
- `Sump` - Ground-level storage
- `OHT` - Overhead tanks
- `Borewell` - IIIT-owned borewells
- `GovtBorewell` - Government borewells
- `FlowMeter` - Flow measurement points

### Analytics Types:
- `EvaraTank` - Level/volume monitoring (sumps, tanks)
- `EvaraDeep` - Groundwater level monitoring (borewells)
- `EvaraFlow` - Flow rate monitoring (pipelines)

## Troubleshooting

### Error: "relation 'nodes' does not exist"
**Solution**: Run the main migration first:
```bash
psql $DATABASE_URL < server/migrations/001_backend_excellence.sql
```

### Error: "duplicate key value violates unique constraint"
**Solution**: This is normal if data already exists. The `ON CONFLICT` clause will update instead of failing.

### Nodes not appearing on map
**Checklist**:
1. ✅ Verify data in Supabase: `SELECT * FROM nodes LIMIT 10;`
2. ✅ Check frontend is deployed: `https://evara-frontend.onrender.com/dashboard`
3. ✅ Check backend is healthy: `https://evara-backend.onrender.com/health`
4. ✅ Open browser console (F12) and check for API errors
5. ✅ Verify `community_id` matches your user's community

### Pipelines not showing
**Checklist**:
1. ✅ Verify data: `SELECT * FROM pipelines;`
2. ✅ Check if map component fetches pipelines (may need frontend update)
3. ✅ Verify `positions` JSON is valid: Should be array of [lng, lat] pairs

## API Endpoints

Once seeded, the data is accessible via:

```bash
# Get all nodes
GET https://evara-backend.onrender.com/api/v1/nodes

# Get specific node
GET https://evara-backend.onrender.com/api/v1/nodes/{node_id}

# Get pipelines (if endpoint exists)
GET https://evara-backend.onrender.com/api/v1/pipelines
```

## Support

If you encounter issues:
1. Check Supabase logs: Dashboard → Logs → Postgres Logs
2. Check backend logs: Render Dashboard → evara-backend → Logs
3. Verify environment variables are set correctly
4. Ensure database connection string is correct

---

**Status**: ✅ Ready to deploy
**Last Updated**: $(date)
**Schema Version**: 001_backend_excellence.sql
