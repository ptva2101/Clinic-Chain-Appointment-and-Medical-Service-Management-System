"""Validate schedule references against Registry without reading its MySQL database."""

import os
from urllib.parse import quote

import httpx


class RegistryUnavailable(Exception):
    pass


class InvalidScheduleReference(Exception):
    pass


class RegistryClient:
    async def active_doctor_codes(self, codes: set[str]) -> set[str]:
        if not codes:
            return set()
        base = os.getenv("REGISTRY_INTERNAL_URL", "http://registry:8000").rstrip("/")
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(f"{base}/api/v1/registry/catalog/doctors")
        except httpx.RequestError as exc:
            raise RegistryUnavailable("Registry service is unavailable") from exc
        if response.status_code != 200:
            raise RegistryUnavailable("Registry could not verify active doctors")
        try:
            doctors = response.json()
            if not isinstance(doctors, list):
                raise ValueError("Invalid doctor list")
            return {row["MaBacSi"] for row in doctors if isinstance(row, dict)
                    and row.get("MaBacSi") in codes and row.get("TrangThai") == "active"}
        except (ValueError, TypeError, KeyError) as exc:
            raise RegistryUnavailable("Registry returned invalid doctor data") from exc

    async def booking_config(self, code: str) -> dict:
        base = os.getenv("REGISTRY_INTERNAL_URL", "http://registry:8000").rstrip("/")
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(
                    f"{base}/api/v1/registry/catalog/branch-services/{quote(code, safe='')}"
                )
        except httpx.RequestError as exc:
            raise RegistryUnavailable("Registry service is unavailable") from exc
        if response.status_code == 404:
            raise InvalidScheduleReference("Branch/service configuration not found")
        if response.status_code != 200:
            raise RegistryUnavailable("Registry catalogue is unavailable")
        try:
            config = response.json()
            if (not isinstance(config, dict) or config.get("MaCauHinh") != code
                    or type(config.get("SlotGioiHan")) is not int
                    or config["SlotGioiHan"] < 0
                    or not config.get("MaChiNhanh") or not config.get("MaDichVu")
                    or config.get("TrangThai") not in ("active", "inactive")):
                raise ValueError("Invalid configuration")
            return config
        except (ValueError, TypeError) as exc:
            raise RegistryUnavailable("Registry returned an invalid booking configuration") from exc

    async def verify_references(self, token: str, doctor_codes: set[str],
                                branch_codes: set[str]) -> None:
        active = await self.active_doctor_codes(doctor_codes)
        if doctor_codes - active:
            raise InvalidScheduleReference("Doctor account is inactive or not linked")
        base = os.getenv("REGISTRY_INTERNAL_URL", "http://registry:8000").rstrip("/")
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                branches_response = await client.get(f"{base}/api/v1/registry/catalog/branches")
                if branches_response.status_code != 200:
                    raise RegistryUnavailable("Registry catalogue is unavailable")
                branches = branches_response.json()
                if not isinstance(branches, list):
                    raise RegistryUnavailable("Registry returned an invalid branch catalogue")
                known = {branch.get("MaChiNhanh") for branch in branches
                         if isinstance(branch, dict) and branch.get("TrangThai", "active") == "active"}
                if not branch_codes <= known:
                    raise InvalidScheduleReference("Branch does not exist in Registry")
                for doctor_code in doctor_codes:
                    response = await client.get(
                        f"{base}/api/v1/registry/staff/by-code/{quote(doctor_code, safe='')}",
                        headers={"Authorization": f"Bearer {token}"},
                    )
                    if response.status_code == 404:
                        raise InvalidScheduleReference("Doctor does not exist in Registry")
                    if response.status_code != 200:
                        raise RegistryUnavailable("Registry could not verify doctor")
                    profile = response.json()
                    if profile.get("role") != "doctor" or profile.get("staff_code") != doctor_code:
                        raise InvalidScheduleReference("Staff member is not a doctor")
        except httpx.RequestError as exc:
            raise RegistryUnavailable("Registry service is unavailable") from exc
        except (ValueError, TypeError, AttributeError) as exc:
            raise RegistryUnavailable("Registry returned invalid data") from exc
