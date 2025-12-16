from __future__ import annotations

from typing import Any, Dict, Tuple

from fastapi import HTTPException


def to_http(exc: Exception | None) -> Tuple[int, str, str, Dict[str, Any] | None]:
    """Map arbitrary exceptions to (status, code, message, details).

    - Preserves `HTTPException.status_code` when present.
    - Falls back to upstream `.response.status_code` if available.
    - Classifies 4xx as `provider_bad_request`, otherwise `upstream_error`.
    """
    if exc is None:
        return 500, "upstream_error", "Provider invocation failed", None

    # Honor direct FastAPI HTTPExceptions
    if isinstance(exc, HTTPException):
        status = exc.status_code
        detail = exc.detail
        if isinstance(detail, dict) and "error" in detail:
            err = detail["error"]
            return status, err.get("code", "error"), err.get("message", "error"), err.get("details")
        return status, ("provider_bad_request" if 400 <= status < 500 else "upstream_error"), str(detail), {
            "type": exc.__class__.__name__
        }

    status = 500
    sc = getattr(exc, "status_code", None)
    if isinstance(sc, int):
        status = sc
    else:
        resp = getattr(exc, "response", None)
        sc2 = getattr(resp, "status_code", None) if resp is not None else None
        if isinstance(sc2, int):
            status = sc2

    code = "provider_bad_request" if 400 <= status < 500 else "upstream_error"
    return status, code, str(exc), {"type": exc.__class__.__name__}

