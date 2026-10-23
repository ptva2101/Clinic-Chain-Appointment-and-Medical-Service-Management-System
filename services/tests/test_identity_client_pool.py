import asyncio

import httpx
import pytest

from common.identity_client import IdentityClient, InvalidIdentityToken


def test_shared_http_client_checks_identity_on_every_request():
    calls = 0

    def respond(request: httpx.Request) -> httpx.Response:
        nonlocal calls
        calls += 1
        assert request.headers["Authorization"] == "Bearer synthetic-token"
        if calls == 1:
            return httpx.Response(200, json={"id": "synthetic", "role": "patient", "is_active": True})
        return httpx.Response(401, json={"detail": "revoked"})

    async def scenario() -> None:
        identity = IdentityClient(transport=httpx.MockTransport(respond))
        try:
            assert (await identity.current_account("synthetic-token"))["id"] == "synthetic"
            with pytest.raises(InvalidIdentityToken):
                await identity.current_account("synthetic-token")
            assert calls == 2
        finally:
            await identity.close()

    asyncio.run(scenario())
