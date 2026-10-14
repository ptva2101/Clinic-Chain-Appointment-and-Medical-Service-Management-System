"""Read-only comparison of tracked legacy SQLite DB and bootstrap seed."""

import sqlite3

from demo_import.import_history import ROOT, TABLE_SERVICE, backend_rows


def main() -> None:
    seed_rows, _ = backend_rows()
    path = ROOT / "Backend" / "hospital.db"
    if not path.exists():
        print("No tracked Backend/hospital.db")
        return
    connection = sqlite3.connect(f"file:{path.as_posix()}?mode=ro", uri=True)
    connection.row_factory = sqlite3.Row
    try:
        names = {row[0] for row in connection.execute(
            "SELECT name FROM sqlite_master WHERE type='table'"
        )}
        for table in TABLE_SERVICE:
            if table not in names:
                print(f"{table}: absent in hospital.db")
                continue
            current = [dict(row) for row in connection.execute(f'SELECT * FROM "{table}"')]
            seed = seed_rows[table]
            seed_keys = {str(row[next(iter(row))]) for row in seed}
            current_keys = {str(row[next(iter(row))]) for row in current}
            print(f"{table}: db={len(current)} seed={len(seed)} "
                  f"extra_keys={len(current_keys - seed_keys)} "
                  f"missing_keys={len(seed_keys - current_keys)}")
            if table == "LICH_TRUC":
                print("LICH_TRUC db columns:", ", ".join(current[0]) if current else "none")
    finally:
        connection.close()


if __name__ == "__main__":
    main()
