import urllib.request
import json
import traceback

def test():
    try:
        req = urllib.request.Request('http://127.0.0.1:8000/api/v1/nodes', headers={'Accept': 'application/json'})
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read())
            
            if not data.get('data'):
                print("No devices found!")
                return
                
            for d in data.get('data', []):
                print(f"ID: {d['id']}, Name: {d['name']}, Type: {d['type']}, Online: {d.get('online', 'N/A')}")
                print(f"  Last Seen: {d.get('last_seen')} | Snapshot: {d.get('snapshot_timestamp')}")
                
                # Try fetching analytics for this device
                try:
                    areq = urllib.request.Request(f"http://127.0.0.1:8000/api/v1/analytics/device/{d['id']}", headers={'Accept': 'application/json'})
                    with urllib.request.urlopen(areq) as aresp:
                        adata = json.loads(aresp.read())
                        print(f"  --> Analytics Success! Online={adata.get('online', 'N/A')}")
                except urllib.error.HTTPError as e:
                    body = e.read().decode('utf-8')
                    print(f"  --> Analytics HTTPError {e.code}: {body}")
                except Exception as ex:
                    print(f"  --> Analytics Exception: {ex}")
    except Exception as e:
        print('Failed top level:')
        traceback.print_exc()

if __name__ == "__main__":
    test()
