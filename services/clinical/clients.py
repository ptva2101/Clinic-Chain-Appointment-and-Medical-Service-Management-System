"""Clinical HTTP integration with Appointment, Registry and Laboratory."""

import os
from hashlib import sha256

import httpx


class ClinicalUnavailable(Exception):
    pass


class ClinicalRejected(Exception):
    pass


class ClinicalClients:
    async def queued_appointment(self, token: str, appointment_id: str) -> dict:
        base = os.getenv("APPOINTMENT_INTERNAL_URL", "http://appointment:8000").rstrip("/")
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(f"{base}/api/v1/appointments/doctor/queue/{appointment_id}",
                                            headers={"Authorization": f"Bearer {token}"})
        except httpx.RequestError as exc:
            raise ClinicalUnavailable("Appointment service is unavailable") from exc
        if response.status_code == 404:
            raise ClinicalRejected("Appointment is not in this doctor's queue")
        if response.status_code != 200:
            raise ClinicalUnavailable("Appointment queue is unavailable")
        return response.json()

    async def laboratory_prices(self, service_codes: list[str]) -> list[dict]:
        if not service_codes:
            return []
        base = os.getenv("REGISTRY_INTERNAL_URL", "http://registry:8000").rstrip("/")
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(f"{base}/api/v1/registry/catalog/services")
        except httpx.RequestError as exc:
            raise ClinicalUnavailable("Registry service is unavailable") from exc
        if response.status_code != 200:
            raise ClinicalUnavailable("Registry catalogue is unavailable")
        catalogue = {item["MaDichVu"]: item for item in response.json()}
        prices = []
        for code in service_codes:
            item = catalogue.get(code)
            if (not item or item.get("TrangThai") != "active"
                    or item.get("LoaiDichVu") != "Xét nghiệm"):
                raise ClinicalRejected(f"Laboratory service {code} is unavailable")
            prices.append({"service_code": code, "list_price": item["GiaGoc"]})
        return prices

    async def ensure_lab_orders(self, encounter: dict, services: list[dict]) -> list[dict]:
        if not services:
            return []
        base = os.getenv("LABORATORY_INTERNAL_URL", "http://laboratory:8000").rstrip("/")
        secret = os.getenv("LABORATORY_INTERNAL_TOKEN", "")
        if not secret:
            raise ClinicalUnavailable("Laboratory internal credential is missing")
        payload = {
            "encounter_id": encounter["id"], "appointment_id": encounter["appointment_id"],
            "patient_id": encounter["patient_id"], "branch_code": encounter["branch_code"],
            "doctor_code": encounter["doctor_code"], "services": services,
        }
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.post(f"{base}/api/v1/laboratory/internal/orders",
                                             headers={"X-Service-Token": secret}, json=payload)
        except httpx.RequestError as exc:
            raise ClinicalUnavailable("Laboratory service is unavailable; retry this encounter to sync orders") from exc
        if response.status_code != 201:
            raise ClinicalUnavailable("Laboratory could not create orders; retry this encounter to sync orders")
        return response.json()

    async def move_queue(self, token: str, appointment_id: str, state: str) -> None:
        base = os.getenv("APPOINTMENT_INTERNAL_URL", "http://appointment:8000").rstrip("/")
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.post(
                    f"{base}/api/v1/appointments/{appointment_id}/queue-state",
                    headers={"Authorization": f"Bearer {token}"}, json={"state": state},
                )
        except httpx.RequestError as exc:
            raise ClinicalUnavailable("Appointment queue could not be updated; retry this encounter") from exc
        if response.status_code != 200:
            raise ClinicalUnavailable("Appointment queue rejected the state transition; retry this encounter")

    async def verify_treatment_config(self, config_code: str, service_code: str) -> None:
        base = os.getenv("REGISTRY_INTERNAL_URL", "http://registry:8000").rstrip("/")
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(
                    f"{base}/api/v1/registry/catalog/branch-services/{config_code}")
        except httpx.RequestError as exc:
            raise ClinicalUnavailable("Registry service is unavailable") from exc
        if response.status_code != 200:
            raise ClinicalRejected("Treatment service configuration is unavailable")
        config = response.json()
        if config.get("MaDichVu") != service_code or config.get("TrangThai") != "active":
            raise ClinicalRejected("Treatment configuration does not match the prescribed service")
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                service_response = await client.get(f"{base}/api/v1/registry/catalog/services")
        except httpx.RequestError as exc:
            raise ClinicalUnavailable("Registry catalogue is unavailable") from exc
        if service_response.status_code != 200:
            raise ClinicalUnavailable("Registry catalogue is unavailable")
        service = next((item for item in service_response.json()
                        if item.get("MaDichVu") == service_code), None)
        if not service or service.get("LoaiDichVu") != "Điều trị" or service.get("TrangThai") != "active":
            raise ClinicalRejected("Prescribed treatment service is unavailable")

    async def book_treatment_appointment(self, token: str, plan: dict, request: dict) -> dict:
        base = os.getenv("APPOINTMENT_INTERNAL_URL", "http://appointment:8000").rstrip("/")
        key = "trt_" + sha256(f"{plan['id']}:{request['idempotency_key']}".encode()).hexdigest()
        payload = {
            "config_code": request["config_code"], "doctor_code": request["doctor_code"],
            "date": request["date"].isoformat(), "shift": request["shift"], "idempotency_key": key,
        }
        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
                response = await client.post(f"{base}/api/v1/appointments", json=payload,
                                             headers={"Authorization": f"Bearer {token}"})
        except httpx.RequestError as exc:
            raise ClinicalUnavailable("Appointment booking is uncertain; retry with the same idempotency key") from exc
        if response.status_code in (409, 422):
            raise ClinicalRejected(response.json().get("detail", "Treatment slot is unavailable"))
        if response.status_code not in (200, 201):
            raise ClinicalUnavailable("Appointment could not confirm this treatment session")
        appointment = response.json()
        if (appointment.get("service_code") != plan["service_code"]
                or appointment.get("patient_id") != plan["patient_id"]
                or appointment.get("status") != "confirmed"):
            raise ClinicalUnavailable("Appointment returned an invalid treatment booking")
        return appointment

    async def treatment_invoice(self, token: str, appointment_id: str) -> dict:
        base = os.getenv("BILLING_INTERNAL_URL", "http://billing:8000").rstrip("/")
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.post(f"{base}/api/v1/billing/invoices",
                                             headers={"Authorization": f"Bearer {token}"},
                                             json={"appointment_id": appointment_id})
        except httpx.RequestError as exc:
            raise ClinicalUnavailable("Treatment appointment exists but invoice creation is pending; retry") from exc
        if response.status_code not in (200, 201):
            raise ClinicalUnavailable("Treatment appointment exists but invoice creation failed; retry")
        invoice = response.json()
        if invoice.get("appointment_id") != appointment_id:
            raise ClinicalUnavailable("Billing returned an invalid treatment invoice")
        return invoice
