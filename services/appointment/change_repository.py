"""Durable Appointment-owned reservations; check-in locks the same appointment row."""
import json
from uuid import uuid4

from appointment.repository import AppointmentConflict, AppointmentNotFound


class ChangeRepository:
    def __init__(self, database):
        self.database = database

    async def appointment(self,appointment_id):
        from appointment.repository import AppointmentRepository
        return await AppointmentRepository(self.database).get(appointment_id)

    async def get(self, operation_id):
        pool = await self.database.pool()
        async with pool.acquire() as db:
            async with db.cursor() as cur:
                await cur.execute('SELECT id, payload, state, last_error FROM appointment_changes WHERE id=%s', (operation_id,))
                row = await cur.fetchone()
            await db.rollback()
        if row:
            row['payload'] = json.loads(row['payload']) if isinstance(row['payload'], str) else row['payload']
        return row

    async def prepare(self, operation_id, payload):
        pool = await self.database.pool()
        async with pool.acquire() as db:
            try:
                async with db.cursor() as cur:
                    await cur.execute('SELECT * FROM appointment_changes WHERE id=%s FOR UPDATE', (operation_id,))
                    existing=await cur.fetchone()
                    if existing:
                        await db.rollback()
                        existing['payload']=json.loads(existing['payload']) if isinstance(existing['payload'],str) else existing['payload']
                        for key in ('action','scope','schedule_id','new_doctor_code','appointment_id'):
                            if existing['payload'].get(key) != payload.get(key):
                                raise AppointmentConflict('Operation identity mismatch')
                        return existing
                    if payload['scope'] == 'appointment':
                        await cur.execute('SELECT * FROM appointments WHERE id=%s FOR UPDATE', (payload['appointment_id'],))
                    else:
                        await cur.execute("SELECT * FROM appointments WHERE doctor_code=%s AND branch_code=%s "
                                          "AND duty_date=%s AND shift=%s AND status IN ('pending','confirmed','cancel_pending') "
                                          'ORDER BY id FOR UPDATE', (payload['doctor_code'],payload['branch_code'],payload['date'],payload['shift']))
                    rows = await cur.fetchall()
                    if payload['scope'] == 'appointment' and not rows:
                        raise AppointmentNotFound('Appointment not found')
                    for row in rows:
                        if row['status'] != 'confirmed' or row.get('change_operation_id'):
                            raise AppointmentConflict('Lịch hẹn đang xử lý hoặc không còn được thay đổi.')
                        if row.get('source') != 'live':
                            raise AppointmentConflict('Lịch hẹn lịch sử chỉ được xem.')
                        await cur.execute('SELECT 1 FROM appointment_checkins WHERE appointment_id=%s', (row['id'],))
                        if await cur.fetchone():
                            raise AppointmentConflict('Không thể hoàn tiền/hủy/chuyển ca: đã có bệnh nhân check-in hoặc đã khám.')
                    payload = {**payload, 'appointment_ids':[r['id'] for r in rows]}
                    await cur.execute('INSERT INTO appointment_changes (id,payload) VALUES (%s,%s)',
                                      (operation_id,json.dumps(payload,ensure_ascii=False)))
                    for row in rows:
                        await cur.execute('UPDATE appointments SET change_operation_id=%s, status=%s WHERE id=%s',
                                          (operation_id,'cancel_pending' if payload['action']=='cancel' else 'confirmed',row['id']))
                await db.commit()
            except Exception:
                await db.rollback()
                raise
        return await self.get(operation_id)

    async def proof(self, appointment_id, operation_id):
        pool = await self.database.pool()
        async with pool.acquire() as db:
            async with db.cursor() as cur:
                await cur.execute('SELECT a.*,q.state AS queue_state FROM appointments a LEFT JOIN appointment_checkins q '
                                  'ON q.appointment_id=a.id WHERE a.id=%s',(appointment_id,))
                row = await cur.fetchone()
            await db.rollback()
        if row is None or row['queue_state'] is not None:
            raise AppointmentConflict('Bệnh nhân đã check-in hoặc đã khám, không được hoàn tiền/thay đổi lịch.')
        if operation_id == 'patient:' + appointment_id and row['status'] in ('cancel_pending','cancelled') and not row.get('change_operation_id'):
            return {'action':'cancel','allow_refund':False,'state':row['status']}
        operation = await self.get(operation_id)
        if not operation or appointment_id not in operation['payload']['appointment_ids']:
            raise AppointmentConflict('No reserved appointment change')
        if operation['state'] != 'completed' and row.get('change_operation_id') != operation_id:
            raise AppointmentConflict('Appointment change reservation was lost')
        return {**operation['payload'],'state':operation['state'],'allow_refund':True}

    async def complete(self, operation, refunds):
        pool = await self.database.pool()
        payload = operation['payload']
        async with pool.acquire() as db:
            try:
                async with db.cursor() as cur:
                    await cur.execute('SELECT state FROM appointment_changes WHERE id=%s FOR UPDATE',(operation['id'],))
                    if (await cur.fetchone())['state']=='completed':
                        await db.rollback()
                        return
                    for appointment_id in sorted(payload['appointment_ids']):
                        await cur.execute('SELECT * FROM appointments WHERE id=%s FOR UPDATE',(appointment_id,))
                        row=await cur.fetchone()
                        if row['change_operation_id'] != operation['id']:
                            raise AppointmentConflict('Appointment change reservation was lost')
                        if payload['action']=='cancel':
                            content=f"Lịch hẹn ngày {row['duty_date']}, ca {row['shift']} đã bị hủy. "
                            amount=refunds.get(appointment_id,0)
                            content += f'Đã hoàn tiền mô phỏng {amount:,} đồng.' if amount else 'Lịch chưa thanh toán, không phát sinh hoàn tiền.'
                            if payload['scope']=='schedule': content += ' Lý do: phòng khám hủy ca trực.'
                            event='cancelled'
                            await cur.execute("UPDATE appointments SET status='cancelled',change_operation_id=NULL WHERE id=%s",(appointment_id,))
                        else:
                            name=payload.get('new_doctor_name') or payload['new_doctor_code']
                            old=payload.get('doctor_name') or row['doctor_code']
                            content=f"Lịch hẹn ngày {row['duty_date']}, ca {row['shift']}: bác sĩ đã được thay đổi từ {old} sang {name}. Chi nhánh, ngày và ca giữ nguyên."
                            event='doctor_changed:'+operation['id']
                            await cur.execute('UPDATE appointments SET doctor_code=%s,change_operation_id=NULL WHERE id=%s',
                                              (payload['new_doctor_code'],appointment_id))
                        if row['patient_account_id']:
                            await cur.execute('INSERT IGNORE INTO patient_notifications '
                                '(id,appointment_id,patient_account_id,patient_id,event,content) VALUES (%s,%s,%s,%s,%s,%s)',
                                (str(uuid4()),appointment_id,row['patient_account_id'],row['patient_id'],event,content))
                    await cur.execute("UPDATE appointment_changes SET state='completed',last_error=NULL WHERE id=%s",(operation['id'],))
                await db.commit()
            except Exception:
                await db.rollback()
                raise

    async def pending(self):
        pool=await self.database.pool()
        async with pool.acquire() as db:
            async with db.cursor() as cur:
                await cur.execute("SELECT id FROM appointment_changes WHERE state='pending' ORDER BY created_at LIMIT 20")
                rows=await cur.fetchall()
            await db.rollback()
        return [r['id'] for r in rows]

    async def error(self, operation_id, error):
        pool=await self.database.pool()
        async with pool.acquire() as db:
            async with db.cursor() as cur:
                await cur.execute('UPDATE appointment_changes SET last_error=%s WHERE id=%s',(str(error)[:500],operation_id))
            await db.commit()
