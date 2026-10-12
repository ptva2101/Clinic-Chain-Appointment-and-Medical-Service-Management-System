CREATE TABLE IF NOT EXISTS patients (
    id CHAR(36) PRIMARY KEY,
    identity_account_id CHAR(36) NOT NULL,
    cccd CHAR(12) NOT NULL,
    full_name VARCHAR(160) NULL,
    date_of_birth DATE NULL,
    phone VARCHAR(20) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    UNIQUE KEY uq_patients_identity (identity_account_id),
    UNIQUE KEY uq_patients_cccd (cccd)
);
