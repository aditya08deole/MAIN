from abc import ABC, abstractmethod
from typing import Dict, Any

class BaseAnalyticsService(ABC):
    """
    Abstract Base Class for Data Intelligence.
    Handles derived metrics, forecasting, and anomaly detection.
    """
    
    @abstractmethod
    async def calculate_derived_metrics(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Compute efficiency and usage stats from raw data."""
        pass

    @abstractmethod
    async def detect_anomalies(self, stream_data: list[float]) -> bool:
        """Check for spikes or frozen sensors."""
        pass
