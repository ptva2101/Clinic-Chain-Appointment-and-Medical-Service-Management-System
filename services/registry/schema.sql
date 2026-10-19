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

CREATE TABLE IF NOT EXISTS staff_profiles (
    staff_code VARCHAR(128) PRIMARY KEY,
    identity_account_id CHAR(36) NULL,
    role VARCHAR(16) NOT NULL,
    full_name VARCHAR(160) NOT NULL,
    phone VARCHAR(20) NULL,
    specialty VARCHAR(160) NULL,
    branch_code VARCHAR(32) NULL,
    source VARCHAR(32) NOT NULL DEFAULT 'identity',
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    UNIQUE KEY uq_staff_identity (identity_account_id)
);

CREATE TABLE IF NOT EXISTS branches (
    code VARCHAR(32) PRIMARY KEY,
    name VARCHAR(160) NOT NULL,
    address VARCHAR(255) NOT NULL,
    phone VARCHAR(20) NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
);

CREATE TABLE IF NOT EXISTS medical_services (
    code VARCHAR(40) PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    specialty VARCHAR(160) NOT NULL,
    kind VARCHAR(40) NOT NULL,
    price BIGINT UNSIGNED NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6)
);

CREATE TABLE IF NOT EXISTS branch_services (
    code VARCHAR(96) PRIMARY KEY,
    branch_code VARCHAR(32) NOT NULL,
    service_code VARCHAR(40) NOT NULL,
    slot_limit INT UNSIGNED NOT NULL DEFAULT 0,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    UNIQUE KEY uq_branch_service (branch_code, service_code),
    CONSTRAINT fk_branch_service_branch FOREIGN KEY (branch_code) REFERENCES branches(code),
    CONSTRAINT fk_branch_service_service FOREIGN KEY (service_code) REFERENCES medical_services(code)
);
