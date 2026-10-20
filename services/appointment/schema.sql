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

CREATE TABLE IF NOT EXISTS patient_notifications (
    id CHAR(36) NOT NULL PRIMARY KEY,
    appointment_id CHAR(36) NULL,
    patient_account_id CHAR(36) NOT NULL,
    patient_id VARCHAR(128) NOT NULL,
    event VARCHAR(32) NOT NULL,
    content VARCHAR(500) NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    UNIQUE KEY uq_notification_appointment_event (appointment_id, event),
    KEY ix_notification_patient (patient_account_id, created_at),
    CONSTRAINT fk_notification_appointment FOREIGN KEY (appointment_id) REFERENCES appointments(id)
);

CREATE TABLE IF NOT EXISTS appointment_queue_counters (
    branch_code VARCHAR(32) NOT NULL,
    doctor_code VARCHAR(128) NOT NULL,
    duty_date DATE NOT NULL,
    last_number INT UNSIGNED NOT NULL DEFAULT 0,
    PRIMARY KEY (branch_code, doctor_code, duty_date)
);

CREATE TABLE IF NOT EXISTS appointment_checkins (
    appointment_id CHAR(36) NOT NULL PRIMARY KEY,
    branch_code VARCHAR(32) NOT NULL,
    doctor_code VARCHAR(128) NOT NULL,
    duty_date DATE NOT NULL,
    queue_number INT UNSIGNED NOT NULL,
    receptionist_code VARCHAR(128) NOT NULL,
    state VARCHAR(24) NOT NULL DEFAULT 'waiting',
    checked_in_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    UNIQUE KEY uq_queue_position (branch_code, doctor_code, duty_date, queue_number),
    KEY ix_queue_doctor (doctor_code, duty_date, state, queue_number),
    CONSTRAINT fk_checkin_appointment FOREIGN KEY (appointment_id) REFERENCES appointments(id),
    CONSTRAINT ck_checkin_state CHECK (state IN ('waiting', 'examining', 'conclusion', 'completed'))
);
