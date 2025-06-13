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
  metricType?: 'cycle_time' | 'throughput';
}

interface NaveDataPreview {
  totalTasks: number;
  completedTasks: number;
  filteredOutTasks: number;
  dateRange: { start: Date; end: Date };
  avgCycleTime: number;
  duplicateTimestamps: number;
}

const FileUpload: React.FC<FileUploadProps> = ({ onDataChange, metricType = 'cycle_time' }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<NaveDataPreview | null>(null);
  const [selectedMetricType, setSelectedMetricType] = useState<'cycle_time' | 'throughput'>(metricType);

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
      resolution: headers.findIndex(h => h.includes('resolution')),
      // Nave provides detailed time tracking in minutes
      backlogTime: headers.findIndex(h => h.includes('backlog (mins)')),
      inProcessTime: headers.findIndex(h => h.includes('in process (mins)')),
      totalTime: headers.findIndex(h => h.includes('total (mins)'))
    };

    // Validate required columns exist
    if (columnMap.startDate === -1 || columnMap.endDate === -1) {
      throw new Error('CSV must contain "Start date" and "End date" columns for flow metrics analysis');
    }

    const completedTasks: any[] = [];
    let filteredOutCount = 0;
    
    for (let i = 1; i < lines.length; i++) {
      const columns = lines[i].split(',').map(c => c.trim().replace(/"/g, ''));
      
      if (columns.length < Math.max(...Object.values(columnMap).filter(v => v !== -1))) {
        continue; // Skip incomplete rows
      }

      const taskKey = columns[columnMap.taskKey] || `Task-${i}`;
      const taskName = columns[columnMap.taskName] || 'Unnamed Task';
      const startDateStr = columns[columnMap.startDate];
      const endDateStr = columns[columnMap.endDate];
      const status = columns[columnMap.status]?.toLowerCase();
      const resolution = columns[columnMap.resolution]?.toLowerCase();
      
      // Enhanced filtering based on your requirements
      // 1. Exclude items with "Won't fix" status
      if (status?.includes("won't fix") || status?.includes("wont fix")) {
        filteredOutCount++;
        continue;
      }
      
      // 2. Only include items with "Done" resolution
      if (columnMap.resolution !== -1 && resolution && !resolution.includes('done')) {
        filteredOutCount++;
        continue;
      }
      
      // 3. Fallback to status check if no resolution column
      if (columnMap.resolution === -1 && !status?.includes('done') && !status?.includes('completed')) {
        filteredOutCount++;
        continue;
      }

      if (!startDateStr || !endDateStr || endDateStr.toLowerCase().includes('backlog')) {
        filteredOutCount++;
        continue; // Skip tasks without completion dates
      }

      try {
        const startDate = new Date(startDateStr);
        const endDate = new Date(endDateStr);
        
        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
          filteredOutCount++;
          continue; // Skip invalid dates
        }

        // Calculate cycle time for statistics (even for throughput analysis)
        const cycleTimeMs = endDate.getTime() - startDate.getTime();
        const cycleTimeDays = cycleTimeMs / (1000 * 60 * 60 * 24);

        completedTasks.push({
          taskKey,
          taskName,
          startDate,
          endDate,
          cycleTime: cycleTimeDays,
          status,
          resolution
        });
        
      } catch (error) {
        console.warn(`Skipping row ${i} due to date parsing error:`, error);
        filteredOutCount++;
        continue;
      }
    }

    if (completedTasks.length === 0) {
      throw new Error('No completed tasks found that meet the criteria. PBC analysis requires completed work items (Done status/resolution) with start and end dates.');
    }

    // Sort by completion date for proper time series analysis (Vacanti's requirement)
    completedTasks.sort((a, b) => a.endDate.getTime() - b.endDate.getTime());

    let data: DataPoint[] = [];

    if (selectedMetricType === 'cycle_time') {
      // For cycle time analysis: each task becomes a data point with its cycle time
      data = completedTasks.map((task, index) => ({
        timestamp: task.endDate,
        value: Math.round(task.cycleTime * 100) / 100, // Round to 2 decimal places
        label: `${task.taskKey}: ${task.taskName} (${task.cycleTime.toFixed(1)} days)`,
        taskKey: task.taskKey,
        taskName: task.taskName,
        cycleTimeDays: task.cycleTime
      } as DataPoint & { taskKey: string; taskName: string; cycleTimeDays: number }));
    } else {
      // For throughput analysis: each completed item becomes a data point with value=1
      // The backend will group these by time periods to calculate throughput
      data = completedTasks.map((task, index) => ({
        timestamp: task.endDate,
        value: 1, // Each completed item counts as 1 for throughput calculation
        label: `${task.taskKey}: ${task.taskName}`,
        taskKey: task.taskKey,
        taskName: task.taskName
      } as DataPoint & { taskKey: string; taskName: string }));
    }

    // Calculate statistics for preview
    const cycleTimeValues = completedTasks.map(t => t.cycleTime);
    const avgCycleTime = cycleTimeValues.reduce((sum, val) => sum + val, 0) / cycleTimeValues.length;
    
    // Count duplicate timestamps (for informational purposes)
    const timestamps = data.map(d => d.timestamp.getTime());
    const uniqueTimestamps = new Set(timestamps);
    const duplicateTimestamps = timestamps.length - uniqueTimestamps.size;
    
    setPreview({
      totalTasks: completedTasks.length + filteredOutCount,
      completedTasks: completedTasks.length,
      filteredOutTasks: filteredOutCount,
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
      const minRequired = selectedMetricType === 'cycle_time' ? 6 : 10;
      if (pbcData.length < minRequired) {
        throw new Error(`Only ${pbcData.length} completed tasks found that meet the criteria. Minimum ${minRequired} data points required for meaningful ${selectedMetricType === 'cycle_time' ? 'Cycle Time' : 'Throughput'} analysis as per Vacanti's methodology.`);
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
        Only completed tasks (Done status/resolution) will be included, excluding "Won't fix" items.
      </Typography>

      {/* Metric Type Selection */}
      <FormControl fullWidth sx={{ mb: 2 }}>
        <InputLabel>Flow Metric to Analyze</InputLabel>
        <Select
          value={selectedMetricType}
          onChange={(e) => setSelectedMetricType(e.target.value as 'cycle_time' | 'throughput')}
        >
          <MenuItem value="cycle_time">
            Cycle Time (Days) - Time from start to completion
          </MenuItem>
          <MenuItem value="throughput">
            Throughput (Items/Period) - Items completed per time period
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
            Processing Nave data for {selectedMetricType === 'cycle_time' ? 'cycle time' : 'throughput'} analysis...
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
            Nave Data Successfully Processed for {selectedMetricType === 'cycle_time' ? 'Cycle Time' : 'Throughput'} Analysis
          </Typography>
          
          <Stack direction="row" spacing={1} sx={{ mb: 1, flexWrap: 'wrap' }}>
            <Chip label={`${preview.completedTasks} completed tasks included`} size="small" color="success" />
            <Chip label={`${preview.filteredOutTasks} tasks filtered out`} size="small" color="info" />
            {selectedMetricType === 'cycle_time' ? (
              <Chip 
                label={`Avg Cycle Time: ${preview.avgCycleTime.toFixed(1)} days`} 
                size="small" 
              />
            ) : (
              <Chip 
                label={`${preview.completedTasks} items for throughput calculation`} 
                size="small" 
              />
            )}
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
            Ready for {selectedMetricType === 'cycle_time' ? 'Cycle Time' : 'Throughput'} Process Behaviour Chart analysis. 
            Data is chronologically ordered and meets Vacanti's requirements for meaningful XmR chart analysis.
          </Typography>
          
          {selectedMetricType === 'throughput' && (
            <Typography variant="body2" sx={{ mt: 1, fontStyle: 'italic' }}>
              For throughput analysis, each completed item will be grouped by time periods to calculate items completed per period.
            </Typography>
          )}
        </Alert>
      )}

      {/* Enhanced help text */}
      <Box sx={{ mt: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
        <Typography variant="subtitle2" gutterBottom>
          {selectedMetricType === 'cycle_time' ? 'Cycle Time Analysis' : 'Throughput Analysis'} - Filtering Rules Applied:
        </Typography>
        <Typography variant="body2" component="ul" sx={{ pl: 2 }}>
          <li>✅ Include: Tasks with "Done" status or "Done" resolution</li>
          <li>❌ Exclude: Tasks with "Won't fix" status</li>
          <li>❌ Exclude: Tasks with non-"Done" resolutions</li>
          <li>❌ Exclude: Tasks without completion dates</li>
          {selectedMetricType === 'cycle_time' ? (
            <li>📊 Result: Each task becomes a data point with its cycle time in days</li>
          ) : (
            <li>📊 Result: Each completed item (value=1) will be grouped by time periods for throughput calculation</li>
          )}
          <li>🎯 Hover over chart points to see Task Key and Task Name</li>
        </Typography>
      </Box>
    </Box>
  );
};

export default FileUpload;
