from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.db import close_db, init_db
from app.routers import documents, facts, relationships

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting up FactLoom API...")
    await init_db()
    try:
        from app.services.embeddings import get_embedding_model
        get_embedding_model()
    except Exception as e:
        logger.warning("Failed to pre-load embedding model on startup: %s", e)
    
    yield
    
    logger.info("Shutting down FactLoom API...")
    await close_db()


app = FastAPI(
    title="FactLoom API",
    description="Fact extraction and relationship evaluation layer.",
    version="1.0.0",
    lifespan=lifespan
)

settings = get_settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(documents.router)
app.include_router(facts.router)
app.include_router(relationships.router)


@app.get("/health", tags=["health"])
async def health_check():
    return {"status": "ok", "version": "1.0.0"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="0.0.0.0", port=settings.port, reload=True)
