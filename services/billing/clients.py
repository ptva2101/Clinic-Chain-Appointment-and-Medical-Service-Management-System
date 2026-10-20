"""Read published contracts; Billing never reads Appointment or Registry databases."""

import os

import httpx


class UpstreamUnavailable(Exception):
    pass


class InvalidAppointment(Exception):
    pass


class InvalidService(Exception):
    pass


class BillingClients:
    async def appointment(self, token: str, appointment_id: str) -> dict:
        base = os.getenv("APPOINTMENT_INTERNAL_URL", "http://appointment:8000").rstrip("/")
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(
                    f"{base}/api/v1/appointments/{appointment_id}",
                    headers={"Authorization": f"Bearer {token}"},
                )
        except httpx.RequestError as exc:
            raise UpstreamUnavailable("Appointment service is unavailable") from exc
        if response.status_code in (403, 404):
            raise InvalidAppointment("Appointment not found")
        if response.status_code != 200:
            raise UpstreamUnavailable("Appointment service could not verify the appointment")
        try:
            result = response.json()
            if not isinstance(result, dict) or result.get("id") != appointment_id:
                raise ValueError("Invalid appointment")
            return result
        except (ValueError, TypeError) as exc:
            raise UpstreamUnavailable("Appointment service returned invalid data") from exc

    async def service_price(self, service_code: str) -> int:
        base = os.getenv("REGISTRY_INTERNAL_URL", "http://registry:8000").rstrip("/")
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(f"{base}/api/v1/registry/catalog/services")
        except httpx.RequestError as exc:
            raise UpstreamUnavailable("Registry service is unavailable") from exc
        if response.status_code != 200:
            raise UpstreamUnavailable("Registry service could not provide prices")
        try:
            services = response.json()
            service = next((item for item in services if item["MaDichVu"] == service_code), None)
            if service is None or service.get("TrangThai") != "active":
                raise InvalidService("Medical service is unavailable")
            price = service["GiaGoc"]
            if type(price) is not int or price < 0:
                raise ValueError("Invalid price")
            return price
        except (ValueError, TypeError, KeyError) as exc:
            raise UpstreamUnavailable("Registry service returned invalid prices") from exc
