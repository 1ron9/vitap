"""Owner-scoped queries; repositories never commit application transactions."""
from app.modules.auth.models import User
from app.modules.health.errors import missing
from app.modules.health.models import HealthEntries, HealthObservations, Symptoms, UserHealthSettings
from app.modules.auth.router import AuthError


class HealthRepository:
    def __init__(self, db, principal):
        if principal.kind == 'PUBLIC':
            raise AuthError(401, 'AUTH_REQUIRED', 'Cần đăng nhập')
        if principal.kind != 'USER':
            raise AuthError(403, 'LOGIN_REQUIRED', 'Cần tài khoản User')
        user = db.get(User, principal.id)
        if not user:
            raise AuthError(401, 'INVALID_TOKEN', 'Token không hợp lệ')
        if user.status != 'ACTIVE':
            raise AuthError(403, 'ACCOUNT_INACTIVE', 'Tài khoản không hoạt động')
        self.db, self.owner = db, user.id

    def query(self, model):
        return self.db.query(model).filter(model.user_id == self.owner)

    def owned(self, model, resource_id, lock=False):
        query = self.query(model).filter(model.id == resource_id)
        if lock:
            query = query.populate_existing().with_for_update()
        obj = query.first()
        if obj is None:
            missing()
        return obj

    def settings(self, lock=False):
        query = self.query(UserHealthSettings)
        if lock:
            query = query.populate_existing().with_for_update()
        row = query.first()
        if row is None:
            missing()  # registration/migration creates the shell; GET never writes
        return row

    def observation(self, entry_id, observation_id):
        obj = (self.query(HealthObservations).join(HealthEntries, HealthEntries.id == HealthObservations.entry_id)
               .filter(HealthEntries.user_id == self.owner, HealthObservations.entry_id == entry_id,
                       HealthObservations.id == observation_id).first())
        if obj is None:
            missing()
        return obj

    def readings(self, entry_id):
        return self.query(HealthObservations).filter_by(entry_id=entry_id).order_by(HealthObservations.measured_at, HealthObservations.id).all()

    def symptoms(self, entry_ids):
        return (
            self.db.query(Symptoms)
            .join(HealthEntries, HealthEntries.id == Symptoms.entry_id)
            .filter(HealthEntries.user_id == self.owner, Symptoms.entry_id.in_(entry_ids))
            .order_by(Symptoms.created_at.asc().nulls_last(), Symptoms.id.asc())
        )

    def symptom(self, entry_id, symptom_id):
        row = self.symptoms([entry_id]).filter(Symptoms.id == symptom_id).first()
        if row is None:
            missing()
        return row

    def observation_series(self, metric, start, end):
        return (
            self.query(HealthObservations)
            .join(HealthEntries, HealthEntries.id == HealthObservations.entry_id)
            .filter(
                HealthEntries.user_id == self.owner,
                HealthObservations.observation_type == metric,
                HealthObservations.measured_at >= start,
                HealthObservations.measured_at < end,
            )
            .order_by(HealthObservations.measured_at, HealthObservations.id)
        )
