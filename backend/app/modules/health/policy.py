"""Internal M1 context permission; never a public raw-context endpoint."""
from app.core.config import settings
from app.modules.auth.models import UserConsent
from app.modules.health.services import HealthService


class PersonalHealthContext:
    def __init__(self, db):
        self.db = db

    def get_context(self, principal, sections, mode):
        health = HealthService(self.db, principal)
        if mode == 'GENERAL':
            return {'available': False, 'sections': {}}
        if mode != 'PERSONAL' or any(x not in ('profile', 'conditions', 'allergies', 'courses') for x in sections):
            from app.modules.health.errors import invalid
            invalid('sections', 'INVALID_CONTEXT_REQUEST')
        consent = (self.db.query(UserConsent).filter_by(user_id=health.owner, scope='HEALTH_DATA_AND_AI_PROCESSING')
                   .order_by(UserConsent.consented_at.desc(), UserConsent.id.desc()).first())
        if (not health.preferences()['allow_ai_health_context'] or not consent or not consent.is_accepted
                or consent.revoked_at is not None or consent.consent_version != settings.USER_CONSENT_VERSION):
            return {'available': False, 'sections': {}}
        from app.modules.health import models as m, schemas as s
        result = {}
        for section in dict.fromkeys(sections):
            if section == 'profile':
                profile = health.profile()
                result[section] = {k: profile[k] for k in ('date_of_birth', 'biological_sex', 'height_cm')}
            elif section == 'courses':
                result[section] = [health.course_dict(x) for x in health.repo.query(m.MedicationCourses).filter_by(status='ACTIVE').all()]
            else:
                model, response = (m.HealthConditions, s.Condition) if section == 'conditions' else (m.Allergies, s.Allergy)
                from app.modules.health.services import fields
                result[section] = [fields(x, response) for x in health.repo.query(model).all()]
        return {'available': True, 'sections': result}

    def allergy_alerts_allowed(self, principal):
        return HealthService(self.db, principal).preferences()['enable_allergy_alerts']
