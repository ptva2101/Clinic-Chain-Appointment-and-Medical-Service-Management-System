"""Opt-in local migration: activate imported staff with a shared development password.

This is deliberately separate from import_history.py. It does not reset existing
passwords or enable accounts disabled by an administrator. The two-service write
is resumable: Identity is created pending, Registry is linked, then Identity is
activated. No runtime service reads the other service's database.
"""

import argparse
import sys
from collections import Counter
from pathlib import Path
from uuid import uuid4

import pymysql

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from demo_import.import_history import connection_settings
from identity.security import hash_password


DEFAULT_PASSWORD = "123456"
STAFF_ROLES = ("doctor", "letan", "xnv")


def choose_action(profile: dict, accounts: list[dict]) -> str:
    """Never take over another account or overwrite a previously set password."""
    if len(accounts) > 1:
        return "conflict"
    if not accounts:
        return "create" if profile["identity_account_id"] is None else "conflict"
    account = accounts[0]
    code = profile["staff_code"]
    if (account["role"] != profile["role"] or account["username"] != code
            or account["subject_id"] != code
            or profile["identity_account_id"] not in (None, account["id"])):
        return "conflict"
    if not account["is_active"] and not account["registration_pending"]:
        return "disabled"
    if profile["identity_account_id"] is None or account["registration_pending"]:
        return "repair"
    return "existing"


def connect(service: str):
    settings = connection_settings(service)
    settings["database"] = settings.pop("db")
    return pymysql.connect(
        **settings, cursorclass=pymysql.cursors.DictCursor,
    )


def activate_staff(*, apply: bool, password: str = DEFAULT_PASSWORD) -> Counter:
    if len(password) < 6 or len(password) > 256:
        raise ValueError("The development password must contain 6–256 characters")
    identity_settings = connection_settings("identity")
    registry_settings = connection_settings("registry")
    if apply and any(settings["host"] not in ("127.0.0.1", "localhost")
                     for settings in (identity_settings, registry_settings)):
        raise RuntimeError("Staff activation is allowed only on a local MySQL host")

    identity = connect("identity")
    registry = connect("registry")
    counts = Counter()
    try:
        with registry.cursor() as cursor:
            cursor.execute(
                "SELECT staff_code, role, identity_account_id, source "
                "FROM staff_profiles WHERE source = 'legacy_demo' ORDER BY staff_code"
            )
            profiles = cursor.fetchall()
        registry.rollback()
        for profile in profiles:
            code = profile["staff_code"]
            if profile["role"] not in STAFF_ROLES:
                counts["conflict"] += 1
                print(f"Skipped {code}: invalid role")
                continue
            with identity.cursor() as cursor:
                cursor.execute(
                    "SELECT id, role, username, subject_id, is_active, registration_pending "
                    "FROM accounts WHERE role = %s AND (username = %s OR subject_id = %s)",
                    (profile["role"], code, code),
                )
                accounts = cursor.fetchall()
            identity.rollback()
            action = choose_action(profile, accounts)
            if action in ("conflict", "disabled", "existing") or not apply:
                counts[action] += 1
                if action == "conflict":
                    print(f"Skipped {code}: account/profile conflict")
                continue

            account_id = accounts[0]["id"] if accounts else str(uuid4())
            if action == "create":
                with identity.cursor() as cursor:
                    cursor.execute(
                        "INSERT INTO accounts "
                        "(id, role, username, subject_id, password_hash, is_active, registration_pending) "
                        "VALUES (%s, %s, %s, %s, %s, FALSE, TRUE)",
                        (account_id, profile["role"], code, code, hash_password(password)),
                    )
                identity.commit()

            if profile["identity_account_id"] is None:
                with registry.cursor() as cursor:
                    cursor.execute(
                        "UPDATE staff_profiles SET identity_account_id = %s "
                        "WHERE staff_code = %s AND role = %s AND source = 'legacy_demo' "
                        "AND identity_account_id IS NULL",
                        (account_id, code, profile["role"]),
                    )
                    if cursor.rowcount != 1:
                        registry.rollback()
                        counts["conflict"] += 1
                        print(f"Skipped {code}: Registry profile changed during activation")
                        continue
                registry.commit()

            if not accounts or accounts[0]["registration_pending"]:
                with identity.cursor() as cursor:
                    cursor.execute(
                        "UPDATE accounts SET is_active = TRUE, registration_pending = FALSE "
                        "WHERE id = %s AND role = %s AND subject_id = %s "
                        "AND is_active = FALSE AND registration_pending = TRUE",
                        (account_id, profile["role"], code),
                    )
                    if cursor.rowcount != 1:
                        identity.rollback()
                        counts["conflict"] += 1
                        print(f"Skipped {code}: account state changed during activation")
                        continue
                identity.commit()
            counts["created" if action == "create" else "repaired"] += 1
        return counts
    except Exception:
        identity.rollback()
        registry.rollback()
        raise
    finally:
        identity.close()
        registry.close()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true", help="Activate staff in local MySQL")
    args = parser.parse_args()
    counts = activate_staff(apply=args.apply)
    print("Staff activation " + ("applied" if args.apply else "preview") + ": "
          + ", ".join(f"{name}={counts[name]}" for name in
                      ("create", "created", "repair", "repaired", "existing", "disabled", "conflict")))


if __name__ == "__main__":
    main()
