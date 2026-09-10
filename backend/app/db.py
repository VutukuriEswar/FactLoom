from __future__ import annotations

import logging

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from app.config import get_settings

logger = logging.getLogger(__name__)

_client: AsyncIOMotorClient | None = None
_db: AsyncIOMotorDatabase | None = None


def get_db() -> AsyncIOMotorDatabase:
    if _db is None:
        raise RuntimeError("Database not initialised — call init_db() first.")
    return _db


async def init_db() -> None:
    global _client, _db

    settings = get_settings()
    _client = AsyncIOMotorClient(settings.mongodb_uri)
    _db = _client[settings.mongodb_db_name]

    await _ensure_indexes(_db)
    logger.info("MongoDB connected: %s / %s", settings.mongodb_uri, settings.mongodb_db_name)


async def close_db() -> None:
    global _client, _db
    if _client:
        _client.close()
        _client = None
        _db = None
    logger.info("MongoDB connection closed.")


async def _ensure_indexes(db: AsyncIOMotorDatabase) -> None:
    await db.documents.create_index("content_hash")
    await db.documents.create_index("uploaded_at")
    await db.documents.create_index("status")

    await db.facts.create_index("doc_id")
    await db.facts.create_index("type")
    await db.facts.create_index("subject")
    await db.facts.create_index([("subject", "text"), ("raw_text", "text"), ("value", "text")])

    await db.fact_types.create_index("type_name", unique=True)

    await db.relationships.create_index("fact_id_a")
    await db.relationships.create_index("fact_id_b")
    await db.relationships.create_index("relation")
    await db.relationships.create_index([("fact_id_a", 1), ("fact_id_b", 1)], unique=True)

    await db.extraction_runs.create_index("doc_id")
    await db.extraction_runs.create_index("started_at")

    logger.info("MongoDB indexes verified.")
