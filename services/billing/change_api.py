from typing import Literal
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from billing.repository import InvoiceRepository, InvoiceConflict
from common.change_http import call_change, change_token, ChangeRejected, ChangeUnavailable

router=APIRouter(prefix='/api/v1/billing/internal/appointments',tags=['Reserved appointment changes'])

class ChangeCommand(BaseModel):
    operation_id:str
    action:Literal['cancel','transfer']

@router.post('/{appointment_id}/change',dependencies=[Depends(change_token)])
async def change(appointment_id:str,body:ChangeCommand,request:Request):
    try:
        proof=await call_change('appointment','GET',f'/api/v1/appointments/internal/appointments/{appointment_id}/change?operation_id={body.operation_id}')
        if proof['action']!=body.action:
            raise ChangeRejected('Operation action mismatch')
        return await InvoiceRepository(request.app.state.database).settle_change(appointment_id,body.operation_id,proof)
    except (ChangeRejected,InvoiceConflict) as exc:
        raise HTTPException(409,str(exc)) from exc
    except ChangeUnavailable as exc:
        raise HTTPException(503,str(exc)) from exc
