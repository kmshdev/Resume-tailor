"""Prompt builder for evidence-grounded resume evaluations."""

from app.schemas.evaluation import EvaluationPhase

PROMPT_VERSION = "resume_evaluation_v1"


def _phase_instruction(phase: EvaluationPhase) -> str:
    """Return phase-specific evaluation instructions."""
    if phase == "readiness":
        return (
            "Evaluate the resume as a standalone job-search artifact. Focus on "
            "clarity, impact, ATS readability, and evidence strength. Do not "
            "penalize missing job-specific keywords unless a job description is supplied."
        )
    if phase == "pre_tailor":
        return (
            "Evaluate how well the current resume fits the supplied job description "
            "before tailoring. Focus on truthful keyword alignment, role fit, missing "
            "requirements, and evidence already present in the resume."
        )
    return (
        "Evaluate the tailored resume against the supplied job description and the "
        "baseline resume. Reward improvements that remain grounded in the baseline "
        "resume, and flag any changes that appear unsupported or overstated."
    )


def build_evaluation_prompt(
    *,
    phase: EvaluationPhase,
    resume_text: str,
    job_content: str | None = None,
    baseline_resume_text: str | None = None,
) -> str:
    """Build the JSON-only LLM prompt for resume evaluation."""
    job_section = job_content or "No job description supplied."
    baseline_section = baseline_resume_text or "No baseline resume supplied."

    return f"""You are evaluating a resume for Resume Matcher.

Prompt version: {PROMPT_VERSION}
Evaluation phase: {phase}

Phase instruction:
{_phase_instruction(phase)}

Evidence-only rules:
- Use only the supplied resume, job description, and baseline resume text.
- Do not invent accomplishments, metrics, employers, credentials, or requirements.
- Every strength, gap, and next action must include evidence_source.
- Use evidence_source="resume" or "job_description" with a short exact evidence_snippet.
- Use evidence_source="absence" when the point is based on missing evidence.
- If evidence is weak or absent, say so directly.

Return ONLY JSON with this shape:
{{
  "overall_score": 0,
  "confidence": 0.0,
  "dimensions": {{
    "clarity": 0,
    "impact": 0,
    "ats_readability": 0,
    "keyword_alignment": 0,
    "role_fit": 0,
    "evidence_strength": 0
  }},
  "strengths": [
    {{
      "title": "short title",
      "detail": "grounded explanation",
      "evidence_source": "resume",
      "evidence_snippet": "short quote from the supplied text",
      "recommendation": null,
      "severity": "low"
    }}
  ],
  "gaps": [],
  "next_actions": []
}}

Scoring guidance:
- Use integers from 0 to 100 for all scores.
- Use confidence from 0.0 to 1.0 based on evidence quality.
- Keep each list to the strongest 3 to 5 items.
- Keep titles concise and details actionable.
- Output ONLY the JSON object, no markdown or extra text.

RESUME:
{resume_text}

JOB DESCRIPTION:
{job_section}

BASELINE RESUME:
{baseline_section}
"""
