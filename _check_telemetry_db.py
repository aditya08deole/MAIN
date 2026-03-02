import os
import sys
sys.path.insert(0, 'c:\\Users\\asus\\OneDrive\\Desktop\\MAIN\\server')

from dotenv import load_dotenv
load_dotenv('c:\\Users\\asus\\OneDrive\\Desktop\\MAIN\\server\\.env')

from supabase import create_client
import json

url = os.environ.get('SUPABASE_URL')
key = os.environ.get('SUPABASE_KEY')

if not url or not key:
    print("ERROR: Set SUPABASE_URL and SUPABASE_KEY environment variables")
    sys.exit(1)

supabase = create_client(url, key)

# Check telemetry_snapshots for KRB device
response = supabase.table('telemetry_snapshots').select('*').eq('device_id', 'b4f94237-42f1-4f16-8a88-f52631d84bdc').order('updated_at', desc=True).limit(1).execute()

print("=" * 60)
print("TELEMETRY SNAPSHOTS IN DATABASE:")
print("=" * 60)

if response.data:
    print(json.dumps(response.data[0], indent=2, default=str))
else:
    print("No telemetry snapshots found for KRB device")
    print("\nThis means the backend hasn't ingested data yet.")
    print("The frontend calls the /telemetry/devices/{id}/telemetry/latest endpoint")
    print("which triggers ingestion and stores data in telemetry_snapshots.")
