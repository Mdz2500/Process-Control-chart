import React from 'react';
import {
  Paper,
  Typography,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Chip,
  Box
} from '@mui/material';
import { Warning, Error, Info } from '@mui/icons-material';
import { Signal } from '../../types';

interface SignalDetectorProps {
  signals: Signal[];
}

const SignalDetector: React.FC<SignalDetectorProps> = ({ signals }) => {
  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'high':
        return <Error color="error" />;
      case 'moderate':
        return <Warning color="warning" />;
      case 'low':
        return <Info color="info" />;
      default:
        return <Info />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'high':
        return 'error';
      case 'moderate':
        return 'warning';
      case 'low':
        return 'info';
      default:
        return 'default';
    }
  };

  return (
    <Paper elevation={3} sx={{ p: 3, mt: 3 }}>
      <Typography variant="h5" gutterBottom>
        Signal Detection Results
      </Typography>
      
      {signals.length === 0 ? (
        <Typography variant="body1" color="textSecondary">
          No signals detected. Process appears to be operating with routine variation only.
        </Typography>
      ) : (
        <>
          <Typography variant="body2" sx={{ mb: 2 }}>
            {signals.length} signal(s) detected requiring investigation:
          </Typography>
          
          <List>
            {signals.map((signal, index) => (
              <ListItem key={index} divider>
                <ListItemIcon>
                  {getSeverityIcon(signal.severity)}
                </ListItemIcon>
                <ListItemText
                  primary={
                    <Box display="flex" alignItems="center" gap={1}>
                      <Typography variant="subtitle1">
                        {signal.type.toUpperCase()}
                      </Typography>
                      <Chip 
                        label={signal.severity} 
                        size="small" 
                        color={getSeverityColor(signal.severity) as any}
                      />
                    </Box>
                  }
                  secondary={
                    <>
                      <Typography variant="body2">
                        {signal.description}
                      </Typography>
                      <Typography variant="caption" color="textSecondary">
                        Data points: {signal.dataPoints.join(', ')}
                      </Typography>
                    </>
                  }
                />
              </ListItem>
            ))}
          </List>
        </>
      )}
    </Paper>
  );
};

export default SignalDetector;
