CREATE TABLE IF NOT EXISTS appointments (
    id CHAR(36) NOT NULL PRIMARY KEY,
    hold_id CHAR(36) NULL,
    patient_account_id CHAR(36) NULL,
    patient_id VARCHAR(128) NOT NULL,
    config_code VARCHAR(96) NOT NULL,
    branch_code VARCHAR(32) NOT NULL,
    service_code VARCHAR(40) NOT NULL,
    doctor_code VARCHAR(128) NOT NULL,
    duty_date DATE NOT NULL,
    shift TINYINT UNSIGNED NOT NULL,
    status VARCHAR(24) NOT NULL DEFAULT 'pending',
    source VARCHAR(24) NOT NULL DEFAULT 'live',
    legacy_status VARCHAR(80) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    UNIQUE KEY uq_appointment_hold (hold_id),
    KEY ix_appointment_patient (patient_id, duty_date),
    KEY ix_appointment_doctor (doctor_code, duty_date, shift),
    KEY ix_appointment_date_status (duty_date, status),
    CONSTRAINT ck_appointment_status CHECK (
        status IN ('pending', 'confirmed', 'cancel_pending', 'cancelled', 'failed', 'historical')
    )
);
