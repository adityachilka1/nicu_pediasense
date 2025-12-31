# NICU Dashboard - Backend Architecture Review & Recommendations

**Date**: December 30, 2024
**Reviewer**: Backend System Architect
**Application**: NICU Central Monitoring Station
**Current Stack**: Next.js 16.1.1 (App Router), React 18, Client-Side Only

---

## Executive Summary

This NICU Dashboard is currently a **client-side prototype** with no backend infrastructure, API layer, database, or real-time data capabilities. For production deployment as a medical SaaS platform, a complete backend architecture is required to ensure:

- **Patient data persistence and security** (HIPAA compliance)
- **Real-time vital signs streaming** from medical devices
- **Audit logging** for regulatory compliance (FDA 21 CFR Part 11, HIPAA)
- **Multi-user authentication** and role-based access control
- **Medical device integration** (HL7/FHIR standards)
- **High availability and disaster recovery** for critical care systems

**Critical Gap**: This application currently lacks ALL backend infrastructure necessary for production medical use.

---

## 1. Data Layer Analysis (/lib/data.js)

### Current State

**File**: `/Users/adityachilka/Downloads/nicu-dashboard/lib/data.js` (561 lines)

**Structure**:
- Static in-memory JavaScript data structures
- Hard-coded patient records (8 patients)
- Medical reference data (Fenton growth charts, neonatal ranges)
- IEC 60601-1-8 color standards (medical equipment compliance)
- Evidence-based SpO2 targets (SUPPORT/BOOST-II/COT trials)

**Strengths**:
- Well-documented medical reference ranges
- Evidence-based clinical guidelines embedded in code
- Proper GA (gestational age) categorization for preemies
- IEC medical equipment standards adherence

**Critical Issues**:

1. **No Data Persistence**: All data is in-memory and lost on page refresh
2. **No Validation Layer**: Client-side data can be manipulated without sanitization
3. **No Access Control**: No authentication/authorization for patient data
4. **Single Source of Truth**: No database backing the application
5. **No Versioning**: Patient records have no audit trail or change history
6. **No Relationships**: Flat data structures, no relational integrity
7. **Scalability**: Cannot support multiple NICU units or hospitals

### Data Structure Quality

```javascript
// Example patient record structure (GOOD schema design)
{
  id: 1,
  bed: '01',
  mrn: 'MRN-48210',
  name: 'THOMPSON, BABY',
  firstName: 'Baby',
  lastName: 'Thompson',
  gender: 'F',
  dob: '2024-12-21',
  ga: '32+4',
  gaWeeks: 32,
  gaDays: 4,
  weight: 1.82,
  birthWeight: 1.65,
  dol: 8,
  status: 'normal',
  // ... vitals, medications, etc.
}
```

**Assessment**: Good domain modeling, but needs normalization for database implementation.

---

## 2. API Route Patterns

### Current State

**API Routes Found**: ZERO

```bash
# Search results:
find . -name "route.js" -o -name "route.ts"
# No results
```

**Critical Gap**: No API layer exists. The application is 100% client-side.

### Required API Structure

For a production NICU system, you need:

```
/app/api/
├── auth/
│   ├── login/route.js
│   ├── logout/route.js
│   ├── refresh/route.js
│   └── session/route.js
├── patients/
│   ├── route.js                 # GET /api/patients (list)
│   ├── [id]/route.js            # GET/PUT/DELETE /api/patients/:id
│   ├── [id]/vitals/route.js     # POST /api/patients/:id/vitals
│   ├── [id]/medications/route.js
│   ├── [id]/labs/route.js
│   ├── [id]/notes/route.js
│   └── [id]/discharge/route.js
├── vitals/
│   ├── stream/route.js          # WebSocket/SSE endpoint
│   └── history/route.js         # Historical trends
├── alarms/
│   ├── route.js                 # GET /api/alarms
│   ├── acknowledge/route.js     # POST /api/alarms/:id/acknowledge
│   └── escalate/route.js
├── devices/
│   ├── route.js                 # Device registry
│   └── [id]/status/route.js
├── audit/
│   └── route.js                 # Audit log queries (read-only)
├── orders/
│   ├── route.js
│   └── [id]/sign/route.js
├── reports/
│   └── generate/route.js
└── integration/
    ├── hl7/route.js             # HL7 message receiver
    └── fhir/route.js            # FHIR resource endpoints
```

### RESTful Design Recommendations

**1. Versioning Strategy**:
```javascript
// URL-based versioning for medical API stability
/api/v1/patients
/api/v2/patients  // Breaking changes get new version

// OR header-based
Accept: application/vnd.nicu.v1+json
```

**2. Resource Naming**:
- Use plural nouns: `/patients`, `/medications`, `/alarms`
- Nested resources: `/patients/:id/vitals`
- Actions as POST: `/alarms/:id/acknowledge` (not `/acknowledgeAlarm`)

**3. HTTP Methods**:
```
GET    /api/v1/patients          # List all patients
GET    /api/v1/patients/:id      # Get patient details
POST   /api/v1/patients          # Admit new patient
PUT    /api/v1/patients/:id      # Full update
PATCH  /api/v1/patients/:id      # Partial update
DELETE /api/v1/patients/:id      # Discharge (soft delete)
```

**4. Query Parameters**:
```
GET /api/v1/patients?status=critical&bed=01-08&sort=dol:desc
GET /api/v1/alarms?acknowledged=false&severity=critical&limit=50
GET /api/v1/vitals/history?patient_id=4&param=spo2&from=2024-12-29T00:00&resolution=5m
```

---

## 3. Data Validation & Sanitization

### Current State: NONE

**Issues**:
- No input validation on patient admission forms
- No type checking on vital signs data
- No range validation (e.g., SpO2 > 100%, negative weights)
- No SQL injection protection (no DB yet, but needed)
- No XSS sanitization for patient names/notes

### Recommended Validation Strategy

**Server-Side Validation Library**: Zod (TypeScript-first, runtime validation)

```javascript
// Example: Patient admission schema
import { z } from 'zod';

const PatientAdmitSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  gender: z.enum(['M', 'F', 'X']),
  dob: z.string().datetime(),
  mrn: z.string().regex(/^MRN-\d{5}$/),
  gaWeeks: z.number().int().min(22).max(42),
  gaDays: z.number().int().min(0).max(6),
  birthWeight: z.number().positive().max(6.0), // kg
  apgar1: z.number().int().min(0).max(10),
  apgar5: z.number().int().min(0).max(10),
  admitDiagnosis: z.array(z.string()).min(1),
  bed: z.string().regex(/^\d{2}$/),
});

// Usage in API route
export async function POST(request) {
  const body = await request.json();

  try {
    const validated = PatientAdmitSchema.parse(body);
    // Proceed with database insert
  } catch (error) {
    return Response.json({
      error: 'Validation failed',
      details: error.errors
    }, { status: 400 });
  }
}
```

**Vital Signs Validation**:
```javascript
const VitalSignSchema = z.object({
  patientId: z.number().int().positive(),
  timestamp: z.string().datetime(),
  spo2: z.number().int().min(0).max(100).nullable(),
  pr: z.number().int().min(0).max(300).nullable(),
  rr: z.number().int().min(0).max(150).nullable(),
  temp: z.number().min(25.0).max(45.0).nullable(), // Celsius
  bp: z.object({
    systolic: z.number().int().min(0).max(200),
    diastolic: z.number().int().min(0).max(150),
    map: z.number().int().min(0).max(150),
  }).nullable(),
  source: z.enum(['monitor', 'manual', 'import']),
  deviceId: z.string().optional(),
});
```

**Sanitization**:
- HTML in patient notes: Use DOMPurify or strip all HTML
- SQL injection: Use parameterized queries (Prisma ORM handles this)
- Path traversal: Validate file uploads for reports/images

---

## 4. Error Handling & Responses

### Current State

**Page-Level Error Handling**: `/Users/adityachilka/Downloads/nicu-dashboard/app/error.jsx` exists

```javascript
// Current error boundary (client-side only)
'use client';
export default function Error({ error, reset }) {
  // Generic error page
}
```

**Issues**:
- No centralized error handling middleware
- No error logging/monitoring
- No standardized error response format
- No differentiation between error types (4xx vs 5xx)

### Recommended Error Handling Architecture

**1. Standardized Error Response Format**:

```javascript
// /lib/errors.js
export class APIError extends Error {
  constructor(message, statusCode, errorCode, details = {}) {
    super(message);
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.details = details;
    this.timestamp = new Date().toISOString();
  }
}

export const ErrorCodes = {
  // 4xx Client Errors
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  PATIENT_NOT_FOUND: 'PATIENT_NOT_FOUND',
  UNAUTHORIZED: 'UNAUTHORIZED',
  INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',
  RESOURCE_CONFLICT: 'RESOURCE_CONFLICT',

  // 5xx Server Errors
  DATABASE_ERROR: 'DATABASE_ERROR',
  DEVICE_COMMUNICATION_ERROR: 'DEVICE_COMMUNICATION_ERROR',
  EXTERNAL_SERVICE_ERROR: 'EXTERNAL_SERVICE_ERROR',
};

// Standardized error response
{
  "error": {
    "code": "PATIENT_NOT_FOUND",
    "message": "Patient with MRN MRN-48210 not found",
    "statusCode": 404,
    "timestamp": "2024-12-30T12:34:56.789Z",
    "details": {
      "mrn": "MRN-48210"
    }
  }
}
```

**2. Error Handling Middleware**:

```javascript
// /lib/middleware/errorHandler.js
export function errorHandler(error, request) {
  // Log to monitoring service (Sentry, DataDog)
  console.error('[API Error]', {
    path: request.url,
    method: request.method,
    error: error.message,
    stack: error.stack,
    userId: request.user?.id,
  });

  // Don't expose internal errors to client
  if (error.statusCode >= 500) {
    return Response.json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An internal error occurred. Please contact support.',
        statusCode: 500,
        timestamp: new Date().toISOString(),
      }
    }, { status: 500 });
  }

  return Response.json({
    error: {
      code: error.errorCode || 'UNKNOWN_ERROR',
      message: error.message,
      statusCode: error.statusCode || 500,
      timestamp: error.timestamp,
      details: error.details || {},
    }
  }, { status: error.statusCode || 500 });
}
```

**3. Success Response Format**:

```javascript
// Standardized success responses
{
  "data": { /* resource */ },
  "meta": {
    "timestamp": "2024-12-30T12:34:56.789Z",
    "version": "v1"
  }
}

// Paginated responses
{
  "data": [ /* resources */ ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 156,
    "pages": 8
  },
  "meta": {
    "timestamp": "2024-12-30T12:34:56.789Z"
  }
}
```

---

## 5. Real-Time Data Architecture

### Current State

**Real-time Simulation**: Client-side only using `setInterval()`

```javascript
// From /app/page.jsx - Line 33
const generateVitals = (patient) => {
  const variance = patient.status === 'critical' ? 5 : 2.5;
  return {
    pr: Math.round(patient.basePR + (Math.random() - 0.5) * variance * 2),
    spo2: Math.min(100, Math.max(0, Math.round(patient.baseSPO2 + ...))),
    // ... mock data generation
  };
};
```

**Critical Gap**: No real device integration, no server-side streaming, no data persistence.

### Recommended Real-Time Architecture

**Option 1: WebSockets (Recommended for Medical Devices)**

Best for:
- Bidirectional communication with medical monitors
- Low-latency critical alarms
- Device control commands

```javascript
// /app/api/vitals/stream/route.js (Next.js WebSocket via custom server)

// Using ws library
import { WebSocketServer } from 'ws';

const wss = new WebSocketServer({ port: 3001 });

wss.on('connection', (ws, req) => {
  const userId = authenticateWebSocket(req);

  ws.on('message', (data) => {
    const message = JSON.parse(data);

    switch (message.type) {
      case 'subscribe':
        subscribeToPatient(ws, message.patientId);
        break;
      case 'acknowledge_alarm':
        acknowledgeAlarm(message.alarmId, userId);
        break;
    }
  });
});

// Device integration service pushes vitals
export function broadcastVitals(patientId, vitals) {
  const message = JSON.stringify({
    type: 'vitals_update',
    patientId,
    data: vitals,
    timestamp: new Date().toISOString(),
  });

  wss.clients.forEach(client => {
    if (client.subscriptions.includes(patientId)) {
      client.send(message);
    }
  });
}
```

**Option 2: Server-Sent Events (SSE)**

Simpler for one-way server → client updates:

```javascript
// /app/api/vitals/stream/route.js
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const patientId = searchParams.get('patientId');

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      // Subscribe to vitals updates from device service
      const subscription = subscribeToVitalsStream(patientId);

      for await (const vitals of subscription) {
        const data = `data: ${JSON.stringify(vitals)}\n\n`;
        controller.enqueue(encoder.encode(data));
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
```

**Client-Side (React)**:
```javascript
useEffect(() => {
  const eventSource = new EventSource(`/api/vitals/stream?patientId=${id}`);

  eventSource.onmessage = (event) => {
    const vitals = JSON.parse(event.data);
    setPatientVitals(vitals);
  };

  eventSource.onerror = () => {
    console.error('SSE connection lost, reconnecting...');
  };

  return () => eventSource.close();
}, [id]);
```

**Option 3: Redis Pub/Sub + Polling** (Hybrid approach)

For multi-server deployments:

```javascript
// Device integration service publishes to Redis
import { createClient } from 'redis';

const redis = createClient();
await redis.connect();

// Device listener publishes vitals
await redis.publish('vitals:patient:4', JSON.stringify(vitals));

// API servers subscribe
const subscriber = redis.duplicate();
await subscriber.connect();

await subscriber.subscribe('vitals:patient:*', (message, channel) => {
  const patientId = channel.split(':')[2];
  broadcastToWebSocketClients(patientId, JSON.parse(message));
});
```

### Performance Considerations

- **Message Rate**: Medical monitors send data at 1-5 Hz (1-5 messages/sec per patient)
- **8 patients** = 8-40 messages/sec (easily handled by WebSockets)
- **Compression**: Use gzip for historical data APIs, binary for real-time
- **Rate Limiting**: 1000 req/min per user for API, unlimited for WebSocket vitals

---

## 6. Database Schema Recommendations

### Technology Choice

**Recommended**: PostgreSQL 15+ with TimescaleDB extension

**Rationale**:
- ACID compliance (critical for medical records)
- HIPAA-compliant with encryption at rest/transit
- TimescaleDB for time-series vitals data (efficient storage/queries)
- JSON columns for flexible clinical data (medications, diagnoses)
- Strong audit logging capabilities
- Excellent ORMs available (Prisma, Drizzle)

**Alternative**: MongoDB (if document flexibility is priority)
- Easier schema evolution
- Native JSON storage
- But: eventual consistency can be risky for critical care

### Schema Design

**Core Tables**:

```sql
-- ==============================================
-- PATIENTS
-- ==============================================
CREATE TABLE patients (
  id SERIAL PRIMARY KEY,
  mrn VARCHAR(20) UNIQUE NOT NULL,
  first_name VARCHAR(100),
  last_name VARCHAR(100) NOT NULL,
  gender CHAR(1) CHECK (gender IN ('M', 'F', 'X')),
  date_of_birth TIMESTAMPTZ NOT NULL,

  -- Birth info
  gestational_age_weeks SMALLINT CHECK (gestational_age_weeks BETWEEN 22 AND 42),
  gestational_age_days SMALLINT CHECK (gestational_age_days BETWEEN 0 AND 6),
  birth_weight DECIMAL(5,3) CHECK (birth_weight > 0), -- kg
  apgar_1min SMALLINT CHECK (apgar_1min BETWEEN 0 AND 10),
  apgar_5min SMALLINT CHECK (apgar_5min BETWEEN 0 AND 10),
  delivery_type VARCHAR(50),

  -- Admission
  admit_date TIMESTAMPTZ NOT NULL,
  discharge_date TIMESTAMPTZ,
  current_bed_id INTEGER REFERENCES beds(id),
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'discharged', 'transferred', 'deceased')),

  -- Clinical team
  attending_physician_id INTEGER REFERENCES staff(id),
  primary_nurse_id INTEGER REFERENCES staff(id),

  -- Mother info
  mother_mrn VARCHAR(20),
  mother_name VARCHAR(200),
  mother_age SMALLINT,
  blood_type VARCHAR(5),
  gbs_status VARCHAR(20),

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by INTEGER REFERENCES users(id),
  updated_by INTEGER REFERENCES users(id),

  -- Soft delete
  deleted_at TIMESTAMPTZ,

  CONSTRAINT valid_discharge CHECK (discharge_date IS NULL OR discharge_date >= admit_date)
);

CREATE INDEX idx_patients_mrn ON patients(mrn);
CREATE INDEX idx_patients_status ON patients(status) WHERE status = 'active';
CREATE INDEX idx_patients_bed ON patients(current_bed_id);

-- ==============================================
-- VITAL SIGNS (Time-series with TimescaleDB)
-- ==============================================
CREATE TABLE vitals (
  time TIMESTAMPTZ NOT NULL,
  patient_id INTEGER NOT NULL REFERENCES patients(id),

  -- Core vitals
  spo2 SMALLINT CHECK (spo2 BETWEEN 0 AND 100),
  pulse_rate SMALLINT CHECK (pulse_rate BETWEEN 0 AND 300),
  respiratory_rate SMALLINT CHECK (respiratory_rate BETWEEN 0 AND 150),
  temperature DECIMAL(4,2) CHECK (temperature BETWEEN 25.0 AND 45.0),

  -- Blood pressure
  bp_systolic SMALLINT CHECK (bp_systolic BETWEEN 0 AND 200),
  bp_diastolic SMALLINT CHECK (bp_diastolic BETWEEN 0 AND 150),
  bp_map SMALLINT CHECK (bp_map BETWEEN 0 AND 150),

  -- Respiratory support
  fio2 SMALLINT CHECK (fio2 BETWEEN 21 AND 100),

  -- Perfusion
  perfusion_index DECIMAL(4,2) CHECK (perfusion_index >= 0),

  -- Metadata
  source VARCHAR(20) DEFAULT 'monitor' CHECK (source IN ('monitor', 'manual', 'import')),
  device_id VARCHAR(50),
  quality_indicator SMALLINT CHECK (quality_indicator BETWEEN 0 AND 100),

  PRIMARY KEY (patient_id, time)
);

-- Convert to TimescaleDB hypertable for efficient time-series queries
SELECT create_hypertable('vitals', 'time',
  chunk_time_interval => INTERVAL '1 day',
  partitioning_column => 'patient_id',
  number_partitions => 4
);

-- Retention policy: keep raw data for 90 days, aggregates for 2 years
SELECT add_retention_policy('vitals', INTERVAL '90 days');

-- Continuous aggregate for hourly averages
CREATE MATERIALIZED VIEW vitals_hourly
WITH (timescaledb.continuous) AS
SELECT
  time_bucket('1 hour', time) AS hour,
  patient_id,
  AVG(spo2) as avg_spo2,
  MIN(spo2) as min_spo2,
  MAX(spo2) as max_spo2,
  AVG(pulse_rate) as avg_pr,
  AVG(respiratory_rate) as avg_rr,
  AVG(temperature) as avg_temp,
  COUNT(*) as sample_count
FROM vitals
GROUP BY hour, patient_id;

-- ==============================================
-- ALARMS
-- ==============================================
CREATE TABLE alarms (
  id SERIAL PRIMARY KEY,
  patient_id INTEGER NOT NULL REFERENCES patients(id),
  alarm_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  severity VARCHAR(20) NOT NULL CHECK (severity IN ('critical', 'warning', 'advisory')),
  parameter VARCHAR(50) NOT NULL, -- 'spo2', 'pulse_rate', 'apnea', etc.
  value VARCHAR(50), -- Actual value that triggered alarm
  threshold VARCHAR(50), -- Threshold that was exceeded

  -- Alarm lifecycle
  acknowledged_at TIMESTAMPTZ,
  acknowledged_by INTEGER REFERENCES users(id),
  resolved_at TIMESTAMPTZ,
  escalated BOOLEAN DEFAULT FALSE,
  escalated_at TIMESTAMPTZ,

  -- Context
  bed_id INTEGER REFERENCES beds(id),
  device_id VARCHAR(50),

  CONSTRAINT valid_acknowledgment CHECK (acknowledged_at IS NULL OR acknowledged_at >= alarm_time),
  CONSTRAINT valid_resolution CHECK (resolved_at IS NULL OR resolved_at >= alarm_time)
);

CREATE INDEX idx_alarms_patient ON alarms(patient_id, alarm_time DESC);
CREATE INDEX idx_alarms_unacknowledged ON alarms(acknowledged_at) WHERE acknowledged_at IS NULL;
CREATE INDEX idx_alarms_severity ON alarms(severity, alarm_time DESC);

-- ==============================================
-- MEDICATIONS
-- ==============================================
CREATE TABLE medication_orders (
  id SERIAL PRIMARY KEY,
  patient_id INTEGER NOT NULL REFERENCES patients(id),

  medication_name VARCHAR(200) NOT NULL,
  dose VARCHAR(100) NOT NULL,
  route VARCHAR(50) NOT NULL,
  frequency VARCHAR(100) NOT NULL,

  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ,

  ordered_by INTEGER REFERENCES staff(id),
  ordered_at TIMESTAMPTZ DEFAULT NOW(),

  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'discontinued', 'completed', 'held')),

  CONSTRAINT valid_dates CHECK (end_date IS NULL OR end_date >= start_date)
);

CREATE TABLE medication_administrations (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES medication_orders(id),
  patient_id INTEGER NOT NULL REFERENCES patients(id),

  scheduled_time TIMESTAMPTZ NOT NULL,
  administered_time TIMESTAMPTZ,
  administered_by INTEGER REFERENCES staff(id),

  dose_given VARCHAR(100),
  route VARCHAR(50),
  site VARCHAR(100),

  status VARCHAR(20) DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'given', 'held', 'refused', 'missed')),
  notes TEXT
);

-- ==============================================
-- LAB RESULTS
-- ==============================================
CREATE TABLE lab_orders (
  id SERIAL PRIMARY KEY,
  patient_id INTEGER NOT NULL REFERENCES patients(id),

  order_name VARCHAR(200) NOT NULL,
  ordered_by INTEGER REFERENCES staff(id),
  ordered_at TIMESTAMPTZ DEFAULT NOW(),

  specimen_collected_at TIMESTAMPTZ,
  resulted_at TIMESTAMPTZ,

  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'collected', 'processing', 'resulted', 'cancelled'))
);

CREATE TABLE lab_results (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES lab_orders(id),

  test_name VARCHAR(200) NOT NULL,
  result_value VARCHAR(100),
  result_numeric DECIMAL(15,6), -- For numeric results
  units VARCHAR(50),
  reference_range VARCHAR(200),

  is_abnormal BOOLEAN DEFAULT FALSE,
  is_critical BOOLEAN DEFAULT FALSE,

  resulted_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================
-- CLINICAL NOTES
-- ==============================================
CREATE TABLE clinical_notes (
  id SERIAL PRIMARY KEY,
  patient_id INTEGER NOT NULL REFERENCES patients(id),

  note_type VARCHAR(50) NOT NULL CHECK (note_type IN ('progress', 'shift', 'consult', 'discharge', 'procedure')),
  note_text TEXT NOT NULL,

  author_id INTEGER NOT NULL REFERENCES users(id),
  authored_at TIMESTAMPTZ DEFAULT NOW(),

  co_signed_by INTEGER REFERENCES users(id),
  co_signed_at TIMESTAMPTZ,

  -- Addendum support
  amended BOOLEAN DEFAULT FALSE,
  amendment_of INTEGER REFERENCES clinical_notes(id)
);

-- ==============================================
-- AUDIT LOG (Critical for HIPAA)
-- ==============================================
CREATE TABLE audit_log (
  id BIGSERIAL PRIMARY KEY,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  user_id INTEGER REFERENCES users(id),
  user_role VARCHAR(50),
  username VARCHAR(100),

  action VARCHAR(100) NOT NULL, -- 'patient.view', 'alarm.acknowledge', 'order.sign', etc.
  resource_type VARCHAR(50), -- 'patient', 'order', 'note'
  resource_id INTEGER,

  patient_id INTEGER REFERENCES patients(id), -- For patient-related actions

  ip_address INET,
  user_agent TEXT,

  -- Before/after state for data modifications
  changes JSONB,

  severity VARCHAR(20) DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'error', 'critical'))
);

CREATE INDEX idx_audit_timestamp ON audit_log(timestamp DESC);
CREATE INDEX idx_audit_user ON audit_log(user_id, timestamp DESC);
CREATE INDEX idx_audit_patient ON audit_log(patient_id, timestamp DESC);
CREATE INDEX idx_audit_action ON audit_log(action, timestamp DESC);

-- Immutability: prevent modifications to audit log
REVOKE UPDATE, DELETE ON audit_log FROM PUBLIC;

-- ==============================================
-- USERS & AUTHENTICATION
-- ==============================================
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,

  full_name VARCHAR(200) NOT NULL,
  role VARCHAR(50) NOT NULL CHECK (role IN ('nurse', 'physician', 'fellow', 'resident', 'admin', 'respiratory_therapist')),

  active BOOLEAN DEFAULT TRUE,
  last_login TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id INTEGER NOT NULL REFERENCES users(id),

  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,

  ip_address INET,
  user_agent TEXT,

  revoked BOOLEAN DEFAULT FALSE,
  revoked_at TIMESTAMPTZ
);

CREATE INDEX idx_sessions_user ON sessions(user_id);
CREATE INDEX idx_sessions_expires ON sessions(expires_at) WHERE NOT revoked;

-- ==============================================
-- BEDS
-- ==============================================
CREATE TABLE beds (
  id SERIAL PRIMARY KEY,
  bed_number VARCHAR(10) UNIQUE NOT NULL,
  unit VARCHAR(50) DEFAULT 'NICU',

  status VARCHAR(20) DEFAULT 'available' CHECK (status IN ('available', 'occupied', 'cleaning', 'maintenance')),
  bed_type VARCHAR(50), -- 'isolette', 'warmer', 'crib'

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================
-- STAFF (for assignment tracking)
-- ==============================================
CREATE TABLE staff (
  id SERIAL PRIMARY KEY,
  user_id INTEGER UNIQUE REFERENCES users(id),

  npi VARCHAR(20), -- National Provider Identifier
  license_number VARCHAR(50),
  specialty VARCHAR(100),

  active BOOLEAN DEFAULT TRUE
);

-- ==============================================
-- DEVICES
-- ==============================================
CREATE TABLE devices (
  id SERIAL PRIMARY KEY,
  device_id VARCHAR(50) UNIQUE NOT NULL, -- Serial number
  device_type VARCHAR(50) NOT NULL, -- 'monitor', 'iv_pump', 'ventilator'
  manufacturer VARCHAR(100),
  model VARCHAR(100),

  current_bed_id INTEGER REFERENCES beds(id),

  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'offline', 'maintenance', 'decommissioned')),
  last_heartbeat TIMESTAMPTZ,
  firmware_version VARCHAR(50),

  calibration_due DATE,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_devices_bed ON devices(current_bed_id);
CREATE INDEX idx_devices_status ON devices(status) WHERE status = 'active';
```

### ORM Recommendation: Prisma

```prisma
// prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model Patient {
  id              Int       @id @default(autoincrement())
  mrn             String    @unique @db.VarChar(20)
  firstName       String?   @map("first_name") @db.VarChar(100)
  lastName        String    @map("last_name") @db.VarChar(100)
  gender          String    @db.Char(1)
  dateOfBirth     DateTime  @map("date_of_birth") @db.Timestamptz

  gaWeeks         Int?      @map("gestational_age_weeks") @db.SmallInt
  gaDays          Int?      @map("gestational_age_days") @db.SmallInt
  birthWeight     Decimal?  @map("birth_weight") @db.Decimal(5, 3)

  admitDate       DateTime  @map("admit_date") @db.Timestamptz
  dischargeDate   DateTime? @map("discharge_date") @db.Timestamptz
  status          String    @default("active") @db.VarChar(20)

  currentBedId    Int?      @map("current_bed_id")
  bed             Bed?      @relation(fields: [currentBedId], references: [id])

  vitals          Vital[]
  alarms          Alarm[]
  medications     MedicationOrder[]
  notes           ClinicalNote[]

  createdAt       DateTime  @default(now()) @map("created_at") @db.Timestamptz
  updatedAt       DateTime  @updatedAt @map("updated_at") @db.Timestamptz
  deletedAt       DateTime? @map("deleted_at") @db.Timestamptz

  @@map("patients")
  @@index([mrn])
  @@index([status])
}

// ... other models
```

---

## 7. Caching Layer Requirements

### Current State: NONE

### Recommended Caching Strategy

**Technology**: Redis 7.x

**Use Cases**:

1. **Session Management**: Store user sessions (faster than DB queries)
2. **Real-time Data**: Cache latest vitals for dashboard (reduce DB load)
3. **Rate Limiting**: Track API request counts
4. **Pub/Sub**: Real-time event distribution across servers

**Cache Hierarchy**:

```
┌─────────────────────────────────────────────────────┐
│ L1: In-Memory Cache (Node.js process)              │
│ - Patient alarm limits (rarely change)             │
│ - Reference data (Fenton charts, medical ranges)   │
│ - TTL: 1 hour                                       │
└─────────────────────────────────────────────────────┘
                        ↓ miss
┌─────────────────────────────────────────────────────┐
│ L2: Redis Cache (shared across servers)            │
│ - Latest vitals per patient                        │
│ - Active patient list                              │
│ - User sessions                                     │
│ - TTL: 5-15 minutes                                 │
└─────────────────────────────────────────────────────┘
                        ↓ miss
┌─────────────────────────────────────────────────────┐
│ L3: PostgreSQL Database (source of truth)          │
│ - All persistent data                              │
└─────────────────────────────────────────────────────┘
```

**Implementation**:

```javascript
// /lib/cache.js
import { createClient } from 'redis';

const redis = createClient({
  url: process.env.REDIS_URL,
  socket: {
    reconnectStrategy: (retries) => Math.min(retries * 50, 500),
  },
});

await redis.connect();

// Cache latest vitals
export async function cacheLatestVitals(patientId, vitals) {
  const key = `vitals:latest:${patientId}`;
  await redis.setEx(key, 300, JSON.stringify(vitals)); // 5 min TTL
}

export async function getLatestVitals(patientId) {
  const key = `vitals:latest:${patientId}`;
  const cached = await redis.get(key);

  if (cached) return JSON.parse(cached);

  // Fallback to database
  const vitals = await db.vitals.findFirst({
    where: { patientId },
    orderBy: { time: 'desc' },
  });

  if (vitals) {
    await cacheLatestVitals(patientId, vitals);
  }

  return vitals;
}

// Cache active patient list
export async function cacheActivePatients(patients) {
  await redis.setEx('patients:active', 60, JSON.stringify(patients)); // 1 min TTL
}

// Invalidation on patient discharge
export async function invalidatePatientCache(patientId) {
  await redis.del(`vitals:latest:${patientId}`);
  await redis.del('patients:active');
}
```

**Cache Invalidation Strategy**:

- **Write-Through**: Update cache when writing to database
- **TTL-based**: Short TTLs for vitals (5 min), longer for reference data (1 hour)
- **Event-based**: Invalidate on patient discharge, bed changes, alarm limit updates

---

## 8. Rate Limiting & Throttling

### Current State: NONE

### Recommended Implementation

**Technology**: Redis + Upstash Rate Limit library

**Rate Limits**:

```javascript
// Different limits per endpoint type
const RATE_LIMITS = {
  // Authentication
  'auth:login': { requests: 5, window: '5m' },
  'auth:password-reset': { requests: 3, window: '1h' },

  // API reads (per user)
  'api:read': { requests: 1000, window: '1m' },

  // API writes (per user)
  'api:write': { requests: 100, window: '1m' },

  // Critical operations (per user)
  'api:patient-admit': { requests: 10, window: '1m' },
  'api:order-sign': { requests: 50, window: '1m' },

  // By IP (for unauthenticated endpoints)
  'ip:default': { requests: 100, window: '1m' },
};
```

**Middleware Implementation**:

```javascript
// /lib/middleware/rateLimit.js
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

const limiters = {
  api_read: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(1000, '60 s'),
    analytics: true,
  }),

  api_write: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(100, '60 s'),
    analytics: true,
  }),

  auth_login: new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(5, '300 s'),
    analytics: true,
  }),
};

export async function rateLimit(identifier, type = 'api_read') {
  const limiter = limiters[type];
  const { success, limit, reset, remaining } = await limiter.limit(identifier);

  return {
    allowed: success,
    limit,
    remaining,
    resetAt: new Date(reset),
  };
}

// Usage in API route
export async function GET(request) {
  const userId = request.user.id;
  const { allowed, remaining, resetAt } = await rateLimit(`user:${userId}`, 'api_read');

  if (!allowed) {
    return Response.json({
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests',
        resetAt: resetAt.toISOString(),
      }
    }, {
      status: 429,
      headers: {
        'X-RateLimit-Limit': '1000',
        'X-RateLimit-Remaining': remaining.toString(),
        'X-RateLimit-Reset': resetAt.toISOString(),
        'Retry-After': Math.ceil((resetAt - Date.now()) / 1000).toString(),
      }
    });
  }

  // Process request...
}
```

**Special Considerations for Medical Systems**:

- **No rate limiting on critical alarms**: Life-threatening events bypass limits
- **WebSocket exemptions**: Real-time vitals streams are not rate-limited
- **Graceful degradation**: If Redis is down, allow requests (fail open, not closed)

---

## 9. Audit Logging for Medical Compliance

### Current State

**Mock Audit Page**: `/Users/adityachilka/Downloads/nicu-dashboard/app/audit/page.jsx`
- Client-side only
- Hard-coded sample data
- No persistence

### Regulatory Requirements

**HIPAA (Health Insurance Portability and Accountability Act)**:
- Log ALL access to patient data (view, create, update, delete)
- Retain logs for 6 years
- Immutable logs (cannot be modified or deleted)
- Log failed access attempts

**FDA 21 CFR Part 11 (Electronic Records)**:
- Audit trail for all data modifications
- User identification for all actions
- Date/time stamps
- Sequential, computer-generated audit trail

### Recommended Audit System Architecture

**Database-Level Audit Triggers** (PostgreSQL):

```sql
-- Audit trigger function
CREATE OR REPLACE FUNCTION audit_trigger_function()
RETURNS TRIGGER AS $$
BEGIN
  -- Capture the change
  INSERT INTO audit_log (
    timestamp,
    user_id,
    action,
    resource_type,
    resource_id,
    changes
  ) VALUES (
    NOW(),
    current_setting('app.current_user_id')::INTEGER,
    TG_OP, -- INSERT, UPDATE, DELETE
    TG_TABLE_NAME,
    CASE
      WHEN TG_OP = 'DELETE' THEN OLD.id
      ELSE NEW.id
    END,
    jsonb_build_object(
      'old', row_to_json(OLD),
      'new', row_to_json(NEW)
    )
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to critical tables
CREATE TRIGGER audit_patients
  AFTER INSERT OR UPDATE OR DELETE ON patients
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

CREATE TRIGGER audit_medication_orders
  AFTER INSERT OR UPDATE OR DELETE ON medication_orders
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

CREATE TRIGGER audit_lab_results
  AFTER INSERT OR UPDATE OR DELETE ON lab_results
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();
```

**Application-Level Audit Middleware**:

```javascript
// /lib/audit.js
import { db } from './db';

export async function auditLog({
  userId,
  action,
  resourceType,
  resourceId,
  patientId = null,
  changes = null,
  severity = 'info',
  ipAddress = null,
  userAgent = null,
}) {
  await db.auditLog.create({
    data: {
      userId,
      action,
      resourceType,
      resourceId,
      patientId,
      changes,
      severity,
      ipAddress,
      userAgent,
      timestamp: new Date(),
    },
  });
}

// Usage in API routes
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const patientId = parseInt(searchParams.get('id'));

  const patient = await db.patient.findUnique({
    where: { id: patientId },
  });

  // Audit patient view
  await auditLog({
    userId: request.user.id,
    action: 'patient.view',
    resourceType: 'patient',
    resourceId: patientId,
    patientId: patientId,
    ipAddress: request.headers.get('x-forwarded-for'),
    userAgent: request.headers.get('user-agent'),
  });

  return Response.json({ data: patient });
}
```

**What to Audit**:

```javascript
// Comprehensive audit events
const AUDIT_EVENTS = {
  // Patient actions
  'patient.view': { severity: 'info' },
  'patient.create': { severity: 'info' },
  'patient.update': { severity: 'warning' },
  'patient.discharge': { severity: 'warning' },
  'patient.delete': { severity: 'critical' }, // Should never happen (soft delete only)

  // Clinical actions
  'vitals.record': { severity: 'info' },
  'alarm.acknowledge': { severity: 'warning' },
  'alarm.silence': { severity: 'warning' },
  'order.create': { severity: 'warning' },
  'order.sign': { severity: 'warning' },
  'order.discontinue': { severity: 'warning' },
  'medication.administer': { severity: 'info' },
  'medication.hold': { severity: 'warning' },
  'note.create': { severity: 'info' },
  'note.amend': { severity: 'warning' },

  // System actions
  'auth.login': { severity: 'info' },
  'auth.logout': { severity: 'info' },
  'auth.login_failed': { severity: 'warning' },
  'auth.session_expired': { severity: 'info' },

  // Settings
  'settings.alarm_limits': { severity: 'critical' },
  'settings.user_permissions': { severity: 'critical' },

  // Device
  'device.offline': { severity: 'error' },
  'device.reconnect': { severity: 'info' },
};
```

**Audit Log Retention**:

```sql
-- Partition audit_log by month for efficient archival
CREATE TABLE audit_log_2024_12 PARTITION OF audit_log
  FOR VALUES FROM ('2024-12-01') TO ('2025-01-01');

-- Archive old partitions to cold storage (S3, Glacier)
-- Keep online for 6 months, archive for 6 years per HIPAA
```

**Audit Reporting**:

```javascript
// /app/api/audit/report/route.js
export async function GET(request) {
  const { searchParams } = new URL(request.url);

  const report = await db.auditLog.findMany({
    where: {
      timestamp: {
        gte: new Date(searchParams.get('start')),
        lte: new Date(searchParams.get('end')),
      },
      patientId: searchParams.get('patientId') ? parseInt(searchParams.get('patientId')) : undefined,
      action: searchParams.get('action') || undefined,
    },
    orderBy: { timestamp: 'desc' },
    take: 1000,
  });

  return Response.json({ data: report });
}
```

---

## 10. Integration Points (HL7/FHIR Compatibility)

### Current State: NONE

No integration with:
- Hospital EMR/EHR systems
- Medical device networks
- Lab information systems (LIS)
- Pharmacy systems
- Billing systems

### Medical Interoperability Standards

**HL7 v2.x** (Legacy, still widely used):
- ADT messages (Admit/Discharge/Transfer)
- ORM messages (Orders)
- ORU messages (Lab results)
- Format: Pipe-delimited text

**FHIR (Fast Healthcare Interoperability Resources)** (Modern standard):
- RESTful API
- JSON/XML resources
- OAuth 2.0 for security
- Widely adopted for new implementations

### Recommended Integration Architecture

**1. HL7 v2.x Inbound Adapter**

Receive ADT messages from hospital EMR:

```javascript
// /services/hl7/adapter.js
import { Server } from 'hl7-standard';

const hl7Server = new Server();

// Listen for HL7 messages on MLLP protocol
hl7Server.on('A01', async (message) => {
  // A01 = Patient Admission
  const patient = {
    mrn: message.get('PID.3').toString(),
    lastName: message.get('PID.5.1').toString(),
    firstName: message.get('PID.5.2').toString(),
    dob: message.get('PID.7').toDate(),
    gender: message.get('PID.8').toString(),
    // ... extract other fields
  };

  // Create patient in NICU system
  await db.patient.create({ data: patient });

  // Audit the import
  await auditLog({
    action: 'patient.import_hl7',
    resourceType: 'patient',
    severity: 'info',
    changes: { source: 'EMR', messageType: 'A01' },
  });

  // Send ACK
  return message.ack();
});

hl7Server.start(2575); // Standard HL7 MLLP port
```

**2. FHIR R4 API Implementation**

Expose NICU data as FHIR resources:

```javascript
// /app/api/fhir/Patient/[id]/route.js
export async function GET(request, { params }) {
  const { id } = params;

  const patient = await db.patient.findUnique({
    where: { id: parseInt(id) },
  });

  if (!patient) {
    return Response.json({
      resourceType: 'OperationOutcome',
      issue: [{
        severity: 'error',
        code: 'not-found',
        diagnostics: `Patient ${id} not found`,
      }],
    }, { status: 404 });
  }

  // Convert to FHIR Patient resource
  const fhirPatient = {
    resourceType: 'Patient',
    id: patient.id.toString(),
    identifier: [{
      system: 'urn:oid:2.16.840.1.113883.3.1234', // Hospital MRN system
      value: patient.mrn,
    }],
    name: [{
      family: patient.lastName,
      given: [patient.firstName],
    }],
    gender: patient.gender.toLowerCase(),
    birthDate: patient.dateOfBirth.toISOString().split('T')[0],
    meta: {
      lastUpdated: patient.updatedAt.toISOString(),
      versionId: '1',
    },
  };

  return Response.json(fhirPatient, {
    headers: { 'Content-Type': 'application/fhir+json' },
  });
}
```

**3. Observation Resource for Vitals**

```javascript
// /app/api/fhir/Observation/route.js
export async function POST(request) {
  const observation = await request.json();

  // Validate FHIR Observation resource
  if (observation.resourceType !== 'Observation') {
    return Response.json({ error: 'Invalid resource type' }, { status: 400 });
  }

  // Extract vital sign data
  const vital = {
    patientId: parseInt(observation.subject.reference.split('/')[1]),
    time: new Date(observation.effectiveDateTime),
    // Map LOINC codes to vitals
    ...(observation.code.coding[0].code === '2708-6' && {
      spo2: observation.valueQuantity.value,
    }),
    ...(observation.code.coding[0].code === '8867-4' && {
      pulse_rate: observation.valueQuantity.value,
    }),
  };

  await db.vitals.create({ data: vital });

  return Response.json({ resourceType: 'OperationOutcome', issue: [] }, { status: 201 });
}
```

**4. Medical Device Integration**

```javascript
// /services/device-integration/monitor-listener.js
import { createServer } from 'net';

// Listen for device data streams (proprietary protocols)
const deviceServer = createServer((socket) => {
  let buffer = '';

  socket.on('data', async (chunk) => {
    buffer += chunk.toString();

    // Parse device protocol (example: Philips IntelliVue)
    const messages = buffer.split('\r\n');
    buffer = messages.pop(); // Keep incomplete message

    for (const message of messages) {
      const vitals = parseDeviceMessage(message);

      if (vitals) {
        // Store in database
        await db.vitals.create({
          data: {
            ...vitals,
            source: 'monitor',
            deviceId: socket.remoteAddress,
          },
        });

        // Cache for real-time display
        await cacheLatestVitals(vitals.patientId, vitals);

        // Broadcast to WebSocket clients
        broadcastVitals(vitals.patientId, vitals);

        // Check alarm conditions
        await checkAlarmConditions(vitals);
      }
    }
  });
});

deviceServer.listen(3000);
```

**FHIR Capability Statement**:

```javascript
// /app/api/fhir/metadata/route.js
export async function GET() {
  return Response.json({
    resourceType: 'CapabilityStatement',
    status: 'active',
    date: '2024-12-30',
    kind: 'instance',
    fhirVersion: '4.0.1',
    format: ['json', 'xml'],
    rest: [{
      mode: 'server',
      resource: [
        {
          type: 'Patient',
          interaction: [
            { code: 'read' },
            { code: 'search-type' },
          ],
          searchParam: [
            { name: 'identifier', type: 'token' },
            { name: 'birthdate', type: 'date' },
          ],
        },
        {
          type: 'Observation',
          interaction: [
            { code: 'read' },
            { code: 'create' },
            { code: 'search-type' },
          ],
          searchParam: [
            { name: 'patient', type: 'reference' },
            { name: 'code', type: 'token' },
            { name: 'date', type: 'date' },
          ],
        },
      ],
    }],
  }, {
    headers: { 'Content-Type': 'application/fhir+json' },
  });
}
```

---

## Missing Backend Infrastructure Summary

### Critical Missing Components

| Component | Current State | Required for Production | Priority |
|-----------|---------------|------------------------|----------|
| **Database** | None (in-memory) | PostgreSQL + TimescaleDB | CRITICAL |
| **API Layer** | None | Next.js API Routes | CRITICAL |
| **Authentication** | Mock login | NextAuth.js + RBAC | CRITICAL |
| **Real-time Streaming** | Client-side mock | WebSockets/SSE | CRITICAL |
| **Audit Logging** | Client-side mock | Database + triggers | CRITICAL |
| **Device Integration** | None | HL7/FHIR adapters | HIGH |
| **Caching** | None | Redis | HIGH |
| **Rate Limiting** | None | Upstash/Redis | MEDIUM |
| **File Storage** | None | S3 for reports/images | MEDIUM |
| **Monitoring** | None | Sentry/DataDog | HIGH |
| **CI/CD** | None | GitHub Actions | MEDIUM |

### Technology Stack Recommendations

```yaml
Frontend:
  - Next.js 16 (App Router) ✅ Already in use
  - React 18 ✅ Already in use
  - TailwindCSS ✅ Already in use

Backend:
  - Next.js API Routes (serverless functions)
  - Node.js 20 LTS

Database:
  Primary: PostgreSQL 15+
  Time-Series: TimescaleDB extension
  ORM: Prisma 5.x

Caching:
  - Redis 7.x (Upstash for serverless)

Real-time:
  - WebSockets (ws library + custom server)
  - OR Server-Sent Events (SSE) for simplicity

Authentication:
  - NextAuth.js v4
  - OAuth 2.0 / SAML for hospital SSO
  - JWT tokens

File Storage:
  - AWS S3 (reports, images, backups)
  - CloudFront CDN

Message Queue:
  - BullMQ + Redis (background jobs)
  - Use cases: Email alerts, report generation, data archival

Monitoring:
  - Sentry (error tracking)
  - DataDog / New Relic (APM)
  - Uptime monitoring (UptimeRobot, Pingdom)

Deployment:
  - Vercel (Next.js hosting) - FREE tier available
  - OR AWS (EC2 + RDS + ElastiCache)
  - Docker + Kubernetes for on-premise

CI/CD:
  - GitHub Actions
  - Automated testing (Playwright already installed ✅)
```

---

## Medical Data Standards Compliance

### HIPAA (Health Insurance Portability and Accountability Act)

**Requirements**:

1. **Access Controls**:
   - ✅ Implement: Role-based access (nurse, physician, admin)
   - ✅ Implement: Unique user identification
   - ✅ Implement: Automatic logoff after inactivity
   - ✅ Implement: Encryption in transit (HTTPS) and at rest (DB encryption)

2. **Audit Controls**:
   - ✅ Implement: Log all access to patient data
   - ✅ Implement: Immutable audit logs
   - ✅ Implement: 6-year retention

3. **Data Integrity**:
   - ✅ Implement: Database constraints
   - ✅ Implement: Checksums for transmitted data
   - ✅ Implement: Backup and recovery procedures

4. **Transmission Security**:
   - ✅ Implement: TLS 1.3 for all communications
   - ✅ Implement: VPN for device integrations

**Implementation Checklist**:

```javascript
// Example: HIPAA-compliant session management
import { serialize } from 'cookie';

export async function createSession(userId) {
  const session = await db.session.create({
    data: {
      userId,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 min
      ipAddress: request.ip,
      userAgent: request.headers.get('user-agent'),
    },
  });

  // Secure, httpOnly cookie
  const cookie = serialize('session_id', session.id, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 900, // 15 minutes
    path: '/',
  });

  return cookie;
}

// Auto-logout after 15 minutes inactivity
export async function validateSession(sessionId) {
  const session = await db.session.findUnique({
    where: { id: sessionId },
  });

  if (!session || session.revoked) {
    throw new Error('Session invalid');
  }

  if (session.expiresAt < new Date()) {
    await db.session.update({
      where: { id: sessionId },
      data: { revoked: true, revokedAt: new Date() },
    });

    throw new Error('Session expired');
  }

  // Extend session on activity
  await db.session.update({
    where: { id: sessionId },
    data: { expiresAt: new Date(Date.now() + 15 * 60 * 1000) },
  });

  return session;
}
```

### FDA 21 CFR Part 11 (Electronic Records)

**Requirements**:

1. **Validation**: System must be validated before use
2. **Audit Trail**: Immutable, timestamped record of all changes
3. **Electronic Signatures**: Legally binding signatures on orders/notes
4. **Record Retention**: Maintain records for regulatory inspections

**Implementation**:

```javascript
// Electronic signature for order signing
export async function signOrder(orderId, userId, password) {
  // Verify password (re-authentication)
  const user = await db.user.findUnique({ where: { id: userId } });
  const valid = await verifyPassword(password, user.passwordHash);

  if (!valid) {
    await auditLog({
      userId,
      action: 'order.sign_failed',
      resourceId: orderId,
      severity: 'warning',
    });
    throw new Error('Invalid credentials');
  }

  // Sign order
  await db.medicationOrder.update({
    where: { id: orderId },
    data: {
      signedBy: userId,
      signedAt: new Date(),
      signature: generateElectronicSignature(orderId, userId),
    },
  });

  // Audit
  await auditLog({
    userId,
    action: 'order.signed',
    resourceType: 'medication_order',
    resourceId: orderId,
    severity: 'warning',
  });
}

function generateElectronicSignature(orderId, userId) {
  // Cryptographic signature per 21 CFR 11.70
  const data = `${orderId}:${userId}:${new Date().toISOString()}`;
  return crypto
    .createHmac('sha256', process.env.SIGNATURE_SECRET)
    .update(data)
    .digest('hex');
}
```

### HL7/FHIR Standards

**HL7 v2.x Message Types**:
- ADT^A01: Patient admission
- ADT^A03: Patient discharge
- ORM^O01: Medication order
- ORU^R01: Lab results

**FHIR Resources to Implement**:
- Patient
- Observation (vitals)
- MedicationRequest
- MedicationAdministration
- DiagnosticReport (labs)
- Encounter (admission/discharge)

**Smart on FHIR**:
- OAuth 2.0 authorization
- Launch contexts (patient, encounter)
- EHR integration via FHIR APIs

---

## Database, Real-Time, and Compliance Recommendations

### 1. Database Architecture

**Primary Database**: PostgreSQL 15 with TimescaleDB

**Schema Design**:
- Normalized relational tables for patient demographics, orders, medications
- TimescaleDB hypertables for time-series vitals data
- JSONB columns for flexible clinical data (diagnoses, allergies)
- Row-level security for multi-tenant deployments

**Hosting Options**:
- **Neon**: Serverless Postgres (free tier, auto-scaling)
- **Supabase**: Postgres + real-time subscriptions
- **AWS RDS**: Production-grade with Multi-AZ
- **Self-hosted**: Docker Compose for on-premise deployments

**Connection Pooling**:
```javascript
// Use PgBouncer or Prisma's built-in pooling
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  directUrl = env("DIRECT_DATABASE_URL") // For migrations
}
```

### 2. Real-Time Updates

**WebSocket Architecture**:

```
Medical Devices → Device Listener Service → Redis Pub/Sub → WebSocket Server → Browser Clients
                                           ↓
                                      PostgreSQL (persistence)
```

**Implementation**:
- Custom Node.js server for WebSocket handling (Next.js doesn't support WS natively)
- Redis pub/sub for horizontal scaling
- Server-Sent Events as fallback for simpler setups
- Heartbeat monitoring to detect offline devices

**Message Format**:
```json
{
  "type": "vitals_update",
  "patientId": 4,
  "timestamp": "2024-12-30T12:34:56.789Z",
  "data": {
    "spo2": 94,
    "pr": 148,
    "rr": 46,
    "temp": 36.9,
    "fio2": 28,
    "source": "monitor",
    "deviceId": "PHI-MX800-1234"
  }
}
```

### 3. Medical Data Standards Compliance

**Checklist**:

- [ ] **HIPAA**:
  - [ ] Implement access controls (RBAC)
  - [ ] Encrypt data at rest (PostgreSQL encryption)
  - [ ] Encrypt data in transit (TLS 1.3)
  - [ ] Audit all patient data access
  - [ ] Business Associate Agreements (BAA) with cloud providers
  - [ ] Regular security risk assessments

- [ ] **FDA 21 CFR Part 11**:
  - [ ] System validation documentation
  - [ ] Audit trail for all data changes
  - [ ] Electronic signatures on orders
  - [ ] User training records

- [ ] **HL7/FHIR**:
  - [ ] ADT message receiver for patient admissions
  - [ ] FHIR R4 API for interoperability
  - [ ] LOINC codes for lab results
  - [ ] SNOMED CT for clinical terminology

- [ ] **IEC 60601-1-8**:
  - [ ] Alarm color standards (already implemented ✅)
  - [ ] Alarm priority levels
  - [ ] Alarm escalation protocols

---

## Recommended Migration Path

### Phase 1: Foundation (Week 1-2)

1. Set up PostgreSQL database (Neon or Supabase)
2. Define Prisma schema for core entities (patients, vitals, alarms)
3. Migrate `/lib/data.js` to database seeds
4. Create basic API routes:
   - `GET /api/patients`
   - `GET /api/patients/:id`
   - `POST /api/patients` (admit)
5. Implement NextAuth.js authentication

### Phase 2: Real-Time & Audit (Week 3-4)

1. Set up Redis (Upstash for serverless)
2. Implement WebSocket server for vitals streaming
3. Create audit logging system
4. Implement rate limiting
5. Add input validation with Zod

### Phase 3: Device Integration (Week 5-6)

1. Create device listener service
2. Implement HL7 v2.x adapter
3. Build FHIR API endpoints
4. Connect to test medical devices/simulators

### Phase 4: Production Hardening (Week 7-8)

1. Set up monitoring (Sentry, DataDog)
2. Implement backup and disaster recovery
3. Security audit and penetration testing
4. Load testing and performance optimization
5. HIPAA compliance audit

---

## Cost Estimate (Monthly)

**Minimal Production Setup**:

```
Hosting (Vercel Pro):           $20/month
Database (Neon Pro):            $69/month
Redis (Upstash Pro):            $30/month
File Storage (AWS S3):          $5/month
Monitoring (Sentry Team):       $26/month
---------------------------------------------
Total:                          ~$150/month
```

**Enterprise Setup**:

```
Hosting (AWS EC2 + Load Balancer): $200/month
Database (RDS Multi-AZ):            $400/month
Redis (ElastiCache):                $100/month
Monitoring (DataDog APM):           $150/month
Backup/DR:                          $50/month
---------------------------------------------
Total:                              ~$900/month
```

---

## Conclusion

The NICU Dashboard has excellent frontend design and medical domain knowledge embedded in the code. However, it currently lacks ALL backend infrastructure necessary for production use in a healthcare setting.

**Immediate Next Steps**:

1. Set up PostgreSQL database with Prisma ORM
2. Create API routes for patient management
3. Implement authentication with role-based access
4. Add audit logging for HIPAA compliance
5. Build real-time vitals streaming with WebSockets

**Long-term Goals**:

1. HL7/FHIR integration with hospital EMR
2. Medical device integration (Philips, GE monitors)
3. FDA validation and regulatory compliance
4. Multi-tenant SaaS architecture
5. Mobile app for clinician alerts

This application has strong potential to become a production medical SaaS platform with the proper backend architecture investments outlined in this review.

---

**Prepared by**: Backend System Architect
**Date**: December 30, 2024
**Next Review**: After Phase 1 completion
