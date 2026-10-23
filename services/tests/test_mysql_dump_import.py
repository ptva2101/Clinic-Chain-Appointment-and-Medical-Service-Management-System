import json

import pytest

from demo_import.import_mysql_dump import (
    DEFAULT_DUMP, REDACTED_TOKEN, parse_dump, prepare_records, safe_payload,
)
from demo_import.merge_mysql_dump import missing_patient_codes


def test_archive_redacts_credentials_and_payment_tokens():
    row = {"MatKhau": "123456", "PaymentToken": "PAY_EXAMPLE", "MaBenhAn": "BA001"}
    assert safe_payload(row) == {
        "MatKhau": "[REDACTED DEMO CREDENTIAL]",
        "PaymentToken": REDACTED_TOKEN,
        "MaBenhAn": "BA001",
    }
    assert row["MatKhau"] == "123456"


@pytest.mark.skipif(not DEFAULT_DUMP.exists(), reason="Private SQL dump is not shipped in Git")
def test_private_dump_is_split_completely_without_live_account_credentials():
    rows = parse_dump(DEFAULT_DUMP)
    assert len(rows) == 17
    assert sum(map(len, rows.values())) == 2186
    records = prepare_records(rows)
    assert {service: len(items) for service, items in records.items()} == {
        "appointment": 64,
        "billing": 88,
        "clinical": 107,
        "identity": 51,
        "laboratory": 13,
        "registry": 248,
        "scheduling": 1728,
    }
    for service_records in records.values():
        for _, _, _, _, payload in service_records:
            item = json.loads(payload)
            if "MatKhau" in item:
                assert item["MatKhau"] == "[REDACTED DEMO CREDENTIAL]"
            if item.get("PaymentToken") is not None:
                assert item["PaymentToken"] == REDACTED_TOKEN


@pytest.mark.skipif(not DEFAULT_DUMP.exists(), reason="Private SQL dump is not shipped in Git")
def test_legacy_merge_audit_keeps_orphan_and_original_amounts():
    rows = parse_dump(DEFAULT_DUMP)
    assert missing_patient_codes(rows) == ["BN_A77921FD"]
    assert len(rows["danh_muc_bhyt"]) == 26
    assert len(rows["lich_truc"]) == 1728
    assert len(rows["lich_hen"]) == 49
    assert len(rows["chi_tiet_xet_nghiem"]) == 13
    assert len(rows["lich_trinh_dieu_tri"]) == 16
    assert sum(not row["MaLichHen"] for row in rows["lich_trinh_dieu_tri"]) == 12
    services = {row["MaDichVu"]: row for row in rows["dich_vu"]}
    configs = {row["MaCauHinh"]: row for row in rows["chi_nhanh_dich_vu"]}
    for appointment in rows["lich_hen"]:
        service = services[configs[appointment["MaCauHinh"]]["MaDichVu"]]
        assert 0 <= appointment["GiaCuoi"] <= service["GiaGoc"]
    for charge in rows["chi_tiet_xet_nghiem"]:
        assert 0 <= charge["GiaCuoi"] <= services[charge["MaDichVu"]]["GiaGoc"]
