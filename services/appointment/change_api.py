"""Appointment orchestrates refund/cancellation and shift replacement via HTTP."""
from datetime import date
import logging
from typing import Annotated, Literal
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, ConfigDict

from appointment.api import authenticated_account, response
from appointment.change_repository import ChangeRepository
from appointment.repository import AppointmentRepository, AppointmentConflict, AppointmentNotFound
from appointment.scheduling_client import SchedulingClient, SchedulingRejected, SchedulingUnavailable
from common.change_http import ChangeRejected, ChangeUnavailable, call_change, change_token

router=APIRouter(prefix='/api/v1/appointments',tags=['Refund and shift orchestration'])
log=logging.getLogger(__name__)


def get_change_repository(request:Request):
    return ChangeRepository(request.app.state.database)


class ChangeClients:
    async def settle(self, appointment_id, operation):
        return await call_change('billing','POST',f'/api/v1/billing/internal/appointments/{appointment_id}/change',{
            'operation_id':operation['id'],'action':operation['payload']['action'],
        })

    async def clinical(self, appointment_id, operation):
        return await call_change('clinical','POST',f'/api/v1/clinical/internal/appointments/{appointment_id}/change',{
            'operation_id':operation['id'],'action':operation['payload']['action'],
        })

    async def release(self, hold_id):
        result=await SchedulingClient().release(hold_id)
        if result['state'] not in ('released','expired'):
            raise ChangeUnavailable('Slot release is uncertain')

    async def finish_schedule(self, operation):
        return await call_change('scheduling','POST',f"/api/v1/scheduling/internal/changes/{operation['id']}/finish")


def get_change_clients():
    return ChangeClients()


async def process_change(repository, clients, operation_id):
    operation=await repository.get(operation_id)
    if not operation:
        raise AppointmentNotFound('Change operation not found')
    if operation['state']=='completed':
        return operation
    try:
        refunds={}
        # No transaction or row lock is held during cross-service HTTP calls.
        for appointment_id in operation['payload']['appointment_ids']:
            result=await clients.settle(appointment_id,operation)
            refunds[appointment_id]=result.get('refunded_amount',0)
            await clients.clinical(appointment_id,operation)
            if operation['payload']['action']=='cancel':
                proof=await repository.proof(appointment_id,operation_id)
                # Get the original hold from Appointment's own store.
                row=await repository.appointment(appointment_id)
                if row['hold_id']:
                    await clients.release(row['hold_id'])
        if operation['payload']['scope']=='schedule':
            await clients.finish_schedule(operation)
        await repository.complete(operation,refunds)
        return await repository.get(operation_id)
    except (ChangeRejected,ChangeUnavailable,SchedulingRejected,SchedulingUnavailable,AppointmentConflict) as exc:
        await repository.error(operation_id,exc)
        raise ChangeUnavailable('Thay đổi đang được xử lý; hệ thống sẽ thử lại. '+str(exc)) from exc


async def resume_changes(database):
    repository=ChangeRepository(database)
    try:
        # Recover even if Scheduling froze a shift but its first request never reached Appointment.
        for remote in await call_change('scheduling','GET','/api/v1/scheduling/internal/changes/pending'):
            if await repository.get(remote['id']) is None:
                try:
                    await repository.prepare(remote['id'],{'scope':'schedule',**remote['payload']})
                except AppointmentConflict:
                    await call_change('scheduling','POST',f"/api/v1/scheduling/internal/changes/{remote['id']}/abort")
    except (ChangeUnavailable,ChangeRejected):
        log.warning('Scheduling change discovery temporarily unavailable')
    for operation_id in await repository.pending():
        try:
            await process_change(repository,ChangeClients(),operation_id)
        except Exception:
            log.exception('Change %s deferred for retry',operation_id)


Repository=Annotated[ChangeRepository,Depends(get_change_repository)]
Clients=Annotated[ChangeClients,Depends(get_change_clients)]


@router.post('/admin/{appointment_id}/refund-cancel')
async def refund_cancel(appointment_id:str,repository:Repository,clients:Clients,
                        account:Annotated[dict,Depends(authenticated_account)]):
    if account['role']!='admin':
        raise HTTPException(403,'Admin role required')
    row=await repository.appointment(appointment_id)
    if row is None:
        raise HTTPException(404,'Appointment not found')
    if row['status']=='cancelled':
        return response(row)
    try:
        operation_id=row.get('change_operation_id') or str(uuid4())
        if row.get('change_operation_id'):
            operation=await repository.get(operation_id)
            if operation['payload']['scope']!='appointment' or operation['payload']['action']!='cancel':
                raise AppointmentConflict('Lịch hẹn đang được đổi ca, vui lòng chờ hoàn tất.')
        else:
            await repository.prepare(operation_id,{'scope':'appointment','action':'cancel','appointment_id':appointment_id})
        await process_change(repository,clients,operation_id)
    except AppointmentConflict as exc:
        raise HTTPException(409,str(exc)) from exc
    except ChangeUnavailable as exc:
        raise HTTPException(503,str(exc)) from exc
    return response(await repository.appointment(appointment_id))


class ShiftChange(BaseModel):
    model_config=ConfigDict(extra='forbid')
    action:Literal['cancel','transfer']
    schedule_id:int
    doctor_code:str
    branch_code:str
    date:date
    shift:int
    new_doctor_code:str|None=None
    doctor_name:str|None=None
    new_doctor_name:str|None=None


@router.post('/internal/shift-changes/{operation_id}',dependencies=[Depends(change_token)])
async def shift_change(operation_id:str,body:ShiftChange,repository:Repository,clients:Clients):
    try:
        await repository.prepare(operation_id,{'scope':'schedule',**body.model_dump(mode='json')})
    except (AppointmentConflict,AppointmentNotFound) as exc:
        raise HTTPException(409,str(exc)) from exc
    try:
        operation=await process_change(repository,clients,operation_id)
        return {'operation_id':operation_id,'state':operation['state']}
    except ChangeUnavailable as exc:
        raise HTTPException(503,str(exc)) from exc


@router.get('/internal/appointments/{appointment_id}/change',dependencies=[Depends(change_token)])
async def change_proof(appointment_id:str,operation_id:str,repository:Repository):
    try:
        return await repository.proof(appointment_id,operation_id)
    except AppointmentConflict as exc:
        raise HTTPException(409,str(exc)) from exc


@router.get('/internal/shift-impact',dependencies=[Depends(change_token)])
async def shift_impact(doctor_code:str,branch_code:str,date:date,shift:int,request:Request):
    pool=await request.app.state.database.pool()
    async with pool.acquire() as db:
        async with db.cursor() as cur:
            await cur.execute("SELECT COUNT(*) AS appointments,COALESCE(SUM(q.appointment_id IS NOT NULL),0) AS checked_in, "
                              "COALESCE(SUM(a.status='pending' OR a.change_operation_id IS NOT NULL),0) AS pending "
                              'FROM appointments a LEFT JOIN appointment_checkins q ON q.appointment_id=a.id '
                              "WHERE a.doctor_code=%s AND a.branch_code=%s AND a.duty_date=%s AND a.shift=%s "
                              "AND a.status IN ('pending','confirmed','cancel_pending')",(doctor_code,branch_code,date,shift))
            result=await cur.fetchone()
        await db.rollback()
    return result
