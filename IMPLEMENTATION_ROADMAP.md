# NICU Dashboard - Implementation Roadmap

**Project**: NICU Central Monitoring Station
**Timeline**: 8-12 weeks to production MVP
**Goal**: Transform client-side prototype into production-ready medical SaaS

---

## Executive Summary

This roadmap outlines the phased approach to building a production-grade NICU monitoring system with:
- PostgreSQL + TimescaleDB database
- RESTful API with real-time WebSocket streaming
- HIPAA-compliant audit logging
- HL7/FHIR integration capabilities
- Medical device connectivity

**Current State**: Client-side prototype with mock data
**Target State**: Multi-tenant SaaS with 99.9% uptime, HIPAA compliance, and FDA readiness

---

## Phase 1: Foundation (Weeks 1-2)

### Week 1: Database & ORM Setup

**Goals**:
- Set up PostgreSQL with TimescaleDB
- Define schema with Prisma ORM
- Migrate mock data to database
- Implement basic CRUD operations

**Tasks**:

1. **Database Setup** (Day 1-2)
   ```bash
   # Choose hosting provider
   # Option A: Neon (serverless, free tier)
   # Option B: Supabase (includes real-time)
   # Option C: AWS RDS (production-grade)

   # Initialize database
   createdb nicu_dashboard

   # Install TimescaleDB
   # Run DATABASE_SCHEMA.sql
   psql nicu_dashboard < DATABASE_SCHEMA.sql
   ```

2. **Prisma Setup** (Day 2-3)
   ```bash
   npm install prisma @prisma/client
   npm install -D prisma

   # Initialize Prisma
   npx prisma init

   # Generate Prisma schema from existing database
   npx prisma db pull

   # Generate Prisma Client
   npx prisma generate
   ```

   Create `/lib/db.js`:
   ```javascript
   import { PrismaClient } from '@prisma/client';

   const globalForPrisma = global;

   export const prisma = globalForPrisma.prisma || new PrismaClient({
     log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
   });

   if (process.env.NODE_ENV !== 'production') {
     globalForPrisma.prisma = prisma;
   }
   ```

3. **Data Migration** (Day 3-4)
   ```javascript
   // /scripts/migrate-mock-data.js
   import { prisma } from '../lib/db.js';
   import { initialPatients } from '../lib/data.js';

   async function migrateMockData() {
     // Create beds
     for (let i = 1; i <= 12; i++) {
       await prisma.bed.upsert({
         where: { bed_number: i.toString().padStart(2, '0') },
         update: {},
         create: {
           bed_number: i.toString().padStart(2, '0'),
           unit: 'NICU',
           bed_type: i <= 10 ? 'isolette' : 'warmer',
           status: 'available',
         },
       });
     }

     // Create staff
     const drChen = await prisma.staff.create({
       data: {
         user: {
           create: {
             email: 'sarah.chen@hospital.org',
             password_hash: await hashPassword('temp123'),
             full_name: 'Dr. Sarah Chen',
             role: 'physician',
           },
         },
         npi: '1234567890',
         specialty: 'Neonatology',
       },
     });

     // Migrate patients
     for (const patient of initialPatients) {
       await prisma.patient.create({
         data: {
           mrn: patient.mrn,
           first_name: patient.firstName,
           last_name: patient.lastName,
           gender: patient.gender,
           date_of_birth: new Date(patient.dob),
           gestational_age_weeks: patient.gaWeeks,
           gestational_age_days: patient.gaDays,
           birth_weight: patient.birthWeight,
           admit_date: new Date(patient.admitDate),
           current_bed: {
             connect: { bed_number: patient.bed },
           },
           status: 'active',
           attending_physician: {
             connect: { id: drChen.id },
           },
           diagnoses: {
             create: patient.diagnosis.map(d => ({
               diagnosis: d,
               diagnosis_type: 'primary',
             })),
           },
         },
       });
     }

     console.log('Migration complete!');
   }

   migrateMockData();
   ```

   Run migration:
   ```bash
   node scripts/migrate-mock-data.js
   ```

4. **Basic API Routes** (Day 4-5)
   Create `/app/api/patients/route.js`:
   ```javascript
   import { NextResponse } from 'next/server';
   import { prisma } from '@/lib/db';

   export async function GET(request) {
     try {
       const { searchParams } = new URL(request.url);
       const status = searchParams.get('status') || 'active';

       const patients = await prisma.patient.findMany({
         where: {
           status,
           deleted_at: null,
         },
         include: {
           bed: true,
           attending_physician: {
             include: {
               user: true,
             },
           },
           diagnoses: {
             where: { resolved_date: null },
           },
         },
         orderBy: {
           bed: {
             bed_number: 'asc',
           },
         },
       });

       return NextResponse.json({
         data: patients,
         meta: {
           timestamp: new Date().toISOString(),
         },
       });
     } catch (error) {
       console.error('Error fetching patients:', error);
       return NextResponse.json({
         error: {
           code: 'INTERNAL_SERVER_ERROR',
           message: 'Failed to fetch patients',
         },
       }, { status: 500 });
     }
   }
   ```

**Deliverables**:
- [ ] PostgreSQL database running with TimescaleDB
- [ ] Prisma schema generated and tested
- [ ] Mock data migrated to database
- [ ] Basic GET /api/patients endpoint working
- [ ] Database connection pooling configured

**Validation**:
```bash
# Test database connection
psql nicu_dashboard -c "SELECT COUNT(*) FROM patients;"

# Test API endpoint
curl http://localhost:3000/api/patients | jq
```

---

### Week 2: Authentication & API Foundation

**Goals**:
- Implement NextAuth.js authentication
- Create API middleware for auth/error handling
- Build remaining patient CRUD endpoints
- Set up input validation with Zod

**Tasks**:

1. **NextAuth.js Setup** (Day 1-2)
   ```bash
   npm install next-auth @next-auth/prisma-adapter bcrypt
   npm install -D @types/bcrypt
   ```

   Create `/app/api/auth/[...nextauth]/route.js`:
   ```javascript
   import NextAuth from 'next-auth';
   import CredentialsProvider from 'next-auth/providers/credentials';
   import { PrismaAdapter } from '@next-auth/prisma-adapter';
   import { prisma } from '@/lib/db';
   import { compare } from 'bcrypt';

   export const authOptions = {
     adapter: PrismaAdapter(prisma),
     providers: [
       CredentialsProvider({
         name: 'Credentials',
         credentials: {
           email: { label: 'Email', type: 'email' },
           password: { label: 'Password', type: 'password' },
         },
         async authorize(credentials) {
           if (!credentials?.email || !credentials?.password) {
             throw new Error('Invalid credentials');
           }

           const user = await prisma.user.findUnique({
             where: { email: credentials.email },
           });

           if (!user || !user.active) {
             throw new Error('User not found');
           }

           const isPasswordValid = await compare(
             credentials.password,
             user.password_hash
           );

           if (!isPasswordValid) {
             // Log failed attempt
             await prisma.user.update({
               where: { id: user.id },
               data: {
                 failed_login_attempts: { increment: 1 },
               },
             });

             throw new Error('Invalid credentials');
           }

           // Reset failed attempts
           await prisma.user.update({
             where: { id: user.id },
             data: {
               failed_login_attempts: 0,
               last_login: new Date(),
             },
           });

           return {
             id: user.id,
             email: user.email,
             name: user.full_name,
             role: user.role,
           };
         },
       }),
     ],
     session: {
       strategy: 'jwt',
       maxAge: 15 * 60, // 15 minutes
     },
     pages: {
       signIn: '/login',
     },
     callbacks: {
       async jwt({ token, user }) {
         if (user) {
           token.id = user.id;
           token.role = user.role;
         }
         return token;
       },
       async session({ session, token }) {
         if (token) {
           session.user.id = token.id;
           session.user.role = token.role;
         }
         return session;
       },
     },
   };

   const handler = NextAuth(authOptions);
   export { handler as GET, handler as POST };
   ```

2. **API Middleware** (Day 2-3)
   Create `/lib/middleware/auth.js`:
   ```javascript
   import { getServerSession } from 'next-auth/next';
   import { authOptions } from '@/app/api/auth/[...nextauth]/route';

   export async function requireAuth(request) {
     const session = await getServerSession(authOptions);

     if (!session) {
       throw new APIError('Authentication required', 401, 'UNAUTHORIZED');
     }

     return session.user;
   }

   export async function requireRole(request, allowedRoles) {
     const user = await requireAuth(request);

     if (!allowedRoles.includes(user.role)) {
       throw new APIError('Insufficient permissions', 403, 'INSUFFICIENT_PERMISSIONS');
     }

     return user;
   }
   ```

   Create `/lib/middleware/errorHandler.js`:
   ```javascript
   export class APIError extends Error {
     constructor(message, statusCode, code, details = {}) {
       super(message);
       this.statusCode = statusCode;
       this.code = code;
       this.details = details;
     }
   }

   export function errorHandler(error) {
     console.error('[API Error]', error);

     if (error instanceof APIError) {
       return Response.json({
         error: {
           code: error.code,
           message: error.message,
           statusCode: error.statusCode,
           timestamp: new Date().toISOString(),
           details: error.details,
         },
       }, { status: error.statusCode });
     }

     return Response.json({
       error: {
         code: 'INTERNAL_SERVER_ERROR',
         message: 'An unexpected error occurred',
         statusCode: 500,
         timestamp: new Date().toISOString(),
       },
     }, { status: 500 });
   }
   ```

3. **Input Validation** (Day 3-4)
   ```bash
   npm install zod
   ```

   Create `/lib/validation/patient.js`:
   ```javascript
   import { z } from 'zod';

   export const PatientAdmitSchema = z.object({
     mrn: z.string().regex(/^MRN-\d{5}$/, 'Invalid MRN format'),
     firstName: z.string().min(1).max(100).optional(),
     lastName: z.string().min(1).max(100),
     gender: z.enum(['M', 'F', 'X']),
     dateOfBirth: z.string().datetime(),
     gestationalAgeWeeks: z.number().int().min(22).max(42),
     gestationalAgeDays: z.number().int().min(0).max(6),
     birthWeight: z.number().positive().max(10.0),
     apgar1: z.number().int().min(0).max(10).optional(),
     apgar5: z.number().int().min(0).max(10).optional(),
     bedNumber: z.string().regex(/^\d{2}$/),
     admitDiagnosis: z.array(z.string()).min(1),
   });

   export const VitalSignSchema = z.object({
     timestamp: z.string().datetime(),
     spo2: z.number().int().min(0).max(100).nullable(),
     pulseRate: z.number().int().min(0).max(300).nullable(),
     respiratoryRate: z.number().int().min(0).max(150).nullable(),
     temperature: z.number().min(25.0).max(45.0).nullable(),
     source: z.enum(['monitor', 'manual', 'import']),
   });
   ```

4. **Complete Patient API** (Day 4-5)
   Create `/app/api/patients/[id]/route.js`:
   ```javascript
   import { NextResponse } from 'next/server';
   import { prisma } from '@/lib/db';
   import { requireAuth } from '@/lib/middleware/auth';
   import { errorHandler, APIError } from '@/lib/middleware/errorHandler';
   import { auditLog } from '@/lib/audit';

   export async function GET(request, { params }) {
     try {
       const user = await requireAuth(request);
       const { id } = params;

       const patient = await prisma.patient.findUnique({
         where: { id: parseInt(id) },
         include: {
           bed: true,
           attending_physician: { include: { user: true } },
           primary_nurse: { include: { user: true } },
           diagnoses: { where: { resolved_date: null } },
         },
       });

       if (!patient) {
         throw new APIError('Patient not found', 404, 'PATIENT_NOT_FOUND');
       }

       // Audit patient view
       await auditLog({
         userId: user.id,
         action: 'patient.view',
         resourceType: 'patient',
         resourceId: patient.id,
         patientId: patient.id,
       });

       return NextResponse.json({ data: patient });
     } catch (error) {
       return errorHandler(error);
     }
   }

   export async function PATCH(request, { params }) {
     try {
       const user = await requireRole(request, ['nurse', 'physician', 'admin']);
       const { id } = params;
       const body = await request.json();

       const patient = await prisma.patient.update({
         where: { id: parseInt(id) },
         data: {
           ...body,
           updated_by: user.id,
         },
       });

       await auditLog({
         userId: user.id,
         action: 'patient.update',
         resourceType: 'patient',
         resourceId: patient.id,
         patientId: patient.id,
         changes: { updated: body },
       });

       return NextResponse.json({ data: patient });
     } catch (error) {
       return errorHandler(error);
     }
   }
   ```

**Deliverables**:
- [ ] Authentication working with NextAuth.js
- [ ] API middleware for auth/errors
- [ ] Input validation with Zod
- [ ] Complete patient CRUD API
- [ ] Audit logging for patient operations

**Validation**:
```bash
# Test login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@hospital.org","password":"Admin123!"}'

# Test protected endpoint
curl http://localhost:3000/api/patients/1 \
  -H "Authorization: Bearer <token>"
```

---

## Phase 2: Real-Time & Caching (Weeks 3-4)

### Week 3: Real-Time Vitals Streaming

**Goals**:
- Implement WebSocket server for real-time vitals
- Create device simulator for testing
- Build vitals recording API
- Set up TimescaleDB continuous aggregates

**Tasks**:

1. **Custom WebSocket Server** (Day 1-3)
   ```bash
   npm install ws
   ```

   Create `/server/websocket.js`:
   ```javascript
   import { WebSocketServer } from 'ws';
   import { verify } from 'jsonwebtoken';
   import { prisma } from '../lib/db.js';

   const wss = new WebSocketServer({ port: 3001 });

   // Client subscriptions: Map<clientId, Set<patientId>>
   const subscriptions = new Map();

   wss.on('connection', (ws, req) => {
     console.log('Client connected');

     ws.on('message', async (data) => {
       try {
         const message = JSON.parse(data);

         switch (message.type) {
           case 'auth':
             // Verify JWT token
             const payload = verify(message.token, process.env.JWT_SECRET);
             ws.userId = payload.id;
             ws.send(JSON.stringify({ type: 'auth_success' }));
             break;

           case 'subscribe':
             if (!ws.userId) {
               ws.send(JSON.stringify({ type: 'error', message: 'Not authenticated' }));
               return;
             }

             // Subscribe to patient updates
             if (!subscriptions.has(ws)) {
               subscriptions.set(ws, new Set());
             }

             message.patientIds.forEach(id => {
               subscriptions.get(ws).add(id);
             });

             ws.send(JSON.stringify({
               type: 'subscribed',
               patientIds: message.patientIds,
             }));
             break;

           case 'unsubscribe':
             if (subscriptions.has(ws)) {
               message.patientIds.forEach(id => {
                 subscriptions.get(ws).delete(id);
               });
             }
             break;
         }
       } catch (error) {
         console.error('WebSocket error:', error);
         ws.send(JSON.stringify({ type: 'error', message: error.message }));
       }
     });

     ws.on('close', () => {
       subscriptions.delete(ws);
       console.log('Client disconnected');
     });

     // Heartbeat
     ws.isAlive = true;
     ws.on('pong', () => { ws.isAlive = true; });
   });

   // Heartbeat interval
   setInterval(() => {
     wss.clients.forEach(ws => {
       if (!ws.isAlive) return ws.terminate();
       ws.isAlive = false;
       ws.ping();
     });
   }, 30000);

   // Broadcast vitals to subscribers
   export function broadcastVitals(patientId, vitals) {
     const message = JSON.stringify({
       type: 'vitals_update',
       patientId,
       timestamp: new Date().toISOString(),
       data: vitals,
     });

     wss.clients.forEach(ws => {
       if (ws.readyState === ws.OPEN && subscriptions.has(ws)) {
         const subscribedPatients = subscriptions.get(ws);
         if (subscribedPatients.has(patientId)) {
           ws.send(message);
         }
       }
     });
   }

   export function broadcastAlarm(alarm) {
     const message = JSON.stringify({
       type: 'alarm',
       ...alarm,
     });

     wss.clients.forEach(ws => {
       if (ws.readyState === ws.OPEN && subscriptions.has(ws)) {
         const subscribedPatients = subscriptions.get(ws);
         if (subscribedPatients.has(alarm.patientId)) {
           ws.send(message);
         }
       }
     });
   }

   console.log('WebSocket server running on port 3001');
   ```

2. **Device Simulator** (Day 2-3)
   Create `/scripts/device-simulator.js`:
   ```javascript
   import { prisma } from '../lib/db.js';
   import { broadcastVitals } from '../server/websocket.js';

   async function generateVitals(patient) {
     const variance = patient.status === 'critical' ? 5 : 2.5;

     return {
       spo2: Math.min(100, Math.max(0, Math.round(patient.baseSPO2 + (Math.random() - 0.5) * variance))),
       pulseRate: Math.round(patient.basePR + (Math.random() - 0.5) * variance * 2),
       respiratoryRate: Math.round(patient.baseRR + (Math.random() - 0.5) * variance * 2),
       temperature: parseFloat((patient.baseTemp + (Math.random() - 0.5) * 0.15).toFixed(1)),
       fio2: patient.fio2,
       perfusionIndex: parseFloat((0.5 + Math.random() * 4).toFixed(1)),
     };
   }

   async function simulateMonitor() {
     const patients = await prisma.patient.findMany({
       where: { status: 'active' },
     });

     setInterval(async () => {
       for (const patient of patients) {
         const vitals = await generateVitals(patient);

         // Save to database
         await prisma.vitals.create({
           data: {
             patient_id: patient.id,
             time: new Date(),
             ...vitals,
             source: 'monitor',
             device_id: `SIM-${patient.bed_id}`,
           },
         });

         // Broadcast to WebSocket clients
         broadcastVitals(patient.id, vitals);

         // Check alarm conditions
         await checkAlarms(patient, vitals);
       }
     }, 5000); // Every 5 seconds
   }

   async function checkAlarms(patient, vitals) {
     const limits = await prisma.alarmLimits.findMany({
       where: {
         patient_id: patient.id,
         valid_from: { lte: new Date() },
         OR: [
           { valid_until: null },
           { valid_until: { gte: new Date() } },
         ],
       },
     });

     for (const limit of limits) {
       const value = vitals[limit.parameter];

       if (value < limit.lower_limit || value > limit.upper_limit) {
         const alarm = await prisma.alarm.create({
           data: {
             patient_id: patient.id,
             severity: value < limit.lower_limit * 0.9 || value > limit.upper_limit * 1.1 ? 'critical' : 'warning',
             parameter: limit.parameter,
             value: value.toString(),
             threshold: `${limit.lower_limit}-${limit.upper_limit}`,
             message: `${limit.parameter} ${value < limit.lower_limit ? 'below' : 'above'} limit`,
           },
         });

         broadcastAlarm(alarm);
       }
     }
   }

   simulateMonitor();
   ```

   Run simulator:
   ```bash
   node scripts/device-simulator.js
   ```

**Deliverables**:
- [ ] WebSocket server operational
- [ ] Client can subscribe to patient vitals
- [ ] Device simulator generating realistic data
- [ ] Vitals stored in TimescaleDB
- [ ] Real-time alarms working

---

### Week 4: Caching & Performance

**Goals**:
- Set up Redis for caching
- Implement rate limiting
- Optimize database queries
- Add compression and CDN

**Tasks**:

1. **Redis Setup** (Day 1-2)
   ```bash
   npm install @upstash/redis @upstash/ratelimit
   ```

   Create `/lib/cache.js`:
   ```javascript
   import { Redis } from '@upstash/redis';

   export const redis = new Redis({
     url: process.env.UPSTASH_REDIS_REST_URL,
     token: process.env.UPSTASH_REDIS_REST_TOKEN,
   });

   export async function cacheLatestVitals(patientId, vitals) {
     const key = `vitals:latest:${patientId}`;
     await redis.setex(key, 300, JSON.stringify(vitals)); // 5 min TTL
   }

   export async function getLatestVitals(patientId) {
     const key = `vitals:latest:${patientId}`;
     const cached = await redis.get(key);

     if (cached) return JSON.parse(cached);

     // Fallback to database
     const vitals = await prisma.vitals.findFirst({
       where: { patient_id: patientId },
       orderBy: { time: 'desc' },
     });

     if (vitals) {
       await cacheLatestVitals(patientId, vitals);
     }

     return vitals;
   }
   ```

2. **Rate Limiting** (Day 2-3)
   Create `/lib/middleware/rateLimit.js`:
   ```javascript
   import { Ratelimit } from '@upstash/ratelimit';
   import { redis } from '@/lib/cache';

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
   };

   export async function rateLimit(identifier, type = 'api_read') {
     const limiter = limiters[type];
     const { success, limit, reset, remaining } = await limiter.limit(identifier);

     if (!success) {
       throw new APIError('Rate limit exceeded', 429, 'RATE_LIMIT_EXCEEDED', {
         limit,
         remaining,
         resetAt: new Date(reset).toISOString(),
       });
     }

     return { limit, remaining, resetAt: new Date(reset) };
   }
   ```

**Deliverables**:
- [ ] Redis caching operational
- [ ] Rate limiting on all API endpoints
- [ ] Query performance optimized
- [ ] Response times < 200ms

---

## Phase 3: Device Integration & Medical Standards (Weeks 5-6)

### Week 5: HL7/FHIR Integration

**Tasks**:
1. Implement HL7 v2.x message parser
2. Create FHIR R4 resource endpoints
3. Build device listener service
4. Test with HL7 simulator

**Deliverables**:
- [ ] HL7 ADT messages processed
- [ ] FHIR Patient resource endpoint
- [ ] FHIR Observation endpoint for vitals
- [ ] Device integration framework

---

### Week 6: Audit & Compliance

**Tasks**:
1. Complete audit logging
2. Implement electronic signatures
3. Create audit reports
4. HIPAA compliance checklist

**Deliverables**:
- [ ] All actions audited
- [ ] Audit log immutable
- [ ] Audit reports exportable
- [ ] HIPAA compliance documented

---

## Phase 4: Production Hardening (Weeks 7-8)

### Week 7: Testing & Monitoring

**Tasks**:
1. Write integration tests
2. Set up Sentry for error tracking
3. Configure uptime monitoring
4. Load testing

**Deliverables**:
- [ ] 80%+ test coverage
- [ ] Monitoring dashboards live
- [ ] Load test passes (1000 concurrent users)

---

### Week 8: Deployment & Documentation

**Tasks**:
1. Production deployment to Vercel/AWS
2. Database backups automated
3. SSL certificates
4. User documentation

**Deliverables**:
- [ ] Production environment live
- [ ] 99.9% uptime achieved
- [ ] Documentation complete
- [ ] Training materials ready

---

## Budget Estimates

**Development Costs** (8 weeks):
- Backend Engineer: $15,000 - $25,000
- Frontend Updates: $5,000 - $10,000
- DevOps/Infrastructure: $3,000 - $5,000
- Total: $23,000 - $40,000

**Infrastructure Costs** (Monthly):
- Minimal: $150/month (Vercel + Neon + Upstash)
- Production: $900/month (AWS + RDS + ElastiCache)

---

## Success Metrics

- [ ] API response time < 200ms (p95)
- [ ] WebSocket latency < 100ms
- [ ] 99.9% uptime
- [ ] Zero data loss
- [ ] < 5 minute recovery time
- [ ] HIPAA audit passed
- [ ] 100% critical actions logged

---

## Next Steps

1. **Week 1**: Set up development environment
2. **Week 2**: Complete Phase 1 foundation
3. **Week 4**: Demo real-time vitals to stakeholders
4. **Week 6**: Security audit
5. **Week 8**: Production launch

---

**Document Version**: 1.0
**Last Updated**: December 30, 2024
**Next Review**: After Phase 1 completion
