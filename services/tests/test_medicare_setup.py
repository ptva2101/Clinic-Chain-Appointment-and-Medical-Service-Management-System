import asyncio
from collections import Counter, defaultdict
from datetime import date

import pytest

from demo_setup import medicare_schedules, seed_fixture


def test_thirty_day_rotation_covers_both_branches_without_double_booking():
    rows = medicare_schedules(date(2026, 11, 11), 30)
    assert len(rows) == 1920
    assert min(r['NgayTruc'] for r in rows) == '2026-11-11'
    assert max(r['NgayTruc'] for r in rows) == '2026-12-10'
    assert Counter(r['MaChiNhanh'] for r in rows) == {'CN01': 960, 'CN02': 960}
    assert len({(r['MaBacSi'], r['NgayTruc'], r['CaTruc']) for r in rows}) == len(rows)
    assert set(Counter((r['MaChiNhanh'], r['NgayTruc'], r['CaTruc']) for r in rows).values()) == {8}
    counts = Counter(r['MaBacSi'] for r in rows)
    assert set(counts) == {f'LEGACY_BS{i:03}' for i in range(1, 34)}
    assert Counter(counts.values()) == {60: 28, 48: 5}


def test_rotation_matches_original_november_first_day_example():
    rows = medicare_schedules(date(2026, 11, 11), 1)
    group = {'LEGACY_BS001', 'LEGACY_BS002', 'LEGACY_BS017', 'LEGACY_BS025'}
    assignments = {(r['CaTruc'], r['MaChiNhanh']): r['MaBacSi'] for r in rows if r['MaBacSi'] in group}
    assert [assignments[(shift, 'CN01')] for shift in range(1, 5)] == ['LEGACY_BS001', 'LEGACY_BS002', 'LEGACY_BS017', 'LEGACY_BS025']
    assert [assignments[(shift, 'CN02')] for shift in range(1, 5)] == ['LEGACY_BS002', 'LEGACY_BS017', 'LEGACY_BS025', 'LEGACY_BS001']


def test_old_synthetic_seed_cannot_recreate_removed_catalogue_in_main(monkeypatch):
    monkeypatch.delenv('DEMO_VERIFY_ISOLATED', raising=False)
    monkeypatch.delenv('IDENTITY_JWT_SECRET', raising=False)
    with pytest.raises(RuntimeError, match='isolated E2E'):
        asyncio.run(seed_fixture(None, None))
