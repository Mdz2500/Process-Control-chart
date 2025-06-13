import axios from 'axios';
import { DataPoint, PBCAnalysis, ThroughputResponse, ThroughputPeriod } from '../types';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

export interface PBCRequest {
  data: DataPoint[];
  baselinePeriod?: number;
  detectionRules?: string[];
  metricType?: 'cycle_time' | 'throughput';
}

export interface ThroughputRequest {
  data: DataPoint[];
  period: ThroughputPeriod;
  baselinePeriod?: number;
  detectionRules?: string[];
}

export const calculatePBC = async (request: PBCRequest): Promise<PBCAnalysis> => {
  try {
    console.log('Sending PBC request:', request);
    
    const formattedData = request.data.map(point => ({
      timestamp: point.timestamp.toISOString(),
      value: Number(point.value),
      label: point.label || ''
    }));

    const payload = {
      data: formattedData,
      baselinePeriod: request.baselinePeriod || Math.min(20, request.data.length),
      detectionRules: request.detectionRules || ['rule1', 'rule4'],
      metricType: request.metricType || 'cycle_time'
    };

    console.log('Final payload:', payload);
    
    const response = await api.post('/api/calculate-pbc', payload);
    
    console.log('PBC response:', response.data);
    return response.data;
    
  } catch (error: any) {
    console.error('PBC calculation error:', error);
    console.error('Error response:', error.response?.data);
    
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

export const calculateThroughput = async (request: ThroughputRequest): Promise<ThroughputResponse> => {
  try {
    console.log('Sending throughput request:', request);
    
    const formattedData = request.data.map(point => ({
      timestamp: point.timestamp.toISOString(),
      value: Number(point.value),
      label: point.label || ''
    }));

    const payload = {
      data: formattedData,
      period: request.period,
      baselinePeriod: request.baselinePeriod || Math.min(20, request.data.length),
      detectionRules: request.detectionRules || ['rule1', 'rule4']
    };

    console.log('Throughput payload:', payload);
    
    const response = await api.post('/api/calculate-throughput', payload);
    
    console.log('Throughput response:', response.data);
    return response.data;
    
  } catch (error: any) {
    console.error('Throughput calculation error:', error);
    
    if (error.response?.status === 400) {
      throw new Error(error.response.data.detail || 'Invalid data provided for throughput analysis');
    } else if (error.response?.status === 500) {
      throw new Error('Server error during throughput calculation.');
    } else {
      throw new Error(`Failed to calculate throughput: ${error.message}`);
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
