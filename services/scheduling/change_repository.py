"""Scheduling-owned shift freeze and replacement-doctor reservation."""
import json
from uuid import uuid4

import aiomysql
from scheduling.repository import ScheduleConflict


class ScheduleChanges:
    def __init__(self,database):
        self.database=database

    async def get(self,operation_id):
        pool=await self.database.pool()
        async with pool.acquire() as db:
            async with db.cursor() as cur:
                await cur.execute('SELECT * FROM schedule_changes WHERE id=%s',(operation_id,))
                row=await cur.fetchone()
            await db.rollback()
        if row: row['payload']=json.loads(row['payload']) if isinstance(row['payload'],str) else row['payload']
        return row

    async def prepare(self,schedule_id,action,new_doctor_code=None,names=None):
        pool=await self.database.pool()
        async with pool.acquire() as db:
            try:
                async with db.cursor() as cur:
                    await cur.execute('SELECT * FROM doctor_schedules WHERE id=%s FOR UPDATE',(schedule_id,))
                    row=await cur.fetchone()
                    if row is None: raise ScheduleConflict('Doctor schedule not found')
                    await cur.execute("SELECT * FROM schedule_changes WHERE schedule_id=%s ORDER BY created_at DESC LIMIT 1",(schedule_id,))
                    existing=await cur.fetchone()
                    if existing:
                        payload=json.loads(existing['payload']) if isinstance(existing['payload'],str) else existing['payload']
                        if existing['state']=='pending':
                            if payload['action']!=action or payload.get('new_doctor_code')!=new_doctor_code:
                                raise ScheduleConflict('Ca trực đang được xử lý, hãy tiếp tục thao tác trước đó.')
                            await db.rollback()
                            return {**existing,'payload':payload}
                        if payload['action']==action and payload.get('new_doctor_code')==new_doctor_code and (
                            action=='cancel' and row['status']=='cancelled' or action=='transfer' and row['doctor_code']==new_doctor_code):
                            await db.rollback()
                            return {**existing,'payload':payload}
                    if row['status']!='active': raise ScheduleConflict('Ca trực không còn hoạt động.')
                    await cur.execute("SELECT 1 FROM slot_holds WHERE doctor_code=%s AND branch_code=%s AND duty_date=%s AND shift=%s "
                                      "AND state='held' AND expires_at>UTC_TIMESTAMP(6) LIMIT 1 FOR UPDATE",
                                      (row['doctor_code'],row['branch_code'],row['duty_date'],row['shift']))
                    if await cur.fetchone(): raise ScheduleConflict('Ca có chỗ đang được giữ tạm. Vui lòng thử lại sau khi yêu cầu đặt lịch hoàn tất.')
                    reservation=None
                    if action=='transfer':
                        if new_doctor_code==row['doctor_code']: raise ScheduleConflict('Bác sĩ mới phải khác bác sĩ hiện tại.')
                        # Reserve a real unique doctor/date/shift key while the original row remains frozen.
                        await cur.execute("INSERT INTO doctor_schedules (doctor_code,branch_code,duty_date,shift,status,source) "
                                          "VALUES (%s,%s,%s,%s,'reserved','change_reservation')",
                                          (new_doctor_code,row['branch_code'],row['duty_date'],row['shift']))
                        reservation=cur.lastrowid
                    operation_id=str(uuid4())
                    payload={'action':action,'schedule_id':schedule_id,'doctor_code':row['doctor_code'],
                             'branch_code':row['branch_code'],'date':row['duty_date'].isoformat(),'shift':row['shift'],
                             'new_doctor_code':new_doctor_code,**(names or {})}
                    await cur.execute('INSERT INTO schedule_changes (id,schedule_id,payload,reservation_id) VALUES (%s,%s,%s,%s)',
                                      (operation_id,schedule_id,json.dumps(payload,ensure_ascii=False),reservation))
                    await cur.execute("UPDATE doctor_schedules SET status='changing' WHERE id=%s",(schedule_id,))
                await db.commit()
            except aiomysql.IntegrityError as exc:
                await db.rollback()
                raise ScheduleConflict('Bác sĩ thay thế đã có ca khác cùng ngày/giờ.') from exc
            except Exception:
                await db.rollback()
                raise
        return await self.get(operation_id)

    async def finish(self,operation_id,abort=False):
        pool=await self.database.pool()
        async with pool.acquire() as db:
            try:
                async with db.cursor() as cur:
                    await cur.execute('SELECT * FROM schedule_changes WHERE id=%s FOR UPDATE',(operation_id,))
                    op=await cur.fetchone()
                    if op is None: raise ScheduleConflict('Shift change not found')
                    payload=json.loads(op['payload']) if isinstance(op['payload'],str) else op['payload']
                    await cur.execute('SELECT * FROM doctor_schedules WHERE id=%s FOR UPDATE',(op['schedule_id'],))
                    row=await cur.fetchone()
                    if op['state']!='pending':
                        await db.rollback()
                        return row
                    if op['reservation_id']:
                        await cur.execute("DELETE FROM doctor_schedules WHERE id=%s AND status='reserved'",(op['reservation_id'],))
                    if abort:
                        await cur.execute("UPDATE doctor_schedules SET status='active' WHERE id=%s",(op['schedule_id'],))
                    elif payload['action']=='cancel':
                        await cur.execute("SELECT 1 FROM slot_holds WHERE doctor_code=%s AND branch_code=%s AND duty_date=%s AND shift=%s "
                                          "AND (state='confirmed' OR state='held' AND expires_at>UTC_TIMESTAMP(6)) LIMIT 1",
                                          (payload['doctor_code'],payload['branch_code'],payload['date'],payload['shift']))
                        if await cur.fetchone(): raise ScheduleConflict('Ca vẫn còn lịch chưa được hủy xong.')
                        await cur.execute("UPDATE doctor_schedules SET status='cancelled' WHERE id=%s",(op['schedule_id'],))
                    else:
                        await cur.execute("UPDATE slot_holds SET doctor_code=%s WHERE doctor_code=%s AND branch_code=%s "
                                          "AND duty_date=%s AND shift=%s AND state='confirmed'",
                                          (payload['new_doctor_code'],payload['doctor_code'],payload['branch_code'],payload['date'],payload['shift']))
                        await cur.execute("UPDATE doctor_schedules SET status='active',doctor_code=%s WHERE id=%s",
                                          (payload['new_doctor_code'],op['schedule_id']))
                    await cur.execute('UPDATE schedule_changes SET state=%s WHERE id=%s',('aborted' if abort else 'completed',operation_id))
                    await cur.execute('SELECT * FROM doctor_schedules WHERE id=%s',(op['schedule_id'],))
                    result=await cur.fetchone()
                await db.commit()
                return result
            except Exception:
                await db.rollback()
                raise
