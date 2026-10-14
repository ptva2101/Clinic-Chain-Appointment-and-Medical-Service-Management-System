-- Counts only: verifies that a restored snapshot has the same rows as its source.
SELECT 'identity.accounts' AS entity, COUNT(*) AS row_count FROM identity_db.accounts
UNION ALL SELECT 'identity.refresh_tokens', COUNT(*) FROM identity_db.refresh_tokens
UNION ALL SELECT 'registry.patients', COUNT(*) FROM registry_db.patients
UNION ALL SELECT 'registry.staff_profiles', COUNT(*) FROM registry_db.staff_profiles
UNION ALL SELECT 'registry.branches', COUNT(*) FROM registry_db.branches
UNION ALL SELECT 'registry.medical_services', COUNT(*) FROM registry_db.medical_services
UNION ALL SELECT 'registry.historical_records', COUNT(*) FROM registry_db.historical_records
UNION ALL SELECT 'scheduling.doctor_schedules', COUNT(*) FROM scheduling_db.doctor_schedules
UNION ALL SELECT 'scheduling.slot_inventory', COUNT(*) FROM scheduling_db.slot_inventory
UNION ALL SELECT 'scheduling.slot_holds', COUNT(*) FROM scheduling_db.slot_holds
UNION ALL SELECT 'scheduling.historical_records', COUNT(*) FROM scheduling_db.historical_records
UNION ALL SELECT 'appointment.appointments', COUNT(*) FROM appointment_db.appointments
UNION ALL SELECT 'appointment.historical_records', COUNT(*) FROM appointment_db.historical_records
UNION ALL SELECT 'billing.historical_records', COUNT(*) FROM billing_db.historical_records
UNION ALL SELECT 'clinical.historical_records', COUNT(*) FROM clinical_db.historical_records
UNION ALL SELECT 'laboratory.historical_records', COUNT(*) FROM laboratory_db.historical_records;
