import asyncio
from datetime import datetime, timedelta, timezone

import aiomysql
import pytest
from fastapi.testclient import TestClient

from identity.api import get_registry_client, get_repository
from identity.import_legacy import import_accounts
from identity.main import app
from identity.registry_client import RegistryConflict, RegistryUnavailable
from identity.security import hash_password


class MemoryIdentityRepository:
    def __init__(self):
        self.accounts = {
            "admin-1": {
                "id": "admin-1", "role": "admin", "username": "admin", "subject_id": None,
                "password_hash": hash_password("CorrectHorse123!"), "is_active": True,
                "token_version": 0, "failed_attempts": 0, "locked_until": None,
                "registration_pending": False,
            }
        }
        self.refresh = {}

    async def find_by_login(self, role, username):
        return next((a for a in self.accounts.values() if a["role"] == role and a["username"] == username), None)

    async def find_by_id(self, account_id):
        return self.accounts.get(account_id)

    async def create_account(self, account_id, role, username, subject_id, password_hash):
        if any(a["role"] == role and a["username"] == username for a in self.accounts.values()):
            raise aiomysql.IntegrityError(1062, "Duplicate account")
        account = {"id": account_id, "role": role, "username": username,
                   "subject_id": subject_id, "password_hash": password_hash, "is_active": True,
                   "token_version": 0, "failed_attempts": 0, "locked_until": None,
                   "registration_pending": False}
        self.accounts[account_id] = account
        return account

    async def create_pending_patient(self, account_id, cccd, password_hash):
        account = await self.create_account(account_id, "patient", cccd, None, password_hash)
        account["is_active"] = False
        account["registration_pending"] = True
        return account

    async def create_pending_staff(self, account_id, role, username, staff_code, password_hash):
        account = await self.create_account(account_id, role, username, staff_code, password_hash)
        account["is_active"] = False
        account["registration_pending"] = True
        return account

    async def activate_staff_profile(self, account_id, role, staff_code):
        account = self.accounts[account_id]
        if account["role"] != role or account["subject_id"] != staff_code:
            return None
        if account["registration_pending"] and not account["is_active"]:
            account["is_active"] = True
            account["registration_pending"] = False
        return account if account["is_active"] and not account["registration_pending"] else None

    async def link_patient_profile(self, account_id, profile_id):
        account = self.accounts[account_id]
        if not account["registration_pending"] and not account["is_active"]:
            return None
        if account["subject_id"] not in (None, profile_id):
            return None
        account["subject_id"] = profile_id
        account["is_active"] = True
        account["registration_pending"] = False
        return account

    async def disable_account(self, account_id):
        if account_id not in self.accounts:
            return False
        self.accounts[account_id]["is_active"] = False
        self.accounts[account_id]["token_version"] += 1
        for refresh in self.refresh.values():
            if refresh["account_id"] == account_id:
                refresh["revoked"] = True
        return True

    async def enable_account(self, account_id):
        if account_id not in self.accounts:
            return False
        self.accounts[account_id]["is_active"] = True
        self.accounts[account_id]["failed_attempts"] = 0
        self.accounts[account_id]["locked_until"] = None
        return True

    async def list_accounts(self, limit, offset, role):
        return [a for a in self.accounts.values() if role is None or a["role"] == role][offset:offset + limit]

    async def record_login_failure(self, account_id):
        account = self.accounts[account_id]
        account["failed_attempts"] += 1
        if account["failed_attempts"] >= 5:
            account["locked_until"] = datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(minutes=15)

    async def clear_login_failures(self, account_id):
        self.accounts[account_id]["failed_attempts"] = 0
        self.accounts[account_id]["locked_until"] = None

    async def set_password(self, account_id, password_hash):
        if account_id not in self.accounts:
            return False
        self.accounts[account_id]["password_hash"] = password_hash
        self.accounts[account_id]["token_version"] += 1
        self.accounts[account_id]["failed_attempts"] = 0
        self.accounts[account_id]["locked_until"] = None
        for refresh in self.refresh.values():
            if refresh["account_id"] == account_id:
                refresh["revoked"] = True
        return True

    async def revoke_all(self, account_id):
        self.accounts[account_id]["token_version"] += 1
        for refresh in self.refresh.values():
            if refresh["account_id"] == account_id:
                refresh["revoked"] = True

    async def save_refresh(self, digest, account_id, expires_at):
        self.refresh[digest] = {"account_id": account_id, "expires_at": expires_at, "revoked": False}

    async def rotate_refresh(self, old_digest, new_digest, expires_at):
        old = self.refresh.get(old_digest)
        if not old or old["revoked"] or old["expires_at"] <= datetime.now(timezone.utc).replace(tzinfo=None):
            return None
        account = self.accounts[old["account_id"]]
        if not account["is_active"]:
            return None
        old["revoked"] = True
        self.refresh[new_digest] = {"account_id": account["id"], "expires_at": expires_at, "revoked": False}
        return account

    async def revoke_refresh(self, digest):
        if digest in self.refresh:
            self.refresh[digest]["revoked"] = True


class MemoryRegistryClient:
    def __init__(self):
        self.profiles = {}
        self.staff_profiles = {}
        self.unavailable = False

    async def ensure_patient(self, account_id, cccd):
        if self.unavailable:
            raise RegistryUnavailable("Registry service is unavailable")
        self.profiles.setdefault(account_id, cccd)
        assert self.profiles[account_id] == cccd
        return account_id

    async def ensure_staff(self, account_id, details):
        if self.unavailable:
            raise RegistryUnavailable("Registry service is unavailable")
        if any(profile["staff_code"] == details["staff_code"] and key != account_id
               for key, profile in self.staff_profiles.items()):
            raise RegistryConflict("Staff code is linked to another account")
        existing = self.staff_profiles.get(account_id)
        if existing and (existing["staff_code"] != details["staff_code"] or existing["role"] != details["role"]):
            raise RegistryConflict("Staff code is linked to another account")
        self.staff_profiles.setdefault(account_id, details)
        return details["staff_code"]


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setenv("IDENTITY_JWT_SECRET", "testing_secret_with_more_than_thirty_two_characters")
    repository = MemoryIdentityRepository()
    registry = MemoryRegistryClient()
    app.dependency_overrides[get_repository] = lambda: repository
    app.dependency_overrides[get_registry_client] = lambda: registry
    try:
        with TestClient(app) as test_client:
            yield test_client
    finally:
        app.dependency_overrides.clear()


def login(client, role="admin", username="admin", password="CorrectHorse123!"):
    return client.post("/api/v1/identity/login", json={"role": role, "username": username, "password": password})


def test_login_refresh_rotation_logout_and_me(client):
    assert login(client, password="wrong").status_code == 401
    response = login(client)
    assert response.status_code == 200
    assert response.headers["cache-control"] == "no-store"
    tokens = response.json()
    assert tokens["expires_in"] == 900
    assert "password_hash" not in str(tokens)
    auth = {"Authorization": f"Bearer {tokens['access_token']}"}
    me = client.get("/api/v1/identity/me", headers=auth)
    assert me.status_code == 200
    assert me.json()["role"] == "admin"
    assert "password_hash" not in me.json()
    refreshed = client.post("/api/v1/identity/refresh", json={"refresh_token": tokens["refresh_token"]})
    assert refreshed.status_code == 200
    assert refreshed.json()["refresh_token"] != tokens["refresh_token"]
    assert client.post("/api/v1/identity/refresh", json={"refresh_token": tokens["refresh_token"]}).status_code == 401
    assert client.post("/api/v1/identity/logout", json={"refresh_token": refreshed.json()["refresh_token"]}).status_code == 204
    assert client.post("/api/v1/identity/refresh", json={"refresh_token": refreshed.json()["refresh_token"]}).status_code == 401
    assert client.get("/api/v1/identity/me").status_code == 401


def test_admin_provision_and_disable_account(client):
    admin_token = login(client).json()["access_token"]
    headers = {"Authorization": f"Bearer {admin_token}"}
    created = client.post("/api/v1/identity/accounts", headers=headers, json={
        "role": "patient", "username": "patient01", "password": "PatientPass123!", "subject_id": "patient-123"
    })
    assert created.status_code == 201
    account = created.json()
    assert account["subject_id"] == "patient-123"
    assert "password_hash" not in account
    patient_token = login(client, "patient", "patient01", "PatientPass123!").json()
    patient_headers = {"Authorization": f"Bearer {patient_token['access_token']}"}
    assert client.post("/api/v1/identity/accounts", headers=patient_headers, json={
        "role": "doctor", "username": "doctor01", "password": "DoctorPass123!"
    }).status_code == 403
    assert client.patch(f"/api/v1/identity/accounts/{account['id']}/disable", headers=headers).status_code == 204
    assert client.get("/api/v1/identity/me", headers=patient_headers).status_code == 401
    assert login(client, "patient", "patient01", "PatientPass123!").status_code == 401
    assert client.post("/api/v1/identity/refresh", json={"refresh_token": patient_token["refresh_token"]}).status_code == 401
    assert client.patch("/api/v1/identity/accounts/admin-1/disable", headers=headers).status_code == 409


def test_admin_provisions_staff_with_registry_before_login(client):
    admin_token = login(client).json()["access_token"]
    headers = {"Authorization": f"Bearer {admin_token}"}
    body = {
        "role": "doctor", "username": "BS900", "subject_id": "BS900",
        "full_name": "Bác sĩ Nguyễn An", "password": "DoctorPassword123!",
        "phone": "0912345678", "specialty": "Nội khoa",
    }
    registry = app.dependency_overrides[get_registry_client]()
    registry.unavailable = True
    assert client.post("/api/v1/identity/accounts", headers=headers, json=body).status_code == 503
    repository = app.dependency_overrides[get_repository]()
    pending = next(a for a in repository.accounts.values() if a["username"] == "BS900")
    assert pending["registration_pending"] and not pending["is_active"]
    listed = client.get("/api/v1/identity/accounts?role=doctor", headers=headers)
    assert listed.status_code == 200
    assert listed.json()[0]["registration_pending"] is True
    assert login(client, "doctor", "BS900", body["password"]).status_code == 401
    assert client.patch(f"/api/v1/identity/accounts/{pending['id']}/enable", headers=headers).status_code == 409
    registry.unavailable = False
    created = client.post("/api/v1/identity/accounts", headers=headers, json=body)
    assert created.status_code == 201
    assert created.json()["is_active"] is True
    assert created.json()["registration_pending"] is False
    assert registry.staff_profiles[pending["id"]]["full_name"] == body["full_name"]
    assert login(client, "doctor", "BS900", body["password"]).status_code == 200
    assert client.post("/api/v1/identity/accounts", headers=headers, json=body).status_code == 409


def test_staff_code_conflict_leaves_new_account_disabled(client):
    headers = {"Authorization": f"Bearer {login(client).json()['access_token']}"}
    first = {"role": "letan", "username": "LT901", "subject_id": "LT901",
             "full_name": "Lễ tân A", "password": "ReceptionPass123!"}
    second = {**first, "username": "LT902"}
    assert client.post("/api/v1/identity/accounts", headers=headers, json=first).status_code == 201
    assert client.post("/api/v1/identity/accounts", headers=headers, json=second).status_code == 409
    assert login(client, "letan", second["username"], second["password"]).status_code == 401


def test_existing_active_staff_gets_minimal_registry_profile_on_login(client):
    repository = app.dependency_overrides[get_repository]()
    account = asyncio.run(repository.create_account(
        "doctor-old", "doctor", "BS001", "BS001", hash_password("DoctorPassword123!")
    ))
    registry = app.dependency_overrides[get_registry_client]()
    registry.unavailable = True
    assert login(client, "doctor", "BS001", "DoctorPassword123!").status_code == 503
    assert account["id"] not in registry.staff_profiles
    registry.unavailable = False
    assert login(client, "doctor", "BS001", "DoctorPassword123!").status_code == 200
    assert registry.staff_profiles[account["id"]]["full_name"] == "BS001"
    account["is_active"] = False
    registry.staff_profiles.clear()
    assert login(client, "doctor", "BS001", "DoctorPassword123!").status_code == 401
    assert not registry.staff_profiles


def test_openapi_exposes_identity_contract(client):
    schema = client.get("/openapi.json").json()
    for path in ("/api/v1/identity/register", "/api/v1/identity/login", "/api/v1/identity/refresh", "/api/v1/identity/logout",
                 "/api/v1/identity/me", "/api/v1/identity/accounts", "/api/v1/identity/change-password",
                 "/api/v1/identity/logout-all", "/api/v1/identity/accounts/{account_id}/reset-password"):
        assert path in schema["paths"]


def test_patient_can_register_then_login_without_creating_staff_account(client):
    route = "/api/v1/identity/register"
    invalid = client.post(route, json={"username": "not-a-cccd", "password": "StrongPassword123!"})
    assert invalid.status_code == 422
    too_short = client.post(route, json={"username": "001095012345", "password": "short"})
    assert too_short.status_code == 422
    elevated = client.post(route, json={
        "username": "001095012345", "password": "StrongPassword123!", "role": "admin"
    })
    assert elevated.status_code == 422
    created = client.post(route, json={"username": "001095012345", "password": "StrongPassword123!"})
    assert created.status_code == 201
    assert created.json()["role"] == "patient"
    assert created.json()["subject_id"] == created.json()["id"]
    assert app.dependency_overrides[get_registry_client]().profiles[created.json()["id"]] == "001095012345"
    assert "password_hash" not in created.text
    assert client.post(route, json={"username": "001095012345", "password": "StrongPassword123!"}).status_code == 409
    assert login(client, "patient", "001095012345", "StrongPassword123!").status_code == 200
    assert login(client, "admin", "001095012345", "StrongPassword123!").status_code == 401


def test_registration_retries_after_registry_outage(client):
    registry = app.dependency_overrides[get_registry_client]()
    repository = app.dependency_overrides[get_repository]()
    registry.unavailable = True
    body = {"username": "001095011111", "password": "StrongPassword123!"}
    assert client.post("/api/v1/identity/register", json=body).status_code == 503
    pending = next(a for a in repository.accounts.values() if a["username"] == body["username"])
    assert pending["registration_pending"] is True
    assert pending["is_active"] is False
    assert login(client, "patient", body["username"], "wrong").status_code == 401
    assert client.post("/api/v1/identity/register", json={**body, "password": "DifferentPass123!"}).status_code == 409
    registry.unavailable = False
    response = client.post("/api/v1/identity/register", json=body)
    assert response.status_code == 201
    assert response.json()["subject_id"] == pending["id"]
    assert login(client, "patient", body["username"], body["password"]).status_code == 200
    assert len(registry.profiles) == 1


def test_existing_unlinked_patient_is_linked_after_valid_login(client):
    repository = app.dependency_overrides[get_repository]()
    patient = asyncio.run(repository.create_account(
        "patient-old", "patient", "001095022222", None, hash_password("StrongPassword123!")
    ))
    assert patient["subject_id"] is None
    assert login(client, "patient", patient["username"], "wrong").status_code == 401
    assert login(client, "patient", patient["username"], "StrongPassword123!").status_code == 200
    assert patient["subject_id"] == patient["id"]
    assert app.dependency_overrides[get_registry_client]().profiles[patient["id"]] == patient["username"]


def test_disabled_patient_is_not_reactivated_by_login(client):
    repository = app.dependency_overrides[get_repository]()
    patient = asyncio.run(repository.create_account(
        "patient-disabled", "patient", "001095033333", None, hash_password("StrongPassword123!")
    ))
    patient["is_active"] = False
    assert login(client, "patient", patient["username"], "StrongPassword123!").status_code == 401
    assert patient["subject_id"] is None


def test_change_password_invalidates_existing_tokens(client):
    tokens = login(client).json()
    auth = {"Authorization": f"Bearer {tokens['access_token']}"}
    assert client.post("/api/v1/identity/change-password", headers=auth, json={
        "old_password": "wrong", "new_password": "DifferentPass123!"
    }).status_code == 400
    assert client.post("/api/v1/identity/change-password", headers=auth, json={
        "old_password": "CorrectHorse123!", "new_password": "DifferentPass123!"
    }).status_code == 204
    assert client.get("/api/v1/identity/me", headers=auth).status_code == 401
    assert client.post("/api/v1/identity/refresh", json={"refresh_token": tokens["refresh_token"]}).status_code == 401
    assert login(client).status_code == 401
    assert login(client, password="DifferentPass123!").status_code == 200


def test_lockout_and_admin_reset(client):
    repository = app.dependency_overrides[get_repository]()
    repository.accounts["admin-2"] = {
        "id": "admin-2", "role": "admin", "username": "backup-admin", "subject_id": None,
        "password_hash": hash_password("BackupAdmin123!"), "is_active": True,
        "token_version": 0, "failed_attempts": 0, "locked_until": None,
        "registration_pending": False,
    }
    for _ in range(5):
        assert login(client, password="wrong").status_code == 401
    assert login(client).status_code == 401
    backup = login(client, username="backup-admin", password="BackupAdmin123!").json()
    reset = client.post("/api/v1/identity/accounts/admin-1/reset-password",
                        headers={"Authorization": f"Bearer {backup['access_token']}"},
                        json={"new_password": "ResetPassword123!"})
    assert reset.status_code == 204
    assert login(client, password="ResetPassword123!").status_code == 200


def test_logout_all_enable_and_admin_account_listing(client):
    admin = login(client).json()
    auth = {"Authorization": f"Bearer {admin['access_token']}"}
    accounts = client.get("/api/v1/identity/accounts?role=admin", headers=auth)
    assert accounts.status_code == 200
    assert len(accounts.json()) == 1
    assert "password_hash" not in accounts.text
    assert client.post("/api/v1/identity/logout-all", headers=auth).status_code == 204
    assert client.get("/api/v1/identity/me", headers=auth).status_code == 401
    assert client.post("/api/v1/identity/refresh", json={"refresh_token": admin["refresh_token"]}).status_code == 401
    fresh = login(client).json()["access_token"]
    fresh_auth = {"Authorization": f"Bearer {fresh}"}
    assert client.patch("/api/v1/identity/accounts/no-such-id/enable", headers=fresh_auth).status_code == 404


def test_cors_allows_only_local_frontend(client):
    allowed = client.options("/api/v1/identity/login", headers={
        "Origin": "http://localhost:5173", "Access-Control-Request-Method": "POST"
    })
    assert allowed.status_code == 200
    assert allowed.headers["access-control-allow-origin"] == "http://localhost:5173"
    denied = client.options("/api/v1/identity/login", headers={
        "Origin": "https://untrusted.example", "Access-Control-Request-Method": "POST"
    })
    assert denied.status_code == 400


def test_legacy_import_is_dry_run_first_and_idempotent():
    repository = MemoryIdentityRepository()
    rows = [
        {"role": "patient", "username": "012345678901", "subject_id": "BN001", "password": "legacy123"},
        {"role": "doctor", "username": "BS001", "subject_id": "BS001", "password": "doctor123"},
        {"role": "patient", "username": "", "subject_id": "BN002", "password": "legacy123"},
    ]
    preview = asyncio.run(import_accounts(rows, repository, apply=False))
    assert preview == {"total": 3, "ready": 2, "created": 0, "existing": 0, "conflicts": 0, "invalid": 1}
    assert len(repository.accounts) == 1
    applied = asyncio.run(import_accounts(rows, repository, apply=True))
    assert applied["created"] == 2
    assert len(repository.accounts) == 3
    again = asyncio.run(import_accounts(rows, repository, apply=True))
    assert again["created"] == 0
    assert again["existing"] == 2
