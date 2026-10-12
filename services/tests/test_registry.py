from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from registry.api import get_repository
from registry.main import app
from registry.repository import ProfileConflict


class MemoryRegistryRepository:
    def __init__(self):
        self.patients = {}

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
        })


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setenv("REGISTRY_INTERNAL_TOKEN", "test_internal_credential")
    repository = MemoryRegistryRepository()
    app.dependency_overrides[get_repository] = lambda: repository
    try:
        with TestClient(app) as test_client:
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


def test_registry_rejects_invalid_patient_identifiers(client):
    headers = {"X-Service-Token": "test_internal_credential"}
    assert client.put("/api/v1/registry/internal/patients/not-a-uuid",
                      json={"cccd": "001095012345"}, headers=headers).status_code == 422
    assert client.put(f"/api/v1/registry/internal/patients/{uuid4()}",
                      json={"cccd": "invalid"}, headers=headers).status_code == 422
    assert "/api/v1/registry/internal/patients/{account_id}" in client.get("/openapi.json").json()["paths"]
