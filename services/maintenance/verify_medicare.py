"""Read-only shared-stack audit; optional business exercise is restricted to isolated E2E secrets."""
import argparse
import asyncio
from collections import Counter
import json
import os
from pathlib import Path
from uuid import uuid4

from demo_setup import DemoAPI, medicare_schedules, setup_medicare, vietnam_today
from datetime import date


async def run(args):
    if args.exercise and not os.getenv('IDENTITY_JWT_SECRET', '').startswith('e2e_only_'):
        raise RuntimeError('Business exercise is restricted to the isolated restored stack')
    api = DemoAPI()
    cases = []
    def passed(title, **evidence):
        cases.append({'case': title, 'status': 'PASS', 'evidence': evidence})
        print('PASS ' + title, flush=True)
    try:
        await api.ready()
        admin = await api.bootstrap()
        accounts = await api.call('identity', 'GET', '/accounts', token=admin, params={'limit': 100})
        assert Counter(a['role'] for a in accounts) == {'admin': 2, 'patient': 17, 'doctor': 33, 'letan': 2, 'xnv': 2}
        tokens = {}
        for account in accounts:
            if account['is_active'] and not account['registration_pending']:
                token = await api.login(account['role'], account['username'])
                tokens[account['username']] = token
                me = await api.call('identity', 'GET', '/me', token=token)
                assert me['id'] == account['id']
                if account['role'] in ('doctor','letan','xnv'):
                    staff = await api.call('registry', 'GET', '/staff/me', token=token)
                    assert staff['identity_account_id'] == account['id']
        passed('All active accounts log in with 123456 and staff link to Registry', active_accounts=len(tokens), total_accounts=len(accounts))
        for svc in ('identity','registry','scheduling','appointment','billing','clinical','laboratory'):
            base = os.getenv(f'DEMO_{svc.upper()}_URL', f'http://{svc}:8000').rstrip('/')
            assert (await api.client.get(base + '/openapi.json')).status_code == 200
        passed('All seven services publish readiness and OpenAPI')
        branches = await api.call('registry', 'GET', '/catalog/branches')
        doctors = await api.call('registry', 'GET', '/catalog/doctors')
        services = await api.call('registry', 'GET', '/catalog/services')
        configs = await api.call('registry', 'GET', '/catalog/branch-services')
        assert {b['MaChiNhanh'] for b in branches} == {'CN01','CN02'}
        assert len(doctors) == 33 and len(services) == 65 and len(configs) == 130
        assert all(x['TrangThai'] == 'active' for x in branches + services + configs)
        staff = await api.call('registry', 'GET', '/staff', token=admin,params={'limit':100})
        assert len(staff['items']) == 37
        passed('Catalogue contains only original Medicare entities', branches=2,doctors=33,services=65,configs=130,staff=37)
        schedules = await api.call('scheduling', 'GET', '/doctor-schedules', params={'from_date':'2026-11-11','to_date':'2026-12-10'})
        desired = medicare_schedules(date(2026,11,11),30)
        key = lambda r: (r['MaBacSi'],r['MaChiNhanh'],r['NgayTruc'],r['CaTruc'])
        assert len(schedules)==1920 and {key(r) for r in schedules}=={key(r) for r in desired}
        assert len({(r['MaBacSi'],r['NgayTruc'],r['CaTruc']) for r in schedules})==1920
        passed('1920 exact original-rotation assignments, with no double booking', per_branch=dict(Counter(r['MaChiNhanh'] for r in schedules)))
        for user, branch in (('LEGACY_XNV001','CN01'),('LEGACY_XNV003','CN02')):
            orders = await api.call('laboratory','GET','/orders',token=tokens[user])
            assert all(r['branch_code']==branch for r in orders)
            retired = [r for r in orders if r['technician_code'] in ('LEGACY_XNV002','LEGACY_XNV004')]
            assert all(r['technician_name_snapshot'] for r in retired)
        passed('Branch-scoped laboratory history retains original retired technician names')
        for role, username in (('doctor','demo_doctor'),('letan','demo_reception'),('xnv','demo_lab')):
            await api.call('identity','POST','/login',body={'role':role,'username':username,'password':'123456'},expected=401)
        passed('Removed staff accounts cannot log in')

        if args.exercise:
            patient = tokens['990000000001']
            doctor = tokens['LEGACY_BS001']
            reception = tokens['LEGACY_LT001']
            lab = tokens['LEGACY_XNV001']
            day = vietnam_today().isoformat()
            assert '2026-11-11' <= day <= '2026-12-10'
            config = lambda service: next(c['MaCauHinh'] for c in configs if c['MaChiNhanh']=='CN01' and c['MaDichVu']==service)
            async def book():
                return await api.call('appointment','POST','',token=patient,expected=201,body={
                    'config_code':config('DV001'),'doctor_code':'LEGACY_BS001','date':day,'shift':1,'idempotency_key':'restructure-'+uuid4().hex})
            cancelled = await book()
            assert (await api.call('appointment','POST',f"/{cancelled['id']}/cancel",token=patient))['status']=='cancelled'
            passed('Unpaid appointment cancellation works with original branch/service/doctor')
            visit = await book()
            invoice = await api.call('billing','POST','/invoices',token=patient,expected=201,body={'appointment_id':visit['id']})
            assert invoice['list_price']==200000 and invoice['amount_due']==40000
            await api.call('billing','POST',f"/invoices/{invoice['id']}/simulate-payment",token=patient)
            await api.call('appointment','POST',f"/{visit['id']}/check-in",token=tokens['LEGACY_LT002'],expected=(403,404))
            await api.call('appointment','POST',f"/{visit['id']}/check-in",token=reception)
            await api.call('appointment','POST',f"/{visit['id']}/queue-state",token=doctor,body={'state':'examining'})
            passed('Insurance snapshot, payment and branch-specific reception check-in', list_price=200000,amount_due=40000)
            body = {'appointment_id':visit['id'],'symptoms':'Dữ liệu kiểm thử giả lập, không dùng lâm sàng',
                    'advice':'Chỉ phục vụ kiểm tra ứng dụng','lab_service_codes':['DV016'],
                    'prescriptions':[],'treatments':[{'service_code':'DV034','sessions':2}],'is_draft':True}
            encounter = await api.call('clinical','POST','/encounters',token=doctor,body=body)
            orders = await api.call('laboratory','GET','/orders',token=lab)
            order = next(r for r in orders if r['encounter_id']==encounter['id'])
            await api.call('laboratory','POST',f"/orders/{order['id']}/accept",token=tokens['LEGACY_XNV003'],expected=404)
            await api.call('laboratory','POST',f"/orders/{order['id']}/accept",token=lab)
            await api.call('laboratory','POST',f"/orders/{order['id']}/result",token=lab,body={'result_text':'Kết quả giả lập đã hoàn tất.'})
            body['is_draft']=False
            assert (await api.call('clinical','POST','/encounters',token=doctor,body=body))['status']=='completed'
            history = await api.call('clinical','GET','/encounters/me',token=patient)
            assert any(r['id']==encounter['id'] for r in history)
            passed('Doctor pause, laboratory result, conclusion and patient history on original catalogue')
            plans = await api.call('clinical','GET','/treatments/me',token=patient)
            plan = next(p for p in plans if p['encounter_id']==encounter['id'])
            session = await api.call('clinical','POST',f"/treatments/{plan['id']}/sessions",token=patient,body={
                'config_code':config('DV034'),'doctor_code':'LEGACY_BS001','date':day,'shift':1,
                'session_number':1,'idempotency_key':'restructure-session-'+uuid4().hex})
            await api.call('billing','POST',f"/invoices/{session['invoice_id']}/simulate-payment",token=patient)
            await api.call('appointment','POST',f"/{session['appointment_id']}/check-in",token=reception)
            await api.call('appointment','POST',f"/{session['appointment_id']}/queue-state",token=doctor,body={'state':'examining'})
            done = await api.call('clinical','POST',f"/treatments/sessions/{session['appointment_id']}/complete",token=doctor)
            assert done['status']=='completed'
            own_plans = await api.call('clinical','GET','/treatments/doctor',token=doctor)
            assert next(p for p in own_plans if p['id']==plan['id'])['completed_sessions']==1
            passed('Treatment booking, billing, check-in, completion and doctor progress 1/2')
            for group in ('branch','doctor','service'):
                rows = await api.call('billing','GET','/reports/'+group,token=admin,params={'month':day[:7]})
                assert rows
            passed('Billing reports by branch, doctor and service')
            repeat = await setup_medicare(api, admin, date(2026,11,11),30)
            assert repeat['new_shifts']==0
            passed('Repeated setup creates no additional shifts or catalogue entities',new_shifts=0)
        report = {'date':'2026-11-12','mode':'isolated_business_exercise' if args.exercise else 'shared_read_only', 'results':cases}
        if args.output:
            args.output.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
        print(json.dumps({'status':'PASS','cases':len(cases),'mode':report['mode']}))
    finally:
        await api.close()

if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--exercise',action='store_true')
    parser.add_argument('--output',type=Path)
    asyncio.run(run(parser.parse_args()))
