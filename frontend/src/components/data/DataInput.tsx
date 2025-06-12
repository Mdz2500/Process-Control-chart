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

  // Updated validation function aligned with Vacanti's methodology
  const validateData = (data: DataPoint[]): string | null => {
    if (data.length < 3) {
      return "Minimum 3 data points required";
    }
    
    if (data.length < 6) {
      return "Warning: Less than 6 data points may produce unreliable results. Vacanti recommends minimum 6 for meaningful analysis.";
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
    
    // Ensure chronological ordering (Vacanti's requirement #1)
    const sortedData = [...data].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    const wasReordered = data.some((point, index) => 
      point.timestamp.getTime() !== sortedData[index].timestamp.getTime()
    );
    
    if (wasReordered) {
      return "Warning: Data was not in chronological order. Data will be automatically sorted to preserve temporal sequence as required by Vacanti's methodology.";
    }
    
    // Check for logical comparability (Vacanti's requirement #2)
    // Ensure successive values represent the same process
    const values = data.map(p => p.value);
    const range = Math.max(...values) - Math.min(...values);
    const average = values.reduce((sum, val) => sum + val, 0) / values.length;
    
    if (range / average < 0.001) {
      return "Warning: Very low variation detected. Moving ranges may not capture meaningful process variation as required for XmR charts.";
    }
    
    return null;
  };

  const handleSubmit = () => {
    let processedData = [...data];
    
    // Ensure chronological ordering as per Vacanti's requirements
    processedData.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    
    const validationError = validateData(processedData);
    
    if (validationError && validationError.includes('Error')) {
      setError(validationError);
      return;
    }
    
    // Show warnings but allow processing
    if (validationError && validationError.includes('Warning')) {
      setError(validationError);
    }
    
    if (processedData.length >= 3) {
      onDataSubmit(processedData, config);
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
              helperText="6-20 recommended per Vacanti"
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
            {data.length < 6 && ' (minimum 6 recommended for reliable analysis per Vacanti)'}
          </Typography>
        )}
        
        <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
          <Typography variant="subtitle2" gutterBottom>
            Vacanti's Requirements for XmR Charts:
          </Typography>
          <Typography variant="body2" component="ul" sx={{ pl: 2, mb: 0 }}>
            <li><strong>Chronological ordering:</strong> Data arranged in time sequence</li>
            <li><strong>Logical comparability:</strong> Successive values from same process</li>
            <li><strong>Meaningful moving ranges:</strong> Differences capture process variation</li>
            <li><strong>Duplicate timestamps allowed:</strong> Multiple items can complete on same day</li>
          </Typography>
        </Box>
      </Box>
    </Paper>
  );
};

export default DataInput;
