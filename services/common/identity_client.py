"""Validate user access tokens through Identity rather than sharing JWT keys."""

import os

import httpx


class IdentityUnavailable(Exception):
    pass


class InvalidIdentityToken(Exception):
    pass


class IdentityClient:
    def __init__(self, transport: httpx.AsyncBaseTransport | None = None) -> None:
        self._http = httpx.AsyncClient(
            timeout=5.0,
            limits=httpx.Limits(max_connections=20, max_keepalive_connections=10),
            transport=transport,
        )

    async def close(self) -> None:
        await self._http.aclose()

    async def active_staff_codes(self, role: str, codes: list[str]) -> set[str]:
        if not codes:
            return set()
        secret = os.getenv("REGISTRY_INTERNAL_TOKEN", "")
        if not secret:
            raise IdentityUnavailable("Identity internal credential is not configured")
        base_url = os.getenv("IDENTITY_INTERNAL_URL", "http://identity:8000").rstrip("/")
        active: set[str] = set()
        try:
            for start in range(0, len(codes), 500):
                batch = codes[start:start + 500]
                response = await self._http.post(
                    f"{base_url}/api/v1/identity/internal/active-staff",
                    headers={"X-Service-Token": secret},
                    json={"role": role, "subject_ids": batch},
                )
                if response.status_code != 200:
                    raise IdentityUnavailable("Identity could not verify staff status")
                result = response.json()
                if not isinstance(result, dict) or not isinstance(result.get("subject_ids"), list):
                    raise IdentityUnavailable("Identity returned invalid staff status")
                active.update(code for code in result["subject_ids"] if code in batch)
        except httpx.RequestError as exc:
            raise IdentityUnavailable("Identity service is unavailable") from exc
        except (ValueError, TypeError) as exc:
            raise IdentityUnavailable("Identity returned invalid staff status") from exc
        return active

    async def current_account(self, token: str) -> dict:
        base_url = os.getenv("IDENTITY_INTERNAL_URL", "http://identity:8000").rstrip("/")
        try:
            response = await self._http.get(
                f"{base_url}/api/v1/identity/me",
                headers={"Authorization": f"Bearer {token}"},
            )
        except httpx.RequestError as exc:
            raise IdentityUnavailable("Identity service is unavailable") from exc
        if response.status_code == 401:
            raise InvalidIdentityToken("Invalid access token")
        if response.status_code != 200:
            raise IdentityUnavailable("Identity service could not verify the token")
        try:
            account = response.json()
            if not isinstance(account, dict) or not account.get("id") or not account.get("role"):
                raise ValueError("Invalid account")
            return account
        except (ValueError, TypeError) as exc:
            raise IdentityUnavailable("Identity service returned an invalid account") from exc
