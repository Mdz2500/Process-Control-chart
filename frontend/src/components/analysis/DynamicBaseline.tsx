import React, { useState } from 'react';
import {
  Paper,
  Typography,
  Box,
  Button,
  Alert,
  Grid,
  Chip,
  LinearProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  List,
  ListItem,
  ListItemText,
  ListItemIcon
} from '@mui/material';
import {
  ExpandMore,
  TrendingUp,
  TrendingDown,
  TrendingFlat,
  CheckCircle,
  Warning,
  Error,
  Info
} from '@mui/icons-material';
import { DataPoint, DynamicBaselineResponse, BaselineStability } from '../../types';
import { analyzeDynamicBaseline } from '../../services/api';

interface DynamicBaselineProps {
  data: DataPoint[];
  currentBaselinePeriod: number;
  metricType: 'cycle_time' | 'throughput';
  onBaselineRecommendation: (newPeriod: number) => void;
}

const DynamicBaseline: React.FC<DynamicBaselineProps> = ({
  data,
  currentBaselinePeriod,
  metricType,
  onBaselineRecommendation
}) => {
  const [analysis, setAnalysis] = useState<DynamicBaselineResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyze = async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await analyzeDynamicBaseline({
        data,
        currentBaselinePeriod,
        metricType,
        minimumPeriod: 6,
        maximumPeriod: 20
      });

      setAnalysis(result);
    } catch (err: any) {
      setError(err.message || 'Failed to analyze dynamic baseline');
    } finally {
      setLoading(false);
    }
  };

  const getStabilityIcon = (stability: BaselineStability) => {
    switch (stability) {
      case 'stable':
        return <CheckCircle color="success" />;
      case 'improving':
        return <TrendingUp color="info" />;
      case 'degrading':
        return <TrendingDown color="warning" />;
      case 'unstable':
        return <Error color="error" />;
      default:
        return <Info />;
    }
  };

  const getStabilityColor = (stability: BaselineStability) => {
    switch (stability) {
      case 'stable':
        return 'success';
      case 'improving':
        return 'info';
      case 'degrading':
        return 'warning';
      case 'unstable':
        return 'error';
      default:
        return 'default';
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'success';
    if (confidence >= 0.6) return 'warning';
    return 'error';
  };

  return (
    <Paper elevation={2} sx={{ p: 3, mt: 3 }}>
      <Typography variant="h5" gutterBottom>
        Dynamic Baseline Analysis
      </Typography>
      
      <Typography variant="body2" color="textSecondary" paragraph>
        Analyze your data to determine the optimal baseline period based on process stability, 
        change detection, and seasonal patterns following Vacanti's methodology.
      </Typography>

      <Box sx={{ mb: 3 }}>
        <Button
          variant="contained"
          onClick={handleAnalyze}
          disabled={loading || data.length < 6}
          sx={{ mr: 2 }}
        >
          {loading ? 'Analyzing...' : 'Analyze Baseline'}
        </Button>
        
        <Typography variant="body2" color="textSecondary" component="span">
          Current baseline: {currentBaselinePeriod} periods | 
          Data points: {data.length} | 
          Metric: {metricType === 'cycle_time' ? 'Cycle Time' : 'Throughput'}
        </Typography>
      </Box>

      {loading && (
        <Box sx={{ mb: 2 }}>
          <LinearProgress />
          <Typography variant="body2" sx={{ mt: 1 }}>
            Analyzing data stability, process changes, and seasonal patterns...
          </Typography>
        </Box>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {analysis && (
        <Box>
          {/* Main Recommendation */}
          <Alert 
            severity={analysis.analysis.recommendation.shouldRecalculate ? 'warning' : 'success'}
            sx={{ mb: 3 }}
          >
            <Typography variant="h6" gutterBottom>
              Baseline Recommendation
            </Typography>
            
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} sm={6}>
                <Box display="flex" alignItems="center" gap={1}>
                  {getStabilityIcon(analysis.analysis.recommendation.stability)}
                  <Typography variant="body1">
                    <strong>Recommended Period:</strong> {analysis.analysis.recommendation.recommendedPeriod} data points
                  </Typography>
                </Box>
              </Grid>
              
              <Grid item xs={12} sm={6}>
                <Box display="flex" gap={1}>
                  <Chip 
                    label={`${(analysis.analysis.recommendation.confidence * 100).toFixed(0)}% Confidence`}
                    color={getConfidenceColor(analysis.analysis.recommendation.confidence)}
                    size="small"
                  />
                  <Chip 
                    label={analysis.analysis.recommendation.stability}
                    color={getStabilityColor(analysis.analysis.recommendation.stability)}
                    size="small"
                  />
                </Box>
              </Grid>
            </Grid>

            {analysis.analysis.recommendation.shouldRecalculate && (
              <Box sx={{ mt: 2 }}>
                <Button
                  variant="contained"
                  color="primary"
                  onClick={() => onBaselineRecommendation(analysis.analysis.recommendation.recommendedPeriod)}
                >
                  Apply Recommended Baseline ({analysis.analysis.recommendation.recommendedPeriod} periods)
                </Button>
              </Box>
            )}
          </Alert>

          {/* Detailed Analysis */}
          <Grid container spacing={3}>
            {/* Process Stability */}
            <Grid item xs={12} md={6}>
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography variant="h6" gutterBottom>
                  Process Stability
                </Typography>
                
                <Box sx={{ mb: 2 }}>
                  <Typography variant="body2" color="textSecondary">
                    Stability Score
                  </Typography>
                  <LinearProgress 
                    variant="determinate" 
                    value={analysis.analysis.dataStabilityScore * 100}
                    sx={{ height: 8, borderRadius: 4 }}
                  />
                  <Typography variant="body2" sx={{ mt: 1 }}>
                    {(analysis.analysis.dataStabilityScore * 100).toFixed(1)}% - {analysis.analysis.recommendation.stability}
                  </Typography>
                </Box>

                <Typography variant="body2" color="textSecondary">
                  Variation Trend: {analysis.analysis.variationTrend}
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  Signal Density: {(analysis.analysis.signalDensity * 100).toFixed(1)}%
                </Typography>
              </Paper>
            </Grid>

            {/* Seasonality Analysis */}
            <Grid item xs={12} md={6}>
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography variant="h6" gutterBottom>
                  Seasonality Analysis
                </Typography>
                
                <Typography variant="body2" sx={{ mb: 1 }}>
                  <strong>Dominant Pattern:</strong> {analysis.analysis.seasonalityAnalysis.dominant_pattern}
                </Typography>
                
                <Typography variant="body2" sx={{ mb: 1 }}>
                  <strong>Weekly Strength:</strong> {(analysis.analysis.seasonalityAnalysis.weekly_strength * 100).toFixed(1)}%
                </Typography>
                
                <Typography variant="body2" sx={{ mb: 1 }}>
                  <strong>Monthly Strength:</strong> {(analysis.analysis.seasonalityAnalysis.monthly_strength * 100).toFixed(1)}%
                </Typography>

                {analysis.analysis.seasonalityAnalysis.patterns_detected.length > 0 && (
                  <Box sx={{ mt: 1 }}>
                    {analysis.analysis.seasonalityAnalysis.patterns_detected.map((pattern, index) => (
                      <Chip key={index} label={pattern} size="small" sx={{ mr: 1 }} />
                    ))}
                  </Box>
                )}
              </Paper>
            </Grid>
          </Grid>

          {/* Process Change Points */}
          {analysis.analysis.processChangePoints.length > 0 && (
            <Paper variant="outlined" sx={{ p: 2, mt: 2 }}>
              <Typography variant="h6" gutterBottom>
                Process Change Points Detected
              </Typography>
              <Typography variant="body2" color="textSecondary" paragraph>
                Significant process changes detected at the following data point indices:
              </Typography>
              <Box>
                {analysis.analysis.processChangePoints.map((point, index) => (
                  <Chip 
                    key={index} 
                    label={`Point ${point}`} 
                    color="warning" 
                    size="small" 
                    sx={{ mr: 1, mb: 1 }} 
                  />
                ))}
              </Box>
            </Paper>
          )}

          {/* Reasoning */}
          <Accordion sx={{ mt: 2 }}>
            <AccordionSummary expandIcon={<ExpandMore />}>
              <Typography variant="h6">Recommendation Reasoning</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <List>
                {analysis.analysis.recommendation.reasoning.map((reason, index) => (
                  <ListItem key={index}>
                    <ListItemIcon>
                      <Info color="primary" />
                    </ListItemIcon>
                    <ListItemText primary={reason} />
                  </ListItem>
                ))}
              </List>
            </AccordionDetails>
          </Accordion>

          {/* Alternative Baselines Comparison */}
          <Accordion sx={{ mt: 1 }}>
            <AccordionSummary expandIcon={<ExpandMore />}>
              <Typography variant="h6">Alternative Baseline Periods</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Period</TableCell>
                      <TableCell align="right">Stability</TableCell>
                      <TableCell align="right">Signal Count</TableCell>
                      <TableCell align="right">Signal Density</TableCell>
                      <TableCell align="right">Limit Range</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {analysis.alternativeBaselines
                      .sort((a, b) => a.period - b.period)
                      .map((baseline) => (
                        <TableRow 
                          key={baseline.period}
                          sx={{ 
                            backgroundColor: baseline.period === analysis.analysis.recommendation.recommendedPeriod 
                              ? 'action.selected' 
                              : 'inherit'
                          }}
                        >
                          <TableCell>
                            {baseline.period}
                            {baseline.period === currentBaselinePeriod && (
                              <Chip label="Current" size="small" sx={{ ml: 1 }} />
                            )}
                            {baseline.period === analysis.analysis.recommendation.recommendedPeriod && (
                              <Chip label="Recommended" color="primary" size="small" sx={{ ml: 1 }} />
                            )}
                          </TableCell>
                          <TableCell align="right">
                            {(baseline.metrics.baseline_stability * 100).toFixed(1)}%
                          </TableCell>
                          <TableCell align="right">{baseline.metrics.signal_count}</TableCell>
                          <TableCell align="right">
                            {(baseline.metrics.signal_density * 100).toFixed(1)}%
                          </TableCell>
                          <TableCell align="right">
                            {(baseline.metrics.upper_limit - baseline.metrics.lower_limit).toFixed(2)}
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </AccordionDetails>
          </Accordion>
        </Box>
      )}

      {!analysis && !loading && (
        <Alert severity="info">
          Click "Analyze Baseline" to get recommendations for optimal baseline period based on your data characteristics.
        </Alert>
      )}
    </Paper>
  );
};

export default DynamicBaseline;
