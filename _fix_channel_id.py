import os
import sys
sys.path.insert(0, 'c:\\Users\\asus\\OneDrive\\Desktop\\MAIN\\server')

from dotenv import load_dotenv
load_dotenv('c:\\Users\\asus\\OneDrive\\Desktop\\MAIN\\server\\.env')

from supabase import create_client

url = os.environ.get('SUPABASE_URL')
key = os.environ.get('SUPABASE_KEY')

supabase = create_client(url, key)

# Fix trailing spaces in channel_id
response = supabase.table('devices').select('id, label, thingspeak_channel_id').execute()

print("Checking for trailing spaces in channel IDs...")
for device in response.data:
    channel_id = device.get('thingspeak_channel_id', '')
    if channel_id and channel_id != channel_id.strip():
        print(f"Found trailing space in {device['label']}: '{channel_id}'")
        trimmed = channel_id.strip()
        supabase.table('devices').update({'thingspeak_channel_id': trimmed}).eq('id', device['id']).execute()
        print(f"  Fixed: '{trimmed}'")
    else:
        print(f"{device['label']}: OK ('{channel_id}')")

print("\nDone!")
