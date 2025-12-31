# NICU Dashboard - API Specification v1.0

**Base URL**: `https://api.nicu-dashboard.example.com/v1`
**Protocol**: HTTPS only
**Authentication**: Bearer token (JWT)
**Content-Type**: `application/json`

---

## Table of Contents

1. [Authentication](#authentication)
2. [Patients API](#patients-api)
3. [Vitals API](#vitals-api)
4. [Alarms API](#alarms-api)
5. [Medications API](#medications-api)
6. [Lab Results API](#lab-results-api)
7. [Clinical Notes API](#clinical-notes-api)
8. [Orders API](#orders-api)
9. [Audit API](#audit-api)
10. [Real-Time Streaming](#real-time-streaming)
11. [Error Responses](#error-responses)

---

## Authentication

### POST /auth/login

Authenticate user and receive JWT token.

**Request**:
```json
{
  "email": "nurse.moore@hospital.org",
  "password": "SecurePassword123!"
}
```

**Response** (200 OK):
```json
{
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": 900,
    "user": {
      "id": 5,
      "email": "nurse.moore@hospital.org",
      "fullName": "Jessica Moore",
      "role": "nurse"
    }
  },
  "meta": {
    "timestamp": "2024-12-30T12:00:00.000Z"
  }
}
```

**Errors**:
- 401: Invalid credentials
- 429: Rate limit exceeded (5 attempts per 5 minutes)

### POST /auth/refresh

Refresh access token using refresh token.

**Request**:
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response** (200 OK):
```json
{
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": 900
  }
}
```

### POST /auth/logout

Revoke current session.

**Headers**:
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response** (204 No Content)

---

## Patients API

### GET /patients

List all active patients in the NICU.

**Query Parameters**:
- `status` (string): Filter by status (`active`, `discharged`)
- `bed` (string): Filter by bed number
- `limit` (integer): Results per page (default: 20, max: 100)
- `offset` (integer): Pagination offset
- `sort` (string): Sort field (e.g., `dol:desc`, `bed:asc`)

**Request**:
```http
GET /v1/patients?status=active&sort=bed:asc&limit=10
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response** (200 OK):
```json
{
  "data": [
    {
      "id": 1,
      "mrn": "MRN-48210",
      "firstName": "Baby",
      "lastName": "Thompson",
      "gender": "F",
      "dateOfBirth": "2024-12-21T14:30:00.000Z",
      "gestationalAge": {
        "weeks": 32,
        "days": 4,
        "total": "32+4"
      },
      "weight": {
        "current": 1.82,
        "birth": 1.65,
        "unit": "kg"
      },
      "dayOfLife": 8,
      "bed": {
        "id": 1,
        "number": "01"
      },
      "status": "active",
      "admitDate": "2024-12-21T14:30:00.000Z",
      "attendingPhysician": {
        "id": 1,
        "name": "Dr. Sarah Chen"
      },
      "primaryNurse": {
        "id": 5,
        "name": "RN Jessica Moore"
      },
      "diagnosis": [
        "Prematurity",
        "RDS - Resolved"
      ],
      "currentVitals": {
        "spo2": 96,
        "pulseRate": 145,
        "respiratoryRate": 42,
        "temperature": 36.8,
        "fio2": 21,
        "timestamp": "2024-12-30T11:59:45.000Z"
      },
      "alarmStatus": "normal",
      "unacknowledgedAlarms": 0
    }
    // ... more patients
  ],
  "pagination": {
    "limit": 10,
    "offset": 0,
    "total": 8
  },
  "meta": {
    "timestamp": "2024-12-30T12:00:00.000Z"
  }
}
```

### GET /patients/:id

Get detailed patient information.

**Request**:
```http
GET /v1/patients/1
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response** (200 OK):
```json
{
  "data": {
    "id": 1,
    "mrn": "MRN-48210",
    "firstName": "Baby",
    "lastName": "Thompson",
    "gender": "F",
    "dateOfBirth": "2024-12-21T14:30:00.000Z",
    "gestationalAge": {
      "weeks": 32,
      "days": 4,
      "total": "32+4"
    },
    "birthInfo": {
      "weight": 1.65,
      "length": 43.5,
      "headCircumference": 30.2,
      "apgar": {
        "1min": 7,
        "5min": 9
      },
      "deliveryType": "C-Section"
    },
    "mother": {
      "mrn": "MRN-98765",
      "name": "Thompson, Sarah",
      "age": 28,
      "bloodType": "O+",
      "gbsStatus": "Negative"
    },
    "currentWeight": 1.82,
    "dayOfLife": 8,
    "bed": {
      "id": 1,
      "number": "01",
      "unit": "NICU"
    },
    "status": "active",
    "admitDate": "2024-12-21T14:30:00.000Z",
    "admitSource": "Labor & Delivery",
    "attendingPhysician": {
      "id": 1,
      "name": "Dr. Sarah Chen",
      "npi": "1234567890"
    },
    "primaryNurse": {
      "id": 5,
      "name": "RN Jessica Moore"
    },
    "diagnosis": [
      "Prematurity",
      "RDS - Resolved"
    ],
    "respiratorySupport": {
      "type": "Room Air",
      "fio2": 21
    },
    "vascularAccess": ["PICC Line"],
    "feedingPlan": {
      "type": "NGT",
      "volume": 45,
      "frequency": "q3h",
      "formula": "Enfamil 24cal"
    },
    "isolation": null,
    "alarmLimits": {
      "spo2": { "low": 88, "high": 100 },
      "pulseRate": { "low": 100, "high": 180 },
      "respiratoryRate": { "low": 25, "high": 70 },
      "temperature": { "low": 36.0, "high": 38.0 }
    },
    "createdAt": "2024-12-21T14:30:00.000Z",
    "updatedAt": "2024-12-30T08:15:00.000Z"
  },
  "meta": {
    "timestamp": "2024-12-30T12:00:00.000Z"
  }
}
```

**Errors**:
- 404: Patient not found
- 403: Insufficient permissions

### POST /patients

Admit a new patient to the NICU.

**Request**:
```json
{
  "mrn": "MRN-48299",
  "firstName": "Baby",
  "lastName": "Anderson",
  "gender": "M",
  "dateOfBirth": "2024-12-30T10:30:00.000Z",
  "gestationalAge": {
    "weeks": 29,
    "days": 3
  },
  "birthWeight": 1.25,
  "birthLength": 38.0,
  "birthHeadCircumference": 26.5,
  "apgar1": 6,
  "apgar5": 8,
  "deliveryType": "Vaginal",
  "motherMRN": "MRN-87654",
  "motherName": "Anderson, Emily",
  "motherAge": 32,
  "bloodType": "A+",
  "gbsStatus": "Positive",
  "admitDate": "2024-12-30T10:30:00.000Z",
  "admitSource": "Labor & Delivery",
  "bedNumber": "09",
  "attendingPhysicianId": 2,
  "primaryNurseId": 6,
  "admitDiagnosis": [
    "Prematurity",
    "RDS"
  ],
  "respiratorySupport": "CPAP 6cm",
  "fio2": 40,
  "ivAccess": "UVC, UAC"
}
```

**Response** (201 Created):
```json
{
  "data": {
    "id": 9,
    "mrn": "MRN-48299",
    "firstName": "Baby",
    "lastName": "Anderson",
    "gender": "M",
    "dateOfBirth": "2024-12-30T10:30:00.000Z",
    "bed": {
      "id": 9,
      "number": "09"
    },
    "status": "active",
    "admitDate": "2024-12-30T10:30:00.000Z",
    "createdAt": "2024-12-30T12:00:00.000Z"
  },
  "meta": {
    "timestamp": "2024-12-30T12:00:00.000Z"
  }
}
```

**Errors**:
- 400: Validation failed
- 409: MRN already exists
- 403: Insufficient permissions (must be nurse or physician)

### PATCH /patients/:id

Update patient information (partial update).

**Request**:
```json
{
  "weight": 1.35,
  "bedNumber": "10",
  "respiratorySupport": "Low Flow O2 1L",
  "fio2": 30
}
```

**Response** (200 OK):
```json
{
  "data": {
    "id": 9,
    "weight": 1.35,
    "bed": {
      "id": 10,
      "number": "10"
    },
    "respiratorySupport": {
      "type": "Low Flow O2 1L",
      "fio2": 30
    },
    "updatedAt": "2024-12-30T12:05:00.000Z"
  }
}
```

### POST /patients/:id/discharge

Discharge a patient from the NICU.

**Request**:
```json
{
  "dischargeDate": "2024-12-30T14:00:00.000Z",
  "dischargeDisposition": "Home",
  "dischargeWeight": 2.45,
  "dischargeSummary": "Patient stable, tolerating PO feeds, maintaining temperature in open crib. Parents educated on car seat safety and follow-up appointments.",
  "followUpInstructions": "Pediatrician appointment in 3 days. Weight check at 1 week."
}
```

**Response** (200 OK):
```json
{
  "data": {
    "id": 3,
    "status": "discharged",
    "dischargeDate": "2024-12-30T14:00:00.000Z",
    "lengthOfStay": 6,
    "updatedAt": "2024-12-30T14:00:00.000Z"
  }
}
```

---

## Vitals API

### GET /patients/:id/vitals

Get historical vitals for a patient.

**Query Parameters**:
- `from` (ISO datetime): Start time
- `to` (ISO datetime): End time
- `parameters` (comma-separated): Specific parameters (`spo2,pr,rr,temp`)
- `resolution` (string): Data aggregation (`raw`, `1m`, `5m`, `1h`)
- `limit` (integer): Max results (default: 1000)

**Request**:
```http
GET /v1/patients/4/vitals?from=2024-12-29T00:00:00Z&to=2024-12-30T00:00:00Z&resolution=5m&parameters=spo2,pr
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response** (200 OK):
```json
{
  "data": [
    {
      "timestamp": "2024-12-29T00:00:00.000Z",
      "spo2": {
        "value": 89,
        "avg": 89.2,
        "min": 85,
        "max": 92
      },
      "pulseRate": {
        "value": 165,
        "avg": 164.8,
        "min": 158,
        "max": 172
      },
      "source": "monitor",
      "deviceId": "PHI-MX800-04",
      "quality": 98
    },
    {
      "timestamp": "2024-12-29T00:05:00.000Z",
      "spo2": {
        "value": 87,
        "avg": 87.4,
        "min": 82,
        "max": 91
      },
      "pulseRate": {
        "value": 168,
        "avg": 167.2,
        "min": 162,
        "max": 175
      },
      "source": "monitor",
      "deviceId": "PHI-MX800-04",
      "quality": 95
    }
    // ... more data points
  ],
  "meta": {
    "count": 288,
    "resolution": "5m",
    "parameters": ["spo2", "pulseRate"],
    "timestamp": "2024-12-30T12:00:00.000Z"
  }
}
```

### POST /patients/:id/vitals

Record vital signs (manual entry or device import).

**Request**:
```json
{
  "timestamp": "2024-12-30T12:00:00.000Z",
  "spo2": 94,
  "pulseRate": 148,
  "respiratoryRate": 46,
  "temperature": 36.9,
  "bloodPressure": {
    "systolic": 65,
    "diastolic": 38,
    "map": 47
  },
  "fio2": 28,
  "perfusionIndex": 2.8,
  "source": "manual",
  "notes": "Patient stable during assessment"
}
```

**Response** (201 Created):
```json
{
  "data": {
    "id": 123456,
    "patientId": 4,
    "timestamp": "2024-12-30T12:00:00.000Z",
    "spo2": 94,
    "pulseRate": 148,
    "respiratoryRate": 46,
    "temperature": 36.9,
    "bloodPressure": {
      "systolic": 65,
      "diastolic": 38,
      "map": 47
    },
    "source": "manual",
    "recordedBy": {
      "id": 5,
      "name": "RN Jessica Moore"
    }
  }
}
```

**Errors**:
- 400: Invalid vital signs (out of range)
- 422: Future timestamp not allowed

---

## Alarms API

### GET /alarms

Get alarm history.

**Query Parameters**:
- `acknowledged` (boolean): Filter by acknowledgment status
- `patientId` (integer): Filter by patient
- `severity` (string): Filter by severity (`critical`, `warning`, `advisory`)
- `from` (ISO datetime): Start time
- `to` (ISO datetime): End time
- `limit` (integer): Results per page

**Request**:
```http
GET /v1/alarms?acknowledged=false&severity=critical&limit=20
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response** (200 OK):
```json
{
  "data": [
    {
      "id": 1023,
      "patient": {
        "id": 4,
        "name": "WILLIAMS, BABY",
        "bed": "04"
      },
      "alarmTime": "2024-12-30T11:45:23.000Z",
      "severity": "critical",
      "parameter": "spo2",
      "value": 78,
      "threshold": 85,
      "message": "SpO2 below lower limit",
      "acknowledged": false,
      "acknowledgedAt": null,
      "acknowledgedBy": null,
      "resolved": false,
      "resolvedAt": null,
      "escalated": false,
      "deviceId": "PHI-MX800-04"
    },
    {
      "id": 1022,
      "patient": {
        "id": 4,
        "name": "WILLIAMS, BABY",
        "bed": "04"
      },
      "alarmTime": "2024-12-30T11:42:18.000Z",
      "severity": "critical",
      "parameter": "pulseRate",
      "value": 198,
      "threshold": 180,
      "message": "Heart rate above upper limit",
      "acknowledged": true,
      "acknowledgedAt": "2024-12-30T11:42:45.000Z",
      "acknowledgedBy": {
        "id": 7,
        "name": "RN Jennifer Adams"
      },
      "resolved": true,
      "resolvedAt": "2024-12-30T11:45:00.000Z",
      "escalated": false,
      "deviceId": "PHI-MX800-04"
    }
  ],
  "pagination": {
    "limit": 20,
    "offset": 0,
    "total": 156
  },
  "meta": {
    "timestamp": "2024-12-30T12:00:00.000Z"
  }
}
```

### POST /alarms/:id/acknowledge

Acknowledge an alarm.

**Request**:
```json
{
  "notes": "Patient being repositioned, monitoring closely"
}
```

**Response** (200 OK):
```json
{
  "data": {
    "id": 1023,
    "acknowledged": true,
    "acknowledgedAt": "2024-12-30T12:00:00.000Z",
    "acknowledgedBy": {
      "id": 7,
      "name": "RN Jennifer Adams"
    },
    "notes": "Patient being repositioned, monitoring closely"
  }
}
```

### POST /alarms/:id/escalate

Escalate unresolved alarm to supervisor.

**Request**:
```json
{
  "reason": "Patient condition not improving, requesting physician evaluation"
}
```

**Response** (200 OK):
```json
{
  "data": {
    "id": 1023,
    "escalated": true,
    "escalatedAt": "2024-12-30T12:05:00.000Z",
    "escalatedTo": {
      "id": 1,
      "name": "Dr. Sarah Chen",
      "role": "attending"
    },
    "notificationSent": true
  }
}
```

---

## Medications API

### GET /patients/:id/medications

Get current medications for a patient.

**Request**:
```http
GET /v1/patients/2/medications?status=active
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response** (200 OK):
```json
{
  "data": [
    {
      "id": 45,
      "medication": "Caffeine citrate",
      "dose": "15mg",
      "route": "PO",
      "frequency": "daily",
      "startDate": "2024-12-15T08:00:00.000Z",
      "endDate": null,
      "status": "active",
      "orderedBy": {
        "id": 2,
        "name": "Dr. Michael Roberts"
      },
      "orderedAt": "2024-12-15T08:00:00.000Z",
      "nextDue": "2024-12-31T08:00:00.000Z",
      "administrationHistory": [
        {
          "scheduledTime": "2024-12-30T08:00:00.000Z",
          "administeredTime": "2024-12-30T08:15:00.000Z",
          "administeredBy": {
            "id": 5,
            "name": "RN Amanda Clark"
          },
          "status": "given",
          "doseGiven": "15mg",
          "route": "PO"
        }
      ]
    },
    {
      "id": 46,
      "medication": "Vitamin D",
      "dose": "400IU",
      "route": "PO",
      "frequency": "daily",
      "startDate": "2024-12-15T08:00:00.000Z",
      "endDate": null,
      "status": "active",
      "orderedBy": {
        "id": 2,
        "name": "Dr. Michael Roberts"
      },
      "nextDue": "2024-12-31T08:00:00.000Z"
    }
  ]
}
```

### POST /patients/:id/medications

Create a new medication order.

**Request**:
```json
{
  "medication": "Ampicillin",
  "dose": "50mg/kg",
  "route": "IV",
  "frequency": "q12h",
  "startDate": "2024-12-30T12:00:00.000Z",
  "duration": "7 days",
  "indication": "Suspected sepsis",
  "pharmacy Notes": "Reconstitute with 10ml NS, infuse over 30 minutes"
}
```

**Response** (201 Created):
```json
{
  "data": {
    "id": 47,
    "medication": "Ampicillin",
    "dose": "50mg/kg",
    "route": "IV",
    "frequency": "q12h",
    "startDate": "2024-12-30T12:00:00.000Z",
    "endDate": "2025-01-06T12:00:00.000Z",
    "status": "active",
    "orderedBy": {
      "id": 2,
      "name": "Dr. Michael Roberts"
    },
    "orderedAt": "2024-12-30T12:00:00.000Z",
    "requiresPharmacyVerification": true
  }
}
```

### POST /medications/:id/administer

Record medication administration.

**Request**:
```json
{
  "administeredTime": "2024-12-30T12:00:00.000Z",
  "doseGiven": "50mg",
  "route": "IV",
  "site": "Right hand PIV",
  "notes": "No adverse reactions noted"
}
```

**Response** (200 OK):
```json
{
  "data": {
    "administrationId": 789,
    "orderId": 47,
    "administeredTime": "2024-12-30T12:00:00.000Z",
    "administeredBy": {
      "id": 5,
      "name": "RN Amanda Clark"
    },
    "status": "given",
    "nextDue": "2024-12-31T00:00:00.000Z"
  }
}
```

---

## Lab Results API

### GET /patients/:id/labs

Get lab results for a patient.

**Query Parameters**:
- `from` (ISO datetime): Start date
- `to` (ISO datetime): End date
- `category` (string): Lab category (`cbc`, `bmp`, `cultures`)

**Request**:
```http
GET /v1/patients/4/labs?from=2024-12-28T00:00:00Z&category=cbc
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response** (200 OK):
```json
{
  "data": [
    {
      "orderId": 234,
      "orderName": "CBC with Differential",
      "orderedBy": {
        "id": 2,
        "name": "Dr. Michael Roberts"
      },
      "orderedAt": "2024-12-29T06:00:00.000Z",
      "specimenCollectedAt": "2024-12-29T06:30:00.000Z",
      "resultedAt": "2024-12-29T08:45:00.000Z",
      "status": "resulted",
      "results": [
        {
          "test": "WBC",
          "value": 12.5,
          "units": "K/uL",
          "referenceRange": "5.0-21.0",
          "isAbnormal": false,
          "isCritical": false
        },
        {
          "test": "Hemoglobin",
          "value": 8.2,
          "units": "g/dL",
          "referenceRange": "13.0-20.0",
          "isAbnormal": true,
          "isCritical": false,
          "flag": "L"
        },
        {
          "test": "Hematocrit",
          "value": 24.8,
          "units": "%",
          "referenceRange": "42-64",
          "isAbnormal": true,
          "isCritical": false,
          "flag": "L"
        },
        {
          "test": "Platelets",
          "value": 185,
          "units": "K/uL",
          "referenceRange": "150-400",
          "isAbnormal": false,
          "isCritical": false
        }
      ]
    }
  ]
}
```

### POST /patients/:id/labs

Order new lab tests.

**Request**:
```json
{
  "orderName": "Blood Culture",
  "tests": ["Aerobic Culture", "Anaerobic Culture"],
  "priority": "stat",
  "indication": "Rule out sepsis - temperature spike to 38.6C",
  "specimenType": "blood",
  "collectionMethod": "venipuncture"
}
```

**Response** (201 Created):
```json
{
  "data": {
    "orderId": 235,
    "orderName": "Blood Culture",
    "orderedBy": {
      "id": 2,
      "name": "Dr. Michael Roberts"
    },
    "orderedAt": "2024-12-30T12:00:00.000Z",
    "status": "pending",
    "priority": "stat",
    "expectedResultTime": "2024-12-30T14:00:00.000Z"
  }
}
```

---

## Clinical Notes API

### GET /patients/:id/notes

Get clinical notes for a patient.

**Query Parameters**:
- `type` (string): Note type (`progress`, `shift`, `consult`, `discharge`)
- `from` (ISO datetime): Start date
- `limit` (integer): Results per page

**Request**:
```http
GET /v1/patients/4/notes?type=progress&limit=10
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response** (200 OK):
```json
{
  "data": [
    {
      "id": 567,
      "type": "progress",
      "text": "Day of Life 21. Patient remains critically ill with severe BPD requiring HFOV. Blood cultures still pending. CXR shows worsening infiltrates bilaterally. Discussed with family - prognosis guarded. Plan: continue current support, await culture results, repeat CXR tomorrow.",
      "author": {
        "id": 2,
        "name": "Dr. Michael Roberts",
        "role": "attending"
      },
      "authoredAt": "2024-12-30T08:00:00.000Z",
      "coSignedBy": null,
      "amended": false
    }
  ]
}
```

### POST /patients/:id/notes

Create a new clinical note.

**Request**:
```json
{
  "type": "progress",
  "text": "Patient showing improvement. SpO2 stable in low 90s on CPAP. Weaning FiO2 to 30%. Feeding tolerance good at 28ml q3h. Plan to advance feeds by 5ml/kg/day."
}
```

**Response** (201 Created):
```json
{
  "data": {
    "id": 568,
    "type": "progress",
    "text": "Patient showing improvement...",
    "author": {
      "id": 5,
      "name": "RN Amanda Clark"
    },
    "authoredAt": "2024-12-30T12:00:00.000Z",
    "requiresCoSign": false
  }
}
```

---

## Orders API

### GET /patients/:id/orders

Get all orders (medications, labs, imaging, procedures).

**Request**:
```http
GET /v1/patients/4/orders?status=active
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response** (200 OK):
```json
{
  "data": [
    {
      "id": 890,
      "type": "medication",
      "description": "Vancomycin 15mg IV q12h",
      "orderedBy": {
        "id": 2,
        "name": "Dr. Michael Roberts"
      },
      "orderedAt": "2024-12-29T18:00:00.000Z",
      "status": "active",
      "priority": "routine",
      "startDate": "2024-12-29T18:00:00.000Z",
      "endDate": "2025-01-05T18:00:00.000Z"
    },
    {
      "id": 891,
      "type": "lab",
      "description": "Vancomycin trough level",
      "orderedBy": {
        "id": 2,
        "name": "Dr. Michael Roberts"
      },
      "orderedAt": "2024-12-30T06:00:00.000Z",
      "status": "pending",
      "priority": "stat",
      "scheduledFor": "2024-12-30T12:00:00.000Z"
    }
  ]
}
```

### POST /orders/:id/sign

Electronically sign an order (requires re-authentication).

**Request**:
```json
{
  "password": "SecurePassword123!",
  "comments": "Order reviewed and approved"
}
```

**Response** (200 OK):
```json
{
  "data": {
    "id": 890,
    "signedBy": {
      "id": 2,
      "name": "Dr. Michael Roberts"
    },
    "signedAt": "2024-12-30T12:00:00.000Z",
    "signature": "3f8a9b2c...", // Cryptographic signature hash
    "status": "signed"
  }
}
```

---

## Audit API

### GET /audit

Query audit log (admin/compliance only).

**Query Parameters**:
- `userId` (integer): Filter by user
- `action` (string): Filter by action type
- `patientId` (integer): Filter by patient
- `from` (ISO datetime): Start time
- `to` (ISO datetime): End time
- `severity` (string): Filter by severity

**Request**:
```http
GET /v1/audit?patientId=4&from=2024-12-29T00:00:00Z&limit=50
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response** (200 OK):
```json
{
  "data": [
    {
      "id": 12345,
      "timestamp": "2024-12-30T11:45:23.000Z",
      "user": {
        "id": 7,
        "name": "RN Jennifer Adams",
        "role": "nurse"
      },
      "action": "alarm.acknowledge",
      "resourceType": "alarm",
      "resourceId": 1023,
      "patient": {
        "id": 4,
        "mrn": "MRN-48244",
        "name": "WILLIAMS, BABY"
      },
      "ipAddress": "192.168.1.45",
      "severity": "info",
      "changes": {
        "acknowledged": {
          "before": false,
          "after": true
        }
      }
    },
    {
      "id": 12344,
      "timestamp": "2024-12-30T11:42:00.000Z",
      "user": {
        "id": 2,
        "name": "Dr. Michael Roberts",
        "role": "physician"
      },
      "action": "patient.view",
      "resourceType": "patient",
      "resourceId": 4,
      "patient": {
        "id": 4,
        "mrn": "MRN-48244",
        "name": "WILLIAMS, BABY"
      },
      "ipAddress": "192.168.1.23",
      "severity": "info"
    }
  ],
  "pagination": {
    "limit": 50,
    "offset": 0,
    "total": 2456
  }
}
```

### GET /audit/report

Generate audit report (CSV/PDF export).

**Query Parameters**:
- `format` (string): `csv` or `pdf`
- `from` (ISO datetime): Start time
- `to` (ISO datetime): End time

**Request**:
```http
GET /v1/audit/report?format=csv&from=2024-12-01T00:00:00Z&to=2024-12-31T23:59:59Z
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Response** (200 OK):
```
Content-Type: text/csv
Content-Disposition: attachment; filename="audit_log_2024-12.csv"

timestamp,user,action,patient_mrn,severity,ip_address
2024-12-30T11:45:23.000Z,RN Jennifer Adams,alarm.acknowledge,MRN-48244,info,192.168.1.45
2024-12-30T11:42:00.000Z,Dr. Michael Roberts,patient.view,MRN-48244,info,192.168.1.23
...
```

---

## Real-Time Streaming

### WebSocket: /ws/vitals

Stream real-time vital signs updates.

**Connection**:
```javascript
const ws = new WebSocket('wss://api.nicu-dashboard.example.com/ws/vitals');

// Authenticate
ws.onopen = () => {
  ws.send(JSON.stringify({
    type: 'auth',
    token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
  }));
};

// Subscribe to patients
ws.send(JSON.stringify({
  type: 'subscribe',
  patientIds: [1, 2, 4]
}));

// Receive vitals updates
ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  console.log(message);
};
```

**Server Messages**:

**Vitals Update**:
```json
{
  "type": "vitals_update",
  "patientId": 4,
  "timestamp": "2024-12-30T12:00:15.234Z",
  "data": {
    "spo2": 89,
    "pulseRate": 168,
    "respiratoryRate": 58,
    "temperature": 37.2,
    "fio2": 35,
    "perfusionIndex": 1.8,
    "source": "monitor",
    "deviceId": "PHI-MX800-04",
    "quality": 98
  }
}
```

**Alarm Event**:
```json
{
  "type": "alarm",
  "alarmId": 1024,
  "patientId": 4,
  "bed": "04",
  "severity": "critical",
  "parameter": "spo2",
  "value": 82,
  "threshold": 85,
  "message": "SpO2 below lower limit",
  "timestamp": "2024-12-30T12:00:15.234Z",
  "sound": "critical_alarm_3beep.mp3"
}
```

**Patient Status Change**:
```json
{
  "type": "status_change",
  "patientId": 4,
  "previousStatus": "warning",
  "newStatus": "critical",
  "timestamp": "2024-12-30T12:00:15.234Z",
  "reason": "Multiple critical alarms within 5 minutes"
}
```

**Heartbeat** (every 30 seconds):
```json
{
  "type": "heartbeat",
  "timestamp": "2024-12-30T12:00:30.000Z",
  "serverTime": "2024-12-30T12:00:30.123Z"
}
```

**Client Commands**:

**Unsubscribe**:
```json
{
  "type": "unsubscribe",
  "patientIds": [1]
}
```

**Acknowledge Alarm**:
```json
{
  "type": "acknowledge_alarm",
  "alarmId": 1024,
  "notes": "Patient being repositioned"
}
```

### Server-Sent Events: /sse/vitals

Alternative to WebSocket for one-way streaming.

**Connection**:
```javascript
const eventSource = new EventSource(
  'https://api.nicu-dashboard.example.com/v1/sse/vitals?patientIds=1,2,4&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
);

eventSource.addEventListener('vitals', (event) => {
  const vitals = JSON.parse(event.data);
  console.log(vitals);
});

eventSource.addEventListener('alarm', (event) => {
  const alarm = JSON.parse(event.data);
  console.log(alarm);
});
```

**Server Events**:
```
event: vitals
data: {"patientId":4,"timestamp":"2024-12-30T12:00:15.234Z","spo2":89,...}

event: alarm
data: {"alarmId":1024,"patientId":4,"severity":"critical",...}

event: heartbeat
data: {"timestamp":"2024-12-30T12:00:30.000Z"}
```

---

## Error Responses

All errors follow a consistent format:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "statusCode": 400,
    "timestamp": "2024-12-30T12:00:00.000Z",
    "details": {
      // Additional context
    }
  }
}
```

### Common Error Codes

| HTTP | Code | Message | Description |
|------|------|---------|-------------|
| 400 | VALIDATION_FAILED | Validation failed | Request body validation errors |
| 401 | UNAUTHORIZED | Authentication required | Missing or invalid token |
| 403 | INSUFFICIENT_PERMISSIONS | Access denied | User lacks required role |
| 404 | RESOURCE_NOT_FOUND | Resource not found | Patient, order, etc. not found |
| 409 | RESOURCE_CONFLICT | Resource conflict | Duplicate MRN, bed occupied |
| 422 | UNPROCESSABLE_ENTITY | Cannot process request | Business logic error |
| 429 | RATE_LIMIT_EXCEEDED | Too many requests | Rate limit exceeded |
| 500 | INTERNAL_SERVER_ERROR | Internal error | Server-side error |
| 503 | SERVICE_UNAVAILABLE | Service unavailable | Maintenance or overload |

### Example Error Responses

**Validation Error** (400):
```json
{
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Request validation failed",
    "statusCode": 400,
    "timestamp": "2024-12-30T12:00:00.000Z",
    "details": {
      "fields": [
        {
          "field": "birthWeight",
          "message": "Must be a positive number",
          "value": -1.5
        },
        {
          "field": "gaWeeks",
          "message": "Must be between 22 and 42",
          "value": 15
        }
      ]
    }
  }
}
```

**Not Found** (404):
```json
{
  "error": {
    "code": "PATIENT_NOT_FOUND",
    "message": "Patient with ID 999 not found",
    "statusCode": 404,
    "timestamp": "2024-12-30T12:00:00.000Z",
    "details": {
      "patientId": 999
    }
  }
}
```

**Rate Limit** (429):
```json
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests. Please try again later.",
    "statusCode": 429,
    "timestamp": "2024-12-30T12:00:00.000Z",
    "details": {
      "limit": 1000,
      "remaining": 0,
      "resetAt": "2024-12-30T12:01:00.000Z",
      "retryAfter": 60
    }
  }
}
```

---

## Rate Limits

**Default Limits** (per user, per minute):

| Endpoint Type | Requests | Window |
|---------------|----------|--------|
| Authentication | 5 | 5 min |
| Read (GET) | 1000 | 1 min |
| Write (POST/PATCH) | 100 | 1 min |
| Critical Operations | 10 | 1 min |
| WebSocket messages | Unlimited | - |

**Headers**:
```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 847
X-RateLimit-Reset: 2024-12-30T12:01:00.000Z
```

---

## Pagination

All list endpoints support cursor-based pagination:

**Request**:
```http
GET /v1/patients?limit=20&offset=40
```

**Response**:
```json
{
  "data": [...],
  "pagination": {
    "limit": 20,
    "offset": 40,
    "total": 156,
    "hasMore": true,
    "nextOffset": 60
  }
}
```

---

## Filtering & Sorting

**Filtering**:
```http
GET /v1/patients?status=active&gaWeeks[gte]=28&gaWeeks[lte]=32
```

**Sorting**:
```http
GET /v1/patients?sort=dol:desc,weight:asc
```

**Field Selection**:
```http
GET /v1/patients?fields=id,mrn,name,bed
```

---

## Versioning

API version is specified in the URL path:

```
/v1/patients  (current version)
/v2/patients  (future breaking changes)
```

Breaking changes warrant a new version. Non-breaking changes (new fields, new endpoints) are added to existing versions.

---

## Security

**HTTPS Only**: All requests must use HTTPS

**Authentication**: JWT Bearer tokens

**Authorization**: Role-based access control (RBAC)
- `admin`: Full access
- `physician`: Read/write patients, orders, notes
- `nurse`: Read/write vitals, medications, notes (limited)
- `respiratory_therapist`: Read vitals, update respiratory support

**CORS**: Allowed origins configured per deployment

**Content Security**: Input sanitization, output encoding

---

## Appendix: Sample Workflows

### Workflow 1: Admit a Patient

1. POST /v1/patients (admit)
2. WebSocket subscribe to patient vitals
3. POST /v1/patients/:id/medications (initial orders)
4. POST /v1/patients/:id/labs (admission labs)
5. POST /v1/patients/:id/notes (admission note)

### Workflow 2: Respond to Critical Alarm

1. WebSocket receives alarm event
2. Display alarm notification in UI
3. POST /v1/alarms/:id/acknowledge
4. Assess patient
5. POST /v1/patients/:id/vitals (manual vital signs)
6. POST /v1/patients/:id/notes (document intervention)
7. If unresolved: POST /v1/alarms/:id/escalate

### Workflow 3: Daily Rounds

1. GET /v1/patients (active census)
2. For each patient:
   - GET /v1/patients/:id
   - GET /v1/patients/:id/vitals?from=yesterday&resolution=1h
   - GET /v1/patients/:id/labs?from=yesterday
   - GET /v1/patients/:id/medications
3. POST /v1/patients/:id/notes (progress note)
4. POST /v1/patients/:id/orders (new orders)
5. PATCH /v1/patients/:id (update weight, plan)

---

**Version**: 1.0
**Last Updated**: December 30, 2024
**Contact**: api-support@nicu-dashboard.example.com
