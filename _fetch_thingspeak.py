import asyncio
import sys
sys.path.insert(0, 'c:\\Users\\asus\\OneDrive\\Desktop\\MAIN\\server')

from thingspeak import get_thingspeak_client
import json

async def main():
    ts = get_thingspeak_client()
    data = await ts.fetch_incremental_telemetry(
        "b4f94237-42f1-4f16-8a88-f52631d84bdc",
        "2613745",
        "KHJXYW6LEIDQ1TJA",
        None
    )
    print("Latest feed:")
    if data and "feeds" in data and data["feeds"]:
        print(json.dumps(data["feeds"][-1], indent=2))
        print(f"\nField1 (sensor reading): {data['feeds'][-1].get('field1', 'N/A')} cm")
    else:
        print("No data")

asyncio.run(main())
