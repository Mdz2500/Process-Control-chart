from fastapi import APIRouter, HTTPException
from typing import List
import logging
from app.models.data_models import PBCRequest, PBCResponse, DataPoint
from app.services.pbc_calculator import PBCCalculator
from app.services.signal_detector import SignalDetector

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["pbc"])

@router.post("/calculate-pbc", response_model=PBCResponse)
async def calculate_pbc(request: PBCRequest):
    """Calculate Process Behaviour Chart with proper field name handling"""
    
    logger.info(f"Received PBC request with {len(request.data)} data points")
    logger.info(f"Baseline period requested: {request.baselinePeriod}")
    logger.info(f"Detection rules: {request.detectionRules}")
    
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
        
        logger.info(f"Successfully extracted {len(values)} values")
        
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
            logger.info(f"  Upper Limit: {limits.upperLimit:.4f}")  # Use camelCase field name
            logger.info(f"  Lower Limit: {limits.lowerLimit:.4f}")  # Use camelCase field name
            logger.info(f"  Average Moving Range: {limits.averageMovingRange:.4f}")  # Use camelCase field name
            logger.info(f"  Upper Range Limit: {limits.upperRangeLimit:.4f}")  # Use camelCase field name
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
                logger.info(f"  Signal {i + 1}: {signal.type} at points {signal.dataPoints} - {signal.description}")  # Use camelCase field name
        except Exception as signal_error:
            logger.error(f"Error detecting signals: {str(signal_error)}")
            signals = []
        
        # Calculate moving ranges for mR chart
        moving_ranges = calculator.calculate_moving_ranges(values)
        logger.info(f"Calculated {len(moving_ranges)} moving ranges")
        
        # Build chart data with proper structure
        x_chart_data = {
            "timestamps": timestamps,
            "values": values,
            "average": limits.average,
            "upperLimit": limits.upperLimit,  # Use camelCase field name
            "lowerLimit": limits.lowerLimit,  # Use camelCase field name
            "sigmaLines": {
                "oneSigmaUpper": sigma_lines.get("oneSigmaUpper", sigma_lines.get("one_sigma_upper", limits.average)),
                "oneSigmaLower": sigma_lines.get("oneSigmaLower", sigma_lines.get("one_sigma_lower", limits.average)),
                "twoSigmaUpper": sigma_lines.get("twoSigmaUpper", sigma_lines.get("two_sigma_upper", limits.average)),
                "twoSigmaLower": sigma_lines.get("twoSigmaLower", sigma_lines.get("two_sigma_lower", limits.average))
            }
        }
        
        mr_chart_data = {
            "timestamps": timestamps[1:],  # One less timestamp for moving ranges
            "values": moving_ranges,
            "average": limits.averageMovingRange,  # Use camelCase field name
            "upperLimit": limits.upperRangeLimit  # Use camelCase field name
        }
        
        # Create response with proper structure
        response_data = {
            "xChart": x_chart_data,
            "mrChart": mr_chart_data,
            "signals": [
                {
                    "type": signal.type,
                    "dataPoints": signal.dataPoints,  # Use camelCase field name
                    "description": signal.description,
                    "severity": signal.severity
                }
                for signal in signals
            ],
            "limits": {
                "average": limits.average,
                "upperLimit": limits.upperLimit,          # Use camelCase field name
                "lowerLimit": limits.lowerLimit,          # Use camelCase field name
                "averageMovingRange": limits.averageMovingRange,  # Use camelCase field name
                "upperRangeLimit": limits.upperRangeLimit         # Use camelCase field name
            },
            "baselinePeriod": baseline_period  # camelCase for frontend
        }
        
        logger.info("PBC calculation completed successfully")
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

@router.get("/health")
async def health_check():
    """Health check endpoint with detailed status"""
    try:
        test_calculator = PBCCalculator()
        test_data = [1.0, 2.0, 3.0, 4.0, 5.0, 6.0]
        test_limits = test_calculator.calculate_natural_process_limits(test_data)
        
        logger.info("Health check passed - calculator working correctly")
        return {
            "status": "healthy", 
            "message": "PBC API is running",
            "calculator_test": "passed",
            "test_average": test_limits.average
        }
    except Exception as e:
        logger.error(f"Health check failed: {str(e)}")
        return {
            "status": "unhealthy",
            "message": f"PBC API health check failed: {str(e)}"
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
