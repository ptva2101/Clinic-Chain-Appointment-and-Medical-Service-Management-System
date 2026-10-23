"""Retry uncertain Appointment sagas without reading another service's database."""

import asyncio
import logging
import os

from appointment.repository import AppointmentConflict, AppointmentNotFound, AppointmentRepository
from appointment.scheduling_client import SchedulingClient, SchedulingRejected, SchedulingUnavailable
from appointment.workflow_clients import WorkflowClients, WorkflowUnavailable
from common.database import MySQLDatabase


logger = logging.getLogger(__name__)


class AppointmentReconciler:
    def __init__(self, repository: AppointmentRepository, scheduling: SchedulingClient,
                 billing: WorkflowClients, *, min_age_seconds: int = 30,
                 batch_size: int = 20) -> None:
        self.repository = repository
        self.scheduling = scheduling
        self.billing = billing
        self.min_age_seconds = min_age_seconds
        self.batch_size = batch_size
        self.after_id = ""

    async def _pending(self, row: dict) -> str:
        try:
            hold = await self.scheduling.get_hold(row["hold_id"])
        except SchedulingRejected as exc:
            if exc.status_code == 404:
                await self.repository.set_status(row["id"], ("pending",), "failed")
                return "failed"
            raise
        if hold.get("id") != row["hold_id"]:
            raise SchedulingUnavailable("Scheduling returned a different hold")
        state = hold.get("state")
        owner = hold.get("appointment_id")
        if state == "confirmed" and owner == row["id"]:
            await self.repository.set_status(row["id"], ("pending",), "confirmed")
            return "confirmed"
        if state in ("expired", "released") or owner not in (None, row["id"]):
            await self.repository.set_status(row["id"], ("pending",), "failed")
            return "failed"
        if state != "held":
            return "deferred"
        try:
            confirmed = await self.scheduling.confirm(row["hold_id"], row["id"])
        except SchedulingRejected as exc:
            if exc.status_code not in (404, 409):
                raise
            # A concurrent confirmation or expiry may have won. Inspect the final state.
            try:
                confirmed = await self.scheduling.get_hold(row["hold_id"])
            except SchedulingRejected as lookup_error:
                if lookup_error.status_code != 404:
                    raise
                confirmed = {"state": "expired", "id": row["hold_id"]}
        if confirmed.get("id") != row["hold_id"]:
            raise SchedulingUnavailable("Scheduling returned a different hold")
        if confirmed.get("state") == "confirmed" and confirmed.get("appointment_id") == row["id"]:
            await self.repository.set_status(row["id"], ("pending",), "confirmed")
            return "confirmed"
        if confirmed.get("state") in ("expired", "released"):
            await self.repository.set_status(row["id"], ("pending",), "failed")
            return "failed"
        return "deferred"

    async def _cancel_pending(self, row: dict) -> str:
        if await self.billing.payment_status(row["id"]) == "paid":
            return "deferred"
        try:
            hold = await self.scheduling.get_hold(row["hold_id"])
        except SchedulingRejected:
            # Missing/unknown remote state is not proof that the slot was released.
            return "deferred"
        if hold.get("id") != row["hold_id"]:
            raise SchedulingUnavailable("Scheduling returned a different hold")
        if hold.get("appointment_id") not in (None, row["id"]):
            return "deferred"
        if hold.get("state") in ("confirmed", "held"):
            hold = await self.scheduling.release(row["hold_id"])
        if hold.get("state") not in ("released", "expired"):
            return "deferred"
        await self.repository.set_status(row["id"], ("cancel_pending",), "cancelled")
        return "cancelled"

    async def run_once(self) -> dict[str, int]:
        rows = await self.repository.list_stale(
            self.after_id, self.min_age_seconds, self.batch_size,
        )
        if not rows:
            self.after_id = ""
            return {"scanned": 0, "confirmed": 0, "failed": 0,
                    "cancelled": 0, "deferred": 0}
        counts = {"scanned": 0, "confirmed": 0, "failed": 0,
                  "cancelled": 0, "deferred": 0}
        for row in rows:
            self.after_id = row["id"]
            counts["scanned"] += 1
            try:
                if row["status"] == "pending":
                    outcome = await self._pending(row)
                else:
                    outcome = await self._cancel_pending(row)
            except (AppointmentConflict, AppointmentNotFound, SchedulingRejected,
                    SchedulingUnavailable, WorkflowUnavailable) as exc:
                logger.warning("Cannot reconcile appointment %s: %s", row["id"], exc)
                outcome = "deferred"
            except Exception:
                logger.exception("Unexpected reconciliation failure for appointment %s", row["id"])
                outcome = "deferred"
            counts[outcome] += 1
        logger.info("Appointment reconciliation: %s", counts)
        return counts


def _integer_setting(name: str, default: int, minimum: int, maximum: int) -> int:
    value = int(os.getenv(name, str(default)))
    if not minimum <= value <= maximum:
        raise ValueError(f"{name} must be between {minimum} and {maximum}")
    return value


async def main() -> None:
    logging.basicConfig(level=logging.INFO)
    interval = _integer_setting("APPOINTMENT_RECONCILE_INTERVAL_SECONDS", 30, 5, 3600)
    age = _integer_setting("APPOINTMENT_RECONCILE_MIN_AGE_SECONDS", 30, 5, 3600)
    batch = _integer_setting("APPOINTMENT_RECONCILE_BATCH_SIZE", 20, 1, 100)
    database = MySQLDatabase()
    reconciler = AppointmentReconciler(
        AppointmentRepository(database), SchedulingClient(), WorkflowClients(),
        min_age_seconds=age, batch_size=batch,
    )
    try:
        while True:
            try:
                await reconciler.run_once()
            except Exception:
                logger.exception("Appointment reconciliation batch failed")
            await asyncio.sleep(interval)
    finally:
        await database.close()


if __name__ == "__main__":
    asyncio.run(main())
