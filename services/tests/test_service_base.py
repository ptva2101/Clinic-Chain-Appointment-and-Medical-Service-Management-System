from importlib import import_module
from unittest.mock import AsyncMock

import pytest
from fastapi.testclient import TestClient


SERVICES = (
    "identity",
    "registry",
    "scheduling",
    "appointment",
    "billing",
    "clinical",
    "laboratory",
)


@pytest.mark.parametrize("name", SERVICES)
def test_each_service_exposes_its_own_health_and_openapi(name):
    app = import_module(f"{name}.main").app
    with TestClient(app) as client:
        assert client.get("/health").json() == {"service": name, "status": "ok"}
        schema = client.get("/openapi.json").json()
        assert schema["info"]["title"] == f"Medicare {name.title()} Service"
        assert "/ready" in schema["paths"]


@pytest.mark.parametrize("name", SERVICES)
def test_readiness_checks_its_database(name, monkeypatch):
    app = import_module(f"{name}.main").app
    ping = AsyncMock()
    monkeypatch.setattr(app.state.database, "ping", ping)
    with TestClient(app) as client:
        assert client.get("/ready").json() == {"service": name, "status": "ready"}
    ping.assert_awaited_once()


def test_readiness_reports_database_failure_without_leaking_credentials(monkeypatch):
    app = import_module("identity.main").app
    monkeypatch.setattr(app.state.database, "ping", AsyncMock(side_effect=RuntimeError("secret")))
    with TestClient(app) as client:
        response = client.get("/ready")
    assert response.status_code == 503
    assert response.json() == {"detail": "Database unavailable"}


@pytest.mark.parametrize("name", SERVICES)
def test_identity_http_client_is_owned_by_service_lifespan(name):
    app = import_module(f"{name}.main").app
    with TestClient(app):
        shared = app.state.identity_client
        assert shared is not None
        assert not shared._http.is_closed
    assert shared._http.is_closed


@pytest.mark.parametrize("name", ("clinical", "laboratory"))
def test_browser_can_call_clinical_and_laboratory(name):
    app = import_module(f"{name}.main").app
    origin = "http://127.0.0.1:5173"
    with TestClient(app) as client:
        response = client.options(
            "/api/v1/" + name + "/orders",
            headers={"Origin": origin, "Access-Control-Request-Method": "POST",
                     "Access-Control-Request-Headers": "authorization,content-type"},
        )
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == origin
