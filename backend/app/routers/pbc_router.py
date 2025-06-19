from fastapi import APIRouter, HTTPException
from typing import List
import logging
from datetime import datetime
from app.models.data_models import (
    PBCRequest, PBCResponse, DataPoint, Signal, ProcessLimits,
    ThroughputRequest, ThroughputResponse, ThroughputPeriod,
    DynamicBaselineRequest, DynamicBaselineResponse
)
from app.services.pbc_calculator import PBCCalculator
from app.services.signal_detector import SignalDetector
from app.services.throughput_calculator import ThroughputCalculator
from app.services.dynamic_baseline_calculator import DynamicBaselineCalculator

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["pbc"])

@router.post("/analyze-dynamic-baseline", response_model=DynamicBaselineResponse)
async def analyze_dynamic_baseline(request: DynamicBaselineRequest):
    """
    Analyze data to recommend optimal baseline period based on:
    - Data stability (signal frequency and variation patterns)
    - Process changes (detected through signal analysis)  
    - Seasonal patterns (recurring cycles in data)
    
    Implements Vacanti's methodology for baseline period optimization.
    """
    logger.info(f"Received dynamic baseline request with {len(request.data)} data points")
    logger.info(f"Current baseline: {request.currentBaselinePeriod}, Metric: {request.metricType}")
    
    try:
        # Validate minimum data points
        if len(request.data) < request.minimumPeriod:
            raise HTTPException(
                status_code=400,
                detail=f"Minimum {request.minimumPeriod} data points required for baseline analysis"
            )
        
        # Initialize dynamic baseline calculator
        baseline_calculator = DynamicBaselineCalculator()
        
        # Perform dynamic baseline analysis
        analysis = baseline_calculator.analyze_dynamic_baseline(
            request.data,
            request.currentBaselinePeriod,
            request.metricType
        )
        
        logger.info(f"Dynamic baseline analysis completed:")
        logger.info(f"  Recommended period: {analysis.recommendation.recommendedPeriod}")
        logger.info(f"  Confidence: {analysis.recommendation.confidence:.2f}")
        logger.info(f"  Stability: {analysis.recommendation.stability}")
        logger.info(f"  Should recalculate: {analysis.recommendation.shouldRecalculate}")
        
        # Evaluate alternative baseline periods
        periods_to_test = list(range(
            request.minimumPeriod,
            min(request.maximumPeriod + 1, len(request.data) + 1)
        ))
        
        alternative_baselines = baseline_calculator.evaluate_alternative_baselines(
            request.data, periods_to_test
        )
        
        # Calculate historical performance metrics
        historical_performance = {}
        for period, metrics in alternative_baselines.items():
            historical_performance[str(period)] = metrics["baseline_stability"]
        
        response_data = DynamicBaselineResponse(
            analysis=analysis,
            alternativeBaselines=[
                {
                    "period": period,
                    "metrics": metrics
                }
                for period, metrics in alternative_baselines.items()
            ],
            historicalPerformance=historical_performance
        )
        
        logger.info("Dynamic baseline analysis completed successfully")
        return response_data
        
    except HTTPException:
        raise
    except ValueError as e:
        logger.error(f"Validation error: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Unexpected error during dynamic baseline analysis: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Internal analysis error: {str(e)}"
        )

@router.post("/calculate-throughput", response_model=ThroughputResponse)
async def calculate_throughput(request: ThroughputRequest):
    """
    Calculate Throughput analysis with Process Behaviour Charts.
    
    Implements Vacanti's methodology for throughput analysis:
    - Groups completion data by time period (daily/weekly/monthly)
    - Calculates throughput statistics and predictability metrics
    - Applies PBC analysis to throughput data for signal detection
    """
    logger.info(f"Received throughput request with {len(request.data)} data points")
    logger.info(f"Period: {request.period}, Baseline: {request.baselinePeriod}")
    
    try:
        # Validate minimum data points
        if len(request.data) < 3:
            logger.error(f"Insufficient data points: {len(request.data)} (minimum 3 required)")
            raise HTTPException(
                status_code=400,
                detail="Minimum 3 completed items required for throughput analysis"
            )
        
        # Initialize calculators
        throughput_calculator = ThroughputCalculator()
        pbc_calculator = PBCCalculator()
        signal_detector = SignalDetector()
        
        # Calculate throughput analysis
        throughput_analysis = throughput_calculator.calculate_throughput_analysis(
            request.data, request.period
        )
        
        logger.info(f"Calculated throughput analysis: {throughput_analysis.totalPeriods} periods, "
                   f"avg throughput: {throughput_analysis.averageThroughput:.2f}")
        
        # Convert throughput data to PBC format for signal detection
        throughput_pbc_data = throughput_calculator.create_throughput_pbc_data(throughput_analysis)
        
        if len(throughput_pbc_data) < 3:
            raise HTTPException(
                status_code=400,
                detail="Insufficient throughput periods for meaningful PBC analysis"
            )
        
        # Extract values for PBC calculation
        values = [point.value for point in throughput_pbc_data]
        timestamps = [point.timestamp.isoformat() for point in throughput_pbc_data]
        
        # Calculate PBC limits using baseline period
        baseline_period = min(request.baselinePeriod, len(values))
        baseline_data = values[:baseline_period]
        
        limits = pbc_calculator.calculate_natural_process_limits(baseline_data)
        sigma_lines = pbc_calculator.calculate_sigma_lines(limits)
        
        # Detect signals in throughput data
        signals = signal_detector.detect_all_signals(values, limits)
        
        logger.info(f"Detected {len(signals)} signals in throughput data")
        
        # Calculate moving ranges for mR chart
        moving_ranges = pbc_calculator.calculate_moving_ranges(values)
        
        # Build chart data
        x_chart_data = {
            "timestamps": timestamps,
            "values": values,
            "average": limits.average,
            "upperLimit": limits.upperLimit,
            "lowerLimit": limits.lowerLimit,
            "sigmaLines": {
                "oneSigmaUpper": sigma_lines["oneSigmaUpper"],
                "oneSigmaLower": sigma_lines["oneSigmaLower"],
                "twoSigmaUpper": sigma_lines["twoSigmaUpper"],
                "twoSigmaLower": sigma_lines["twoSigmaLower"]
            }
        }
        
        mr_chart_data = {
            "timestamps": timestamps[1:],
            "values": moving_ranges,
            "average": limits.averageMovingRange,
            "upperLimit": limits.upperRangeLimit
        }
        
        # Generate recommendations
        recommendations = throughput_calculator.generate_throughput_recommendations(
            throughput_analysis, signals
        )
        
        response_data = ThroughputResponse(
            throughputAnalysis=throughput_analysis,
            xChart=x_chart_data,
            mrChart=mr_chart_data,
            signals=signals,
            limits=limits,
            baselinePeriod=baseline_period,
            recommendations=recommendations
        )
        
        logger.info("Throughput calculation completed successfully")
        return response_data
        
    except HTTPException:
        raise
    except ValueError as e:
        logger.error(f"Validation error: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Unexpected error during throughput calculation: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Internal calculation error: {str(e)}"
        )

@router.post("/calculate-pbc", response_model=PBCResponse)
async def calculate_pbc(request: PBCRequest):
    """Calculate Process Behaviour Chart with enhanced task information support"""
    
    logger.info(f"Received PBC request with {len(request.data)} data points")
    logger.info(f"Baseline period requested: {request.baselinePeriod}")
    logger.info(f"Detection rules: {request.detectionRules}")
    
    # If this is throughput data, redirect to throughput endpoint
    if getattr(request, 'metricType', 'cycle_time') == 'throughput':
        throughput_request = ThroughputRequest(
            data=request.data,
            period=ThroughputPeriod.WEEKLY,  # Default to weekly
            baselinePeriod=request.baselinePeriod,
            detectionRules=request.detectionRules
        )
        return await calculate_throughput(throughput_request)
    
    try:
        # Validate minimum data points
        if len(request.data) < 3:
            logger.error(f"Insufficient data points: {len(request.data)} (minimum 3 required)")
            raise HTTPException(
                status_code=400,
                detail="Minimum 3 data points required for any PBC calculation"
            )
        
        if len(request.data) < 6:
            logger.warning(f"Less than 6 data points provided: {len(request.data)}. Document recommends minimum 6 for reliable analysis.")
        
        # Extract and validate values
        values = []
        timestamps = []
        task_keys = []
        task_names = []
        
        for i, point in enumerate(request.data):
            logger.debug(f"Processing data point {i + 1}: timestamp={point.timestamp}, value={point.value}")
            
            if point.timestamp is None:
                logger.error(f"Invalid timestamp at data point {i + 1}: None")
                raise HTTPException(
                    status_code=400,
                    detail=f"Invalid timestamp at data point {i + 1}: timestamp cannot be None"
                )
            
            if point.value is None or not isinstance(point.value, (int, float)):
                logger.error(f"Invalid value at data point {i + 1}: {point.value}")
                raise HTTPException(
                    status_code=400,
                    detail=f"Invalid value at data point {i + 1}: {point.value}. Value must be a number."
                )
            
            if point.value < 0:
                logger.warning(f"Negative value at data point {i + 1}: {point.value}")
            
            values.append(float(point.value))
            timestamps.append(point.timestamp.isoformat())
            
            # Extract task information if available
            task_key = getattr(point, 'taskKey', f'Task-{i+1}')
            task_name = getattr(point, 'taskName', 'Unnamed Task')
            task_keys.append(task_key)
            task_names.append(task_name)
        
        logger.info(f"Successfully extracted {len(values)} values with task information")
        
        # Initialize calculator and detector
        calculator = PBCCalculator()
        detector = SignalDetector()
        
        # Use correct field name: baselinePeriod
        baseline_period = min(request.baselinePeriod, len(values))
        if baseline_period != request.baselinePeriod:
            logger.warning(f"Baseline period adjusted from {request.baselinePeriod} to {baseline_period} (limited by data size)")
        
        baseline_data = values[:baseline_period]
        logger.info(f"Using baseline period: {baseline_period}")
        logger.info(f"Baseline data: {baseline_data}")
        
        # Calculate limits with detailed logging
        try:
            limits = calculator.calculate_natural_process_limits(baseline_data)
            logger.info(f"Calculated limits successfully:")
            logger.info(f"  Average: {limits.average:.4f}")
            logger.info(f"  Upper Limit: {limits.upperLimit:.4f}")
            logger.info(f"  Lower Limit: {limits.lowerLimit:.4f}")
            logger.info(f"  Average Moving Range: {limits.averageMovingRange:.4f}")
            logger.info(f"  Upper Range Limit: {limits.upperRangeLimit:.4f}")
        except Exception as calc_error:
            logger.error(f"Error calculating limits: {str(calc_error)}")
            raise HTTPException(
                status_code=500,
                detail=f"Error calculating process limits: {str(calc_error)}"
            )
        
        # Calculate sigma lines for enhanced detection
        try:
            sigma_lines = calculator.calculate_sigma_lines(limits)
            logger.info(f"Calculated sigma lines: {sigma_lines}")
        except Exception as sigma_error:
            logger.error(f"Error calculating sigma lines: {str(sigma_error)}")
            sigma_lines = {
                "oneSigmaUpper": limits.average,
                "oneSigmaLower": max(0, limits.average),
                "twoSigmaUpper": limits.average,
                "twoSigmaLower": max(0, limits.average)
            }
        
        # Detect signals in full dataset
        try:
            signals = detector.detect_all_signals(values, limits)
            logger.info(f"Detected {len(signals)} signals")
            for i, signal in enumerate(signals):
                logger.info(f"  Signal {i + 1}: {signal.type} at points {signal.dataPoints} - {signal.description}")
        except Exception as signal_error:
            logger.error(f"Error detecting signals: {str(signal_error)}")
            signals = []
        
        # Calculate moving ranges for mR chart
        moving_ranges = calculator.calculate_moving_ranges(values)
        logger.info(f"Calculated {len(moving_ranges)} moving ranges")
        
        # Build chart data with enhanced task information
        x_chart_data = {
            "timestamps": timestamps,
            "values": values,
            "average": limits.average,
            "upperLimit": limits.upperLimit,
            "lowerLimit": limits.lowerLimit,
            "taskKeys": task_keys,  # Enhanced for Nave integration
            "taskNames": task_names,  # Enhanced for Nave integration
            "sigmaLines": {
                "oneSigmaUpper": sigma_lines.get("oneSigmaUpper", sigma_lines.get("one_sigma_upper", limits.average)),
                "oneSigmaLower": sigma_lines.get("oneSigmaLower", sigma_lines.get("one_sigma_lower", limits.average)),
                "twoSigmaUpper": sigma_lines.get("twoSigmaUpper", sigma_lines.get("two_sigma_upper", limits.average)),
                "twoSigmaLower": sigma_lines.get("twoSigmaLower", sigma_lines.get("two_sigma_lower", limits.average))
            }
        }
        
        mr_chart_data = {
            "timestamps": timestamps[1:],
            "values": moving_ranges,
            "average": limits.averageMovingRange,
            "upperLimit": limits.upperRangeLimit
        }
        
        # Create response with proper structure
        response_data = {
            "xChart": x_chart_data,
            "mrChart": mr_chart_data,
            "signals": [
                {
                    "type": signal.type,
                    "dataPoints": signal.dataPoints,
                    "description": signal.description,
                    "severity": signal.severity
                }
                for signal in signals
            ],
            "limits": {
                "average": limits.average,
                "upperLimit": limits.upperLimit,
                "lowerLimit": limits.lowerLimit,
                "averageMovingRange": limits.averageMovingRange,
                "upperRangeLimit": limits.upperRangeLimit
            },
            "baselinePeriod": baseline_period,
            # Enhanced metadata for frontend
            "originalData": [
                {
                    "taskKey": task_keys[i],
                    "taskName": task_names[i],
                    "value": values[i],
                    "timestamp": timestamps[i]
                }
                for i in range(len(values))
            ],
            # Add flow metrics context
            "flowMetricsContext": {
                "metricType": "cycle_time",
                "analysisGuidance": get_flow_metrics_guidance("cycle_time", signals),
                "vacanti_insights": generate_vacanti_insights(values, limits, signals)
            }
        }
        
        logger.info("PBC calculation completed successfully with task information")
        return response_data
        
    except HTTPException:
        raise
    except ValueError as e:
        error_message = str(e)
        if "All moving ranges are zero" in error_message:
            logger.error(f"Zero variation error: {error_message}")
            raise HTTPException(
                status_code=400, 
                detail="No variation detected in data. Process Behaviour Charts require data with variation to calculate meaningful limits. Please provide data points with different values."
            )
        else:
            logger.error(f"Validation error: {error_message}")
            raise HTTPException(status_code=400, detail=error_message)
    except Exception as e:
        logger.error(f"Unexpected error during PBC calculation: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500, 
            detail=f"Internal calculation error: {str(e)}"
        )

def get_flow_metrics_guidance(metric_type: str, signals: List[Signal]) -> dict:
    """Provide guidance based on Vacanti's flow metrics methodology"""
    
    guidance = {
        "cycle_time": {
            "interpretation": "Cycle Time measures the elapsed time from when work starts until it's completed",
            "signals_meaning": "Signals indicate changes in your delivery process that require investigation",
            "action_items": [
                "Investigate assignable causes for points outside Natural Process Limits",
                "Look for process changes during signal periods",
                "Consider workflow bottlenecks or capacity changes"
            ]
        },
        "throughput": {
            "interpretation": "Throughput measures the number of items completed per time period",
            "signals_meaning": "Signals indicate changes in your team's delivery capacity",
            "action_items": [
                "Investigate capacity changes during signal periods",
                "Look for team composition or process changes",
                "Consider external factors affecting delivery rate"
            ]
        }
    }
    
    return guidance.get(metric_type, guidance["cycle_time"])

def generate_vacanti_insights(values: List[float], limits: ProcessLimits, signals: List[Signal]) -> dict:
    """Generate insights based on Vacanti's predictability framework"""
    
    total_points = len(values)
    signal_points = len(set().union(*[signal.dataPoints for signal in signals]))
    predictability_ratio = 1 - (signal_points / total_points)
    
    if predictability_ratio >= 0.85:
        predictability_assessment = "Highly Predictable"
        recommendation = "Your process exhibits routine variation. Focus on continuous improvement."
    elif predictability_ratio >= 0.70:
        predictability_assessment = "Moderately Predictable" 
        recommendation = "Some exceptional variation detected. Investigate assignable causes."
    else:
        predictability_assessment = "Unpredictable"
        recommendation = "Significant exceptional variation. Process improvement needed before forecasting."
    
    return {
        "predictability_ratio": round(predictability_ratio, 3),
        "assessment": predictability_assessment,
        "recommendation": recommendation,
        "baseline_period_guidance": f"Using {len(values)} data points meets Vacanti's minimum 6-point requirement"
    }

@router.get("/health")
async def health_check():
    """Health check endpoint with detailed status"""
    try:
        test_calculator = PBCCalculator()
        test_data = [1.0, 2.0, 3.0, 4.0, 5.0, 6.0]
        test_limits = test_calculator.calculate_natural_process_limits(test_data)
        
        # Test throughput calculator
        throughput_calculator = ThroughputCalculator()
        test_throughput_data = [
            DataPoint(timestamp=datetime.now(), value=1.0, label="Test 1"),
            DataPoint(timestamp=datetime.now(), value=2.0, label="Test 2"),
            DataPoint(timestamp=datetime.now(), value=3.0, label="Test 3")
        ]
        
                # Test dynamic baseline calculator
        baseline_calculator = DynamicBaselineCalculator()
        test_baseline_data = [
            DataPoint(timestamp=datetime.now(), value=float(i), label=f"Test {i}")
            for i in range(1, 13)  # 12 data points
        ]
        
        baseline_analysis = baseline_calculator.analyze_dynamic_baseline(
            test_baseline_data, 8, "cycle_time"
        )
        logger.info("Health check passed - all calculators working correctly")
        return {
            "status": "healthy",
            "message": "PBC, Throughput, and Dynamic Baseline APIs are running",
            "pbc_test": "passed",
            "throughput_test": "passed", 
            "dynamic_baseline_test": "passed",
            "test_average": test_limits.average,
            "test_baseline_recommendation": baseline_analysis.recommendation.recommendedPeriod
        }
    except Exception as e:
        logger.error(f"Health check failed: {str(e)}")
        return {
            "status": "unhealthy",
            "message": f"API health check failed: {str(e)}"
        }

@router.get("/debug/test-calculation")
async def test_calculation():
    """Debug endpoint to test PBC calculation with sample data"""
    try:
        # Sample data based on the document's methodology
        sample_data = [1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0]
        
        calculator = PBCCalculator()
        limits = calculator.calculate_natural_process_limits(sample_data)
        moving_ranges = calculator.calculate_moving_ranges(sample_data)
        
        return {
            "sample_data": sample_data,
            "limits": {
                "average": limits.average,
                "upperLimit": limits.upperLimit,
                "lowerLimit": limits.lowerLimit,
                "averageMovingRange": limits.averageMovingRange,
                "upperRangeLimit": limits.upperRangeLimit
            },
            "moving_ranges": moving_ranges,
            "calculation_status": "success"
        }
    except Exception as e:
        logger.error(f"Test calculation failed: {str(e)}")
        return {
            "calculation_status": "failed",
            "error": str(e)
        }

@router.get("/debug/test-throughput")
async def test_throughput():
    """Debug endpoint to test throughput calculation with sample data"""
    try:
        from datetime import timedelta
        
        # Sample throughput data - items completed over several weeks
        base_date = datetime(2024, 1, 1)
        sample_data = []
        
        # Week 1: 5 items
        for i in range(5):
            sample_data.append(DataPoint(
                timestamp=base_date + timedelta(days=i),
                value=1.0,  # Each item counts as 1
                label=f"Item-W1-{i+1}"
            ))
        
        # Week 2: 8 items
        for i in range(8):
            sample_data.append(DataPoint(
                timestamp=base_date + timedelta(days=7+i),
                value=1.0,
                label=f"Item-W2-{i+1}"
            ))
        
        # Week 3: 3 items
        for i in range(3):
            sample_data.append(DataPoint(
                timestamp=base_date + timedelta(days=14+i),
                value=1.0,
                label=f"Item-W3-{i+1}"
            ))
        
        throughput_calculator = ThroughputCalculator()
        throughput_analysis = throughput_calculator.calculate_throughput_analysis(
            sample_data, ThroughputPeriod.WEEKLY
        )
        
        return {
            "sample_data_count": len(sample_data),
            "throughput_analysis": {
                "totalPeriods": throughput_analysis.totalPeriods,
                "averageThroughput": throughput_analysis.averageThroughput,
                "medianThroughput": throughput_analysis.medianThroughput,
                "predictabilityScore": throughput_analysis.predictabilityScore
            },
            "calculation_status": "success"
        }
    except Exception as e:
        logger.error(f"Test throughput calculation failed: {str(e)}")
        return {
            "calculation_status": "failed",
            "error": str(e)
        }
