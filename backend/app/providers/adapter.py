from __future__ import annotations

from typing import Any, Dict, List, Optional

from .logging import BufferingHandler
from .mcp import abuild_mcp_tools


def provider_catalog() -> Dict[str, Dict[str, Any]]:
    return {
        "openai": {"name": "OpenAI"},
        "anthropic": {"name": "Anthropic Claude"},
        "deepseek": {"name": "DeepSeek"},
    }


def provider_capabilities(provider_id: str) -> Dict[str, Any]:
    caps = {"json_mode": True, "structured_output": True, "available": False}
    if provider_id == "openai":
        caps["available"] = _is_openai_available()
    if provider_id == "anthropic":
        caps["available"] = _is_anthropic_available()
        caps["structured_output"] = True
    if provider_id == "deepseek":
        caps["available"] = _is_deepseek_available()
        caps["json_mode"] = False
        caps["structured_output"] = True
    return caps


async def lc_invoke_generic(payload: Dict[str, Any]) -> Dict[str, Any]:
    provider = payload.get("provider")
    model = payload.get("model")
    api_key = payload.get("api_key")
    temperature: Optional[float] = payload.get("temperature")
    max_tokens: Optional[int] = payload.get("max_tokens")
    response_schema = payload.get("response_schema")

    lc, meta_provider = _create_chat_model(provider, model, api_key, temperature, max_tokens, response_schema)

    cb = BufferingHandler()
    messages = _to_lc_messages(payload.get("messages", []))

    # Bind MCP tools if provided
    tools = await abuild_mcp_tools(payload.get("mcp"))
    if tools:
        try:
            lc = lc.bind_tools(tools)
            cb.logs.append({
                "event": "tools_bound",
                "tools": [
                    {"name": getattr(t, "name", "tool"), "server": getattr(t, "_mcp_server", None)}
                    for t in tools
                ]
            })
        except Exception:
            tools = []

    # Anthropic structured outputs via tool binding
    # If MCP is configured, do NOT force the synthetic output tool — let the model plan tools first.
    has_mcp = bool(payload.get("mcp", {}).get("servers"))
    if provider == "anthropic" and response_schema and not has_mcp:
        try:
            schema_obj = response_schema
            tool = {
                "name": "output",
                "description": "Return the structured result matching the schema.",
                "input_schema": schema_obj,
            }
            bound = lc.bind(tools=[tool], tool_choice={"type": "tool", "name": "output"})
            res = await bound.ainvoke(messages, config={"callbacks": [cb]})
            tool_calls = getattr(res, "tool_calls", None) or []
            if tool_calls:
                args = tool_calls[0].get("args")
                return _normalize_response(res, meta_provider, model, args, logs=cb.logs)
        except Exception:
            pass

    # Default invoke (may be followed by tool-exec loop)
    res = await lc.ainvoke(messages, config={"callbacks": [cb]})

    # Log any model-declared tool calls (useful for Anthropic/OpenAI tool plans)
    try:
        tcs = getattr(res, "tool_calls", None) or []
        if tcs:
            cb.logs.append({
                "event": "model_tool_calls_detected",
                "calls": [
                    {"name": tc.get("name"), "args": tc.get("args"), "id": tc.get("id")}
                    for tc in tcs
                ],
            })
    except Exception:
        pass

    # Simple tool loop when tools are present
    if tools:
        from langchain_core.messages import ToolMessage

        import time
        for _ in range(3):
            tool_calls = getattr(res, "tool_calls", None) or []
            if not tool_calls:
                break
            tool_msgs = []
            for tc in tool_calls:
                name = tc.get("name")
                args = tc.get("args", {})
                call_id = tc.get("id", name or "tool")
                tool_obj = next((t for t in tools if getattr(t, "name", None) == name), None)
                if not tool_obj:
                    content = f"Tool '{name}' not available"
                else:
                    try:
                        server = getattr(tool_obj, "_mcp_server", None)
                        start = time.perf_counter()
                        cb.logs.append({"event": "tool_execution_started", "name": name, "server": server, "args": args})
                        if hasattr(tool_obj, "ainvoke"):
                            result = await tool_obj.ainvoke(args)
                        else:
                            result = tool_obj.invoke(args)
                        content = str(result)
                        duration_ms = int((time.perf_counter() - start) * 1000)
                        cb.logs.append({"event": "tool_execution_finished", "name": name, "server": server, "duration_ms": duration_ms, "result": content[:2000]})
                    except Exception as e:
                        content = f"Tool '{name}' failed: {e}"
                        cb.logs.append({"event": "tool_execution_error", "name": name, "server": server, "error": str(e)})
                tool_msgs.append(ToolMessage(tool_call_id=call_id, content=content))
            messages = messages + [res] + tool_msgs
            res = await lc.ainvoke(messages, config={"callbacks": [cb]})

    # Finalize into structured output when requested (post-tool phase)
    if provider == "anthropic" and response_schema:
        try:
            schema_obj = response_schema
            tool = {
                "name": "output",
                "description": "Return the structured result matching the schema.",
                "input_schema": schema_obj,
            }
            # Let the model emit a final structured result, using all prior context
            bound = lc.bind(tools=[tool], tool_choice={"type": "tool", "name": "output"})
            cb.logs.append({"event": "structured_output_requested", "provider": provider})
            res2 = await bound.ainvoke(messages + [res], config={"callbacks": [cb]})
            tool_calls = getattr(res2, "tool_calls", None) or []
            if tool_calls:
                args = tool_calls[0].get("args")
                return _normalize_response(res2, meta_provider, model, args, logs=cb.logs)
        except Exception:
            # If finalization fails, fall back to best-effort parse below
            pass

    content = getattr(res, "content", "")
    parsed: Any = content
    if response_schema:
        try:
            import json

            parsed = json.loads(content)
        except Exception:
            parsed = content

    return _normalize_response(res, meta_provider, model, parsed, logs=cb.logs)


def _normalize_response(res: Any, provider: str, model: str, output: Any, *, logs: Optional[List[Dict[str, Any]]] = None) -> Dict[str, Any]:
    return {
        "id": getattr(res, "id", None),
        "output": output,
        "provider": provider,
        "model": model,
        "usage": getattr(res, "response_metadata", {}).get("token_usage"),
        "raw": getattr(res, "response_metadata", None),
        "logs": logs or [],
    }


def _to_lc_messages(messages: List[Dict[str, str]]):
    try:
        from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
    except Exception:
        return messages
    role_map = {"system": SystemMessage, "user": HumanMessage, "assistant": AIMessage}
    result = []
    for m in messages:
        role = m.get("role", "user")
        content = m.get("content", "")
        cls = role_map.get(role, HumanMessage)
        result.append(cls(content))
    return result


def _create_chat_model(
    provider: str,
    model: str,
    api_key: Optional[str],
    temperature: Optional[float],
    max_tokens: Optional[int],
    response_schema: Optional[Dict[str, Any]],
):
    params: Dict[str, Any] = {"model": model}
    if temperature is not None:
        params["temperature"] = temperature
    if max_tokens is not None:
        params["max_tokens"] = max_tokens
    if api_key:
        params["api_key"] = api_key

    if provider == "openai":
        if not _is_openai_available():
            raise RuntimeError("langchain-openai not installed")
        if response_schema:
            params["response_format"] = {"type": "json_schema", "json_schema": response_schema}
        from langchain_openai import ChatOpenAI

        return ChatOpenAI(**params), "openai"

    if provider == "anthropic":
        if not _is_anthropic_available():
            raise RuntimeError("langchain-anthropic not installed")
        from langchain_anthropic import ChatAnthropic

        return ChatAnthropic(**params), "anthropic"

    if provider == "deepseek":
        if not _is_deepseek_available():
            raise RuntimeError("langchain-deepseek not installed")
        from langchain_deepseek import ChatDeepSeek
        t = params.get("temperature", None)
        if t is not None:
            params["temperature"] = max(0.0, min(1.0, float(t)))
        return ChatDeepSeek(**params), "deepseek"

    raise RuntimeError(f"Unsupported provider: {provider}")


def _is_openai_available() -> bool:
    try:
        import langchain_openai  # noqa: F401
        return True
    except Exception:
        return False


def _is_anthropic_available() -> bool:
    try:
        import langchain_anthropic  # noqa: F401
        return True
    except Exception:
        return False


def _is_deepseek_available() -> bool:
    try:
        import langchain_deepseek  # noqa: F401
        return True
    except Exception:
        return False
