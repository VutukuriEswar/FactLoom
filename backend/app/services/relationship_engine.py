from __future__ import annotations

import json
import logging
from itertools import combinations
from typing import List

import numpy as np
from openai import AsyncOpenAI
from pydantic import BaseModel, Field

from app.config import get_settings
from app.db import get_db
from app.models.fact import FactInDB
from app.models.relationship import RelationshipCreate, RelationType

logger = logging.getLogger(__name__)

COSINE_THRESHOLD = 0.35


class LLMRelationshipEval(BaseModel):
    relation: RelationType = Field(
        description="corroborates, contradicts, reconciled_by_context, or unrelated"
    )
    reasoning: str = Field(
        description="Short natural-language explanation citing both pieces of evidence"
    )
    reconciling_factors: List[str] = Field(
        default_factory=list,
        description="Factors if reconciled_by_context (e.g. ['time_period', 'unit'])",
    )
    confidence: float = Field(default=0.8, ge=0.0, le=1.0)


PROMPT_TEMPLATE = """
You are an expert analyst reviewing two extracted facts to determine their relationship.

Fact A:
- Subject: {sub_a}
- Type: {type_a}
- Value: {val_a} {unit_a}
- Time Scope: {time_a}
- Evidence Quote: "{quote_a}"

Fact B:
- Subject: {sub_b}
- Type: {type_b}
- Value: {val_b} {unit_b}
- Time Scope: {time_b}
- Evidence Quote: "{quote_b}"

Determine the relationship between Fact A and Fact B. Choose exactly one:
1. "corroborates": They agree or support the same conclusion, even if worded slightly differently.
2. "contradicts": They make genuinely conflicting claims that cannot be easily explained by context.
3. "reconciled_by_context": They appear to conflict, but context explains it (different time periods, units, or scope).
4. "unrelated": They are about different subjects or unrelated metrics.

Return ONLY a JSON object:
{{
  "relation": "corroborates | contradicts | reconciled_by_context | unrelated",
  "reasoning": "Explain WHY citing both evidence quotes. Be specific.",
  "reconciling_factors": ["time_period", "unit", "scope"],
  "confidence": 0.0
}}
"""


def _cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    norm_a = np.linalg.norm(a)
    norm_b = np.linalg.norm(b)
    if norm_a < 1e-9 or norm_b < 1e-9:
        return 0.0
    return float(np.dot(a, b) / (norm_a * norm_b))


def _strip_json(content: str) -> str:
    content = content.strip()
    if content.startswith("```json"):
        content = content[7:]
    elif content.startswith("```"):
        content = content[3:]
    if content.endswith("```"):
        content = content[:-3]
    return content.strip()


async def _classify_pair(
    fact_a: FactInDB,
    fact_b: FactInDB,
    client: AsyncOpenAI,
    model: str,
) -> LLMRelationshipEval | None:
    prompt = PROMPT_TEMPLATE.format(
        sub_a=fact_a.subject, type_a=fact_a.type,
        val_a=fact_a.value, unit_a=fact_a.unit or "N/A",
        time_a=fact_a.time_scope or "N/A", quote_a=fact_a.raw_text,
        sub_b=fact_b.subject, type_b=fact_b.type,
        val_b=fact_b.value, unit_b=fact_b.unit or "N/A",
        time_b=fact_b.time_scope or "N/A", quote_b=fact_b.raw_text,
    )
    try:
        response = await client.chat.completions.create(
            model=model,
            max_tokens=500,
            temperature=0.0,
            messages=[{"role": "user", "content": prompt}],
        )
        content = _strip_json(response.choices[0].message.content or "")
        eval_dict = json.loads(content)
        return LLMRelationshipEval.model_validate(eval_dict)
    except Exception as e:
        logger.error("Failed to evaluate relationship pair (%s ↔ %s): %s", fact_a.id, fact_b.id, e)
        return None


async def evaluate_new_facts_against_corpus(
    new_facts: List[FactInDB],
) -> List[RelationshipCreate]:
    if not new_facts:
        return []

    settings = get_settings()
    db = get_db()
    client = AsyncOpenAI(
        api_key=settings.openrouter_api_key,
        base_url="https://openrouter.ai/api/v1",
    )

    relationships: List[RelationshipCreate] = []
    seen_pairs: set[tuple[str, str]] = set()

    def _add_rel(eval_obj: LLMRelationshipEval, fa: FactInDB, fb: FactInDB) -> None:
        if eval_obj.relation == RelationType.unrelated:
            return
        pair = (min(fa.id, fb.id), max(fa.id, fb.id))
        if pair in seen_pairs:
            return
        seen_pairs.add(pair)
        relationships.append(
            RelationshipCreate(
                fact_id_a=fa.id,
                fact_id_b=fb.id,
                relation=eval_obj.relation,
                reasoning=eval_obj.reasoning,
                reconciling_factors=eval_obj.reconciling_factors,
                confidence=eval_obj.confidence,
            )
        )

    new_doc_ids = list(set(f.doc_id for f in new_facts))
    cursor = db.facts.find({"doc_id": {"$nin": new_doc_ids}})
    existing_facts = [FactInDB.model_validate(doc) async for doc in cursor]

    if existing_facts:
        corpus_embeddings = np.array([f.embedding for f in existing_facts])
        top_k = settings.top_k_candidates

        for new_fact in new_facts:
            new_emb = np.array(new_fact.embedding)
            scores = np.array([
                _cosine_similarity(corpus_embeddings[i], new_emb)
                for i in range(len(existing_facts))
            ])

            if len(scores) <= top_k:
                top_indices = np.argsort(scores)[::-1]
            else:
                top_indices = np.argpartition(scores, -top_k)[-top_k:]
                top_indices = top_indices[np.argsort(scores[top_indices])[::-1]]

            for idx in top_indices:
                if scores[idx] < COSINE_THRESHOLD:
                    continue
                candidate = existing_facts[idx]
                eval_obj = await _classify_pair(new_fact, candidate, client, settings.openrouter_model)
                if eval_obj:
                    _add_rel(eval_obj, new_fact, candidate)
    else:
        logger.info("No existing cross-document corpus — skipping cross-doc pass.")

    if len(new_facts) >= 2:
        new_embeddings = np.array([f.embedding for f in new_facts])
        top_k = settings.top_k_candidates

        for i, fact_a in enumerate(new_facts):
            emb_a = new_embeddings[i]
            scores = np.array([
                _cosine_similarity(new_embeddings[j], emb_a) if j != i else -1.0
                for j in range(len(new_facts))
            ])

            if len(scores) <= top_k:
                top_indices = np.argsort(scores)[::-1]
            else:
                top_indices = np.argpartition(scores, -top_k)[-top_k:]
                top_indices = top_indices[np.argsort(scores[top_indices])[::-1]]

            for idx in top_indices:
                if scores[idx] < COSINE_THRESHOLD:
                    continue
                fact_b = new_facts[idx]
                pair = (min(fact_a.id, fact_b.id), max(fact_a.id, fact_b.id))
                if pair in seen_pairs:
                    continue
                eval_obj = await _classify_pair(fact_a, fact_b, client, settings.openrouter_model)
                if eval_obj:
                    _add_rel(eval_obj, fact_a, fact_b)

    logger.info("Relationship evaluation complete: %d relationships found", len(relationships))
    return relationships
