import React from "react";
import { Button, Text, TextArea, TextField, IconButton } from "@radix-ui/themes";
import type { Node } from "reactflow";
import type { NodeData } from "../../types";
import { useEngineStore } from "../../engine/store";

export default function EntryPanel({
  draft,
  onPatch,
}: {
  draft: NodeData;
  onPatch: (patch: Partial<NodeData>) => void;
}) {
  const isBusy = useEngineStore((s) => s.activeRunning.size > 0);
  const inputs = (draft as any).inputs ?? [];
  const setAt = (i: number, patch: Partial<{ key: string; value?: string }>) => {
    const next = inputs.map((item: any, idx: number) => (idx === i ? { ...item, ...patch } : item));
    onPatch({ inputs: next } as any);
  };
  const removeAt = (i: number) => onPatch({ inputs: inputs.filter((_: any, idx: number) => idx !== i) } as any);
  const add = () => onPatch({ inputs: [...inputs, { key: "", value: "" }] } as any);
  return (
    <div className="field">
      <Text as="span" weight="medium">Inputs</Text>
      <div style={{ display: "grid", gap: 8 }}>
        {inputs.map((it: any, i: number) => (
          <div key={i} style={{ display: "grid", gap: 6 }}>
            <div style={{ display: "flex", gap: 6 }}>
              <TextField.Root
                style={{ width: "40%" }}
                placeholder="key"
                value={it.key ?? ""}
                onChange={(e) => setAt(i, { key: (e.target as HTMLInputElement).value })}
                disabled={isBusy}
              />
              <TextArea
                style={{ flex: 1 }}
                placeholder="value"
                value={it.value ?? ""}
                onChange={(e) => setAt(i, { value: e.target.value })}
                disabled={isBusy}
              />
              <IconButton type="button" color="red" variant="soft" size="1" onClick={() => removeAt(i)} disabled={isBusy} aria-label={`Remove input ${i + 1}`}>
                −
              </IconButton>
            </div>
          </div>
        ))}
        <div>
          <Button type="button" onClick={add} disabled={isBusy}>Add Input</Button>
        </div>
      </div>
      <div className="help">Each input row defines a <b>key</b> and a <b>value</b> passed to downstream nodes.</div>
    </div>
  );
}

