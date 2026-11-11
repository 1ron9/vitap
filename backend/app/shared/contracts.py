"""Internal interfaces. Business implementations are delivered by module owners."""
from typing import Protocol, Literal
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field, model_validator
from app.modules.auth.router import Principal
from app.shared.enums import InteractionStatus

class Selection(BaseModel):
    model_config = ConfigDict(extra='forbid')
    selection_id: str = Field(min_length=1, max_length=64)
    drug_id: UUID | None = None
    prescription_item_id: UUID | None = None
    unresolved_name: str | None = Field(default=None, min_length=1, max_length=255)

    @model_validator(mode='after')
    def single_reference(self):
        if sum(value is not None for value in (self.drug_id, self.prescription_item_id, self.unresolved_name)) != 1:
            raise ValueError('Select exactly one drug, prescription item or unresolved name')
        if self.unresolved_name is not None and not self.unresolved_name.strip():
            raise ValueError('Unresolved name must not be blank')
        return self

class HealthContextProvider(Protocol):
    def get_context(self, principal: Principal, sections: list[str], mode: Literal['PERSONAL','GENERAL']) -> dict: ...

class DrugResolver(Protocol):
    def resolve(self, name: str, strength: str | None = None) -> dict: ...

class InteractionChecker(Protocol):
    def check(self, principal: Principal, selections: list[Selection]) -> dict: ...
