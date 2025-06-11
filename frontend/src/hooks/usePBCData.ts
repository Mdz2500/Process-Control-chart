import { useState } from 'react';
import { DataPoint, PBCAnalysis } from '../types';

export const usePBCData = () => {
  const [data, setData] = useState<DataPoint[]>([]);
  const [analysis, setAnalysis] = useState<PBCAnalysis | null>(null);
  
  return {
    data,
    setData,
    analysis,
    setAnalysis
  };
};
