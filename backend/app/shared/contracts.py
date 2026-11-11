"""Internal interfaces. Business implementations are delivered by module owners."""
from typing import Protocol, Literal
from uuid import UUID
from pydantic import BaseModel, ConfigDict
from app.modules.auth.router import Principal
from app.shared.enums import InteractionStatus

class Selection(BaseModel):
    model_config = ConfigDict(extra='forbid')
    selection_id: str
    drug_id: UUID | None = None
    unresolved_name: str | None = None

class HealthContextProvider(Protocol):
    def get_context(self, principal: Principal, sections: list[str], mode: Literal['PERSONAL','GENERAL']) -> dict: ...

class DrugResolver(Protocol):
    def resolve(self, name: str, strength: str | None = None) -> dict: ...

class InteractionChecker(Protocol):
    def check(self, principal: Principal, selections: list[Selection]) -> dict: ...
