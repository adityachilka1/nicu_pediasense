'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { MQTT_CONFIG, MQTT_TOPICS, parseTopic } from '@/lib/mqtt/config';

/**
 * Custom hook for subscribing to real-time patient vitals via MQTT
 *
 * @param {string|number} patientId - The patient ID to subscribe to
 * @param {Object} options - Configuration options
 * @param {boolean} options.enabled - Whether to enable MQTT connection (default: true)
 * @param {Function} options.onAlarm - Callback when alarm is received
 * @param {Function} options.onConnectionChange - Callback when connection status changes
 * @returns {Object} - Vitals data and connection status
 */
export function useMQTTVitals(patientId, options = {}) {
  const { enabled = true, onAlarm, onConnectionChange } = options;

  const [vitals, setVitals] = useState({
    heartRate: null,
    spo2: null,
    respiration: null,
    temperature: null,
    bloodPressure: null,
    fio2: null,
    pi: null,
  });

  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [lastUpdate, setLastUpdate] = useState(null);
  const clientRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);

  // Map MQTT vital types to state keys
  const vitalTypeMap = {
    heart_rate: 'heartRate',
    spo2: 'spo2',
    respiration: 'respiration',
    temperature: 'temperature',
    blood_pressure: 'bloodPressure',
    fio2: 'fio2',
    pi: 'pi',
    pr: 'heartRate', // Pulse rate maps to heart rate
    rr: 'respiration',
    temp: 'temperature',
  };

  const handleMessage = useCallback((topic, payload) => {
    try {
      const data = JSON.parse(payload.toString());
      const parsed = parseTopic(topic);

      if (!parsed) return;

      // Handle vitals
      if (parsed.dataType === 'vitals') {
        const stateKey = vitalTypeMap[parsed.subType] || parsed.subType;
        setVitals(prev => ({
          ...prev,
          [stateKey]: data.value,
          [`${stateKey}_raw`]: data, // Store full payload for metadata
        }));
        setLastUpdate(new Date());
      }

      // Handle alarms
      if (parsed.dataType === 'alarms' && onAlarm) {
        onAlarm(data);
      }
    } catch (error) {
      console.error('Error parsing MQTT message:', error);
    }
  }, [onAlarm]);

  useEffect(() => {
    if (!enabled || !patientId) return;

    // Only run in browser
    if (typeof window === 'undefined') return;

    let client = null;
    let mounted = true;

    const connect = async () => {
      try {
        // Dynamically import mqtt to avoid SSR issues
        const mqtt = (await import('mqtt')).default;

        if (!mounted) return;

        setConnectionStatus('connecting');

        client = mqtt.connect(MQTT_CONFIG.brokerUrl, {
          ...MQTT_CONFIG.options,
          clientId: `nicu-patient-${patientId}-${Math.random().toString(16).slice(2, 8)}`,
        });

        client.on('connect', () => {
          if (!mounted) return;
          console.log(`MQTT connected for patient ${patientId}`);
          setConnectionStatus('connected');
          reconnectAttemptsRef.current = 0;
          onConnectionChange?.('connected');

          // Subscribe to patient vitals
          const vitalsTopic = MQTT_TOPICS.patientVitals(patientId);
          client.subscribe(vitalsTopic, { qos: MQTT_CONFIG.qos.vitals }, (err) => {
            if (err) {
              console.error('Subscribe error:', err);
            } else {
              console.log(`Subscribed to: ${vitalsTopic}`);
            }
          });

          // Subscribe to alarms with higher QoS
          const alarmsTopic = MQTT_TOPICS.patientAlarms(patientId);
          client.subscribe(alarmsTopic, { qos: MQTT_CONFIG.qos.alarms });
        });

        client.on('message', handleMessage);

        client.on('error', (error) => {
          console.error('MQTT error:', error);
          if (mounted) {
            setConnectionStatus('error');
            onConnectionChange?.('error');
          }
        });

        client.on('close', () => {
          console.log('MQTT connection closed');
          if (mounted) {
            setConnectionStatus('disconnected');
            onConnectionChange?.('disconnected');
          }
        });

        client.on('reconnect', () => {
          reconnectAttemptsRef.current += 1;
          console.log(`MQTT reconnecting... attempt ${reconnectAttemptsRef.current}`);
          if (mounted) {
            setConnectionStatus('reconnecting');
          }
        });

        clientRef.current = client;
      } catch (error) {
        console.error('Failed to connect to MQTT:', error);
        if (mounted) {
          setConnectionStatus('error');
        }
      }
    };

    connect();

    return () => {
      mounted = false;
      if (client) {
        client.end(true);
      }
    };
  }, [patientId, enabled, handleMessage, onConnectionChange]);

  // Method to publish a command (e.g., acknowledge alarm)
  const publish = useCallback((topic, message, options = {}) => {
    if (clientRef.current?.connected) {
      clientRef.current.publish(
        topic,
        JSON.stringify(message),
        { qos: options.qos || MQTT_CONFIG.qos.commands }
      );
    }
  }, []);

  return {
    vitals,
    connectionStatus,
    lastUpdate,
    isConnected: connectionStatus === 'connected',
    publish,
  };
}

/**
 * Hook for subscribing to all patients in a unit
 */
export function useMQTTUnit(unitId, options = {}) {
  const { enabled = true, onVitalUpdate, onAlarm } = options;

  const [patients, setPatients] = useState({});
  const [connectionStatus, setConnectionStatus] = useState('disconnected');

  const handleMessage = useCallback((topic, payload) => {
    try {
      const data = JSON.parse(payload.toString());
      const parsed = parseTopic(topic);

      if (!parsed) return;

      if (parsed.dataType === 'vitals') {
        setPatients(prev => ({
          ...prev,
          [parsed.patientId]: {
            ...prev[parsed.patientId],
            [parsed.subType]: data.value,
            lastUpdate: new Date(),
          },
        }));
        onVitalUpdate?.(parsed.patientId, parsed.subType, data);
      }

      if (parsed.dataType === 'alarms') {
        onAlarm?.(parsed.patientId, data);
      }
    } catch (error) {
      console.error('Error parsing MQTT message:', error);
    }
  }, [onVitalUpdate, onAlarm]);

  useEffect(() => {
    if (!enabled || !unitId) return;
    if (typeof window === 'undefined') return;

    let client = null;
    let mounted = true;

    const connect = async () => {
      try {
        const mqtt = (await import('mqtt')).default;

        if (!mounted) return;

        client = mqtt.connect(MQTT_CONFIG.brokerUrl, {
          ...MQTT_CONFIG.options,
          clientId: `nicu-unit-${unitId}-${Math.random().toString(16).slice(2, 8)}`,
        });

        client.on('connect', () => {
          if (!mounted) return;
          setConnectionStatus('connected');

          // Subscribe to all patient vitals in unit
          client.subscribe(MQTT_TOPICS.unitVitals(unitId), { qos: 0 });
          client.subscribe(MQTT_TOPICS.unitAlarms(unitId), { qos: 2 });
        });

        client.on('message', handleMessage);
        client.on('error', () => mounted && setConnectionStatus('error'));
        client.on('close', () => mounted && setConnectionStatus('disconnected'));

      } catch (error) {
        console.error('Failed to connect to MQTT:', error);
      }
    };

    connect();

    return () => {
      mounted = false;
      if (client) {
        client.end(true);
      }
    };
  }, [unitId, enabled, handleMessage]);

  return {
    patients,
    connectionStatus,
    isConnected: connectionStatus === 'connected',
  };
}

export default useMQTTVitals;
