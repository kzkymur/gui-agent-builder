# Backend Minimum Specification

Owner: maintainer (assign on first implementation)

Purpose: Thin HTTP layer that forwards requests from the frontend to external LLM providers and returns results with consistent errors. Stateless by design; the frontend owns all state and orchestration.

Non‑Goals: Job scheduling, persistence, graph execution, user/session storage.

## Tech
- Language: Python
- Framework: FastAPI
- HTTP client: httpx (async)
- LLM integration: LangChain (e.g., langchain-openai)

## MCP Integration
- Library: `langchain-mcp-adapters`
- Behavior: The backend exposes an internal helper to materialize LangChain Tools from MCP servers. It is a thin, deterministic wrapper over the official adapter API (no reflection or symbol guessing).
- Config shape (frontend-provided, forwarded to the helper):
  - `mcp.servers`: array of server connections (keys mirror `langchain_mcp_adapters.sessions.Connection`):
    - SSE/HTTP/WebSocket: `{ name, transport: "http"|"sse"|"websocket", url, headers?, timeout?, sse_read_timeout? }`
    - STDIO: `{ name, transport: "stdio", command, args, env?, cwd? }`
  - `mcp.tools` (optional): array of tool selectors `{ server, name }`. If omitted, all tools from listed servers are returned.
  - `mcp.options.tool_name_prefix` (optional, boolean): When true, return tool names prefixed with `server_` to avoid collisions.
- Errors: Invalid configs surface as `ValueError` with a concise message; adapter/runtime errors surface as `RuntimeError("mcp: ...")`.
- Output: A flat list of LangChain `BaseTool` objects.

## Endpoints
- `GET /health`
  - 200 `{ "status": "ok" }`

- `GET /` and Swagger UI at `/docs`
  - OpenAPI schema: `/openapi.json`

- `GET /providers`
  - Returns a predefined catalog of LLM providers with capability flags and runtime availability (based on installed LangChain packages).
  - 200 `{ "providers": [{ "id": "openai", "json_mode": true, "structured_output": true, "available": true }, { "id": "anthropic", ... }, { "id": "deepseek", ... } ] }`

- `POST /llm/invoke`
  - Description: Single LLM call; backend forwards to the chosen provider via LangChain.
  - Request JSON:
    - `provider` (string, required) — e.g. `openai`, `anthropic`, `deepseek`.
    - `model` (string, required)
    - `messages` (array, required) — chat format `[ { "role": "system|user|assistant", "content": string } ]`.
    - `response_schema` (object, optional) — JSON Schema object to request structured output when the provider supports it. The value MUST be the schema itself, not wrapped (e.g., no `{ name, schema }`). If the root schema has `type: "object"` and omits `additionalProperties`, the backend enforces `additionalProperties: false` — validation runs only when the provider advertises `structured_output: true`.
    - `temperature` (number, optional)
    - `max_tokens` (number, optional)
    - `extra` (object, optional) — provider‑specific passthrough fields.
      - DeepSeek: `{ "json_mode": true }` triggers emulated JSON‑only responses (no schema). Backend prepends a strict instruction and best‑effort parses the reply as JSON.
  - Auth: API key supplied via header `X-Provider-Api-Key` or environment variable per provider (header takes precedence when provided).
  - Response 200 JSON:
    - `id` (string) — provider response id if available
    - `output` (object|string) — parsed JSON when possible, raw text otherwise
    - `raw` (object, optional) — unmodified provider payload (may be omitted in production builds)
    - `usage` (object, optional) — token/credit usage if provided by the provider
    - `provider` (string)
    - `model` (string)

## Engine Utilities

- `engine/openapi.py` — Minimal OpenAPI 3.x client (no external deps) to call third‑party APIs from the backend.
  - Usage:
    - `from engine.openapi import create_client`
    - `client = create_client(spec_dict, auth={'bearer': {'default': 'TOKEN'}})`
    - `resp = client.call_by_id('getPetById', path_params={'petId': 123})`
    - `data = resp.read()`  # bytes; decode or json‑load as needed
  - Features: uses `servers[0].url` by default (overridable), path templating `{param}`, query serialization (arrays supported), header/body passthrough, apiKey (header/query) and bearer auth.

## Simplifications (2025-12-16)

- Provider Registry flattened: `REGISTRY` now maps `provider_id -> invoke (callable)` only. Capability flags are computed at request time via `provider_capabilities(pid)` to avoid stale import-time checks.
- Shared error mapping helper: `utils.errors.to_http(exc)` converts arbitrary exceptions (including HTTPException and upstream SDK errors) into `(status, code, message, details)` used consistently by endpoints.
- Schema utilities extracted: JSON schema helpers moved to `utils.schema` (`extract_schema`, `validate_output_against_schema`).
- MCP transport: only `http` is supported; when `transport` is omitted, it defaults to `"http"` for simplicity.

## Errors
- Unified shape with proper HTTP statuses:
  - Body: `{ "error": { "code": string, "message": string, "details": object|null } }`
  - 400 validation/client errors, 401 auth, 429 rate limit from provider, 5xx upstream/transport.

## Headers & Observability
- Accept and return `X-Request-Id` when provided.
- Log: method, path, status, provider, model, duration (ms). No PII in logs.

### Log Events (backend-adapter)
- `model_request_started` — LangChain begins a model call (may be followed by tool calls).
- `model_response_received` — a model message is received (not necessarily final).
- `model_request_error` — the model call errored.
- `tools_bound` — MCP tools successfully bound to the model with metadata.
- `model_tool_calls_detected` — the model requested tool calls; includes names/args.
- `tool_execution_started` | `tool_execution_finished` | `tool_execution_error` — execution lifecycle per tool.
- `structured_output_requested` — a final structured-output pass is initiated.

## Security
- Do not persist API keys. If headers are used, pass through only to the target provider.
- CORS: allow the local frontend origin only during development.

## Minimal Implementation Sketch (non-binding)
- FastAPI app with three routes above.
  - Swagger UI enabled at `/docs` (default FastAPI docs).
- Provider adapters: LangChain-backed adapters for real providers (OpenAI, Anthropic, DeepSeek).
- Dependencies: `fastapi`, `uvicorn[standard]`, `httpx`, `langchain-core`, `langchain-openai`.

## Persistence Contract (frontend-driven)
- The backend is stateless. The frontend persists the full graph and all node `data` properties to SQLite (WASM) under `nodes.data` as JSON.
- There must be no backend assumptions about omitted/implicit defaults; clients send explicit values as configured in the UI.
