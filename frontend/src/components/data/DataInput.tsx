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
  Alert
} from '@mui/material';
import { DataPoint, ChartConfiguration } from '../../types';
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
    timeFormat: 'MM/dd/yyyy'
  });

  const handleTabChange = (event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleDataChange = (newData: DataPoint[]) => {
    setData(newData);
    setError(null); // Clear any previous errors
  };

  const handleConfigChange = (key: keyof ChartConfiguration, value: any) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  // Validation function for data points
  const validateData = (data: DataPoint[]): string | null => {
    if (data.length < 3) {
      return "Minimum 3 data points required";
    }
    
    if (data.length < 6) {
      return "Warning: Less than 6 data points may produce unreliable results";
    }
    
    // Check for valid values
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
    
    // Check for duplicate timestamps
    const timestamps = data.map(p => p.timestamp.getTime());
    const uniqueTimestamps = new Set(timestamps);
    if (timestamps.length !== uniqueTimestamps.size) {
      return "Duplicate timestamps detected. Each data point must have a unique timestamp.";
    }
    
    return null;
  };

  const handleSubmit = () => {
    const validationError = validateData(data);
    
    if (validationError) {
      setError(validationError);
      return;
    }
    
    if (data.length >= 3) {
      onDataSubmit(data, config);
    }
  };

  return (
    <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
      <Typography variant="h5" gutterBottom>
        Data Input & Configuration
      </Typography>
      
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
        <FileUpload onDataChange={handleDataChange} />
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
          Chart Configuration
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
              helperText="6-20 recommended"
            />
          </Grid>
          
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
          
          <Grid item xs={12} sm={6} md={3}>
            <Button
              fullWidth
              variant="contained"
              size="large"
              onClick={handleSubmit}
              disabled={data.length < 3 || loading}
              sx={{ height: '56px' }}
            >
              {loading ? 'Analyzing...' : 'Generate PBC'}
            </Button>
          </Grid>
        </Grid>
        
        {data.length > 0 && (
          <Typography variant="body2" color="textSecondary" sx={{ mt: 2 }}>
            Data points loaded: {data.length} 
            {data.length < 6 && ' (minimum 6 recommended for reliable analysis)'}
          </Typography>
        )}
      </Box>
    </Paper>
  );
};

export default DataInput;
