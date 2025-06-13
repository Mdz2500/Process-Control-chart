import React, { useState } from 'react';
import {
  Box,
  Paper,
  Tabs,
  Tab,
  TextField,
  Button,
  Typography,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
  Alert,
  Chip,
  Stack
} from '@mui/material';
import { DataPoint, ChartConfiguration, ThroughputPeriod } from '../../types';
import FileUpload from './FileUpload';
import ManualInput from './ManualInput';

interface DataInputProps {
  onDataSubmit: (data: DataPoint[], config: ChartConfiguration) => void;
  loading: boolean;
}

const DataInput: React.FC<DataInputProps> = ({ onDataSubmit, loading }) => {
  const [tabValue, setTabValue] = useState(0);
  const [data, setData] = useState<DataPoint[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [config, setConfig] = useState<ChartConfiguration>({
    baselinePeriod: 20,
    showSigmaLines: false,
    detectionRules: ['rule1', 'rule4'],
    timeFormat: 'MM/dd/yyyy',
    metricType: 'cycle_time',
    throughputPeriod: 'weekly' as ThroughputPeriod
  });

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleDataChange = (newData: DataPoint[]) => {
    setData(newData);
    setError(null);
  };

  const handleConfigChange = (key: keyof ChartConfiguration, value: any) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  // Enhanced validation for both cycle time and throughput
  const validateData = (data: DataPoint[]): string | null => {
    if (data.length < 3) {
      return "Minimum 3 data points required";
    }
    
    if (config.metricType === 'cycle_time' && data.length < 6) {
      return "Warning: Less than 6 data points may produce unreliable results for cycle time analysis.";
    }
    
    if (config.metricType === 'throughput' && data.length < 10) {
      return "Warning: Less than 10 completed items recommended for reliable throughput analysis.";
    }
    
    // Validate data points
    for (let i = 0; i < data.length; i++) {
      const point = data[i];
      
      if (isNaN(point.value) || !isFinite(point.value)) {
        return `Invalid value at data point ${i + 1}: ${point.value}`;
      }
      
      if (point.value < 0) {
        return `Negative values not allowed at data point ${i + 1}: ${point.value}`;
      }
      
      if (isNaN(point.timestamp.getTime())) {
        return `Invalid timestamp at data point ${i + 1}`;
      }
    }
    
    // Check for meaningful variation
    const values = data.map(p => p.value);
    const range = Math.max(...values) - Math.min(...values);
    const average = values.reduce((sum, val) => sum + val, 0) / values.length;
    
    if (range / average < 0.001) {
      return "Warning: Very low variation detected. Results may not be meaningful for process analysis.";
    }
    
    return null;
  };

  const handleSubmit = () => {
    let processedData = [...data];
    
    // Ensure chronological ordering
    processedData.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    
    const validationError = validateData(processedData);
    
    if (validationError && validationError.includes('Error')) {
      setError(validationError);
      return;
    }
    
    if (validationError && validationError.includes('Warning')) {
      setError(validationError);
    }
    
    if (processedData.length >= 3) {
      onDataSubmit(processedData, config);
    }
  };

  const getMetricDescription = () => {
    if (config.metricType === 'cycle_time') {
      return "Cycle Time measures the elapsed time from when work starts until completion. Ideal for understanding delivery predictability.";
    } else {
      return "Throughput measures the number of work items completed per time period. Essential for capacity planning and forecasting.";
    }
  };

  return (
    <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
      <Typography variant="h5" gutterBottom>
        Flow Metrics Analysis - Data Input & Configuration
      </Typography>
      
      {/* Metric Type Selection */}
      <Box sx={{ mb: 3 }}>
        <FormControl fullWidth sx={{ mb: 2 }}>
          <InputLabel>Flow Metric Type</InputLabel>
          <Select
            value={config.metricType}
            onChange={(e) => handleConfigChange('metricType', e.target.value)}
          >
            <MenuItem value="cycle_time">Cycle Time Analysis</MenuItem>
            <MenuItem value="throughput">Throughput Analysis</MenuItem>
          </Select>
        </FormControl>
        
        <Alert severity="info" sx={{ mb: 2 }}>
          <Typography variant="body2">
            <strong>{config.metricType === 'cycle_time' ? 'Cycle Time' : 'Throughput'} Analysis:</strong> {getMetricDescription()}
          </Typography>
        </Alert>
      </Box>
      
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={tabValue} onChange={handleTabChange}>
          <Tab label="Manual Input" />
          <Tab label="File Upload" />
        </Tabs>
      </Box>

      {/* Data Input Tabs */}
      {tabValue === 0 && (
        <ManualInput onDataChange={handleDataChange} />
      )}
      {tabValue === 1 && (
        <FileUpload onDataChange={handleDataChange} metricType={config.metricType} />
      )}

      {/* Error Display */}
      {error && (
        <Alert severity={error.includes('Warning') ? 'warning' : 'error'} sx={{ mt: 2, mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Configuration Section */}
      <Box sx={{ mt: 4 }}>
        <Typography variant="h6" gutterBottom>
          Analysis Configuration
        </Typography>
        
        <Grid container spacing={3}>
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              fullWidth
              label="Baseline Period"
              type="number"
              value={config.baselinePeriod}
              onChange={(e) => handleConfigChange('baselinePeriod', parseInt(e.target.value))}
              inputProps={{ min: 6, max: 50 }}
              helperText="6-20 recommended per Vacanti"
            />
          </Grid>
          
          {config.metricType === 'throughput' && (
            <Grid item xs={12} sm={6} md={3}>
              <FormControl fullWidth>
                <InputLabel>Throughput Period</InputLabel>
                <Select
                  value={config.throughputPeriod}
                  onChange={(e) => handleConfigChange('throughputPeriod', e.target.value as ThroughputPeriod)}
                >
                  <MenuItem value="daily">Daily</MenuItem>
                  <MenuItem value="weekly">Weekly</MenuItem>
                  <MenuItem value="monthly">Monthly</MenuItem>
                </Select>
              </FormControl>
            </Grid>
          )}
          
          <Grid item xs={12} sm={6} md={3}>
            <FormControl fullWidth>
              <InputLabel>Time Format</InputLabel>
              <Select
                value={config.timeFormat}
                onChange={(e) => handleConfigChange('timeFormat', e.target.value)}
              >
                <MenuItem value="MM/dd/yyyy">MM/DD/YYYY</MenuItem>
                <MenuItem value="dd/MM/yyyy">DD/MM/YYYY</MenuItem>
                <MenuItem value="yyyy-MM-dd">YYYY-MM-DD</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          
          <Grid item xs={12} sm={6} md={3}>
            <FormControlLabel
              control={
                <Switch
                  checked={config.showSigmaLines}
                  onChange={(e) => handleConfigChange('showSigmaLines', e.target.checked)}
                />
              }
              label="Show Sigma Lines"
            />
          </Grid>
          
          <Grid item xs={12}>
            <Button
              fullWidth
              variant="contained"
              size="large"
              onClick={handleSubmit}
              disabled={data.length < 3 || loading}
              sx={{ height: '56px' }}
            >
              {loading ? 'Analyzing...' : `Generate ${config.metricType === 'cycle_time' ? 'Cycle Time' : 'Throughput'} Analysis`}
            </Button>
          </Grid>
        </Grid>
        
        {data.length > 0 && (
          <Box sx={{ mt: 2 }}>
            <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
              <Chip 
                label={`${data.length} data points loaded`} 
                color="primary" 
                size="small" 
              />
              <Chip 
                label={config.metricType === 'cycle_time' ? 'Cycle Time Analysis' : 'Throughput Analysis'} 
                color="secondary" 
                size="small" 
              />
              {config.metricType === 'throughput' && (
                <Chip 
                  label={`${config.throughputPeriod} periods`} 
                  color="info" 
                  size="small" 
                />
              )}
            </Stack>
            
            <Typography variant="body2" color="textSecondary">
              {config.metricType === 'cycle_time' 
                ? (data.length < 6 ? 'Minimum 6 recommended for reliable cycle time analysis' : 'Ready for cycle time analysis')
                : (data.length < 10 ? 'Minimum 10 items recommended for reliable throughput analysis' : 'Ready for throughput analysis')
              }
            </Typography>
          </Box>
        )}
        
        <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
          <Typography variant="subtitle2" gutterBottom>
            Vacanti's Flow Metrics Methodology:
          </Typography>
          <Typography variant="body2" component="ul" sx={{ pl: 2, mb: 0 }}>
            <li><strong>Cycle Time:</strong> Elapsed time from work start to completion - measures delivery speed</li>
            <li><strong>Throughput:</strong> Number of items completed per time period - measures delivery capacity</li>
            <li><strong>Process Behaviour Charts:</strong> Distinguish between routine variation (noise) and exceptional variation (signals)</li>
            <li><strong>Predictability:</strong> Stable processes enable reliable forecasting and planning</li>
          </Typography>
        </Box>
      </Box>
    </Paper>
  );
};

export default DataInput;
