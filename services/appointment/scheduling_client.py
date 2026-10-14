"""Appointment-to-Scheduling HTTP contract; no cross-database access."""

import os
from urllib.parse import quote

import httpx


class SchedulingUnavailable(Exception):
    pass


class SchedulingRejected(Exception):
    def __init__(self, status_code: int, detail: str) -> None:
        self.status_code = status_code
        super().__init__(detail)


class SchedulingClient:
    def __init__(self) -> None:
        self.base = os.getenv("SCHEDULING_INTERNAL_URL", "http://scheduling:8000").rstrip("/")

    @staticmethod
    def _result(response: httpx.Response) -> dict:
        if response.status_code in (404, 409, 422):
            try:
                detail = response.json().get("detail", "Scheduling rejected the request")
            except (ValueError, AttributeError):
                detail = "Scheduling rejected the request"
            raise SchedulingRejected(response.status_code, str(detail))
        if response.status_code != 200:
            raise SchedulingUnavailable("Scheduling service is unavailable")
        try:
            data = response.json()
            if not isinstance(data, dict) or not data.get("id") or not data.get("state"):
                raise ValueError("Invalid Scheduling response")
            return data
        except (ValueError, TypeError) as exc:
            raise SchedulingUnavailable("Scheduling returned an invalid response") from exc

    async def create_hold(self, token: str, body: dict) -> dict:
        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
                response = await client.post(
                    f"{self.base}/api/v1/scheduling/holds", json=body,
                    headers={"Authorization": f"Bearer {token}"},
                )
        except httpx.RequestError as exc:
            raise SchedulingUnavailable("Scheduling service is unavailable") from exc
        return self._result(response)

    async def _internal(self, hold_id: str, action: str,
                        appointment_id: str | None = None) -> dict:
        token = os.getenv("SCHEDULING_INTERNAL_TOKEN")
        if not token:
            raise SchedulingUnavailable("Scheduling internal token is not configured")
        url = f"{self.base}/api/v1/scheduling/internal/holds/{quote(hold_id, safe='')}/{action}"
        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
                response = await client.post(
                    url, headers={"X-Service-Token": token},
                    json={"appointment_id": appointment_id} if appointment_id else None,
                )
        except httpx.RequestError as exc:
            raise SchedulingUnavailable("Scheduling service is unavailable") from exc
        return self._result(response)

    async def confirm(self, hold_id: str, appointment_id: str) -> dict:
        return await self._internal(hold_id, "confirm", appointment_id)

    async def release(self, hold_id: str) -> dict:
        return await self._internal(hold_id, "release")
