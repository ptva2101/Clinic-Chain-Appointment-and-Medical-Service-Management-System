import shutil
from pathlib import Path

import pytest

from demo_import.import_history import (
    backend_rows, canonical_staff_rows, extra_backend_records, frontend_records,
)


def test_legacy_seed_is_read_in_memory_and_credentials_are_redacted():
    rows, records = backend_rows()
    assert len(rows) == 17
    assert len(records) == 459
    assert len(rows["LICH_HEN"]) == 5
    assert len(rows["CHI_NHANH"]) == 2
    patient = next(payload for service, source, entity, key, payload in records
                   if entity == "benh_nhan")
    assert "[REDACTED DEMO CREDENTIAL]" in patient
    assert "password_hai95" not in patient


def test_seed_staff_can_be_imported_as_unlinked_registry_profiles():
    rows, _ = backend_rows()
    staff = canonical_staff_rows(rows)
    assert len(staff) == 27
    assert len({profile["staff_code"] for profile in staff}) == 27
    assert {profile["role"] for profile in staff} == {"doctor", "letan", "xnv"}
    assert next(profile for profile in staff if profile["staff_code"] == "BS001")["specialty"] == "Nội tổng quát"
    assert next(profile for profile in staff if profile["staff_code"] == "LT001")["branch_code"] == "CN_CG"
    assert all("MatKhau" not in profile and "password" not in profile for profile in staff)


@pytest.mark.skipif(
    not shutil.which("node") or not Path("Frontend/node_modules/@babel/parser").exists(),
    reason="Frontend parser dependency is not installed",
)
def test_deleted_frontend_fixtures_are_recovered_from_git():
    records = frontend_records()
    assert len(records) >= 300
    entities = {record[2] for record in records}
    assert "AdminDashboard.branches" in entities
    assert "AdminDashboard.staffList" in entities
    assert "PatientDashboard.bookings" in entities


def test_extra_sources_include_tracked_sqlite_and_old_schedule_sql():
    records = extra_backend_records()
    assert len(records) >= 2900
    assert sum(record[1] == "legacy_schedule_sql" for record in records) == 1728
    assert sum(record[1] == "legacy_sqlite_db" for record in records) == 459
    assert not any(record[2] == "unparsed_seed" for record in records)
