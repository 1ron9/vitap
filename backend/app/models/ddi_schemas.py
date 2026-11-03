from enum import Enum
from typing import List, Optional
from pydantic import BaseModel, Field

class RiskLevelEnum(str, Enum):
    RED = "RED"
    YELLOW = "YELLOW"
    GREEN = "GREEN"
    UNKNOWN_RISK = "UNKNOWN_RISK"

class InputSourceEnum(str, Enum):
    MANUAL_INPUT = "MANUAL_INPUT"
    AUTOCOMPLETE = "AUTOCOMPLETE"
    OCR_M1 = "OCR_M1"

class DrugInputItem(BaseModel):
    brand_id: Optional[int] = Field(None, description="ID biệt dược trong CSDL")
    ingredient_id: Optional[int] = Field(None, description="ID hoạt chất gốc generic")
    raw_name: str = Field(..., min_length=1, description="Tên thuốc hiển thị")
    source: InputSourceEnum = Field(InputSourceEnum.MANUAL_INPUT, description="Nguồn nhập")

class PatientProfileInput(BaseModel):
    age: int = Field(..., ge=0, le=120)
    gender: str = Field(..., pattern="^(MALE|FEMALE|OTHER)$")
    condition_ids: List[int] = Field(default_factory=list)
    is_pregnant: bool = Field(False)

class DDIAlertItem(BaseModel):
    severity: RiskLevelEnum
    drug_a: str
    drug_b: str
    mechanism: str
    clinical_management: str

class DCIAlertItem(BaseModel):
    severity: RiskLevelEnum
    drug: str
    condition: str
    contraindication_type: str
    clinical_advice: str

class DuplicateTherapyAlertItem(BaseModel):
    severity: RiskLevelEnum = RiskLevelEnum.RED
    ingredient_name: str
    involved_drugs: List[str]
    warning_message: str

class SummaryStatus(BaseModel):
    overall_risk_level: RiskLevelEnum
    total_drugs_analyzed: int
    total_ingredients_resolved: int
    out_of_scope_drugs: List[dict] = Field(default_factory=list)

class PersonalizedAdvice(BaseModel):
    source_engine: str
    content_markdown: str
    disclaimer: str

class CheckInteractionResponse(BaseModel):
    summary: SummaryStatus
    duplicate_therapy_alerts: List[DuplicateTherapyAlertItem] = Field(default_factory=list)
    ddi_alerts: List[DDIAlertItem] = Field(default_factory=list)
    dci_alerts: List[DCIAlertItem] = Field(default_factory=list)
    personalized_advice: PersonalizedAdvice
