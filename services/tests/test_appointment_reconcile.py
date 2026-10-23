import asyncio

from appointment.reconcile import AppointmentReconciler
from appointment.repository import AppointmentConflict
from appointment.scheduling_client import SchedulingRejected, SchedulingUnavailable
from appointment.workflow_clients import WorkflowUnavailable


class MemoryAppointments:
    def __init__(self, rows):
        self.rows = {row["id"]: row for row in rows}

    async def list_stale(self, after_id, _min_age_seconds, limit):
        return [row.copy() for row in sorted(self.rows.values(), key=lambda item: item["id"])
                if row["id"] > after_id and row["status"] in ("pending", "cancel_pending")][:limit]

    async def set_status(self, appointment_id, expected, next_status):
        row = self.rows[appointment_id]
        if row["status"] != next_status and row["status"] not in expected:
            raise AppointmentConflict("Invalid status change")
        row["status"] = next_status
        return row.copy()


class MemoryScheduling:
    def __init__(self, holds):
        self.holds = holds
        self.unavailable = False
        self.expire_on_confirm = set()

    async def get_hold(self, hold_id):
        if self.unavailable:
            raise SchedulingUnavailable("Scheduling unavailable")
        if hold_id not in self.holds:
            raise SchedulingRejected(404, "Hold not found")
        return self.holds[hold_id].copy()

    async def confirm(self, hold_id, appointment_id):
        if self.unavailable:
            raise SchedulingUnavailable("Scheduling unavailable")
        hold = self.holds[hold_id]
        if hold_id in self.expire_on_confirm:
            hold["state"] = "expired"
            raise SchedulingRejected(409, "Hold expired")
        if hold["state"] != "held":
            raise SchedulingRejected(409, "Hold cannot be confirmed")
        hold.update(state="confirmed", appointment_id=appointment_id)
        return hold.copy()

    async def release(self, hold_id):
        if self.unavailable:
            raise SchedulingUnavailable("Scheduling unavailable")
        hold = self.holds[hold_id]
        hold["state"] = "released"
        return hold.copy()


class MemoryBilling:
    def __init__(self, statuses=None):
        self.statuses = statuses or {}
        self.unavailable = False

    async def payment_status(self, appointment_id):
        if self.unavailable:
            raise WorkflowUnavailable("Billing unavailable")
        return self.statuses.get(appointment_id)


def row(appointment_id, status):
    return {"id": appointment_id, "hold_id": f"hold-{appointment_id}", "status": status}


def hold(appointment_id, state, owner=None):
    return {"id": f"hold-{appointment_id}", "state": state, "appointment_id": owner}


def test_pending_hold_is_confirmed_or_failed_automatically():
    async def run():
        repository = MemoryAppointments([row("a", "pending"), row("b", "pending"),
                                         row("c", "pending"), row("d", "pending"),
                                         row("e", "pending"), row("f", "pending")])
        scheduling = MemoryScheduling({
            "hold-a": hold("a", "held"),
            "hold-b": hold("b", "confirmed", "b"),
            "hold-c": hold("c", "expired"),
            "hold-d": hold("d", "confirmed", "another-appointment"),
            "hold-e": hold("e", "held"),
        })
        scheduling.expire_on_confirm.add("hold-e")
        reconciler = AppointmentReconciler(repository, scheduling, MemoryBilling())
        result = await reconciler.run_once()
        assert result == {"scanned": 6, "confirmed": 2, "failed": 4,
                          "cancelled": 0, "deferred": 0}
        assert repository.rows["a"]["status"] == "confirmed"
        assert scheduling.holds["hold-a"]["appointment_id"] == "a"
        assert repository.rows["c"]["status"] == "failed"

    asyncio.run(run())


def test_cancel_pending_respects_paid_invoice_and_unknown_remote_state():
    async def run():
        repository = MemoryAppointments([row("a", "cancel_pending"), row("b", "cancel_pending"),
                                         row("c", "cancel_pending"), row("d", "cancel_pending")])
        scheduling = MemoryScheduling({
            "hold-a": hold("a", "confirmed", "a"),
            "hold-b": hold("b", "confirmed", "b"),
            "hold-c": hold("c", "released", "c"),
        })
        billing = MemoryBilling({"b": "paid", "c": "refunded"})
        result = await AppointmentReconciler(repository, scheduling, billing).run_once()
        assert result == {"scanned": 4, "confirmed": 0, "failed": 0,
                          "cancelled": 2, "deferred": 2}
        assert scheduling.holds["hold-a"]["state"] == "released"
        assert scheduling.holds["hold-b"]["state"] == "confirmed"
        assert repository.rows["b"]["status"] == "cancel_pending"
        assert repository.rows["d"]["status"] == "cancel_pending"

    asyncio.run(run())


def test_unavailable_dependency_does_not_block_later_rows():
    async def run():
        repository = MemoryAppointments([row("a", "cancel_pending"), row("b", "pending")])
        scheduling = MemoryScheduling({"hold-b": hold("b", "confirmed", "b")})
        billing = MemoryBilling({"a": "paid"})
        reconciler = AppointmentReconciler(repository, scheduling, billing, batch_size=1)
        assert (await reconciler.run_once())["deferred"] == 1
        assert (await reconciler.run_once())["confirmed"] == 1
        billing.unavailable = True
        assert (await reconciler.run_once())["scanned"] == 0  # wrap cursor
        assert (await reconciler.run_once())["deferred"] == 1
        assert repository.rows["a"]["status"] == "cancel_pending"

    asyncio.run(run())
