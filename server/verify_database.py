#!/usr/bin/env python3
"""
Verify database tables and check for ThingSpeak schema
"""
import asyncio
import asyncpg
import ssl

async def verify_tables():
    """Connect and verify all tables"""
    print("=" * 80)
    print("DATABASE VERIFICATION")
    print("=" * 80)
    
    ssl_context = ssl.create_default_context()
    ssl_context.check_hostname = False
    ssl_context.verify_mode = ssl.CERT_NONE
    
    conn = await asyncpg.connect(
        host="aws-1-ap-northeast-2.pooler.supabase.com",
        port=6543,
        user="postgres.tihrvotigvaozizlcxse",
        password="Wgj7DFMIn8TQwUXU",
        database="postgres",
        ssl=ssl_context,
        command_timeout=60,
        statement_cache_size=0
    )
    
    print("\n✓ Connected to Seoul pooler")
    
    # Get all tables
    tables = await conn.fetch("""
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public'
        ORDER BY tablename
    """)
    
    print(f"\n✓ Total tables: {len(tables)}")
    print("\nALL TABLES:")
    for i, table in enumerate(tables, 1):
        print(f"  {i:2d}. {table['tablename']}")
    
    # Check for ThingSpeak-related tables
    thingspeak_tables = [t['tablename'] for t in tables if 'thingspeak' in t['tablename'].lower()]
    
    print("\n" + "=" * 80)
    print("THINGSPEAK TABLES CHECK")
    print("=" * 80)
    
    if thingspeak_tables:
        print(f"\n✓ Found {len(thingspeak_tables)} ThingSpeak tables:")
        for table in thingspeak_tables:
            print(f"  - {table}")
            
            # Get structure
            columns = await conn.fetch(f"""
                SELECT column_name, data_type, is_nullable
                FROM information_schema.columns
                WHERE table_name = '{table}'
                ORDER BY ordinal_position
            """)
            
            print(f"    Columns ({len(columns)}):")
            for col in columns:
                nullable = "NULL" if col['is_nullable'] == 'YES' else "NOT NULL"
                print(f"      - {col['column_name']}: {col['data_type']} {nullable}")
    else:
        print("\n✗ NO ThingSpeak tables found!")
        print("\nRequired ThingSpeak tables:")
        print("  - thingspeak_channels")
        print("  - thingspeak_data")
        print("  - thingspeak_feeds")
        print("\nGenerating CREATE TABLE statements...")
        
        print("\n" + "=" * 80)
        print("THINGSPEAK SCHEMA SQL")
        print("=" * 80)
        
        sql = """
-- ThingSpeak Channels Table
CREATE TABLE IF NOT EXISTS thingspeak_channels (
    id SERIAL PRIMARY KEY,
    channel_id VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255),
    description TEXT,
    api_key VARCHAR(255),
    read_api_key VARCHAR(255),
    write_api_key VARCHAR(255),
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ThingSpeak Data Table (Time-series sensor data)
CREATE TABLE IF NOT EXISTS thingspeak_data (
    id BIGSERIAL PRIMARY KEY,
    channel_id VARCHAR(50) REFERENCES thingspeak_channels(channel_id) ON DELETE CASCADE,
    entry_id BIGINT NOT NULL,
    field1 DECIMAL(10, 2),
    field2 DECIMAL(10, 2),
    field3 DECIMAL(10, 2),
    field4 DECIMAL(10, 2),
    field5 DECIMAL(10, 2),
    field6 DECIMAL(10, 2),
    field7 DECIMAL(10, 2),
    field8 DECIMAL(10, 2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(channel_id, entry_id)
);

-- ThingSpeak Feeds Table (Latest readings)
CREATE TABLE IF NOT EXISTS thingspeak_feeds (
    id SERIAL PRIMARY KEY,
    channel_id VARCHAR(50) REFERENCES thingspeak_channels(channel_id) ON DELETE CASCADE,
    device_id INTEGER REFERENCES devices(id) ON DELETE CASCADE,
    last_entry_id BIGINT,
    last_update TIMESTAMP,
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(channel_id, device_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_thingspeak_data_channel ON thingspeak_data(channel_id);
CREATE INDEX IF NOT EXISTS idx_thingspeak_data_created ON thingspeak_data(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_thingspeak_feeds_device ON thingspeak_feeds(device_id);
CREATE INDEX IF NOT EXISTS idx_thingspeak_feeds_channel ON thingspeak_feeds(channel_id);
"""
        print(sql)
    
    await conn.close()
    print("\n" + "=" * 80)
    print("VERIFICATION COMPLETE")
    print("=" * 80)

if __name__ == "__main__":
    asyncio.run(verify_tables())
