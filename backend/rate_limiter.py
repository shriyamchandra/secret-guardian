"""
Rate limiting system to prevent API abuse.
Implements token bucket algorithm for smooth rate limiting.
"""

import time
from typing import Dict, Tuple
from threading import Lock
from collections import defaultdict


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
        self.requests_per_minute = requests_per_minute
        self.requests_per_hour = requests_per_hour

        # Track requests: {ip: [(timestamp, count), ...]}
        self._minute_buckets: Dict[str, list] = defaultdict(list)
        self._hour_buckets: Dict[str, list] = defaultdict(list)
        self._lock = Lock()

    def _clean_old_requests(self, bucket: list, window_seconds: int) -> None:
        """Remove requests outside the time window."""
        current_time = time.time()
        # Keep only requests within the window
        bucket[:] = [ts for ts in bucket if current_time - ts < window_seconds]

    def check_rate_limit(self, client_ip: str) -> Tuple[bool, str, int]:
        """
        Check if client has exceeded rate limits.

        Args:
            client_ip: Client IP address

        Returns:
            Tuple of (allowed: bool, message: str, retry_after: int)
        """
        with self._lock:
            current_time = time.time()

            # Clean old requests
            self._clean_old_requests(self._minute_buckets[client_ip], 60)
            self._clean_old_requests(self._hour_buckets[client_ip], 3600)

            # Check minute limit
            minute_count = len(self._minute_buckets[client_ip])
            if minute_count >= self.requests_per_minute:
                retry_after = 60
                return (
                    False,
                    f"Rate limit exceeded: {self.requests_per_minute} requests/minute",
                    retry_after,
                )

            # Check hour limit
            hour_count = len(self._hour_buckets[client_ip])
            if hour_count >= self.requests_per_hour:
                retry_after = 3600
                return (
                    False,
                    f"Rate limit exceeded: {self.requests_per_hour} requests/hour",
                    retry_after,
                )

            # Record this request
            self._minute_buckets[client_ip].append(current_time)
            self._hour_buckets[client_ip].append(current_time)

            remaining_minute = self.requests_per_minute - minute_count - 1
            remaining_hour = self.requests_per_hour - hour_count - 1

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
            self._clean_old_requests(self._minute_buckets[client_ip], 60)
            self._clean_old_requests(self._hour_buckets[client_ip], 3600)

            return {
                "requests_this_minute": len(self._minute_buckets[client_ip]),
                "requests_this_hour": len(self._hour_buckets[client_ip]),
                "max_per_minute": self.requests_per_minute,
                "max_per_hour": self.requests_per_hour,
                "remaining_minute": self.requests_per_minute
                - len(self._minute_buckets[client_ip]),
                "remaining_hour": self.requests_per_hour
                - len(self._hour_buckets[client_ip]),
            }

    def reset(self, client_ip: str = None) -> None:
        """
        Reset rate limits.

        Args:
            client_ip: IP to reset, or None to reset all
        """
        with self._lock:
            if client_ip:
                self._minute_buckets[client_ip].clear()
                self._hour_buckets[client_ip].clear()
                print(f"🔄 Reset rate limit for {client_ip}")
            else:
                self._minute_buckets.clear()
                self._hour_buckets.clear()
                print("🔄 Reset all rate limits")


# Global rate limiter instance
rate_limiter = RateLimiter(
    requests_per_minute=10,  # Development settings
    requests_per_hour=100,
)
