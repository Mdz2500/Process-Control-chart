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
    console.log('Sending PBC request:', request);
    
    const response = await api.post('/api/calculate-pbc', {
      data: request.data.map(point => ({
        timestamp: point.timestamp.toISOString(),
        value: point.value,
        label: point.label
      })),
      baselinePeriod: request.baselinePeriod || Math.min(20, request.data.length),  // Use camelCase
      detectionRules: request.detectionRules || ['rule1', 'rule4']  // Use camelCase
    });
    
    console.log('PBC response:', response.data);
    return response.data;
    
  } catch (error: any) {
    console.error('PBC calculation error:', error);
    
    if (error.response?.status === 400) {
      throw new Error(error.response.data.detail || 'Invalid data provided');
    } else if (error.response?.status === 500) {
      throw new Error('Server error during calculation. Please check your data format.');
    } else if (error.code === 'ECONNREFUSED') {
      throw new Error('Cannot connect to backend server. Please ensure the backend is running on port 8000.');
    } else {
      throw new Error(`Failed to calculate PBC: ${error.message}`);
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

