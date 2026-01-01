/**
 * MQTT Configuration for NICU Dashboard
 *
 * This module provides MQTT 5.0 configuration for real-time vitals streaming.
 * In development, use the local Aedes broker.
 * In production, connect to EMQX Cloud or your MQTT broker.
 */

export const MQTT_CONFIG = {
  // Connection settings
  // Note: websocket-stream doesn't require /mqtt path
  brokerUrl: process.env.NEXT_PUBLIC_MQTT_BROKER_URL || 'ws://localhost:8083',

  // MQTT options (using 3.1.1 for better compatibility with Aedes)
  options: {
    protocolVersion: 4,  // MQTT 3.1.1 for better Aedes compatibility
    clean: true,
    connectTimeout: 10000,
    reconnectPeriod: 2000,
    clientId: `nicu-dashboard-${typeof window !== 'undefined' ? Math.random().toString(16).slice(2, 10) : 'server'}`,

    // Authentication (optional - set via environment variables)
    username: process.env.NEXT_PUBLIC_MQTT_USERNAME || undefined,
    password: process.env.NEXT_PUBLIC_MQTT_PASSWORD || undefined,
  },

  // Quality of Service levels
  qos: {
    vitals: 0,      // At most once - OK for high-frequency vitals
    alarms: 2,      // Exactly once - critical for alarms
    commands: 1,    // At least once - for control commands
  },
};

/**
 * MQTT Topic Structure for NICU
 *
 * Pattern: nicu/{unit_id}/patient/{patient_id}/{data_type}/{subtype}
 */
export const MQTT_TOPICS = {
  // Patient vitals - high frequency updates
  patientVitals: (patientId) => `nicu/+/patient/${patientId}/vitals/#`,
  specificVital: (unitId, patientId, vitalType) =>
    `nicu/${unitId}/patient/${patientId}/vitals/${vitalType}`,

  // All vitals for a unit
  unitVitals: (unitId) => `nicu/${unitId}/patient/+/vitals/#`,

  // Alarms
  patientAlarms: (patientId) => `nicu/+/patient/${patientId}/alarms/#`,
  unitAlarms: (unitId) => `nicu/${unitId}/patient/+/alarms/#`,

  // Device status
  deviceStatus: (deviceId) => `nicu/+/device/${deviceId}/status`,

  // Waveforms (ECG, Pleth)
  patientWaveform: (patientId, waveformType) =>
    `nicu/+/patient/${patientId}/waveform/${waveformType}`,
};

/**
 * Vital sign message payload schema
 */
export const createVitalPayload = (value, unit, options = {}) => ({
  value,
  unit,
  timestamp: new Date().toISOString(),
  device_id: options.deviceId || 'monitor-001',
  quality: options.quality || 'good',
  alarm_state: options.alarmState || 'normal',
  ...options.extra,
});

/**
 * Parse topic to extract components
 */
export const parseTopic = (topic) => {
  const parts = topic.split('/');
  // Expected: nicu/{unitId}/patient/{patientId}/vitals/{vitalType}
  if (parts.length >= 6 && parts[0] === 'nicu') {
    return {
      unitId: parts[1],
      patientId: parts[3],
      dataType: parts[4],
      subType: parts[5],
    };
  }
  return null;
};
