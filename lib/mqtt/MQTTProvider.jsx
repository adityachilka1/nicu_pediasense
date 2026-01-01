'use client';

import { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import mqtt from 'mqtt';
import { MQTT_CONFIG } from './config';

const MQTTContext = createContext(null);

/**
 * MQTT Provider Component
 *
 * Provides a shared MQTT connection for the entire application.
 * Use this at the root of your app for efficient connection management.
 */
export function MQTTProvider({ children }) {
  const [client, setClient] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('disconnected');
  const [brokerInfo, setBrokerInfo] = useState(null);
  const subscriptionsRef = useRef(new Map());
  const messageHandlersRef = useRef(new Map());

  // Initialize MQTT connection
  useEffect(() => {
    // Only run in browser
    if (typeof window === 'undefined') return;

    let mqttClient = null;

    const connect = () => {
      try {
        setConnectionStatus('connecting');

        mqttClient = mqtt.connect(MQTT_CONFIG.brokerUrl, MQTT_CONFIG.options);

        mqttClient.on('connect', (connack) => {
          console.log('MQTT Provider: Connected to broker');
          setConnectionStatus('connected');
          setBrokerInfo({
            sessionPresent: connack.sessionPresent,
            returnCode: connack.returnCode,
          });

          // Resubscribe to all topics after reconnect
          subscriptionsRef.current.forEach((options, topic) => {
            mqttClient.subscribe(topic, options);
          });
        });

        mqttClient.on('message', (topic, payload) => {
          // Find matching handlers (supports wildcards)
          messageHandlersRef.current.forEach((handlers, pattern) => {
            if (topicMatches(pattern, topic)) {
              handlers.forEach(handler => {
                try {
                  handler(topic, payload);
                } catch (error) {
                  console.error('Error in MQTT message handler:', error);
                }
              });
            }
          });
        });

        mqttClient.on('error', (error) => {
          console.error('MQTT Provider: Error', error);
          setConnectionStatus('error');
        });

        mqttClient.on('close', () => {
          console.log('MQTT Provider: Connection closed');
          setConnectionStatus('disconnected');
        });

        mqttClient.on('reconnect', () => {
          console.log('MQTT Provider: Reconnecting...');
          setConnectionStatus('reconnecting');
        });

        mqttClient.on('offline', () => {
          console.log('MQTT Provider: Offline');
          setConnectionStatus('offline');
        });

        setClient(mqttClient);
      } catch (error) {
        console.error('MQTT Provider: Failed to connect', error);
        setConnectionStatus('error');
      }
    };

    connect();

    return () => {
      if (mqttClient) {
        mqttClient.end(true);
      }
    };
  }, []);

  // Subscribe to a topic
  const subscribe = useCallback((topic, handler, options = { qos: 0 }) => {
    if (!client) return () => {};

    // Add to subscriptions map
    subscriptionsRef.current.set(topic, options);

    // Add handler
    if (!messageHandlersRef.current.has(topic)) {
      messageHandlersRef.current.set(topic, new Set());
    }
    messageHandlersRef.current.get(topic).add(handler);

    // Subscribe via MQTT
    if (client.connected) {
      client.subscribe(topic, options, (err) => {
        if (err) {
          console.error(`Failed to subscribe to ${topic}:`, err);
        }
      });
    }

    // Return unsubscribe function
    return () => {
      const handlers = messageHandlersRef.current.get(topic);
      if (handlers) {
        handlers.delete(handler);
        if (handlers.size === 0) {
          messageHandlersRef.current.delete(topic);
          subscriptionsRef.current.delete(topic);
          if (client?.connected) {
            client.unsubscribe(topic);
          }
        }
      }
    };
  }, [client]);

  // Publish a message
  const publish = useCallback((topic, message, options = { qos: 0 }) => {
    if (!client?.connected) {
      console.warn('MQTT: Cannot publish, not connected');
      return false;
    }

    const payload = typeof message === 'string' ? message : JSON.stringify(message);
    client.publish(topic, payload, options);
    return true;
  }, [client]);

  const value = {
    client,
    connectionStatus,
    brokerInfo,
    isConnected: connectionStatus === 'connected',
    subscribe,
    publish,
  };

  return (
    <MQTTContext.Provider value={value}>
      {children}
    </MQTTContext.Provider>
  );
}

/**
 * Hook to access MQTT context
 */
export function useMQTT() {
  const context = useContext(MQTTContext);
  if (!context) {
    throw new Error('useMQTT must be used within an MQTTProvider');
  }
  return context;
}

/**
 * Check if a topic matches a pattern (supports + and # wildcards)
 */
function topicMatches(pattern, topic) {
  const patternParts = pattern.split('/');
  const topicParts = topic.split('/');

  for (let i = 0; i < patternParts.length; i++) {
    const patternPart = patternParts[i];

    // Multi-level wildcard matches everything
    if (patternPart === '#') {
      return true;
    }

    // Single-level wildcard matches one level
    if (patternPart === '+') {
      continue;
    }

    // If topic is shorter than pattern (and not at #), no match
    if (i >= topicParts.length) {
      return false;
    }

    // Exact match required
    if (patternPart !== topicParts[i]) {
      return false;
    }
  }

  // Pattern and topic should be same length (unless pattern ended with #)
  return patternParts.length === topicParts.length;
}

export default MQTTProvider;
