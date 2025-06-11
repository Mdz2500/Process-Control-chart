from typing import List
from app.models.data_models import Signal, DetectionRuleType, ProcessLimits

class SignalDetector:
    """Implements the four Western Electric detection rules for PBCs"""
    
    def detect_all_signals(self, data: List[float], limits: ProcessLimits) -> List[Signal]:
        """Detect all signals using the four detection rules"""
        signals = []
        sigma_lines = self._calculate_sigma_lines(limits)
        
        # Rule 1: Points outside natural process limits
        signals.extend(self.detect_rule1_signals(data, limits))
        
        # Rule 2: Two out of three successive values beyond 2-sigma
        signals.extend(self.detect_rule2_signals(data, limits.average, sigma_lines))
        
        # Rule 3: Four out of five successive values beyond 1-sigma
        signals.extend(self.detect_rule3_signals(data, limits.average, sigma_lines))
        
        # Rule 4: Eight successive values on same side of average
        signals.extend(self.detect_rule4_signals(data, limits.average))
        
        return signals
    
    def detect_rule1_signals(self, data: List[float], limits: ProcessLimits) -> List[Signal]:
        """Rule 1: Single point outside natural process limits"""
        signals = []
        
        for index, value in enumerate(data):
            if value > limits.upperLimit or value < limits.lowerLimit:  # Use camelCase field names
                signals.append(Signal(
                    type=DetectionRuleType.RULE1,
                    dataPoints=[index],  # Use camelCase field name
                    description="Point outside natural process limits - dominant assignable cause",
                    severity="high"
                ))
        
        return signals
    
    def detect_rule2_signals(self, data: List[float], average: float, sigma_lines: dict) -> List[Signal]:
        """Rule 2: Two out of three successive values beyond 2-sigma"""
        signals = []
        
        for i in range(len(data) - 2):
            window = data[i:i+3]
            indices = list(range(i, i+3))
            
            # Check upper side
            upper_count = sum(1 for val in window if val > sigma_lines["two_sigma_upper"])
            if upper_count >= 2:
                signals.append(Signal(
                    type=DetectionRuleType.RULE2,
                    data_points=indices,
                    description="Two out of three points beyond 2-sigma - moderate process change",
                    severity="moderate"
                ))
            
            # Check lower side
            lower_count = sum(1 for val in window if val < sigma_lines["two_sigma_lower"])
            if lower_count >= 2:
                signals.append(Signal(
                    type=DetectionRuleType.RULE2,
                    data_points=indices,
                    description="Two out of three points beyond 2-sigma - moderate process change",
                    severity="moderate"
                ))
        
        return signals
    
    def detect_rule3_signals(self, data: List[float], average: float, sigma_lines: dict) -> List[Signal]:
        """Rule 3: Four out of five successive values beyond 1-sigma"""
        signals = []
        
        for i in range(len(data) - 4):
            window = data[i:i+5]
            indices = list(range(i, i+5))
            
            # Check upper side
            upper_count = sum(1 for val in window if val > sigma_lines["one_sigma_upper"])
            if upper_count >= 4:
                signals.append(Signal(
                    type=DetectionRuleType.RULE3,
                    data_points=indices,
                    description="Four out of five points beyond 1-sigma - small sustained shift",
                    severity="moderate"
                ))
            
            # Check lower side  
            lower_count = sum(1 for val in window if val < sigma_lines["one_sigma_lower"])
            if lower_count >= 4:
                signals.append(Signal(
                    type=DetectionRuleType.RULE3,
                    data_points=indices,
                    description="Four out of five points beyond 1-sigma - small sustained shift",
                    severity="moderate"
                ))
        
        return signals
    
    def detect_rule4_signals(self, data: List[float], average: float) -> List[Signal]:
        """Rule 4: Eight successive values on same side of average"""
        signals = []
        current_run = 0
        current_side = None
        run_start = 0
        
        for index, value in enumerate(data):
            side = 'above' if value > average else 'below'
            
            if side == current_side:
                current_run += 1
            else:
                if current_run >= 8:
                    signals.append(Signal(
                        type=DetectionRuleType.RULE4,
                        data_points=list(range(run_start, run_start + current_run)),
                        description="Eight successive values on same side - sustained shift",
                        severity="low"
                    ))
                
                current_side = side
                current_run = 1
                run_start = index
        
        # Check final run
        if current_run >= 8:
            signals.append(Signal(
                type=DetectionRuleType.RULE4,
                data_points=list(range(run_start, run_start + current_run)),
                description="Eight successive values on same side - sustained shift",
                severity="low"
            ))
        
        return signals
    
def _calculate_sigma_lines(self, limits: ProcessLimits) -> dict:
    """Calculate sigma lines for detection rules 2 and 3"""
    sigma_value = limits.averageMovingRange * 2.66 / 3  # Use camelCase field name
    
    return {
        "one_sigma_upper": limits.average + sigma_value,
        "one_sigma_lower": max(0, limits.average - sigma_value),
        "two_sigma_upper": limits.average + (2 * sigma_value),
        "two_sigma_lower": max(0, limits.average - (2 * sigma_value))
    }