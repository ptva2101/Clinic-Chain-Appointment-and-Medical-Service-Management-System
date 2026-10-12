"""Identity-to-Registry HTTP call; no cross-service database access."""

import os

import httpx


class RegistryUnavailable(Exception):
    pass


class RegistryConflict(Exception):
    pass


class RegistryClient:
    async def ensure_patient(self, account_id: str, cccd: str) -> str:
        token = os.getenv("REGISTRY_INTERNAL_TOKEN", "")
        if not token:
            raise RegistryUnavailable("Registry service credential is not configured")
        base_url = os.getenv("REGISTRY_INTERNAL_URL", "http://registry:8000").rstrip("/")
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.put(
                    f"{base_url}/api/v1/registry/internal/patients/{account_id}",
                    headers={"X-Service-Token": token},
                    json={"cccd": cccd},
                )
        except httpx.RequestError as exc:
            raise RegistryUnavailable("Registry service is unavailable") from exc
        if response.status_code == 409:
            raise RegistryConflict("CCCD is linked to another patient")
        if response.status_code != 200:
            raise RegistryUnavailable("Registry service could not create the profile")
        try:
            profile = response.json()
            if profile["identity_account_id"] != account_id or profile["cccd"] != cccd:
                raise ValueError("Mismatched Registry profile")
            return str(profile["id"])
        except (ValueError, KeyError, TypeError) as exc:
            raise RegistryUnavailable("Registry service returned an invalid profile") from exc
