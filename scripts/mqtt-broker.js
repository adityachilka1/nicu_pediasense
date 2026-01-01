#!/usr/bin/env node

/**
 * Local MQTT Broker for NICU Dashboard Development
 *
 * Uses Aedes - a barebone MQTT broker that can run in-process.
 * Supports MQTT 3.1.1 and 5.0 over WebSocket for browser compatibility.
 *
 * Usage:
 *   node scripts/mqtt-broker.js
 *
 * This starts:
 *   - MQTT broker on port 1883 (TCP)
 *   - MQTT broker on port 8083 (WebSocket) - for browser clients
 */

const aedes = require('aedes')();
const { createServer } = require('net');
const http = require('http');
const { WebSocketServer } = require('ws');

// Configuration
const MQTT_PORT = parseInt(process.env.MQTT_PORT || '1883', 10);
const WS_PORT = parseInt(process.env.MQTT_WS_PORT || '8083', 10);

// Create TCP server for native MQTT clients
const tcpServer = createServer(aedes.handle);

// Create HTTP server for WebSocket upgrade
const httpServer = http.createServer((req, res) => {
  res.writeHead(200);
  res.end('NICU MQTT Broker - Use WebSocket to connect');
});

// Create WebSocket server attached to HTTP server
const wss = new WebSocketServer({ server: httpServer });

wss.on('connection', (ws, req) => {
  console.log(`[WS] New WebSocket connection from ${req.socket.remoteAddress}`);

  // Create a duplex stream from the WebSocket
  const stream = createWebSocketStream(ws);

  // Let Aedes handle the MQTT protocol
  aedes.handle(stream);
});

// Helper to create a duplex stream from WebSocket
function createWebSocketStream(ws) {
  const { Duplex } = require('stream');

  const stream = new Duplex({
    read() {},
    write(chunk, encoding, callback) {
      if (ws.readyState === ws.OPEN) {
        ws.send(chunk, callback);
      } else {
        callback(new Error('WebSocket not open'));
      }
    },
    final(callback) {
      ws.close();
      callback();
    }
  });

  ws.on('message', (data) => {
    stream.push(Buffer.from(data));
  });

  ws.on('close', () => {
    stream.push(null);
    stream.destroy();
  });

  ws.on('error', (err) => {
    console.error('[WS] Error:', err.message);
    stream.destroy(err);
  });

  return stream;
}

// Start TCP server
tcpServer.listen(MQTT_PORT, () => {
  console.log(`MQTT broker started on TCP port ${MQTT_PORT}`);
});

// Start WebSocket server
httpServer.listen(WS_PORT, () => {
  console.log(`MQTT broker started on WebSocket port ${WS_PORT}`);
  console.log(`WebSocket URL: ws://localhost:${WS_PORT}`);
});

// Event handlers
aedes.on('client', (client) => {
  console.log(`[MQTT] Client connected: ${client.id}`);
});

aedes.on('clientDisconnect', (client) => {
  console.log(`[MQTT] Client disconnected: ${client.id}`);
});

aedes.on('subscribe', (subscriptions, client) => {
  subscriptions.forEach((sub) => {
    console.log(`[MQTT] Client ${client.id} subscribed to: ${sub.topic}`);
  });
});

aedes.on('publish', (packet, client) => {
  if (client) {
    // Only log non-system messages (reduce noise)
    if (!packet.topic.startsWith('$')) {
      // Only log occasionally to reduce noise
      if (Math.random() < 0.01) {
        console.log(`[MQTT] Publishing to ${packet.topic}`);
      }
    }
  }
});

aedes.on('clientError', (client, err) => {
  console.error(`[MQTT] Client ${client?.id} error:`, err.message);
});

aedes.on('connectionError', (client, err) => {
  console.error(`[MQTT] Connection error:`, err.message);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down MQTT broker...');
  aedes.close(() => {
    tcpServer.close();
    httpServer.close();
    wss.close();
    console.log('MQTT broker stopped');
    process.exit(0);
  });
});

console.log('\n========================================');
console.log('NICU Dashboard - MQTT Development Broker');
console.log('========================================');
console.log(`TCP:       mqtt://localhost:${MQTT_PORT}`);
console.log(`WebSocket: ws://localhost:${WS_PORT}`);
console.log('Press Ctrl+C to stop\n');
