"""
Phase 29: AI Analytics Engine V2
Implements anomaly detection using statistical methods.
Detects unusual sensor readings without requiring ML libraries.
"""
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime, timedelta
import math


class AnomalyDetector:
    """
    Statistical Anomaly Detection for IoT Sensor Data.
    Uses Z-Score method (no external ML dependencies needed).
    
    How it works:
    1. Maintain a rolling window of recent readings.
    2. Calculate mean and standard deviation.
    3. If a new reading is > 2σ from the mean, flag as anomaly.
    """
    
    def __init__(self, window_size: int = 100, z_threshold: float = 2.5):
        self.window_size = window_size
        self.z_threshold = z_threshold
        # Per-node, per-field rolling windows
        self._windows: Dict[str, List[float]] = {}
    
    def _get_key(self, node_id: str, field: str) -> str:
        return f"{node_id}:{field}"
    
    def _calculate_stats(self, values: List[float]) -> Tuple[float, float]:
        """Calculate mean and standard deviation."""
        if len(values) < 2:
            return 0.0, 0.0
        
        mean = sum(values) / len(values)
        variance = sum((x - mean) ** 2 for x in values) / (len(values) - 1)
        std_dev = math.sqrt(variance)
        
        return mean, std_dev
    
    def detect(self, node_id: str, field: str, value: float) -> Dict[str, Any]:
        """
        Check if a reading is anomalous.
        
        Returns:
            {
                "is_anomaly": bool,
                "severity": "low"|"medium"|"high"|None,
                "z_score": float,
                "expected_range": [low, high],
                "value": float
            }
        """
        key = self._get_key(node_id, field)
        
        if key not in self._windows:
            self._windows[key] = []
        
        window = self._windows[key]
        
        # Not enough data yet
        if len(window) < 10:
            window.append(value)
            return {
                "is_anomaly": False,
                "severity": None,
                "z_score": 0.0,
                "expected_range": None,
                "value": value,
                "status": "learning"
            }
        
        mean, std_dev = self._calculate_stats(window)
        
        # Avoid division by zero
        if std_dev == 0:
            z_score = 0.0
        else:
            z_score = abs(value - mean) / std_dev
        
        # Determine severity
        is_anomaly = z_score > self.z_threshold
        severity = None
        if z_score > self.z_threshold * 2:
            severity = "high"
        elif z_score > self.z_threshold * 1.5:
            severity = "medium"
        elif z_score > self.z_threshold:
            severity = "low"
        
        # Add to window (sliding)
        window.append(value)
        if len(window) > self.window_size:
            window.pop(0)
        
        return {
            "is_anomaly": is_anomaly,
            "severity": severity,
            "z_score": round(z_score, 3),
            "expected_range": [round(mean - 2 * std_dev, 2), round(mean + 2 * std_dev, 2)],
            "value": value,
            "mean": round(mean, 2),
            "std_dev": round(std_dev, 2)
        }
    
    def get_health_report(self, node_id: str) -> Dict[str, Any]:
        """Get anomaly health report for a specific node."""
        report = {}
        for key, window in self._windows.items():
            if key.startswith(f"{node_id}:"):
                field = key.split(":", 1)[1]
                mean, std_dev = self._calculate_stats(window)
                report[field] = {
                    "sample_count": len(window),
                    "mean": round(mean, 2),
                    "std_dev": round(std_dev, 2),
                    "range": [round(min(window), 2), round(max(window), 2)] if window else [0, 0]
                }
        return report
    
    def reset_node(self, node_id: str):
        """Clear learning data for a node (after maintenance/recalibration)."""
        keys_to_remove = [k for k in self._windows if k.startswith(f"{node_id}:")]
        for key in keys_to_remove:
            del self._windows[key]


# Global instance
anomaly_detector = AnomalyDetector(window_size=200, z_threshold=2.5)
