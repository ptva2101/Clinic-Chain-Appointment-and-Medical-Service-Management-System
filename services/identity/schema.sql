CREATE TABLE IF NOT EXISTS accounts (
    id CHAR(36) PRIMARY KEY,
    role VARCHAR(16) NOT NULL,
    username VARCHAR(128) NOT NULL,
    subject_id VARCHAR(128) NULL,
    password_hash VARCHAR(255) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    registration_pending BOOLEAN NOT NULL DEFAULT FALSE,
    token_version INT NOT NULL DEFAULT 0,
    failed_attempts INT NOT NULL DEFAULT 0,
    locked_until DATETIME(6) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    updated_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
    UNIQUE KEY uq_accounts_role_username (role, username),
    KEY ix_accounts_subject (role, subject_id)
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
    token_hash CHAR(64) PRIMARY KEY,
    account_id CHAR(36) NOT NULL,
    expires_at DATETIME(6) NOT NULL,
    revoked_at DATETIME(6) NULL,
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    CONSTRAINT fk_refresh_account FOREIGN KEY (account_id) REFERENCES accounts(id),
    KEY ix_refresh_account (account_id)
);
