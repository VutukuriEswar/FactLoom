from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, Field


class RelationType(str, Enum):
    corroborates = "corroborates"
    contradicts = "contradicts"
    reconciled_by_context = "reconciled_by_context"
    unrelated = "unrelated"


class RelationshipBase(BaseModel):
    fact_id_a: str
    fact_id_b: str
    relation: RelationType
    reasoning: str
    reconciling_factors: List[str] = []
    confidence: float = Field(ge=0.0, le=1.0, default=0.7)


class RelationshipCreate(RelationshipBase):
    pass


class RelationshipInDB(RelationshipBase):
    id: str = Field(alias="_id")
    created_at: datetime

    model_config = {"populate_by_name": True}


class RelationshipResponse(BaseModel):
    id: str
    fact_id_a: str
    fact_id_b: str
    relation: RelationType
    reasoning: str
    reconciling_factors: List[str]
    confidence: float
    created_at: datetime


class ExtractionRunRecord(BaseModel):
    id: str = Field(alias="_id")
    doc_id: str
    doc_filename: str
    started_at: datetime
    finished_at: Optional[datetime] = None
    pages_processed: int = 0
    chunks_processed: int = 0
    facts_extracted: int = 0
    facts_failed_validation: int = 0
    facts_failed_evidence: int = 0
    relationships_created: int = 0
    failures: List[dict] = []
    status: str = "running"

    model_config = {"populate_by_name": True}
