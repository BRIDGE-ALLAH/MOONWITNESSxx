"""ASGI request-body guard for the job submission boundary."""

from __future__ import annotations

from starlette.types import ASGIApp, Message, Receive, Scope, Send


class JobBodyLimitMiddleware:
    """Bound /v1/jobs request bodies, including chunked requests without a length."""

    def __init__(self, app: ASGIApp, *, max_bytes: int) -> None:
        self.app = app
        self.max_bytes = max_bytes

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if (
            scope["type"] != "http"
            or scope.get("method") != "POST"
            or scope.get("path") != "/v1/jobs"
        ):
            await self.app(scope, receive, send)
            return

        headers = {key.lower(): value for key, value in scope.get("headers", [])}
        raw_length = headers.get(b"content-length")
        if raw_length is not None:
            try:
                if int(raw_length) > self.max_bytes:
                    await self._send_too_large(send)
                    return
            except ValueError:
                await self._send_bad_length(send)
                return

        total = 0
        oversized = False

        async def bounded_receive() -> Message:
            nonlocal total, oversized
            if oversized:
                return {"type": "http.request", "body": b"", "more_body": False}
            message = await receive()
            if message["type"] == "http.request":
                total += len(message.get("body", b""))
                if total > self.max_bytes:
                    oversized = True
                    return {"type": "http.request", "body": b"", "more_body": False}
            return message

        async def guarded_send(message: Message) -> None:
            if not oversized:
                await send(message)

        await self.app(scope, bounded_receive, guarded_send)
        if oversized:
            await self._send_too_large(send)

    @staticmethod
    async def _send_too_large(send: Send) -> None:
        body = b'{"detail":"Request body exceeds the ORACLE service limit"}'
        await send(
            {
                "type": "http.response.start",
                "status": 413,
                "headers": [(b"content-type", b"application/json")],
            }
        )
        await send({"type": "http.response.body", "body": body})

    @staticmethod
    async def _send_bad_length(send: Send) -> None:
        body = b'{"detail":"Invalid Content-Length header"}'
        await send(
            {
                "type": "http.response.start",
                "status": 400,
                "headers": [(b"content-type", b"application/json")],
            }
        )
        await send({"type": "http.response.body", "body": body})
