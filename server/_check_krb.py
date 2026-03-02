import asyncio, sys
sys.path.insert(0, '.')

async def check():
    from database import get_db, init_db
    from sqlalchemy import text
    await init_db()
    async for db in get_db():
        r = await db.execute(text("SELECT id, node_key, label, thingspeak_channel_id, thingspeak_read_key, thingspeak_write_key, field_mapping FROM devices WHERE label='KRB'"))
        row = r.fetchone()
        if row:
            print(f"Device: {row.label}")
            print(f"ID: {row.id}")
            print(f"Channel ID: {row.thingspeak_channel_id}")
            print(f"Read Key: {row.thingspeak_read_key}")
            print(f"Write Key: {row.thingspeak_write_key}")
            print(f"Field Mapping: {row.field_mapping}")
        else:
            print("KRB device not found")
        break

asyncio.run(check())
