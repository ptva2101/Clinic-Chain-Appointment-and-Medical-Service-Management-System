from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from registry.api import get_identity_client, get_repository
from registry.identity_client import IdentityUnavailable, InvalidIdentityToken
from registry.main import app
from registry.repository import ProfileConflict


class MemoryRegistryRepository:
    def __init__(self):
        self.patients = {}
        self.staff = {}

    async def ensure_patient(self, account_id, cccd):
        for patient in self.patients.values():
            if patient["cccd"] == cccd and patient["identity_account_id"] != account_id:
                raise ProfileConflict("CCCD is linked to another account")
        existing = self.patients.get(account_id)
        if existing and existing["cccd"] != cccd:
            raise ProfileConflict("CCCD is linked to another account")
        return self.patients.setdefault(account_id, {
            "id": account_id, "identity_account_id": account_id, "cccd": cccd,
            "full_name": None, "date_of_birth": None, "phone": None,
            "insurance_card_number": None, "insurance_category_code": None,
            "insurance_verified": False,
        })

    async def create_insurance_category(self, category):
        if category["code"] == "DN":
            raise ProfileConflict("Insurance category already exists")

    async def insurance_categories(self):
        return [{"code": "DN", "name": "Worker", "coverage_bps": 8000}]

    async def patient_insurance(self, patient_id):
        patient = next((p for p in self.patients.values() if p["id"] == patient_id), None)
        if not patient:
            return None
        return {"patient_id": patient_id,
                "insurance_card_number": patient["insurance_card_number"],
                "insurance_category_code": patient["insurance_category_code"],
                "insurance_verified": patient["insurance_verified"],
                "coverage_bps": 8000 if patient["insurance_verified"] else 0}

    async def verify_patient_insurance(self, patient_id, verified):
        patient = next((p for p in self.patients.values() if p["id"] == patient_id), None)
        if patient is None:
            return None
        if verified and not patient["insurance_card_number"]:
            raise ProfileConflict("Patient has no insurance card and category")
        patient["insurance_verified"] = verified
        return patient

    async def get_patient(self, account_id, profile_id):
        patient = self.patients.get(account_id)
        return patient if patient and patient["id"] == profile_id else None

    async def list_patients(self, query, limit, offset):
        patients = list(reversed(self.patients.values()))
        if query:
            keyword = query.lower()
            patients = [patient for patient in patients if any(
                keyword in str(patient[field] or "").lower()
                for field in ("cccd", "full_name", "phone")
            )]
        return patients[offset:offset + limit], len(patients)

    async def update_patient(self, account_id, profile_id, changes):
        patient = await self.get_patient(account_id, profile_id)
        if patient:
            if changes.get("insurance_category_code") not in (None, "DN"):
                raise ProfileConflict("Unknown insurance category")
            patient.update(changes)
            if "insurance_card_number" in changes:
                patient["insurance_verified"] = False
        return patient

    async def ensure_staff(self, account_id, details):
        if any(profile["staff_code"] == details["staff_code"] and key != account_id
               for key, profile in self.staff.items()):
            raise ProfileConflict("Staff code is linked to another account")
        profile = self.staff.get(account_id)
        if profile and (profile["staff_code"] != details["staff_code"] or profile["role"] != details["role"]):
            raise ProfileConflict("Staff code is linked to another account")
        return self.staff.setdefault(account_id, {"identity_account_id": account_id, **details})

    async def get_staff(self, account_id, staff_code):
        profile = self.staff.get(account_id)
        return profile if profile and profile["staff_code"] == staff_code else None

    async def get_staff_by_code(self, staff_code):
        return next((profile for profile in self.staff.values()
                     if profile["staff_code"] == staff_code), None)

    async def list_staff(self, query, limit, offset):
        profiles = list(reversed(self.staff.values()))
        if query:
            keyword = query.lower()
            profiles = [profile for profile in profiles if any(
                keyword in str(profile[field] or "").lower()
                for field in ("staff_code", "full_name", "phone")
            )]
        return profiles[offset:offset + limit], len(profiles)


class MemoryIdentityClient:
    def __init__(self):
        self.accounts = {}
        self.unavailable = False

    async def current_account(self, token):
        if self.unavailable:
            raise IdentityUnavailable("Identity service is unavailable")
        if token not in self.accounts:
            raise InvalidIdentityToken("Invalid access token")
        return self.accounts[token]


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setenv("REGISTRY_INTERNAL_TOKEN", "test_internal_credential")
    repository = MemoryRegistryRepository()
    identity = MemoryIdentityClient()
    app.dependency_overrides[get_repository] = lambda: repository
    app.dependency_overrides[get_identity_client] = lambda: identity
    try:
        with TestClient(app) as test_client:
            test_client.identity = identity
            test_client.repository = repository
            yield test_client
    finally:
        app.dependency_overrides.clear()


def test_internal_patient_create_is_authenticated_and_idempotent(client):
    account_id = str(uuid4())
    url = f"/api/v1/registry/internal/patients/{account_id}"
    body = {"cccd": "001095012345"}
    assert client.put(url, json=body).status_code == 401
    assert client.put(url, json=body, headers={"X-Service-Token": "wrong"}).status_code == 401
    headers = {"X-Service-Token": "test_internal_credential"}
    first = client.put(url, json=body, headers=headers)
    assert first.status_code == 200
    assert first.json()["id"] == account_id
    assert first.json()["identity_account_id"] == account_id
    assert client.put(url, json=body, headers=headers).json() == first.json()
    assert client.put(url, json={"cccd": "001095099999"}, headers=headers).status_code == 409
    other = f"/api/v1/registry/internal/patients/{uuid4()}"
    assert client.put(other, json=body, headers=headers).status_code == 409


def test_patient_insurance_contract(client):
    patient_id = str(uuid4())
    internal = {"X-Service-Token": "test_internal_credential"}
    assert client.put(f"/api/v1/registry/internal/patients/{patient_id}",
                      headers=internal, json={"cccd": "001095012345"}).status_code == 200
    client.identity.accounts["patient-token"] = {
        "id": patient_id, "role": "patient", "subject_id": patient_id, "is_active": True,
    }
    path = "/api/v1/registry/patients/me"
    auth = {"Authorization": "Bearer patient-token"}
    assert client.patch(path, headers=auth,
                        json={"insurance_card_number": "DN123456"}).status_code == 422
    assert client.patch(path, headers=auth,
                        json={"insurance_card_number": "DN123456",
                              "insurance_category_code": "XX"}).status_code == 409
    updated = client.patch(path, headers=auth,
                           json={"insurance_card_number": "DN123456",
                                 "insurance_category_code": "DN"})
    assert updated.status_code == 200
    assert updated.json()["insurance_category_code"] == "DN"
    internal_path = f"/api/v1/registry/internal/patients/{patient_id}/insurance"
    assert client.get(internal_path).status_code == 401
    assert client.get(internal_path, headers=internal).json()["coverage_bps"] == 0
    assert client.get("/api/v1/registry/insurance/categories").json()[0]["code"] == "DN"
    client.identity.accounts["admin-token"] = {
        "id": str(uuid4()), "role": "admin", "subject_id": None, "is_active": True,
    }
    admin = {"Authorization": "Bearer admin-token"}
    assert client.patch(f"/api/v1/registry/patients/{patient_id}/insurance-verification",
                        headers=auth, json={"verified": True}).status_code == 403
    verified = client.patch(f"/api/v1/registry/patients/{patient_id}/insurance-verification",
                            headers=admin, json={"verified": True})
    assert verified.status_code == 200
    assert client.get(internal_path, headers=internal).json()["coverage_bps"] == 8000


def test_registry_rejects_invalid_patient_identifiers(client):
    headers = {"X-Service-Token": "test_internal_credential"}
    assert client.put("/api/v1/registry/internal/patients/not-a-uuid",
                      json={"cccd": "001095012345"}, headers=headers).status_code == 422
    assert client.put(f"/api/v1/registry/internal/patients/{uuid4()}",
                      json={"cccd": "invalid"}, headers=headers).status_code == 422
    assert "/api/v1/registry/internal/patients/{account_id}" in client.get("/openapi.json").json()["paths"]


def test_patient_can_read_and_update_only_own_profile(client):
    account_id = str(uuid4())
    other_id = str(uuid4())
    internal = {"X-Service-Token": "test_internal_credential"}
    for profile_id, cccd in ((account_id, "001095012345"), (other_id, "001095054321")):
        assert client.put(f"/api/v1/registry/internal/patients/{profile_id}",
                          headers=internal, json={"cccd": cccd}).status_code == 200
    client.identity.accounts["patient-token"] = {
        "id": account_id, "role": "patient", "subject_id": account_id, "is_active": True,
    }
    headers = {"Authorization": "Bearer patient-token"}
    route = "/api/v1/registry/patients/me"
    profile = client.get(route, headers=headers)
    assert profile.status_code == 200
    assert profile.headers["Cache-Control"] == "no-store"
    assert profile.json()["cccd"] == "001095012345"
    updated = client.patch(route, headers=headers, json={
        "full_name": "  Nguyễn   Văn An  ", "date_of_birth": "1995-04-12", "phone": "0912345678",
    })
    assert updated.status_code == 200
    assert updated.json()["full_name"] == "Nguyễn Văn An"
    assert updated.json()["date_of_birth"] == "1995-04-12"
    assert client.get(route, headers=headers).json()["phone"] == "0912345678"
    assert client.patch(route, headers=headers, json={"phone": None}).json()["phone"] is None
    assert client.get(f"/api/v1/registry/patients/{other_id}", headers=headers).status_code == 404


def test_patient_profile_rejects_unauthorized_and_invalid_updates(client):
    route = "/api/v1/registry/patients/me"
    assert client.get(route).status_code == 401
    assert client.get(route, headers={"Authorization": "Bearer unknown"}).status_code == 401
    client.identity.accounts["doctor-token"] = {
        "id": str(uuid4()), "role": "doctor", "subject_id": "BS001", "is_active": True,
    }
    assert client.get(route, headers={"Authorization": "Bearer doctor-token"}).status_code == 403
    account_id = str(uuid4())
    client.identity.accounts["patient-token"] = {
        "id": account_id, "role": "patient", "subject_id": account_id, "is_active": True,
    }
    headers = {"Authorization": "Bearer patient-token"}
    assert client.get(route, headers=headers).status_code == 404
    assert client.patch(route, headers=headers, json={}).status_code == 422
    assert client.patch(route, headers=headers, json={"cccd": "001095012345"}).status_code == 422
    assert client.patch(route, headers=headers, json={"full_name": "  "}).status_code == 422
    assert client.patch(route, headers=headers, json={"date_of_birth": "2999-01-01"}).status_code == 422
    assert client.patch(route, headers=headers, json={"phone": "abc"}).status_code == 422
    client.identity.unavailable = True
    assert client.get(route, headers=headers).status_code == 503


def test_patient_directory_is_admin_only_searchable_and_paginated(client):
    route = "/api/v1/registry/patients"
    internal = {"X-Service-Token": "test_internal_credential"}
    ids = [str(uuid4()) for _ in range(3)]
    for index, account_id in enumerate(ids):
        response = client.put(f"{route.replace('/patients', '/internal/patients')}/{account_id}",
                              headers=internal, json={"cccd": f"00109501234{index}"})
        assert response.status_code == 200
    client.identity.accounts["patient-token"] = {
        "id": ids[0], "role": "patient", "subject_id": ids[0], "is_active": True,
    }
    client.identity.accounts["admin-token"] = {
        "id": str(uuid4()), "role": "admin", "subject_id": None, "is_active": True,
    }
    client.identity.accounts["inactive-admin"] = {
        "id": str(uuid4()), "role": "admin", "subject_id": None, "is_active": False,
    }
    assert client.patch(f"{route}/me", headers={"Authorization": "Bearer patient-token"},
                        json={"full_name": "Nguyễn Văn An", "phone": "0912345678"}).status_code == 200
    assert client.get(route).status_code == 401
    assert client.get(route, headers={"Authorization": "Bearer invalid"}).status_code == 401
    assert client.get(route, headers={"Authorization": "Bearer patient-token"}).status_code == 403
    assert client.get(route, headers={"Authorization": "Bearer inactive-admin"}).status_code == 401
    admin = {"Authorization": "Bearer admin-token"}
    response = client.get(route, headers=admin, params={"limit": 2})
    assert response.status_code == 200
    assert response.headers["Cache-Control"] == "no-store"
    assert response.json()["total"] == 3
    assert len(response.json()["items"]) == 2
    second_page = client.get(route, headers=admin, params={"limit": 2, "offset": 2}).json()
    assert len(second_page["items"]) == 1
    assert len({item["id"] for item in response.json()["items"] + second_page["items"]}) == 3
    searched = client.get(route, headers=admin, params={"q": "012341"}).json()
    assert searched["total"] == 1
    assert searched["items"][0]["cccd"] == "001095012341"
    assert client.get(route, headers=admin, params={"q": "Nguyễn"}).json()["total"] == 1
    assert client.get(route, headers=admin, params={"q": "091234"}).json()["total"] == 1
    assert client.get(route, headers=admin, params={"limit": 101}).status_code == 422
    assert client.get(route, headers=admin, params={"offset": -1}).status_code == 422


def test_staff_profile_is_idempotent_and_available_only_to_its_owner(client):
    account_id = str(uuid4())
    route = f"/api/v1/registry/internal/staff/{account_id}"
    body = {
        "staff_code": "BS900", "role": "doctor", "full_name": "Bác sĩ Nguyễn An",
        "phone": "0912345678", "specialty": "Nội khoa", "branch_code": "CN_CG",
    }
    assert client.put(route, json=body).status_code == 401
    internal = {"X-Service-Token": "test_internal_credential"}
    first = client.put(route, headers=internal, json=body)
    assert first.status_code == 200
    assert first.json()["identity_account_id"] == account_id
    assert client.put(route, headers=internal, json=body).json() == first.json()
    assert client.put(route, headers=internal, json={**body, "role": "xnv"}).status_code == 409
    assert client.put(f"/api/v1/registry/internal/staff/{uuid4()}",
                      headers=internal, json=body).status_code == 409
    assert client.put(route, headers=internal, json={**body, "full_name": "  "}).status_code == 422
    client.identity.accounts["doctor-token"] = {
        "id": account_id, "role": "doctor", "subject_id": "BS900", "is_active": True,
    }
    me = "/api/v1/registry/staff/me"
    assert client.get(me).status_code == 401
    response = client.get(me, headers={"Authorization": "Bearer doctor-token"})
    assert response.status_code == 200
    assert response.headers["Cache-Control"] == "no-store"
    assert response.json()["full_name"] == body["full_name"]
    client.identity.accounts["doctor-token"]["subject_id"] = "BS901"
    assert client.get(me, headers={"Authorization": "Bearer doctor-token"}).status_code == 404
    client.identity.accounts["doctor-token"]["role"] = "patient"
    assert client.get(me, headers={"Authorization": "Bearer doctor-token"}).status_code == 403


def test_staff_directory_requires_admin_and_reads_registry_profiles(client):
    staff_id = str(uuid4())
    body = {
        "staff_code": "BS900", "role": "doctor", "full_name": "Bác sĩ Nguyễn An",
        "phone": "0912345678", "specialty": "Nội khoa", "branch_code": None,
    }
    assert client.put(f"/api/v1/registry/internal/staff/{staff_id}",
                      headers={"X-Service-Token": "test_internal_credential"}, json=body).status_code == 200
    route = "/api/v1/registry/staff"
    client.identity.accounts["doctor-token"] = {
        "id": staff_id, "role": "doctor", "subject_id": "BS900", "is_active": True,
    }
    client.identity.accounts["admin-token"] = {
        "id": str(uuid4()), "role": "admin", "subject_id": None, "is_active": True,
    }
    assert client.get(route).status_code == 401
    assert client.get(route, headers={"Authorization": "Bearer doctor-token"}).status_code == 403
    response = client.get(route, headers={"Authorization": "Bearer admin-token"}, params={"q": "Nguyễn"})
    assert response.status_code == 200
    assert response.headers["Cache-Control"] == "no-store"
    assert response.json()["total"] == 1
    assert response.json()["items"][0]["staff_code"] == "BS900"
    by_code = "/api/v1/registry/staff/by-code/BS900"
    assert client.get(by_code).status_code == 401
    assert client.get(by_code, headers={"Authorization": "Bearer doctor-token"}).status_code == 403
    assert client.get(by_code, headers={"Authorization": "Bearer admin-token"}).json()["role"] == "doctor"
    assert client.get("/api/v1/registry/staff/by-code/UNKNOWN",
                      headers={"Authorization": "Bearer admin-token"}).status_code == 404


def test_unlinked_demo_staff_is_visible_to_admin_but_has_no_owner(client):
    client.repository.staff["demo:BS001"] = {
        "staff_code": "BS001", "identity_account_id": None, "role": "doctor",
        "full_name": "Nguyễn Văn An", "phone": "0911222333",
        "specialty": "Nội tổng quát", "branch_code": None, "source": "legacy_demo",
    }
    client.identity.accounts["admin-token"] = {
        "id": str(uuid4()), "role": "admin", "subject_id": None, "is_active": True,
    }
    client.identity.accounts["doctor-token"] = {
        "id": str(uuid4()), "role": "doctor", "subject_id": "BS001", "is_active": True,
    }
    result = client.get("/api/v1/registry/staff", headers={"Authorization": "Bearer admin-token"})
    assert result.status_code == 200
    assert result.json()["items"][0]["source"] == "legacy_demo"
    assert result.json()["items"][0]["identity_account_id"] is None
    assert client.get("/api/v1/registry/staff/me",
                      headers={"Authorization": "Bearer doctor-token"}).status_code == 404
