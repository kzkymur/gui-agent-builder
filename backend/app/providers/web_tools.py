from __future__ import annotations

from typing import Any, Dict, List


async def maybe_build_tavily_tool(payload: Dict[str, Any]) -> List[Any]:
    """Return [TavilySearchResults] if extra.web_search is true.

    Requires `langchain-tavily`. Raises RuntimeError with a clear message if the
    package is missing when the feature is requested.
    """
    extra = payload.get("extra") or {}
    enabled = bool(extra.get("web_search"))
    if not enabled:
        return []

    api_key = payload.get("tavily_api_key") or None
    # Prefer TavilySearch (the primary tool class in langchain-tavily)
    TavilyTool = None
    first_err: Exception | None = None
    try:
        from langchain_tavily import TavilySearch as _T  # type: ignore
        TavilyTool = _T
    except Exception as e1:  # pragma: no cover
        first_err = e1
        try:
            # Alternate export path (older layouts)
            from langchain_tavily.tools import TavilySearch as _T  # type: ignore
            TavilyTool = _T
        except Exception as e2:
            raise RuntimeError(
                f"langchain-tavily import failed: {first_err or e2}"
            ) from (first_err or e2)

    # Tool: keep arguments minimal; the model will pass a query string
    try:
        tool = TavilyTool(max_results=5, topic="general", tavily_api_key=api_key)
    except TypeError:
        # Some versions use api_key as the parameter name
        tool = TavilyTool(max_results=5, topic="general", api_key=api_key)  # type: ignore
    except Exception as e:  # pragma: no cover
        raise RuntimeError(f"tavily: failed to initialize tool: {e}") from e

    # Name is stable across versions; annotate for traceability
    try:
        setattr(tool, "_mcp_server", "tavily")
    except Exception:
        pass
    return [tool]
