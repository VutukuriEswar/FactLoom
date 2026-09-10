from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class DocumentStatus(str, Enum):
    pending = "pending"
    processing = "processing"
    done = "done"
    failed = "failed"


class DocumentBase(BaseModel):
    filename: str
    content_hash: str


class DocumentCreate(DocumentBase):
    pass


class DocumentInDB(DocumentBase):
    id: str = Field(alias="_id")
    uploaded_at: datetime
    page_count: int = 0
    status: DocumentStatus = DocumentStatus.pending
    fact_count: int = 0
    error_message: Optional[str] = None

    model_config = {"populate_by_name": True}


class DocumentResponse(BaseModel):
    id: str
    filename: str
    uploaded_at: datetime
    page_count: int
    status: DocumentStatus
    fact_count: int
    content_hash: str
    error_message: Optional[str] = None
