"""Best-effort LLM cleanup for noisy JD intake text."""

import logging
from typing import Any

from app.llm import complete_json, get_llm_config, get_model_name, get_safe_max_tokens
from app.prompts.job_intake import JOB_INTAKE_EXTRACTION_PROMPT
from app.services.job_intake.constants import MAX_SOURCE_TEXT_CHARS

logger = logging.getLogger(__name__)


async def maybe_refine_with_llm(raw_text: str) -> dict[str, Any] | None:
    """Best-effort LLM cleanup for large noisy source text."""
    if len(raw_text) < 800:
        return None

    config = get_llm_config()
    if not config.api_key and config.provider not in {"ollama", "openai_compatible"}:
        return None

    try:
        model_name = get_model_name(config)
        return await complete_json(
            prompt=JOB_INTAKE_EXTRACTION_PROMPT.format(
                source_text=raw_text[:MAX_SOURCE_TEXT_CHARS],
            ),
            system_prompt="You extract job descriptions into compact JSON.",
            max_tokens=min(get_safe_max_tokens(model_name), 4096),
            retries=1,
            schema_type="keywords",
        )
    except Exception as exc:
        logger.warning("JD intake LLM cleanup failed: %s", exc)
        return None
