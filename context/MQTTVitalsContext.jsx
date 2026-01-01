'use client';

import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { MQTT_CONFIG, MQTT_TOPICS, parseTopic } from '@/lib/mqtt/config';

/**
 * MQTT Vitals Context
 *
 * Provides real-time vitals streaming via MQTT 5.0 for the NICU Dashboard.
 * Integrates with the existing VitalsContext by providing an MQTT data source.
 */

// MQTT Connection states
export const MQTT_STATUS = {
  DISCONNECTED: 'disconnected',
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  RECONNECTING: 'reconnecting',
  ERROR: 'error',
};

const MQTTVitalsContext = createContext(null);

export function MQTTVitalsProvider({ children, unitId = 'unit-a' }) {
  const [connectionStatus, setConnectionStatus] = useState(MQTT_STATUS.DISCONNECTED);
  const [vitalsMap, setVitalsMap] = useState({});
  const [alarmsQueue, setAlarmsQueue] = useState([]);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [messageCount, setMessageCount] = useState(0);
  const [subscribedTopics, setSubscribedTopics] = useState([]);

  const clientRef = useRef(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 10;

  // Map MQTT vital types to our state keys
  const vitalTypeMap = {
    heart_rate: 'pr',
    spo2: 'spo2',
    respiration: 'rr',
    temperature: 'temp',
    temp: 'temp',
    pr: 'pr',
    rr: 'rr',
    fio2: 'fio2',
    pi: 'pi',
    bp: 'bp',
    blood_pressure: 'bp',
  };

  // Vital types that are objects (not simple values)
  const objectVitalTypes = ['bp', 'blood_pressure'];

  // Handle incoming MQTT messages
  const handleMessage = useCallback((topic, payload) => {
    try {
      const data = JSON.parse(payload.toString());
      const parsed = parseTopic(topic);

      if (!parsed) return;

      setMessageCount(c => c + 1);
      setLastUpdate(new Date());

      // Handle vitals
      if (parsed.dataType === 'vitals') {
        const patientId = parseInt(parsed.patientId);
        const stateKey = vitalTypeMap[parsed.subType] || parsed.subType;
        const isObjectType = objectVitalTypes.includes(parsed.subType);

        setVitalsMap(prev => {
          const prevPatient = prev[patientId] || {};
          const prevValue = prevPatient[stateKey];

          // For object types (like BP), store the whole object
          if (isObjectType) {
            // Calculate trend based on MAP for blood pressure
            let trend = 'stable';
            if (prevValue?.map !== undefined && data.value?.map !== undefined) {
              const diff = data.value.map - prevValue.map;
              if (Math.abs(diff) >= 3) {
                trend = diff > 0 ? 'up' : 'down';
              }
            }

            return {
              ...prev,
              [patientId]: {
                ...prevPatient,
                [stateKey]: data.value, // { systolic, diastolic, map }
                [`${stateKey}Trend`]: trend,
                [`${stateKey}Changed`]: prevValue?.map !== undefined && Math.abs((data.value?.map || 0) - (prevValue?.map || 0)) >= 3,
                [`${stateKey}Raw`]: data,
                timestamp: Date.now(),
                source: 'mqtt',
              },
            };
          }

          // Calculate trend for simple values
          let trend = 'stable';
          if (prevValue !== undefined && prevValue !== null) {
            const diff = data.value - prevValue;
            const threshold = stateKey === 'spo2' ? 1 : stateKey === 'temp' ? 0.2 : 3;
            if (Math.abs(diff) >= threshold) {
              trend = diff > 0 ? 'up' : 'down';
            }
          }

          return {
            ...prev,
            [patientId]: {
              ...prevPatient,
              [stateKey]: data.value,
              [`${stateKey}Trend`]: trend,
              [`${stateKey}Changed`]: prevValue !== undefined && Math.abs(data.value - prevValue) >= (stateKey === 'spo2' ? 2 : 3),
              [`${stateKey}Raw`]: data,
              timestamp: Date.now(),
              source: 'mqtt',
            },
          };
        });
      }

      // Handle alarms
      if (parsed.dataType === 'alarms') {
        const alarm = {
          id: `${parsed.patientId}-${Date.now()}`,
          patientId: parseInt(parsed.patientId),
          ...data,
          receivedAt: new Date(),
        };

        setAlarmsQueue(prev => [alarm, ...prev.slice(0, 99)]); // Keep last 100 alarms
      }
    } catch (error) {
      console.error('Error parsing MQTT message:', error);
    }
  }, []);

  // Connect to MQTT broker
  const connect = useCallback(async () => {
    if (typeof window === 'undefined') return;
    if (clientRef.current?.connected) return;

    try {
      setConnectionStatus(MQTT_STATUS.CONNECTING);

      // Dynamic import to avoid SSR issues
      const mqtt = (await import('mqtt')).default;

      const client = mqtt.connect(MQTT_CONFIG.brokerUrl, {
        ...MQTT_CONFIG.options,
        clientId: `nicu-unit-${unitId}-${Math.random().toString(16).slice(2, 8)}`,
      });

      client.on('connect', () => {
        console.log('MQTT Connected to broker');
        setConnectionStatus(MQTT_STATUS.CONNECTED);
        reconnectAttemptsRef.current = 0;

        // Subscribe to all patient vitals in the unit
        const vitalsTopic = MQTT_TOPICS.unitVitals(unitId);
        const alarmsTopic = MQTT_TOPICS.unitAlarms(unitId);

        client.subscribe(vitalsTopic, { qos: 0 }, (err) => {
          if (!err) {
            console.log(`Subscribed to: ${vitalsTopic}`);
            setSubscribedTopics(prev => [...prev, vitalsTopic]);
          }
        });

        client.subscribe(alarmsTopic, { qos: 2 }, (err) => {
          if (!err) {
            console.log(`Subscribed to: ${alarmsTopic}`);
            setSubscribedTopics(prev => [...prev, alarmsTopic]);
          }
        });
      });

      client.on('message', handleMessage);

      client.on('error', (error) => {
        console.error('MQTT error:', error);
        setConnectionStatus(MQTT_STATUS.ERROR);
      });

      client.on('close', () => {
        console.log('MQTT connection closed');
        setConnectionStatus(MQTT_STATUS.DISCONNECTED);
        setSubscribedTopics([]);
      });

      client.on('reconnect', () => {
        reconnectAttemptsRef.current += 1;
        console.log(`MQTT reconnecting... attempt ${reconnectAttemptsRef.current}`);
        setConnectionStatus(MQTT_STATUS.RECONNECTING);

        if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
          console.log('Max reconnect attempts reached, stopping');
          client.end(true);
        }
      });

      client.on('offline', () => {
        console.log('MQTT offline');
        setConnectionStatus(MQTT_STATUS.DISCONNECTED);
      });

      clientRef.current = client;
    } catch (error) {
      console.error('Failed to connect to MQTT:', error);
      setConnectionStatus(MQTT_STATUS.ERROR);
    }
  }, [unitId, handleMessage]);

  // Disconnect from MQTT broker
  const disconnect = useCallback(() => {
    if (clientRef.current) {
      clientRef.current.end(true);
      clientRef.current = null;
      setConnectionStatus(MQTT_STATUS.DISCONNECTED);
      setSubscribedTopics([]);
    }
  }, []);

  // Subscribe to a specific patient
  const subscribeToPatient = useCallback((patientId) => {
    if (!clientRef.current?.connected) return;

    const topic = MQTT_TOPICS.patientVitals(patientId);
    clientRef.current.subscribe(topic, { qos: 0 }, (err) => {
      if (!err) {
        setSubscribedTopics(prev => [...prev, topic]);
      }
    });
  }, []);

  // Unsubscribe from a specific patient
  const unsubscribeFromPatient = useCallback((patientId) => {
    if (!clientRef.current?.connected) return;

    const topic = MQTT_TOPICS.patientVitals(patientId);
    clientRef.current.unsubscribe(topic, (err) => {
      if (!err) {
        setSubscribedTopics(prev => prev.filter(t => t !== topic));
      }
    });
  }, []);

  // Publish an alarm acknowledgment
  const acknowledgeAlarm = useCallback((patientId, alarmId) => {
    if (!clientRef.current?.connected) return;

    const topic = `nicu/${unitId}/patient/${patientId}/alarms/ack`;
    clientRef.current.publish(topic, JSON.stringify({
      alarmId,
      acknowledgedAt: new Date().toISOString(),
      acknowledgedBy: 'current-user', // Would be from auth context
    }), { qos: 1 });
  }, [unitId]);

  // Clear alarms queue
  const clearAlarms = useCallback(() => {
    setAlarmsQueue([]);
  }, []);

  // Get vitals for a specific patient
  const getPatientVitals = useCallback((patientId) => {
    return vitalsMap[patientId] || null;
  }, [vitalsMap]);

  // Initialize connection on mount
  useEffect(() => {
    connect();
    return () => disconnect();
  }, [connect, disconnect]);

  const value = {
    // Connection state
    connectionStatus,
    isConnected: connectionStatus === MQTT_STATUS.CONNECTED,
    subscribedTopics,

    // Data
    vitalsMap,
    alarmsQueue,
    lastUpdate,
    messageCount,

    // Methods
    connect,
    disconnect,
    subscribeToPatient,
    unsubscribeFromPatient,
    acknowledgeAlarm,
    clearAlarms,
    getPatientVitals,

    // Constants
    MQTT_STATUS,
  };

  return (
    <MQTTVitalsContext.Provider value={value}>
      {children}
    </MQTTVitalsContext.Provider>
  );
}

// Hook to use MQTT vitals context
export function useMQTTVitals() {
  const context = useContext(MQTTVitalsContext);
  if (!context) {
    // Return a safe default when not in provider
    return {
      connectionStatus: MQTT_STATUS.DISCONNECTED,
      isConnected: false,
      vitalsMap: {},
      alarmsQueue: [],
      lastUpdate: null,
      messageCount: 0,
      subscribedTopics: [],
      connect: () => {},
      disconnect: () => {},
      subscribeToPatient: () => {},
      unsubscribeFromPatient: () => {},
      acknowledgeAlarm: () => {},
      clearAlarms: () => {},
      getPatientVitals: () => null,
      MQTT_STATUS,
    };
  }
  return context;
}

export default MQTTVitalsContext;
