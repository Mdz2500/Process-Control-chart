from typing import List, Dict, Tuple, Optional
from datetime import datetime, timedelta
import statistics
import numpy as np
from collections import defaultdict
from app.models.data_models import (
    DataPoint, DynamicBaselineAnalysis, BaselineRecommendation,
    BaselineStability, SeasonalPattern, ProcessLimits
)
from app.services.pbc_calculator import PBCCalculator
from app.services.signal_detector import SignalDetector
import logging

logger = logging.getLogger(__name__)

class DynamicBaselineCalculator:
    """
    Dynamic Baseline Calculator implementing Vacanti's methodology for optimal baseline periods.
    
    Based on principles from "Actionable Agile Metrics for Predictability Volume II":
    - Baseline periods should be 6-20 data points for meaningful analysis
    - Stability assessment based on signal detection and variation patterns
    - Process changes require baseline recalculation
    - Seasonal patterns affect baseline validity
    """
    
    def __init__(self):
        self.pbc_calculator = PBCCalculator()
        self.signal_detector = SignalDetector()
        self.min_baseline = 6
        self.max_baseline = 20
        self.optimal_baseline = 12  # Sweet spot per Vacanti
    
    def analyze_dynamic_baseline(
        self, 
        data: List[DataPoint], 
        current_baseline_period: int,
        metric_type: str = "cycle_time"
    ) -> DynamicBaselineAnalysis:
        """
        Analyze data to recommend optimal baseline period based on:
        1. Data stability (signal frequency and variation patterns)
        2. Process changes (detected through signal analysis)
        3. Seasonal patterns (recurring cycles in data)
        """
        logger.info(f"Analyzing dynamic baseline for {len(data)} data points, current period: {current_baseline_period}")
        
        if len(data) < self.min_baseline:
            raise ValueError(f"Minimum {self.min_baseline} data points required for baseline analysis")
        
        # Extract values and timestamps for analysis
        values = [point.value for point in data]
        timestamps = [point.timestamp for point in data]
        
        # 1. Analyze data stability
        stability_score = self._calculate_data_stability(values)
        stability_classification = self._classify_stability(stability_score)
        
        # 2. Detect process change points
        change_points = self._detect_process_changes(values)
        
        # 3. Analyze seasonal patterns
        seasonality_analysis = self._analyze_seasonality(data)
        seasonal_pattern = seasonality_analysis["dominant_pattern"]
        
        # 4. Calculate signal density
        signal_density = self._calculate_signal_density(values)
        
        # 5. Analyze variation trend
        variation_trend = self._analyze_variation_trend(values)
        
        # 6. Generate baseline recommendation
        recommendation = self._generate_baseline_recommendation(
            data, current_baseline_period, stability_score, 
            change_points, seasonal_pattern, signal_density, metric_type
        )
        
        return DynamicBaselineAnalysis(
            recommendation=recommendation,
            dataStabilityScore=stability_score,
            processChangePoints=change_points,
            seasonalityAnalysis=seasonality_analysis,
            signalDensity=signal_density,
            variationTrend=variation_trend
        )
    
    def _calculate_data_stability(self, values: List[float]) -> float:
        """
        Calculate data stability score based on:
        - Coefficient of variation
        - Moving range consistency
        - Trend analysis
        """
        if len(values) < 3:
            return 0.0
        
        # Calculate coefficient of variation (lower = more stable)
        mean_val = statistics.mean(values)
        if mean_val == 0:
            cv = 0
        else:
            std_dev = statistics.stdev(values) if len(values) > 1 else 0
            cv = std_dev / mean_val
        
        # Calculate moving range consistency
        moving_ranges = []
        for i in range(1, len(values)):
            moving_ranges.append(abs(values[i] - values[i-1]))
        
        mr_consistency = 1.0
        if len(moving_ranges) > 1:
            mr_mean = statistics.mean(moving_ranges)
            if mr_mean > 0:
                mr_cv = statistics.stdev(moving_ranges) / mr_mean
                mr_consistency = max(0, 1 - mr_cv)
        
        # Trend stability (less trend = more stable)
        trend_score = self._calculate_trend_stability(values)
        
        # Combine scores (weighted average)
        stability_score = (
            (1 - min(cv, 1.0)) * 0.4 +  # CV component (40%)
            mr_consistency * 0.4 +       # MR consistency (40%)
            trend_score * 0.2             # Trend stability (20%)
        )
        
        return max(0.0, min(1.0, stability_score))
    
    def _calculate_trend_stability(self, values: List[float]) -> float:
        """Calculate trend stability using linear regression slope"""
        if len(values) < 3:
            return 1.0
        
        x = list(range(len(values)))
        n = len(values)
        
        # Calculate linear regression slope
        sum_x = sum(x)
        sum_y = sum(values)
        sum_xy = sum(x[i] * values[i] for i in range(n))
        sum_x2 = sum(xi * xi for xi in x)
        
        if n * sum_x2 - sum_x * sum_x == 0:
            return 1.0
        
        slope = (n * sum_xy - sum_x * sum_y) / (n * sum_x2 - sum_x * sum_x)
        
        # Normalize slope relative to data range
        data_range = max(values) - min(values)
        if data_range == 0:
            return 1.0
        
        normalized_slope = abs(slope) / (data_range / len(values))
        trend_stability = max(0, 1 - normalized_slope)
        
        return trend_stability
    
    def _classify_stability(self, stability_score: float) -> BaselineStability:
        """Classify stability based on score"""
        if stability_score >= 0.8:
            return BaselineStability.STABLE
        elif stability_score >= 0.6:
            return BaselineStability.IMPROVING
        elif stability_score >= 0.4:
            return BaselineStability.DEGRADING
        else:
            return BaselineStability.UNSTABLE
    
    def _detect_process_changes(self, values: List[float]) -> List[int]:
        """
        Detect significant process changes using multiple baseline periods.
        Returns indices where process changes are detected.
        """
        change_points = []
        
        if len(values) < 12:  # Need enough data for change detection
            return change_points
        
        # Use sliding window approach to detect changes
        window_size = max(6, len(values) // 4)
        
        for i in range(window_size, len(values) - window_size):
            # Compare before and after windows
            before_window = values[max(0, i - window_size):i]
            after_window = values[i:min(len(values), i + window_size)]
            
            if len(before_window) >= 3 and len(after_window) >= 3:
                # Calculate statistics for both windows
                before_mean = statistics.mean(before_window)
                after_mean = statistics.mean(after_window)
                before_std = statistics.stdev(before_window) if len(before_window) > 1 else 0
                after_std = statistics.stdev(after_window) if len(after_window) > 1 else 0
                
                # Detect significant mean shift
                pooled_std = (before_std + after_std) / 2
                if pooled_std > 0:
                    mean_shift = abs(after_mean - before_mean) / pooled_std
                    if mean_shift > 2.0:  # Significant change threshold
                        change_points.append(i)
        
        # Remove nearby change points (within 3 positions)
        filtered_changes = []
        for cp in change_points:
            if not any(abs(cp - existing) < 3 for existing in filtered_changes):
                filtered_changes.append(cp)
        
        return filtered_changes
    
    def _analyze_seasonality(self, data: List[DataPoint]) -> Dict[str, any]:
        """
        Analyze seasonal patterns in the data.
        Returns dominant pattern and seasonality metrics.
        """
        if len(data) < 14:  # Need at least 2 weeks of data
            return {
                "dominant_pattern": SeasonalPattern.NONE,
                "weekly_strength": 0.0,
                "monthly_strength": 0.0,
                "patterns_detected": []
            }
        
        values = [point.value for point in data]
        timestamps = [point.timestamp for point in data]
        
        # Analyze weekly patterns (day of week effect)
        weekly_strength = self._calculate_weekly_seasonality(data)
        
        # Analyze monthly patterns (if enough data)
        monthly_strength = 0.0
        if len(data) >= 60:  # At least 2 months
            monthly_strength = self._calculate_monthly_seasonality(data)
        
        # Determine dominant pattern
        dominant_pattern = SeasonalPattern.NONE
        if weekly_strength > 0.3:
            dominant_pattern = SeasonalPattern.WEEKLY
        elif monthly_strength > 0.3:
            dominant_pattern = SeasonalPattern.MONTHLY
        
        patterns_detected = []
        if weekly_strength > 0.2:
            patterns_detected.append("weekly")
        if monthly_strength > 0.2:
            patterns_detected.append("monthly")
        
        return {
            "dominant_pattern": dominant_pattern,
            "weekly_strength": weekly_strength,
            "monthly_strength": monthly_strength,
            "patterns_detected": patterns_detected
        }
    
    def _calculate_weekly_seasonality(self, data: List[DataPoint]) -> float:
        """Calculate strength of weekly seasonal pattern"""
        if len(data) < 14:
            return 0.0
        
        # Group by day of week
        day_groups = defaultdict(list)
        for point in data:
            day_of_week = point.timestamp.weekday()  # 0=Monday, 6=Sunday
            day_groups[day_of_week].append(point.value)
        
        # Calculate variance between days vs within days
        day_means = []
        within_day_vars = []
        
        for day in range(7):
            if day in day_groups and len(day_groups[day]) > 1:
                day_values = day_groups[day]
                day_means.append(statistics.mean(day_values))
                within_day_vars.append(statistics.variance(day_values))
        
        if len(day_means) < 3:  # Need at least 3 days with multiple values
            return 0.0
        
        # Calculate between-day variance
        overall_mean = statistics.mean(day_means)
        between_day_var = statistics.variance(day_means) if len(day_means) > 1 else 0
        
        # Calculate average within-day variance
        avg_within_day_var = statistics.mean(within_day_vars) if within_day_vars else 0
        
        # Seasonality strength = between_var / (between_var + within_var)
        total_var = between_day_var + avg_within_day_var
        if total_var > 0:
            seasonality_strength = between_day_var / total_var
        else:
            seasonality_strength = 0.0
        
        return min(1.0, seasonality_strength)
    
    def _calculate_monthly_seasonality(self, data: List[DataPoint]) -> float:
        """Calculate strength of monthly seasonal pattern"""
        if len(data) < 60:
            return 0.0
        
        # Group by week of month (1-4)
        week_groups = defaultdict(list)
        for point in data:
            week_of_month = (point.timestamp.day - 1) // 7 + 1
            week_groups[week_of_month].append(point.value)
        
        # Similar calculation as weekly seasonality
        week_means = []
        within_week_vars = []
        
        for week in range(1, 5):
            if week in week_groups and len(week_groups[week]) > 1:
                week_values = week_groups[week]
                week_means.append(statistics.mean(week_values))
                within_week_vars.append(statistics.variance(week_values))
        
        if len(week_means) < 2:
            return 0.0
        
        between_week_var = statistics.variance(week_means) if len(week_means) > 1 else 0
        avg_within_week_var = statistics.mean(within_week_vars) if within_week_vars else 0
        
        total_var = between_week_var + avg_within_week_var
        if total_var > 0:
            seasonality_strength = between_week_var / total_var
        else:
            seasonality_strength = 0.0
        
        return min(1.0, seasonality_strength)
    
    def _calculate_signal_density(self, values: List[float]) -> float:
        """Calculate density of signals in the data"""
        if len(values) < self.min_baseline:
            return 0.0
        
        try:
            # Use current baseline to detect signals
            baseline_size = min(self.optimal_baseline, len(values))
            baseline_data = values[:baseline_size]
            
            limits = self.pbc_calculator.calculate_natural_process_limits(baseline_data)
            signals = self.signal_detector.detect_all_signals(values, limits)
            
            # Calculate signal density (signals per data point)
            total_signal_points = len(set().union(*[signal.dataPoints for signal in signals]))
            signal_density = total_signal_points / len(values)
            
            return signal_density
            
        except Exception as e:
            logger.warning(f"Error calculating signal density: {e}")
            return 0.0
    
    def _analyze_variation_trend(self, values: List[float]) -> str:
        """Analyze if variation is increasing, decreasing, or stable over time"""
        if len(values) < 10:
            return "stable"
        
        # Calculate moving standard deviations
        window_size = max(5, len(values) // 4)
        moving_stds = []
        
        for i in range(window_size, len(values) - window_size + 1):
            window = values[i-window_size:i+window_size]
            moving_stds.append(statistics.stdev(window) if len(window) > 1 else 0)
        
        if len(moving_stds) < 3:
            return "stable"
        
        # Calculate trend in moving standard deviations
        x = list(range(len(moving_stds)))
        n = len(moving_stds)
        
        sum_x = sum(x)
        sum_y = sum(moving_stds)
        sum_xy = sum(x[i] * moving_stds[i] for i in range(n))
        sum_x2 = sum(xi * xi for xi in x)
        
        if n * sum_x2 - sum_x * sum_x == 0:
            return "stable"
        
        slope = (n * sum_xy - sum_x * sum_y) / (n * sum_x2 - sum_x * sum_x)
        
        # Determine trend based on slope
        avg_std = statistics.mean(moving_stds)
        normalized_slope = slope / (avg_std / len(moving_stds)) if avg_std > 0 else 0
        
        if normalized_slope > 0.1:
            return "increasing"
        elif normalized_slope < -0.1:
            return "decreasing"
        else:
            return "stable"
    
    def _generate_baseline_recommendation(
        self,
        data: List[DataPoint],
        current_period: int,
        stability_score: float,
        change_points: List[int],
        seasonal_pattern: SeasonalPattern,
        signal_density: float,
        metric_type: str
    ) -> BaselineRecommendation:
        """Generate baseline period recommendation with reasoning"""
        
        reasoning = []
        confidence = 0.8  # Start with high confidence
        
        # Determine recommended period based on analysis
        if len(change_points) > 0:
            # Recent process changes detected
            most_recent_change = max(change_points)
            data_since_change = len(data) - most_recent_change
            
            if data_since_change >= self.min_baseline:
                recommended_period = min(data_since_change, self.max_baseline)
                reasoning.append(f"Process change detected at point {most_recent_change}. Using {data_since_change} points since last change.")
                should_recalculate = True
            else:
                recommended_period = self.min_baseline
                reasoning.append(f"Recent process change detected, but only {data_since_change} points available since change. Using minimum baseline.")
                confidence = 0.6
                should_recalculate = False
        else:
            # No recent changes, use stability-based recommendation
            if stability_score >= 0.8:
                # Very stable process
                recommended_period = min(self.max_baseline, len(data))
                reasoning.append(f"High process stability (score: {stability_score:.2f}). Using longer baseline period for better precision.")
                should_recalculate = current_period < recommended_period * 0.8
            elif stability_score >= 0.6:
                # Moderately stable
                recommended_period = self.optimal_baseline
                reasoning.append(f"Moderate process stability (score: {stability_score:.2f}). Using optimal baseline period.")
                should_recalculate = abs(current_period - recommended_period) > 3
            else:
                # Unstable process
                recommended_period = self.min_baseline
                reasoning.append(f"Low process stability (score: {stability_score:.2f}). Using shorter baseline period.")
                confidence = 0.5
                should_recalculate = current_period > recommended_period * 1.5
        
        # Adjust for seasonal patterns
        if seasonal_pattern == SeasonalPattern.WEEKLY:
            # Ensure baseline covers complete weeks
            weeks_needed = max(1, recommended_period // 7)
            seasonal_recommendation = weeks_needed * 7
            if seasonal_recommendation <= self.max_baseline:
                recommended_period = seasonal_recommendation
                reasoning.append(f"Weekly seasonality detected. Adjusted baseline to {weeks_needed} complete week(s).")
        elif seasonal_pattern == SeasonalPattern.MONTHLY:
            # For monthly patterns, use at least 2 weeks
            if recommended_period < 14:
                recommended_period = 14
                reasoning.append("Monthly seasonality detected. Using minimum 2-week baseline.")
        
        # Adjust for signal density
        if signal_density > 0.2:  # High signal density
            recommended_period = max(self.min_baseline, recommended_period - 2)
            reasoning.append(f"High signal density ({signal_density:.2f}). Reducing baseline period for faster detection.")
            confidence *= 0.9
        elif signal_density < 0.05:  # Very low signal density
            recommended_period = min(self.max_baseline, recommended_period + 2)
            reasoning.append(f"Low signal density ({signal_density:.2f}). Increasing baseline period for stability.")
        
        # Ensure within bounds
        recommended_period = max(self.min_baseline, min(self.max_baseline, recommended_period))
        
        # Determine stability classification
        if stability_score >= 0.8 and len(change_points) == 0:
            stability = BaselineStability.STABLE
        elif stability_score >= 0.6:
            stability = BaselineStability.IMPROVING
        elif len(change_points) > 0:
            stability = BaselineStability.DEGRADING
        else:
            stability = BaselineStability.UNSTABLE
        
        # Final confidence adjustment
        if abs(recommended_period - current_period) <= 2:
            confidence *= 1.1  # More confident if recommendation is close to current
        
        confidence = min(1.0, confidence)
        
        return BaselineRecommendation(
            recommendedPeriod=recommended_period,
            currentPeriod=current_period,
            confidence=confidence,
            reasoning=reasoning,
            stability=stability,
            seasonalPattern=seasonal_pattern,
            shouldRecalculate=should_recalculate,
            lastRecalculationDate=datetime.now()
        )
    
    def evaluate_alternative_baselines(
        self, 
        data: List[DataPoint], 
        periods_to_test: List[int]
    ) -> Dict[int, Dict[str, float]]:
        """
        Evaluate different baseline periods and return performance metrics.
        Helps users understand trade-offs between different baseline choices.
        """
        values = [point.value for point in data]
        results = {}
        
        for period in periods_to_test:
            if period < self.min_baseline or period > len(values):
                continue
            
            try:
                # Calculate limits using this baseline period
                baseline_data = values[:period]
                limits = self.pbc_calculator.calculate_natural_process_limits(baseline_data)
                
                # Detect signals using these limits
                signals = self.signal_detector.detect_all_signals(values, limits)
                
                # Calculate performance metrics
                signal_count = len(signals)
                signal_density = len(set().union(*[signal.dataPoints for signal in signals])) / len(values)
                
                # Calculate limit precision (tighter limits = more sensitive)
                limit_range = limits.upperLimit - limits.lowerLimit
                limit_precision = 1 / limit_range if limit_range > 0 else 0
                
                # Calculate stability score for this baseline
                baseline_stability = self._calculate_baseline_stability(baseline_data)
                
                results[period] = {
                    "signal_count": signal_count,
                    "signal_density": signal_density,
                    "limit_precision": limit_precision,
                    "baseline_stability": baseline_stability,
                    "upper_limit": limits.upperLimit,
                    "lower_limit": limits.lowerLimit,
                    "average": limits.average
                }
                
            except Exception as e:
                logger.warning(f"Error evaluating baseline period {period}: {e}")
                continue
        
        return results
    
    def _calculate_baseline_stability(self, baseline_data: List[float]) -> float:
        """Calculate stability score for a specific baseline period"""
        if len(baseline_data) < 3:
            return 0.0
        
        # Calculate coefficient of variation
        mean_val = statistics.mean(baseline_data)
        if mean_val == 0:
            return 0.0
        
        std_dev = statistics.stdev(baseline_data) if len(baseline_data) > 1 else 0
        cv = std_dev / mean_val
        
        # Convert to stability score (lower CV = higher stability)
        stability = max(0, 1 - cv)
        return min(1.0, stability)
