from __future__ import annotations

from typing import Any, Dict, List

# Support both modern and legacy LangChain import paths
try:  # langchain-core >= 0.3
    from langchain_core.callbacks import BaseCallbackHandler  # type: ignore
except Exception:
    try:  # older langchain
        from langchain.callbacks.base import BaseCallbackHandler  # type: ignore
    except Exception:  # pragma: no cover
        BaseCallbackHandler = object  # type: ignore


class BufferingHandler(BaseCallbackHandler):
    """Collect LangChain callback events into an in-memory list for return."""

    def __init__(self) -> None:
        self.logs: List[Dict[str, Any]] = []

    def _append(self, event: str, **payload: Any) -> None:
        self.logs.append({"event": event, **payload})

    # Sync callbacks
    def on_llm_start(self, serialized, prompts, **kwargs):  # type: ignore[override]
        self._append("llm_start", serialized=serialized, prompts=prompts)

    def on_llm_end(self, response, **kwargs):  # type: ignore[override]
        self._append("llm_end", response=str(response))

    def on_llm_error(self, error, **kwargs):  # type: ignore[override]
        self._append("llm_error", error=str(error))

    def on_chat_model_start(self, serialized, messages, **kwargs):  # type: ignore[override]
        self._append("chat_start", serialized=serialized, messages=str(messages))

    def on_chat_model_end(self, response, **kwargs):  # type: ignore[override]
        self._append("chat_end", response=str(response))

    def on_chat_model_error(self, error, **kwargs):  # type: ignore[override]
        self._append("chat_error", error=str(error))

    # Async variants for newer LangChain
    async def ahandle_event(self, *args, **kwargs):  # type: ignore[override]
        self._append("event", args=str(args), kwargs=str(kwargs))

    async def aon_llm_start(self, serialized, prompts, **kwargs):  # type: ignore[override]
        self.on_llm_start(serialized, prompts, **kwargs)

    async def aon_llm_end(self, response, **kwargs):  # type: ignore[override]
        self.on_llm_end(response, **kwargs)

    async def aon_llm_error(self, error, **kwargs):  # type: ignore[override]
        self.on_llm_error(error, **kwargs)

    async def aon_chat_model_start(self, serialized, messages, **kwargs):  # type: ignore[override]
        self.on_chat_model_start(serialized, messages, **kwargs)

    async def aon_chat_model_end(self, response, **kwargs):  # type: ignore[override]
        self.on_chat_model_end(response, **kwargs)

    async def aon_chat_model_error(self, error, **kwargs):  # type: ignore[override]
        self.on_chat_model_error(error, **kwargs)

    # Tool callback hooks (LangChain tools)
    def on_tool_start(self, serialized, input_str, **kwargs):  # type: ignore[override]
        self._append("tool_start", serialized=serialized, input=input_str)

    def on_tool_end(self, output, **kwargs):  # type: ignore[override]
        self._append("tool_end", output=str(output))

    def on_tool_error(self, error, **kwargs):  # type: ignore[override]
        self._append("tool_error", error=str(error))

    async def aon_tool_start(self, serialized, input_str, **kwargs):  # type: ignore[override]
        self.on_tool_start(serialized, input_str, **kwargs)

    async def aon_tool_end(self, output, **kwargs):  # type: ignore[override]
        self.on_tool_end(output, **kwargs)

    async def aon_tool_error(self, error, **kwargs):  # type: ignore[override]
        self.on_tool_error(error, **kwargs)
