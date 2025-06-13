export interface DataPoint {
  timestamp: Date;
  value: number;
  label?: string;
  // Enhanced properties for Nave integration
  taskKey?: string;
  taskName?: string;
  cycleTimeDays?: number;
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

// Fixed throughput period types
export type ThroughputPeriod = 'daily' | 'weekly' | 'monthly';

export interface ThroughputDataPoint {
  periodStart: Date;
  periodEnd: Date;
  itemCount: number;
  itemsCompleted: string[];
  period: ThroughputPeriod;
}

export interface ThroughputAnalysis {
  throughputData: ThroughputDataPoint[];
  averageThroughput: number;
  medianThroughput: number;
  minThroughput: number;
  maxThroughput: number;
  period: ThroughputPeriod;
  totalPeriods: number;
  totalItemsCompleted: number;
  predictabilityScore: number;
}

export interface ThroughputResponse {
  throughputAnalysis: ThroughputAnalysis;
  xChart: XChart;
  mrChart: MRChart;
  signals: Signal[];
  limits: ProcessLimits;
  baselinePeriod: number;
  recommendations: string[];
}

export interface ChartConfiguration {
  baselinePeriod: number;
  showSigmaLines: boolean;
  detectionRules: string[];
  timeFormat: string;
  // Enhanced for throughput
  metricType: 'cycle_time' | 'throughput';
  throughputPeriod: ThroughputPeriod;
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
  // Enhanced for Nave integration
  taskKeys?: string[];
  taskNames?: string[];
}

export interface MRChart {
  timestamps: string[];
  values: number[];
  average: number;
  upperLimit: number;
}

// Enhanced PBC Analysis to support throughput
export interface PBCAnalysis {
  xChart: XChart;
  mrChart: MRChart;
  signals: Signal[];
  limits: ProcessLimits;
  baselinePeriod: number;
  // Enhanced for throughput support
  throughputAnalysis?: ThroughputAnalysis;
  recommendations?: string[];
  metricType?: 'cycle_time' | 'throughput';
}

// Detection Rule Types based on Western Electric Zone Tests
export type DetectionRuleType = 'rule1' | 'rule2' | 'rule3' | 'rule4';

export interface DetectionRule {
  type: DetectionRuleType;
  name: string;
  description: string;
  enabled: boolean;
}

// Flow Metrics Types
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

// Constants
export const THROUGHPUT_PERIODS = {
  daily: 'Daily',
  weekly: 'Weekly', 
  monthly: 'Monthly'
} as const;

export const METRIC_TYPES = {
  cycle_time: 'Cycle Time',
  throughput: 'Throughput'
} as const;

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
