from typing import List
from app.models.data_models import ProcessLimits
import logging

logger = logging.getLogger(__name__)

class PBCCalculator:
    """
    Process Behaviour Chart calculator implementing Shewhart's XmR methodology
    as described in "Actionable Agile Metrics for Predictability Volume II"
    """
    
    def calculate_moving_ranges(self, data: List[float]) -> List[float]:
        """
        Calculate moving ranges between successive data points.
        Moving ranges capture the local, short-term routine variation.
        """
        if len(data) < 2:
            logger.warning("Cannot calculate moving ranges with less than 2 data points")
            return []
        
        moving_ranges = []
        for i in range(1, len(data)):
            # Take absolute value - we only care about magnitude of change
            moving_range = abs(data[i] - data[i - 1])
            moving_ranges.append(moving_range)
        
        logger.debug(f"Calculated {len(moving_ranges)} moving ranges: {moving_ranges}")
        return moving_ranges
    
    def calculate_natural_process_limits(self, data: List[float]) -> ProcessLimits:
        """
        Calculate Natural Process Limits using Shewhart's formulas:
        - X Chart limits: Average ± 2.66 × Average Moving Range  
        - mR Chart limit: 3.27 × Average Moving Range
        
        Based on the methodology from "Actionable Agile Metrics for Predictability Volume II"
        where 6 data points is the realistic minimum for meaningful XmR chart analysis.
        """
        if len(data) < 3:
            raise ValueError("Minimum 3 data points required for any calculation")
        
        if len(data) < 6:
            logger.warning(f"Only {len(data)} data points provided. Document recommends minimum 6 for reliable analysis.")
        
        logger.info(f"Calculating natural process limits for {len(data)} data points")
        
        # Calculate basic statistics
        average = sum(data) / len(data)
        logger.debug(f"Calculated average: {average:.4f}")
        
        # Calculate moving ranges between successive data points
        moving_ranges = self.calculate_moving_ranges(data)
        
        if not moving_ranges:
            raise ValueError("Unable to calculate moving ranges - insufficient data")
        
        # Check for all zero moving ranges (no variation)
        if all(mr == 0 for mr in moving_ranges):
            raise ValueError("All moving ranges are zero - no variation detected in data")
        
        # Calculate average moving range
        average_moving_range = sum(moving_ranges) / len(moving_ranges)
        logger.debug(f"Calculated average moving range: {average_moving_range:.4f}")
        
        # Prevent division by zero
        if average_moving_range == 0:
            raise ValueError("Average moving range is zero - cannot calculate limits")
        
        # Calculate Natural Process Limits using Shewhart's formulas
        # From the document: "Limits for the X Chart = Average ± 2.66 * Average Moving Range"
        upper_limit = average + (2.66 * average_moving_range)
        lower_limit = max(0, average - (2.66 * average_moving_range))  # Cannot be negative
        
        # Calculate Upper Range Limit for mR Chart
        # From the document: "Upper Range Limit = 3.27 * Average Moving Range"
        upper_range_limit = 3.27 * average_moving_range
        
        logger.info(f"Calculated limits:")
        logger.info(f"  Average: {average:.4f}")
        logger.info(f"  Upper Natural Process Limit: {upper_limit:.4f}")
        logger.info(f"  Lower Natural Process Limit: {lower_limit:.4f}")
        logger.info(f"  Average Moving Range: {average_moving_range:.4f}")
        logger.info(f"  Upper Range Limit: {upper_range_limit:.4f}")
        
        # Return ProcessLimits with camelCase field names to match Pydantic model
        return ProcessLimits(
            average=average,
            upperLimit=upper_limit,                    # camelCase field name
            lowerLimit=lower_limit,                    # camelCase field name  
            averageMovingRange=average_moving_range,   # camelCase field name
            upperRangeLimit=upper_range_limit          # camelCase field name
        )
    
    def calculate_sigma_lines(self, limits: ProcessLimits) -> dict:
        """
        Calculate 1-sigma and 2-sigma lines for enhanced signal detection.
        These are used for Detection Rules 2 and 3 from the Western Electric Zone Tests.
        """
        # Calculate sigma value: Average Moving Range * 2.66 / 3
        # This gives us the standard unit of variation for the process
        sigma_value = limits.averageMovingRange * 2.66 / 3  # Use camelCase field name
        
        sigma_lines = {
            "oneSigmaUpper": limits.average + sigma_value,
            "oneSigmaLower": max(0, limits.average - sigma_value),
            "twoSigmaUpper": limits.average + (2 * sigma_value),
            "twoSigmaLower": max(0, limits.average - (2 * sigma_value))
        }
        
        logger.debug(f"Calculated sigma lines: {sigma_lines}")
        return sigma_lines
    
    def validate_baseline_period(self, data_length: int, baseline_period: int) -> bool:
        """
        Validate baseline period according to document guidelines:
        - Minimum 6 data points for meaningful analysis
        - Optimal range 10-20 data points
        - Cannot exceed data length
        """
        if baseline_period < 3:
            raise ValueError("Minimum 3 data points required for any baseline calculation")
        
        if baseline_period > data_length:
            raise ValueError("Baseline period cannot exceed data length")
        
        if baseline_period < 6:
            logger.warning(f"Baseline period {baseline_period} is below recommended minimum of 6")
        
        return True
    
    def recommend_baseline_period(self, data_length: int) -> int:
        """
        Recommend optimal baseline period based on document guidance:
        - 6 minimum for meaningful analysis
        - 10-20 optimal range
        - Use all data if less than 20 points
        """
        if data_length < 6:
            logger.warning(f"Data length {data_length} is below recommended minimum of 6")
            return max(3, data_length)
        
        if data_length < 10:
            return data_length
        
        if data_length <= 20:
            return data_length
        
        # Optimal baseline period as per document guidance
        return 20
