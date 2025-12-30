import { Button, Text, TextField } from "@radix-ui/themes";
import React from "react";
import { useEngineStore } from "../engine/store";
import { useGraphUI } from "../graph/uiStore";
import type { NodeData } from "../types";
import EndPanel from "./panels/EndPanel";
import EntryPanel from "./panels/EntryPanel";
import LLMPanel from "./panels/LLMPanel";
import MCPPanel from "./panels/MCPPanel";
import SwitchPanel from "./panels/SwitchPanel";
import IOHistoryPanel from "./components/IOHistoryPanel";

export default function NodeEditor() {
  const nodes = useGraphUI((s) => s.nodes);
  const selectedId = useGraphUI((s) => s.selectedId);
  const setNodes = useGraphUI((s) => s.setNodes);
  const node = nodes.find((n) => n.id === selectedId) ?? null;
  const [draft, setDraft] = React.useState<NodeData | null>(node?.data ?? null);
  const lastSavedRef = React.useRef<string | null>(node ? JSON.stringify(node.data ?? {}) : null);
  const isBusy = useEngineStore((s) => s.activeRunning.size > 0);
  const showHistory = useGraphUI((s) => s.showHistory);
  const toggleHistory = useGraphUI((s) => s.toggleHistory);

  React.useEffect(() => {
    setDraft(node?.data ?? null);
    lastSavedRef.current = node ? JSON.stringify(node.data ?? {}) : null;
  }, [node]);

  React.useEffect(() => {
    if (!node || !draft) return;
    let cancelled = false;
    const pending = JSON.stringify(draft);
    const t = setTimeout(() => {
      if (cancelled) return;
      setNodes((prev) => prev.map((n) => (n.id === node.id ? { ...n, data: draft } : n)));
      lastSavedRef.current = pending;
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(t);
      // Flush only if different from last saved to avoid update loops
      const last = lastSavedRef.current;
      if (last !== pending) {
        setNodes((prev) => prev.map((n) => (node && n.id === node.id ? { ...n, data: draft } : n)));
        lastSavedRef.current = pending;
      }
    };
  }, [draft, node, setNodes]);

  if (!node || !draft) return <div style={{ color: "var(--muted)" }}>Select a node to edit.</div>;

  const update = (patch: Partial<NodeData>) => setDraft({ ...draft, ...patch });

  const mcpOptions = nodes
    .filter((n) => n.type === "mcp")
    .map((n) => ({ id: n.id, name: (n.data as NodeData | undefined)?.name || n.id }));

  return (
    <div className="editor">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div className="section-title">{showHistory ? "History" : "General"}</div>
        <Button size="1" variant="soft" onClick={() => toggleHistory()}>
          {showHistory ? "Show Config" : "Show History"}
        </Button>
      </div>

      {showHistory && node && <IOHistoryPanel nodeId={node.id} />}
      {!showHistory && (
        <>
          <div className="field">
            <Text as="span" weight="medium">
              Name
            </Text>
            <TextField.Root
              value={draft.name ?? ""}
              onChange={(e) => update({ name: (e.target as HTMLInputElement).value })}
              disabled={isBusy}
            />
          </div>

          {node.type === "llm" && (
            <LLMPanel node={node} draft={draft} onPatch={(p) => update(p)} mcpOptions={mcpOptions} />
          )}
          {node.type === "entry" && <EntryPanel draft={draft} onPatch={update} />}
          {node.type === "mcp" && <MCPPanel draft={draft} onPatch={update} />}
          {node.type === "switch" && <SwitchPanel draft={draft} onPatch={update} />}
          {node.type === "end" && <EndPanel draft={draft} onPatch={update} />}
        </>
      )}
    </div>
  );
}
