let ws: WebSocket | null = null;
let wsId: string | null = null;
let connecting: Promise<string> | null = null;
let wantClose = false;

export function getWsId(): string | null { return wsId; }
export function isConnected(): boolean { return ws != null && ws.readyState === WebSocket.OPEN; }

export function connect(baseUrl: string) {
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
    return wsId;
  }
  if (connecting) return wsId;
  wsId = `fe-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const url = baseUrl.replace(/^http/, "ws") + `/ws/${wsId}`;
  ws = new WebSocket(url);
  wantClose = false;
  ws.onopen = () => {
    try { console.debug("[fs-ws] open", { wsId, url }); } catch {}
    try { ws?.send(JSON.stringify({ type: "connected" })); } catch {}
    // honor a queued close request
    if (wantClose) {
      try { ws?.close(); } catch {}
    }
  };
  ws.onclose = () => { try { console.debug("[fs-ws] close", { wsId }); } catch {} ws = null; connecting = null; };
  ws.onmessage = async (ev) => {
    try {
      const msg = JSON.parse(String(ev.data || "{}"));
      if (!msg || typeof msg !== "object") return;
      const { id, type, action, path, content } = msg as { id?: string; type?: string; action?: string; path?: string; content?: string };
      if (!id) return;
      if (type && type !== "req") return;
      try { console.debug("[fs-ws] recv", { id, action, path }); } catch {}
      if (action === "fs_list") {
        const res = await import("../fs/vfs").then((m) => m.VFS.listDirectory(path || "/"));
        const out = { type: "res", id, ok: true, entries: res };
        try { console.debug("[fs-ws] send", out); } catch {}
        (ws as WebSocket)?.send(JSON.stringify(out));
      } else if (action === "fs_read") {
        const res = await import("../fs/vfs").then((m) => m.VFS.readFile(path || "/"));
        const out = { type: "res", id, ok: true, content: res };
        try { console.debug("[fs-ws] send", out); } catch {}
        (ws as WebSocket)?.send(JSON.stringify(out));
      } else if (action === "fs_write") {
        await import("../fs/vfs").then((m) => m.VFS.writeFile(path || "/", content || ""));
        const out = { type: "res", id, ok: true };
        try { console.debug("[fs-ws] send", out); } catch {}
        (ws as WebSocket)?.send(JSON.stringify(out));
      }
    } catch {
      // ignore malformed
    }
  };
  // lightweight keepalive
  const ping = () => { try { ws?.send(JSON.stringify({ type: "ping", ts: Date.now() })); } catch {} };
  const pingTimer = window.setInterval(ping, 10000);
  ws.addEventListener("close", () => window.clearInterval(pingTimer), { once: true });
  // create a simple connecting promise to coalesce multiple callers
  connecting = new Promise((resolve) => {
    if (!ws) return resolve(wsId || "");
    if (ws.readyState === WebSocket.OPEN) return resolve(wsId || "");
    const done = () => resolve(wsId || "");
    ws.addEventListener("open", done, { once: true });
    // also resolve after a short grace period to avoid blocking
    setTimeout(done, 300);
  });
  return wsId;
}

export function disconnect() {
  // Avoid closing during CONNECTING which causes a noisy error; schedule close after open
  if (ws && ws.readyState === WebSocket.CONNECTING) {
    wantClose = true;
    return;
  }
  try { ws?.close(); } catch {}
  ws = null; wsId = null; connecting = null; wantClose = false;
}

// Always disconnect when the page unloads
if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", () => {
    try { ws?.close(); } catch {}
  });
}

export async function ensureConnected(baseUrl: string): Promise<string> {
  if (isConnected() && wsId) return wsId;
  const id = connect(baseUrl) as string;
  // wait up to 1500ms for OPEN to avoid race with first RPC
  if (ws && ws.readyState !== WebSocket.OPEN) {
    await new Promise((resolve) => {
      const t = setTimeout(resolve, 1500);
      ws!.addEventListener("open", () => { clearTimeout(t); resolve(null); }, { once: true });
    });
  }
  return id;
}
