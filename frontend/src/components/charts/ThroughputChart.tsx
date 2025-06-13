import React from 'react';
import { Line, Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ChartOptions,
} from 'chart.js';
import { Box, Typography, Grid, Paper, Chip, Stack } from '@mui/material';
import { ThroughputResponse, Signal } from '../../types';
import { format } from 'date-fns';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend
);

interface ThroughputChartProps {
  analysis: ThroughputResponse;
  showSigmaLines: boolean;
  title?: string;
}

const ThroughputChart: React.FC<ThroughputChartProps> = ({ 
  analysis, 
  showSigmaLines = false,
  title = "Throughput Analysis - Process Behaviour Chart" 
}) => {
  const { throughputAnalysis, xChart, mrChart, signals, recommendations } = analysis;

  // Create signal point colors
  const getPointColors = (dataLength: number, signals: Signal[]) => {
    const colors = new Array(dataLength).fill('#2196F3');
    
    signals.forEach(signal => {
      signal.dataPoints.forEach(pointIndex => {
        if (pointIndex < colors.length) {
          colors[pointIndex] = signal.severity === 'high' ? '#f44336' : 
                             signal.severity === 'moderate' ? '#ff9800' : '#ff5722';
        }
      });
    });
    
    return colors;
  };

  // Throughput Run Chart (Primary visualization)
  const throughputRunChartData = {
    labels: xChart.timestamps.map(ts => format(new Date(ts), 'MM/dd/yyyy')),
    datasets: [
      {
        label: `Throughput (${throughputAnalysis.period})`,
        data: xChart.values,
        borderColor: '#2196F3',
        backgroundColor: 'rgba(33, 150, 243, 0.1)',
        pointBackgroundColor: getPointColors(xChart.values.length, signals),
        pointBorderColor: getPointColors(xChart.values.length, signals),
        pointRadius: 6,
        tension: 0.1,
        fill: true
      },
      {
        label: 'Average Throughput',
        data: Array(xChart.values.length).fill(xChart.average),
        borderColor: '#4CAF50',
        borderDash: [5, 5],
        pointRadius: 0,
        tension: 0,
        fill: false
      },
      {
        label: 'Upper Natural Process Limit',
        data: Array(xChart.values.length).fill(xChart.upperLimit),
        borderColor: '#f44336',
        borderDash: [10, 5],
        pointRadius: 0,
        tension: 0,
        fill: false
      },
      {
        label: 'Lower Natural Process Limit',
        data: Array(xChart.values.length).fill(xChart.lowerLimit),
        borderColor: '#f44336',
        borderDash: [10, 5],
        pointRadius: 0,
        tension: 0,
        fill: false
      }
    ]
  };

  // Add sigma lines if requested
  if (showSigmaLines && xChart.sigmaLines) {
    throughputRunChartData.datasets.push(
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
      }
    );
  }

  // Throughput Histogram
  const histogramData = {
    labels: [...new Set(xChart.values)].sort((a, b) => a - b).map(v => v.toString()),
    datasets: [
      {
        label: 'Frequency',
        data: [...new Set(xChart.values)].sort((a, b) => a - b).map(value => 
          xChart.values.filter(v => v === value).length
        ),
        backgroundColor: 'rgba(33, 150, 243, 0.6)',
        borderColor: '#2196F3',
        borderWidth: 1
      }
    ]
  };

  const chartOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      tooltip: {
        mode: 'index',
        intersect: false,
        callbacks: {
          title: function(context) {
            const pointIndex = context[0].dataIndex;
            const period = throughputAnalysis.throughputData[pointIndex];
            if (period) {
              return `${format(new Date(period.periodStart), 'MMM dd')} - ${format(new Date(period.periodEnd), 'MMM dd, yyyy')}`;
            }
            return context[0].label || '';
          },
          label: function(context) {
            const pointIndex = context.dataIndex;
            const value = context.parsed.y;
            const datasetLabel = context.dataset.label;
            const period = throughputAnalysis.throughputData[pointIndex];
            
            if (datasetLabel?.includes('Throughput') && period) {
              return [
                `${datasetLabel}: ${value} items`,
                `Completed: ${period.itemsCompleted.slice(0, 3).join(', ')}${period.itemsCompleted.length > 3 ? ` +${period.itemsCompleted.length - 3} more` : ''}`,
                `Period: ${throughputAnalysis.period}`
              ];
            }
            
            return `${datasetLabel}: ${value.toFixed(2)}`;
          },
          afterLabel: function(context) {
            const pointIndex = context.dataIndex;
            const relevantSignals = signals.filter(signal => 
              signal.dataPoints.includes(pointIndex)
            );
            
            if (relevantSignals.length > 0) {
              return relevantSignals.map(signal => 
                `🚨 Signal: ${signal.type.toUpperCase()} - ${signal.description}`
              );
            }
            return [];
          }
        }
      },
    },
    scales: {
      x: {
        display: true,
        title: {
          display: true,
          text: 'Time Period'
        }
      },
      y: {
        display: true,
        title: {
          display: true,
          text: 'Items Completed'
        },
        beginAtZero: true
      }
    }
  };

  const histogramOptions: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        callbacks: {
          label: function(context) {
            return `${context.parsed.y} period(s) with ${context.label} items`;
          }
        }
      }
    },
    scales: {
      x: {
        title: {
          display: true,
          text: 'Items Completed'
        }
      },
      y: {
        title: {
          display: true,
          text: 'Frequency'
        },
        beginAtZero: true
      }
    }
  };

  const getPredictabilityColor = (score: number) => {
    if (score >= 0.8) return 'success';
    if (score >= 0.6) return 'warning';
    return 'error';
  };

  return (
    <Box sx={{ width: '100%', mb: 4 }}>
      <Typography variant="h4" component="h3" align="center" gutterBottom>
        {title}
      </Typography>
      
      {/* Throughput Statistics Summary */}
      <Paper elevation={2} sx={{ p: 3, mb: 4 }}>
        <Typography variant="h5" gutterBottom>
          Throughput Statistics ({throughputAnalysis.period} periods)
        </Typography>
        
        <Grid container spacing={3}>
          <Grid item xs={12} sm={6} md={3}>
            <Box textAlign="center">
              <Typography variant="h4" color="primary">
                {throughputAnalysis.averageThroughput.toFixed(1)}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Average Throughput
              </Typography>
            </Box>
          </Grid>
          
          <Grid item xs={12} sm={6} md={3}>
            <Box textAlign="center">
              <Typography variant="h4" color="secondary">
                {throughputAnalysis.medianThroughput}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Median Throughput
              </Typography>
            </Box>
          </Grid>
          
          <Grid item xs={12} sm={6} md={3}>
            <Box textAlign="center">
              <Typography variant="h4">
                {throughputAnalysis.minThroughput} - {throughputAnalysis.maxThroughput}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Range
              </Typography>
            </Box>
          </Grid>
          
          <Grid item xs={12} sm={6} md={3}>
            <Box textAlign="center">
              <Chip 
                label={`${(throughputAnalysis.predictabilityScore * 100).toFixed(0)}%`}
                color={getPredictabilityColor(throughputAnalysis.predictabilityScore)}
                size="medium"
              />
              <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
                Predictability Score
              </Typography>
            </Box>
          </Grid>
        </Grid>
        
        <Box sx={{ mt: 2 }}>
          <Stack direction="row" spacing={1} flexWrap="wrap">
            <Chip label={`${throughputAnalysis.totalItemsCompleted} total items`} size="small" />
            <Chip label={`${throughputAnalysis.totalPeriods} periods analyzed`} size="small" />
            <Chip label={`${signals.length} signals detected`} size="small" color={signals.length > 0 ? 'warning' : 'success'} />
          </Stack>
        </Box>
      </Paper>
      
      {/* Throughput Run Chart */}
      <Paper elevation={2} sx={{ p: 3, mb: 4 }}>
        <Typography variant="h5" component="h4" gutterBottom>
          Throughput Run Chart - Process Behaviour Analysis
        </Typography>
        <Typography variant="body2" color="textSecondary" paragraph>
          Shows throughput variation over time with Natural Process Limits. Points outside limits indicate exceptional variation requiring investigation.
        </Typography>
        <Box sx={{ height: '400px' }}>
          <Line data={throughputRunChartData} options={chartOptions} />
        </Box>
      </Paper>
      
      {/* Throughput Histogram */}
      <Paper elevation={2} sx={{ p: 3, mb: 4 }}>
        <Typography variant="h5" component="h4" gutterBottom>
          Throughput Histogram - Frequency Distribution
        </Typography>
        <Typography variant="body2" color="textSecondary" paragraph>
          Shows how often specific throughput values occur. Useful for understanding typical delivery capacity.
        </Typography>
        <Box sx={{ height: '300px' }}>
          <Bar data={histogramData} options={histogramOptions} />
        </Box>
      </Paper>

      {/* Moving Range Chart */}
      <Paper elevation={2} sx={{ p: 3, mb: 4 }}>
        <Typography variant="h5" component="h4" gutterBottom>
          Moving Range Chart - Throughput Variation
        </Typography>
        <Typography variant="body2" color="textSecondary" paragraph>
          Shows period-to-period variation in throughput. High moving ranges indicate process instability.
        </Typography>
        <Box sx={{ height: '300px' }}>
          <Line 
            data={{
              labels: mrChart.timestamps.map(ts => format(new Date(ts), 'MM/dd/yyyy')),
              datasets: [
                {
                  label: 'Moving Range',
                  data: mrChart.values,
                  borderColor: '#673AB7',
                  backgroundColor: 'transparent',
                  pointBackgroundColor: '#673AB7',
                  pointRadius: 4,
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
                  label: 'Upper Range Limit',
                  data: Array(mrChart.values.length).fill(mrChart.upperLimit),
                  borderColor: '#f44336',
                  borderDash: [10, 5],
                  pointRadius: 0,
                  tension: 0,
                  fill: false
                }
              ]
            }} 
            options={chartOptions} 
          />
        </Box>
      </Paper>

      {/* Recommendations */}
      {recommendations && recommendations.length > 0 && (
        <Paper elevation={2} sx={{ p: 3, mb: 4 }}>
          <Typography variant="h5" gutterBottom>
            Throughput Analysis Recommendations
          </Typography>
          <Box component="ul" sx={{ pl: 2 }}>
            {recommendations.map((recommendation, index) => (
              <Typography component="li" variant="body2" key={index} sx={{ mb: 1 }}>
                {recommendation}
              </Typography>
            ))}
          </Box>
        </Paper>
      )}

      {/* Signal Summary */}
      {signals.length > 0 && (
        <Paper elevation={2} sx={{ p: 3 }}>
          <Typography variant="h5" gutterBottom>
            Throughput Signals Detected: {signals.length}
          </Typography>
          <Typography variant="body2" color="text.secondary" paragraph>
            Signals in throughput data indicate changes in delivery capacity or process capability.
          </Typography>
          
          <Grid container spacing={2}>
            {signals.map((signal, index) => (
              <Grid item xs={12} sm={6} md={4} key={index}>
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                    <Chip 
                      label={signal.type.toUpperCase()} 
                      size="small" 
                      color={signal.severity === 'high' ? 'error' : signal.severity === 'moderate' ? 'warning' : 'info'}
                    />
                    <Chip label={signal.severity} size="small" />
                  </Stack>
                  <Typography variant="body2" sx={{ mb: 1 }}>
                    {signal.description}
                  </Typography>
                  <Typography variant="caption" color="textSecondary">
                    Periods: {signal.dataPoints.join(', ')}
                  </Typography>
                </Paper>
              </Grid>
            ))}
          </Grid>
        </Paper>
      )}
    </Box>
  );
};

export default ThroughputChart;
