"""Network and browser fetchers for public JD intake URLs."""

from collections.abc import Iterable
import logging
from typing import Any
from urllib.parse import urljoin

import httpcore
import httpx
from playwright.async_api import async_playwright

from app.services.job_intake.constants import (
    MAX_FETCH_BYTES,
    MAX_REDIRECTS,
    PLAYWRIGHT_TIMEOUT_MS,
    REDIRECT_STATUS_CODES,
    REQUEST_TIMEOUT_SECONDS,
    SAFE_FETCH_LIMITS,
)
from app.services.job_intake.errors import JobIntakeError
from app.services.job_intake.extraction import html_to_text
from app.services.job_intake.models import FetchedContent
from app.services.job_intake.url_safety import (
    _redact_url_for_logging,
    _resolve_public_addresses,
    validate_public_url,
)

logger = logging.getLogger(__name__)


def _safe_error_for_http_failure(exc: httpx.HTTPError) -> JobIntakeError:
    """Map expected remote fetch failures to user-safe intake errors."""
    if isinstance(exc, httpx.TimeoutException):
        return JobIntakeError("Timed out while fetching the remote URL.")
    if isinstance(exc, httpx.HTTPStatusError):
        return JobIntakeError("Remote URL returned an error status.")
    return JobIntakeError("Could not fetch the remote URL.")


class SafeAsyncNetworkBackend(httpcore.AsyncNetworkBackend):
    """HTTP network backend that connects only to validated public IPs."""

    def __init__(self) -> None:
        self._backend = httpcore.AnyIOBackend()

    async def connect_tcp(
        self,
        host: str,
        port: int,
        timeout: float | None = None,
        local_address: str | None = None,
        socket_options: Iterable[Any] | None = None,
    ) -> httpcore.AsyncNetworkStream:
        addresses = await _resolve_public_addresses(host, port)
        last_error: Exception | None = None
        for address in addresses:
            try:
                return await self._backend.connect_tcp(
                    address,
                    port,
                    timeout=timeout,
                    local_address=local_address,
                    socket_options=socket_options,
                )
            except (httpcore.ConnectError, httpcore.ConnectTimeout) as exc:
                last_error = exc
        if last_error:
            raise last_error
        raise httpcore.ConnectError("Could not connect to a public URL address.")

    async def connect_unix_socket(
        self,
        path: str,
        timeout: float | None = None,
        socket_options: Iterable[Any] | None = None,
    ) -> httpcore.AsyncNetworkStream:
        return await self._backend.connect_unix_socket(
            path,
            timeout=timeout,
            socket_options=socket_options,
        )

    async def sleep(self, seconds: float) -> None:
        await self._backend.sleep(seconds)


class SafeAsyncHTTPTransport(httpx.AsyncHTTPTransport):
    """HTTPX transport wired to the safe connection-time resolver."""

    def __init__(self) -> None:
        ssl_context = httpx.create_ssl_context(trust_env=False)
        self._pool = httpcore.AsyncConnectionPool(
            ssl_context=ssl_context,
            network_backend=SafeAsyncNetworkBackend(),
            max_connections=SAFE_FETCH_LIMITS.max_connections,
            max_keepalive_connections=0,
            keepalive_expiry=0,
            http1=True,
            http2=False,
            retries=0,
        )


async def fetch_url(url: str) -> FetchedContent:
    """Fetch URL content with timeout and size cap."""
    current_url = await validate_public_url(url)
    timeout = httpx.Timeout(REQUEST_TIMEOUT_SECONDS)
    try:
        async with httpx.AsyncClient(
            timeout=timeout,
            follow_redirects=False,
            headers={"User-Agent": "ResumeMatcher-JDIntake/1.0"},
            transport=SafeAsyncHTTPTransport(),
            trust_env=False,
        ) as client:
            for _ in range(MAX_REDIRECTS + 1):
                async with client.stream("GET", current_url) as response:
                    if response.status_code in REDIRECT_STATUS_CODES:
                        location = response.headers.get("location")
                        if not location:
                            raise JobIntakeError("Remote URL returned an invalid redirect.")
                        current_url = await validate_public_url(
                            urljoin(str(response.url), location)
                        )
                        continue

                    response.raise_for_status()
                    chunks: list[bytes] = []
                    total = 0
                    async for chunk in response.aiter_bytes():
                        total += len(chunk)
                        if total > MAX_FETCH_BYTES:
                            raise JobIntakeError("Remote content is too large to process.")
                        chunks.append(chunk)
                    return FetchedContent(
                        url=str(response.url),
                        content_type=response.headers.get("content-type", ""),
                        body=b"".join(chunks),
                    )
    except JobIntakeError:
        raise
    except httpx.HTTPError as exc:
        raise _safe_error_for_http_failure(exc) from exc

    raise JobIntakeError("Remote URL redirected too many times.")


async def fulfill_with_safe_fetch(route: Any) -> None:
    """Fulfill browser requests through the guarded HTTP fetch path."""
    request = route.request
    if request.method.upper() != "GET":
        await route.abort()
        return

    try:
        fetched = await fetch_url(request.url)
    except JobIntakeError:
        logger.warning(
            "Blocked unsafe browser request during JD intake: %s",
            _redact_url_for_logging(request.url),
        )
        await route.abort()
        return

    headers = {"content-type": fetched.content_type} if fetched.content_type else {}
    await route.fulfill(status=200, headers=headers, body=fetched.body)


async def fetch_with_playwright(url: str) -> tuple[str, str | None]:
    """Fetch JS-rendered page text with a stateless browser context."""
    validated_url = await validate_public_url(url)

    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch()
        try:
            context = await browser.new_context(
                user_agent="ResumeMatcher-JDIntake/1.0",
                java_script_enabled=True,
            )
            try:
                await context.route("**/*", fulfill_with_safe_fetch)
                page = await context.new_page()
                response = await page.goto(
                    validated_url,
                    wait_until="domcontentloaded",
                    timeout=PLAYWRIGHT_TIMEOUT_MS,
                )
                if response is not None:
                    await validate_public_url(response.url)
                content = await page.content()
                title = await page.title()
                text, html_title = html_to_text(content)
                return text, title or html_title
            finally:
                await context.close()
        finally:
            await browser.close()
