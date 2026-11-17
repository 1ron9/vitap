from datetime import datetime, timedelta, timezone, date
from uuid import UUID, uuid4
from decimal import Decimal
import pytest
from app.core.security import create_access_token
from app.modules.auth.models import User, UserProfile, UserConsent
from app.modules.auth.router import Principal
from app.modules.health.models import UserHealthSettings, HealthEntries, HealthObservations, Allergies
from app.modules.health.policy import PersonalHealthContext
from app.modules.health.repositories import HealthRepository
from app.modules.health.services import HealthService
from app.modules.health import schemas as s
from app.modules.medication.models import Drugs, Prescriptions, PrescriptionItems

ROOT = '/api/v1/health'


@pytest.fixture
def users(db_session):
    result = []
    for _ in range(2):
        user = User(id=uuid4(), email=f'{uuid4()}@example.test', password_hash='unused', role='USER', status='ACTIVE')
        db_session.add(user); db_session.flush()
        db_session.add_all([UserProfile(user_id=user.id), UserHealthSettings(user_id=user.id),
            UserConsent(user_id=user.id, consent_version='health-ai-v1', scope='HEALTH_DATA_AND_AI_PROCESSING', is_accepted=True)])
        result.append((user, {'Authorization': 'Bearer ' + create_access_token({'sub': str(user.id)})}))
    db_session.commit()
    return result


def post(client, path, body, headers):
    res = client.post(ROOT + path, json=body, headers=headers)
    assert res.status_code == 201, res.text
    return res.json()


def entry(client, headers, observations=None, **header):
    return post(client, '/entries', {'title': 'Đo tại nhà', 'observations': observations or [], **header}, headers)


def test_profile_preferences_and_declaration(client, users):
    h = users[0][1]
    before = client.get(ROOT+'/profile', headers=h).json()
    assert before['phone'] is None and 'user_id' not in before
    data = client.patch(ROOT+'/profile', headers=h, json={'height_cm': 172.25, 'phone': '0123', 'date_of_birth': '2000-01-01'}).json()
    assert data['height_cm'] == 172.25 and data['phone'] == '0123'
    assert client.patch(ROOT+'/profile', headers=h, json={'height_cm': None}).json()['height_cm'] is None
    for body in ({'role':'ADMIN'}, {'height_cm':-1}, {'height_cm':12.123}, {'date_of_birth':'2999-01-01'}, {}):
        assert client.patch(ROOT+'/profile', headers=h, json=body).status_code == 422
    assert client.get(ROOT+'/allergy-declaration', headers=h).json()['state'] == 'UNKNOWN'
    assert client.put(ROOT+'/allergy-declaration', headers=h, json={'state':'NO_KNOWN_ALLERGIES'}).json()['confirmed_at']
    prefs = client.patch(ROOT+'/preferences', headers=h, json={'allow_ai_health_context':False}).json()
    assert prefs['allow_ai_health_context'] is False
    assert client.patch(ROOT+'/preferences', headers=h, json={'enable_allergy_alerts':None}).status_code == 422


def test_conditions_and_allergy_roundtrip_and_ownership(client, users):
    a,b = users[0][1], users[1][1]
    condition = post(client, '/conditions', {'condition_name':' Hen ', 'description':'Tự khai'}, a)
    assert condition['condition_name']=='Hen' and condition['verified'] is False
    assert client.patch(ROOT+'/conditions/'+condition['id'],headers=a,json={'condition_name':None}).status_code==422
    assert client.patch(ROOT+'/conditions/'+condition['id'],headers=a,json={'status':'CHRONIC'}).json()['status']=='CHRONIC'
    assert client.get(ROOT+'/conditions?status=RESOLVED',headers=a).json()['pagination']['total']==0
    allergy = post(client, '/allergies', {'allergen_name':'Peanut','allergen_type':'FOOD','reaction':'Phát ban','severity':'MILD'}, a)
    assert client.get(ROOT+'/allergy-declaration',headers=a).json()['state']=='HAS_ALLERGIES'
    assert client.put(ROOT+'/allergy-declaration',headers=a,json={'state':'NO_KNOWN_ALLERGIES'}).status_code==409
    assert client.get(ROOT+'/allergies/'+allergy['id'],headers=a).json()['reaction']=='Phát ban'
    for kind,obj in [('conditions',condition),('allergies',allergy)]:
        path=ROOT+'/'+kind+'/'+obj['id']
        assert client.get(path,headers=b).status_code==404
        assert client.patch(path,headers=b,json={'description':'x'} if kind=='conditions' else {'reaction':'x'}).status_code==404
        assert client.delete(path,headers=b).status_code==404
        assert client.delete(path,headers=a).status_code==204
    assert client.get(ROOT+'/allergy-declaration',headers=a).json()['state']=='UNKNOWN'


def test_glucose_atomic_rollback_ids_and_empty_entry(client, users, db_session):
    h = users[0][1]
    obj = entry(client,h,[{'observation_type':'GLUCOSE','value':100,'unit':'mg/dL'}, {'observation_type':'BLOOD_PRESSURE','value':120,'secondary_value':80}])
    gly = next(x for x in obj['observations'] if x['observation_type']=='GLUCOSE')
    bp = next(x for x in obj['observations'] if x['observation_type']=='BLOOD_PRESSURE')
    assert gly['value']==5.5556 and gly['entered_value']==100 and gly['unit']=='mmol/L'
    path=ROOT+'/entries/'+obj['id']
    failed=client.patch(path+'/aggregate',headers=h,json={'entry':{'title':'Should rollback'},'observations':{'update':[{'id':bp['id'],'secondary_value':None}]}})
    assert failed.status_code==422, failed.text
    assert client.get(path,headers=h).json()['title']=='Đo tại nhà'
    updated=client.patch(path+'/aggregate',headers=h,json={'entry':{'title':'Changed'},'observations':{'update':[{'id':gly['id'],'value':90,'unit':'mg/dL'}],'delete':[bp['id']],'create':[{'observation_type':'HEART_RATE','value':70}]}})
    assert updated.status_code==200, updated.text
    saved=next(x for x in updated.json()['observations'] if x['id']==gly['id'])
    assert saved['value']==5 and saved['entered_value']==90
    assert client.delete(path,headers=h).status_code==204
    assert db_session.query(HealthObservations).filter_by(entry_id=UUID(obj['id'])).count()==0
    assert client.get(path,headers=h).status_code==404
    single=post(client,'/entries',{'observations':[{'observation_type':'WEIGHT','value':60}]},h)
    p=ROOT+'/entries/'+single['id']
    rid=single['observations'][0]['id']
    assert client.delete(p+'/observations/'+rid,headers=h).status_code==409
    replacement=client.patch(p+'/aggregate',headers=h,json={'observations':{'delete':[rid],'create':[{'observation_type':'WEIGHT','value':61}]}})
    assert replacement.status_code==200


@pytest.mark.parametrize('reading',[
    {'observation_type':'BLOOD_PRESSURE','value':120},
    {'observation_type':'HEART_RATE','value':0},
    {'observation_type':'WEIGHT','value':12.12345},
    {'observation_type':'HEART_RATE','value':60,'unit':'kg'},
    {'observation_type':'GLUCOSE','value':5,'unit':'other'},
    {'observation_type':'WEIGHT','value':60,'measured_at':'2999-01-01T00:00:00Z'},
    {'observation_type':'BODY_TEMPERATURE','value':37},
])
def test_invalid_reading_rolls_back_parent(client,users,db_session,reading):
    res=client.post(ROOT+'/entries',headers=users[0][1],json={'observations':[{'observation_type':'HEART_RATE','value':60},reading]})
    assert res.status_code==422,res.text
    assert db_session.query(HealthEntries).count()==0


def test_nested_ids_and_pagination_filter(client,users):
    a,b=users[0][1],users[1][1]
    first=entry(client,a,[{'observation_type':'HEART_RATE','value':60}])
    second=entry(client,a,[{'observation_type':'WEIGHT','value':60}])
    rid=first['observations'][0]['id']
    assert client.patch(ROOT+f"/entries/{second['id']}/observations/{rid}",headers=a,json={'value':70}).status_code==404
    assert client.get(ROOT+f"/entries/{first['id']}",headers=b).status_code==404
    assert client.get(ROOT+'/entries?observation_type=WEIGHT&page_size=1',headers=a).json()['pagination']['total']==1
    assert client.get(ROOT+'/entries?page_size=101',headers=a).status_code==422
    assert client.get(ROOT+'/entries?from=2026-01-01T00:00:00Z&to=2025-01-01T00:00:00Z',headers=a).status_code==422
    assert client.get(ROOT+'/entries',headers=b).json()['items']==[]


def test_courses_options_sources_and_transitions(client,users,db_session):
    a,b=users[0][1],users[1][1]
    drug=Drugs(brand_name='Demo product',strength='5 mg')
    db_session.add(drug);db_session.commit()
    assert client.get(ROOT+'/medication-course-options?q=Demo',headers=a).json()['items'][0]['drug_id']==str(drug.id)
    body={'drug_id':str(drug.id),'start_date':'2026-01-01','dosage':'Theo đơn'}
    course=post(client,'/medication-courses',body,a)
    assert course['status']=='ACTIVE'
    path=ROOT+'/medication-courses/'+course['id']
    assert client.patch(path,headers=b,json={'status':'STOPPED','end_date':'2026-01-02'}).status_code==404
    assert client.patch(path,headers=a,json={'status':'STOPPED','end_date':'2025-01-01'}).status_code==422
    end={'status':'COMPLETED','end_date':'2026-01-02'}
    assert client.patch(path,headers=a,json=end).status_code==200
    assert client.patch(path,headers=a,json=end).status_code==200
    assert client.patch(path,headers=a,json={**end,'status':'STOPPED'}).status_code==409
    assert client.get(ROOT+'/medication-courses?status=ACTIVE',headers=a).json()['items']==[]


def test_context_permission_and_service_authorization(client,users,db_session):
    user,h=users[0]
    principal=Principal('USER',user.id)
    policy=PersonalHealthContext(db_session)
    assert policy.get_context(principal,['profile'],'GENERAL')['sections']=={}
    assert policy.get_context(principal,['profile'],'PERSONAL')['available'] is True
    client.patch(ROOT+'/preferences',headers=h,json={'allow_ai_health_context':False,'enable_allergy_alerts':False})
    assert policy.get_context(principal,['profile'],'PERSONAL')['sections']=={}
    assert policy.allergy_alerts_allowed(principal) is False
    client.patch(ROOT+'/preferences',headers=h,json={'allow_ai_health_context':True})
    consent=db_session.query(UserConsent).filter_by(user_id=user.id).one()
    consent.revoked_at=datetime.now(timezone.utc);db_session.commit()
    assert client.get(ROOT+'/preferences',headers=h).json()['ai_context_available'] is False
    assert policy.get_context(principal,['profile'],'PERSONAL')['sections']=={}
    from app.modules.auth.router import AuthError
    with pytest.raises(AuthError): HealthRepository(db_session,Principal('GUEST',uuid4()))


def test_course_item_source_checks_and_detaches(client,users,db_session):
    owner,a=users[0];other,b=users[1]
    drug=Drugs(brand_name='Synthetic source');db_session.add(drug);db_session.flush()
    rx=Prescriptions(user_id=owner.id,is_guest=False,source_type='MANUAL_ENTRY',status='CONFIRMED')
    db_session.add(rx);db_session.flush()
    item=PrescriptionItems(prescription_id=rx.id,drug_id=drug.id,extracted_name='Synthetic source',resolution_status='MATCHED',verification_status='VERIFIED_BY_USER',source_type='MANUAL_ENTRY')
    db_session.add(item);db_session.commit()
    assert client.get(ROOT+'/medication-course-options/prescription-items',headers=b).json()['items']==[]
    body={'prescription_item_id':str(item.id),'start_date':'2020-01-01'}
    assert client.post(ROOT+'/medication-courses',headers=b,json=body).status_code==404
    rx.status='PENDING_REVIEW';db_session.commit()
    assert client.post(ROOT+'/medication-courses',headers=a,json=body).status_code==409
    rx.status='CONFIRMED';db_session.commit()
    course=post(client,'/medication-courses',body,a)
    assert course['status']=='ACTIVE'
    db_session.delete(item);db_session.commit()
    saved=client.get(ROOT+'/medication-courses',headers=a).json()['items'][0]
    assert saved['prescription_item_id'] is None and saved['drug_id']==str(drug.id)


@pytest.mark.parametrize('path',['/profile','/preferences','/allergy-declaration','/conditions','/allergies','/entries','/medication-courses','/medication-course-options'])
def test_m1_guest_and_public_denied(client,path):
    assert client.get(ROOT+path).status_code==401
    guest=client.post('/api/v1/guest-sessions',json={'consent_accepted':True,'consent_version':'guest-processing-v1'}).json()
    assert client.get(ROOT+path,headers={'X-Guest-Token':guest['guest_token']}).status_code==403
