from __future__ import annotations

import asyncio
import hashlib
import logging
from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, BackgroundTasks, File, HTTPException, UploadFile
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.config import get_settings
from app.db import get_db
from app.models.document import DocumentInDB, DocumentResponse, DocumentStatus
from app.models.fact import FactCreate, FactInDB
from app.models.relationship import ExtractionRunRecord
from app.services.embeddings import generate_fact_embeddings
from app.services.fact_extractor import ChunkTuple, extract_facts_from_batch
from app.services.pdf_parser import parse_pdf
from app.services.relationship_engine import evaluate_new_facts_against_corpus
from app.services.schema_registry import register_fact_types

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/documents", tags=["documents"])


def _doc_to_response(doc: dict) -> DocumentResponse:
    data = {**doc, "id": str(doc["_id"])}
    return DocumentResponse(**data)


@router.post("", response_model=DocumentResponse, status_code=202)
async def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
):
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are supported.")

    settings = get_settings()
    file_bytes = await file.read()

    if len(file_bytes) > settings.max_upload_bytes:
        raise HTTPException(
            status_code=413,
            detail=f"File exceeds maximum size of {settings.max_upload_mb} MB.",
        )

    content_hash = hashlib.sha256(file_bytes).hexdigest()
    db = get_db()

    existing_doc = await db.documents.find_one({"content_hash": content_hash})
    if existing_doc:
        if existing_doc.get("status") == DocumentStatus.done:
            logger.info("Document '%s' already exists and is done. Skipping.", file.filename)
            return _doc_to_response(existing_doc)
        logger.info("Document '%s' exists with status '%s' — resetting.", file.filename, existing_doc.get("status"))
        await _delete_document_data(str(existing_doc["_id"]), db)

    now = datetime.now(timezone.utc)
    doc_id = f"doc_{now.timestamp()}_{content_hash[:6]}"

    doc = DocumentInDB(
        _id=doc_id,
        filename=file.filename,
        content_hash=content_hash,
        uploaded_at=now,
        status=DocumentStatus.processing,
    )
    await db.documents.insert_one(doc.model_dump(by_alias=True))

    background_tasks.add_task(_process_pipeline, file_bytes, doc_id, file.filename, db)

    final_doc = await db.documents.find_one({"_id": doc_id})
    return _doc_to_response(final_doc)


@router.get("", response_model=List[DocumentResponse])
async def list_documents():
    db = get_db()
    cursor = db.documents.find().sort("uploaded_at", -1)
    return [_doc_to_response(doc) async for doc in cursor]


@router.get("/{doc_id}", response_model=DocumentResponse)
async def get_document(doc_id: str):
    db = get_db()
    doc = await db.documents.find_one({"_id": doc_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return _doc_to_response(doc)


@router.delete("/{doc_id}", status_code=204)
async def delete_document(doc_id: str):
    db = get_db()
    doc = await db.documents.find_one({"_id": doc_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    await _delete_document_data(doc_id, db)


async def _delete_document_data(doc_id: str, db: AsyncIOMotorDatabase) -> None:
    fact_ids = [f["_id"] async for f in db.facts.find({"doc_id": doc_id}, {"_id": 1})]

    if fact_ids:
        await db.relationships.delete_many({
            "$or": [{"fact_id_a": {"$in": fact_ids}}, {"fact_id_b": {"$in": fact_ids}}]
        })
        await db.facts.delete_many({"doc_id": doc_id})

    await db.documents.delete_one({"_id": doc_id})
    await db.extraction_runs.delete_many({"doc_id": doc_id})
    logger.info("Deleted document %s and %d associated facts", doc_id, len(fact_ids))


async def _process_pipeline(
    file_bytes: bytes,
    doc_id: str,
    filename: str,
    db: AsyncIOMotorDatabase,
) -> None:
    run_id = f"run_{datetime.now().timestamp()}"
    run_record = ExtractionRunRecord(
        _id=run_id,
        doc_id=doc_id,
        doc_filename=filename,
        started_at=datetime.now(timezone.utc),
    )
    await db.extraction_runs.insert_one(run_record.model_dump(by_alias=True))

    try:
        parsed = parse_pdf(file_bytes)
        run_record.pages_processed = parsed.page_count
        run_record.chunks_processed = len(parsed.chunks)

        await db.documents.update_one(
            {"_id": doc_id},
            {"$set": {"page_count": parsed.page_count}},
        )

        all_facts: List[FactCreate] = []
        settings = get_settings()
        use_local = settings.extractor_backend.lower() == "local"
        batch_size = settings.batch_size
        chunks_list = list(parsed.chunks)

        if use_local:
            logger.info("Using local flan-t5-large extractor for %d chunks", len(chunks_list))
            from app.services.local_fact_extractor import extract_facts_local
            loop = asyncio.get_event_loop()
            for chunk in chunks_list:
                page_full_text = parsed.page_texts[chunk.page_number]
                facts, failures = await loop.run_in_executor(
                    None,
                    extract_facts_local,
                    chunk.text, chunk.page_number, page_full_text, doc_id,
                )
                run_record.failures.extend(failures)
                for f in failures:
                    if f.get("type") == "validation_error":
                        run_record.facts_failed_validation += 1
                    elif f.get("type") == "evidence_location_error":
                        run_record.facts_failed_evidence += 1
                if facts:
                    embeddings = generate_fact_embeddings(facts)
                    for f_base, emb in zip(facts, embeddings):
                        all_facts.append(FactCreate(**f_base.model_dump(), embedding=emb))
        else:
            logger.info(
                "Using batched API extractor: %d chunks → ~%d LLM calls (batch_size=%d)",
                len(chunks_list),
                (len(chunks_list) + batch_size - 1) // batch_size,
                batch_size,
            )
            for i in range(0, len(chunks_list), batch_size):
                batch = chunks_list[i : i + batch_size]
                batch_data: List[ChunkTuple] = [
                    (c.text, c.page_number, parsed.page_texts[c.page_number])
                    for c in batch
                ]
                facts, failures = await extract_facts_from_batch(batch_data, doc_id)
                run_record.failures.extend(failures)
                for f in failures:
                    if f.get("type") == "validation_error":
                        run_record.facts_failed_validation += 1
                    elif f.get("type") in ("evidence_location_error", "evidence_location_warning"):
                        run_record.facts_failed_evidence += 1
                if facts:
                    embeddings = generate_fact_embeddings(facts)
                    for f_base, emb in zip(facts, embeddings):
                        all_facts.append(FactCreate(**f_base.model_dump(), embedding=emb))

        if all_facts:
            now = datetime.now(timezone.utc)
            db_facts = []
            for i, f in enumerate(all_facts):
                db_facts.append(
                    FactInDB(
                        _id=f"fact_{doc_id}_{i}",
                        created_at=now,
                        **f.model_dump(),
                    )
                )

            await db.facts.insert_many([f.model_dump(by_alias=True) for f in db_facts])
            run_record.facts_extracted = len(db_facts)

            await db.documents.update_one(
                {"_id": doc_id},
                {"$set": {"fact_count": len(db_facts)}},
            )

            fact_types = [f.type for f in db_facts]
            await register_fact_types(fact_types, example_fact_id=db_facts[0].id)

            relationships = await evaluate_new_facts_against_corpus(db_facts)
            if relationships:
                db_rels = []
                for i, r in enumerate(relationships):
                    db_rels.append(
                        {
                            "_id": f"rel_{doc_id}_{i}",
                            "created_at": now,
                            **r.model_dump(),
                        }
                    )
                try:
                    await db.relationships.insert_many(db_rels, ordered=False)
                    run_record.relationships_created = len(db_rels)
                except Exception as e:
                    logger.warning("Some relationships failed to insert (likely duplicates): %s", e)

        run_record.status = "done"
        run_record.finished_at = datetime.now(timezone.utc)
        await db.extraction_runs.replace_one({"_id": run_id}, run_record.model_dump(by_alias=True))

        await db.documents.update_one(
            {"_id": doc_id},
            {"$set": {"status": DocumentStatus.done}},
        )
        logger.info(
            "Pipeline done for %s: %d facts, %d relationships",
            filename, run_record.facts_extracted, run_record.relationships_created,
        )

    except Exception as e:
        logger.exception("Pipeline failed for %s: %s", doc_id, e)
        run_record.status = "failed"
        run_record.finished_at = datetime.now(timezone.utc)
        run_record.failures.append({"type": "fatal", "error": str(e)})
        await db.extraction_runs.replace_one({"_id": run_id}, run_record.model_dump(by_alias=True))
        await db.documents.update_one(
            {"_id": doc_id},
            {"$set": {"status": DocumentStatus.failed, "error_message": str(e)}},
        )
