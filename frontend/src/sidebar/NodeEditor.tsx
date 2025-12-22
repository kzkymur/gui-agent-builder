import { Text, TextField } from "@radix-ui/themes";
import React from "react";
import { useEngineStore } from "../engine/store";
import { useGraphUI } from "../graph/uiStore";
import type { NodeData } from "../types";
import EndPanel from "./panels/EndPanel";
import EntryPanel from "./panels/EntryPanel";
import LLMPanel from "./panels/LLMPanel";
import MCPPanel from "./panels/MCPPanel";
import SwitchPanel from "./panels/SwitchPanel";

export default function NodeEditor() {
  const nodes = useGraphUI((s) => s.nodes);
  const selectedId = useGraphUI((s) => s.selectedId);
  const setNodes = useGraphUI((s) => s.setNodes);
  const node = nodes.find((n) => n.id === selectedId) ?? null;
  const [draft, setDraft] = React.useState<NodeData | null>(node?.data ?? null);
  const isBusy = useEngineStore((s) => s.activeRunning.size > 0);

  React.useEffect(() => {
    setDraft(node?.data ?? null);
  }, [node]);

  React.useEffect(() => {
    if (!node || !draft) return;
    const t = setTimeout(() => {
      setNodes((prev) => prev.map((n) => (n.id === node.id ? { ...n, data: draft } : n)));
    }, 200);
    return () => clearTimeout(t);
  }, [draft, node, setNodes]);

  if (!node || !draft) return <div style={{ color: "var(--muted)" }}>Select a node to edit.</div>;

  const update = (patch: Partial<NodeData>) => setDraft({ ...draft, ...patch });

  const mcpOptions = nodes
    .filter((n) => n.type === "mcp")
    .map((n) => ({ id: n.id, name: (n.data as NodeData | undefined)?.name || n.id }));

  return (
    <div className="editor">
      <div className="section-title">General</div>
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
    </div>
  );
}
