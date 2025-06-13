from typing import List, Dict, Tuple
from datetime import datetime, timedelta
from collections import defaultdict
import statistics
from app.models.data_models import (
    DataPoint, ThroughputDataPoint, ThroughputAnalysis, 
    ThroughputPeriod, ProcessLimits
)
from app.services.pbc_calculator import PBCCalculator
import logging

logger = logging.getLogger(__name__)

class ThroughputCalculator:
    """
    Throughput calculator implementing Vacanti's methodology from 
    "Actionable Agile Metrics for Predictability Volume II"
    
    Throughput measures the number of work items finished per unit of time.
    This is fundamentally different from velocity as it counts items, not story points.
    """
    
    def __init__(self):
        self.pbc_calculator = PBCCalculator()
    
    def calculate_throughput_analysis(
        self, 
        completion_data: List[DataPoint], 
        period: ThroughputPeriod = ThroughputPeriod.WEEKLY
    ) -> ThroughputAnalysis:
        """
        Calculate comprehensive throughput analysis from completion data.
        
        Args:
            completion_data: List of work items with completion timestamps
            period: Time period for throughput aggregation (daily, weekly, monthly)
        
        Returns:
            ThroughputAnalysis with aggregated throughput data and statistics
        """
        if len(completion_data) < 3:
            raise ValueError("Minimum 3 completed items required for throughput analysis")
        
        logger.info(f"Calculating throughput analysis for {len(completion_data)} items with {period.value} periods")
        
        # Sort data by completion date
        sorted_data = sorted(completion_data, key=lambda x: x.timestamp)
        
        # Group completions by time period
        throughput_periods = self._group_by_period(sorted_data, period)
        
        # Calculate throughput statistics
        item_counts = [tp.itemCount for tp in throughput_periods]
        
        if not item_counts:
            raise ValueError("No throughput periods found")
        
        avg_throughput = statistics.mean(item_counts)
        median_throughput = statistics.median(item_counts)
        min_throughput = min(item_counts)
        max_throughput = max(item_counts)
        
        # Calculate predictability score using coefficient of variation
        # Lower CV = more predictable throughput
        if avg_throughput > 0:
            std_dev = statistics.stdev(item_counts) if len(item_counts) > 1 else 0
            coefficient_of_variation = std_dev / avg_throughput
            # Convert to predictability score (0-1, higher = more predictable)
            predictability_score = max(0, 1 - coefficient_of_variation)
        else:
            predictability_score = 0
        
        logger.info(f"Throughput statistics: avg={avg_throughput:.2f}, median={median_throughput}, "
                   f"range={min_throughput}-{max_throughput}, predictability={predictability_score:.3f}")
        
        return ThroughputAnalysis(
            throughputData=throughput_periods,
            averageThroughput=avg_throughput,
            medianThroughput=median_throughput,
            minThroughput=min_throughput,
            maxThroughput=max_throughput,
            period=period,
            totalPeriods=len(throughput_periods),
            totalItemsCompleted=len(completion_data),
            predictabilityScore=predictability_score
        )
    
    def _group_by_period(
        self, 
        completion_data: List[DataPoint], 
        period: ThroughputPeriod
    ) -> List[ThroughputDataPoint]:
        """Group completion data by specified time period"""
        
        if not completion_data:
            return []
        
        # Determine period boundaries
        start_date = completion_data[0].timestamp
        end_date = completion_data[-1].timestamp
        
        periods = []
        current_start = self._get_period_start(start_date, period)
        
        while current_start <= end_date:
            period_end = self._get_period_end(current_start, period)
            
            # Find items completed in this period
            items_in_period = [
                item for item in completion_data
                if current_start <= item.timestamp < period_end
            ]
            
            # Create throughput data point
            throughput_point = ThroughputDataPoint(
                periodStart=current_start,
                periodEnd=period_end,
                itemCount=len(items_in_period),
                itemsCompleted=[
                    item.label or f"Item-{i}" 
                    for i, item in enumerate(items_in_period)
                ],
                period=period
            )
            
            periods.append(throughput_point)
            current_start = period_end
        
        # Filter out empty periods at the end
        while periods and periods[-1].itemCount == 0:
            periods.pop()
        
        logger.debug(f"Created {len(periods)} throughput periods")
        return periods
    
    def _get_period_start(self, date: datetime, period: ThroughputPeriod) -> datetime:
        """Get the start of the period containing the given date"""
        if period == ThroughputPeriod.DAILY:
            return date.replace(hour=0, minute=0, second=0, microsecond=0)
        elif period == ThroughputPeriod.WEEKLY:
            # Start of week (Monday)
            days_since_monday = date.weekday()
            week_start = date - timedelta(days=days_since_monday)
            return week_start.replace(hour=0, minute=0, second=0, microsecond=0)
        elif period == ThroughputPeriod.MONTHLY:
            return date.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        else:
            raise ValueError(f"Unsupported period: {period}")
    
    def _get_period_end(self, period_start: datetime, period: ThroughputPeriod) -> datetime:
        """Get the end of the period starting at period_start"""
        if period == ThroughputPeriod.DAILY:
            return period_start + timedelta(days=1)
        elif period == ThroughputPeriod.WEEKLY:
            return period_start + timedelta(weeks=1)
        elif period == ThroughputPeriod.MONTHLY:
            # Handle month boundaries properly
            if period_start.month == 12:
                next_month = period_start.replace(year=period_start.year + 1, month=1)
            else:
                next_month = period_start.replace(month=period_start.month + 1)
            return next_month
        else:
            raise ValueError(f"Unsupported period: {period}")
    
    def create_throughput_pbc_data(self, throughput_analysis: ThroughputAnalysis) -> List[DataPoint]:
        """
        Convert throughput analysis to data points suitable for PBC analysis.
        This allows us to apply signal detection to throughput data.
        """
        pbc_data = []
        
        for i, period_data in enumerate(throughput_analysis.throughputData):
            # Use period midpoint as timestamp
            period_duration = period_data.periodEnd - period_data.periodStart
            midpoint = period_data.periodStart + (period_duration / 2)
            
            pbc_data.append(DataPoint(
                timestamp=midpoint,
                value=float(period_data.itemCount),
                label=f"{period_data.period.value.title()} {i+1}: {period_data.itemCount} items"
            ))
        
        return pbc_data
    
    def generate_throughput_recommendations(
        self, 
        throughput_analysis: ThroughputAnalysis, 
        signals: List
    ) -> List[str]:
        """Generate actionable recommendations based on throughput analysis"""
        recommendations = []
        
        # Predictability assessment
        if throughput_analysis.predictabilityScore < 0.7:
            recommendations.append(
                "Low throughput predictability detected. Consider investigating process variation "
                "and work intake patterns to improve flow stability."
            )
        
        # Throughput variation analysis
        if throughput_analysis.maxThroughput > throughput_analysis.averageThroughput * 2:
            recommendations.append(
                "High throughput variation detected. This may indicate batching behavior or "
                "irregular work intake. Consider implementing WIP limits and steady work intake."
            )
        
        # Signal-based recommendations
        if signals:
            high_severity_signals = [s for s in signals if s.severity == "high"]
            if high_severity_signals:
                recommendations.append(
                    "High-severity signals detected in throughput data. Investigate process changes "
                    "or external factors affecting delivery capacity during these periods."
                )
        
        # Zero throughput periods
        zero_periods = [tp for tp in throughput_analysis.throughputData if tp.itemCount == 0]
        if len(zero_periods) > throughput_analysis.totalPeriods * 0.2:  # More than 20% zero periods
            recommendations.append(
                "Frequent periods with zero throughput detected. This may indicate batching, "
                "process bottlenecks, or irregular work intake patterns."
            )
        
        # Baseline recommendations
        if throughput_analysis.totalPeriods < 10:
            recommendations.append(
                f"Consider collecting more throughput data. Current {throughput_analysis.totalPeriods} "
                "periods may not provide sufficient baseline for reliable forecasting."
            )
        
        return recommendations
