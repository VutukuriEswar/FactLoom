from __future__ import annotations

import json
import logging
import re
from typing import List, Optional, Tuple

from openai import AsyncOpenAI, RateLimitError
from pydantic import BaseModel, ValidationError
from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

from app.config import get_settings
from app.models.fact import EvidenceSpan, FactBase
from app.services.pdf_parser import locate_span

logger = logging.getLogger(__name__)

ChunkTuple = Tuple[str, int, str]


class ExtractedFactLLM(BaseModel):
    page_number: int
    type: str
    subject: str
    value: str
    unit: Optional[str] = None
    time_scope: Optional[str] = None
    raw_text: str
    confidence: float


BATCH_PROMPT_TEMPLATE = """\
You are an expert fact extractor. Extract concrete, verifiable facts from the text sections below.
A "fact" can be a financial metric, headcount, address, regulatory status, person's role, date, etc.

Rules:
1. Return ONLY a valid JSON array of fact objects. No markdown, no preamble, no explanation.
   Start your response with [ and end with ].
2. If a section has no facts, return an empty array: []
3. Each fact object must include ALL of these fields:
   - "page_number": integer — copied exactly from the section header (e.g. PAGE 3 → 3)
   - "type": descriptive snake_case string (e.g. "revenue", "employee_headcount", "hq_address")
   - "subject": the entity the fact is about (e.g. "Delhivery Ltd", "India GDP")
   - "value": the core data point as a string (e.g. "150.5", "Active", "Mumbai")
   - "unit": optional string (e.g. "INR Cr", "%", "employees") — omit if not applicable
   - "time_scope": optional string (e.g. "FY2023", "Q1 2024") — omit if not applicable
   - "raw_text": the EXACT verbatim sentence or phrase from the section proving the fact
   - "confidence": float 0.0–1.0

{sections}
"""

RETRY_PROMPT_SUFFIX = "\n\nIMPORTANT: Your response MUST begin with [ and end with ]. No other text."


def _build_batch_prompt(chunks: List[ChunkTuple], retry: bool = False) -> str:
    sections = ""
    for text, page_number, _ in chunks:
        sections += f"\n=== PAGE {page_number} ===\n{text}\n"
    prompt = BATCH_PROMPT_TEMPLATE.format(sections=sections)
    if retry:
        prompt += RETRY_PROMPT_SUFFIX
    return prompt


def _extract_json_array(content: str) -> str:
    content = content.strip()

    if content.startswith("```json"):
        content = content[7:]
    elif content.startswith("```"):
        content = content[3:]
    if content.endswith("```"):
        content = content[:-3]
    content = content.strip()

    if content.startswith("["):
        return content

    match = re.search(r'\[.*\]', content, re.DOTALL)
    if match:
        return match.group(0)

    if content.startswith("{"):
        return f"[{content}]"

    return content


def _parse_facts_json(content: str) -> list:
    extracted = _extract_json_array(content)
    try:
        result = json.loads(extracted)
        if isinstance(result, list):
            return result
        if isinstance(result, dict):
            return [result]
        return []
    except json.JSONDecodeError:
        cleaned = re.sub(r',\s*([\]\}])', r'\1', extracted)
        try:
            result = json.loads(cleaned)
            return result if isinstance(result, list) else [result]
        except json.JSONDecodeError:
            logger.error("JSON decode failed even after repair. Raw: %.200s", content)
            raise


@retry(
    retry=retry_if_exception_type(RateLimitError),
    stop=stop_after_attempt(6),
    wait=wait_exponential(multiplier=2, min=5, max=60),
    reraise=True,
)
async def _call_llm(client: AsyncOpenAI, model: str, prompt: str) -> str:
    response = await client.chat.completions.create(
        model=model,
        max_tokens=4096,
        temperature=0.0,
        messages=[{"role": "user", "content": prompt}],
    )
    return response.choices[0].message.content or ""


async def extract_facts_from_batch(
    chunks: List[ChunkTuple],
    doc_id: str,
) -> Tuple[List[FactBase], List[dict]]:
    settings = get_settings()
    client = AsyncOpenAI(
        api_key=settings.openrouter_api_key,
        base_url="https://openrouter.ai/api/v1",
    )

    page_texts: dict[int, str] = {pn: pt for _, pn, pt in chunks}

    facts: List[FactBase] = []
    failures: List[dict] = []

    logger.info(
        "Sending batch of %d chunks (pages %s) to LLM",
        len(chunks), [pn for _, pn, _ in chunks]
    )

    raw_facts = []
    for attempt_is_retry in [False, True]:
        prompt = _build_batch_prompt(chunks, retry=attempt_is_retry)
        try:
            content = await _call_llm(client, settings.openrouter_model, prompt)
            raw_facts = _parse_facts_json(content)
            break
        except Exception as e:
            if not attempt_is_retry:
                logger.warning("First LLM attempt failed (%s), retrying with stricter prompt…", e)
                continue
            logger.error("Batch LLM call or JSON parsing failed after retry: %s", e)
            failures.append({
                "type": "llm_error",
                "error": str(e),
                "chunk": f"batch of {len(chunks)} chunks (pages {[pn for _, pn, _ in chunks]})",
            })
            return facts, failures

    for raw_fact in raw_facts:
        try:
            llm_fact = ExtractedFactLLM.model_validate(raw_fact)
        except ValidationError as e:
            logger.warning("Fact validation failed: %s | raw: %s", e, raw_fact)
            failures.append({"type": "validation_error", "raw_fact": raw_fact, "error": str(e)})
            continue

        page_text = page_texts.get(llm_fact.page_number)
        if page_text is None:
            page_text = next(iter(page_texts.values()), "")
            fallback_page = next(iter(page_texts.keys()), llm_fact.page_number)
            logger.warning(
                "page_number %d not in batch pages %s — using page %d as fallback",
                llm_fact.page_number, list(page_texts.keys()), fallback_page,
            )
            llm_fact = llm_fact.model_copy(update={"page_number": fallback_page})

        span = locate_span(page_text, llm_fact.raw_text)
        if span:
            char_start, char_end = span
        else:
            logger.info(
                "Evidence span not found for '%s…'; using fallback span (char 0)",
                llm_fact.raw_text[:60],
            )
            char_start, char_end = 0, min(len(llm_fact.raw_text), len(page_text))
            failures.append({
                "type": "evidence_location_warning",
                "raw_fact": raw_fact,
                "note": "Fact kept but span is approximate (char 0 fallback)",
            })

        evidence = EvidenceSpan(
            page=llm_fact.page_number,
            char_start=char_start,
            char_end=char_end,
        )

        fact = FactBase(
            doc_id=doc_id,
            type=llm_fact.type.lower().replace(" ", "_"),
            subject=llm_fact.subject,
            value=llm_fact.value,
            unit=llm_fact.unit,
            time_scope=llm_fact.time_scope,
            raw_text=llm_fact.raw_text,
            evidence=evidence,
            confidence=max(0.0, min(1.0, llm_fact.confidence)),
        )
        facts.append(fact)

    logger.info("Batch complete: %d facts extracted, %d issues", len(facts), len(failures))
    return facts, failures
