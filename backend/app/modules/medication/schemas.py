"""Pydantic schemas for Medication and OCR domain (v3.1 aligned)."""
from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import UUID
from pydantic import BaseModel, Field, ConfigDict


class OcrJobErrorDTO(BaseModel):
    code: str
    message: str


class OcrJobItemDTO(BaseModel):
    id: UUID
    item_order: int
    extracted_name: str
    extracted_strength: Optional[str] = None
    extracted_dosage: Optional[str] = None
    frequency: Optional[str] = None
    duration_days: Optional[int] = None
    route: Optional[str] = None
    instructions: Optional[str] = None
    confidence: Optional[float] = None
    bounding_box: Optional[Dict[str, Any]] = None
    candidate_drug_id: Optional[UUID] = None
    resolution_status: str = "UNRESOLVED_DRUG"
    field_confidences: Optional[Dict[str, Any]] = None
    candidates: Optional[List[Dict[str, Any]]] = None


class OcrJobResponse(BaseModel):
    id: UUID
    prescription_id: UUID
    status: str
    model_name: Optional[str] = None
    model_version: Optional[str] = None
    confidence: Optional[float] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    error: Optional[OcrJobErrorDTO] = None
    items: List[OcrJobItemDTO] = Field(default_factory=list)


class PrescriptionUploadResponse(BaseModel):
    prescription_id: UUID
    job_id: UUID
    prescription_status: str
    job_status: str
    expires_at: Optional[datetime] = None
    poll_after_seconds: int = 2
    items: Optional[List[OcrJobItemDTO]] = None


class OcrReviewItem(BaseModel):
    model_config = ConfigDict(extra="forbid")
    source_ocr_item_id: Optional[UUID] = None
    item_order: int = Field(ge=1)
    extracted_name: str = Field(min_length=1, max_length=255)
    extracted_strength: Optional[str] = Field(default=None, max_length=100)
    extracted_dosage: Optional[str] = None
    frequency: Optional[str] = Field(default=None, max_length=255)
    duration_days: Optional[int] = Field(default=None, ge=0)
    route: Optional[str] = Field(default=None, max_length=100)
    instructions: Optional[str] = None
    confidence: Optional[float] = Field(default=None, ge=0, le=1)
    unresolved: bool = False


class OcrReviewRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    items: List[OcrReviewItem] = Field(min_length=1, max_length=100)


class OcrReviewResponse(BaseModel):
    prescription_id: UUID
    saved_items: int
    status: str
