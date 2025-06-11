import axios from 'axios';
import { DataPoint, PBCAnalysis } from '../types';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export interface PBCRequest {
  data: DataPoint[];
  baselinePeriod?: number;
  detectionRules?: string[];
}

// In src/services/api.ts
export const calculatePBC = async (request: PBCRequest): Promise<PBCAnalysis> => {
  try {
    console.log('Sending PBC request:', request); // Debug log
    
    const response = await api.post('/api/calculate-pbc', {
      data: request.data.map(point => ({
        timestamp: point.timestamp.toISOString(),
        value: point.value,
        label: point.label
      })),
      baseline_period: request.baselinePeriod || Math.min(20, request.data.length),
      detection_rules: request.detectionRules || ['rule1', 'rule4']
    });
    
    console.log('PBC response:', response.data); // Debug log
    return response.data;
    
  } catch (error: any) {
    console.error('PBC calculation error:', error);
    
    // Provide more specific error messages
    if (error.response?.status === 400) {
      throw new Error(error.response.data.detail || 'Invalid data provided');
    } else if (error.response?.status === 500) {
      throw new Error('Server error during calculation. Please check your data format.');
    } else {
      throw new Error('Failed to calculate PBC. Please check your connection and data.');
    }
  }
};


export const healthCheck = async (): Promise<{ status: string }> => {
  try {
    const response = await api.get('/api/health');
    return response.data;
  } catch (error) {
    console.error('Health check failed:', error);
    throw error;
  }
};

