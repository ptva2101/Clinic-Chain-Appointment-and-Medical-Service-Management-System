-- Local development bootstrap. Each service can access only its own database.
CREATE DATABASE IF NOT EXISTS identity_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS registry_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS scheduling_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS appointment_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS billing_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS clinical_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS laboratory_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE USER IF NOT EXISTS 'identity_app'@'%' IDENTIFIED BY 'dev_only_identity';
CREATE USER IF NOT EXISTS 'registry_app'@'%' IDENTIFIED BY 'dev_only_registry';
CREATE USER IF NOT EXISTS 'scheduling_app'@'%' IDENTIFIED BY 'dev_only_scheduling';
CREATE USER IF NOT EXISTS 'appointment_app'@'%' IDENTIFIED BY 'dev_only_appointment';
CREATE USER IF NOT EXISTS 'billing_app'@'%' IDENTIFIED BY 'dev_only_billing';
CREATE USER IF NOT EXISTS 'clinical_app'@'%' IDENTIFIED BY 'dev_only_clinical';
CREATE USER IF NOT EXISTS 'laboratory_app'@'%' IDENTIFIED BY 'dev_only_laboratory';

GRANT ALL PRIVILEGES ON identity_db.* TO 'identity_app'@'%';
GRANT ALL PRIVILEGES ON registry_db.* TO 'registry_app'@'%';
GRANT ALL PRIVILEGES ON scheduling_db.* TO 'scheduling_app'@'%';
GRANT ALL PRIVILEGES ON appointment_db.* TO 'appointment_app'@'%';
GRANT ALL PRIVILEGES ON billing_db.* TO 'billing_app'@'%';
GRANT ALL PRIVILEGES ON clinical_db.* TO 'clinical_app'@'%';
GRANT ALL PRIVILEGES ON laboratory_db.* TO 'laboratory_app'@'%';
