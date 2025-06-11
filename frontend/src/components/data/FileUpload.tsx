import React, { useState } from 'react';
import {
  Box,
  Button,
  Typography,
  Alert,
  LinearProgress
} from '@mui/material';
import { CloudUpload } from '@mui/icons-material';
import { DataPoint } from '../../types';

interface FileUploadProps {
  onDataChange: (data: DataPoint[]) => void;
}

const FileUpload: React.FC<FileUploadProps> = ({ onDataChange }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError(null);

    try {
      const text = await file.text();
      const lines = text.split('\n').filter(line => line.trim());
      
      if (lines.length < 2) {
        throw new Error('File must contain at least a header row and one data row');
      }

      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
      const timestampIndex = headers.findIndex(h => h.includes('timestamp') || h.includes('date'));
      const valueIndex = headers.findIndex(h => h.includes('value') || h.includes('cycle') || h.includes('time'));

      if (timestampIndex === -1 || valueIndex === -1) {
        throw new Error('CSV must contain timestamp/date and value columns');
      }

      const data: DataPoint[] = [];
      
      for (let i = 1; i < lines.length; i++) {
        const columns = lines[i].split(',').map(c => c.trim());
        
        if (columns.length >= Math.max(timestampIndex, valueIndex) + 1) {
          const timestamp = new Date(columns[timestampIndex]);
          const value = parseFloat(columns[valueIndex]);
          
          if (!isNaN(timestamp.getTime()) && !isNaN(value)) {
            data.push({
              timestamp,
              value,
              label: `Row ${i}`
            });
          }
        }
      }

      if (data.length === 0) {
        throw new Error('No valid data rows found');
      }

      // Sort by timestamp
      data.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
      
      onDataChange(data);
    } catch (err: any) {
      setError(err.message || 'Failed to parse file');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Upload CSV File
      </Typography>
      
      <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
        Upload a CSV file with timestamp and value columns. Expected format: Date, Value
      </Typography>

      <Button
        variant="outlined"
        component="label"
        startIcon={<CloudUpload />}
        disabled={loading}
        fullWidth
        sx={{ mb: 2 }}
      >
        Choose CSV File
        <input
          type="file"
          accept=".csv"
          hidden
          onChange={handleFileUpload}
        />
      </Button>

      {loading && <LinearProgress sx={{ mb: 2 }} />}
      
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
    </Box>
  );
};

export default FileUpload;
