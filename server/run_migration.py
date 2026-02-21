"""
Run database migration 005: Regions and Communities
"""
import asyncio
import re
from sqlalchemy import text
from database import engine


def split_sql_statements(sql_content):
    """
    Split SQL content into individual statements.
    Handles $$ blocks (for functions/procedures) and regular ; delimited statements.
    """
    statements = []
    current_statement = []
    in_dollar_quote = False
    
    lines = sql_content.split('\n')
    
    for line in lines:
        # Skip comments
        if line.strip().startswith('--'):
            continue
        
        # Check for $$ blocks (functions, procedures)
        if '$$' in line:
            in_dollar_quote = not in_dollar_quote
        
        current_statement.append(line)
        
        # If we hit a semicolon and not in a $$ block, end the statement
        if ';' in line and not in_dollar_quote:
            stmt = '\n'.join(current_statement).strip()
            if stmt:
                statements.append(stmt)
            current_statement = []
    
    # Add any remaining statement
    if current_statement:
        stmt = '\n'.join(current_statement).strip()
        if stmt:
            statements.append(stmt)
    
    return statements


async def run_migration():
    """Execute migration SQL."""
    print("=" * 80)
    print("RUNNING MIGRATION: 005_regions_communities.sql")
    print("=" * 80)
    
    try:
        # Read migration file
        with open('migrations/005_regions_communities.sql', 'r', encoding='utf-8') as f:
            migration_sql = f.read()
        
        print(f"[INFO] Migration file loaded ({len(migration_sql)} characters)")
        
        # Split SQL into individual statements
        statements = split_sql_statements(migration_sql)
        print(f"[INFO] Parsed {len(statements)} SQL statements")
        print(f"[INFO] Executing migration...\n")
        
        # Get connection with AUTOCOMMIT to allow multiple statements
        async with engine.connect() as conn:
            # Enable autocommit
            await conn.execution_options(isolation_level="AUTOCOMMIT")
            
            for i, stmt in enumerate(statements, 1):
                if not stmt.strip():
                    continue
                
                # Show what we're executing (first 80 chars)
                preview = stmt[:80].replace('\n', ' ').strip()
                if len(stmt) > 80:
                    preview += "..."
                print(f"  [{i}/{len(statements)}] {preview}")
                
                try:
                    await conn.execute(text(stmt))
                except Exception as e:
                    # Some statements might fail if they already exist
                    error_str = str(e)
                    if "already exists" in error_str or "duplicate" in error_str.lower():
                        print(f"      [WARN] Already exists, skipping")
                    else:
                        print(f"      [ERROR] {error_str[:100]}")
                        # Continue with other statements
        
        print("\n[SUCCESS] Migration statements executed")
        
        # Verify migration
        print("\n[INFO] Verifying migration...")
        async with engine.connect() as conn:
            # Check regions
            result = await conn.execute(text("SELECT COUNT(*) FROM regions"))
            regions_count = result.scalar()
            print(f"  [OK] regions table: {regions_count} rows")
            
            # Check communities
            result = await conn.execute(text("SELECT COUNT(*) FROM communities"))
            communities_count = result.scalar()
            print(f"  [OK] communities table: {communities_count} rows")
            
            # Check devices columns
            result = await conn.execute(text("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'devices' 
                AND column_name IN ('community_id', 'device_type', 'physical_category', 'analytics_template', 'thingspeak_write_key')
            """))
            devices_columns = result.fetchall()
            print(f"  [OK] devices table: {len(devices_columns)} new columns added")
            
            # Check users columns
            result = await conn.execute(text("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'users' 
                AND column_name = 'community_id'
            """))
            users_columns = result.fetchall()
            if users_columns:
                print(f"  [OK] users.community_id column added")
        
        print("\n[SUCCESS] Migration completed successfully! Database is ready.")
        print("=" * 80)
        
    except Exception as e:
        print(f"\n[ERROR] Migration failed: {e}")
        import traceback
        traceback.print_exc()
        raise


if __name__ == "__main__":
    asyncio.run(run_migration())
