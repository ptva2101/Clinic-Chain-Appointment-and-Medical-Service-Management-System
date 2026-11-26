from fastapi import APIRouter, Depends, HTTPException, Request
from common.change_http import change_token
from scheduling.change_repository import ScheduleChanges
from scheduling.repository import ScheduleConflict
import json

router=APIRouter(prefix='/api/v1/scheduling/internal/changes',tags=['Shift change coordination'])

@router.post('/{operation_id}/finish',dependencies=[Depends(change_token)])
async def finish(operation_id:str,request:Request):
    try:
        row=await ScheduleChanges(request.app.state.database).finish(operation_id)
        return {'schedule_id':row['id'],'status':row['status']}
    except ScheduleConflict as exc:
        raise HTTPException(409,str(exc)) from exc

@router.post('/{operation_id}/abort',dependencies=[Depends(change_token)])
async def abort(operation_id:str,request:Request):
    try:
        row=await ScheduleChanges(request.app.state.database).finish(operation_id,abort=True)
        return {'schedule_id':row['id'],'status':row['status']}
    except ScheduleConflict as exc:
        raise HTTPException(409,str(exc)) from exc

@router.get('/pending',dependencies=[Depends(change_token)])
async def pending(request:Request):
    pool=await request.app.state.database.pool()
    async with pool.acquire() as db:
        async with db.cursor() as cur:
            await cur.execute("SELECT id,payload FROM schedule_changes WHERE state='pending' ORDER BY created_at LIMIT 20")
            rows=await cur.fetchall()
        await db.rollback()
    return [{**r,'payload':json.loads(r['payload']) if isinstance(r['payload'],str) else r['payload']} for r in rows]
