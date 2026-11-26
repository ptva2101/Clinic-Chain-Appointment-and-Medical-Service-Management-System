"""Apply an Appointment-reserved change to future treatment sessions only."""
from typing import Literal
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from common.change_http import call_change, change_token, ChangeRejected, ChangeUnavailable

router=APIRouter(prefix='/api/v1/clinical/internal/appointments',tags=['Treatment appointment changes'])

class Command(BaseModel):
    operation_id:str
    action:Literal['cancel','transfer']

@router.post('/{appointment_id}/change',dependencies=[Depends(change_token)])
async def change(appointment_id:str,body:Command,request:Request):
    try:
        proof=await call_change('appointment','GET',f'/api/v1/appointments/internal/appointments/{appointment_id}/change?operation_id={body.operation_id}')
        if proof['action']!=body.action: raise ChangeRejected('Operation action mismatch')
    except ChangeRejected as exc:
        raise HTTPException(409,str(exc)) from exc
    except ChangeUnavailable as exc:
        raise HTTPException(503,str(exc)) from exc
    pool=await request.app.state.database.pool()
    async with pool.acquire() as db:
        try:
            async with db.cursor() as cur:
                await cur.execute('SELECT id,status FROM treatment_sessions WHERE appointment_id=%s FOR UPDATE',(appointment_id,))
                row=await cur.fetchone()
                if row and row['status']=='completed':
                    raise HTTPException(409,'Buổi điều trị đã hoàn tất, không được hoàn tiền/chuyển ca.')
                if row and row['status']!='cancelled':
                    if body.action=='cancel':
                        await cur.execute("UPDATE treatment_sessions SET status='cancelled' WHERE id=%s",(row['id'],))
                    else:
                        await cur.execute('UPDATE treatment_sessions SET doctor_code=%s WHERE id=%s',(proof['new_doctor_code'],row['id']))
            await db.commit()
        except Exception:
            await db.rollback()
            raise
    return {'updated':bool(row)}
