#!/usr/bin/env node

/**
 * Mock Vitals Publisher for NICU Dashboard Development
 *
 * Simulates 8 patient monitors publishing real-time vitals data via MQTT.
 * Generates realistic vital signs with appropriate variability and occasional alarms.
 *
 * Usage:
 *   node scripts/mock-vitals-publisher.js
 *
 * Options:
 *   --patients=N     Number of patients to simulate (default: 8)
 *   --interval=N     Publishing interval in ms (default: 1000)
 *   --broker=URL     MQTT broker URL (default: mqtt://localhost:1883)
 */

const mqtt = require('mqtt');

// Parse command line arguments
const args = process.argv.slice(2).reduce((acc, arg) => {
  const [key, value] = arg.replace('--', '').split('=');
  acc[key] = value;
  return acc;
}, {});

// Configuration
const CONFIG = {
  brokerUrl: args.broker || process.env.MQTT_BROKER_URL || 'mqtt://localhost:1883',
  patientCount: parseInt(args.patients || '8', 10),
  publishInterval: parseInt(args.interval || '1000', 10),
  unitId: 'unit-a',
};

// Patient base data (matching your existing mock data structure)
// BP values based on gestational age - MAP should roughly equal GA in weeks
const PATIENTS = [
  { id: 1, name: 'Baby Smith', ga: 28, baseSPO2: 94, basePR: 155, baseRR: 48, baseTemp: 36.8, baseSystolic: 48, baseDiastolic: 26 },
  { id: 2, name: 'Baby Johnson', ga: 32, baseSPO2: 96, basePR: 145, baseRR: 42, baseTemp: 36.9, baseSystolic: 55, baseDiastolic: 32 },
  { id: 3, name: 'Baby Williams', ga: 26, baseSPO2: 92, basePR: 160, baseRR: 52, baseTemp: 36.7, baseSystolic: 45, baseDiastolic: 24 },
  { id: 4, name: 'Baby Brown', ga: 34, baseSPO2: 97, basePR: 140, baseRR: 38, baseTemp: 37.0, baseSystolic: 58, baseDiastolic: 35 },
  { id: 5, name: 'Baby Davis', ga: 30, baseSPO2: 95, basePR: 150, baseRR: 45, baseTemp: 36.8, baseSystolic: 52, baseDiastolic: 30 },
  { id: 6, name: 'Baby Miller', ga: 29, baseSPO2: 93, basePR: 158, baseRR: 50, baseTemp: 36.6, baseSystolic: 50, baseDiastolic: 28 },
  { id: 7, name: 'Baby Wilson', ga: 33, baseSPO2: 96, basePR: 142, baseRR: 40, baseTemp: 36.9, baseSystolic: 56, baseDiastolic: 33 },
  { id: 8, name: 'Baby Taylor', ga: 27, baseSPO2: 91, basePR: 162, baseRR: 55, baseTemp: 36.7, baseSystolic: 46, baseDiastolic: 25 },
];

// Alarm limits per gestational age category
const ALARM_LIMITS = {
  preterm: { // < 32 weeks
    spo2: [85, 95],
    pr: [100, 180],
    rr: [25, 70],
    temp: [36.0, 38.0],
    map: [24, 40], // MAP should be >= GA in weeks
  },
  latePreterm: { // 32-37 weeks
    spo2: [88, 98],
    pr: [100, 170],
    rr: [25, 60],
    temp: [36.5, 37.5],
    map: [30, 50],
  },
};

// Patient state tracking (for realistic trends)
const patientState = {};

// Initialize patient states
PATIENTS.forEach(patient => {
  patientState[patient.id] = {
    spo2: patient.baseSPO2,
    pr: patient.basePR,
    rr: patient.baseRR,
    temp: patient.baseTemp,
    systolic: patient.baseSystolic,
    diastolic: patient.baseDiastolic,
    fio2: patient.ga < 30 ? 30 : 21,
    pi: 1.5 + Math.random() * 2,
    // Track alarm state
    alarmState: 'normal',
    // Random walk drift
    drifts: {
      spo2: 0,
      pr: 0,
      rr: 0,
      temp: 0,
      systolic: 0,
      diastolic: 0,
    },
  };
});

/**
 * Generate realistic vital sign value with random walk
 */
function generateVital(patientId, vitalType, baseValue, variance, limits) {
  const state = patientState[patientId];

  // Random walk with mean reversion
  const drift = state.drifts[vitalType];
  const meanReversion = (baseValue - (state[vitalType] || baseValue)) * 0.05;
  const newDrift = drift * 0.9 + (Math.random() - 0.5) * variance * 0.3;
  state.drifts[vitalType] = newDrift;

  // Calculate new value
  let newValue = (state[vitalType] || baseValue) + meanReversion + newDrift;

  // Occasional larger variations (simulating patient events)
  if (Math.random() < 0.02) {
    newValue += (Math.random() - 0.5) * variance * 2;
  }

  // Rare alarm-level events
  if (Math.random() < 0.005) {
    newValue = limits[Math.random() < 0.5 ? 0 : 1] + (Math.random() - 0.5) * 3;
  }

  // Clamp to reasonable range
  newValue = Math.max(limits[0] - 5, Math.min(limits[1] + 5, newValue));

  // Update state
  state[vitalType] = newValue;

  // Determine alarm state
  let alarmState = 'normal';
  if (newValue < limits[0]) alarmState = 'low';
  else if (newValue > limits[1]) alarmState = 'high';

  return {
    value: Math.round(newValue * 10) / 10,
    alarmState,
  };
}

/**
 * Get alarm limits for a patient based on GA
 */
function getLimits(ga) {
  return ga < 32 ? ALARM_LIMITS.preterm : ALARM_LIMITS.latePreterm;
}

/**
 * Create MQTT message payload
 */
function createPayload(value, unit, options = {}) {
  return JSON.stringify({
    value,
    unit,
    timestamp: new Date().toISOString(),
    device_id: options.deviceId || `monitor-${options.patientId || '001'}`,
    quality: options.quality || 'good',
    alarm_state: options.alarmState || 'normal',
  });
}

/**
 * Generate blood pressure values (systolic, diastolic, MAP)
 * MAP = Diastolic + 1/3(Systolic - Diastolic)
 */
function generateBloodPressure(patientId, patient, limits) {
  const state = patientState[patientId];

  // Generate systolic with random walk
  const systolic = generateVital(patientId, 'systolic', patient.baseSystolic, 4, [30, 70]);
  // Diastolic follows systolic but with less variance
  const diastolic = generateVital(patientId, 'diastolic', patient.baseDiastolic, 3, [20, 50]);

  // Calculate MAP: Diastolic + 1/3(Systolic - Diastolic)
  const map = Math.round(diastolic.value + (systolic.value - diastolic.value) / 3);

  // Check MAP alarm state (MAP should be >= GA in weeks for neonates)
  let mapAlarmState = 'normal';
  if (map < limits.map[0]) mapAlarmState = 'low';
  else if (map > limits.map[1]) mapAlarmState = 'high';

  return {
    systolic: Math.round(systolic.value),
    diastolic: Math.round(diastolic.value),
    map,
    alarmState: mapAlarmState,
  };
}

/**
 * Publish vitals for all patients
 */
function publishVitals(client) {
  PATIENTS.slice(0, CONFIG.patientCount).forEach(patient => {
    const limits = getLimits(patient.ga);
    const state = patientState[patient.id];

    // Generate each vital sign
    const spo2 = generateVital(patient.id, 'spo2', patient.baseSPO2, 3, limits.spo2);
    const pr = generateVital(patient.id, 'pr', patient.basePR, 8, limits.pr);
    const rr = generateVital(patient.id, 'rr', patient.baseRR, 5, limits.rr);
    const temp = generateVital(patient.id, 'temp', patient.baseTemp, 0.3, limits.temp);
    const bp = generateBloodPressure(patient.id, patient, limits);

    // Update PI slowly
    state.pi = Math.max(0.5, Math.min(5.0, state.pi + (Math.random() - 0.5) * 0.1));

    const baseTopic = `nicu/${CONFIG.unitId}/patient/${patient.id}/vitals`;

    // Publish each vital as separate message
    const vitals = [
      { type: 'spo2', value: spo2.value, unit: '%', alarmState: spo2.alarmState },
      { type: 'pr', value: Math.round(pr.value), unit: 'bpm', alarmState: pr.alarmState },
      { type: 'heart_rate', value: Math.round(pr.value), unit: 'bpm', alarmState: pr.alarmState },
      { type: 'rr', value: Math.round(rr.value), unit: '/min', alarmState: rr.alarmState },
      { type: 'respiration', value: Math.round(rr.value), unit: '/min', alarmState: rr.alarmState },
      { type: 'temp', value: temp.value, unit: '°C', alarmState: temp.alarmState },
      { type: 'temperature', value: temp.value, unit: '°C', alarmState: temp.alarmState },
      { type: 'fio2', value: state.fio2, unit: '%', alarmState: 'normal' },
      { type: 'pi', value: Math.round(state.pi * 10) / 10, unit: '%', alarmState: 'normal' },
      { type: 'bp', value: { systolic: bp.systolic, diastolic: bp.diastolic, map: bp.map }, unit: 'mmHg', alarmState: bp.alarmState },
      { type: 'blood_pressure', value: { systolic: bp.systolic, diastolic: bp.diastolic, map: bp.map }, unit: 'mmHg', alarmState: bp.alarmState },
    ];

    vitals.forEach(({ type, value, unit, alarmState }) => {
      const topic = `${baseTopic}/${type}`;
      const payload = createPayload(value, unit, {
        patientId: patient.id,
        alarmState,
      });
      client.publish(topic, payload, { qos: 0 });
    });

    // Publish alarms if any vital is out of range
    const hasAlarm = [spo2, pr, rr, temp, bp].some(v => v.alarmState !== 'normal');
    if (hasAlarm) {
      const alarmTopic = `nicu/${CONFIG.unitId}/patient/${patient.id}/alarms/vital`;
      const alarmPayload = JSON.stringify({
        timestamp: new Date().toISOString(),
        patient_id: patient.id,
        alarms: [
          spo2.alarmState !== 'normal' && { type: 'spo2', state: spo2.alarmState, value: spo2.value },
          pr.alarmState !== 'normal' && { type: 'pr', state: pr.alarmState, value: Math.round(pr.value) },
          rr.alarmState !== 'normal' && { type: 'rr', state: rr.alarmState, value: Math.round(rr.value) },
          temp.alarmState !== 'normal' && { type: 'temp', state: temp.alarmState, value: temp.value },
          bp.alarmState !== 'normal' && { type: 'bp', state: bp.alarmState, value: `${bp.systolic}/${bp.diastolic} (${bp.map})` },
        ].filter(Boolean),
      });
      client.publish(alarmTopic, alarmPayload, { qos: 2 });
    }
  });
}

// Connect to MQTT broker
console.log('\n==========================================');
console.log('NICU Dashboard - Mock Vitals Publisher');
console.log('==========================================');
console.log(`Broker:    ${CONFIG.brokerUrl}`);
console.log(`Patients:  ${CONFIG.patientCount}`);
console.log(`Interval:  ${CONFIG.publishInterval}ms`);
console.log('==========================================\n');

const client = mqtt.connect(CONFIG.brokerUrl, {
  clientId: `nicu-mock-publisher-${Date.now()}`,
  clean: true,
  reconnectPeriod: 1000,
});

let publishCount = 0;
let intervalId = null;

client.on('connect', () => {
  console.log('Connected to MQTT broker');
  console.log('Publishing vitals...\n');

  // Start publishing
  intervalId = setInterval(() => {
    publishVitals(client);
    publishCount++;

    // Log every 10 seconds
    if (publishCount % 10 === 0) {
      console.log(`Published ${publishCount} updates (${CONFIG.patientCount * 9 * publishCount} messages)`);
    }
  }, CONFIG.publishInterval);
});

client.on('error', (error) => {
  console.error('MQTT Error:', error.message);
});

client.on('close', () => {
  console.log('Disconnected from broker');
  if (intervalId) {
    clearInterval(intervalId);
  }
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nStopping publisher...');
  if (intervalId) {
    clearInterval(intervalId);
  }
  client.end(true, () => {
    console.log(`Published ${publishCount} total updates`);
    process.exit(0);
  });
});
