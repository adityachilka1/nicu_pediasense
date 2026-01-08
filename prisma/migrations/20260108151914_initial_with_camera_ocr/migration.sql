-- CreateEnum
CREATE TYPE "FeedingType" AS ENUM ('BREAST_MILK', 'DONOR_MILK', 'FORMULA', 'FORTIFIED_BREAST_MILK', 'FORTIFIED_FORMULA', 'TPN', 'MIXED');

-- CreateEnum
CREATE TYPE "FeedingRoute" AS ENUM ('ORAL', 'NG_TUBE', 'OG_TUBE', 'GT_TUBE', 'NJ_TUBE', 'IV');

-- CreateEnum
CREATE TYPE "FeedingTolerance" AS ENUM ('EXCELLENT', 'GOOD', 'FAIR', 'POOR', 'INTOLERANT');

-- CreateEnum
CREATE TYPE "OrderCategory" AS ENUM ('MEDICATION', 'LAB', 'IMAGING', 'DIET', 'NURSING', 'RESPIRATORY', 'PROCEDURE', 'CONSULTATION', 'THERAPY', 'EQUIPMENT');

-- CreateEnum
CREATE TYPE "OrderType" AS ENUM ('ONE_TIME', 'RECURRING', 'PRN', 'CONTINUOUS', 'STANDING');

-- CreateEnum
CREATE TYPE "OrderPriority" AS ENUM ('STAT', 'URGENT', 'ROUTINE', 'SCHEDULED', 'PRN');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'VERIFIED', 'ACTIVE', 'IN_PROGRESS', 'COMPLETED', 'DISCONTINUED', 'CANCELLED', 'EXPIRED', 'ON_HOLD');

-- CreateEnum
CREATE TYPE "CarePlanCategory" AS ENUM ('RESPIRATORY', 'NUTRITION', 'NEUROLOGICAL', 'INFECTION', 'GROWTH_DEVELOPMENT', 'SKIN_WOUND', 'FAMILY_SUPPORT', 'PAIN_MANAGEMENT', 'DEVELOPMENTAL', 'DISCHARGE_PLANNING', 'OTHER');

-- CreateEnum
CREATE TYPE "CarePlanStatus" AS ENUM ('ACTIVE', 'ON_HOLD', 'COMPLETED', 'DISCONTINUED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "CarePlanPriority" AS ENUM ('HIGH', 'MEDIUM', 'LOW');

-- CreateEnum
CREATE TYPE "CarePlanItemType" AS ENUM ('TASK', 'ASSESSMENT', 'INTERVENTION', 'EDUCATION', 'MONITORING', 'CONSULTATION');

-- CreateEnum
CREATE TYPE "CarePlanItemStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED', 'DEFERRED');

-- CreateEnum
CREATE TYPE "DischargeDisposition" AS ENUM ('HOME', 'HOME_WITH_SERVICES', 'TRANSFER_HOSPITAL', 'TRANSFER_FACILITY', 'HOSPICE', 'DECEASED', 'AGAINST_MEDICAL_ADVICE', 'OTHER');

-- CreateEnum
CREATE TYPE "DischargeStatus" AS ENUM ('PLANNING', 'IN_PROGRESS', 'READY', 'PENDING_APPROVAL', 'APPROVED', 'DISCHARGED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DischargeChecklistCategory" AS ENUM ('MEDICAL_STABILITY', 'FEEDING_NUTRITION', 'FAMILY_EDUCATION', 'FOLLOW_UP', 'EQUIPMENT_DME', 'MEDICATIONS', 'CAR_SEAT_SAFETY', 'HEARING_SCREENING', 'IMMUNIZATIONS', 'DOCUMENTATION', 'SOCIAL_SERVICES', 'OTHER');

-- CreateEnum
CREATE TYPE "DischargeChecklistStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'NOT_APPLICABLE', 'DEFERRED');

-- CreateEnum
CREATE TYPE "Shift" AS ENUM ('DAY', 'EVENING', 'NIGHT');

-- CreateEnum
CREATE TYPE "HandoffStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'ACKNOWLEDGED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "PatientAcuity" AS ENUM ('STABLE', 'MODERATE', 'CRITICAL', 'UNSTABLE');

-- CreateEnum
CREATE TYPE "MilestoneType" AS ENUM ('FIRST_BREATH', 'EXTUBATION', 'OFF_OXYGEN', 'FIRST_ORAL_FEED', 'FULL_ORAL_FEEDS', 'REACHED_BIRTH_WEIGHT', 'DOUBLED_BIRTH_WEIGHT', 'FIRST_BATH', 'ROOM_AIR', 'DIRECT_BREASTFEED', 'KANGAROO_CARE', 'MOVED_TO_CRIB', 'EYES_OPEN', 'DEVELOPMENTAL', 'CUSTOM', 'OTHER');

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "initials" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "last_login" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "beds" (
    "id" SERIAL NOT NULL,
    "bed_number" TEXT NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'NICU',
    "status" TEXT NOT NULL DEFAULT 'available',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "beds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "patients" (
    "id" SERIAL NOT NULL,
    "mrn" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "date_of_birth" TIMESTAMP(3) NOT NULL,
    "gender" TEXT NOT NULL,
    "gestational_age" TEXT,
    "birth_weight" DOUBLE PRECISION,
    "current_weight" DOUBLE PRECISION,
    "day_of_life" INTEGER NOT NULL DEFAULT 1,
    "bed_id" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'normal',
    "admit_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "discharge_date" TIMESTAMP(3),
    "alarm_limits" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "patients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vitals" (
    "id" SERIAL NOT NULL,
    "patient_id" INTEGER NOT NULL,
    "heart_rate" INTEGER,
    "spo2" INTEGER,
    "resp_rate" INTEGER,
    "temperature" DOUBLE PRECISION,
    "fio2" INTEGER,
    "pi" DOUBLE PRECISION,
    "bp_systolic" INTEGER,
    "bp_diastolic" INTEGER,
    "bp_mean" INTEGER,
    "source" TEXT NOT NULL DEFAULT 'monitor',
    "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "confidence" DOUBLE PRECISION,
    "source_metadata" TEXT,

    CONSTRAINT "vitals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cameras" (
    "id" SERIAL NOT NULL,
    "camera_id" TEXT NOT NULL,
    "patient_id" INTEGER,
    "bed_id" INTEGER,
    "location" TEXT,
    "rtsp_url" TEXT NOT NULL,
    "model" TEXT NOT NULL DEFAULT 'Pi Zero 2W',
    "manufacturer" TEXT NOT NULL DEFAULT 'Raspberry Pi Foundation',
    "status" TEXT NOT NULL DEFAULT 'active',
    "last_ping_at" TIMESTAMP(3),
    "last_inference_at" TIMESTAMP(3),
    "avg_confidence" DOUBLE PRECISION DEFAULT 0.0,
    "total_inferences" INTEGER NOT NULL DEFAULT 0,
    "failed_inferences" INTEGER NOT NULL DEFAULT 0,
    "success_rate" DOUBLE PRECISION,
    "firmware_version" TEXT,
    "ip_address" TEXT,
    "last_calibration" TIMESTAMP(3),
    "next_calibration" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cameras_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ocr_logs" (
    "id" SERIAL NOT NULL,
    "camera_id" TEXT NOT NULL,
    "patient_id" INTEGER,
    "confidence" DOUBLE PRECISION NOT NULL,
    "inference_time_ms" INTEGER NOT NULL,
    "validation_passed" BOOLEAN NOT NULL,
    "raw_data" TEXT NOT NULL,
    "error" TEXT,
    "error_type" TEXT,
    "screen_detected" BOOLEAN NOT NULL DEFAULT true,
    "screen_confidence" DOUBLE PRECISION,
    "model_version" TEXT NOT NULL DEFAULT 'yolov5n',
    "ocr_engine" TEXT NOT NULL DEFAULT 'mock',
    "processed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ocr_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alarms" (
    "id" SERIAL NOT NULL,
    "patient_id" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "parameter" TEXT NOT NULL,
    "value" DOUBLE PRECISION,
    "threshold" DOUBLE PRECISION,
    "message" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "triggered_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),
    "silenced_until" TIMESTAMP(3),

    CONSTRAINT "alarms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alarm_acknowledgments" (
    "id" SERIAL NOT NULL,
    "alarm_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alarm_acknowledgments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notes" (
    "id" SERIAL NOT NULL,
    "patient_id" INTEGER NOT NULL,
    "author_id" INTEGER NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'progress',
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER,
    "action" TEXT NOT NULL,
    "resource" TEXT,
    "resource_id" INTEGER,
    "details" TEXT,
    "ip_address" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "devices" (
    "id" SERIAL NOT NULL,
    "serial_number" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "manufacturer" TEXT,
    "model" TEXT,
    "bed_id" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'active',
    "last_ping_at" TIMESTAMP(3),
    "firmware_version" TEXT,
    "config" TEXT,
    "last_calibration" TIMESTAMP(3),
    "next_calibration" TIMESTAMP(3),
    "last_maintenance" TIMESTAMP(3),
    "next_maintenance" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "device_logs" (
    "id" SERIAL NOT NULL,
    "device_id" INTEGER NOT NULL,
    "level" TEXT NOT NULL DEFAULT 'info',
    "category" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "details" TEXT,
    "user_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "device_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "alarm_limit_presets" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "description" TEXT,
    "limits" TEXT NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "alarm_limit_presets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "growth_measurements" (
    "id" SERIAL NOT NULL,
    "patient_id" INTEGER NOT NULL,
    "weight" DOUBLE PRECISION,
    "length" DOUBLE PRECISION,
    "head_circ" DOUBLE PRECISION,
    "abdominal_circ" DOUBLE PRECISION,
    "chest_circ" DOUBLE PRECISION,
    "weight_change" DOUBLE PRECISION,
    "weight_change_percent" DOUBLE PRECISION,
    "weight_percentile" DOUBLE PRECISION,
    "length_percentile" DOUBLE PRECISION,
    "head_circ_percentile" DOUBLE PRECISION,
    "weight_z_score" DOUBLE PRECISION,
    "length_z_score" DOUBLE PRECISION,
    "head_circ_z_score" DOUBLE PRECISION,
    "velocity_grams" DOUBLE PRECISION,
    "corrected_age" TEXT,
    "measurement_type" TEXT NOT NULL DEFAULT 'routine',
    "measured_by" TEXT,
    "verified_by" TEXT,
    "notes" TEXT,
    "measured_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "growth_measurements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feeding_logs" (
    "id" SERIAL NOT NULL,
    "patient_id" INTEGER NOT NULL,
    "feeding_type" "FeedingType" NOT NULL,
    "route" "FeedingRoute" NOT NULL,
    "volume_ordered" DOUBLE PRECISION,
    "volume_given" DOUBLE PRECISION,
    "volume_residual" DOUBLE PRECISION,
    "residual_color" TEXT,
    "residual_disposition" TEXT,
    "tpn_rate" DOUBLE PRECISION,
    "tpn_volume" DOUBLE PRECISION,
    "lipid_rate" DOUBLE PRECISION,
    "lipid_volume" DOUBLE PRECISION,
    "dextrose_concentration" DOUBLE PRECISION,
    "amino_acid_concentration" DOUBLE PRECISION,
    "tolerance" "FeedingTolerance",
    "emesis" BOOLEAN NOT NULL DEFAULT false,
    "emesis_amount" DOUBLE PRECISION,
    "emesis_character" TEXT,
    "abdominal_distension" BOOLEAN NOT NULL DEFAULT false,
    "stool_passed" BOOLEAN NOT NULL DEFAULT false,
    "fortified" BOOLEAN NOT NULL DEFAULT false,
    "fortifier_amount" DOUBLE PRECISION,
    "calories" DOUBLE PRECISION,
    "protein" DOUBLE PRECISION,
    "breast_milk_source" TEXT,
    "breast_milk_batch_id" TEXT,
    "expressed" BOOLEAN,
    "feeding_duration" INTEGER,
    "scheduled_time" TIMESTAMP(3),
    "actual_time" TIMESTAMP(3),
    "notes" TEXT,
    "recorded_by" TEXT,
    "verified_by" TEXT,
    "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "feeding_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "flowsheet_entries" (
    "id" SERIAL NOT NULL,
    "patient_id" INTEGER NOT NULL,
    "shift_date" TIMESTAMP(3) NOT NULL,
    "hour" INTEGER NOT NULL,
    "iv_fluids" DOUBLE PRECISION,
    "tpn" DOUBLE PRECISION,
    "lipids" DOUBLE PRECISION,
    "blood_products" DOUBLE PRECISION,
    "medications" DOUBLE PRECISION,
    "enteral" DOUBLE PRECISION,
    "oral" DOUBLE PRECISION,
    "urine" DOUBLE PRECISION,
    "stool" DOUBLE PRECISION,
    "emesis" DOUBLE PRECISION,
    "gastric_output" DOUBLE PRECISION,
    "ostomy_output" DOUBLE PRECISION,
    "drain_output" DOUBLE PRECISION,
    "blood_loss" DOUBLE PRECISION,
    "insensible_loss" DOUBLE PRECISION,
    "total_intake" DOUBLE PRECISION,
    "total_output" DOUBLE PRECISION,
    "net_balance" DOUBLE PRECISION,
    "stool_count" INTEGER,
    "stool_type" TEXT,
    "stool_color" TEXT,
    "guaiac_test" TEXT,
    "urine_count" INTEGER,
    "urine_color" TEXT,
    "specific_gravity" DOUBLE PRECISION,
    "temperature" DOUBLE PRECISION,
    "heart_rate" INTEGER,
    "respiratory_rate" INTEGER,
    "blood_pressure_systolic" INTEGER,
    "blood_pressure_diastolic" INTEGER,
    "spo2" INTEGER,
    "fio2" INTEGER,
    "ventilator_mode" TEXT,
    "peep" DOUBLE PRECISION,
    "pip" DOUBLE PRECISION,
    "rate" INTEGER,
    "pain_score" INTEGER,
    "sedation_score" INTEGER,
    "turned_repositioned" BOOLEAN NOT NULL DEFAULT false,
    "skin_assessment" TEXT,
    "notes" TEXT,
    "recorded_by" TEXT,
    "verified_by" TEXT,
    "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "flowsheet_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "family_contacts" (
    "id" SERIAL NOT NULL,
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
    "verified_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "family_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "family_messages" (
    "id" SERIAL NOT NULL,
    "family_contact_id" INTEGER NOT NULL,
    "sender_id" INTEGER,
    "subject" TEXT,
    "content" TEXT NOT NULL,
    "message_type" TEXT NOT NULL DEFAULT 'general',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "sent_at" TIMESTAMP(3),
    "delivered_at" TIMESTAMP(3),
    "read_at" TIMESTAMP(3),
    "channel" TEXT NOT NULL DEFAULT 'app',
    "is_inbound" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "family_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "education_materials" (
    "id" SERIAL NOT NULL,
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
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "education_materials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "education_progress" (
    "id" SERIAL NOT NULL,
    "family_contact_id" INTEGER NOT NULL,
    "material_id" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'not_started',
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "time_spent_seconds" INTEGER NOT NULL DEFAULT 0,
    "quiz_score" DOUBLE PRECISION,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "education_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'info',
    "category" TEXT NOT NULL DEFAULT 'system',
    "priority" TEXT NOT NULL DEFAULT 'normal',
    "resource_type" TEXT,
    "resource_id" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'unread',
    "read_at" TIMESTAMP(3),
    "dismissed_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" SERIAL NOT NULL,
    "patient_id" INTEGER NOT NULL,
    "ordering_id" INTEGER NOT NULL,
    "category" "OrderCategory" NOT NULL,
    "order_type" "OrderType" NOT NULL,
    "priority" "OrderPriority" NOT NULL DEFAULT 'ROUTINE',
    "order_set_id" INTEGER,
    "name" TEXT NOT NULL,
    "details" TEXT,
    "instructions" TEXT,
    "indication" TEXT,
    "medication" TEXT,
    "dose" TEXT,
    "route" TEXT,
    "frequency" TEXT,
    "specimen_type" TEXT,
    "study_type" TEXT,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
    "start_time" TIMESTAMP(3),
    "end_time" TIMESTAMP(3),
    "scheduled_time" TIMESTAMP(3),
    "verified_at" TIMESTAMP(3),
    "verified_by_id" INTEGER,
    "completed_at" TIMESTAMP(3),
    "completed_by_id" INTEGER,
    "discontinued_at" TIMESTAMP(3),
    "discontinued_by_id" INTEGER,
    "discontinue_reason" TEXT,
    "critical_alert" TEXT,
    "requires_approval" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_results" (
    "id" SERIAL NOT NULL,
    "order_id" INTEGER NOT NULL,
    "result_type" TEXT NOT NULL,
    "value" TEXT,
    "unit" TEXT,
    "reference_range" TEXT,
    "interpretation" TEXT,
    "test_name" TEXT,
    "specimen" TEXT,
    "findings" TEXT,
    "impression" TEXT,
    "resulted_at" TIMESTAMP(3),
    "resulted_by" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "reviewed_by_id" INTEGER,
    "is_critical" BOOLEAN NOT NULL DEFAULT false,
    "is_abnormal" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "order_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_sets" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL,
    "items" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "order_sets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "care_plans" (
    "id" SERIAL NOT NULL,
    "patient_id" INTEGER NOT NULL,
    "created_by_id" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "category" "CarePlanCategory" NOT NULL,
    "description" TEXT,
    "goals" TEXT,
    "priority" "CarePlanPriority" NOT NULL DEFAULT 'MEDIUM',
    "protocol_id" TEXT,
    "protocol_name" TEXT,
    "current_phase" INTEGER NOT NULL DEFAULT 1,
    "total_phases" INTEGER NOT NULL DEFAULT 1,
    "status" "CarePlanStatus" NOT NULL DEFAULT 'ACTIVE',
    "start_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "target_date" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "review_date" TIMESTAMP(3),
    "progress_percent" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "care_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "care_plan_items" (
    "id" SERIAL NOT NULL,
    "care_plan_id" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "item_type" "CarePlanItemType" NOT NULL DEFAULT 'TASK',
    "frequency" TEXT,
    "due_date" TIMESTAMP(3),
    "order_index" INTEGER NOT NULL DEFAULT 0,
    "assigned_to_id" INTEGER,
    "status" "CarePlanItemStatus" NOT NULL DEFAULT 'PENDING',
    "completed_at" TIMESTAMP(3),
    "completed_by_id" INTEGER,
    "notes" TEXT,
    "outcome" TEXT,
    "evidence" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "care_plan_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "discharge_plans" (
    "id" SERIAL NOT NULL,
    "patient_id" INTEGER NOT NULL,
    "created_by_id" INTEGER NOT NULL,
    "estimated_date" TIMESTAMP(3),
    "actual_date" TIMESTAMP(3),
    "disposition" "DischargeDisposition",
    "primary_caregiver" TEXT,
    "caregiver_phone" TEXT,
    "caregiver_email" TEXT,
    "home_environment" TEXT,
    "transportation_plan" TEXT,
    "equipment_needs" TEXT,
    "status" "DischargeStatus" NOT NULL DEFAULT 'PLANNING',
    "readiness_score" INTEGER,
    "physiologic_stable" BOOLEAN NOT NULL DEFAULT false,
    "feeding_competent" BOOLEAN NOT NULL DEFAULT false,
    "family_educated" BOOLEAN NOT NULL DEFAULT false,
    "follow_up_arranged" BOOLEAN NOT NULL DEFAULT false,
    "car_seat_tested" BOOLEAN NOT NULL DEFAULT false,
    "hearing_screened" BOOLEAN NOT NULL DEFAULT false,
    "special_instructions" TEXT,
    "follow_up_plan" TEXT,
    "medications_prescribed" TEXT,
    "discharge_instructions" TEXT,
    "approved_by_id" INTEGER,
    "approved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "discharge_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "discharge_checklist_items" (
    "id" SERIAL NOT NULL,
    "discharge_plan_id" INTEGER NOT NULL,
    "category" "DischargeChecklistCategory" NOT NULL,
    "description" TEXT NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "order_index" INTEGER NOT NULL DEFAULT 0,
    "aap_standard" TEXT,
    "aap_criterion" TEXT,
    "status" "DischargeChecklistStatus" NOT NULL DEFAULT 'PENDING',
    "completed_at" TIMESTAMP(3),
    "completed_by_id" INTEGER,
    "completed_by" TEXT,
    "notes" TEXT,
    "verified_at" TIMESTAMP(3),
    "verified_by_id" INTEGER,
    "due_date" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "discharge_checklist_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "handoff_notes" (
    "id" SERIAL NOT NULL,
    "patient_id" INTEGER NOT NULL,
    "author_id" INTEGER NOT NULL,
    "shift" "Shift" NOT NULL,
    "shift_date" TIMESTAMP(3) NOT NULL,
    "situation" TEXT,
    "background" TEXT,
    "assessment" TEXT,
    "recommendation" TEXT,
    "acuity" "PatientAcuity",
    "key_events" TEXT,
    "pending_tasks" TEXT,
    "alerts_flags" TEXT,
    "code_status" TEXT,
    "isolation" TEXT,
    "allergies" TEXT,
    "status" "HandoffStatus" NOT NULL DEFAULT 'DRAFT',
    "acknowledged_at" TIMESTAMP(3),
    "acknowledged_by_id" INTEGER,
    "acknowledged_notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "handoff_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "milestones" (
    "id" SERIAL NOT NULL,
    "patient_id" INTEGER NOT NULL,
    "created_by_id" INTEGER NOT NULL,
    "event" TEXT NOT NULL,
    "milestone_type" "MilestoneType" NOT NULL DEFAULT 'CUSTOM',
    "date" TIMESTAMP(3) NOT NULL,
    "day_of_life" INTEGER,
    "corrected_age" TEXT,
    "shared" BOOLEAN NOT NULL DEFAULT false,
    "shared_at" TIMESTAMP(3),
    "shared_by_id" INTEGER,
    "notes" TEXT,
    "photo_attached" BOOLEAN NOT NULL DEFAULT false,
    "photo_path" TEXT,
    "is_significant" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "milestones_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE INDEX "users_active_idx" ON "users"("active");

-- CreateIndex
CREATE UNIQUE INDEX "beds_bed_number_key" ON "beds"("bed_number");

-- CreateIndex
CREATE UNIQUE INDEX "patients_mrn_key" ON "patients"("mrn");

-- CreateIndex
CREATE UNIQUE INDEX "patients_bed_id_key" ON "patients"("bed_id");

-- CreateIndex
CREATE INDEX "patients_status_idx" ON "patients"("status");

-- CreateIndex
CREATE INDEX "patients_status_discharge_date_idx" ON "patients"("status", "discharge_date");

-- CreateIndex
CREATE INDEX "patients_admit_date_idx" ON "patients"("admit_date");

-- CreateIndex
CREATE INDEX "patients_name_idx" ON "patients"("name");

-- CreateIndex
CREATE INDEX "vitals_patient_id_recorded_at_idx" ON "vitals"("patient_id", "recorded_at");

-- CreateIndex
CREATE INDEX "vitals_source_confidence_idx" ON "vitals"("source", "confidence");

-- CreateIndex
CREATE UNIQUE INDEX "cameras_camera_id_key" ON "cameras"("camera_id");

-- CreateIndex
CREATE INDEX "cameras_camera_id_idx" ON "cameras"("camera_id");

-- CreateIndex
CREATE INDEX "cameras_patient_id_idx" ON "cameras"("patient_id");

-- CreateIndex
CREATE INDEX "cameras_bed_id_idx" ON "cameras"("bed_id");

-- CreateIndex
CREATE INDEX "cameras_status_idx" ON "cameras"("status");

-- CreateIndex
CREATE INDEX "ocr_logs_camera_id_processed_at_idx" ON "ocr_logs"("camera_id", "processed_at");

-- CreateIndex
CREATE INDEX "ocr_logs_patient_id_processed_at_idx" ON "ocr_logs"("patient_id", "processed_at");

-- CreateIndex
CREATE INDEX "ocr_logs_validation_passed_idx" ON "ocr_logs"("validation_passed");

-- CreateIndex
CREATE INDEX "ocr_logs_confidence_idx" ON "ocr_logs"("confidence");

-- CreateIndex
CREATE INDEX "alarms_patient_id_status_idx" ON "alarms"("patient_id", "status");

-- CreateIndex
CREATE INDEX "alarms_triggered_at_idx" ON "alarms"("triggered_at");

-- CreateIndex
CREATE INDEX "alarms_type_status_idx" ON "alarms"("type", "status");

-- CreateIndex
CREATE INDEX "alarms_status_triggered_at_idx" ON "alarms"("status", "triggered_at");

-- CreateIndex
CREATE INDEX "alarm_acknowledgments_alarm_id_idx" ON "alarm_acknowledgments"("alarm_id");

-- CreateIndex
CREATE INDEX "alarm_acknowledgments_user_id_created_at_idx" ON "alarm_acknowledgments"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "notes_patient_id_created_at_idx" ON "notes"("patient_id", "created_at");

-- CreateIndex
CREATE INDEX "notes_patient_id_type_created_at_idx" ON "notes"("patient_id", "type", "created_at");

-- CreateIndex
CREATE INDEX "notes_author_id_created_at_idx" ON "notes"("author_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_user_id_created_at_idx" ON "audit_logs"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_action_created_at_idx" ON "audit_logs"("action", "created_at");

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
CREATE INDEX "growth_measurements_patient_id_measurement_type_idx" ON "growth_measurements"("patient_id", "measurement_type");

-- CreateIndex
CREATE INDEX "feeding_logs_patient_id_recorded_at_idx" ON "feeding_logs"("patient_id", "recorded_at");

-- CreateIndex
CREATE INDEX "feeding_logs_patient_id_feeding_type_idx" ON "feeding_logs"("patient_id", "feeding_type");

-- CreateIndex
CREATE INDEX "feeding_logs_recorded_at_idx" ON "feeding_logs"("recorded_at");

-- CreateIndex
CREATE INDEX "flowsheet_entries_patient_id_shift_date_idx" ON "flowsheet_entries"("patient_id", "shift_date");

-- CreateIndex
CREATE INDEX "flowsheet_entries_shift_date_idx" ON "flowsheet_entries"("shift_date");

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
CREATE INDEX "orders_status_scheduled_time_idx" ON "orders"("status", "scheduled_time");

-- CreateIndex
CREATE INDEX "orders_created_at_idx" ON "orders"("created_at");

-- CreateIndex
CREATE INDEX "order_results_order_id_idx" ON "order_results"("order_id");

-- CreateIndex
CREATE INDEX "order_results_resulted_at_idx" ON "order_results"("resulted_at");

-- CreateIndex
CREATE INDEX "order_results_is_critical_reviewed_at_idx" ON "order_results"("is_critical", "reviewed_at");

-- CreateIndex
CREATE INDEX "care_plans_patient_id_status_idx" ON "care_plans"("patient_id", "status");

-- CreateIndex
CREATE INDEX "care_plans_category_idx" ON "care_plans"("category");

-- CreateIndex
CREATE INDEX "care_plans_created_by_id_created_at_idx" ON "care_plans"("created_by_id", "created_at");

-- CreateIndex
CREATE INDEX "care_plans_priority_status_idx" ON "care_plans"("priority", "status");

-- CreateIndex
CREATE INDEX "care_plans_review_date_idx" ON "care_plans"("review_date");

-- CreateIndex
CREATE INDEX "care_plan_items_care_plan_id_status_idx" ON "care_plan_items"("care_plan_id", "status");

-- CreateIndex
CREATE INDEX "care_plan_items_due_date_status_idx" ON "care_plan_items"("due_date", "status");

-- CreateIndex
CREATE INDEX "care_plan_items_assigned_to_id_status_idx" ON "care_plan_items"("assigned_to_id", "status");

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
CREATE INDEX "discharge_checklist_items_required_status_idx" ON "discharge_checklist_items"("required", "status");

-- CreateIndex
CREATE INDEX "discharge_checklist_items_due_date_idx" ON "discharge_checklist_items"("due_date");

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
CREATE INDEX "handoff_notes_acuity_status_idx" ON "handoff_notes"("acuity", "status");

-- CreateIndex
CREATE INDEX "milestones_patient_id_date_idx" ON "milestones"("patient_id", "date");

-- CreateIndex
CREATE INDEX "milestones_patient_id_shared_idx" ON "milestones"("patient_id", "shared");

-- CreateIndex
CREATE INDEX "milestones_milestone_type_idx" ON "milestones"("milestone_type");

-- CreateIndex
CREATE INDEX "milestones_is_significant_date_idx" ON "milestones"("is_significant", "date");

-- AddForeignKey
ALTER TABLE "patients" ADD CONSTRAINT "patients_bed_id_fkey" FOREIGN KEY ("bed_id") REFERENCES "beds"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vitals" ADD CONSTRAINT "vitals_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ocr_logs" ADD CONSTRAINT "ocr_logs_camera_id_fkey" FOREIGN KEY ("camera_id") REFERENCES "cameras"("camera_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alarms" ADD CONSTRAINT "alarms_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alarm_acknowledgments" ADD CONSTRAINT "alarm_acknowledgments_alarm_id_fkey" FOREIGN KEY ("alarm_id") REFERENCES "alarms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alarm_acknowledgments" ADD CONSTRAINT "alarm_acknowledgments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notes" ADD CONSTRAINT "notes_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notes" ADD CONSTRAINT "notes_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "devices" ADD CONSTRAINT "devices_bed_id_fkey" FOREIGN KEY ("bed_id") REFERENCES "beds"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "device_logs" ADD CONSTRAINT "device_logs_device_id_fkey" FOREIGN KEY ("device_id") REFERENCES "devices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "growth_measurements" ADD CONSTRAINT "growth_measurements_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feeding_logs" ADD CONSTRAINT "feeding_logs_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "flowsheet_entries" ADD CONSTRAINT "flowsheet_entries_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "family_contacts" ADD CONSTRAINT "family_contacts_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "family_messages" ADD CONSTRAINT "family_messages_family_contact_id_fkey" FOREIGN KEY ("family_contact_id") REFERENCES "family_contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "family_messages" ADD CONSTRAINT "family_messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "education_progress" ADD CONSTRAINT "education_progress_family_contact_id_fkey" FOREIGN KEY ("family_contact_id") REFERENCES "family_contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "education_progress" ADD CONSTRAINT "education_progress_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "education_materials"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_ordering_id_fkey" FOREIGN KEY ("ordering_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_order_set_id_fkey" FOREIGN KEY ("order_set_id") REFERENCES "order_sets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_discontinued_by_id_fkey" FOREIGN KEY ("discontinued_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_results" ADD CONSTRAINT "order_results_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "care_plans" ADD CONSTRAINT "care_plans_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "care_plans" ADD CONSTRAINT "care_plans_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "care_plan_items" ADD CONSTRAINT "care_plan_items_care_plan_id_fkey" FOREIGN KEY ("care_plan_id") REFERENCES "care_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discharge_plans" ADD CONSTRAINT "discharge_plans_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discharge_plans" ADD CONSTRAINT "discharge_plans_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "discharge_checklist_items" ADD CONSTRAINT "discharge_checklist_items_discharge_plan_id_fkey" FOREIGN KEY ("discharge_plan_id") REFERENCES "discharge_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "handoff_notes" ADD CONSTRAINT "handoff_notes_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "handoff_notes" ADD CONSTRAINT "handoff_notes_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "handoff_notes" ADD CONSTRAINT "handoff_notes_acknowledged_by_id_fkey" FOREIGN KEY ("acknowledged_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "milestones" ADD CONSTRAINT "milestones_patient_id_fkey" FOREIGN KEY ("patient_id") REFERENCES "patients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "milestones" ADD CONSTRAINT "milestones_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
