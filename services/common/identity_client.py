"""Validate user access tokens through Identity rather than sharing JWT keys."""

import os

import httpx


class IdentityUnavailable(Exception):
    pass


class InvalidIdentityToken(Exception):
    pass


class IdentityClient:
    async def current_account(self, token: str) -> dict:
        base_url = os.getenv("IDENTITY_INTERNAL_URL", "http://identity:8000").rstrip("/")
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(
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
