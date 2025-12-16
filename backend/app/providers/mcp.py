from __future__ import annotations

from typing import Any, Dict, List, Optional


async def abuild_mcp_tools(mcp: Optional[Dict[str, Any]]) -> List[Any]:
    """Build LangChain tools from MCP config using the official adapter.

    Input (validated minimally):
      - mcp.servers: list of server connection dicts (must include `name` and `transport`).
      - mcp.tools (optional): list of { server, name } to filter the result set.
      - mcp.options.tool_name_prefix (optional bool): prefix tool names with server name.

    Returns a flat list of LangChain BaseTool objects.
    """
    if not mcp or not isinstance(mcp, dict):
        return []

    servers_in = mcp.get("servers", [])
    if not isinstance(servers_in, list) or not servers_in:
        return []

    # Normalize connections to the shape expected by langchain_mcp_adapters
    connections: Dict[str, Dict[str, Any]] = {}
    for s in servers_in:
        if not isinstance(s, dict):
            continue
        name = s.get("name")
        transport = s.get("transport")
        if not name or not transport:
            continue
        conn = {k: v for k, v in s.items() if k != "name"}
        connections[name] = conn

    if not connections:
        return []

    tool_selectors = mcp.get("tools") or []
    if tool_selectors and not isinstance(tool_selectors, list):
        raise ValueError("mcp.tools must be a list of {server, name}")

    opts = mcp.get("options") or {}
    tool_name_prefix = bool(opts.get("tool_name_prefix", False))

    try:
        from langchain_mcp_adapters.client import MultiServerMCPClient  # type: ignore
    except Exception as e:  # pragma: no cover
        raise RuntimeError("mcp: langchain-mcp-adapters is not installed") from e

    try:
        client = MultiServerMCPClient(
            connections,
            tool_name_prefix=tool_name_prefix,
        )
        if tool_selectors:
            by_server: Dict[str, List[str]] = {}
            for t in tool_selectors:
                if isinstance(t, dict) and t.get("server") and t.get("name"):
                    by_server.setdefault(t["server"], []).append(t["name"])
            tools: List[Any] = []
            for server_name, names in by_server.items():
                server_tools = await client.get_tools(server_name=server_name)
                name_set = set(names)
                for tool in server_tools:
                    tname = getattr(tool, "name", None)
                    if tname in name_set:
                        try:
                            setattr(tool, "_mcp_server", server_name)
                        except Exception:
                            pass
                        tools.append(tool)
            return tools
        # Fetch per-server to annotate each tool with its origin
        tools: List[Any] = []
        for server_name in connections.keys():
            server_tools = await client.get_tools(server_name=server_name)
            for tool in server_tools:
                try:
                    setattr(tool, "_mcp_server", server_name)
                except Exception:
                    pass
                tools.append(tool)
        return tools
    except Exception as e:  # pragma: no cover
        raise RuntimeError(f"mcp: failed to load tools: {e}") from e


def build_mcp_tools(mcp: Optional[Dict[str, Any]]) -> List[Any]:
    """Synchronous wrapper for `abuild_mcp_tools` for non-async contexts."""
    import asyncio

    try:
        return asyncio.run(abuild_mcp_tools(mcp))
    except RuntimeError:
        # Likely called from an active event loop; caller should use the async API
        raise RuntimeError("mcp: build_mcp_tools used in async context; use abuild_mcp_tools instead")
