import React from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ChartOptions,
} from 'chart.js';
import { Box, Typography, Grid, Paper, Divider } from '@mui/material';
import { PBCAnalysis, Signal } from '../../types';
import { format } from 'date-fns';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

interface PBCChartProps {
  analysis: PBCAnalysis;
  showSigmaLines: boolean;
  title?: string;
  // Enhanced props for Nave integration
  originalData?: any[];
}

// Flow Metrics Insights component based on Vacanti's methodology
const FlowMetricsInsights: React.FC<{ analysis: PBCAnalysis }> = ({ analysis }) => {
  const context = (analysis as any).flowMetricsContext;
  
  if (!context) return null;
  
  return (
    <Paper elevation={2} sx={{ mt: 3, p: 3 }}>
      <Typography variant="h6" gutterBottom>
        Flow Metrics Analysis (Vacanti Methodology)
      </Typography>
      
      <Typography variant="body2" paragraph>
        <strong>Metric Type:</strong> {context.metricType.replace('_', ' ').toUpperCase()}
      </Typography>
      
      <Typography variant="body2" paragraph>
        {context.analysisGuidance.interpretation}
      </Typography>
      
      {context.vacanti_insights && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="subtitle2">
            Predictability Assessment: {context.vacanti_insights.assessment}
          </Typography>
          <Typography variant="body2">
            {context.vacanti_insights.recommendation}
          </Typography>
        </Box>
      )}
    </Paper>
  );
};

const PBCChart: React.FC<PBCChartProps> = ({ 
  analysis, 
  showSigmaLines = false,
  title = "Process Behaviour Chart (XmR)",
  originalData = []
}) => {
  const { xChart, mrChart, signals } = analysis;

  // Create signal point colors based on detection rules from the document
  const getPointColors = (dataLength: number, signals: Signal[]) => {
    const colors = new Array(dataLength).fill('#2196F3');
    
    signals.forEach(signal => {
      signal.dataPoints.forEach(pointIndex => {
        if (pointIndex < colors.length) {
          // Color coding based on detection rule severity as per Vacanti's methodology
          colors[pointIndex] = signal.severity === 'high' ? '#f44336' : 
                             signal.severity === 'moderate' ? '#ff9800' : '#ff5722';
        }
      });
    });
    
    return colors;
  };

  // Enhanced tooltip configuration for both X and mR charts
  const createTooltipCallbacks = (chartType: 'x' | 'mr') => ({
    title: function(context: any) {
      const pointIndex = context[0].dataIndex;
      const timestamp = context[0].label;
      
      // For mR chart, we need to adjust the index since it has one less data point
      const dataIndex = chartType === 'mr' ? pointIndex + 1 : pointIndex;
      
      if (originalData && originalData[dataIndex]) {
        const task = originalData[dataIndex];
        return `${timestamp} - ${task.taskKey || 'Unknown Task'}`;
      }
      
      return timestamp || '';
    },
    label: function(context: any) {
      const pointIndex = context.dataIndex;
      const value = context.parsed.y;
      const datasetLabel = context.dataset.label;
      
      // For mR chart, adjust the index
      const dataIndex = chartType === 'mr' ? pointIndex + 1 : pointIndex;
      
      // Enhanced label based on chart type
      if (datasetLabel === 'Individual Values' || datasetLabel === 'Moving Range') {
        if (originalData && originalData[dataIndex]) {
          const task = originalData[dataIndex];
          
          if (chartType === 'x') {
            return [
              `${datasetLabel}: ${value.toFixed(2)} days`,
              `Task: ${task.taskKey || 'Unknown'}`,
              `Name: ${task.taskName || 'Unnamed Task'}`,
              `Cycle Time: ${value.toFixed(1)} days`
            ];
          } else {
            // For mR chart, show the moving range between current and previous task
            const prevTask = originalData[dataIndex - 1];
            return [
              `${datasetLabel}: ${value.toFixed(2)} days`,
              `Between: ${prevTask?.taskKey || 'Unknown'} → ${task.taskKey || 'Unknown'}`,
              `Current Task: ${task.taskName || 'Unnamed Task'}`,
              `Range: ${value.toFixed(2)} days difference`
            ];
          }
        } else {
          return `${datasetLabel}: ${value.toFixed(2)} days`;
        }
      }
      
      return `${datasetLabel}: ${value.toFixed(2)}`;
    },
    afterLabel: function(context: any) {
      // Add signal information to tooltips based on detection rules
      const pointIndex = context.dataIndex;
      const dataIndex = chartType === 'mr' ? pointIndex + 1 : pointIndex;
      
      const relevantSignals = signals.filter(signal => 
        signal.dataPoints.includes(dataIndex)
      );
      
      if (relevantSignals.length > 0) {
        return relevantSignals.map(signal => 
          `🚨 Signal: ${signal.type.toUpperCase()} - ${signal.description}`
        );
      }
      return [];
    }
  });

  // X Chart (Individual Values Chart) configuration implementing Shewhart's formulas
  const xChartData = {
    labels: xChart.timestamps.map(ts => format(new Date(ts), 'MM/dd/yyyy')),
    datasets: [
      {
        label: 'Individual Values',
        data: xChart.values,
        borderColor: '#2196F3',
        backgroundColor: 'transparent',
        pointBackgroundColor: getPointColors(xChart.values.length, signals),
        pointBorderColor: getPointColors(xChart.values.length, signals),
        pointRadius: 4,
        tension: 0,
        fill: false
      },
      {
        label: 'Average (Center Line)',
        data: Array(xChart.values.length).fill(xChart.average),
        borderColor: '#4CAF50',
        borderDash: [5, 5],
        pointRadius: 0,
        tension: 0,
        fill: false
      },
      {
        label: 'Upper Natural Process Limit (UNPL)',
        data: Array(xChart.values.length).fill(xChart.upperLimit),
        borderColor: '#f44336',
        borderDash: [10, 5],
        pointRadius: 0,
        tension: 0,
        fill: false
      },
      {
        label: 'Lower Natural Process Limit (LNPL)',
        data: Array(xChart.values.length).fill(xChart.lowerLimit),
        borderColor: '#f44336',
        borderDash: [10, 5],
        pointRadius: 0,
        tension: 0,
        fill: false
      }
    ]
  };

  // Add sigma lines if requested (for Western Electric Zone Tests)
  if (showSigmaLines && xChart.sigmaLines) {
    xChartData.datasets.push(
      {
        label: '2-Sigma Upper',
        data: Array(xChart.values.length).fill(xChart.sigmaLines.twoSigmaUpper),
        borderColor: '#FF9800',
        borderDash: [3, 3],
        pointRadius: 0,
        tension: 0,
        fill: false
      },
      {
        label: '2-Sigma Lower', 
        data: Array(xChart.values.length).fill(xChart.sigmaLines.twoSigmaLower),
        borderColor: '#FF9800',
        borderDash: [3, 3],
        pointRadius: 0,
        tension: 0,
        fill: false
      },
      {
        label: '1-Sigma Upper',
        data: Array(xChart.values.length).fill(xChart.sigmaLines.oneSigmaUpper),
        borderColor: '#9C27B0',
        borderDash: [2, 2],
        pointRadius: 0,
        tension: 0,
        fill: false
      },
      {
        label: '1-Sigma Lower',
        data: Array(xChart.values.length).fill(xChart.sigmaLines.oneSigmaLower),
        borderColor: '#9C27B0',
        borderDash: [2, 2],
        pointRadius: 0,
        tension: 0,
        fill: false
      }
    );
  }

  // mR Chart (Moving Range Chart) configuration with enhanced tooltips
  const mrChartData = {
    labels: mrChart.timestamps.map(ts => format(new Date(ts), 'MM/dd/yyyy')),
    datasets: [
      {
        label: 'Moving Range',
        data: mrChart.values,
        borderColor: '#673AB7',
        backgroundColor: 'transparent',
        pointBackgroundColor: '#673AB7',
        pointRadius: 4, // Increased for better visibility
        tension: 0,
        fill: false
      },
      {
        label: 'Average Moving Range',
        data: Array(mrChart.values.length).fill(mrChart.average),
        borderColor: '#4CAF50',
        borderDash: [5, 5],
        pointRadius: 0,
        tension: 0,
        fill: false
      },
      {
        label: 'Upper Range Limit (URL)',
        data: Array(mrChart.values.length).fill(mrChart.upperLimit),
        borderColor: '#f44336',
        borderDash: [10, 5],
        pointRadius: 0,
        tension: 0,
        fill: false
      }
    ]
  };

  const xChartOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          filter: function(item, chart) {
            if (!showSigmaLines && item.text?.includes('Sigma')) {
              return false;
            }
            return true;
          }
        }
      },
      tooltip: {
        mode: 'index',
        intersect: false,
        callbacks: createTooltipCallbacks('x')
      },
    },
    scales: {
      x: {
        display: true,
        title: {
          display: true,
          text: 'Completion Date'
        }
      },
      y: {
        display: true,
        title: {
          display: true,
          text: 'Cycle Time (Days)'
        }
      }
    },
    interaction: {
      mode: 'nearest',
      axis: 'x',
      intersect: false
    }
  };

  const mrChartOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      tooltip: {
        mode: 'index',
        intersect: false,
        callbacks: createTooltipCallbacks('mr')
      },
    },
    scales: {
      x: {
        display: true,
        title: {
          display: true,
          text: 'Completion Date'
        }
      },
      y: {
        display: true,
        title: {
          display: true,
          text: 'Moving Range (Days)'
        }
      }
    },
    interaction: {
      mode: 'nearest',
      axis: 'x',
      intersect: false
    }
  };

  return (
    <Box sx={{ width: '100%', mb: 4 }}>
      <Typography variant="h4" component="h3" align="center" gutterBottom>
        {title}
      </Typography>
      
      {/* X Chart (Individual Values) */}
      <Paper elevation={2} sx={{ p: 3, mb: 4 }}>
        <Typography variant="h5" component="h4" align="center" gutterBottom>
          Individual Values Chart (X Chart) - Cycle Time Analysis
        </Typography>
        <Box sx={{ height: '400px' }}>
          <Line data={xChartData} options={xChartOptions} />
        </Box>
      </Paper>
      
      {/* mR Chart (Moving Range) */}
      <Paper elevation={2} sx={{ p: 3, mb: 4 }}>
        <Typography variant="h5" component="h4" align="center" gutterBottom>
          Moving Range Chart (mR Chart) - Process Variation
        </Typography>
        <Box sx={{ height: '350px' }}>
          <Line data={mrChartData} options={mrChartOptions} />
        </Box>
      </Paper>

      {/* Flow Metrics Insights Component */}
      <FlowMetricsInsights analysis={analysis} />

      {/* Enhanced Signal Summary with better layout */}
      {signals.length > 0 && (
        <Paper elevation={2} sx={{ p: 3, mt: 3 }}>
          <Typography variant="h5" gutterBottom>
            Process Behaviour Analysis: {signals.length} Signal(s) Detected
          </Typography>
          
          <Typography variant="body2" color="text.secondary" paragraph>
            <strong>Signal Detection Rules (Western Electric Zone Tests):</strong>
          </Typography>
          
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={4}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box sx={{ width: 12, height: 12, bgcolor: '#f44336', borderRadius: '50%' }} />
                <Typography variant="body2">Rule 1 - Outside Limits (High)</Typography>
              </Box>
            </Grid>
            <Grid item xs={12} sm={4}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box sx={{ width: 12, height: 12, bgcolor: '#ff9800', borderRadius: '50%' }} />
                <Typography variant="body2">Rules 2-3 - Patterns (Moderate)</Typography>
              </Box>
            </Grid>
            <Grid item xs={12} sm={4}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box sx={{ width: 12, height: 12, bgcolor: '#ff5722', borderRadius: '50%' }} />
                <Typography variant="body2">Rule 4 - Shifts (Low)</Typography>
              </Box>
            </Grid>
          </Grid>
          
          <Typography variant="body2" color="text.secondary" paragraph>
            Signals indicate exceptional variation requiring investigation. Hover over points to see task details.
          </Typography>
        </Paper>
      )}

      {/* Predictability Assessment */}
      {signals.length === 0 && (
        <Paper elevation={2} sx={{ p: 3, mt: 3, bgcolor: 'success.light' }}>
          <Typography variant="h5" color="success.dark" gutterBottom>
            Process Operating Predictably
          </Typography>
          <Typography variant="body1" color="success.dark">
            No signals detected. Your process exhibits only routine variation within Natural Process Limits, 
            indicating predictable performance suitable for forecasting as described in Vacanti's methodology.
          </Typography>
        </Paper>
      )}

      {/* Data Quality Information - Separated and organized */}
      <Paper elevation={1} sx={{ p: 2, mt: 3, bgcolor: 'info.light' }}>
        <Typography variant="h6" color="info.dark" gutterBottom>
          Data Quality Summary
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6} md={3}>
            <Typography variant="body2" color="info.dark">
              ✅ Only "Done" tasks included
            </Typography>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Typography variant="body2" color="info.dark">
              ❌ "Won't fix" tasks excluded
            </Typography>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Typography variant="body2" color="info.dark">
              🎯 Enhanced tooltips with task details
            </Typography>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <Typography variant="body2" color="info.dark">
              📊 {xChart.values.length} data points analyzed
            </Typography>
          </Grid>
        </Grid>
      </Paper>
    </Box>
  );
};

export default PBCChart;
