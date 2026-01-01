from typing import Dict, Any, List
from fastapi import WebSocket
import asyncio

# Global websocket registry with pending call coordination
# WS_STATE[conn_id] = { "ws": WebSocket, "pending": Dict[str, asyncio.Future] }
WS_STATE: Dict[str, Dict[str, Any]] = {}

def set_ws(conn_id: str, ws: WebSocket):
    WS_STATE[conn_id] = {"ws": ws, "pending": {}}

def get_ws(conn_id: str) -> WebSocket | None:
    st = WS_STATE.get(conn_id)
    return st.get("ws") if st else None

def pop_ws(conn_id: str):
    st = WS_STATE.pop(conn_id, None)
    if st:
        # cancel all pending listeners
        for fut in list(st.get("pending", {}).values()):
            try:
                if not fut.done():
                    fut.set_exception(asyncio.CancelledError())
            except Exception:
                pass

def register_pending(conn_id: str, call_id: str) -> asyncio.Future:
    st = WS_STATE.get(conn_id)
    if not st:
        raise RuntimeError("websocket not connected")
    fut: asyncio.Future = asyncio.get_event_loop().create_future()
    st["pending"][call_id] = fut
    return fut

def resolve_pending(conn_id: str, call_id: str, payload: Any):
    st = WS_STATE.get(conn_id)
    if not st:
        return
    fut = st["pending"].pop(call_id, None)
    if fut and not fut.done():
        fut.set_result(payload)

def list_connections() -> List[str]:
    return list(WS_STATE.keys())
