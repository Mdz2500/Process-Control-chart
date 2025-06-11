export interface DataPoint {
  timestamp: Date;
  value: number;
  label?: string;
}

export interface ProcessLimits {
  average: number;
  upperLimit: number;
  lowerLimit: number;
  averageMovingRange: number;
  upperRangeLimit: number;
}

export interface Signal {
  type: 'rule1' | 'rule2' | 'rule3' | 'rule4';
  dataPoints: number[];
  description: string;
  severity: 'high' | 'moderate' | 'low';
}

export interface ChartConfiguration {
  baselinePeriod: number;
  showSigmaLines: boolean;
  detectionRules: string[];
  timeFormat: string;
}

export interface SigmaLines {
  oneSigmaUpper: number;
  oneSigmaLower: number;
  twoSigmaUpper: number;
  twoSigmaLower: number;
}

export interface XChart {
  timestamps: string[];
  values: number[];
  average: number;
  upperLimit: number;
  lowerLimit: number;
  sigmaLines: SigmaLines;
}

export interface MRChart {
  timestamps: string[];
  values: number[];
  average: number;
  upperLimit: number;
}

export interface PBCAnalysis {
  xChart: XChart;
  mrChart: MRChart;
  signals: Signal[];
  limits: ProcessLimits;
  baselinePeriod: number;
}

// Detection Rule Types based on Western Electric Zone Tests
export type DetectionRuleType = 'rule1' | 'rule2' | 'rule3' | 'rule4';

export interface DetectionRule {
  type: DetectionRuleType;
  name: string;
  description: string;
  enabled: boolean;
}

// Flow Metrics Types (for future expansion)
export interface FlowMetrics {
  cycleTime?: number;
  throughput?: number;
  wip?: number;
  workItemAge?: number;
}

// Chart Display Options
export interface ChartDisplayOptions {
  showAverage: boolean;
  showLimits: boolean;
  showSigmaLines: boolean;
  showSignals: boolean;
  colorScheme: 'default' | 'colorblind' | 'high-contrast';
}

// Export/Import Types
export interface ExportOptions {
  format: 'csv' | 'json' | 'pdf';
  includeCharts: boolean;
  includeAnalysis: boolean;
  includeRawData: boolean;
}

// API Response Types
export interface APIResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
}

// Error Types
export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

// Baseline Management Types
export interface BaselineInfo {
  startDate: Date;
  endDate: Date;
  dataPoints: number;
  isStale: boolean;
  lastUpdated: Date;
}

// Process Characterization Types
export interface ProcessCharacterization {
  isPredictable: boolean;
  variationType: 'routine' | 'exceptional' | 'mixed';
  signalCount: number;
  recommendedActions: string[];
}

// Statistical Summary Types
export interface StatisticalSummary {
  count: number;
  minimum: number;
  maximum: number;
  average: number;
  median: number;
  standardDeviation: number;
  variance: number;
  range: number;
}

// Moving Range Types
export interface MovingRangeData {
  values: number[];
  average: number;
  upperLimit: number;
}

// Time Series Analysis Types
export interface TimeSeriesMetadata {
  startDate: Date;
  endDate: Date;
  frequency: 'daily' | 'weekly' | 'monthly' | 'irregular';
  totalPoints: number;
  missingPoints: number;
}

// Chart Annotation Types
export interface ChartAnnotation {
  id: string;
  timestamp: Date;
  type: 'event' | 'change' | 'note';
  title: string;
  description: string;
  color?: string;
}

// User Preferences Types
export interface UserPreferences {
  defaultBaselinePeriod: number;
  defaultDetectionRules: DetectionRuleType[];
  defaultTimeFormat: string;
  autoUpdateLimits: boolean;
  showWarnings: boolean;
}

// Constants for the application
export const DETECTION_RULES: Record<DetectionRuleType, DetectionRule> = {
  rule1: {
    type: 'rule1',
    name: 'Rule 1: Points Outside Limits',
    description: 'Single point outside Natural Process Limits - dominant assignable cause',
    enabled: true
  },
  rule2: {
    type: 'rule2', 
    name: 'Rule 2: Two of Three Beyond 2-Sigma',
    description: 'Two out of three successive points beyond 2-sigma lines - moderate process change',
    enabled: false
  },
  rule3: {
    type: 'rule3',
    name: 'Rule 3: Four of Five Beyond 1-Sigma', 
    description: 'Four out of five successive points beyond 1-sigma lines - small sustained shift',
    enabled: false
  },
  rule4: {
    type: 'rule4',
    name: 'Rule 4: Eight Successive Same Side',
    description: 'Eight successive points on same side of average - sustained shift',
    enabled: true
  }
};

export const CHART_COLORS = {
  PRIMARY: '#2196F3',
  SECONDARY: '#f44336', 
  SUCCESS: '#4CAF50',
  WARNING: '#ff9800',
  INFO: '#2196F3',
  AVERAGE: '#4CAF50',
  UPPER_LIMIT: '#f44336',
  LOWER_LIMIT: '#f44336',
  SIGMA_1: '#9C27B0',
  SIGMA_2: '#FF9800',
  SIGNAL_HIGH: '#f44336',
  SIGNAL_MODERATE: '#ff9800',
  SIGNAL_LOW: '#ff5722'
};

export const DEFAULT_BASELINE_PERIOD = 20;
export const MINIMUM_BASELINE_PERIOD = 6;
export const MAXIMUM_BASELINE_PERIOD = 50;
export const RECOMMENDED_MIN_BASELINE = 10;
export const RECOMMENDED_MAX_BASELINE = 20;

// Validation Constants
export const VALIDATION_RULES = {
  MIN_DATA_POINTS: 3,
  RECOMMENDED_MIN_DATA_POINTS: 6,
  MAX_CYCLE_TIME_DAYS: 365,
  MIN_POSITIVE_VALUE: 0.001
};
