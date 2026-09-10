from __future__ import annotations

from typing import List, Optional

from fastapi import APIRouter, HTTPException, Query

from app.db import get_db
from app.models.fact import FactResponse, FactTypeRecord

router = APIRouter(tags=["facts"])


@router.get("/facts", response_model=List[FactResponse])
async def list_facts(
    doc_id: Optional[str] = None,
    type: Optional[str] = None,
    search: Optional[str] = Query(None, description="Full-text search on subject, value, and raw_text")
):
    db = get_db()
    query = {}
    
    if doc_id:
        query["doc_id"] = doc_id
    if type:
        query["type"] = type
    if search:
        query["$text"] = {"$search": search}

    def _to_resp(doc):
        d = {**doc, "id": str(doc["_id"])}
        return FactResponse(**d)
    cursor = db.facts.find(query).sort("created_at", -1).limit(100)
    return [_to_resp(doc) async for doc in cursor]


@router.get("/facts/{fact_id}", response_model=FactResponse)
async def get_fact(fact_id: str):
    db = get_db()
    fact = await db.facts.find_one({"_id": fact_id})
    if not fact:
        raise HTTPException(status_code=404, detail="Fact not found")
    d = {**fact, "id": str(fact["_id"])}
    return FactResponse(**d)


@router.get("/facts/{fact_id}/evidence")
async def get_fact_evidence(fact_id: str):
    db = get_db()
    fact = await db.facts.find_one({"_id": fact_id})
    if not fact:
        raise HTTPException(status_code=404, detail="Fact not found")
        
    doc_id = fact["doc_id"]
    doc = await db.documents.find_one({"_id": doc_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Source document not found")

    return {
        "fact_id": fact_id,
        "doc_id": doc_id,
        "doc_filename": doc["filename"],
        "evidence": fact["evidence"],
        "raw_text": fact["raw_text"]
    }


@router.get("/fact-types", response_model=List[FactTypeRecord])
async def list_fact_types():
    db = get_db()
    def _to_type(doc):
        d = {**doc, "id": str(doc["_id"])}
        return FactTypeRecord(**d)
    cursor = db.fact_types.find().sort("first_seen_at", -1)
    return [_to_type(doc) async for doc in cursor]


@router.get("/extraction-runs")
async def list_extraction_runs(limit: int = 50):
    db = get_db()
    cursor = db.extraction_runs.find().sort("started_at", -1).limit(limit)
    runs = []
    async for doc in cursor:
        doc["id"] = doc.pop("_id")
        runs.append(doc)
    return runs
