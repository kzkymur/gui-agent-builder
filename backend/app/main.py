from __future__ import annotations

import time
from typing import Any, Dict, List, Optional, Literal

from fastapi import FastAPI, Header, HTTPException, Request, WebSocket, WebSocketDisconnect, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from .providers import REGISTRY, list_providers, provider_capabilities
from .utils.schema import validate_output_against_schema
from .utils.errors import to_http
from .providers.adapter import provider_catalog
from pathlib import Path
import json


class ChatMessage(BaseModel):
    role: Literal["system", "user", "assistant"]
    content: str


class InvokeRequest(BaseModel):
    provider: str = Field(min_length=1)
    model: str = Field(min_length=1)
    messages: List[ChatMessage]
    response_schema: Optional[Dict[str, Any]] = None
    temperature: Optional[float] = Field(default=None, ge=0.0, le=2.0)
    max_tokens: Optional[int] = Field(default=None, gt=0)
    extra: Optional[Dict[str, Any]] = None
    retries: Optional[int] = Field(default=0, ge=0, le=5)
    mcp: Optional[Dict[str, Any]] = None  # { servers: [{name,url,headers?}], tools: [{server,name,description,input_schema}] }
    # Filesystem tools config (frontend-provided)
    fs: Optional[Dict[str, Any]] = None  # { nodes: [{id}] }
    # Frontend WebSocket connection id for fs tools routing
    ws_conn_id: Optional[str] = None


class ErrorBody(BaseModel):
    code: str
    message: str
    details: Optional[Dict[str, Any]] = None


class ErrorEnvelope(BaseModel):
    error: ErrorBody


class InvokeResponse(BaseModel):
    id: Optional[str] = None
    output: Any
    provider: str
    model: str
    usage: Optional[Dict[str, Any]] = None
    raw: Optional[Dict[str, Any]] = None
    logs: Optional[List[Dict[str, Any]]] = None


app = FastAPI(
    title="llm-flow backend",
    version="0.1.0",
    docs_url="/docs",            # Swagger UI
    redoc_url=None,               # Disable ReDoc to keep surface minimal
    openapi_url="/openapi.json", # OpenAPI schema
)

from .ws_registry import set_ws, pop_ws, resolve_pending, get_ws, register_pending, list_connections

# CORS: local dev defaults; tighten in prod/deploy
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def request_id_middleware(request: Request, call_next):
    req_id = request.headers.get("X-Request-Id")
    start = time.perf_counter()
    response = await call_next(request)
    if req_id:
        response.headers["X-Request-Id"] = req_id
    duration_ms = int((time.perf_counter() - start) * 1000)
    response.headers["X-Duration-Ms"] = str(duration_ms)
    return response


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.get("/")
async def root():
    return {"message": "See Swagger UI at /docs", "openapi": "/openapi.json"}


@app.websocket("/ws/{conn_id}")
async def websocket_endpoint(ws: WebSocket, conn_id: str):
    await ws.accept()
    set_ws(conn_id, ws)
    try:
        try:
            print(f"[fs-ws] open {conn_id}")
        except Exception:
            pass
        while True:
            # Receive responses from frontend and dispatch to pending futures
            data = await ws.receive_text()
            try:
                obj = json.loads(data)
                if isinstance(obj, dict) and obj.get("type") == "ping":
                    continue
                if isinstance(obj, dict) and obj.get("type") == "connected":
                    continue
                if isinstance(obj, dict) and obj.get("type") == "res":
                    cid = obj.get("id")
                    if isinstance(cid, str) and cid:
                        resolve_pending(conn_id, cid, obj)
            except Exception:
                # Ignore malformed
                pass
    except WebSocketDisconnect:
        pass
    except Exception:
        pass
    finally:
        pop_ws(conn_id)
        try:
            print(f"[fs-ws] close {conn_id}")
        except Exception:
            pass


@app.get("/ws/test")
async def ws_test(conn_id: str = Query(...), path: str = Query("/")):
    ws = get_ws(conn_id)
    if not ws:
        raise HTTPException(status_code=400, detail={
            "error": {"code": "ws_not_connected", "message": f"No websocket for {conn_id}", "details": {"active": list_connections()} }
        })
    call_id = f"test-{int(time.time()*1000)}"
    fut = register_pending(conn_id, call_id)
    msg = {"type": "req", "id": call_id, "action": "fs_list", "path": path}
    try:
        await ws.send_text(json.dumps(msg))
        import asyncio
        res = await asyncio.wait_for(fut, timeout=5.0)
        return res
    except Exception as e:
        raise HTTPException(status_code=500, detail={
            "error": {"code": "ws_test_failed", "message": str(e), "details": None}
        })


@app.get("/ws/list")
async def ws_list():
    return {"connections": list_connections()}


@app.get("/providers")
async def providers():
    return {"providers": list_providers()}


@app.get("/model")
async def get_models(provider: str):
    # Validate provider against known catalog ids
    catalog = provider_catalog()
    if not provider or provider not in catalog:
        raise HTTPException(status_code=400, detail={
            "error": {
                "code": "provider_invalid",
                "message": f"Provider '{provider}' is missing or unsupported",
                "details": None,
            }
        })

    base = Path(__file__).parent / "model_catalog"
    path = base / f"{provider}.json"
    if not path.exists():
        raise HTTPException(status_code=404, detail={
            "error": {
                "code": "catalog_not_found",
                "message": f"Model catalog not found for provider '{provider}'",
                "details": None,
            }
        })
    try:
        data = json.loads(path.read_text())
        models = data.get("models", []) if isinstance(data, dict) else []
    except Exception as e:
        raise HTTPException(status_code=500, detail={
            "error": {
                "code": "catalog_read_error",
                "message": f"Failed to read catalog for '{provider}': {e}",
                "details": None,
            }
        })
    return {"provider": provider, "models": models}


@app.post("/llm/invoke", response_model=InvokeResponse, responses={
    400: {"model": ErrorEnvelope},
    401: {"model": ErrorEnvelope},
    429: {"model": ErrorEnvelope},
    500: {"model": ErrorEnvelope},
    501: {"model": ErrorEnvelope},
})
async def llm_invoke(
    body: InvokeRequest,
    x_provider_api_key: Optional[str] = Header(default=None, convert_underscores=True),
    x_tavily_api_key: Optional[str] = Header(default=None, convert_underscores=True),
):
    entry = REGISTRY.get(body.provider)
    if not entry:
        raise HTTPException(status_code=501, detail={
            "error": {
                "code": "provider_unsupported",
                "message": f"Provider '{body.provider}' not supported",
                "details": None,
            }
        })

    # Compose normalized payload for adapter
    payload: Dict[str, Any] = body.model_dump()
    # Attach api key for adapters that need it
    if x_provider_api_key:
        payload["api_key"] = x_provider_api_key

    # Optional Tavily web search tool support
    try:
        extra = body.extra or {}
        if bool(extra.get("web_search")):
            if not x_tavily_api_key:
                raise HTTPException(status_code=400, detail={
                    "error": {
                        "code": "tavily_api_key_missing",
                        "message": "Web search requested but Tavily API key is missing",
                        "details": None,
                    }
                })
            payload["tavily_api_key"] = x_tavily_api_key
    except HTTPException:
        raise
    except Exception:
        # Ignore malformed extras silently — feature is opt-in
        pass

    attempts = (body.retries or 0) + 1
    last_exc: Optional[Exception] = None
    combined_logs: List[Dict[str, Any]] = []
    for _ in range(attempts):
        try:
            result = await entry["invoke"](payload)
            # Aggregate logs if provided by adapter
            if isinstance(result, dict) and "logs" in result and isinstance(result["logs"], list):
                combined_logs.extend(result["logs"]) 
            # If structured output is supported and a response_schema is present, validate output shape
            caps = provider_capabilities(body.provider)
            if body.response_schema is not None:
                if caps.get("structured_output", False):
                    validate_output_against_schema(result.get("output"), body.response_schema)
                else:
                    combined_logs.append({
                        "event": "schema_validation_skipped",
                        "reason": "provider_does_not_support_structured_output",
                        "provider": body.provider,
                    })
            # Success
            return InvokeResponse(
                id=result.get("id"),
                output=result.get("output"),
                provider=result.get("provider", body.provider),
                model=result.get("model", body.model),
                usage=result.get("usage"),
                raw=result.get("raw"),
                logs=combined_logs or result.get("logs"),
            )
        except HTTPException as http_exc:
            # Do not retry on 4xx unless 429 (rate limit)
            status = http_exc.status_code
            if status == 429 and attempts > 1:
                last_exc = http_exc
                continue
            raise
        except Exception as exc:
            # MCP adapter missing: surface clear 501
            msg = str(exc)
            if isinstance(exc, RuntimeError) and "langchain-mcp-adapters is required" in msg:
                raise HTTPException(status_code=501, detail={
                    "error": {
                        "code": "mcp_adapter_missing",
                        "message": msg,
                        "details": {"type": exc.__class__.__name__},
                    }
                })
            # Tavily adapter missing: surface clear 501
            if isinstance(exc, RuntimeError) and ("langchain-tavily" in msg or "tavily" in msg.lower()):
                raise HTTPException(status_code=501, detail={
                    "error": {
                        "code": "tavily_adapter_missing",
                        "message": msg,
                        "details": {"type": exc.__class__.__name__},
                    }
                })
            # Retry on upstream errors
            last_exc = exc
            continue

    # If we got here, retries exhausted; normalize and raise
    status, code, message, details = to_http(last_exc)
    raise HTTPException(status_code=status, detail={"error": {"code": code, "message": message, "details": details}})


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app.main:app", host="127.0.0.1", port=8000, reload=True)
