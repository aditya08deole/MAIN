"""
Rate Limiting Utilities
=======================

Implements token bucket algorithm for rate limiting external API calls.
Used in Phase 3 for ThingSpeak API rate limiting.
"""

import time
from threading import Lock
from typing import Optional


class TokenBucketRateLimiter:
    """
    Token Bucket Rate Limiter
    
    Allows burst traffic up to bucket capacity while maintaining
    average rate over time.
    
    Example:
        # 4 requests per minute (ThingSpeak limit)
        limiter = TokenBucketRateLimiter(capacity=4, refill_rate=4/60)
        
        if limiter.consume():
            # Make API request
            pass
        else:
            # Rate limited - wait before retry
            pass
    """
    
    def __init__(self, capacity: int, refill_rate: float):
        """
        Initialize token bucket.
        
        Args:
            capacity: Maximum tokens in bucket (burst capacity)
            refill_rate: Tokens added per second
        """
        self.capacity = capacity
        self.refill_rate = refill_rate
        self.tokens = capacity
        self.last_refill = time.time()
        self.lock = Lock()
    
    def consume(self, tokens: int = 1) -> bool:
        """
        Attempt to consume tokens.
        
        Args:
            tokens: Number of tokens to consume
            
        Returns:
            True if tokens available, False if rate limited
        """
        with self.lock:
            self._refill()
            
            if self.tokens >= tokens:
                self.tokens -= tokens
                return True
            
            return False
    
    def _refill(self):
        """Refill bucket based on elapsed time."""
        now = time.time()
        elapsed = now - self.last_refill
        
        # Add tokens based on elapsed time
        tokens_to_add = elapsed * self.refill_rate
        self.tokens = min(self.capacity, self.tokens + tokens_to_add)
        self.last_refill = now
    
    def get_wait_time(self) -> float:
        """
        Get seconds to wait before next request.
        
        Returns:
            Seconds to wait (0 if tokens available)
        """
        with self.lock:
            self._refill()
            
            if self.tokens >= 1:
                return 0.0
            
            # Calculate time needed to get 1 token
            tokens_needed = 1 - self.tokens
            return tokens_needed / self.refill_rate
    
    def reset(self):
        """Reset bucket to full capacity."""
        with self.lock:
            self.tokens = self.capacity
            self.last_refill = time.time()


class AdaptiveRateLimiter:
    """
    Adaptive rate limiter that adjusts based on success/failure.
    
    Reduces rate when errors occur, increases when stable.
    """
    
    def __init__(
        self,
        initial_capacity: int,
        min_capacity: int = 1,
        max_capacity: int = 10
    ):
        self.min_capacity = min_capacity
        self.max_capacity = max_capacity
        self.current_capacity = initial_capacity
        
        # Token bucket with current capacity
        self.bucket = TokenBucketRateLimiter(
            capacity=initial_capacity,
            refill_rate=initial_capacity / 60  # Per minute
        )
        
        self.success_count = 0
        self.failure_count = 0
        self.lock = Lock()
    
    def consume(self) -> bool:
        """Attempt to consume a token."""
        return self.bucket.consume()
    
    def record_success(self):
        """Record successful request - may increase capacity."""
        with self.lock:
            self.success_count += 1
            self.failure_count = max(0, self.failure_count - 1)
            
            # After 10 successful requests, increase capacity
            if self.success_count >= 10 and self.current_capacity < self.max_capacity:
                self.current_capacity = min(self.max_capacity, self.current_capacity + 1)
                self._recreate_bucket()
                self.success_count = 0
    
    def record_failure(self):
        """Record failed request - may decrease capacity."""
        with self.lock:
            self.failure_count += 1
            self.success_count = 0
            
            # After 3 failures, reduce capacity
            if self.failure_count >= 3 and self.current_capacity > self.min_capacity:
                self.current_capacity = max(self.min_capacity, self.current_capacity - 1)
                self._recreate_bucket()
                self.failure_count = 0
    
    def _recreate_bucket(self):
        """Recreate token bucket with new capacity."""
        self.bucket = TokenBucketRateLimiter(
            capacity=self.current_capacity,
            refill_rate=self.current_capacity / 60
        )
    
    def get_wait_time(self) -> float:
        """Get seconds to wait before next request."""
        return self.bucket.get_wait_time()
