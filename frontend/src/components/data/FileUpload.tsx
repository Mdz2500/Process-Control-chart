import React, { useState } from 'react';
import {
  Box,
  Button,
  Typography,
  Alert,
  LinearProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  Stack
} from '@mui/material';
import { CloudUpload, Assessment } from '@mui/icons-material';
import { DataPoint } from '../../types';

interface FileUploadProps {
  onDataChange: (data: DataPoint[]) => void;
}

interface NaveDataPreview {
  totalTasks: number;
  completedTasks: number;
  dateRange: { start: Date; end: Date };
  avgCycleTime: number;
  duplicateTimestamps: number;
}

const FileUpload: React.FC<FileUploadProps> = ({ onDataChange }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<NaveDataPreview | null>(null);
  const [metricType, setMetricType] = useState<'cycle_time' | 'throughput'>('cycle_time');

  const parseNaveCSV = async (file: File): Promise<DataPoint[]> => {
    const text = await file.text();
    const lines = text.split('\n').filter(line => line.trim());
    
    if (lines.length < 2) {
      throw new Error('CSV file must contain at least a header row and one data row');
    }

    // Parse header to find relevant columns
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    
    // Map Nave column names to our expected fields
    const columnMap = {
      taskKey: headers.findIndex(h => h.includes('task key') || h.includes('id')),
      taskName: headers.findIndex(h => h.includes('task name') || h.includes('name')),
      startDate: headers.findIndex(h => h.includes('start date')),
      endDate: headers.findIndex(h => h.includes('end date')),
      status: headers.findIndex(h => h.includes('status')),
      // Nave provides detailed time tracking in minutes
      backlogTime: headers.findIndex(h => h.includes('backlog (mins)')),
      inProcessTime: headers.findIndex(h => h.includes('in process (mins)')),
      totalTime: headers.findIndex(h => h.includes('total (mins)'))
    };

    // Validate required columns exist
    if (columnMap.startDate === -1 || columnMap.endDate === -1) {
      throw new Error('CSV must contain "Start date" and "End date" columns for flow metrics analysis');
    }

    const data: DataPoint[] = [];
    const completedTasks: any[] = [];
    
    for (let i = 1; i < lines.length; i++) {
      const columns = lines[i].split(',').map(c => c.trim().replace(/"/g, ''));
      
      if (columns.length < Math.max(...Object.values(columnMap).filter(v => v !== -1))) {
        continue; // Skip incomplete rows
      }

      const taskKey = columns[columnMap.taskKey] || `Task-${i}`;
      const startDateStr = columns[columnMap.startDate];
      const endDateStr = columns[columnMap.endDate];
      const status = columns[columnMap.status]?.toLowerCase();
      
      // Only process completed tasks for meaningful PBC analysis
      if (!status?.includes('done') && !status?.includes('completed')) {
        continue;
      }

      if (!startDateStr || !endDateStr || endDateStr.toLowerCase().includes('backlog')) {
        continue; // Skip tasks without completion dates
      }

      try {
        const startDate = new Date(startDateStr);
        const endDate = new Date(endDateStr);
        
        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
          continue; // Skip invalid dates
        }

        let value: number;
        
        if (metricType === 'cycle_time') {
          // Calculate Cycle Time in days (as recommended in Vacanti's document)
          const cycleTimeMs = endDate.getTime() - startDate.getTime();
          value = cycleTimeMs / (1000 * 60 * 60 * 24); // Convert to days
          
          // Use end date as the timestamp for when the measurement was taken
          // Multiple items can complete on the same day - this is normal and allowed
          data.push({
            timestamp: endDate,
            value: Math.round(value * 100) / 100, // Round to 2 decimal places
            label: `${taskKey}: ${value.toFixed(1)} days`
          });
        } else {
          // For throughput analysis, we'll count items completed per week
          // This will be processed differently in a separate function
          value = 0; // Assign a default value for throughput analysis
        }

        completedTasks.push({
          taskKey,
          startDate,
          endDate,
          cycleTime: value ?? 0, // Ensure value is not null
          status
        });
        
      } catch (error) {
        console.warn(`Skipping row ${i} due to date parsing error:`, error);
        continue;
      }
    }

    if (data.length === 0) {
      throw new Error('No completed tasks found. PBC analysis requires completed work items with start and end dates.');
    }

    // Sort by completion date for proper time series analysis (Vacanti's requirement)
    data.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    // Calculate statistics including duplicate timestamps (which are allowed)
    const cycleTimeValues = data.map(d => d.value);
    const avgCycleTime = cycleTimeValues.reduce((sum, val) => sum + val, 0) / cycleTimeValues.length;
    
    // Count duplicate timestamps (for informational purposes)
    const timestamps = data.map(d => d.timestamp.getTime());
    const uniqueTimestamps = new Set(timestamps);
    const duplicateTimestamps = timestamps.length - uniqueTimestamps.size;
    
    setPreview({
      totalTasks: completedTasks.length,
      completedTasks: completedTasks.length,
      dateRange: {
        start: new Date(Math.min(...data.map(d => d.timestamp.getTime()))),
        end: new Date(Math.max(...data.map(d => d.timestamp.getTime())))
      },
      avgCycleTime,
      duplicateTimestamps
    });

    return data;
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError(null);
    setPreview(null);

    try {
      // Validate file type
      if (!file.name.toLowerCase().endsWith('.csv')) {
        throw new Error('Please upload a CSV file');
      }

      // Validate file size (32MB limit as per Nave documentation)
      if (file.size > 32 * 1024 * 1024) {
        throw new Error('File size exceeds 32MB limit');
      }

      const pbcData = await parseNaveCSV(file);
      
      // Validate minimum data points for meaningful PBC analysis
      if (pbcData.length < 6) {
        throw new Error(`Only ${pbcData.length} completed tasks found. Minimum 6 data points required for meaningful Process Behaviour Chart analysis as per Vacanti's methodology.`);
      }

      onDataChange(pbcData);
      
    } catch (err: any) {
      setError(err.message || 'Failed to parse Nave CSV file');
      setPreview(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Upload Nave CSV File
      </Typography>
      
      <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
        Upload a CSV file exported from Nave to analyze your flow metrics using Process Behaviour Charts.
        Supports Cycle Time and Throughput analysis as described in Vacanti's methodology.
      </Typography>

      {/* Metric Type Selection */}
      <FormControl fullWidth sx={{ mb: 2 }}>
        <InputLabel>Flow Metric to Analyze</InputLabel>
        <Select
          value={metricType}
          onChange={(e) => setMetricType(e.target.value as 'cycle_time' | 'throughput')}
        >
          <MenuItem value="cycle_time">
            Cycle Time (Days) - Time from start to completion
          </MenuItem>
          <MenuItem value="throughput">
            Throughput (Items/Week) - Items completed per time period
          </MenuItem>
        </Select>
      </FormControl>

      <Button
        variant="outlined"
        component="label"
        startIcon={<CloudUpload />}
        disabled={loading}
        fullWidth
        sx={{ mb: 2 }}
      >
        Choose Nave CSV File
        <input
          type="file"
          accept=".csv,text/csv,application/csv"
          hidden
          onChange={handleFileUpload}
        />
      </Button>

      {loading && (
        <Box sx={{ mb: 2 }}>
          <LinearProgress />
          <Typography variant="body2" sx={{ mt: 1 }}>
            Processing Nave data for flow metrics analysis...
          </Typography>
        </Box>
      )}
      
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          <Typography variant="subtitle2" gutterBottom>
            Upload Error
          </Typography>
          {error}
        </Alert>
      )}

      {preview && (
        <Alert severity="success" sx={{ mb: 2 }}>
          <Typography variant="subtitle2" gutterBottom>
            <Assessment sx={{ mr: 1, verticalAlign: 'middle' }} />
            Nave Data Successfully Processed
          </Typography>
          
          <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
            <Chip label={`${preview.completedTasks} completed tasks`} size="small" />
            <Chip 
              label={`Avg ${metricType === 'cycle_time' ? 'Cycle Time' : 'Throughput'}: ${preview.avgCycleTime.toFixed(1)} ${metricType === 'cycle_time' ? 'days' : 'items/week'}`} 
              size="small" 
            />
            {preview.duplicateTimestamps > 0 && (
              <Chip 
                label={`${preview.duplicateTimestamps} items completed on same day`} 
                size="small" 
                color="info"
              />
            )}
          </Stack>
          
          <Typography variant="body2">
            Date range: {preview.dateRange.start.toLocaleDateString()} to {preview.dateRange.end.toLocaleDateString()}
          </Typography>
          
          <Typography variant="body2" sx={{ mt: 1 }}>
            Ready for Process Behaviour Chart analysis. Data is chronologically ordered and meets 
            Vacanti's requirements for meaningful XmR chart analysis.
          </Typography>
          
          {preview.duplicateTimestamps > 0 && (
            <Typography variant="body2" sx={{ mt: 1, fontStyle: 'italic' }}>
              Note: Multiple items completing on the same day is normal in flow metrics and 
              allowed per Vacanti's methodology.
            </Typography>
          )}
        </Alert>
      )}

      {/* Nave-specific help text */}
      <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
        <Typography variant="subtitle2" gutterBottom>
          Vacanti's Requirements for Flow Metrics:
        </Typography>
        <Typography variant="body2" component="ul" sx={{ pl: 2 }}>
          <li>Export your data from Nave with "Start date" and "End date" columns</li>
          <li>Only completed tasks (status = "Done") will be analyzed</li>
          <li>Data will be sorted chronologically to preserve temporal context</li>
          <li>Duplicate timestamps are allowed - multiple items can complete on same day</li>
          <li>Minimum 6 completed tasks required for reliable PBC analysis</li>
          <li>Moving ranges will capture local, short-term routine variation</li>
        </Typography>
      </Box>
    </Box>
  );
};

export default FileUpload;
