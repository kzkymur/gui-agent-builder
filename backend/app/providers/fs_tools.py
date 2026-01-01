from __future__ import annotations

from typing import Any, Dict, List, Optional
import json
import asyncio

from fastapi import WebSocket
from ..ws_registry import get_ws, register_pending
from pydantic import BaseModel, Field
try:
    from langchain_core.tools import StructuredTool  # type: ignore
except Exception:  # pragma: no cover
    StructuredTool = None  # type: ignore


class _WsFsToolBase:
    def __init__(self, name: str, conn_id: str):
        self.name = name
        self._conn_id = conn_id
        setattr(self, "_mcp_server", "frontend_fs")

    def _get_ws(self) -> WebSocket:
        ws = get_ws(self._conn_id)
        if not ws:
            raise RuntimeError("filesystem websocket not connected")
        return ws

    async def _rpc(self, payload: Dict[str, Any]) -> Any:
        ws = self._get_ws()
        call_id = f"{self.name}-{int(asyncio.get_event_loop().time()*1000)}"
        fut = register_pending(self._conn_id, call_id)
        msg = dict(payload)
        msg["id"] = call_id
        msg["type"] = "req"
        try:
            print(f"[fs-ws] send {self._conn_id} {self.name} -> {msg}")
        except Exception:
            pass
        await ws.send_text(json.dumps(msg))
        try:
            res = await asyncio.wait_for(fut, timeout=10.0)
        except asyncio.TimeoutError:
            raise RuntimeError("filesystem rpc timeout")
        if not res or not res.get("ok"):
            raise RuntimeError(str(res))
        try:
            print(f"[fs-ws] recv {self._conn_id} {self.name} <- {res}")
        except Exception:
            pass
        return res


class FsReadFile(_WsFsToolBase):
    description = "Read a text file from the frontend filesystem. Input: { path: string }"
    def __init__(self, conn_id: str, label: str):
        super().__init__(f"fs_read_file_{label}", conn_id)
    async def ainvoke(self, args: Dict[str, Any]):
        path = str(args.get("path") or "/")
        res = await self._rpc({"action": "fs_read", "path": path})
        return res.get("content", "")


class FsWriteFile(_WsFsToolBase):
    description = "Write a text file to the frontend filesystem. Input: { path: string, content: string }"
    def __init__(self, conn_id: str, label: str):
        super().__init__(f"fs_write_file_{label}", conn_id)
    async def ainvoke(self, args: Dict[str, Any]):
        path = str(args.get("path") or "/")
        content = str(args.get("content") or "")
        await self._rpc({"action": "fs_write", "path": path, "content": content})
        return "ok"


class FsListDir(_WsFsToolBase):
    description = "List a directory in the frontend filesystem. Input: { path: string }"
    def __init__(self, conn_id: str, label: str):
        super().__init__(f"fs_list_directory_{label}", conn_id)
    async def ainvoke(self, args: Dict[str, Any]):
        path = str(args.get("path") or "/")
        res = await self._rpc({"action": "fs_list", "path": path})
        return json.dumps(res.get("entries", []))


class _ReadArgs(BaseModel):
    path: str = Field("/", description="Absolute path to read")


class _WriteArgs(BaseModel):
    path: str = Field("/", description="Absolute path to write")
    content: str = Field("", description="Text content to write")


class _ListArgs(BaseModel):
    path: str = Field("/", description="Directory to list")


async def build_fs_tools(payload: Dict[str, Any]) -> List[Any]:
    fs_cfg = payload.get("fs") or {}
    conn_id: Optional[str] = payload.get("ws_conn_id") or None
    if not conn_id:
        return []
    nodes = fs_cfg.get("nodes") or []
    tools: List[Any] = []
    for n in nodes:
        try:
            label = str(n.get("id") or "fs")
        except Exception:
            label = "fs"
        r = FsReadFile(conn_id, label)
        w = FsWriteFile(conn_id, label)
        l = FsListDir(conn_id, label)
        # Prefer proper LangChain Tool objects for provider compatibility (e.g., OpenAI)
        if StructuredTool is not None:
            async def _r(path: str) -> str:  # type: ignore
                return await r.ainvoke({"path": path})
            async def _w(path: str, content: str) -> str:  # type: ignore
                return await w.ainvoke({"path": path, "content": content})
            async def _l(path: str) -> str:  # type: ignore
                return await l.ainvoke({"path": path})
            tools.append(StructuredTool.from_function(
                name=r.name, description=r.description, coroutine=_r, args_schema=_ReadArgs
            ))
            tools.append(StructuredTool.from_function(
                name=w.name, description=w.description, coroutine=_w, args_schema=_WriteArgs
            ))
            tools.append(StructuredTool.from_function(
                name=l.name, description=l.description, coroutine=_l, args_schema=_ListArgs
            ))
        else:
            tools.append(r)
            tools.append(w)
            tools.append(l)
    return tools
