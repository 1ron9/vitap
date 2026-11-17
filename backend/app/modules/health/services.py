"""M1 use cases: principal-scoped queries, final-state invariants and atomic writes."""
from functools import wraps
from datetime import timedelta
from sqlalchemy.exc import IntegrityError
from pydantic import ValidationError
from app.modules.auth.models import UserProfile, UserConsent
from app.core.config import settings as config
from app.modules.health import models as m, schemas as s
from app.modules.health.errors import invalid, missing, conflict
from app.modules.health.repositories import HealthRepository
from app.modules.health.validation import now, past, date_not_future, observation_values
from app.modules.medication.models import Ingredients
from app.modules.medication import catalog


def write(fn):
    @wraps(fn)
    def transaction(self, *args, **kwargs):
        try:
            result = fn(self, *args, **kwargs)
            self.db.commit()
            return result
        except IntegrityError:
            self.db.rollback()
            conflict('Nguồn dữ liệu đã thay đổi; hãy tải lại')
        except ValidationError as exc:
            self.db.rollback()
            from app.modules.health.errors import HealthError
            error = HealthError(422, 'VALIDATION_ERROR', 'Dữ liệu không hợp lệ')
            error.details = [{'field': '.'.join(map(str, e['loc'])), 'reason': e['type']} for e in exc.errors()]
            raise error from exc
        except Exception:
            self.db.rollback()
            raise
    return transaction


def fields(obj, response):
    return {name: getattr(obj, name) for name in response.model_fields}


def page(query, number, size, render):
    total = query.order_by(None).count()
    return {'items': [render(x) for x in query.offset((number - 1) * size).limit(size).all()],
            'pagination': {'page': number, 'page_size': size, 'total': total}}


class HealthService:
    def __init__(self, db, principal):
        self.repo = HealthRepository(db, principal)
        self.db, self.owner = db, self.repo.owner

    def profile(self):
        row = self.repo.query(UserProfile).first()
        if row is None:
            missing()
        return fields(row, s.Profile)

    @write
    def patch_profile(self, payload):
        row = self.repo.query(UserProfile).with_for_update().first()
        if row is None:
            missing()
        data = payload.model_dump(exclude_unset=True)
        date_not_future(data.get('date_of_birth'), 'date_of_birth')
        for key, value in data.items():
            setattr(row, key, value or None if isinstance(value, str) else value)
        row.updated_at = now()
        self.db.flush()
        return fields(row, s.Profile)

    def preferences(self):
        row = self.repo.settings()
        consent = self.db.query(UserConsent).filter_by(user_id=self.owner, scope='HEALTH_DATA_AND_AI_PROCESSING').order_by(UserConsent.consented_at.desc(), UserConsent.id.desc()).first()
        return {'allow_ai_health_context': row.allow_ai_health_context, 'enable_allergy_alerts': row.enable_allergy_alerts,
                'updated_at': row.updated_at, 'ai_context_available': bool(row.allow_ai_health_context and consent and consent.is_accepted
                and consent.revoked_at is None and consent.consent_version == config.USER_CONSENT_VERSION)}

    @write
    def patch_preferences(self, payload):
        row = self.repo.settings(lock=True)
        for key, value in payload.model_dump(exclude_unset=True).items():
            if value is None:
                invalid(key, 'NULL_NOT_ALLOWED')
            setattr(row, key, value)
        row.updated_at = now()
        return self.preferences()

    def declaration(self):
        # One SQL snapshot for both count and confirmation evidence.
        count = self.repo.query(m.Allergies).with_entities(m.Allergies.id).exists()
        row = (self.db.query(m.UserHealthSettings.no_known_allergies_confirmed_at, count)
               .filter(m.UserHealthSettings.user_id == self.owner).first())
        if row is None:
            missing()
        confirmed, has = row
        return {'state': 'HAS_ALLERGIES' if has else 'NO_KNOWN_ALLERGIES' if confirmed else 'UNKNOWN',
                'confirmed_at': None if has else confirmed}

    @write
    def put_declaration(self, payload):
        row = self.repo.settings(lock=True)
        if self.repo.query(m.Allergies).count():
            conflict('Hãy xử lý danh sách dị ứng trước khi thay đổi xác nhận')
        row.no_known_allergies_confirmed_at = (row.no_known_allergies_confirmed_at or now()) if payload.state == 'NO_KNOWN_ALLERGIES' else None
        row.updated_at = now()
        self.db.flush()
        return self.declaration()

    def list_records(self, model, response, number, size, status=None):
        query = self.repo.query(model)
        if status:
            query = query.filter(model.status == status)
        return page(query.order_by(model.created_at.desc(), model.id.desc()), number, size, lambda row: fields(row, response))

    def record(self, model, response, resource_id):
        return fields(self.repo.owned(model, resource_id), response)

    def _record_data(self, model, payload, existing=None):
        data = payload.model_dump(exclude_unset=True)
        base = {k: getattr(existing, k) for k in (s.ConditionCreate if model == m.HealthConditions else s.AllergyCreate).model_fields} if existing else {}
        base.update(data)
        if model == m.Allergies:
            ingredient = base.get('ingredient_id')
            if ingredient:
                row = self.db.get(Ingredients, ingredient)
                if row is None:
                    invalid('ingredient_id', 'UNKNOWN_INGREDIENT')
                base['allergen_name'] = row.name
            if existing and existing.allergen_type is None and 'allergen_type' not in data:
                # Preserve unknown classification of legacy rows during unrelated edits.
                check = {**base, 'allergen_type': 'OTHER'}
            else:
                check = base
            s.AllergyCreate.model_validate(check)
        else:
            base = s.ConditionCreate.model_validate(base).model_dump()
            date_not_future(base.get('diagnosed_at'), 'diagnosed_at')
        return base

    @write
    def save_record(self, model, response, payload, resource_id=None):
        if model == m.Allergies:
            settings = self.repo.settings(lock=True)
        row = self.repo.owned(model, resource_id, lock=True) if resource_id else None
        data = self._record_data(model, payload, row)
        if row is None:
            row = model(user_id=self.owner, created_at=now())
            self.db.add(row)
        for key, value in data.items():
            setattr(row, key, value)
        row.source_type, row.verified, row.updated_at = 'MANUAL', False, now()
        if model == m.Allergies:
            settings.no_known_allergies_confirmed_at = None
            settings.updated_at = now()
        self.db.flush()
        return fields(row, response)

    @write
    def delete_record(self, model, resource_id):
        if model == m.Allergies:
            self.repo.settings(lock=True)
        self.db.delete(self.repo.owned(model, resource_id, lock=True))
        self.db.flush()

    def entry_detail(self, row, readings=None):
        result = {k: getattr(row, k) for k in s.Entry.model_fields if k != 'observations'}
        result['observations'] = [fields(x, s.Observation) for x in (readings if readings is not None else self.repo.readings(row.id))]
        return result

    def entry(self, entry_id):
        return self.entry_detail(self.repo.owned(m.HealthEntries, entry_id))

    def entries(self, number, size, start=None, end=None, metric=None):
        if start and end and (start >= end or end - start > timedelta(days=366)):
            invalid('from', 'INVALID_OR_TOO_WIDE_DATE_RANGE')
        query = self.repo.query(m.HealthEntries)
        if start:
            query = query.filter(m.HealthEntries.recorded_at >= start)
        if end:
            query = query.filter(m.HealthEntries.recorded_at < end)
        if metric:
            query = query.filter(self.repo.query(m.HealthObservations).filter(
                m.HealthObservations.entry_id == m.HealthEntries.id, m.HealthObservations.observation_type == metric).exists())
        total = query.count()
        rows = query.order_by(m.HealthEntries.recorded_at.desc(), m.HealthEntries.id.desc()).offset((number - 1) * size).limit(size).all()
        children = self.repo.query(m.HealthObservations).filter(m.HealthObservations.entry_id.in_([r.id for r in rows])).order_by(m.HealthObservations.measured_at, m.HealthObservations.id).all()
        grouped = {}
        for child in children:
            grouped.setdefault(child.entry_id, []).append(child)
        return {'items': [self.entry_detail(row, grouped.get(row.id, [])) for row in rows],
                'pagination': {'page': number, 'page_size': size, 'total': total}}

    def _entry_invariant(self, entry):
        readings = self.repo.readings(entry.id)
        if not (entry.title or entry.content or readings):
            conflict('Entry cần nội dung hoặc số đo; hãy xóa cả entry nếu không còn dữ liệu')
        if len(readings) > 100:
            invalid('observations', 'TOO_MANY_OBSERVATIONS')

    @write
    def create_entry(self, payload):
        data = payload.model_dump(exclude={'observations'})
        if not (data.get('title') or data.get('content') or payload.observations):
            invalid('entry', 'EMPTY_ENTRY')
        past(data['recorded_at'], 'recorded_at')
        entry = m.HealthEntries(user_id=self.owner, created_at=now(), **data)
        self.db.add(entry)
        self.db.flush()
        for reading in payload.observations:
            self.db.add(m.HealthObservations(user_id=self.owner, entry_id=entry.id, observation_type=reading.observation_type,
                        source_type='MANUAL', created_at=now(), **observation_values(reading.model_dump(exclude_unset=True), entry.recorded_at)))
        self.db.flush()
        self._entry_invariant(entry)
        return self.entry_detail(entry)

    def _header(self, row, payload):
        data = payload.model_dump(exclude_unset=True)
        for key in ('entry_type', 'recorded_at'):
            if key in data and data[key] is None:
                invalid(key, 'NULL_NOT_ALLOWED')
        if 'recorded_at' in data:
            past(data['recorded_at'], 'recorded_at')
        for key, value in data.items():
            setattr(row, key, value)
        row.updated_at = now()

    @write
    def patch_entry(self, entry_id, payload):
        row = self.repo.owned(m.HealthEntries, entry_id, lock=True)
        self._header(row, payload)
        self.db.flush()
        self._entry_invariant(row)
        return self.entry_detail(row)

    @write
    def aggregate(self, entry_id, payload):
        row = self.repo.owned(m.HealthEntries, entry_id, lock=True)
        if payload.entry:
            self._header(row, payload.entry)
        commands = payload.observations
        for update in commands.update:
            reading = self.repo.observation(entry_id, update.id)
            data = observation_values(update.model_dump(exclude_unset=True, exclude={'id'}), row.recorded_at, reading)
            for key, value in data.items():
                setattr(reading, key, value)
        for reading_id in commands.delete:
            self.db.delete(self.repo.observation(entry_id, reading_id))
        for create in commands.create:
            self.db.add(m.HealthObservations(user_id=self.owner, entry_id=row.id, observation_type=create.observation_type,
                        source_type='MANUAL', created_at=now(), **observation_values(create.model_dump(exclude_unset=True), row.recorded_at)))
        row.updated_at = now()
        self.db.flush()
        self._entry_invariant(row)
        return self.entry_detail(row)

    @write
    def delete_entry(self, entry_id):
        self.db.delete(self.repo.owned(m.HealthEntries, entry_id, lock=True))
        self.db.flush()

    @write
    def mutate_reading(self, entry_id, payload=None, reading_id=None, delete=False):
        row = self.repo.owned(m.HealthEntries, entry_id, lock=True)
        reading = self.repo.observation(entry_id, reading_id) if reading_id else None
        if delete:
            self.db.delete(reading)
        elif reading is None:
            reading = m.HealthObservations(user_id=self.owner, entry_id=entry_id, observation_type=payload.observation_type,
                       source_type='MANUAL', created_at=now(), **observation_values(payload.model_dump(exclude_unset=True), row.recorded_at))
            self.db.add(reading)
        else:
            for key, value in observation_values(payload.model_dump(exclude_unset=True), row.recorded_at, reading).items():
                setattr(reading, key, value)
        row.updated_at = now()
        self.db.flush()
        self._entry_invariant(row)
        return None if delete else fields(reading, s.Observation)

    def course_dict(self, row):
        drug = catalog.drug(self.db, row.drug_id)
        return {**{key: getattr(row, key) for key in ('id', 'drug_id', 'prescription_item_id', 'dosage', 'frequency', 'start_date', 'end_date', 'status', 'created_at')},
                'brand_name': drug.brand_name, 'strength': drug.strength}

    def courses(self, number, size, status=None):
        query = self.repo.query(m.MedicationCourses)
        if status:
            query = query.filter_by(status=status)
        return page(query.order_by(m.MedicationCourses.created_at.desc(), m.MedicationCourses.id.desc()), number, size, self.course_dict)

    @write
    def create_course(self, payload):
        data = payload.model_dump()
        if payload.prescription_item_id:
            item = catalog.confirmed_item(self.db, self.owner, payload.prescription_item_id)
            data['drug_id'] = item.drug_id
            for field, source in (('dosage', 'extracted_dosage'), ('frequency', 'frequency')):
                if field not in payload.model_fields_set:
                    data[field] = getattr(item, source)
        catalog.drug(self.db, data['drug_id'])
        row = m.MedicationCourses(user_id=self.owner, status='ACTIVE', created_at=now(), **data)
        self.db.add(row)
        self.db.flush()
        return self.course_dict(row)

    @write
    def transition_course(self, course_id, payload):
        row = self.repo.owned(m.MedicationCourses, course_id, lock=True)
        if row.start_date and payload.end_date < row.start_date:
            invalid('end_date', 'BEFORE_START_DATE')
        if row.status != 'ACTIVE' and (row.status != payload.status or row.end_date != payload.end_date):
            conflict('Đợt dùng thuốc đã kết thúc')
        row.status, row.end_date = payload.status, payload.end_date
        self.db.flush()
        return self.course_dict(row)

    def options(self, query, number, size, items=False):
        def render(row):
            d = catalog.drug(self.db, row.drug_id) if items else row
            return {'drug_id': d.id, 'brand_name': d.brand_name, 'strength': d.strength,
                    'prescription_item_id': row.id if items else None,
                    'dosage': row.extracted_dosage if items else None, 'frequency': row.frequency if items else None}
        return page(catalog.options(self.db, self.owner, query, items), number, size, render)
