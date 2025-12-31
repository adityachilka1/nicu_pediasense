-- CreateTable
CREATE TABLE "users" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "initials" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "last_login" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "beds" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "bed_number" TEXT NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'NICU',
    "status" TEXT NOT NULL DEFAULT 'available',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "patients" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "mrn" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "date_of_birth" DATETIME NOT NULL,
    "gender" TEXT NOT NULL,
    "gestational_age" TEXT,
    "birth_weight" REAL,
    "current_weight" REAL,
    "day_of_life" INTEGER NOT NULL DEFAULT 1,
    "bed_id" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'normal',
    "admit_date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "discharge_date" DATETIME,
    "alarm_limits" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "patients_bed_id_fkey" FOREIGN KEY ("bed_id") REFERENCES "beds" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "vitals" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "patient_id" INTEGER NOT NULL,
    "heart_rate" INTEGER,
    "spo2" INTEGER,
    "resp_rate" INTEGER,
    "temperature" REAL,
    "fio2" INTEGER,
    "pi" REAL,
    "bp_systolic" INTEGER,
    "bp_diastolic" INTEGER,
    "bp_mean" INTEGER,
    "source" TEXT NOT NULL DEFAULT 'monitor',
    "recorded_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "vitals_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "alarms" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "patient_id" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "parameter" TEXT NOT NULL,
    "value" REAL,
    "threshold" REAL,
    "message" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "triggered_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" DATETIME,
    "silenced_until" DATETIME,
    CONSTRAINT "alarms_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "alarm_acknowledgments" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "alarm_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "note" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "alarm_acknowledgments_alarm_id_fkey" FOREIGN KEY ("alarm_id") REFERENCES "alarms" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "alarm_acknowledgments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "notes" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "patient_id" INTEGER NOT NULL,
    "author_id" INTEGER NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'progress',
    "content" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "notes_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "notes_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "user_id" INTEGER,
    "action" TEXT NOT NULL,
    "resource" TEXT,
    "resource_id" INTEGER,
    "details" TEXT,
    "ip_address" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "beds_bed_number_key" ON "beds"("bed_number");

-- CreateIndex
CREATE UNIQUE INDEX "patients_mrn_key" ON "patients"("mrn");

-- CreateIndex
CREATE UNIQUE INDEX "patients_bed_id_key" ON "patients"("bed_id");

-- CreateIndex
CREATE INDEX "vitals_patient_id_recorded_at_idx" ON "vitals"("patient_id", "recorded_at");

-- CreateIndex
CREATE INDEX "alarms_patient_id_status_idx" ON "alarms"("patient_id", "status");

-- CreateIndex
CREATE INDEX "alarms_triggered_at_idx" ON "alarms"("triggered_at");

-- CreateIndex
CREATE INDEX "notes_patient_id_created_at_idx" ON "notes"("patient_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_user_id_created_at_idx" ON "audit_logs"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_action_created_at_idx" ON "audit_logs"("action", "created_at");
