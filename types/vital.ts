/**
 * NICU Dashboard - Vital Signs Type Definitions
 */

import type { VitalSource, VitalParameter } from './enums';

/**
 * Single vital sign reading
 */
export interface Vital {
  id: number;
  patientId: number;
  heartRate: number | null;
  spo2: number | null;
  respRate: number | null;
  temperature: number | null;
  fio2: number | null;
  pi: number | null; // Perfusion Index
  bpSystolic: number | null;
  bpDiastolic: number | null;
  bpMean: number | null;
  source: VitalSource;
  recordedAt: Date;
}

/**
 * Latest vitals for a patient (for dashboard display)
 */
export interface LatestVitals {
  heartRate: number | null;
  spo2: number | null;
  respRate: number | null;
  temperature: number | null;
  fio2: number | null;
  pi: number | null;
  bpSystolic: number | null;
  bpDiastolic: number | null;
  bpMean: number | null;
  recordedAt: Date | null;
}

/**
 * Vital sign with trend information
 */
export interface VitalWithTrend extends Vital {
  trend: 'up' | 'down' | 'stable' | null;
  changePercent: number | null;
}

/**
 * Blood pressure reading
 */
export interface BloodPressure {
  systolic: number;
  diastolic: number;
  mean: number;
  recordedAt: Date;
}

/**
 * Vital sign range limits
 */
export interface VitalRange {
  min: number;
  max: number;
  warningMin?: number;
  warningMax?: number;
  criticalMin?: number;
  criticalMax?: number;
}

/**
 * Vital sign configuration
 */
export interface VitalConfig {
  parameter: VitalParameter;
  label: string;
  unit: string;
  normalRange: VitalRange;
  displayPrecision: number;
  color?: string;
}

/**
 * Create vital sign request
 */
export interface CreateVitalRequest {
  patientId: number;
  heartRate?: number;
  spo2?: number;
  respRate?: number;
  temperature?: number;
  fio2?: number;
  pi?: number;
  bpSystolic?: number;
  bpDiastolic?: number;
  bpMean?: number;
  source?: VitalSource;
  recordedAt?: string; // ISO date string
}

/**
 * Vital sign batch insert request
 */
export interface BatchVitalsRequest {
  patientId: number;
  vitals: Omit<CreateVitalRequest, 'patientId'>[];
}

/**
 * Vital signs query filters
 */
export interface VitalQueryFilters {
  patientId: number;
  startDate?: string;
  endDate?: string;
  parameters?: VitalParameter[];
  source?: VitalSource;
  limit?: number;
  offset?: number;
}

/**
 * Vital signs time series data point
 */
export interface VitalTimeSeriesPoint {
  timestamp: string;
  value: number | null;
}

/**
 * Vital signs time series for a parameter
 */
export interface VitalTimeSeries {
  parameter: VitalParameter;
  label: string;
  unit: string;
  data: VitalTimeSeriesPoint[];
  stats: {
    min: number | null;
    max: number | null;
    avg: number | null;
    count: number;
  };
}

/**
 * Vital signs chart data
 */
export interface VitalChartData {
  patientId: number;
  startDate: string;
  endDate: string;
  series: VitalTimeSeries[];
}

/**
 * Real-time vital sign update (from MQTT)
 */
export interface RealtimeVitalUpdate {
  patientId: number;
  bedId: number;
  timestamp: string;
  source: string;
  values: {
    heartRate?: number;
    spo2?: number;
    respRate?: number;
    temperature?: number;
    fio2?: number;
    pi?: number;
    bpSystolic?: number;
    bpDiastolic?: number;
    bpMean?: number;
  };
}

/**
 * Vital sign statistics summary
 */
export interface VitalStatsSummary {
  parameter: VitalParameter;
  period: string; // e.g., "24h", "7d"
  min: number | null;
  max: number | null;
  avg: number | null;
  median: number | null;
  stdDev: number | null;
  count: number;
  outOfRangeCount: number;
  trendDirection: 'improving' | 'stable' | 'worsening' | null;
}

/**
 * Default vital sign configurations
 */
export const VITAL_CONFIGS: Record<string, VitalConfig> = {
  spo2: {
    parameter: 'spo2' as VitalParameter,
    label: 'SpO2',
    unit: '%',
    normalRange: { min: 88, max: 100, warningMin: 85, criticalMin: 80 },
    displayPrecision: 0,
    color: '#3B82F6', // blue
  },
  heartRate: {
    parameter: 'pr' as VitalParameter,
    label: 'Heart Rate',
    unit: 'bpm',
    normalRange: { min: 100, max: 180, warningMin: 90, warningMax: 200, criticalMin: 80, criticalMax: 220 },
    displayPrecision: 0,
    color: '#EF4444', // red
  },
  respRate: {
    parameter: 'rr' as VitalParameter,
    label: 'Respiratory Rate',
    unit: '/min',
    normalRange: { min: 25, max: 70, warningMin: 20, warningMax: 80, criticalMin: 15, criticalMax: 90 },
    displayPrecision: 0,
    color: '#10B981', // green
  },
  temperature: {
    parameter: 'temp' as VitalParameter,
    label: 'Temperature',
    unit: '\u00B0C',
    normalRange: { min: 36.5, max: 37.5, warningMin: 36.0, warningMax: 38.0, criticalMin: 35.5, criticalMax: 38.5 },
    displayPrecision: 1,
    color: '#F59E0B', // amber
  },
  pi: {
    parameter: 'pi' as VitalParameter,
    label: 'Perfusion Index',
    unit: '%',
    normalRange: { min: 0.5, max: 10, warningMin: 0.3 },
    displayPrecision: 2,
    color: '#8B5CF6', // purple
  },
};
