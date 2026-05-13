"""Public URL validation and redaction helpers for JD intake."""

import asyncio
import ipaddress
import socket
from urllib.parse import urlparse

from app.services.job_intake.constants import LOCAL_HOSTNAMES
from app.services.job_intake.errors import JobIntakeError


def _is_blocked_ip(ip_value: str) -> bool:
    """Return whether an IP address is unsafe for server-side fetching."""
    ip = ipaddress.ip_address(ip_value)
    return not ip.is_global or any(
        [
            ip.is_private,
            ip.is_loopback,
            ip.is_link_local,
            ip.is_reserved,
            ip.is_multicast,
            ip.is_unspecified,
        ]
    )


async def _resolve_public_addresses(hostname: str, port: int | None) -> list[str]:
    """Resolve a hostname and return only public addresses for connection use."""
    try:
        infos = await asyncio.to_thread(
            socket.getaddrinfo,
            hostname,
            port,
            type=socket.SOCK_STREAM,
        )
    except socket.gaierror as exc:
        raise JobIntakeError("Could not resolve the URL hostname.") from exc

    addresses: list[str] = []
    seen: set[str] = set()
    for info in infos:
        address = info[4][0]
        try:
            if _is_blocked_ip(address):
                raise JobIntakeError("Only public URLs are supported.")
        except ValueError:
            continue
        if address not in seen:
            seen.add(address)
            addresses.append(address)

    if not addresses:
        raise JobIntakeError("Only public URLs are supported.")
    return addresses


async def validate_public_url(url: str) -> str:
    """Validate that a URL is safe for public server-side fetching."""
    parsed = urlparse(url.strip())
    if parsed.scheme not in {"http", "https"}:
        raise JobIntakeError("Only public http and https URLs are supported.")
    if parsed.username or parsed.password:
        raise JobIntakeError("URLs with embedded credentials are not supported.")
    if not parsed.hostname:
        raise JobIntakeError("A public URL hostname is required.")

    hostname = parsed.hostname.lower()
    if hostname in LOCAL_HOSTNAMES or hostname.endswith(".localhost"):
        raise JobIntakeError("Only public URLs are supported.")

    try:
        if _is_blocked_ip(hostname):
            raise JobIntakeError("Only public URLs are supported.")
    except ValueError:
        pass

    try:
        parsed_port = parsed.port
    except ValueError as exc:
        raise JobIntakeError("Invalid port in URL.") from exc
    port = parsed_port or (443 if parsed.scheme == "https" else 80)
    await _resolve_public_addresses(hostname, port)

    return parsed.geturl()


def redact_url_for_metadata(url: str | None) -> str | None:
    """Return a URL safe for logs, display, and persisted metadata."""
    if not url:
        return None
    parsed = urlparse(url)
    if not parsed.scheme or not parsed.hostname:
        return None

    hostname = parsed.hostname
    host = f"[{hostname}]" if ":" in hostname else hostname
    try:
        port = parsed.port
    except ValueError:
        port = None
    netloc = f"{host}:{port}" if port else host
    return parsed._replace(netloc=netloc, query="", fragment="").geturl()


def _redact_url_for_logging(url: str) -> str:
    """Return a URL safe for logs by dropping secrets and user-specific state."""
    return redact_url_for_metadata(url) or "<invalid-url>"
