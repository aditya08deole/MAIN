import os
import sys
sys.path.insert(0, 'c:\\Users\\asus\\OneDrive\\Desktop\\MAIN\\server')

from dotenv import load_dotenv
load_dotenv('c:\\Users\\asus\\OneDrive\\Desktop\\MAIN\\server\\.env')

from supabase import create_client

url = os.environ.get('SUPABASE_URL')
key = os.environ.get('SUPABASE_KEY')

if not url or not key:
    print("ERROR: Set SUPABASE_URL and SUPABASE_KEY environment variables")
    sys.exit(1)

supabase = create_client(url, key)

# Check devices table for tank specifications
response = supabase.table('devices').select('*').eq('label', 'KRB').execute()

if response.data:
    device = response.data[0]
    print("Device columns:")
    for key, value in device.items():
        if 'height' in key.lower() or 'capacity' in key.lower() or 'specification' in key.lower():
            print(f"  {key}: {value}")
    
    print("\nAll device data:")
    import json
    print(json.dumps(device, indent=2, default=str))
