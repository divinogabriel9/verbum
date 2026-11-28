"""GZip middleware that skips already-compressed / binary payloads.

Self-contained on purpose: it must not subclass Starlette's ``GZipResponder``.
Starlette 1.10 changed when that responder forwards ``http.response.start``,
and an override that worked on 1.2 started sending the body before the start
(uvicorn: "Expected ASGI message 'http.response.start', but got
'http.response.body'"). Images, fonts, archives and responses that already
carry ``Content-Encoding`` pass through untouched.

Also strips the uvicorn ``http.response.pathsend`` extension so file responses
stream as normal ``http.response.body`` chunks.
"""

from __future__ import annotations

import zlib
from typing import Optional

from starlette.datastructures import Headers, MutableHeaders
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
    "application/grpc",
    "font/",
)


def _should_skip_content_type(content_type: str) -> bool:
    ct = (content_type or "").split(";", 1)[0].strip().lower()
    if not ct:
        return False
    return any(ct.startswith(prefix) for prefix in _SKIP_PREFIXES)


def _scope_without_pathsend(scope: Scope) -> Scope:
    extensions = scope.get("extensions")
    if not extensions or "http.response.pathsend" not in extensions:
        return scope
    new_scope = dict(scope)
    new_scope["extensions"] = {
        key: value for key, value in extensions.items() if key != "http.response.pathsend"
    }
    return new_scope


class SelectiveGZipMiddleware:
    def __init__(self, app: ASGIApp, minimum_size: int = 500, compresslevel: int = 6) -> None:
        self.app = app
        self.minimum_size = minimum_size
        self.compresslevel = compresslevel

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        scope = _scope_without_pathsend(scope)
        if "gzip" not in Headers(scope=scope).get("Accept-Encoding", ""):
            await self.app(scope, receive, send)
            return
        responder = _GZipResponder(self.app, self.minimum_size, self.compresslevel)
        await responder(scope, receive, send)


class _GZipResponder:
    def __init__(self, app: ASGIApp, minimum_size: int, compresslevel: int) -> None:
        self.app = app
        self.minimum_size = minimum_size
        self.compresslevel = compresslevel
        self.send: Send = _unattached_send
        self.initial_message: Optional[Message] = None
        self.started = False
        self.passthrough = False
        self._compressor: Optional["zlib._Compress"] = None

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        self.send = send
        await self.app(scope, receive, self._send)

    def _compress(self, body: bytes, *, more_body: bool) -> bytes:
        if self._compressor is None:
            self._compressor = zlib.compressobj(
                self.compresslevel, zlib.DEFLATED, 16 + zlib.MAX_WBITS
            )
        out = self._compressor.compress(body)
        out += self._compressor.flush(zlib.Z_SYNC_FLUSH if more_body else zlib.Z_FINISH)
        return out

    async def _start(self, headers: MutableHeaders) -> None:
        message = dict(self.initial_message or {"type": "http.response.start", "status": 200})
        message["headers"] = headers.raw
        self.started = True
        await self.send(message)

    async def _send(self, message: Message) -> None:
        message_type = message["type"]

        if message_type == "http.response.start":
            headers = Headers(raw=message.get("headers", []))
            self.passthrough = (
                "content-encoding" in headers
                or message.get("status") == 206
                or _should_skip_content_type(headers.get("content-type", ""))
            )
            if self.passthrough:
                self.started = True
                await self.send(message)
            else:
                self.initial_message = message
            return

        if self.passthrough or (self.started and message_type != "http.response.body"):
            await self.send(message)
            return

        if message_type != "http.response.body":
            # pathsend / trailers / early hints before the body: flush start first.
            if self.initial_message is not None and not self.started:
                await self._start(MutableHeaders(raw=list(self.initial_message.get("headers", []))))
            await self.send(message)
            return

        body = message.get("body", b"")
        more_body = bool(message.get("more_body", False))

        if not self.started:
            if self.initial_message is None:
                await self.send(message)
                return
            headers = MutableHeaders(raw=list(self.initial_message.get("headers", [])))
            if len(body) < self.minimum_size and not more_body:
                await self._start(headers)
                await self.send(message)
                return
            compressed = self._compress(body, more_body=more_body)
            headers.add_vary_header("Accept-Encoding")
            headers["Content-Encoding"] = "gzip"
            if more_body:
                del headers["Content-Length"]
            else:
                headers["Content-Length"] = str(len(compressed))
            await self._start(headers)
            await self.send({**message, "body": compressed})
            return

        await self.send({**message, "body": self._compress(body, more_body=more_body)})


async def _unattached_send(message: Message) -> None:
    raise RuntimeError("send awaitable not set")
