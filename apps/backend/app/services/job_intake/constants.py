"""Constants and regexes for job-description intake."""

import re

import httpx

MAX_FETCH_BYTES = 4 * 1024 * 1024
MAX_SOURCE_TEXT_CHARS = 60_000
MIN_REVIEWABLE_JD_CHARS = 50
PLAYWRIGHT_MIN_TEXT_CHARS = 500
REQUEST_TIMEOUT_SECONDS = 12.0
PLAYWRIGHT_TIMEOUT_MS = 15_000
LOCAL_HOSTNAMES = {"localhost", "localhost.localdomain"}
MAX_REDIRECTS = 5
REDIRECT_STATUS_CODES = {301, 302, 303, 307, 308}
SAFE_FETCH_LIMITS = httpx.Limits(max_connections=10, max_keepalive_connections=0)

URL_RE = re.compile(r"https?://[^\s<>'\")\]]+", re.IGNORECASE)
QUESTION_PREFIX_RE = re.compile(
    r"^(?:are|can|could|did|do|does|have|would|will|what|when|where|why|how|is)\b",
    re.IGNORECASE,
)
QUESTION_CLAUSE_RE = re.compile(
    r"\b(?:are|can|could|did|do|does|have|would|will|what|when|where|why|how|is)\b[^?]*\?",
    re.IGNORECASE,
)

STOPWORDS = {
    "a",
    "about",
    "and",
    "are",
    "can",
    "could",
    "did",
    "do",
    "does",
    "experience",
    "have",
    "how",
    "is",
    "of",
    "on",
    "open",
    "or",
    "the",
    "to",
    "with",
    "work",
    "you",
    "your",
}

USER_INPUT_TERMS = {
    "authorization",
    "available",
    "availability",
    "compensation",
    "hybrid",
    "location",
    "notice",
    "onsite",
    "relocation",
    "remote",
    "salary",
    "sponsor",
    "sponsorship",
    "start",
    "visa",
    "w2",
}
