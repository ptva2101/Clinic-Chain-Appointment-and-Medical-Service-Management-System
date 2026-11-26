import asyncio
from copy import deepcopy
import pytest
from appointment.change_api import process_change
from common.change_http import ChangeUnavailable


class Changes:
    def __init__(self):
        self.operation = {'id': 'op', 'state': 'pending', 'payload': {
            'scope': 'schedule', 'action': 'cancel', 'appointment_ids': ['paid', 'unpaid']}}
        self.notifications = []
    async def get(self, operation_id):
        return deepcopy(self.operation)
    async def proof(self, appointment_id, operation_id):
        return {'action': 'cancel'}
    async def appointment(self, appointment_id):
        return {'hold_id': appointment_id}
    async def error(self, operation_id, error):
        pass
    async def complete(self, operation, refunds):
        if self.operation['state'] == 'pending':
            self.notifications.extend(operation['payload']['appointment_ids'])
            self.operation['state'] = 'completed'


class Services:
    def __init__(self):
        self.refunded = set()
        self.refund_count = 0
        self.released = set()
        self.fail_release = True
        self.finished = 0
    async def settle(self, appointment_id, operation):
        if appointment_id == 'paid' and appointment_id not in self.refunded:
            self.refunded.add(appointment_id)
            self.refund_count += 1
        return {'refunded_amount': 40000 if appointment_id == 'paid' else 0}
    async def clinical(self, appointment_id, operation):
        pass
    async def release(self, hold_id):
        if self.fail_release:
            self.fail_release = False
            raise ChangeUnavailable('Timeout after refund')
        self.released.add(hold_id)
    async def finish_schedule(self, operation):
        self.finished += 1


def test_resume_after_refund_timeout_does_not_duplicate_money_or_notifications():
    async def run():
        repository, clients = Changes(), Services()
        with pytest.raises(ChangeUnavailable, match='Timeout after refund'):
            await process_change(repository, clients, 'op')
        assert clients.refund_count == 1 and repository.notifications == []
        assert repository.operation['state'] == 'pending' and clients.finished == 0
        await process_change(repository, clients, 'op')
        await process_change(repository, clients, 'op')
        assert clients.refund_count == 1 and clients.released == {'paid', 'unpaid'}
        assert repository.notifications == ['paid', 'unpaid'] and clients.finished == 1
    asyncio.run(run())


def test_original_reconciler_defers_reserved_admin_operations():
    from appointment.reconcile import AppointmentReconciler
    async def run():
        assert await AppointmentReconciler(None, None, None)._cancel_pending(
            {'change_operation_id': 'reserved'}) == 'deferred'
    asyncio.run(run())
