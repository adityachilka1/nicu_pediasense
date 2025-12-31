-- CreateTable
CREATE TABLE "devices" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "serial_number" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "manufacturer" TEXT,
    "model" TEXT,
    "bed_id" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'active',
    "last_ping_at" DATETIME,
    "firmware_version" TEXT,
    "config" TEXT,
    "last_calibration" DATETIME,
    "next_calibration" DATETIME,
    "last_maintenance" DATETIME,
    "next_maintenance" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "devices_bed_id_fkey" FOREIGN KEY ("bed_id") REFERENCES "beds" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "device_logs" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "device_id" INTEGER NOT NULL,
    "level" TEXT NOT NULL DEFAULT 'info',
    "category" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "details" TEXT,
    "user_id" INTEGER,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "device_logs_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "alarm_limit_presets" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "description" TEXT,
    "limits" TEXT NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "growth_measurements" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "patient_id" INTEGER NOT NULL,
    "weight" REAL,
    "length" REAL,
    "head_circ" REAL,
    "weight_percentile" REAL,
    "length_percentile" REAL,
    "head_circ_percentile" REAL,
    "measured_by" TEXT,
    "notes" TEXT,
    "measured_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "growth_measurements_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "feeding_logs" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "patient_id" INTEGER NOT NULL,
    "feeding_type" TEXT NOT NULL,
    "route" TEXT NOT NULL,
    "volume_ordered" REAL,
    "volume_given" REAL,
    "volume_residual" REAL,
    "residual_color" TEXT,
    "tolerance" TEXT,
    "emesis" BOOLEAN NOT NULL DEFAULT false,
    "emesis_amount" REAL,
    "fortified" BOOLEAN NOT NULL DEFAULT false,
    "calories" INTEGER,
    "notes" TEXT,
    "recorded_by" TEXT,
    "recorded_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "feeding_logs_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "flowsheet_entries" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "patient_id" INTEGER NOT NULL,
    "shift_date" DATETIME NOT NULL,
    "hour" INTEGER NOT NULL,
    "iv_fluids" REAL,
    "tpn" REAL,
    "lipids" REAL,
    "blood_products" REAL,
    "medications" REAL,
    "enteral" REAL,
    "urine" REAL,
    "stool" REAL,
    "emesis" REAL,
    "gastric_output" REAL,
    "ostomy_output" REAL,
    "drain_output" REAL,
    "stool_count" INTEGER,
    "stool_type" TEXT,
    "urine_count" INTEGER,
    "specific_gravity" REAL,
    "notes" TEXT,
    "recorded_by" TEXT,
    "recorded_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "flowsheet_entries_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "family_contacts" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "patient_id" INTEGER NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "relationship" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "preferred_contact" TEXT NOT NULL DEFAULT 'phone',
    "is_primary_contact" BOOLEAN NOT NULL DEFAULT false,
    "can_receive_updates" BOOLEAN NOT NULL DEFAULT true,
    "can_view_records" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "verified_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "family_contacts_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "family_messages" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "family_contact_id" INTEGER NOT NULL,
    "sender_id" INTEGER,
    "subject" TEXT,
    "content" TEXT NOT NULL,
    "message_type" TEXT NOT NULL DEFAULT 'general',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "sent_at" DATETIME,
    "delivered_at" DATETIME,
    "read_at" DATETIME,
    "channel" TEXT NOT NULL DEFAULT 'app',
    "is_inbound" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "family_messages_family_contact_id_fkey" FOREIGN KEY ("family_contact_id") REFERENCES "family_contacts" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "family_messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "education_materials" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "content" TEXT NOT NULL,
    "content_type" TEXT NOT NULL DEFAULT 'article',
    "category" TEXT NOT NULL,
    "gestational_age_min" INTEGER,
    "gestational_age_max" INTEGER,
    "day_of_life_min" INTEGER,
    "day_of_life_max" INTEGER,
    "estimated_minutes" INTEGER,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "education_progress" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "family_contact_id" INTEGER NOT NULL,
    "material_id" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'not_started',
    "started_at" DATETIME,
    "completed_at" DATETIME,
    "time_spent_seconds" INTEGER NOT NULL DEFAULT 0,
    "quiz_score" REAL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "education_progress_family_contact_id_fkey" FOREIGN KEY ("family_contact_id") REFERENCES "family_contacts" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "education_progress_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "education_materials" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "user_id" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'info',
    "category" TEXT NOT NULL DEFAULT 'system',
    "priority" TEXT NOT NULL DEFAULT 'normal',
    "resource_type" TEXT,
    "resource_id" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'unread',
    "read_at" DATETIME,
    "dismissed_at" DATETIME,
    "expires_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "orders" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "patient_id" INTEGER NOT NULL,
    "ordering_id" INTEGER NOT NULL,
    "category" TEXT NOT NULL,
    "order_type" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'routine',
    "order_set_id" INTEGER,
    "name" TEXT NOT NULL,
    "details" TEXT,
    "instructions" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "start_time" DATETIME,
    "end_time" DATETIME,
    "discontinued_at" DATETIME,
    "discontinued_by_id" INTEGER,
    "discontinue_reason" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "orders_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "orders_ordering_id_fkey" FOREIGN KEY ("ordering_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "orders_order_set_id_fkey" FOREIGN KEY ("order_set_id") REFERENCES "order_sets" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "orders_discontinued_by_id_fkey" FOREIGN KEY ("discontinued_by_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "order_sets" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL,
    "items" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "care_plans" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "patient_id" INTEGER NOT NULL,
    "created_by_id" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "goals" TEXT,
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "status" TEXT NOT NULL DEFAULT 'active',
    "start_date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "target_date" DATETIME,
    "completed_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "care_plans_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "care_plans_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "care_plan_items" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "care_plan_id" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "item_type" TEXT NOT NULL DEFAULT 'task',
    "frequency" TEXT,
    "due_date" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "completed_at" DATETIME,
    "completed_by_id" INTEGER,
    "notes" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "care_plan_items_care_plan_id_fkey" FOREIGN KEY ("care_plan_id") REFERENCES "care_plans" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "discharge_plans" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "patient_id" INTEGER NOT NULL,
    "created_by_id" INTEGER NOT NULL,
    "estimated_date" DATETIME,
    "actual_date" DATETIME,
    "disposition" TEXT,
    "primary_caregiver" TEXT,
    "caregiver_phone" TEXT,
    "status" TEXT NOT NULL DEFAULT 'planning',
    "readiness_score" INTEGER,
    "special_instructions" TEXT,
    "follow_up_plan" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "discharge_plans_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "discharge_plans_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "discharge_checklist_items" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "discharge_plan_id" INTEGER NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "order_index" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "completed_at" DATETIME,
    "completed_by_id" INTEGER,
    "notes" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "discharge_checklist_items_discharge_plan_id_fkey" FOREIGN KEY ("discharge_plan_id") REFERENCES "discharge_plans" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "handoff_notes" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "patient_id" INTEGER NOT NULL,
    "author_id" INTEGER NOT NULL,
    "shift" TEXT NOT NULL,
    "shift_date" DATETIME NOT NULL,
    "situation" TEXT,
    "background" TEXT,
    "assessment" TEXT,
    "recommendation" TEXT,
    "acuity" TEXT,
    "key_events" TEXT,
    "pending_tasks" TEXT,
    "alerts_flags" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "acknowledged_at" DATETIME,
    "acknowledged_by_id" INTEGER,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "handoff_notes_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "handoff_notes_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "handoff_notes_acknowledged_by_id_fkey" FOREIGN KEY ("acknowledged_by_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "devices_serial_number_key" ON "devices"("serial_number");

-- CreateIndex
CREATE INDEX "devices_bed_id_idx" ON "devices"("bed_id");

-- CreateIndex
CREATE INDEX "devices_type_status_idx" ON "devices"("type", "status");

-- CreateIndex
CREATE INDEX "device_logs_device_id_created_at_idx" ON "device_logs"("device_id", "created_at");

-- CreateIndex
CREATE INDEX "device_logs_level_created_at_idx" ON "device_logs"("level", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "alarm_limit_presets_name_key" ON "alarm_limit_presets"("name");

-- CreateIndex
CREATE INDEX "growth_measurements_patient_id_measured_at_idx" ON "growth_measurements"("patient_id", "measured_at");

-- CreateIndex
CREATE INDEX "feeding_logs_patient_id_recorded_at_idx" ON "feeding_logs"("patient_id", "recorded_at");

-- CreateIndex
CREATE INDEX "flowsheet_entries_patient_id_shift_date_idx" ON "flowsheet_entries"("patient_id", "shift_date");

-- CreateIndex
CREATE UNIQUE INDEX "flowsheet_entries_patient_id_shift_date_hour_key" ON "flowsheet_entries"("patient_id", "shift_date", "hour");

-- CreateIndex
CREATE INDEX "family_contacts_patient_id_idx" ON "family_contacts"("patient_id");

-- CreateIndex
CREATE INDEX "family_contacts_patient_id_is_primary_contact_idx" ON "family_contacts"("patient_id", "is_primary_contact");

-- CreateIndex
CREATE INDEX "family_contacts_email_idx" ON "family_contacts"("email");

-- CreateIndex
CREATE INDEX "family_messages_family_contact_id_created_at_idx" ON "family_messages"("family_contact_id", "created_at");

-- CreateIndex
CREATE INDEX "family_messages_sender_id_idx" ON "family_messages"("sender_id");

-- CreateIndex
CREATE INDEX "family_messages_status_created_at_idx" ON "family_messages"("status", "created_at");

-- CreateIndex
CREATE INDEX "education_materials_category_idx" ON "education_materials"("category");

-- CreateIndex
CREATE INDEX "education_progress_family_contact_id_idx" ON "education_progress"("family_contact_id");

-- CreateIndex
CREATE INDEX "education_progress_material_id_idx" ON "education_progress"("material_id");

-- CreateIndex
CREATE UNIQUE INDEX "education_progress_family_contact_id_material_id_key" ON "education_progress"("family_contact_id", "material_id");

-- CreateIndex
CREATE INDEX "notifications_user_id_status_idx" ON "notifications"("user_id", "status");

-- CreateIndex
CREATE INDEX "notifications_user_id_created_at_idx" ON "notifications"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "notifications_user_id_status_priority_idx" ON "notifications"("user_id", "status", "priority");

-- CreateIndex
CREATE INDEX "notifications_category_idx" ON "notifications"("category");

-- CreateIndex
CREATE INDEX "notifications_expires_at_idx" ON "notifications"("expires_at");

-- CreateIndex
CREATE INDEX "orders_patient_id_status_idx" ON "orders"("patient_id", "status");

-- CreateIndex
CREATE INDEX "orders_patient_id_category_idx" ON "orders"("patient_id", "category");

-- CreateIndex
CREATE INDEX "orders_patient_id_status_category_idx" ON "orders"("patient_id", "status", "category");

-- CreateIndex
CREATE INDEX "orders_ordering_id_created_at_idx" ON "orders"("ordering_id", "created_at");

-- CreateIndex
CREATE INDEX "orders_status_priority_idx" ON "orders"("status", "priority");

-- CreateIndex
CREATE INDEX "orders_created_at_idx" ON "orders"("created_at");

-- CreateIndex
CREATE INDEX "care_plans_patient_id_status_idx" ON "care_plans"("patient_id", "status");

-- CreateIndex
CREATE INDEX "care_plans_category_idx" ON "care_plans"("category");

-- CreateIndex
CREATE INDEX "care_plans_created_by_id_created_at_idx" ON "care_plans"("created_by_id", "created_at");

-- CreateIndex
CREATE INDEX "care_plans_priority_status_idx" ON "care_plans"("priority", "status");

-- CreateIndex
CREATE INDEX "care_plan_items_care_plan_id_status_idx" ON "care_plan_items"("care_plan_id", "status");

-- CreateIndex
CREATE INDEX "care_plan_items_due_date_status_idx" ON "care_plan_items"("due_date", "status");

-- CreateIndex
CREATE UNIQUE INDEX "discharge_plans_patient_id_key" ON "discharge_plans"("patient_id");

-- CreateIndex
CREATE INDEX "discharge_plans_status_idx" ON "discharge_plans"("status");

-- CreateIndex
CREATE INDEX "discharge_plans_estimated_date_idx" ON "discharge_plans"("estimated_date");

-- CreateIndex
CREATE INDEX "discharge_plans_status_estimated_date_idx" ON "discharge_plans"("status", "estimated_date");

-- CreateIndex
CREATE INDEX "discharge_checklist_items_discharge_plan_id_status_idx" ON "discharge_checklist_items"("discharge_plan_id", "status");

-- CreateIndex
CREATE INDEX "discharge_checklist_items_category_idx" ON "discharge_checklist_items"("category");

-- CreateIndex
CREATE INDEX "handoff_notes_patient_id_shift_date_idx" ON "handoff_notes"("patient_id", "shift_date");

-- CreateIndex
CREATE INDEX "handoff_notes_shift_shift_date_idx" ON "handoff_notes"("shift", "shift_date");

-- CreateIndex
CREATE INDEX "handoff_notes_author_id_created_at_idx" ON "handoff_notes"("author_id", "created_at");

-- CreateIndex
CREATE INDEX "handoff_notes_status_idx" ON "handoff_notes"("status");

-- CreateIndex
CREATE INDEX "handoff_notes_shift_date_status_idx" ON "handoff_notes"("shift_date", "status");

-- CreateIndex
CREATE INDEX "alarm_acknowledgments_alarm_id_idx" ON "alarm_acknowledgments"("alarm_id");

-- CreateIndex
CREATE INDEX "alarm_acknowledgments_user_id_created_at_idx" ON "alarm_acknowledgments"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "alarms_type_status_idx" ON "alarms"("type", "status");

-- CreateIndex
CREATE INDEX "alarms_status_triggered_at_idx" ON "alarms"("status", "triggered_at");

-- CreateIndex
CREATE INDEX "notes_patient_id_type_created_at_idx" ON "notes"("patient_id", "type", "created_at");

-- CreateIndex
CREATE INDEX "notes_author_id_created_at_idx" ON "notes"("author_id", "created_at");

-- CreateIndex
CREATE INDEX "patients_status_idx" ON "patients"("status");

-- CreateIndex
CREATE INDEX "patients_status_discharge_date_idx" ON "patients"("status", "discharge_date");

-- CreateIndex
CREATE INDEX "patients_admit_date_idx" ON "patients"("admit_date");

-- CreateIndex
CREATE INDEX "patients_name_idx" ON "patients"("name");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE INDEX "users_active_idx" ON "users"("active");
