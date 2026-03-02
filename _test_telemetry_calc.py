"""
Test script to calculate water level percentage from ThingSpeak data.
Simulates the backend calculation logic.
"""
import asyncio
import sys
sys.path.insert(0, 'c:\\Users\\asus\\OneDrive\\Desktop\\MAIN\\server')

from thingspeak import get_thingspeak_client, TelemetryMapper
import json

async def main():
    # Tank specifications
    TANK_HEIGHT_CM = 1316.0
    
    # Fetch latest data from ThingSpeak
    ts = get_thingspeak_client()
    data = await ts.fetch_incremental_telemetry(
        "b4f94237-42f1-4f16-8a88-f52631d84bdc",
        "2613745",
        "KHJXYW6LEIDQ1TJA",
        None
    )
    
    if data and "feeds" in data and data["feeds"]:
        latest_feed = data["feeds"][-1]
        print("=" * 60)
        print("LATEST THINGSPEAK DATA:")
        print("=" * 60)
        print(json.dumps(latest_feed, indent=2))
        
        # Simulate the mapper calculation
        config = {
            "field_mapping": {
                "depth_field": "field1",
                "flow_rate_field": "field2",
                "water_level_field": "field2",
                "meter_reading_field": "field1"
            }
        }
        
        result = TelemetryMapper.map_tank(latest_feed, config)
        
        print("\n" + "=" * 60)
        print("CALCULATED TELEMETRY:")
        print("=" * 60)
        
        sensor_reading_cm = float(latest_feed.get("field1", 0))
        water_level_cm = TANK_HEIGHT_CM - sensor_reading_cm
        
        print(f"Sensor Reading (distance from top): {sensor_reading_cm} cm")
        print(f"Tank Height: {TANK_HEIGHT_CM} cm")
        print(f"Water Level: {water_level_cm:.2f} cm")
        print(f"Level Percentage: {result['level_percentage']:.2f}%")
        
        if result['temperature_value'] is not None:
            print(f"Temperature: {result['temperature_value']}°C")
        
        print("=" * 60)
    else:
        print("No data available from ThingSpeak")

asyncio.run(main())
