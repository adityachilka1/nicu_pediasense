-- =====================================================
-- NICU Dashboard - Production Database Schema
-- Database: PostgreSQL 15+ with TimescaleDB extension
-- Version: 1.0
-- Last Updated: 2024-12-30
-- =====================================================

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "timescaledb";

-- =====================================================
-- USERS & AUTHENTICATION
-- =====================================================

CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,

  full_name VARCHAR(200) NOT NULL,
  role VARCHAR(50) NOT NULL CHECK (role IN (
    'nurse',
    'physician',
    'fellow',
    'resident',
    'admin',
    'respiratory_therapist',
    'pharmacist',
    'social_worker'
  )),

  active BOOLEAN DEFAULT TRUE,
  last_login TIMESTAMPTZ,
  failed_login_attempts INTEGER DEFAULT 0,
  locked_until TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_active ON users(active) WHERE active = TRUE;

-- User sessions
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  last_activity TIMESTAMPTZ DEFAULT NOW(),

  ip_address INET,
  user_agent TEXT,

  revoked BOOLEAN DEFAULT FALSE,
  revoked_at TIMESTAMPTZ,
  revoked_reason VARCHAR(200)
);

CREATE INDEX idx_sessions_user ON sessions(user_id);
CREATE INDEX idx_sessions_expires ON sessions(expires_at) WHERE NOT revoked;

-- =====================================================
-- STAFF (Clinical team members)
-- =====================================================

CREATE TABLE staff (
  id SERIAL PRIMARY KEY,
  user_id INTEGER UNIQUE REFERENCES users(id) ON DELETE SET NULL,

  npi VARCHAR(20), -- National Provider Identifier
  license_number VARCHAR(50),
  license_state VARCHAR(2),
  specialty VARCHAR(100),

  pager_number VARCHAR(20),
  phone_number VARCHAR(20),

  active BOOLEAN DEFAULT TRUE,
  hire_date DATE,
  termination_date DATE,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_staff_user ON staff(user_id);
CREATE INDEX idx_staff_npi ON staff(npi);

-- =====================================================
-- BEDS & UNITS
-- =====================================================

CREATE TABLE beds (
  id SERIAL PRIMARY KEY,
  bed_number VARCHAR(10) UNIQUE NOT NULL,
  unit VARCHAR(50) DEFAULT 'NICU',

  status VARCHAR(20) DEFAULT 'available' CHECK (status IN (
    'available',
    'occupied',
    'cleaning',
    'maintenance',
    'reserved'
  )),

  bed_type VARCHAR(50), -- 'isolette', 'warmer', 'crib', 'open_bed'
  location VARCHAR(100), -- Room/bay location

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_beds_status ON beds(status);
CREATE INDEX idx_beds_unit ON beds(unit);

-- =====================================================
-- PATIENTS
-- =====================================================

CREATE TABLE patients (
  id SERIAL PRIMARY KEY,
  mrn VARCHAR(20) UNIQUE NOT NULL,

  -- Demographics
  first_name VARCHAR(100),
  last_name VARCHAR(100) NOT NULL,
  gender CHAR(1) CHECK (gender IN ('M', 'F', 'X')),
  date_of_birth TIMESTAMPTZ NOT NULL,

  -- Birth info
  gestational_age_weeks SMALLINT CHECK (gestational_age_weeks BETWEEN 22 AND 42),
  gestational_age_days SMALLINT CHECK (gestational_age_days BETWEEN 0 AND 6),
  birth_weight DECIMAL(5,3) CHECK (birth_weight > 0 AND birth_weight < 10.0), -- kg
  birth_length DECIMAL(5,2), -- cm
  birth_head_circumference DECIMAL(5,2), -- cm
  apgar_1min SMALLINT CHECK (apgar_1min BETWEEN 0 AND 10),
  apgar_5min SMALLINT CHECK (apgar_5min BETWEEN 0 AND 10),
  delivery_type VARCHAR(50),

  -- Mother info
  mother_mrn VARCHAR(20),
  mother_name VARCHAR(200),
  mother_age SMALLINT,
  blood_type VARCHAR(5),
  gbs_status VARCHAR(20), -- Group B Strep status

  -- Admission
  admit_date TIMESTAMPTZ NOT NULL,
  admit_source VARCHAR(100),
  discharge_date TIMESTAMPTZ,
  discharge_disposition VARCHAR(100),

  current_bed_id INTEGER REFERENCES beds(id) ON DELETE SET NULL,

  status VARCHAR(20) DEFAULT 'active' CHECK (status IN (
    'active',
    'discharged',
    'transferred',
    'deceased',
    'on_hold'
  )),

  -- Clinical team
  attending_physician_id INTEGER REFERENCES staff(id) ON DELETE SET NULL,
  primary_nurse_id INTEGER REFERENCES staff(id) ON DELETE SET NULL,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_by INTEGER REFERENCES users(id),
  updated_by INTEGER REFERENCES users(id),

  -- Soft delete
  deleted_at TIMESTAMPTZ,

  CONSTRAINT valid_discharge CHECK (
    discharge_date IS NULL OR discharge_date >= admit_date
  ),
  CONSTRAINT valid_ga CHECK (
    (gestational_age_weeks IS NULL AND gestational_age_days IS NULL) OR
    (gestational_age_weeks IS NOT NULL AND gestational_age_days IS NOT NULL)
  )
);

CREATE INDEX idx_patients_mrn ON patients(mrn);
CREATE INDEX idx_patients_status ON patients(status) WHERE status = 'active';
CREATE INDEX idx_patients_bed ON patients(current_bed_id);
CREATE INDEX idx_patients_admit_date ON patients(admit_date);
CREATE INDEX idx_patients_dob ON patients(date_of_birth);

-- =====================================================
-- PATIENT DIAGNOSES
-- =====================================================

CREATE TABLE patient_diagnoses (
  id SERIAL PRIMARY KEY,
  patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,

  diagnosis VARCHAR(500) NOT NULL,
  icd10_code VARCHAR(10),

  diagnosis_type VARCHAR(20) CHECK (diagnosis_type IN ('primary', 'secondary', 'rule_out')),
  diagnosis_date TIMESTAMPTZ DEFAULT NOW(),
  resolved_date TIMESTAMPTZ,

  added_by INTEGER REFERENCES users(id),

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_diagnoses_patient ON patient_diagnoses(patient_id);
CREATE INDEX idx_diagnoses_active ON patient_diagnoses(patient_id, resolved_date) WHERE resolved_date IS NULL;

-- =====================================================
-- VITAL SIGNS (TimescaleDB Hypertable)
-- =====================================================

CREATE TABLE vitals (
  time TIMESTAMPTZ NOT NULL,
  patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,

  -- Core vitals
  spo2 SMALLINT CHECK (spo2 BETWEEN 0 AND 100),
  pulse_rate SMALLINT CHECK (pulse_rate BETWEEN 0 AND 300),
  respiratory_rate SMALLINT CHECK (respiratory_rate BETWEEN 0 AND 150),
  temperature DECIMAL(4,2) CHECK (temperature BETWEEN 25.0 AND 45.0), -- Celsius

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

  recorded_by INTEGER REFERENCES users(id),

  PRIMARY KEY (patient_id, time)
);

-- Convert to TimescaleDB hypertable
SELECT create_hypertable(
  'vitals',
  'time',
  chunk_time_interval => INTERVAL '1 day',
  if_not_exists => TRUE
);

-- Create indexes
CREATE INDEX idx_vitals_patient_time ON vitals (patient_id, time DESC);
CREATE INDEX idx_vitals_time ON vitals (time DESC);

-- Retention policy: 90 days of raw data
SELECT add_retention_policy('vitals', INTERVAL '90 days', if_not_exists => TRUE);

-- Continuous aggregates for performance
CREATE MATERIALIZED VIEW vitals_5min
WITH (timescaledb.continuous) AS
SELECT
  time_bucket('5 minutes', time) AS bucket,
  patient_id,
  AVG(spo2) AS avg_spo2,
  MIN(spo2) AS min_spo2,
  MAX(spo2) AS max_spo2,
  AVG(pulse_rate) AS avg_pulse_rate,
  MIN(pulse_rate) AS min_pulse_rate,
  MAX(pulse_rate) AS max_pulse_rate,
  AVG(respiratory_rate) AS avg_respiratory_rate,
  AVG(temperature) AS avg_temperature,
  COUNT(*) AS sample_count
FROM vitals
GROUP BY bucket, patient_id
WITH NO DATA;

-- Refresh policy for continuous aggregate
SELECT add_continuous_aggregate_policy('vitals_5min',
  start_offset => INTERVAL '1 hour',
  end_offset => INTERVAL '5 minutes',
  schedule_interval => INTERVAL '5 minutes',
  if_not_exists => TRUE
);

-- Hourly aggregates
CREATE MATERIALIZED VIEW vitals_hourly
WITH (timescaledb.continuous) AS
SELECT
  time_bucket('1 hour', time) AS hour,
  patient_id,
  AVG(spo2) AS avg_spo2,
  MIN(spo2) AS min_spo2,
  MAX(spo2) AS max_spo2,
  AVG(pulse_rate) AS avg_pulse_rate,
  MIN(pulse_rate) AS min_pulse_rate,
  MAX(pulse_rate) AS max_pulse_rate,
  AVG(respiratory_rate) AS avg_respiratory_rate,
  MIN(respiratory_rate) AS min_respiratory_rate,
  MAX(respiratory_rate) AS max_respiratory_rate,
  AVG(temperature) AS avg_temperature,
  MIN(temperature) AS min_temperature,
  MAX(temperature) AS max_temperature,
  COUNT(*) AS sample_count
FROM vitals
GROUP BY hour, patient_id
WITH NO DATA;

SELECT add_continuous_aggregate_policy('vitals_hourly',
  start_offset => INTERVAL '1 day',
  end_offset => INTERVAL '1 hour',
  schedule_interval => INTERVAL '1 hour',
  if_not_exists => TRUE
);

-- =====================================================
-- ALARM LIMITS
-- =====================================================

CREATE TABLE alarm_limits (
  id SERIAL PRIMARY KEY,
  patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,

  parameter VARCHAR(50) NOT NULL, -- 'spo2', 'pulse_rate', 'respiratory_rate', 'temperature'

  lower_limit DECIMAL(6,2),
  upper_limit DECIMAL(6,2),

  valid_from TIMESTAMPTZ DEFAULT NOW(),
  valid_until TIMESTAMPTZ,

  set_by INTEGER REFERENCES users(id),
  reason TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_alarm_limits_patient ON alarm_limits(patient_id);
CREATE INDEX idx_alarm_limits_active ON alarm_limits(patient_id, valid_from, valid_until)
  WHERE valid_until IS NULL OR valid_until > NOW();

-- =====================================================
-- ALARMS
-- =====================================================

CREATE TABLE alarms (
  id SERIAL PRIMARY KEY,
  patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,

  alarm_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  severity VARCHAR(20) NOT NULL CHECK (severity IN ('critical', 'warning', 'advisory')),
  parameter VARCHAR(50) NOT NULL,
  value VARCHAR(50),
  threshold VARCHAR(50),
  message TEXT,

  -- Alarm lifecycle
  acknowledged BOOLEAN DEFAULT FALSE,
  acknowledged_at TIMESTAMPTZ,
  acknowledged_by INTEGER REFERENCES users(id),
  acknowledgment_notes TEXT,

  resolved BOOLEAN DEFAULT FALSE,
  resolved_at TIMESTAMPTZ,
  resolution_notes TEXT,

  escalated BOOLEAN DEFAULT FALSE,
  escalated_at TIMESTAMPTZ,
  escalated_to INTEGER REFERENCES users(id),
  escalation_reason TEXT,

  -- Context
  bed_id INTEGER REFERENCES beds(id),
  device_id VARCHAR(50),

  CONSTRAINT valid_acknowledgment CHECK (
    acknowledged_at IS NULL OR acknowledged_at >= alarm_time
  ),
  CONSTRAINT valid_resolution CHECK (
    resolved_at IS NULL OR resolved_at >= alarm_time
  )
);

CREATE INDEX idx_alarms_patient ON alarms(patient_id, alarm_time DESC);
CREATE INDEX idx_alarms_time ON alarms(alarm_time DESC);
CREATE INDEX idx_alarms_unacknowledged ON alarms(acknowledged) WHERE NOT acknowledged;
CREATE INDEX idx_alarms_severity ON alarms(severity, alarm_time DESC);

-- =====================================================
-- MEDICATION ORDERS
-- =====================================================

CREATE TABLE medication_orders (
  id SERIAL PRIMARY KEY,
  patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,

  medication_name VARCHAR(200) NOT NULL,
  dose VARCHAR(100) NOT NULL,
  dose_unit VARCHAR(50),
  route VARCHAR(50) NOT NULL,
  frequency VARCHAR(100) NOT NULL,

  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ,

  indication TEXT,
  pharmacy_notes TEXT,

  ordered_by INTEGER REFERENCES staff(id),
  ordered_at TIMESTAMPTZ DEFAULT NOW(),

  signed BOOLEAN DEFAULT FALSE,
  signed_by INTEGER REFERENCES users(id),
  signed_at TIMESTAMPTZ,
  electronic_signature VARCHAR(512), -- Cryptographic signature

  status VARCHAR(20) DEFAULT 'active' CHECK (status IN (
    'pending',
    'active',
    'discontinued',
    'completed',
    'held',
    'expired'
  )),

  discontinued_by INTEGER REFERENCES users(id),
  discontinued_at TIMESTAMPTZ,
  discontinuation_reason TEXT,

  CONSTRAINT valid_dates CHECK (end_date IS NULL OR end_date >= start_date)
);

CREATE INDEX idx_medication_orders_patient ON medication_orders(patient_id);
CREATE INDEX idx_medication_orders_active ON medication_orders(status) WHERE status = 'active';

-- =====================================================
-- MEDICATION ADMINISTRATIONS
-- =====================================================

CREATE TABLE medication_administrations (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES medication_orders(id) ON DELETE CASCADE,
  patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,

  scheduled_time TIMESTAMPTZ NOT NULL,
  administered_time TIMESTAMPTZ,

  dose_given VARCHAR(100),
  route VARCHAR(50),
  site VARCHAR(100),

  administered_by INTEGER REFERENCES users(id),

  status VARCHAR(20) DEFAULT 'scheduled' CHECK (status IN (
    'scheduled',
    'given',
    'held',
    'refused',
    'missed',
    'omitted'
  )),

  notes TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_med_admin_order ON medication_administrations(order_id);
CREATE INDEX idx_med_admin_patient ON medication_administrations(patient_id);
CREATE INDEX idx_med_admin_scheduled ON medication_administrations(scheduled_time)
  WHERE status = 'scheduled';

-- =====================================================
-- LAB ORDERS
-- =====================================================

CREATE TABLE lab_orders (
  id SERIAL PRIMARY KEY,
  patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,

  order_name VARCHAR(200) NOT NULL,

  ordered_by INTEGER REFERENCES staff(id),
  ordered_at TIMESTAMPTZ DEFAULT NOW(),

  priority VARCHAR(20) DEFAULT 'routine' CHECK (priority IN ('stat', 'urgent', 'routine')),

  specimen_type VARCHAR(100),
  collection_method VARCHAR(100),
  specimen_collected_at TIMESTAMPTZ,
  collected_by INTEGER REFERENCES users(id),

  resulted_at TIMESTAMPTZ,

  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN (
    'pending',
    'collected',
    'processing',
    'resulted',
    'cancelled'
  )),

  external_lab_id VARCHAR(100),

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_lab_orders_patient ON lab_orders(patient_id);
CREATE INDEX idx_lab_orders_status ON lab_orders(status);

-- =====================================================
-- LAB RESULTS
-- =====================================================

CREATE TABLE lab_results (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES lab_orders(id) ON DELETE CASCADE,

  test_name VARCHAR(200) NOT NULL,

  result_value VARCHAR(500),
  result_numeric DECIMAL(15,6),
  units VARCHAR(50),
  reference_range VARCHAR(200),

  is_abnormal BOOLEAN DEFAULT FALSE,
  is_critical BOOLEAN DEFAULT FALSE,
  abnormal_flag VARCHAR(10), -- 'H', 'L', 'HH', 'LL', 'A'

  loinc_code VARCHAR(20), -- LOINC standardized test code

  resulted_at TIMESTAMPTZ DEFAULT NOW(),
  resulted_by VARCHAR(200),

  reviewed_by INTEGER REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_lab_results_order ON lab_results(order_id);
CREATE INDEX idx_lab_results_critical ON lab_results(is_critical) WHERE is_critical = TRUE;

-- =====================================================
-- CLINICAL NOTES
-- =====================================================

CREATE TABLE clinical_notes (
  id SERIAL PRIMARY KEY,
  patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,

  note_type VARCHAR(50) NOT NULL CHECK (note_type IN (
    'progress',
    'shift',
    'consult',
    'discharge',
    'procedure',
    'assessment',
    'teaching'
  )),

  note_text TEXT NOT NULL,

  author_id INTEGER NOT NULL REFERENCES users(id),
  authored_at TIMESTAMPTZ DEFAULT NOW(),

  co_signed BOOLEAN DEFAULT FALSE,
  co_signed_by INTEGER REFERENCES users(id),
  co_signed_at TIMESTAMPTZ,

  -- Addendum support
  amended BOOLEAN DEFAULT FALSE,
  amendment_of INTEGER REFERENCES clinical_notes(id),
  amendment_reason TEXT,

  -- Full-text search
  search_vector tsvector,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_clinical_notes_patient ON clinical_notes(patient_id, authored_at DESC);
CREATE INDEX idx_clinical_notes_author ON clinical_notes(author_id);
CREATE INDEX idx_clinical_notes_type ON clinical_notes(note_type);
CREATE INDEX idx_clinical_notes_search ON clinical_notes USING gin(search_vector);

-- Trigger to update search vector
CREATE OR REPLACE FUNCTION update_clinical_notes_search_vector()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector := to_tsvector('english', COALESCE(NEW.note_text, ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER clinical_notes_search_update
  BEFORE INSERT OR UPDATE ON clinical_notes
  FOR EACH ROW
  EXECUTE FUNCTION update_clinical_notes_search_vector();

-- =====================================================
-- DEVICES
-- =====================================================

CREATE TABLE devices (
  id SERIAL PRIMARY KEY,

  device_id VARCHAR(50) UNIQUE NOT NULL, -- Serial number
  device_type VARCHAR(50) NOT NULL, -- 'monitor', 'iv_pump', 'ventilator'
  manufacturer VARCHAR(100),
  model VARCHAR(100),

  current_bed_id INTEGER REFERENCES beds(id),

  status VARCHAR(20) DEFAULT 'active' CHECK (status IN (
    'active',
    'offline',
    'maintenance',
    'decommissioned'
  )),

  ip_address INET,
  last_heartbeat TIMESTAMPTZ,
  firmware_version VARCHAR(50),

  calibration_due DATE,
  last_maintenance DATE,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_devices_bed ON devices(current_bed_id);
CREATE INDEX idx_devices_status ON devices(status) WHERE status = 'active';
CREATE INDEX idx_devices_type ON devices(device_type);

-- =====================================================
-- AUDIT LOG (HIPAA Compliant)
-- =====================================================

CREATE TABLE audit_log (
  id BIGSERIAL PRIMARY KEY,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  user_id INTEGER REFERENCES users(id),
  user_role VARCHAR(50),
  username VARCHAR(100),

  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(50),
  resource_id INTEGER,

  patient_id INTEGER REFERENCES patients(id),

  ip_address INET,
  user_agent TEXT,

  -- State changes (JSONB for flexibility)
  changes JSONB,

  severity VARCHAR(20) DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'error', 'critical')),

  session_id UUID REFERENCES sessions(id)
);

CREATE INDEX idx_audit_timestamp ON audit_log(timestamp DESC);
CREATE INDEX idx_audit_user ON audit_log(user_id, timestamp DESC);
CREATE INDEX idx_audit_patient ON audit_log(patient_id, timestamp DESC);
CREATE INDEX idx_audit_action ON audit_log(action, timestamp DESC);
CREATE INDEX idx_audit_resource ON audit_log(resource_type, resource_id);

-- Prevent modifications to audit log (immutability)
REVOKE UPDATE, DELETE ON audit_log FROM PUBLIC;

-- Grant SELECT only to specific audit roles
-- GRANT SELECT ON audit_log TO audit_role;

-- =====================================================
-- AUDIT TRIGGERS
-- =====================================================

-- Function to capture user ID from session
CREATE OR REPLACE FUNCTION get_current_user_id()
RETURNS INTEGER AS $$
BEGIN
  RETURN NULLIF(current_setting('app.current_user_id', TRUE), '')::INTEGER;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE;

-- Generic audit trigger function
CREATE OR REPLACE FUNCTION audit_trigger_function()
RETURNS TRIGGER AS $$
DECLARE
  user_id INTEGER;
BEGIN
  user_id := get_current_user_id();

  INSERT INTO audit_log (
    timestamp,
    user_id,
    action,
    resource_type,
    resource_id,
    patient_id,
    changes
  ) VALUES (
    NOW(),
    user_id,
    TG_OP,
    TG_TABLE_NAME,
    CASE
      WHEN TG_OP = 'DELETE' THEN OLD.id
      ELSE NEW.id
    END,
    CASE
      WHEN TG_TABLE_NAME = 'patients' THEN
        CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END
      WHEN TG_OP = 'DELETE' THEN OLD.patient_id
      ELSE NEW.patient_id
    END,
    jsonb_build_object(
      'operation', TG_OP,
      'old', CASE WHEN TG_OP != 'INSERT' THEN row_to_json(OLD) END,
      'new', CASE WHEN TG_OP != 'DELETE' THEN row_to_json(NEW) END
    )
  );

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$ LANGUAGE plpgsql;

-- Apply audit triggers to critical tables
CREATE TRIGGER audit_patients
  AFTER INSERT OR UPDATE OR DELETE ON patients
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

CREATE TRIGGER audit_medication_orders
  AFTER INSERT OR UPDATE OR DELETE ON medication_orders
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

CREATE TRIGGER audit_lab_orders
  AFTER INSERT OR UPDATE OR DELETE ON lab_orders
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

CREATE TRIGGER audit_clinical_notes
  AFTER INSERT OR UPDATE OR DELETE ON clinical_notes
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

-- =====================================================
-- UPDATED_AT TRIGGERS
-- =====================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_patients_updated_at
  BEFORE UPDATE ON patients
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_beds_updated_at
  BEFORE UPDATE ON beds
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_devices_updated_at
  BEFORE UPDATE ON devices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- VIEWS
-- =====================================================

-- Active patients with current vitals
CREATE OR REPLACE VIEW active_patients_with_vitals AS
SELECT
  p.*,
  b.bed_number,
  b.unit,
  ap.full_name AS attending_physician_name,
  pn.full_name AS primary_nurse_name,
  EXTRACT(DAY FROM AGE(NOW(), p.admit_date))::INTEGER AS day_of_life,
  (
    SELECT row_to_json(latest_vitals)
    FROM (
      SELECT
        time AS timestamp,
        spo2,
        pulse_rate,
        respiratory_rate,
        temperature,
        fio2
      FROM vitals v
      WHERE v.patient_id = p.id
      ORDER BY v.time DESC
      LIMIT 1
    ) latest_vitals
  ) AS current_vitals,
  (
    SELECT COUNT(*)
    FROM alarms a
    WHERE a.patient_id = p.id
      AND NOT a.acknowledged
  ) AS unacknowledged_alarms
FROM patients p
LEFT JOIN beds b ON p.current_bed_id = b.id
LEFT JOIN staff s_ap ON p.attending_physician_id = s_ap.id
LEFT JOIN users ap ON s_ap.user_id = ap.id
LEFT JOIN staff s_pn ON p.primary_nurse_id = s_pn.id
LEFT JOIN users pn ON s_pn.user_id = pn.id
WHERE p.status = 'active'
  AND p.deleted_at IS NULL
ORDER BY b.bed_number;

-- Patient census by day
CREATE OR REPLACE VIEW patient_census AS
SELECT
  date_trunc('day', admit_date)::DATE AS census_date,
  COUNT(*) FILTER (WHERE status = 'active') AS active_count,
  COUNT(*) FILTER (WHERE status = 'discharged') AS discharged_count,
  COUNT(*) AS total_admissions
FROM patients
WHERE deleted_at IS NULL
GROUP BY census_date
ORDER BY census_date DESC;

-- =====================================================
-- SEED DATA (Development/Testing)
-- =====================================================

-- Create default admin user (password: Admin123!)
INSERT INTO users (email, password_hash, full_name, role) VALUES
  ('admin@hospital.org', crypt('Admin123!', gen_salt('bf')), 'System Administrator', 'admin');

-- Create beds
INSERT INTO beds (bed_number, unit, bed_type, status) VALUES
  ('01', 'NICU', 'isolette', 'available'),
  ('02', 'NICU', 'isolette', 'available'),
  ('03', 'NICU', 'isolette', 'available'),
  ('04', 'NICU', 'isolette', 'available'),
  ('05', 'NICU', 'isolette', 'available'),
  ('06', 'NICU', 'isolette', 'available'),
  ('07', 'NICU', 'isolette', 'available'),
  ('08', 'NICU', 'isolette', 'available'),
  ('09', 'NICU', 'isolette', 'available'),
  ('10', 'NICU', 'isolette', 'available'),
  ('11', 'NICU', 'warmer', 'available'),
  ('12', 'NICU', 'warmer', 'available');

-- =====================================================
-- PERFORMANCE OPTIMIZATIONS
-- =====================================================

-- Analyze tables for query planner
ANALYZE patients;
ANALYZE vitals;
ANALYZE alarms;
ANALYZE medication_orders;
ANALYZE lab_orders;

-- =====================================================
-- BACKUP & RECOVERY
-- =====================================================

-- Point-in-Time Recovery (PITR) should be enabled at PostgreSQL level
-- pg_dump for regular backups
-- Example: pg_dump -Fc nicu_dashboard > backup_$(date +%Y%m%d).dump

-- =====================================================
-- SECURITY
-- =====================================================

-- Create roles with appropriate permissions
CREATE ROLE nicu_app;
GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO nicu_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO nicu_app;
REVOKE UPDATE, DELETE ON audit_log FROM nicu_app;

CREATE ROLE nicu_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO nicu_readonly;

-- Row-level security example (if needed for multi-tenancy)
-- ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY patients_isolation ON patients
--   USING (hospital_id = current_setting('app.hospital_id')::INTEGER);

-- =====================================================
-- MAINTENANCE
-- =====================================================

-- Vacuum schedule (automated in production)
-- VACUUM ANALYZE patients;
-- VACUUM ANALYZE vitals;

-- Reindex (monthly)
-- REINDEX TABLE patients;

-- =====================================================
-- MONITORING QUERIES
-- =====================================================

-- Active patient count
-- SELECT COUNT(*) FROM patients WHERE status = 'active';

-- Unacknowledged alarms
-- SELECT COUNT(*) FROM alarms WHERE NOT acknowledged;

-- Database size
-- SELECT pg_size_pretty(pg_database_size('nicu_dashboard'));

-- Table sizes
-- SELECT
--   schemaname,
--   tablename,
--   pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
-- FROM pg_tables
-- WHERE schemaname = 'public'
-- ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- =====================================================
-- END OF SCHEMA
-- =====================================================
