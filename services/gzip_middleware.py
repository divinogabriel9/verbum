"""GZip middleware that skips already-compressed / binary payloads.

Starlette's default GZipMiddleware streams FileResponse bodies and can leave a
stale Content-Length when the gzipped stream differs — uvicorn then raises
``RuntimeError: Response content longer than Content-Length``. Skipping images
and other precompressed types avoids that path entirely.
"""

from __future__ import annotations

from starlette.datastructures import Headers
from starlette.middleware.gzip import GZipResponder, IdentityResponder
from starlette.types import ASGIApp, Message, Receive, Scope, Send

_SKIP_PREFIXES = (
    "text/event-stream",
    "image/",
    "audio/",
    "video/",
    "application/zip",
    "application/gzip",
    "application/x-gzip",
    "application/wasm",
    "application/octet-stream",
    "application/pdf",
    "font/",
)


def _should_skip_content_type(content_type: str) -> bool:
    ct = (content_type or "").split(";", 1)[0].strip().lower()
    if not ct:
        return False
    return any(ct.startswith(prefix) for prefix in _SKIP_PREFIXES)


class SelectiveGZipMiddleware:
    def __init__(self, app: ASGIApp, minimum_size: int = 500, compresslevel: int = 9) -> None:
        self.app = app
        self.minimum_size = minimum_size
        self.compresslevel = compresslevel

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        headers = Headers(scope=scope)
        if "gzip" in headers.get("Accept-Encoding", ""):
            responder: ASGIApp = _SelectiveGZipResponder(
                self.app, self.minimum_size, compresslevel=self.compresslevel
            )
        else:
            responder = IdentityResponder(self.app, self.minimum_size)
        await responder(scope, receive, send)


class _SelectiveGZipResponder(GZipResponder):
    async def send_with_compression(self, message: Message) -> None:
        if message["type"] == "http.response.start":
            self.initial_message = message
            headers = Headers(raw=self.initial_message["headers"])
            self.content_encoding_set = "content-encoding" in headers
            self.content_type_is_excluded = _should_skip_content_type(
                headers.get("content-type", "")
            )
            return
        await super().send_with_compression(message)
