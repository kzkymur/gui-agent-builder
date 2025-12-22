import React from "react";
import { Text, TextField } from "@radix-ui/themes";
import type { Node } from "reactflow";
import { useEngineStore } from "../engine/store";
import type { NodeData } from "../types";
import LLMPanel from "./panels/LLMPanel";
import EntryPanel from "./panels/EntryPanel";
import MCPPanel from "./panels/MCPPanel";
import SwitchPanel from "./panels/SwitchPanel";
import EndPanel from "./panels/EndPanel";

export default function NodeEditor({
  node,
  mcpOptions,
  onChange,
}: {
  node: Node<NodeData> | null;
  mcpOptions: { id: string; name: string }[];
  onChange: (updater: (prev: Node<NodeData>[]) => Node<NodeData>[]) => void;
}) {
  const [draft, setDraft] = React.useState<NodeData | null>(node?.data ?? null);
  const isBusy = useEngineStore((s) => s.activeRunning.size > 0);

  React.useEffect(() => {
    setDraft(node?.data ?? null);
  }, [node?.id]);

  React.useEffect(() => {
    if (!node || !draft) return;
    const t = setTimeout(() => {
      onChange((prev) => prev.map((n) => (n.id === node.id ? { ...n, data: draft } : n)));
    }, 200);
    return () => clearTimeout(t);
  }, [draft, node, onChange]);

  if (!node || !draft) return <div style={{ color: "var(--muted)" }}>Select a node to edit.</div>;

  const update = (patch: Partial<NodeData>) => setDraft({ ...draft, ...patch });

  return (
    <div className="editor">
      <div className="section-title">General</div>
      <label className="field">
        <Text as="span" weight="medium">Name</Text>
        <TextField.Root
          value={draft.name ?? ""}
          onChange={(e) => update({ name: (e.target as HTMLInputElement).value })}
          disabled={isBusy}
        />
      </label>

      {node.type === "llm" && (
        <LLMPanel node={node} draft={draft} onPatch={(p) => update(p)} mcpOptions={mcpOptions} />
      )}
      {node.type === "entry" && <EntryPanel draft={draft} onPatch={update} />}
      {node.type === "mcp" && <MCPPanel draft={draft} onPatch={update as any} />}
      {node.type === "switch" && <SwitchPanel draft={draft} onPatch={update} />}
      {node.type === "end" && <EndPanel draft={draft} onPatch={update} />}
    </div>
  );
}

