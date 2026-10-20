"""Appointment-side checks through Registry and Billing HTTP contracts."""

import os

import httpx


class WorkflowUnavailable(Exception):
    pass


class WorkflowRejected(Exception):
    pass


class WorkflowClients:
    async def patient_profiles(self, patient_ids: list[str]) -> dict[str, dict]:
        if not patient_ids:
            return {}
        base = os.getenv("REGISTRY_INTERNAL_URL", "http://registry:8000").rstrip("/")
        secret = os.getenv("REGISTRY_INTERNAL_TOKEN", "")
        if not secret:
            raise WorkflowUnavailable("Registry internal credential is not configured")
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.post(
                    f"{base}/api/v1/registry/internal/patients/lookup",
                    headers={"X-Service-Token": secret},
                    json={"patient_ids": list(set(patient_ids))[:500]},
                )
        except httpx.RequestError as exc:
            raise WorkflowUnavailable("Registry service is unavailable") from exc
        if response.status_code != 200:
            raise WorkflowUnavailable("Registry service could not provide patient profiles")
        try:
            profiles = response.json()
            if not isinstance(profiles, list):
                raise ValueError("Invalid profiles")
            return {profile["id"]: profile for profile in profiles if isinstance(profile, dict)}
        except (ValueError, TypeError, KeyError) as exc:
            raise WorkflowUnavailable("Registry returned invalid patient profiles") from exc

    async def receptionist_profile(self, token: str) -> dict:
        base = os.getenv("REGISTRY_INTERNAL_URL", "http://registry:8000").rstrip("/")
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(
                    f"{base}/api/v1/registry/staff/me",
                    headers={"Authorization": f"Bearer {token}"},
                )
        except httpx.RequestError as exc:
            raise WorkflowUnavailable("Registry service is unavailable") from exc
        if response.status_code != 200:
            raise WorkflowRejected("Receptionist profile is unavailable")
        try:
            profile = response.json()
            if not isinstance(profile, dict) or profile.get("role") != "letan" or not profile.get("branch_code"):
                raise ValueError("Invalid receptionist profile")
            return profile
        except (ValueError, TypeError) as exc:
            raise WorkflowUnavailable("Registry returned an invalid staff profile") from exc

    async def payment_status(self, appointment_id: str) -> str | None:
        base = os.getenv("BILLING_INTERNAL_URL", "http://billing:8000").rstrip("/")
        secret = os.getenv("BILLING_INTERNAL_TOKEN", "")
        if not secret:
            raise WorkflowUnavailable("Billing internal credential is not configured")
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(
                    f"{base}/api/v1/billing/internal/appointments/{appointment_id}/payment",
                    headers={"X-Service-Token": secret},
                )
        except httpx.RequestError as exc:
            raise WorkflowUnavailable("Billing service is unavailable") from exc
        if response.status_code == 404:
            return None
        if response.status_code != 200:
            raise WorkflowUnavailable("Billing service could not verify payment")
        try:
            invoice = response.json()
            if invoice.get("appointment_id") != appointment_id:
                raise ValueError("Invoice mismatch")
            if invoice.get("status") not in ("pending", "paid", "refunded"):
                raise ValueError("Invalid payment status")
            return invoice["status"]
        except (ValueError, TypeError, AttributeError) as exc:
            raise WorkflowUnavailable("Billing returned an invalid invoice") from exc

    async def require_paid(self, appointment_id: str) -> None:
        if await self.payment_status(appointment_id) != "paid":
            raise WorkflowRejected("Appointment has not been paid")
