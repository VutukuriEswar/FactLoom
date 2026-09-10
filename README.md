# FactLoom — Fact Knowledge Layer

## What is FactLoom?

FactLoom is an AI-powered document intelligence platform that transforms raw PDF documents into a structured, queryable knowledge graph. It extracts concrete, verifiable facts from uploaded documents using a large language model, generates semantic embeddings for each fact, and automatically evaluates cross-document relationships — surfacing corroborations, contradictions, and contextual reconciliations between facts from different sources. The system is designed for analysts, researchers, and knowledge workers who need to reconcile information across multiple documents at scale.

## Key Features

📄 **Intelligent Fact Extraction**
- Upload any text-based PDF and the pipeline automatically parses, chunks, and submits each page to an LLM for structured fact extraction.
- Facts are extracted as typed, grounded data points: subject, value, unit, time scope, and a verbatim evidence quote.
- Supports an open-vocabulary fact type system — new categories (e.g. `revenue`, `headcount`, `gdp_growth_forecast`) are registered automatically with zero code changes.
- **Dual Extraction Backends:** Use the batched OpenRouter API (default, frontier-quality) or switch to a fully local `google/flan-t5-large` model via a single `.env` flag — no API key required.

🔗 **Automated Cross-Document Relationship Engine**
- After ingestion, every new fact is compared against the existing corpus using semantic cosine similarity to identify candidate pairs.
- An LLM then classifies each candidate pair as `corroborates`, `contradicts`, `reconciled_by_context`, or `unrelated`.
- **Two-Pass Evaluation:** Relationships are detected both across documents and within a single newly ingested document.
- The LLM provides a natural-language reasoning trace and lists reconciling factors (e.g. `time_period`, `unit`, `scope`) when relevant.

🗃️ **Dynamic Schema Registry**
- The system maintains a live registry of all fact types ever seen, with automatic upserts and example fact references.
- The registry is exposed via API and surfaced in the UI as a filterable fact-type selector.

🔍 **Evidence-Grounded Search & Exploration**
- Every fact stores an exact character-level evidence span (page number, `char_start`, `char_end`) linking it back to its source.
- Full-text search across subject, value, and raw quote fields powered by a MongoDB text index.
- Filter facts by document, type, or free-text search; click any fact to open a detail drawer showing the source quote and confidence score.

📊 **Rich Analytics Dashboard**
- At-a-glance stats: total documents, facts, relationships, and contradictions detected.
- Recent document and extraction run history with per-run metrics (facts extracted, relationships created, validation failures).
- Inline processing status with automatic polling refresh while documents are being processed.

🎭 **Demo Cases**
- Four built-in reference scenarios illustrating every relationship type: revenue corroboration, GDP contradiction, inflation reconciled by time scope, and evidence span fallback handling.
- A **Live Data** tab dynamically loads real relationships from your own ingested documents alongside the static cases.

## Tech Stack

**Backend:**
- **FastAPI** (Python async web framework)
- **MongoDB** with **Motor** for async database operations and full-text indexing
- **PyMuPDF (fitz)** for PDF text extraction with character-level offsets
- **OpenAI SDK** pointed at **OpenRouter** for LLM-powered fact extraction and relationship classification
- **Sentence Transformers** (`all-MiniLM-L6-v2`) for semantic fact embeddings
- **NumPy** for cosine similarity candidate ranking
- **Tenacity** for retry logic with exponential back-off on rate limit errors
- **Pydantic v2** & **pydantic-settings** for validated configuration and data models
- **HuggingFace Transformers** (`google/flan-t5-large`) for the optional local extraction backend

**Frontend:**
- **React** for UI components and routing
- **Vanilla CSS** with CSS custom properties for the full design system (dark mode, glassmorphism, animations)
- **Axios** for API communication with upload progress tracking
- **React Router v6** for client-side navigation

## Quick Start Guide

### Prerequisites
- Python 3.10+
- Node.js 18+ & npm
- MongoDB (local or cloud, e.g. MongoDB Atlas)
- An [OpenRouter](https://openrouter.ai/) API key (or set `EXTRACTOR_BACKEND=local` to run fully offline)

### Installation Steps

1. **Clone the repository**
```bash
git clone https://github.com/your-username/FactLoom.git
cd FactLoom
```

2. **Set up Python virtual environment**
```bash
python -m venv venv
venv\Scripts\activate   # On Linux/macOS: source venv/bin/activate
```

3. **Install backend dependencies**
```bash
cd backend
pip install -r requirements.txt
```

4. **Configure environment**

Copy `.env.example` to `.env` and fill in your values:
```bash
cp .env.example .env
```
```env
OPENROUTER_API_KEY=sk-or-...
OPENROUTER_MODEL=anthropic/claude-sonnet-4-5
MONGODB_URI=mongodb://localhost:27017
MONGODB_DB_NAME=factloom
EXTRACTOR_BACKEND=api        # or "local" for offline flan-t5-large
BATCH_SIZE=5
```

5. **Run the backend server**
```bash
uvicorn server:app --reload --port 8000
```

6. **Install frontend dependencies & start**

Open a new terminal:
```bash
cd frontend
npm install
npm start
```

The app will be available at `http://localhost:3000`.

## API Endpoints

**Documents:**
- `POST /documents` — Upload a PDF; returns `202` immediately with `status=processing`
- `GET /documents` — List all documents sorted by upload time
- `GET /documents/{id}` — Poll a single document's status and fact count
- `DELETE /documents/{id}` — Delete a document and all its associated facts and relationships

**Facts:**
- `GET /facts` — List facts with optional `doc_id`, `type`, and full-text `search` filters
- `GET /facts/{id}` — Get a single fact by ID
- `GET /facts/{id}/evidence` — Get the fact with its source document filename and evidence span
- `GET /fact-types` — List the dynamic schema registry of all seen fact types

**Relationships:**
- `GET /relationships` — List relationships with optional `relation` type filter
- `GET /relationships/{id}` — Get a relationship with full details of both facts

**Audit & Health:**
- `GET /extraction-runs` — Audit log of all ingestion runs with per-chunk failure details
- `GET /health` — API liveness check

## Pipeline Architecture

```
PDF Upload
    │
    ▼
PDF Parsing (PyMuPDF)
    │  ─ per-page text with char offsets
    │  ─ smart chunking at paragraph boundaries (~3,000 chars/chunk)
    ▼
Fact Extraction (LLM — batched)
    │  ─ structured JSON: type, subject, value, unit, time_scope, raw_text, confidence
    │  ─ JSON repair & retry on malformed responses
    │  ─ evidence span location with fuzzy fallback
    ▼
Semantic Embedding (Sentence Transformers)
    │  ─ natural-language fact serialization → 384-dim vector
    ▼
Schema Registry (MongoDB upsert)
    │  ─ auto-registers new fact types
    ▼
Relationship Evaluation (LLM — pairwise)
    │  ─ Pass 1: new facts vs. existing corpus (cosine similarity candidates)
    │  ─ Pass 2: intra-document pairs within the new upload
    │  ─ LLM classifies + explains each relationship
    ▼
MongoDB Storage
```

## Configuration Reference

| Variable | Default | Description |
|---|---|---|
| `OPENROUTER_API_KEY` | *(required)* | OpenRouter API key |
| `OPENROUTER_MODEL` | `anthropic/claude-sonnet-4-5` | LLM model slug |
| `EXTRACTOR_BACKEND` | `api` | `api` (OpenRouter) or `local` (flan-t5-large) |
| `BATCH_SIZE` | `5` | Chunks per LLM API call |
| `MONGODB_URI` | `mongodb://localhost:27017` | MongoDB connection string |
| `MONGODB_DB_NAME` | `factloom` | Database name |
| `CORS_ORIGINS` | `http://localhost:5173` | Comma-separated allowed origins |
| `MAX_UPLOAD_MB` | `50` | Maximum PDF upload size |
| `EMBEDDING_MODEL` | `all-MiniLM-L6-v2` | Sentence Transformer model name |
| `TOP_K_CANDIDATES` | `5` | Top-K cosine similarity candidates per fact for relationship evaluation |
| `PORT` | `8000` | Uvicorn server port |

## Known Behaviours & Edge Cases

- **Evidence Span Fallback:** If the LLM quotes a paraphrase that doesn't appear verbatim in the page text, the fact is kept with `char_start=0` rather than discarded. The `raw_text` field still carries the original quote for display.
- **Duplicate Detection:** Re-uploading an identical PDF (same SHA-256 hash) with `status=done` returns the existing document immediately. Failed or stuck documents are reset and reprocessed.
- **Relationship Deduplication:** The engine uses a `(min_id, max_id)` pair set to prevent inserting the same pair twice within a single pipeline run, and MongoDB's unique compound index enforces this across runs.
- **Local Backend Quality:** The `flan-t5-large` local backend requires stricter evidence matching (no fallback span) and generally produces fewer, lower-confidence facts than the API backend.

## License

This project is licensed under the **MIT License** — see the [LICENSE](./LICENSE) file for details.

© 2026 Eswar Vutukuri

## Acknowledgements

Thanks to [OpenRouter](https://openrouter.ai/) for providing a unified API gateway to frontier models. Thanks to [HuggingFace](https://huggingface.co/) and the [Sentence Transformers](https://www.sbert.net/) community for the embedding models that make semantic candidate ranking possible. Thanks to [MongoDB](https://www.mongodb.com/) for the flexible document store and [Motor](https://motor.readthedocs.io/) for the async driver. Thanks to [FastAPI](https://fastapi.tiangolo.com/) for the modern Python web framework and [PyMuPDF](https://pymupdf.readthedocs.io/) for reliable PDF text extraction with character-level offsets.
