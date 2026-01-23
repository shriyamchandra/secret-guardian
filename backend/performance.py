"""
Performance monitoring and metrics collection.
Tracks scan performance, timing, and resource usage.
"""

import time
import psutil
import os
from typing import Dict, Any, Optional
from contextlib import contextmanager
from datetime import datetime


class PerformanceMonitor:
    """Monitor and track scan performance metrics."""

    def __init__(self):
        self.scan_history = []
        self.total_scans = 0
        self.total_findings = 0
        self.total_scan_time = 0.0

    @contextmanager
    def measure_scan(self):
        """
        Context manager to measure scan performance.

        Usage:
            with monitor.measure_scan() as metrics:
                # ... perform scan ...
                metrics["findings"] = 10
        """
        metrics = {
            "start_time": time.time(),
            "start_memory": self._get_memory_usage(),
            "start_cpu": self._get_cpu_usage(),
        }

        yield metrics

        # Calculate final metrics
        metrics["end_time"] = time.time()
        metrics["duration"] = metrics["end_time"] - metrics["start_time"]
        metrics["end_memory"] = self._get_memory_usage()
        metrics["end_cpu"] = self._get_cpu_usage()
        metrics["memory_delta"] = metrics["end_memory"] - metrics["start_memory"]
        metrics["timestamp"] = datetime.now().isoformat()

        # Store in history
        self.scan_history.append(metrics)
        self.total_scans += 1
        self.total_scan_time += metrics["duration"]

        if "findings" in metrics:
            self.total_findings += metrics["findings"]

        # Keep only last 100 scans
        if len(self.scan_history) > 100:
            self.scan_history.pop(0)

        # Log performance
        self._log_metrics(metrics)

    def _log_metrics(self, metrics: Dict[str, Any]) -> None:
        """Log performance metrics."""
        print(f"\n{'='*60}")
        print(f"⏱️  SCAN PERFORMANCE METRICS")
        print(f"{'='*60}")
        print(f"⏰ Duration: {metrics['duration']:.2f}s")
        print(f"📊 Findings: {metrics.get('findings', 0)}")
        print(
            f"💾 Memory: {metrics['start_memory']:.1f} MB → {metrics['end_memory']:.1f} MB (Δ{metrics['memory_delta']:+.1f} MB)"
        )
        print(f"🖥️  CPU: {metrics['start_cpu']:.1f}% → {metrics['end_cpu']:.1f}%")

        if metrics.get("findings", 0) > 0:
            findings_per_sec = metrics["findings"] / metrics["duration"]
            print(f"⚡ Throughput: {findings_per_sec:.2f} findings/sec")

        print(f"{'='*60}\n")

    def get_statistics(self) -> Dict[str, Any]:
        """
        Get overall performance statistics.

        Returns:
            Dictionary with aggregated metrics
        """
        if not self.scan_history:
            return {
                "total_scans": 0,
                "message": "No scans performed yet",
            }

        durations = [s["duration"] for s in self.scan_history]
        memory_deltas = [s["memory_delta"] for s in self.scan_history]

        return {
            "total_scans": self.total_scans,
            "total_findings": self.total_findings,
            "total_scan_time": round(self.total_scan_time, 2),
            "average_scan_time": round(sum(durations) / len(durations), 2),
            "fastest_scan": round(min(durations), 2),
            "slowest_scan": round(max(durations), 2),
            "average_memory_usage": round(sum(memory_deltas) / len(memory_deltas), 2),
            "current_memory": round(self._get_memory_usage(), 2),
            "uptime_seconds": self._get_uptime(),
        }

    def get_recent_scans(self, limit: int = 10) -> list:
        """
        Get recent scan metrics.

        Args:
            limit: Number of recent scans to return

        Returns:
            List of recent scan metrics
        """
        recent = self.scan_history[-limit:]
        return [
            {
                "timestamp": s["timestamp"],
                "duration": round(s["duration"], 2),
                "findings": s.get("findings", 0),
                "memory_delta": round(s["memory_delta"], 2),
            }
            for s in recent
        ]

    @staticmethod
    def _get_memory_usage() -> float:
        """Get current memory usage in MB."""
        process = psutil.Process(os.getpid())
        return process.memory_info().rss / 1024 / 1024  # Convert to MB

    @staticmethod
    def _get_cpu_usage() -> float:
        """Get current CPU usage percentage."""
        return psutil.cpu_percent(interval=0.1)

    @staticmethod
    def _get_uptime() -> float:
        """Get application uptime in seconds."""
        # Simple uptime tracking (since import)
        if not hasattr(PerformanceMonitor, "_start_time"):
            PerformanceMonitor._start_time = time.time()
        return time.time() - PerformanceMonitor._start_time


# Global performance monitor instance
performance_monitor = PerformanceMonitor()
