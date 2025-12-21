import React, { useEffect, useState } from "react";
import { Button, Popover, TextField, Select } from "@radix-ui/themes";
import { backendClient } from "../engine/backendClient";
import { useSettingsStore } from "../engine/settings";

export default function Header({
  isBusy,
  newNodeType,
  onChangeNewNodeType,
  onAddNode,
}: {
  isBusy: boolean;
  newNodeType: string;
  onChangeNewNodeType: (v: string) => void;
  onAddNode: () => void;
}) {
  const apiKeys = useSettingsStore((s) => s.apiKeys);
  const setApiKeyFor = useSettingsStore((s) => s.setApiKeyFor);
  const [providerIds, setProviderIds] = useState<string[]>([]);
  const [keysOpen, setKeysOpen] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await backendClient.GET("/providers");
        const ids = (res.data?.providers ?? []).map((p: any) => String(p.id));
        setProviderIds(ids);
      } catch {
        setProviderIds([]);
      }
    })();
  }, []);

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
        <Select.Root value={newNodeType} onValueChange={onChangeNewNodeType} disabled={isBusy}>
          <Select.Trigger placeholder="New node…" />
          <Select.Content>
            <Select.Item value="entry">Entry</Select.Item>
            <Select.Item value="llm">LLM</Select.Item>
            <Select.Item value="switch">Switch</Select.Item>
            <Select.Item value="mcp">MCP</Select.Item>
            <Select.Item value="end">End</Select.Item>
          </Select.Content>
        </Select.Root>
        <Button onClick={onAddNode} disabled={isBusy}>
          Add Node
        </Button>

        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 12 }}>
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
