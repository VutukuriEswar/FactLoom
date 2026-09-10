from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field


class EvidenceSpan(BaseModel):
    page: int
    char_start: int
    char_end: int


class FactBase(BaseModel):
    doc_id: str
    type: str
    subject: str
    value: str
    unit: Optional[str] = None
    time_scope: Optional[str] = None
    raw_text: str
    evidence: EvidenceSpan
    confidence: float = Field(ge=0.0, le=1.0, default=0.8)


class FactCreate(FactBase):
    embedding: List[float]


class FactInDB(FactCreate):
    id: str = Field(alias="_id")
    created_at: datetime

    model_config = {"populate_by_name": True}


class FactResponse(BaseModel):
    id: str
    doc_id: str
    type: str
    subject: str
    value: str
    unit: Optional[str]
    time_scope: Optional[str]
    raw_text: str
    evidence: EvidenceSpan
    confidence: float
    created_at: datetime


class FactTypeRecord(BaseModel):
    id: str = Field(alias="_id")
    type_name: str
    description: str
    example_fact_ids: List[str] = []
    first_seen_at: datetime

    model_config = {"populate_by_name": True}
