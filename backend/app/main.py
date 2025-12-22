from __future__ import annotations

import time
from typing import Any, Dict, List, Optional, Literal

from fastapi import FastAPI, Header, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from .providers import REGISTRY, list_providers, provider_capabilities
from .utils.schema import validate_output_against_schema
from .utils.errors import to_http


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


@app.get("/providers")
async def providers():
    return {"providers": list_providers()}


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
            # Retry on upstream errors
            last_exc = exc
            continue

    # If we got here, retries exhausted; normalize and raise
    status, code, message, details = to_http(last_exc)
    raise HTTPException(status_code=status, detail={"error": {"code": code, "message": message, "details": details}})


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app.main:app", host="127.0.0.1", port=8000, reload=True)
