import React, { useState } from 'react';
import {
  Container,
  Typography,
  Box,
  Alert,
  CircularProgress,
  ThemeProvider,
  createTheme,
  CssBaseline
} from '@mui/material';
import DataInput from './components/data/DataInput';
import PBCChart from './components/charts/PBCChart';
import ThroughputChart from './components/charts/ThroughputChart';
import SignalDetector from './components/analysis/SignalDetector';
import { DataPoint, ChartConfiguration, PBCAnalysis, ThroughputResponse } from './types';
import { calculatePBC, calculateThroughput } from './services/api';
import './App.css';

const theme = createTheme({
  palette: {
    primary: {
      main: '#1976d2',
    },
    secondary: {
      main: '#dc004e',
    },
  },
});

function App() {
  const [analysis, setAnalysis] = useState<PBCAnalysis | null>(null);
  const [throughputAnalysis, setThroughputAnalysis] = useState<ThroughputResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [config, setConfig] = useState<ChartConfiguration | null>(null);
  const [originalData, setOriginalData] = useState<DataPoint[]>([]);

  const handleDataSubmit = async (data: DataPoint[], chartConfig: ChartConfiguration) => {
    setLoading(true);
    setError(null);
    setConfig(chartConfig);
    setOriginalData(data);
    
    // Clear previous analysis
    setAnalysis(null);
    setThroughputAnalysis(null);
    
    try {
      console.log('Submitting data:', data);
      console.log('Chart configuration:', chartConfig);
      
      // Validate data
      if (!data || data.length === 0) {
        throw new Error('No data provided');
      }

      if (data.length < 3) {
        throw new Error('Minimum 3 data points required');
      }

      // Sort data chronologically
      const sortedData = [...data].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

      // Validate each data point
      sortedData.forEach((point, index) => {
        if (!point.timestamp || isNaN(point.timestamp.getTime())) {
          throw new Error(`Invalid timestamp at data point ${index + 1}`);
        }
        if (typeof point.value !== 'number' || isNaN(point.value) || !isFinite(point.value)) {
          throw new Error(`Invalid value at data point ${index + 1}: ${point.value}`);
        }
        if (point.value < 0) {
          throw new Error(`Negative values not allowed at data point ${index + 1}: ${point.value}`);
        }
      });

      console.log('Data validation passed, calling API...');
      
      // Route to appropriate analysis based on metric type
      if (chartConfig.metricType === 'throughput') {
        const result = await calculateThroughput({
          data: sortedData,
          period: chartConfig.throughputPeriod,
          baselinePeriod: chartConfig.baselinePeriod,
          detectionRules: chartConfig.detectionRules
        });
        
        console.log('Received throughput result:', result);
        setThroughputAnalysis(result);
      } else {
        const result = await calculatePBC({
          data: sortedData,
          baselinePeriod: chartConfig.baselinePeriod,
          detectionRules: chartConfig.detectionRules,
          metricType: chartConfig.metricType
        });
        
        console.log('Received PBC result:', result);
        setAnalysis(result);
      }
      
    } catch (err: any) {
      console.error('Error details:', err);
      
      let errorMessage = 'Failed to calculate analysis';
      
      if (err.message) {
        errorMessage = err.message;
      } else if (err.response?.data?.detail) {
        errorMessage = err.response.data.detail;
      } else if (err.response?.status === 400) {
        errorMessage = 'Invalid data provided. Please check your input.';
      } else if (err.response?.status === 500) {
        errorMessage = 'Server error during calculation. Please try again.';
      } else if (err.code === 'ECONNREFUSED') {
        errorMessage = 'Cannot connect to backend server. Please ensure the backend is running on port 8000.';
      } else if (err.code === 'NETWORK_ERROR') {
        errorMessage = 'Network error. Please check your connection.';
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleRetry = () => {
    setError(null);
    setAnalysis(null);
    setThroughputAnalysis(null);
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Box sx={{ mb: 4 }}>
          <Typography variant="h3" component="h1" gutterBottom align="center">
            Process Behaviour Chart Generator
          </Typography>
          <Typography variant="h6" color="textSecondary" align="center">
            Create XmR charts to distinguish between routine variation (noise) and exceptional variation (signal)
          </Typography>
          <Typography variant="body2" color="textSecondary" align="center" sx={{ mt: 2 }}>
            Based on Vacanti's methodology: "Data have no meaning apart from their context"
          </Typography>
        </Box>

        <DataInput onDataSubmit={handleDataSubmit} loading={loading} />

        {loading && (
          <Box display="flex" flexDirection="column" alignItems="center" my={4}>
            <CircularProgress size={60} />
            <Typography variant="body2" sx={{ mt: 2 }}>
              Calculating analysis using Vacanti's methodology...
            </Typography>
          </Box>
        )}

        {error && (
          <Alert 
            severity="error" 
            sx={{ mb: 3 }}
            action={
              <button onClick={handleRetry} style={{ 
                background: 'none', 
                border: 'none', 
                color: 'inherit', 
                textDecoration: 'underline',
                cursor: 'pointer'
              }}>
                Try Again
              </button>
            }
          >
            <Typography variant="subtitle2" gutterBottom>
              Error
            </Typography>
            {error}
          </Alert>
        )}

        {/* Cycle Time Analysis Results */}
        {analysis && config && config.metricType === 'cycle_time' && !loading && !error && (
          <>
            <Box sx={{ mb: 3 }}>
              <Typography variant="h4" gutterBottom>
                Cycle Time Analysis Results
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Baseline Period: {analysis.baselinePeriod} data points | 
                Detection Rules: {config.detectionRules.join(', ').toUpperCase()} | 
                Signals Detected: {analysis.signals.length}
              </Typography>
            </Box>
            
            <PBCChart 
              analysis={analysis} 
              showSigmaLines={config.showSigmaLines}
              title="Cycle Time Analysis - Process Behaviour Chart (XmR)"
              originalData={originalData}
            />
            
            <Box sx={{ mt: 4 }}>
              <SignalDetector signals={analysis.signals} />
            </Box>
          </>
        )}

        {/* Throughput Analysis Results */}
        {throughputAnalysis && config && config.metricType === 'throughput' && !loading && !error && (
          <>
            <Box sx={{ mb: 3 }}>
              <Typography variant="h4" gutterBottom>
                Throughput Analysis Results
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Period: {config.throughputPeriod} | 
                Baseline Period: {throughputAnalysis.baselinePeriod} periods | 
                Signals Detected: {throughputAnalysis.signals.length}
              </Typography>
            </Box>
            
            <ThroughputChart 
              analysis={throughputAnalysis} 
              showSigmaLines={config.showSigmaLines}
              title="Throughput Analysis - Process Behaviour Chart"
            />
            
            <Box sx={{ mt: 4 }}>
              <SignalDetector signals={throughputAnalysis.signals} />
            </Box>
          </>
        )}

        {!analysis && !throughputAnalysis && !loading && !error && (
          <Box sx={{ textAlign: 'center', mt: 6, mb: 4 }}>
            <Typography variant="h5" color="textSecondary" gutterBottom>
              Ready to Analyze Your Flow Metrics
            </Typography>
            <Typography variant="body1" color="textSecondary">
              Upload your Nave CSV file or enter data manually to create Process Behaviour Charts.
              Choose between Cycle Time and Throughput analysis based on your needs.
            </Typography>
            <Typography variant="body2" color="textSecondary" sx={{ mt: 2 }}>
              <strong>Enhanced Features:</strong> Automatic filtering, task-specific tooltips, and Vacanti-compliant analysis.
            </Typography>
          </Box>
        )}
      </Container>
    </ThemeProvider>
  );
}

export default App;
