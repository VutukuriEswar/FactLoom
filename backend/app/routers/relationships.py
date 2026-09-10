from __future__ import annotations

from typing import List, Optional

from fastapi import APIRouter, HTTPException

from app.db import get_db
from app.models.relationship import RelationshipResponse, RelationType

router = APIRouter(prefix="/relationships", tags=["relationships"])


@router.get("", response_model=List[RelationshipResponse])
async def list_relationships(
    relation: Optional[RelationType] = None,
    limit: int = 50
):
    db = get_db()
    query = {}
    if relation:
        query["relation"] = relation
        
    def _to_resp(doc):
        d = {**doc, "id": str(doc["_id"])}
        return RelationshipResponse(**d)
    cursor = db.relationships.find(query).sort("created_at", -1).limit(limit)
    return [_to_resp(doc) async for doc in cursor]


@router.get("/{rel_id}")
async def get_relationship_detail(rel_id: str):
    db = get_db()
    rel = await db.relationships.find_one({"_id": rel_id})
    if not rel:
        raise HTTPException(status_code=404, detail="Relationship not found")
        
    fact_a = await db.facts.find_one({"_id": rel["fact_id_a"]})
    fact_b = await db.facts.find_one({"_id": rel["fact_id_b"]})
    
    doc_a = await db.documents.find_one({"_id": fact_a["doc_id"]}) if fact_a else None
    doc_b = await db.documents.find_one({"_id": fact_b["doc_id"]}) if fact_b else None

    rel["id"] = rel.pop("_id")
    if fact_a:
        fact_a["id"] = fact_a.pop("_id")
        if doc_a:
            fact_a["doc_filename"] = doc_a.get("filename")
    if fact_b:
        fact_b["id"] = fact_b.pop("_id")
        if doc_b:
            fact_b["doc_filename"] = doc_b.get("filename")

    return {
        "relationship": rel,
        "fact_a": fact_a,
        "fact_b": fact_b
    }
