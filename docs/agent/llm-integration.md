# LLM Integration Guide

> **Multi-provider AI support, JSON handling, and prompt guidelines.**

## Multi-Provider Support

Backend uses LiteLLM to support multiple providers through a unified API:

| Provider | Type | Notes |
|----------|------|-------|
| **Ollama** | Local | Free, runs on your machine |
| **OpenAI** | Cloud | GPT-5 Nano, GPT-4o |
| **Anthropic** | Cloud | Claude Haiku 4.5 |
| **Google Gemini** | Cloud | Gemini 3 Flash |
| **OpenRouter** | Cloud | Access to multiple models |
| **DeepSeek** | Cloud | DeepSeek Chat |

## API Key Handling

API keys are passed directly to `litellm.acompletion()` via the `api_key` parameter (not via `os.environ`) to avoid race conditions in async contexts.

```python
# Correct
await litellm.acompletion(
    model=model,
    messages=messages,
    api_key=api_key  # Direct parameter
)

# Incorrect - don't use os.environ in async code
os.environ["OPENAI_API_KEY"] = key  # Race condition risk
```

## JSON Mode

The `complete_json()` function automatically enables `response_format={"type": "json_object"}` for providers that support it:

- OpenAI
- Anthropic
- Gemini
- DeepSeek
- Major OpenRouter models

## Retry Logic

JSON completions include 2 automatic retries with progressively lower temperature:

- Attempt 1: temperature 0.1
- Attempt 2: temperature 0.0

## JSON Extraction

Robust bracket-matching algorithm in `_extract_json()` handles:

- Malformed responses
- Markdown code blocks
- Edge cases
- Infinite recursion protection when content starts with `{` but matching fails

## Error Handling Pattern

LLM functions log detailed errors server-side but return generic messages to clients:

```python
except Exception as e:
    logger.error(f"LLM completion failed: {e}")
    raise ValueError("LLM completion failed. Please check your API configuration.")
```

## Adding Prompts

Add new prompt templates under `apps/backend/app/prompts/`. Tailoring prompts remain in `templates.py`; feature-specific prompts live in files such as `evaluation.py`, `job_intake.py`, and `enrichment.py`.

### Tailored Resume Workflow

Resume tailoring prompts include a shared `TAILORED_RESUME_SKILL_GUIDANCE` block adapted from the Composio tailored-resume-generator skill. Keep that guidance wired into:

- `EXTRACT_KEYWORDS_PROMPT` for priority requirements, ATS keywords, soft skills, industry context, and company values.
- `SKILL_TARGET_PLAN_PROMPT` for verified skill targeting before diff generation.
- `DIFF_IMPROVE_PROMPT` and `IMPROVE_RESUME_PROMPTS` for conservative ATS-friendly resume edits.

The app exposes this as the first prompt option, `tailored_resume_generator`, and uses it as the default tailoring strategy when no saved default exists.

Smoke-test expectation: the backend should extract job priorities, verify skill targets against the resume/JD, pass accepted targets into diff generation and `apply_diffs()`, and reject unsupported skill additions.

### Prompt Guidelines

1. Use `{variable}` for substitution (single braces)
2. Include example JSON schemas for structured outputs
3. Keep instructions concise: "Output ONLY the JSON object, no other text"

### Example

```python
IMPROVE_BULLET = """
Improve this resume bullet point for a {job_title} position.

Current: {current_bullet}

Output ONLY the improved bullet point, no explanations.
"""
```

## Provider Configuration

Users configure their preferred AI provider via:

- Settings page: `/settings`
- API: `PUT /api/v1/config/llm-api-key`

## Health Checks

The `/api/v1/health` endpoint validates LLM connectivity.

> **Note**: Docker health checks must use `/api/v1/health` (not `/health`).

## Timeouts

All LLM calls have configurable timeouts:

| Operation | Timeout |
|-----------|---------|
| Health checks | 30s |
| Completions | 120s |
| JSON operations | 180s |

## Key Files

| File | Purpose |
|------|---------|
| `apps/backend/app/llm.py` | LiteLLM wrapper with JSON mode |
| `apps/backend/app/prompts/templates.py` | Resume tailoring prompt templates |
| `apps/backend/app/prompts/enrichment.py` | Enrichment-specific prompts |
| `apps/backend/app/prompts/evaluation.py` | Structured resume evaluation prompt |
| `apps/backend/app/prompts/job_intake.py` | JD/recruiter-message extraction prompt |
| `apps/backend/app/config.py` | Provider configuration |
