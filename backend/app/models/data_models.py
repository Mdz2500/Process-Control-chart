from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime
from enum import Enum

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
    dataPoints: List[int]  # camelCase
    description: str
    severity: str

class ProcessLimits(BaseModel):
    average: float
    upperLimit: float      # camelCase
    lowerLimit: float      # camelCase
    averageMovingRange: float  # camelCase
    upperRangeLimit: float     # camelCase

class PBCRequest(BaseModel):
    data: List[DataPoint]
    baselinePeriod: Optional[int] = Field(default=20, ge=3, le=50)  # camelCase
    detectionRules: List[DetectionRuleType] = [DetectionRuleType.RULE1, DetectionRuleType.RULE4]  # camelCase

class PBCResponse(BaseModel):
    xChart: Dict[str, Any]     # camelCase
    mrChart: Dict[str, Any]    # camelCase
    signals: List[Signal]
    limits: ProcessLimits
    baselinePeriod: int        # camelCase
