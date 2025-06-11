import React, { useState } from 'react';
import {
  Box,
  TextField,
  Button,
  Typography,
  Grid,
  IconButton,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction
} from '@mui/material';
import { Add, Delete } from '@mui/icons-material';
import { DataPoint } from '../../types';

interface ManualInputProps {
  onDataChange: (data: DataPoint[]) => void;
}

const ManualInput: React.FC<ManualInputProps> = ({ onDataChange }) => {
  const [data, setData] = useState<DataPoint[]>([]);
  const [newTimestamp, setNewTimestamp] = useState('');
  const [newValue, setNewValue] = useState('');
  const [newLabel, setNewLabel] = useState('');

  const addDataPoint = () => {
    if (!newTimestamp || !newValue) return;

    const timestamp = new Date(newTimestamp);
    const value = parseFloat(newValue);

    if (isNaN(timestamp.getTime()) || isNaN(value)) return;

    const newPoint: DataPoint = {
      timestamp,
      value,
      label: newLabel || `Point ${data.length + 1}`
    };

    const updatedData = [...data, newPoint].sort(
      (a, b) => a.timestamp.getTime() - b.timestamp.getTime()
    );

    setData(updatedData);
    onDataChange(updatedData);

    // Clear form
    setNewTimestamp('');
    setNewValue('');
    setNewLabel('');
  };

  const removeDataPoint = (index: number) => {
    const updatedData = data.filter((_, i) => i !== index);
    setData(updatedData);
    onDataChange(updatedData);
  };

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Manual Data Entry
      </Typography>

      <Paper elevation={1} sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} sm={3}>
            <TextField
              fullWidth
              label="Date"
              type="date"
              value={newTimestamp}
              onChange={(e) => setNewTimestamp(e.target.value)}
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid item xs={12} sm={3}>
            <TextField
              fullWidth
              label="Value"
              type="number"
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              inputProps={{ step: 0.01 }}
            />
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField
              fullWidth
              label="Label (optional)"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
            />
          </Grid>
          <Grid item xs={12} sm={2}>
            <Button
              fullWidth
              variant="contained"
              startIcon={<Add />}
              onClick={addDataPoint}
              disabled={!newTimestamp || !newValue}
            >
              Add
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {data.length > 0 && (
        <Paper elevation={1} sx={{ maxHeight: 300, overflow: 'auto' }}>
          <List dense>
            {data.map((point, index) => (
              <ListItem key={index} divider>
                <ListItemText
                  primary={`${point.label || `Point ${index + 1}`}: ${point.value}`}
                  secondary={point.timestamp.toLocaleDateString()}
                />
                <ListItemSecondaryAction>
                  <IconButton
                    edge="end"
                    onClick={() => removeDataPoint(index)}
                    size="small"
                  >
                    <Delete />
                  </IconButton>
                </ListItemSecondaryAction>
              </ListItem>
            ))}
          </List>
        </Paper>
      )}
    </Box>
  );
};

export default ManualInput;
