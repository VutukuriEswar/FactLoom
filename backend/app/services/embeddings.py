from __future__ import annotations

import logging
from typing import List

from sentence_transformers import SentenceTransformer

from app.config import get_settings
from app.models.fact import FactBase

logger = logging.getLogger(__name__)

_model: SentenceTransformer | None = None

def get_embedding_model() -> SentenceTransformer:
    global _model
    if _model is None:
        settings = get_settings()
        logger.info("Loading embedding model: %s", settings.embedding_model)
        _model = SentenceTransformer(settings.embedding_model)
    return _model

def generate_fact_embeddings(facts: List[FactBase]) -> List[List[float]]:
    if not facts:
        return []

    model = get_embedding_model()
    
    texts = []
    for f in facts:
        text = f"Fact: {f.subject} has {f.type} of {f.value}"
        if f.unit:
            text += f" {f.unit}"
        if f.time_scope:
            text += f" ({f.time_scope})"
        texts.append(text)

    embeddings = model.encode(texts, convert_to_numpy=True)
    
    return [emb.tolist() for emb in embeddings]
