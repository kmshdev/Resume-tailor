"""Internal models for job-description intake."""

from dataclasses import dataclass


@dataclass(frozen=True)
class FetchedContent:
    """Raw content fetched from a remote source."""

    url: str
    content_type: str
    body: bytes
