import time
from fastapi import HTTPException, Request

class RateLimiter:
    """
    Simple In-Memory Rate Limiter.
    Not suitable for distributed deployments (use Redis for that).
    """
    def __init__(self, requests_per_minute: int = 60):
        self.rate = requests_per_minute
        self.window = 60
        self.clients = {} # {ip: [timestamps]}

    async def __call__(self, request: Request):
        client_ip = request.client.host
        now = time.time()
        
        if client_ip not in self.clients:
            self.clients[client_ip] = []
            
        timestamps = self.clients[client_ip]
        
        # Remove old timestamps
        timestamps = [t for t in timestamps if now - t < self.window]
        
        if len(timestamps) >= self.rate:
            raise HTTPException(status_code=429, detail="Too Many Requests")
            
        timestamps.append(now)
        self.clients[client_ip] = timestamps
        return True
