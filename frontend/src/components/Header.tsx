import React, { useEffect, useState } from "react";
import { Button, Popover, TextField, Select } from "@radix-ui/themes";
import { getBackendClient, setBackendBaseUrl } from "../engine/backendClient";
import { useSettingsStore } from "../engine/settings";
import { useEngineStore } from "../engine/store";
import { loadSettings as dbLoadSettings } from "../db/sqlite";

export default function Header({
  onAddNode,
}: {
  onAddNode: () => void;
}) {
  const apiKeys = useSettingsStore((s) => s.apiKeys);
  const setApiKeyFor = useSettingsStore((s) => s.setApiKeyFor);
  const [providerIds, setProviderIds] = useState<string[]>([]);
  const [keysOpen, setKeysOpen] = useState(false);
  const isBusy = useEngineStore((s) => s.activeRunning.size > 0);
  const [newNodeType, setNewNodeType] = useState<string>("llm");
  const [bookmarks, setBookmarks] = useState<{ name: string; savedAt: number }[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const res = await getBackendClient().GET("/providers");
        const ids = (res.data?.providers ?? []).map((p: any) => String(p.id));
        setProviderIds(ids);
      } catch {
        setProviderIds([]);
      }
    })();
  }, []);

  useEffect(() => {
    try {
      const all = dbLoadSettings();
      const raw = all["bookmarks"] ?? "[]";
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        setBookmarks(parsed.map((b: any) => ({ name: String(b.name), savedAt: Number(b.savedAt || 0) })));
      }
    } catch {}
  }, []);

  const [selectedBookmark, setSelectedBookmark] = useState<string>("")

  return (
    <header className="app__header">
      <div
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          marginLeft: 12,
          width: "100%",
        }}
      >
        <h2 style={{ margin: 0, marginRight: "32px" }}>GUI Agent Builder</h2>
        <Select.Root value={newNodeType} onValueChange={(v) => setNewNodeType(v)} disabled={isBusy}>
          <Select.Trigger placeholder="New node…" style={{ width: 160 }} />
          <Select.Content>
            <Select.Item value="entry">Entry</Select.Item>
            <Select.Item value="llm">LLM</Select.Item>
            <Select.Item value="switch">Switch</Select.Item>
            <Select.Item value="mcp">MCP</Select.Item>
            <Select.Item value="end">End</Select.Item>
          </Select.Content>
        </Select.Root>
        <Button onClick={() => {
          // Share selected type with App via a custom event so it can add the correct node
          window.dispatchEvent(new CustomEvent("graph:setNewNodeType", { detail: { type: newNodeType } }));
          onAddNode();
        }} disabled={isBusy}>
          Add Node
        </Button>

        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, marginLeft: 12 }}>
          <TextField.Root placeholder="bookmark name" id="bm-name" disabled={isBusy} />
          <Button
            onClick={() => {
              const el = document.getElementById("bm-name") as HTMLInputElement | null;
              const name = (el?.value || "").trim();
              if (!name) return;
              window.dispatchEvent(new CustomEvent("graph:saveBookmark", { detail: { name } }));
              if (el) el.value = "";
            }}
            disabled={isBusy}
            variant="soft"
          >
            Save
          </Button>
          <Select.Root
            value={selectedBookmark}
            onValueChange={(v) => setSelectedBookmark(v)}
            disabled={isBusy || bookmarks.length === 0}
          >
            <Select.Trigger placeholder={bookmarks.length ? "Choose bookmark…" : "No bookmarks"} style={{ width: 220 }} />
            <Select.Content>
              {bookmarks.map((b) => (
                <Select.Item key={b.name} value={b.name}>
                  {b.name}
                </Select.Item>
              ))}
            </Select.Content>
          </Select.Root>
          <Button
            onClick={() => selectedBookmark && window.dispatchEvent(new CustomEvent("graph:loadBookmark", { detail: { name: selectedBookmark } }))}
            disabled={isBusy || !selectedBookmark}
          >
            Load
          </Button>
        </div>

        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12 }}>
          <TextField.Root placeholder="Backend URL" id="be-url" style={{ width: 240 }} />
          <Button
            variant="soft"
            onClick={() => {
              const el = document.getElementById("be-url") as HTMLInputElement | null;
              const url = (el?.value || "").trim();
              if (!url) return;
              setBackendBaseUrl(url);
            }}
          >
            Set Backend
          </Button>
          <Popover.Root open={keysOpen} onOpenChange={setKeysOpen}>
            <Popover.Trigger>
              <Button variant="soft">API Keys ▾</Button>
            </Popover.Trigger>
            <Popover.Content maxWidth="360px">
              <div style={{ display: "grid", gap: 10 }}>
                <div style={{ fontSize: 12, color: "var(--muted)" }}>Provider API Keys</div>
                {providerIds.length === 0 ? (
                  <div style={{ fontSize: 12, color: "var(--muted)" }}>No providers</div>
                ) : (
                  providerIds.map((pid) => (
                    <label key={pid} className="field">
                      <span>{pid}</span>
                      <TextField.Root
                        type="password"
                        placeholder={`Key for ${pid}`}
                        value={apiKeys[pid] ?? ""}
                        onChange={(e) => setApiKeyFor(pid, (e.target as HTMLInputElement).value)}
                      />
                    </label>
                  ))
                )}
              </div>
            </Popover.Content>
          </Popover.Root>
        </div>
      </div>
    </header>
  );
}
