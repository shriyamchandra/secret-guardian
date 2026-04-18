"""
In-memory caching system for scan results.
Reduces redundant repository scans and improves response times.
"""

import hashlib
import time
from typing import Any, Optional, Dict
from threading import Lock


class ScanCache:
    """Thread-safe in-memory cache with TTL (Time To Live) support."""

    def __init__(self, ttl_seconds: int = 3600):
        """
        Initialize cache.

        Args:
            ttl_seconds: Time-to-live for cached items (default: 1 hour)
        """
        self._cache: Dict[str, Dict[str, Any]] = {}
        self._lock = Lock()
        self.ttl_seconds = ttl_seconds
        self.hits = 0
        self.misses = 0

    def _generate_key(self, repo_url: str) -> str:
        """Generate cache key from repository URL."""
        return hashlib.sha256(repo_url.encode()).hexdigest()[:16]

    def get(self, repo_url: str) -> Optional[Dict[str, Any]]:
        """
        Retrieve cached scan result.

        Args:
            repo_url: GitHub repository URL

        Returns:
            Cached result if valid, None if expired or missing
        """
        key = self._generate_key(repo_url)

        with self._lock:
            if key not in self._cache:
                self.misses += 1
                return None

            entry = self._cache[key]
            current_time = time.time()

            # Check if expired
            if current_time - entry["timestamp"] > self.ttl_seconds:
                del self._cache[key]
                self.misses += 1
                return None

            self.hits += 1
            print(
                f"🎯 Cache HIT for {repo_url[:50]}... (age: {int(current_time - entry['timestamp'])}s)"
            )
            return entry["data"]

    def set(self, repo_url: str, data: Dict[str, Any]) -> None:
        """
        Store scan result in cache.

        Args:
            repo_url: GitHub repository URL
            data: Scan result data to cache
        """
        key = self._generate_key(repo_url)

        with self._lock:
            self._cache[key] = {
                "data": data,
                "timestamp": time.time(),
            }
            print(f"💾 Cached scan result for {repo_url[:50]}...")

    def clear(self) -> None:
        """Clear all cached items."""
        with self._lock:
            self._cache.clear()
            self.hits = 0
            self.misses = 0
            print("🗑️  Cache cleared")

    def get_stats(self) -> Dict[str, Any]:
        """
        Get cache statistics.

        Returns:
            Dictionary with cache performance metrics
        """
        with self._lock:
            total_requests = self.hits + self.misses
            hit_rate = (self.hits / total_requests * 100) if total_requests > 0 else 0

            return {
                "total_items": len(self._cache),
                "hits": self.hits,
                "misses": self.misses,
                "hit_rate": f"{hit_rate:.2f}%",
                "ttl_seconds": self.ttl_seconds,
            }

    def cleanup_expired(self) -> int:
        """
        Remove expired cache entries.

        Returns:
            Number of items removed
        """
        with self._lock:
            current_time = time.time()
            expired_keys = [
                key
                for key, entry in self._cache.items()
                if current_time - entry["timestamp"] > self.ttl_seconds
            ]

            for key in expired_keys:
                del self._cache[key]

            if expired_keys:
                print(f"🧹 Cleaned up {len(expired_keys)} expired cache entries")

            return len(expired_keys)


# Global cache instance
scan_cache = ScanCache(ttl_seconds=3600)  # 1 hour TTL
