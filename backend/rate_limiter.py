"""
Rate limiting system to prevent API abuse.
Implements token bucket algorithm for smooth rate limiting.
"""

import os
import time
import math
from typing import Dict, Tuple, Optional
from threading import Lock

class RateLimiter:
    """Token bucket rate limiter with per-IP tracking."""

    def __init__(
        self,
        requests_per_minute: int = 10,
        requests_per_hour: int = 100,
    ):
        """
        Initialize rate limiter.

        Args:
            requests_per_minute: Max requests per minute per IP
            requests_per_hour: Max requests per hour per IP
        """
        self.requests_per_minute = int(os.getenv("RATE_LIMIT_PER_MINUTE", requests_per_minute))
        self.requests_per_hour = int(os.getenv("RATE_LIMIT_PER_HOUR", requests_per_hour))
        
        self.minute_rate = self.requests_per_minute / 60.0
        self.hour_rate = self.requests_per_hour / 3600.0

        # State mapping: client_ip -> { "tokens_min": float, "tokens_hr": float, "last_refill": float }
        self._buckets: Dict[str, Dict[str, float]] = {}
        self._lock = Lock()
        self._max_tracked_ips = 10000

    def _refill_and_get(self, client_ip: str, now: float) -> Dict[str, float]:
        """Refill tokens for the given IP and return its bucket."""
        if client_ip not in self._buckets:
            bucket = {
                "tokens_min": float(self.requests_per_minute),
                "tokens_hr": float(self.requests_per_hour),
                "last_refill": now
            }
            self._buckets[client_ip] = bucket
            return bucket

        bucket = self._buckets[client_ip]
        delta = max(0.0, now - bucket["last_refill"])
        
        if delta > 0:
            bucket["tokens_min"] = min(
                float(self.requests_per_minute), 
                bucket["tokens_min"] + delta * self.minute_rate
            )
            bucket["tokens_hr"] = min(
                float(self.requests_per_hour), 
                bucket["tokens_hr"] + delta * self.hour_rate
            )
            bucket["last_refill"] = now
            
        return bucket

    def _cleanup_idle_ips(self, now: float) -> None:
        """Perform bounded memory cleanup to avoid unbounded map growth."""
        if len(self._buckets) > self._max_tracked_ips:
            # Drop IPs that haven't made a request in an hour (fully refilled anyway)
            idle_threshold = 3600.0
            stale_keys = [
                ip for ip, b in self._buckets.items() 
                if now - b["last_refill"] > idle_threshold
            ]
            for ip in stale_keys:
                del self._buckets[ip]

    def check_rate_limit(self, client_ip: str) -> Tuple[bool, str, int]:
        """
        Check if client has exceeded rate limits.

        Args:
            client_ip: Client IP address

        Returns:
            Tuple of (allowed: bool, message: str, retry_after: int)
        """
        with self._lock:
            now = time.monotonic()
            
            # Periodically clean up memory to prevent unlimited map growth
            self._cleanup_idle_ips(now)

            bucket = self._refill_and_get(client_ip, now)
            
            # Check if request can be fulfilled
            if bucket["tokens_min"] < 1.0:
                needed = 1.0 - bucket["tokens_min"]
                retry_after = int(math.ceil(needed / self.minute_rate)) if self.minute_rate > 0 else 60
                return (
                    False,
                    f"Rate limit exceeded: {self.requests_per_minute} requests/minute",
                    retry_after,
                )
                
            if bucket["tokens_hr"] < 1.0:
                needed = 1.0 - bucket["tokens_hr"]
                retry_after = int(math.ceil(needed / self.hour_rate)) if self.hour_rate > 0 else 3600
                return (
                    False,
                    f"Rate limit exceeded: {self.requests_per_hour} requests/hour",
                    retry_after,
                )

            # Consume 1 token from both buckets
            bucket["tokens_min"] -= 1.0
            bucket["tokens_hr"] -= 1.0

            remaining_minute = int(bucket["tokens_min"])
            remaining_hour = int(bucket["tokens_hr"])

            print(
                f"✅ Rate limit OK for {client_ip} (remaining: {remaining_minute}/min, {remaining_hour}/hour)"
            )

            return (
                True,
                f"OK - {remaining_minute} requests remaining this minute",
                0,
            )

    def get_stats(self, client_ip: str) -> Dict[str, int]:
        """
        Get rate limit statistics for a client.

        Args:
            client_ip: Client IP address

        Returns:
            Dictionary with usage statistics
        """
        with self._lock:
            now = time.monotonic()
            bucket = self._refill_and_get(client_ip, now)
            
            remaining_minute = int(bucket["tokens_min"])
            remaining_hour = int(bucket["tokens_hr"])
            
            return {
                "requests_this_minute": self.requests_per_minute - remaining_minute,
                "requests_this_hour": self.requests_per_hour - remaining_hour,
                "max_per_minute": self.requests_per_minute,
                "max_per_hour": self.requests_per_hour,
                "remaining_minute": remaining_minute,
                "remaining_hour": remaining_hour,
            }

    def reset(self, client_ip: Optional[str] = None) -> None:
        """
        Reset rate limits.

        Args:
            client_ip: IP to reset, or None to reset all
        """
        with self._lock:
            if client_ip:
                if client_ip in self._buckets:
                    del self._buckets[client_ip]
                print(f"🔄 Reset rate limit for {client_ip}")
            else:
                self._buckets.clear()
                print("🔄 Reset all rate limits")


# Global rate limiter instance
rate_limiter = RateLimiter(
    requests_per_minute=10,  # Development settings
    requests_per_hour=100,
)
