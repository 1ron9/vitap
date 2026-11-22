from uuid import uuid4
import pytest

ID='00000000-0000-4000-8000-000000000001'
@pytest.mark.parametrize('method,path,body',[
    ('PATCH','/profile',{'full_name':'Synthetic'}),
    ('PATCH','/preferences',{'allow_ai_health_context':False}),
    ('PUT','/allergy-declaration',{'state':'NO_KNOWN_ALLERGIES'}),
    ('POST','/conditions',{'condition_name':'Synthetic'}),
    ('GET',f'/conditions/{ID}',None),
    ('PATCH',f'/conditions/{ID}',{'status':'ACTIVE'}),
    ('DELETE',f'/conditions/{ID}',None),
    ('POST','/allergies',{'allergen_name':'Synthetic','allergen_type':'OTHER'}),
    ('GET',f'/allergies/{ID}',None),
    ('PATCH',f'/allergies/{ID}',{'reaction':'Synthetic'}),
    ('DELETE',f'/allergies/{ID}',None),
    ('POST','/entries',{'title':'Synthetic'}),
    ('GET',f'/entries/{ID}',None),
    ('PATCH',f'/entries/{ID}',{'title':'Synthetic'}),
    ('DELETE',f'/entries/{ID}',None),
    ('PATCH',f'/entries/{ID}/aggregate',{'entry':{'title':'Synthetic'}}),
    ('POST',f'/entries/{ID}/observations',{'observation_type':'HEART_RATE','value':60}),
    ('PATCH',f'/entries/{ID}/observations/{ID}',{'value':61}),
    ('DELETE',f'/entries/{ID}/observations/{ID}',None),
    ('GET','/observations?observation_type=HEART_RATE&from=2020-01-01T00:00:00Z&to=2020-01-02T00:00:00Z',None),
    ('POST',f'/entries/{ID}/symptoms',{'symptom_name':'Synthetic'}),
    ('PATCH',f'/entries/{ID}/symptoms/{ID}',{'severity':4}),
    ('DELETE',f'/entries/{ID}/symptoms/{ID}',None),
    ('POST','/medication-courses',{'drug_id':ID,'start_date':'2020-01-01'}),
    ('PATCH',f'/medication-courses/{ID}',{'status':'STOPPED','end_date':'2020-01-02'}),
    ('GET','/medication-course-options/prescription-items',None),
])
def test_every_m1_operation_requires_user_before_resource_access(client,method,path,body):
    url='/api/v1/health'+path
    assert client.request(method,url,json=body).status_code==401
    guest=client.post('/api/v1/guest-sessions',json={'consent_accepted':True,'consent_version':'guest-processing-v1'}).json()
    result=client.request(method,url,json=body,headers={'X-Guest-Token':guest['guest_token']})
    assert result.status_code==403,result.text
    assert result.json()['error']['code']=='LOGIN_REQUIRED'
