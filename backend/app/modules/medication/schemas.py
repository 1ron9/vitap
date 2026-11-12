"""Pydantic schemas for Medication and OCR domain (v3.1 aligned)."""
from typing import Any, Dict, List, Optional
from uuid import UUID
from pydantic import BaseModel, Field


class OcrJobItemDTO(BaseModel):
    id: UUID
    item_order: int
    extracted_name: str
    extracted_strength: Optional[str] = None
    extracted_dosage: Optional[str] = None
    frequency: Optional[str] = None
    duration_days: Optional[int] = None
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
    error_message: Optional[str] = None
    items: List[OcrJobItemDTO] = Field(default_factory=list)


class PrescriptionUploadResponse(BaseModel):
    prescription_id: UUID
    job_id: UUID
    prescription_status: str
    job_status: str
    poll_after_seconds: int = 2
    items: Optional[List[OcrJobItemDTO]] = None
