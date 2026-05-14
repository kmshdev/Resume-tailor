# Backend Architecture

> FastAPI + Python 3.13+ | TinyDB | LiteLLM multi-provider

## Directory Structure

```
apps/backend/app/
├── main.py              # FastAPI entry point
├── config.py            # Pydantic settings
├── database.py          # TinyDB wrapper
├── llm.py               # LiteLLM multi-provider
├── pdf.py               # Playwright PDF rendering
├── routers/             # API endpoints
├── services/            # parser, improver, cover_letter, evaluation, job_intake
├── schemas/             # Pydantic models
└── prompts/             # LLM prompt templates
```

## API Endpoints

### Health & Status
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/health` | LLM health check |
| GET | `/api/v1/status` | Full system status |

### Configuration
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET/PUT | `/api/v1/config/llm-api-key` | LLM config |
| POST | `/api/v1/config/llm-test` | Test connection |

### Resumes
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/resumes/upload` | Upload PDF/DOCX |
| GET | `/resumes?resume_id=` | Fetch resume |
| GET | `/resumes/list` | List all |
| POST | `/resumes/improve` | Tailor for job (LLM) |
| PATCH | `/resumes/{id}` | Update |
| GET | `/resumes/{id}/pdf` | Download PDF |
| DELETE | `/resumes/{id}` | Delete |

### Jobs
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/jobs/upload` | Store job description |
| GET | `/jobs/{id}` | Fetch job |

### Job Intake
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/jobs/intake/extract` | Extract reviewable JD text and metadata from manual text, job URL, PDF URL, or recruiter message |
| POST | `/jobs/intake/pdf-upload` | Extract reviewable JD text from uploaded PDF bytes |
| POST | `/jobs/intake/confirm` | Persist reviewed JD text as canonical job content |

### Resume Evaluations
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/resumes/{id}/evaluations` | Create or fetch cached readiness/pre-tailor/post-tailor evaluation |
| GET | `/resumes/{id}/evaluations` | List stored evaluations, optionally filtered by phase or job |
| GET | `/resumes/{id}/evaluations/latest` | Return latest evaluations grouped by phase |

## Database (`database.py`)

TinyDB tables: `resumes`, `jobs`, `improvements`, `evaluations`

```python
db.create_resume(content, content_type, filename, is_master, processed_data)
db.get_resume(resume_id) → dict | None
db.update_resume(resume_id, updates)
db.delete_resume(resume_id) → bool
db.set_master_resume(resume_id)  # Only one master allowed
db.get_stats() → {total_resumes, total_jobs, total_improvements}
db.create_job(content, resume_id, intake_metadata)
db.create_evaluation(payload)
db.list_evaluations(resume_id, phase, job_id)
```

## LLM Integration (`llm.py`)

**Providers:** OpenAI, Anthropic, Gemini, DeepSeek, OpenRouter, Ollama

```python
await check_llm_health(config)     # 30s timeout
await complete(prompt, ...)        # 120s timeout
await complete_json(prompt, ...)   # 180s timeout, JSON mode + retries
```

**Key Features:**
- API keys passed directly (avoids os.environ race conditions)
- Auto JSON mode for supported providers
- 2 retries with lower temperature
- Bracket-matching JSON extraction

## Services

### Parser (`services/parser.py`)
```python
await parse_document(content, filename) → str  # PDF/DOCX → Markdown
await parse_resume_to_json(markdown) → dict    # LLM call
```

### Improver (`services/improver.py`)
```python
await extract_job_keywords(job_desc) → dict    # LLM call
await improve_resume(original, job, keywords)  # LLM call
```

### Cover Letter (`services/cover_letter.py`)
```python
await generate_cover_letter(resume, job) → str    # LLM call
await generate_outreach_message(resume, job) → str # LLM call
```

### Job Intake (`services/job_intake/`)

Extracts JD text from manual text, public job URLs, PDF URLs/uploads, and pasted recruiter messages. The service validates public URLs, redacts display/persisted URLs, rejects unsupported remote content types, keeps screening questions separate, and returns no raw scraped text.

### Evaluation (`services/evaluation.py`)

Creates structured LLM evaluations for `readiness`, `pre_tailor`, and `post_tailor`. Scores are clamped to 0-100, malformed evidence is discarded, results are cached by source hash, and provider/config failures are mapped to user-safe API errors.

## PDF Rendering (`pdf.py`)

Uses Playwright headless Chromium:

```python
await render_resume_pdf(url, page_size, selector=".resume-print")
```

**Critical:** CSS must whitelist print classes in `globals.css`:
```css
@media print {
  body * { visibility: hidden !important; }
  .resume-print, .resume-print * { visibility: visible !important; }
}
```

## Configuration

```bash
LLM_PROVIDER=openai|anthropic|gemini|deepseek|openrouter|ollama
LLM_MODEL=gpt-5-nano-2025-08-07
LLM_API_KEY=sk-...
FRONTEND_BASE_URL=http://localhost:3000
```

Config stored in `data/config.json`, takes precedence over env vars.

## Error Handling

Log detailed errors server-side, return generic messages to clients:
```python
except Exception as e:
    logger.error(f"Failed: {e}")
    raise HTTPException(500, "Operation failed. Please try again.")
```
