import asyncio
from sqlalchemy import text
from database import engine

async def run():
    async with engine.begin() as conn:
        sql = open('migrations/003_devices_map_upgrade.sql').read()
        await conn.execute(text(sql))
    print("Migration complete")

asyncio.run(run())
