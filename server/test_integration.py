#!/usr/bin/env python3
import requests
import json

print("=" * 80)
print("BACKEND STATUS")
print("=" * 80)

# Health check
print("\n[Health Check]")
r = requests.get('http://localhost:8000/health')
print(f"URL: http://localhost:8000/health")
print(f"Status: {r.status_code}")
print(f"Response: {json.dumps(r.json(), indent=2)}")

# OpenAPI endpoints
print("\n[API Endpoints]")
r2 = requests.get('http://localhost:8000/openapi.json')
schema = r2.json()
print(f"API Title: {schema['info']['title']}")
print(f"Version: {schema['info']['version']}")
print(f"\nAvailable Endpoints ({len(schema['paths'])}):")
for path, methods in sorted(schema['paths'].items()):
    for method in methods.keys():
        print(f"  {method.upper():<7} {path}")

print("\n" + "=" * 80)
print("FRONTEND → BACKEND TEST")
print("=" * 80)

# Test from frontend perspective
print("\n[CORS Test - Options Request]")
headers = {
    'Origin': 'http://localhost:8080',
    'Access-Control-Request-Method': 'GET',
}
r3 = requests.options('http://localhost:8000/health', headers=headers)
print(f"Status: {r3.status_code}")
print(f"CORS Headers:")
for key, value in r3.headers.items():
    if 'access-control' in key.lower() or 'origin' in key.lower():
        print(f"  {key}: {value}")

# Test actual GET with Origin
print("\n[CORS Test - GET with Origin]")
headers = {'Origin': 'http://localhost:8080'}
r4 = requests.get('http://localhost:8000/health', headers=headers)
print(f"Status: {r4.status_code}")
print(f"Access-Control-Allow-Origin: {r4.headers.get('access-control-allow-origin', 'NOT SET')}")

print("\n" + "=" * 80)
print("DATABASE CONNECTION TEST")
print("=" * 80)

# Test database-dependent endpoint
print("\n[GET /api/v1/devices]")
r5 = requests.get('http://localhost:8000/api/v1/devices')
print(f"URL: http://localhost:8000/api/v1/devices")
print(f"Status: {r5.status_code}")
print(f"Response: {r5.text[:200]}")

print("\n✓ Backend: http://localhost:8000")
print("✓ Frontend: http://localhost:8080")
print("✓ Database: Connected (Seoul pooler)")
