"""M1 wire DTOs. All editable fields are explicit; owner/provenance are server-owned."""
from datetime import date, datetime, timezone
from decimal import Decimal
import re
from typing import Annotated, Generic, Literal, TypeVar
from uuid import UUID
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, StrictBool, StrictInt, PlainSerializer, field_validator, model_validator

Metric = Literal['BLOOD_PRESSURE', 'GLUCOSE', 'WEIGHT', 'HEART_RATE']
Sex = Literal['MALE', 'FEMALE', 'OTHER', 'UNKNOWN']
ConditionStatus = Literal['ACTIVE', 'RESOLVED', 'CHRONIC']
AllergenType = Literal['DRUG', 'FOOD', 'OTHER']
Severity = Literal['MILD', 'MODERATE', 'SEVERE']
Number = Annotated[Decimal, Field(max_digits=12, decimal_places=4, allow_inf_nan=False)]
JsonDecimal = Annotated[Decimal, PlainSerializer(float, return_type=float, when_used='json')]
Name = Annotated[str, Field(min_length=1, max_length=255)]
Note = Annotated[str, Field(max_length=5000)]


class DTO(BaseModel):
    model_config = ConfigDict(extra='forbid', from_attributes=True, str_strip_whitespace=True)

    @field_validator('*', mode='after', check_fields=False)
    @classmethod
    def utc_datetimes(cls, value):
        if isinstance(value, datetime):
            return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value.astimezone(timezone.utc)
        return value


class Patch(DTO):
    @model_validator(mode='after')
    def nonempty(self):
        if not self.model_fields_set:
            raise ValueError('EMPTY_PATCH')
        return self


class ProfilePatch(Patch):
    full_name: Annotated[str, Field(max_length=255)] | None = None
    date_of_birth: date | None = None
    biological_sex: Sex | None = None
    phone: Annotated[str, Field(max_length=30)] | None = None
    height_cm: Annotated[JsonDecimal, Field(gt=0, max_digits=5, decimal_places=2)] | None = None


class Profile(ProfilePatch):
    id: UUID
    created_at: datetime
    updated_at: datetime | None


class ConditionCreate(DTO):
    condition_name: Name
    icd10_code: Annotated[str, Field(max_length=20)] | None = None
    description: Note | None = None
    diagnosed_at: date | None = None
    status: ConditionStatus = 'ACTIVE'


class ConditionPatch(Patch):
    condition_name: Name | None = None
    icd10_code: Annotated[str, Field(max_length=20)] | None = None
    description: Note | None = None
    diagnosed_at: date | None = None
    status: ConditionStatus | None = None


class Condition(ConditionCreate):
    id: UUID
    source_type: str | None
    verified: bool | None
    created_at: datetime
    updated_at: datetime | None


class AllergyCreate(DTO):
    allergen_name: Name
    allergen_type: AllergenType
    ingredient_id: UUID | None = None
    reaction: Note | None = None
    severity: Severity | None = None


class AllergyPatch(Patch):
    allergen_name: Name | None = None
    allergen_type: AllergenType | None = None
    ingredient_id: UUID | None = None
    reaction: Note | None = None
    severity: Severity | None = None


class Allergy(DTO):
    id: UUID
    allergen_name: str
    allergen_type: str | None
    ingredient_id: UUID | None
    reaction: str | None
    severity: str | None
    source_type: str | None
    verified: bool | None
    created_at: datetime
    updated_at: datetime | None


class ObservationCreate(DTO):
    observation_type: Metric
    value: Number
    secondary_value: Number | None = None
    unit: Annotated[str, Field(max_length=30)] | None = None
    measured_at: AwareDatetime | None = None


class ObservationPatch(Patch):
    value: Number | None = None
    secondary_value: Number | None = None
    unit: Annotated[str, Field(max_length=30)] | None = None
    measured_at: AwareDatetime | None = None


class ObservationUpdate(ObservationPatch):
    id: UUID


class Observation(DTO):
    id: UUID
    entry_id: UUID
    observation_type: str  # legacy metrics remain readable
    value: JsonDecimal
    secondary_value: JsonDecimal | None
    unit: str
    measured_at: datetime
    entered_value: JsonDecimal | None
    entered_unit: str | None
    source_type: str | None
    source_reference: str | None
    created_at: datetime


class ObservationSeriesQuery(DTO):
    observation_type: Metric
    start: AwareDatetime = Field(alias='from')
    end: AwareDatetime = Field(alias='to')
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=20, ge=1, le=100)

    @field_validator('start', 'end', mode='before')
    @classmethod
    def timestamp_with_offset(cls, value):
        # AwareDatetime also accepts Unix timestamps. The HTTP contract requires an explicit offset.
        if isinstance(value, str) and not re.fullmatch(
            r'\d{4}-\d{2}-\d{2}[Tt]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:[Zz]|[+-]\d{2}:\d{2})', value,
        ):
            raise ValueError('EXPECTED_TIMESTAMP_WITH_OFFSET')
        return value


class AnalyticsQuery(DTO):
    observation_type: Metric
    start: date = Field(alias='from')
    end: date = Field(alias='to')
    granularity: Literal['day', 'week', 'month'] = 'day'
    timezone: str = 'Asia/Ho_Chi_Minh'

    @field_validator('start', 'end', mode='before')
    @classmethod
    def calendar_date(cls, value):
        if not isinstance(value, str) or not re.fullmatch(r'\d{4}-\d{2}-\d{2}', value):
            raise ValueError('EXPECTED_CALENDAR_DATE')
        return value

    @field_validator('timezone')
    @classmethod
    def known_timezone(cls, value):
        try:
            ZoneInfo(value)
        except (ZoneInfoNotFoundError, ValueError, TypeError) as exc:
            raise ValueError('UNKNOWN_TIMEZONE') from exc
        return value


class AnalyticsBucket(DTO):
    period_start: date
    period_end: date
    count: int
    average: JsonDecimal | None
    minimum: JsonDecimal | None
    maximum: JsonDecimal | None
    secondary_average: JsonDecimal | None
    secondary_minimum: JsonDecimal | None
    secondary_maximum: JsonDecimal | None


class Analytics(DTO):
    observation_type: Metric
    start: date = Field(alias='from')
    end: date = Field(alias='to')
    granularity: Literal['day', 'week', 'month']
    timezone: str
    unit: str
    excluded_count: int
    excluded_reasons: dict[str, int]
    buckets: list[AnalyticsBucket]


class EntryHeader(DTO):
    title: Annotated[str, Field(max_length=255)] | None = None
    content: Annotated[str, Field(max_length=10000)] | None = None
    entry_type: Literal['DAILY'] = 'DAILY'
    mood: Annotated[str, Field(max_length=30)] | None = None
    recorded_at: AwareDatetime = Field(default_factory=lambda: datetime.now(timezone.utc))


SymptomSeverity = Annotated[StrictInt, Field(ge=1, le=10)]
SymptomDuration = Annotated[StrictInt, Field(ge=0, le=2_147_483_647)]


class SymptomCreate(DTO):
    symptom_name: Name
    severity: SymptomSeverity | None = None
    duration_minutes: SymptomDuration | None = None
    notes: Note | None = None


class SymptomPatch(Patch):
    symptom_name: Name | None = None
    severity: SymptomSeverity | None = None
    duration_minutes: SymptomDuration | None = None
    notes: Note | None = None

    @field_validator('symptom_name')
    @classmethod
    def name_may_not_be_cleared(cls, value):
        if value is None:
            raise ValueError('NULL_NOT_ALLOWED')
        return value


class SymptomUpdate(SymptomPatch):
    id: UUID


class Symptom(DTO):
    id: UUID
    entry_id: UUID
    symptom_name: str
    severity: int | None
    duration_minutes: int | None
    notes: str | None
    created_at: datetime | None


class EntryCreate(EntryHeader):
    observations: list[ObservationCreate] = Field(default_factory=list, max_length=100)
    symptoms: list[SymptomCreate] = Field(default_factory=list, max_length=100)


class EntryPatch(Patch):
    title: Annotated[str, Field(max_length=255)] | None = None
    content: Annotated[str, Field(max_length=10000)] | None = None
    entry_type: Literal['DAILY'] | None = None
    mood: Annotated[str, Field(max_length=30)] | None = None
    recorded_at: AwareDatetime | None = None


class Entry(DTO):
    id: UUID
    title: str | None
    content: str | None
    entry_type: str | None
    mood: str | None
    recorded_at: datetime
    created_at: datetime
    updated_at: datetime | None
    observations: list[Observation]
    symptoms: list[Symptom]


class ObservationCommands(DTO):
    create: list[ObservationCreate] = Field(default_factory=list, max_length=100)
    update: list[ObservationUpdate] = Field(default_factory=list, max_length=100)
    delete: list[UUID] = Field(default_factory=list, max_length=100)

    @model_validator(mode='after')
    def unique_targets(self):
        ids = [x.id for x in self.update] + self.delete
        if len(ids) != len(set(ids)):
            raise ValueError('DUPLICATE_OR_CONFLICTING_TARGETS')
        if any(x.model_fields_set == {'id'} for x in self.update):
            raise ValueError('EMPTY_OBSERVATION_UPDATE')
        return self


class SymptomCommands(DTO):
    create: list[SymptomCreate] = Field(default_factory=list, max_length=100)
    update: list[SymptomUpdate] = Field(default_factory=list, max_length=100)
    delete: list[UUID] = Field(default_factory=list, max_length=100)

    @model_validator(mode='after')
    def unique_targets(self):
        ids = [x.id for x in self.update] + self.delete
        if len(ids) != len(set(ids)):
            raise ValueError('DUPLICATE_OR_CONFLICTING_SYMPTOM_TARGETS')
        if any(x.model_fields_set == {'id'} for x in self.update):
            raise ValueError('EMPTY_SYMPTOM_UPDATE')
        return self


class Aggregate(DTO):
    entry: EntryPatch | None = None
    observations: ObservationCommands = Field(default_factory=ObservationCommands)
    symptoms: SymptomCommands = Field(default_factory=SymptomCommands)

    @model_validator(mode='after')
    def nonempty(self):
        if not self.entry and not any(
            command.create or command.update or command.delete for command in (self.observations, self.symptoms)
        ):
            raise ValueError('EMPTY_COMMAND')
        return self


class PreferencesPatch(Patch):
    allow_ai_health_context: StrictBool | None = None
    enable_allergy_alerts: StrictBool | None = None


class Preferences(DTO):
    allow_ai_health_context: bool
    enable_allergy_alerts: bool
    ai_context_available: bool
    updated_at: datetime | None


class DeclarationPut(DTO):
    state: Literal['UNKNOWN', 'NO_KNOWN_ALLERGIES']


class Declaration(DTO):
    state: Literal['UNKNOWN', 'HAS_ALLERGIES', 'NO_KNOWN_ALLERGIES']
    confirmed_at: datetime | None


class CourseCreate(DTO):
    drug_id: UUID | None = None
    prescription_item_id: UUID | None = None
    dosage: Note | None = None
    frequency: Annotated[str, Field(max_length=255)] | None = None
    start_date: date
    end_date: date | None = None

    @model_validator(mode='after')
    def one_source(self):
        if (self.drug_id is None) == (self.prescription_item_id is None):
            raise ValueError('SELECT_EXACTLY_ONE_SOURCE')
        if self.end_date and self.end_date < self.start_date:
            raise ValueError('INVALID_DATE_RANGE')
        return self


class CourseTransition(DTO):
    status: Literal['COMPLETED', 'STOPPED']
    end_date: date


class DrugOption(DTO):
    drug_id: UUID
    brand_name: str
    strength: str | None
    prescription_item_id: UUID | None = None
    dosage: str | None = None
    frequency: str | None = None


class Course(DrugOption):
    id: UUID
    start_date: date | None
    end_date: date | None
    status: str
    created_at: datetime


class Pagination(DTO):
    page: int
    page_size: int
    total: int


T = TypeVar('T')


class Page(DTO, Generic[T]):
    items: list[T]
    pagination: Pagination


class ErrorDetail(DTO):
    field: str
    reason: str


class ErrorBody(DTO):
    code: str
    message: str
    details: list[ErrorDetail]
    request_id: str


class ErrorResponse(DTO):
    error: ErrorBody
