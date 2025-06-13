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
import SignalDetector from './components/analysis/SignalDetector';
import { DataPoint, ChartConfiguration, PBCAnalysis } from './types';
import { calculatePBC } from './services/api';
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [config, setConfig] = useState<ChartConfiguration | null>(null);
  const [originalData, setOriginalData] = useState<DataPoint[]>([]);

  const handleDataSubmit = async (data: DataPoint[], chartConfig: ChartConfiguration) => {
    setLoading(true);
    setError(null);
    setConfig(chartConfig);
    setOriginalData(data); // Store original data for chart tooltips
    
    try {
      console.log('Submitting data:', data);
      console.log('Chart configuration:', chartConfig);
      
      // Validate data before sending
      if (!data || data.length === 0) {
        throw new Error('No data provided');
      }

      if (data.length < 3) {
        throw new Error('Minimum 3 data points required for PBC calculation');
      }

      // Ensure chronological ordering (Vacanti's requirement)
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
      
      const result = await calculatePBC({
        data: sortedData,
        baselinePeriod: chartConfig.baselinePeriod,
        detectionRules: chartConfig.detectionRules
      });
      
      console.log('Received result:', result);
      
      // Validate the response structure
      if (!result) {
        throw new Error('No response received from server');
      }

      if (!result.xChart) {
        throw new Error('Invalid response structure: missing xChart');
      }

      if (!result.xChart.timestamps) {
        throw new Error('Invalid response structure: missing xChart.timestamps');
      }

      if (!result.mrChart) {
        throw new Error('Invalid response structure: missing mrChart');
      }

      if (!result.signals) {
        throw new Error('Invalid response structure: missing signals');
      }

      console.log('Response validation passed');
      
      setAnalysis(result);
    } catch (err: any) {
      console.error('Error details:', err);
      
      let errorMessage = 'Failed to calculate PBC';
      
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
              Calculating Process Behaviour Chart using Vacanti's XmR methodology...
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

        {analysis && config && !loading && !error && (
          <>
            <Box sx={{ mb: 3 }}>
              <Typography variant="h4" gutterBottom>
                Flow Metrics Analysis Results
              </Typography>
              <Typography variant="body2" color="textSecondary">
                Baseline Period: {analysis.baselinePeriod} data points | 
                Detection Rules: {config.detectionRules.join(', ').toUpperCase()} | 
                Signals Detected: {analysis.signals.length}
              </Typography>
              <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
                Filtered data: Only "Done" tasks included, "Won't fix" excluded | 
                Enhanced tooltips available for both X and mR charts
              </Typography>
            </Box>
            
            <PBCChart 
              analysis={analysis} 
              showSigmaLines={config.showSigmaLines}
              title="Nave Flow Metrics - Process Behaviour Chart (XmR)"
              originalData={originalData} // Pass original data for enhanced tooltips
            />
            
            {/* Separate SignalDetector component with better spacing */}
            <Box sx={{ mt: 4 }}>
              <SignalDetector signals={analysis.signals} />
            </Box>
          </>
        )}

        {!analysis && !loading && !error && (
          <Box sx={{ textAlign: 'center', mt: 6, mb: 4 }}>
            <Typography variant="h5" color="textSecondary" gutterBottom>
              Ready to Analyze Your Flow Metrics
            </Typography>
            <Typography variant="body1" color="textSecondary">
              Upload your Nave CSV file or enter data manually to create Process Behaviour Charts.
              Minimum 6 completed tasks recommended for meaningful analysis per Vacanti's guidance.
            </Typography>
            <Typography variant="body2" color="textSecondary" sx={{ mt: 2 }}>
              <strong>Enhanced Features:</strong> Automatic filtering of "Won't fix" items, task-specific tooltips for both charts, and Vacanti-compliant analysis.
            </Typography>
          </Box>
        )}
      </Container>
    </ThemeProvider>
  );
}

export default App;
