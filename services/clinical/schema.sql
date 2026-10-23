CREATE TABLE IF NOT EXISTS encounters (
    id CHAR(36) NOT NULL PRIMARY KEY,
    appointment_id CHAR(36) NOT NULL,
    patient_id VARCHAR(128) NOT NULL,
    doctor_code VARCHAR(128) NOT NULL,
    branch_code VARCHAR(32) NOT NULL,
    visit_date DATE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'draft',
    disease_code VARCHAR(40) NULL,
    symptoms TEXT NOT NULL,
    advice TEXT NULL,
    lab_service_codes JSON NOT NULL,
    prescriptions JSON NOT NULL,
    treatments JSON NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    UNIQUE KEY uq_encounter_appointment (appointment_id),
    KEY ix_encounter_patient (patient_id, visit_date),
    KEY ix_encounter_doctor (doctor_code, visit_date),
    CONSTRAINT ck_encounter_status CHECK (status IN ('draft', 'completed'))
);

CREATE TABLE IF NOT EXISTS treatment_plans (
    id CHAR(36) NOT NULL PRIMARY KEY,
    encounter_id CHAR(36) NOT NULL,
    patient_id VARCHAR(128) NOT NULL,
    doctor_code VARCHAR(128) NOT NULL,
    service_code VARCHAR(40) NOT NULL,
    total_sessions SMALLINT UNSIGNED NOT NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    UNIQUE KEY uq_plan_encounter_service (encounter_id, service_code),
    KEY ix_plan_patient (patient_id, created_at),
    CONSTRAINT fk_plan_encounter FOREIGN KEY (encounter_id) REFERENCES encounters(id)
);

CREATE TABLE IF NOT EXISTS treatment_sessions (
    id CHAR(36) NOT NULL PRIMARY KEY,
    plan_id CHAR(36) NOT NULL,
    session_number SMALLINT UNSIGNED NOT NULL,
    patient_request_key VARCHAR(128) COLLATE utf8mb4_bin NOT NULL,
    config_code VARCHAR(96) NULL,
    doctor_code VARCHAR(128) NOT NULL,
    duty_date DATE NULL,
    shift TINYINT UNSIGNED NULL,
    appointment_id CHAR(36) NULL,
    invoice_id CHAR(36) NULL,
    status VARCHAR(24) NOT NULL DEFAULT 'pending',
    source VARCHAR(32) NOT NULL DEFAULT 'live',
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    UNIQUE KEY uq_session_number (plan_id, session_number),
    UNIQUE KEY uq_plan_request (plan_id, patient_request_key),
    UNIQUE KEY uq_treatment_appointment (appointment_id),
    CONSTRAINT fk_session_plan FOREIGN KEY (plan_id) REFERENCES treatment_plans(id),
    CONSTRAINT ck_session_status CHECK (status IN ('pending', 'booked', 'completed', 'historical_unbooked'))
);

CREATE TABLE IF NOT EXISTS disease_catalog (
    code VARCHAR(40) NOT NULL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS medicine_catalog (
    code VARCHAR(40) NOT NULL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    unit VARCHAR(80) NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE
);
