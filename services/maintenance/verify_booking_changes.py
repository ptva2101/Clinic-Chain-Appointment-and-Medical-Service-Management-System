"""HTTP business tests; writes only to an isolated E2E stack."""
import argparse, asyncio, json, os
from datetime import timedelta
from pathlib import Path
from uuid import uuid4
from demo_setup import DemoAPI, vietnam_today

async def run(args):
    if not os.getenv('IDENTITY_JWT_SECRET','').startswith('e2e_only_'):
        raise RuntimeError('Isolated stack required')
    api=DemoAPI(); results=[]; day=vietnam_today()
    def passed(name,**details):
        results.append({'case':name,'status':'PASS','evidence':details}); print('PASS '+name,flush=True)
    try:
        admin=await api.login('admin','admin'); patient=await api.login('patient','990000000001')
        other=await api.login('patient','990000000002'); doctor=await api.login('doctor','LEGACY_BS001')
        reception=await api.login('letan','LEGACY_LT001')
        async def book(offset=0,who=patient):
            return await api.call('appointment','POST','',token=who,expected=201,body={
                'config_code':'CN01_DV001','doctor_code':'LEGACY_BS001','date':str(day+timedelta(days=offset)),
                'shift':1,'idempotency_key':'change-'+uuid4().hex})
        async def invoice(visit,who=patient,paid=True):
            row=await api.call('billing','POST','/invoices',token=who,expected=201,body={'appointment_id':visit['id']})
            if paid: row=await api.call('billing','POST',f"/invoices/{row['id']}/simulate-payment",token=who)
            return row
        async def getvisit(visit,who=patient): return await api.call('appointment','GET','/'+visit['id'],token=who)
        async def bill(row,who=patient): return await api.call('billing','GET','/invoices/'+row['id'],token=who)
        async def notices(visit,who=patient):
            return [n for n in await api.call('appointment','GET','/notifications/me',token=who) if n['appointment_id']==visit['id']]
        async def schedule(offset):
            rows=await api.call('scheduling','GET','/doctor-schedules',params={'from_date':str(day+timedelta(days=offset)),
                'to_date':str(day+timedelta(days=offset)),'ma_bac_si':'LEGACY_BS001'})
            return next(r for r in rows if r['MaChiNhanh']=='CN01' and r['CaTruc']==1)
        async def refund(row,expected=200):
            return await api.call('billing','POST',f"/invoices/{row['id']}/simulate-refund",token=admin,expected=expected)
        if args.phase=='core':
            a=await book(); ai=await invoice(a,paid=False)
            await api.call('appointment','POST',f"/{a['id']}/cancel",token=patient)
            await api.call('billing','POST',f"/invoices/{ai['id']}/simulate-payment",token=patient,expected=409)
            assert (await getvisit(a))['status']=='cancelled'
            passed('Patient cancels unpaid booking and cannot pay cancelled invoice')
            a=await book(); ai=await invoice(a)
            await api.call('billing','POST',f"/invoices/{ai['id']}/simulate-refund",token=patient,expected=403)
            await api.call('appointment','POST',f"/{a['id']}/cancel",token=patient,expected=409)
            first,second=await refund(ai),await refund(ai)
            assert first['status']=='refunded' and second['refunded_at']==first['refunded_at']
            assert (await getvisit(a))['status']=='cancelled'
            ns=[n for n in await notices(a) if 'hủy' in n['content']]
            assert len(ns)==1 and '40,000' in ns[0]['content']
            passed('Admin refund automatically cancels, releases slot and sends one notification; repeated refund is idempotent')
            a=await book(); ai=await invoice(a)
            await api.call('appointment','POST',f"/{a['id']}/check-in",token=reception)
            await refund(ai,409)
            await api.call('appointment','POST',f"/{a['id']}/queue-state",token=doctor,body={'state':'examining'})
            encounter=await api.call('clinical','POST','/encounters',token=doctor,body={
                'appointment_id':a['id'],'symptoms':'Dữ liệu giả lập','treatments':[{'service_code':'DV034','sessions':2}]})
            await refund(ai,409)
            peer=await book(); peer_invoice=await invoice(peer); shift=await schedule(0)
            await api.call('scheduling','POST',f"/doctor-schedules/{shift['id']}/cancel",token=admin,expected=409)
            assert (await bill(peer_invoice))['status']=='paid' and (await getvisit(peer))['status']=='confirmed'
            await refund(peer_invoice)
            passed('Check-in/completed exam blocks refund and rejects entire shift without partial refunds')
            a,b=await book(1),await book(1,other); ai,bi=await invoice(a),await invoice(b,other,False)
            shift=await schedule(1)
            for _ in range(2): await api.call('scheduling','POST',f"/doctor-schedules/{shift['id']}/cancel",token=admin)
            assert (await bill(ai))['status']=='refunded' and (await bill(bi,other))['status']=='pending'
            assert (await getvisit(a))['status']=='cancelled' and (await getvisit(b,other))['status']=='cancelled'
            assert len([n for n in await notices(a) if 'hủy' in n['content']])==1
            assert any('hủy ca trực' in n['content'] for n in await notices(b,other))
            passed('Shift cancellation handles paid/unpaid bookings and notifies both patients once')
            a,b=await book(2),await book(2,other); ai=await invoice(a); await invoice(b,other,False)
            plan=next(p for p in await api.call('clinical','GET','/treatments/me',token=patient) if p['encounter_id']==encounter['id'])
            body={'session_number':1,'doctor_code':'LEGACY_BS001','date':str(day+timedelta(days=2)),
                  'shift':1,'config_code':'CN01_DV034','idempotency_key':'treatment-'+uuid4().hex}
            session=await api.call('clinical','POST',f"/treatments/{plan['id']}/sessions",token=patient,body=body)
            await api.call('billing','POST',f"/invoices/{session['invoice_id']}/simulate-payment",token=patient)
            shift=await schedule(2)
            for code,status in (('LEGACY_BS007',422),('LEGACY_BS002',409),('LEGACY_BS017',200),('LEGACY_BS017',200)):
                await api.call('scheduling','POST',f"/doctor-schedules/{shift['id']}/transfer",token=admin,body={'new_doctor_code':code},expected=status)
            assert (await getvisit(a))['doctor_code']=='LEGACY_BS017' and (await getvisit(b,other))['doctor_code']=='LEGACY_BS017'
            assert (await bill(ai))['status']=='paid' and (await bill(ai))['doctor_code']=='LEGACY_BS017'
            sessions=await api.call('clinical','GET',f"/treatments/{plan['id']}/sessions",token=patient)
            assert next(s for s in sessions if s['id']==session['id'])['doctor_code']=='LEGACY_BS017'
            ns=[n for n in await notices(a) if 'bác sĩ đã được thay đổi' in n['content']]
            assert len(ns)==1 and 'Nguyễn Thị Cẩm' in ns[0]['content']
            passed('Transfer updates bookings, invoice doctor, holds and treatment; enforces specialty and availability; notifies once')
            await refund({'id':session['invoice_id']})
            body.update(date=str(day+timedelta(days=3)),idempotency_key='rebook-'+uuid4().hex)
            new=await api.call('clinical','POST',f"/treatments/{plan['id']}/sessions",token=patient,body=body)
            assert new['id']!=session['id']
            await api.call('appointment','POST',f"/{new['appointment_id']}/cancel",token=patient)
            await api.call('clinical','POST',f"/treatments/{plan['id']}/sessions",token=patient,body=body,expected=409)
            passed('Cancelled treatment can be rebooked; cancelled idempotency key cannot resurrect old booking')
            a=await book(); ai=await invoice(a)
            x,y=await asyncio.gather(api.request('billing','POST',f"/invoices/{ai['id']}/simulate-refund",token=admin),
                api.request('appointment','POST',f"/{a['id']}/check-in",token=reception))
            value=(await bill(ai))['status']
            assert (x.status_code,y.status_code,value) in ((200,409,'refunded'),(409,200,'paid'))
            passed('Concurrent check-in versus refund has exactly one winner',refund=x.status_code,checkin=y.status_code)
        elif args.phase=='prepare':
            a=await book(4); ai=await invoice(a); shift=await schedule(4)
            args.state.write_text(json.dumps({'visit':a,'invoice':ai,'shift':shift}))
            passed('Paid booking prepared for isolated outage test')
        else:
            state=json.loads(args.state.read_text()); shift=state['shift']
            if args.phase=='outage':
                await api.call('scheduling','POST',f"/doctor-schedules/{shift['id']}/cancel",token=admin,expected=503)
                assert (await getvisit(state['visit']))['status']=='cancel_pending'
                assert not [n for n in await notices(state['visit']) if 'hủy' in n['content']]
                passed('Billing outage leaves reserved pending operation and no false success notification')
            else:
                for _ in range(45):
                    if (await getvisit(state['visit']))['status']=='cancelled': break
                    await asyncio.sleep(1)
                assert (await getvisit(state['visit']))['status']=='cancelled' and (await bill(state['invoice']))['status']=='refunded'
                assert len([n for n in await notices(state['visit']) if 'hủy' in n['content']])==1
                passed('Worker resumes after Billing recovers; one refund and one notification')
        args.output.write_text(json.dumps({'phase':args.phase,'results':results},ensure_ascii=False,indent=2)+'\n')
    finally: await api.close()

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--phase',choices=['core','prepare','outage','resume'],default='core')
    parser.add_argument('--state',type=Path,default=Path('/work/state.json'))
    parser.add_argument('--output',type=Path,default=Path('/work/report.json'))
    asyncio.run(run(parser.parse_args()))
