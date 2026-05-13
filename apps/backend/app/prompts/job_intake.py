"""Prompts for job-description intake extraction."""

JOB_INTAKE_EXTRACTION_PROMPT = """Extract a job description and recruiter screening questions from the provided text.

Return ONLY JSON with this shape:
{{
  "job_description": "clean job description text used for resume tailoring",
  "screening_questions": ["question one?"],
  "warnings": ["optional warning"],
  "confidence": 0.0
}}

Rules:
- Keep screening questions separate. Do not append them to the job description.
- Preserve role responsibilities, requirements, company context, and qualifications.
- Remove greetings, signatures, tracking text, navigation, cookie notices, and unrelated recruiter chatter.
- If the source does not contain a clear job description, return the best available role text and add a warning.
- Do not invent requirements.

SOURCE TEXT:
{source_text}
"""

DRAFT_SCREENING_ANSWERS_PROMPT = """Draft evidence-only answers to recruiter screening questions.

Return ONLY JSON with this shape:
{{
  "answers": [
    {{
      "question": "original question?",
      "answer": "answer supported by evidence, or empty string",
      "evidence": ["short quoted evidence"],
      "needs_user_input": true,
      "prompt": "what the user must provide if evidence is missing"
    }}
  ]
}}

Rules:
- Use only the resume, job description, and pasted recruiter message.
- If evidence is missing for availability, salary, relocation, sponsorship, location, work authorization, notice period, or preferences, leave answer empty and set needs_user_input=true.
- Do not fabricate personal facts.

JOB DESCRIPTION:
{job_description}

RESUME / USER EVIDENCE:
{resume_text}

QUESTIONS:
{questions}
"""
