"""Connect the M3 ports to the application's Auth and M1 policy."""

from dataclasses import dataclass
from uuid import UUID

from fastapi import Depends
from starlette.concurrency import run_in_threadpool

from app.core.database import SessionLocal
from app.modules.auth.models import User
from app.modules.auth.router import Principal as AuthPrincipal
from app.modules.health.policy import PersonalHealthContext
from app.shared.principal import require_ai_consent

from .enums import PersonalContextSection as Section
from .integration import AllergyData, ConditionData, MedicationData, Principal, ProfileData, RawHealthContext


@dataclass(frozen=True)
class AssistantPrincipal:
    user_id: UUID
    is_guest: bool = False


def get_ai_principal(user: User = Depends(require_ai_consent)) -> AssistantPrincipal:
    return AssistantPrincipal(user.id)


class HealthContextAdapter:
    sections = {
        Section.HEALTH_PROFILE: "profile",
        Section.HEALTH_CONDITIONS: "conditions",
        Section.ALLERGIES: "allergies",
        Section.ACTIVE_MEDICATIONS: "courses",
    }

    async def get_personal_health_context(self, principal: Principal, sections: frozenset[Section]) -> RawHealthContext:
        requested = [name for section, name in self.sections.items() if section in sections]
        if not requested:
            return RawHealthContext()
        return await run_in_threadpool(self._get_context, principal.user_id, requested)

    @staticmethod
    def _get_context(user_id: UUID, sections: list[str]) -> RawHealthContext:
        with SessionLocal() as db:
            data = PersonalHealthContext(db).get_context(AuthPrincipal("USER", user_id), sections, "PERSONAL")
        rows = data["sections"]
        profile = rows.get("profile")
        return RawHealthContext(
            profile=ProfileData(**profile) if profile else None,
            conditions=[
                ConditionData(row["condition_name"], row["status"], row["icd10_code"], row["verified"])
                for row in rows.get("conditions", [])
            ],
            allergies=[
                AllergyData(
                    row["allergen_name"], row["allergen_type"], row["severity"], row["reaction"],
                    row["ingredient_id"], row["verified"],
                )
                for row in rows.get("allergies", [])
            ],
            medications=[
                MedicationData(
                    row["brand_name"], row["drug_id"], dosage=row["dosage"],
                    frequency=row["frequency"], status=row["status"],
                )
                for row in rows.get("courses", [])
            ],
        )
