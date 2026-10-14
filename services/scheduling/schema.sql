CREATE TABLE IF NOT EXISTS doctor_schedules (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    doctor_code VARCHAR(128) NOT NULL,
    branch_code VARCHAR(32) NOT NULL,
    duty_date DATE NOT NULL,
    shift TINYINT UNSIGNED NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'active',
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    UNIQUE KEY uq_doctor_date_shift (doctor_code, duty_date, shift),
    KEY ix_schedule_date_branch (duty_date, branch_code, shift)
);

CREATE TABLE IF NOT EXISTS slot_inventory (
    config_code VARCHAR(96) NOT NULL,
    duty_date DATE NOT NULL,
    shift TINYINT UNSIGNED NOT NULL,
    used_count INT UNSIGNED NOT NULL DEFAULT 0,
    PRIMARY KEY (config_code, duty_date, shift)
);

CREATE TABLE IF NOT EXISTS slot_holds (
    id CHAR(36) NOT NULL PRIMARY KEY,
    patient_id VARCHAR(128) NOT NULL,
    request_key VARCHAR(128) COLLATE utf8mb4_bin NOT NULL,
    config_code VARCHAR(96) NOT NULL,
    branch_code VARCHAR(32) NOT NULL,
    service_code VARCHAR(40) NOT NULL,
    doctor_code VARCHAR(128) NOT NULL,
    duty_date DATE NOT NULL,
    shift TINYINT UNSIGNED NOT NULL,
    state VARCHAR(16) NOT NULL DEFAULT 'held',
    expires_at DATETIME(6) NOT NULL,
    appointment_id VARCHAR(128) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    UNIQUE KEY uq_patient_request (patient_id, request_key),
    UNIQUE KEY uq_hold_appointment (appointment_id),
    KEY ix_hold_slot_state (config_code, duty_date, shift, state, expires_at),
    KEY ix_hold_patient (patient_id, created_at),
    CONSTRAINT fk_hold_inventory FOREIGN KEY (config_code, duty_date, shift)
        REFERENCES slot_inventory(config_code, duty_date, shift),
    CONSTRAINT ck_hold_state CHECK (state IN ('held', 'confirmed', 'released', 'expired'))
);
