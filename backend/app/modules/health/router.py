from typing import Annotated, Literal
from uuid import UUID
from fastapi import APIRouter, Depends, Query, Response
from pydantic import AwareDatetime
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.modules.auth.router import Principal, get_principal
from app.modules.health import models as m, schemas as s
from app.modules.health.services import HealthService

router = APIRouter(prefix='/api/v1/health', tags=['M1 — Sức khỏe'], responses={
    code: {'model': s.ErrorResponse, 'description': description}
    for code, description in {400:'Ambiguous principal',401:'Authentication required or expired token',
        403:'User account required or inactive',404:'Resource not found or not owned',
        409:'Invalid resource state',422:'Validation error'}.items()})


def service(db: Session = Depends(get_db), principal: Principal = Depends(get_principal)):
    return HealthService(db, principal)


Health = Annotated[HealthService, Depends(service)]
PageNumber = Annotated[int, Query(ge=1)]
PageSize = Annotated[int, Query(ge=1, le=100)]


@router.get('/profile', response_model=s.Profile)
def profile(health: Health):
    return health.profile()


@router.patch('/profile', response_model=s.Profile)
def patch_profile(payload: s.ProfilePatch, health: Health):
    return health.patch_profile(payload)


@router.get('/preferences', response_model=s.Preferences)
def preferences(health: Health):
    return health.preferences()


@router.patch('/preferences', response_model=s.Preferences)
def patch_preferences(payload: s.PreferencesPatch, health: Health):
    return health.patch_preferences(payload)


@router.get('/allergy-declaration', response_model=s.Declaration)
def declaration(health: Health):
    return health.declaration()


@router.put('/allergy-declaration', response_model=s.Declaration)
def put_declaration(payload: s.DeclarationPut, health: Health):
    return health.put_declaration(payload)


@router.get('/conditions', response_model=s.Page[s.Condition])
def conditions(health: Health, page: PageNumber = 1, page_size: PageSize = 20, status: s.ConditionStatus | None = None):
    return health.list_records(m.HealthConditions, s.Condition, page, page_size, status)


@router.post('/conditions', response_model=s.Condition, status_code=201)
def create_condition(payload: s.ConditionCreate, health: Health):
    return health.save_record(m.HealthConditions, s.Condition, payload)


@router.get('/conditions/{resource_id}', response_model=s.Condition)
def condition(resource_id: UUID, health: Health):
    return health.record(m.HealthConditions, s.Condition, resource_id)


@router.patch('/conditions/{resource_id}', response_model=s.Condition)
def patch_condition(resource_id: UUID, payload: s.ConditionPatch, health: Health):
    return health.save_record(m.HealthConditions, s.Condition, payload, resource_id)


@router.delete('/conditions/{resource_id}', status_code=204)
def delete_condition(resource_id: UUID, health: Health):
    health.delete_record(m.HealthConditions, resource_id)
    return Response(status_code=204)


@router.get('/allergies', response_model=s.Page[s.Allergy])
def allergies(health: Health, page: PageNumber = 1, page_size: PageSize = 20):
    return health.list_records(m.Allergies, s.Allergy, page, page_size)


@router.post('/allergies', response_model=s.Allergy, status_code=201)
def create_allergy(payload: s.AllergyCreate, health: Health):
    return health.save_record(m.Allergies, s.Allergy, payload)


@router.get('/allergies/{resource_id}', response_model=s.Allergy)
def allergy(resource_id: UUID, health: Health):
    return health.record(m.Allergies, s.Allergy, resource_id)


@router.patch('/allergies/{resource_id}', response_model=s.Allergy)
def patch_allergy(resource_id: UUID, payload: s.AllergyPatch, health: Health):
    return health.save_record(m.Allergies, s.Allergy, payload, resource_id)


@router.delete('/allergies/{resource_id}', status_code=204)
def delete_allergy(resource_id: UUID, health: Health):
    health.delete_record(m.Allergies, resource_id)
    return Response(status_code=204)


@router.get('/entries', response_model=s.Page[s.Entry])
def entries(health: Health, page: PageNumber = 1, page_size: PageSize = 20,
            start: Annotated[AwareDatetime | None, Query(alias='from')] = None,
            end: Annotated[AwareDatetime | None, Query(alias='to')] = None, observation_type: s.Metric | None = None):
    return health.entries(page, page_size, start, end, observation_type)


@router.post('/entries', response_model=s.Entry, status_code=201)
def create_entry(payload: s.EntryCreate, health: Health):
    return health.create_entry(payload)


@router.get('/entries/{entry_id}', response_model=s.Entry)
def entry(entry_id: UUID, health: Health):
    return health.entry(entry_id)


@router.patch('/entries/{entry_id}', response_model=s.Entry)
def patch_entry(entry_id: UUID, payload: s.EntryPatch, health: Health):
    return health.patch_entry(entry_id, payload)


@router.delete('/entries/{entry_id}', status_code=204)
def delete_entry(entry_id: UUID, health: Health):
    health.delete_entry(entry_id)
    return Response(status_code=204)


@router.patch('/entries/{entry_id}/aggregate', response_model=s.Entry)
def aggregate(entry_id: UUID, payload: s.Aggregate, health: Health):
    return health.aggregate(entry_id, payload)


@router.post('/entries/{entry_id}/observations', response_model=s.Observation, status_code=201)
def create_observation(entry_id: UUID, payload: s.ObservationCreate, health: Health):
    return health.mutate_reading(entry_id, payload)


@router.patch('/entries/{entry_id}/observations/{observation_id}', response_model=s.Observation)
def patch_observation(entry_id: UUID, observation_id: UUID, payload: s.ObservationPatch, health: Health):
    return health.mutate_reading(entry_id, payload, observation_id)


@router.delete('/entries/{entry_id}/observations/{observation_id}', status_code=204)
def delete_observation(entry_id: UUID, observation_id: UUID, health: Health):
    health.mutate_reading(entry_id, reading_id=observation_id, delete=True)
    return Response(status_code=204)


@router.get('/observations', response_model=s.Page[s.Observation])
def observations(health: Health, filters: Annotated[s.ObservationSeriesQuery, Query()]):
    """List the user's raw readings by measured time in a half-open window of up to 366 days."""
    return health.observations(filters)


@router.post('/entries/{entry_id}/symptoms', response_model=s.Symptom, status_code=201)
def create_symptom(entry_id: UUID, payload: s.SymptomCreate, health: Health):
    return health.mutate_symptom(entry_id, payload)


@router.patch('/entries/{entry_id}/symptoms/{symptom_id}', response_model=s.Symptom)
def patch_symptom(entry_id: UUID, symptom_id: UUID, payload: s.SymptomPatch, health: Health):
    return health.mutate_symptom(entry_id, payload, symptom_id)


@router.delete('/entries/{entry_id}/symptoms/{symptom_id}', status_code=204)
def delete_symptom(entry_id: UUID, symptom_id: UUID, health: Health):
    health.mutate_symptom(entry_id, symptom_id=symptom_id, delete=True)
    return Response(status_code=204)


@router.get('/analytics', response_model=s.Analytics)
def analytics(health: Health, filters: Annotated[s.AnalyticsQuery, Query()]):
    """Summarize saved readings in continuous local calendar buckets."""
    return health.analytics(filters)


@router.get('/medication-course-options', response_model=s.Page[s.DrugOption])
def course_options(health: Health, q: Annotated[str, Query(max_length=255)] = '', page: PageNumber = 1, page_size: PageSize = 20):
    return health.options(q.strip(), page, page_size)


@router.get('/medication-course-options/prescription-items', response_model=s.Page[s.DrugOption])
def course_item_options(health: Health, q: Annotated[str, Query(max_length=255)] = '', page: PageNumber = 1, page_size: PageSize = 20):
    return health.options(q.strip(), page, page_size, True)


@router.get('/medication-courses', response_model=s.Page[s.Course])
def courses(health: Health, page: PageNumber = 1, page_size: PageSize = 20, status: Literal['ACTIVE', 'COMPLETED', 'STOPPED'] | None = None):
    return health.courses(page, page_size, status)


@router.post('/medication-courses', response_model=s.Course, status_code=201)
def create_course(payload: s.CourseCreate, health: Health):
    return health.create_course(payload)


@router.patch('/medication-courses/{course_id}', response_model=s.Course)
def transition_course(course_id: UUID, payload: s.CourseTransition, health: Health):
    return health.transition_course(course_id, payload)
