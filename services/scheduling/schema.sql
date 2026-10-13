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
