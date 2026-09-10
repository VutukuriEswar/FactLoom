from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import List

import fitz

logger = logging.getLogger(__name__)

MAX_CHUNK_CHARS = 3_000


@dataclass
class PageChunk:
    page_number: int
    char_start: int
    char_end: int
    text: str


@dataclass
class ParsedDocument:
    page_count: int
    chunks: List[PageChunk] = field(default_factory=list)
    page_texts: dict[int, str] = field(default_factory=dict)


def parse_pdf(file_bytes: bytes) -> ParsedDocument:
    doc = fitz.open(stream=file_bytes, filetype="pdf")
    result = ParsedDocument(page_count=len(doc))

    for page_index in range(len(doc)):
        page_num = page_index + 1
        page = doc[page_index]

        text: str = page.get_text("text")
        if not text.strip():
            logger.debug("Page %d is blank or image-only — skipping.", page_num)
            continue

        result.page_texts[page_num] = text

        chunks = _chunk_page_text(text, page_num)
        result.chunks.extend(chunks)

    doc.close()
    logger.info(
        "Parsed PDF: %d pages, %d chunks.", result.page_count, len(result.chunks)
    )
    return result


def _chunk_page_text(text: str, page_num: int) -> List[PageChunk]:
    if len(text) <= MAX_CHUNK_CHARS:
        return [PageChunk(page_number=page_num, char_start=0, char_end=len(text), text=text)]

    chunks: List[PageChunk] = []
    cursor = 0

    while cursor < len(text):
        end = cursor + MAX_CHUNK_CHARS
        if end >= len(text):
            chunk_text = text[cursor:]
            chunks.append(
                PageChunk(
                    page_number=page_num,
                    char_start=cursor,
                    char_end=cursor + len(chunk_text),
                    text=chunk_text,
                )
            )
            break

        split_pos = text.rfind("\n\n", cursor, end)
        if split_pos == -1 or split_pos <= cursor:
            split_pos = text.rfind("\n", cursor, end)
        if split_pos == -1 or split_pos <= cursor:
            split_pos = end

        chunk_text = text[cursor:split_pos]
        chunks.append(
            PageChunk(
                page_number=page_num,
                char_start=cursor,
                char_end=split_pos,
                text=chunk_text,
            )
        )
        cursor = split_pos

    return chunks


def locate_span(page_text: str, raw_text: str) -> tuple[int, int] | None:
    idx = page_text.find(raw_text)
    if idx != -1:
        return idx, idx + len(raw_text)

    lower_page = page_text.lower()
    lower_raw = raw_text.lower()
    idx = lower_page.find(lower_raw)
    if idx != -1:
        return idx, idx + len(raw_text)

    snippet = raw_text[:60].strip()
    if len(snippet) > 15:
        lower_snippet = snippet.lower()
        idx = lower_page.find(lower_snippet)
        if idx != -1:
            return idx, min(idx + len(raw_text), len(page_text))

    return None
