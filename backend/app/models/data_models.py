from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime
from enum import Enum

# Existing models...
class DataPoint(BaseModel):
    timestamp: datetime
    value: float
    label: Optional[str] = None

class DetectionRuleType(str, Enum):
    RULE1 = "rule1"
    RULE2 = "rule2"
    RULE3 = "rule3"
    RULE4 = "rule4"

class Signal(BaseModel):
    type: DetectionRuleType
    dataPoints: List[int]
    description: str
    severity: str

class ProcessLimits(BaseModel):
    average: float
    upperLimit: float
    lowerLimit: float
    averageMovingRange: float
    upperRangeLimit: float

# New Dynamic Baseline Models
class BaselineStability(str, Enum):
    STABLE = "stable"
    UNSTABLE = "unstable"
    IMPROVING = "improving"
    DEGRADING = "degrading"

class SeasonalPattern(str, Enum):
    NONE = "none"
    WEEKLY = "weekly"
    MONTHLY = "monthly"
    QUARTERLY = "quarterly"

class BaselineRecommendation(BaseModel):
    recommendedPeriod: int
    currentPeriod: int
    confidence: float  # 0-1 scale
    reasoning: List[str]
    stability: BaselineStability
    seasonalPattern: SeasonalPattern
    shouldRecalculate: bool
    lastRecalculationDate: Optional[datetime]

class DynamicBaselineAnalysis(BaseModel):
    recommendation: BaselineRecommendation
    dataStabilityScore: float  # 0-1, higher = more stable
    processChangePoints: List[int]  # Indices where significant changes detected
    seasonalityAnalysis: Dict[str, Any]
    signalDensity: float  # Signals per data point
    variationTrend: str  # "increasing", "decreasing", "stable"

class DynamicBaselineRequest(BaseModel):
    data: List[DataPoint]
    currentBaselinePeriod: int
    metricType: str = "cycle_time"
    minimumPeriod: int = 6
    maximumPeriod: int = 20

class DynamicBaselineResponse(BaseModel):
    analysis: DynamicBaselineAnalysis
    alternativeBaselines: List[Dict[str, Any]]  # Different period options
    historicalPerformance: Dict[str, float]  # Performance metrics for different periods
