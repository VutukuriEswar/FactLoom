from __future__ import annotations

import json
import logging
import re
from concurrent.futures import ThreadPoolExecutor
from functools import lru_cache
from typing import List, Optional, Tuple

from app.models.fact import EvidenceSpan, FactBase
from app.services.pdf_parser import locate_span

logger = logging.getLogger(__name__)

_executor = ThreadPoolExecutor(max_workers=1)

LOCAL_PROMPT = """\
Extract all concrete facts from the text below. Return ONLY a JSON array.
Each fact must have: type (snake_case string), subject (entity name), value (string), \
raw_text (exact quote from text), confidence (0.0-1.0).
Optional fields: unit, time_scope.
If no facts, return [].

Text:
{text}

JSON:"""


@lru_cache(maxsize=1)
def _get_pipeline():
    logger.info(
        "Loading local flan-t5-large model — first run will download ~750 MB to HuggingFace cache..."
    )
    from transformers import pipeline

    pipe = pipeline(
        "text2text-generation",
        model="google/flan-t5-large",
        max_new_tokens=1024,
    )
    logger.info("Local flan-t5-large model loaded and ready.")
    return pipe


def _run_inference(text: str) -> str:
    pipe = _get_pipeline()
    truncated = text[:2000]
    prompt = LOCAL_PROMPT.format(text=truncated)
    result = pipe(prompt, do_sample=False)
    return result[0]["generated_text"].strip()


def extract_facts_local(
    text: str,
    page_number: int,
    page_text: str,
    doc_id: str,
) -> Tuple[List[FactBase], List[dict]]:
    facts: List[FactBase] = []
    failures: List[dict] = []

    try:
        raw_output = _run_inference(text)
        logger.debug("Local model raw output: %s", raw_output[:300])

        match = re.search(r"\[.*?\]", raw_output, re.DOTALL)
        if not match:
            match = re.search(r"\{.*?\}", raw_output, re.DOTALL)
            if match:
                raw_output = f"[{match.group()}]"
                raw_facts = json.loads(raw_output)
            else:
                raise ValueError(f"No JSON found in model output: {raw_output[:200]}")
        else:
            raw_facts = json.loads(match.group())

        if not isinstance(raw_facts, list):
            raise ValueError("Expected a JSON array")

    except Exception as e:
        logger.error("Local model extraction failed: %s", str(e))
        failures.append({"type": "llm_error", "error": str(e), "chunk": text[:100] + "..."})
        return facts, failures

    for raw_fact in raw_facts:
        try:
            if not isinstance(raw_fact, dict):
                continue

            type_ = str(raw_fact.get("type", "unknown")).lower().replace(" ", "_")
            subject = str(raw_fact.get("subject", "")).strip()
            value = str(raw_fact.get("value", "")).strip()
            raw_text = str(raw_fact.get("raw_text", "")).strip()
            confidence = float(raw_fact.get("confidence", 0.5))

            if not all([subject, value, raw_text]):
                continue

            span = locate_span(page_text, raw_text)
            if not span:
                failures.append({
                    "type": "evidence_location_error",
                    "raw_fact": raw_fact,
                    "error": "Could not find verbatim quote in page text",
                })
                continue

            start, end = span
            evidence = EvidenceSpan(page=page_number, char_start=start, char_end=end)

            fact = FactBase(
                doc_id=doc_id,
                type=type_,
                subject=subject,
                value=value,
                unit=raw_fact.get("unit") or None,
                time_scope=raw_fact.get("time_scope") or None,
                raw_text=raw_text,
                evidence=evidence,
                confidence=min(max(confidence, 0.0), 1.0),
            )
            facts.append(fact)

        except Exception as e:
            logger.warning("Failed to process local model fact: %s | raw: %s", e, raw_fact)
            failures.append({"type": "validation_error", "raw_fact": raw_fact, "error": str(e)})

    logger.info("Local extraction: %d facts, %d failures", len(facts), len(failures))
    return facts, failures
