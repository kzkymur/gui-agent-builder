import { Button, IconButton, Text, TextArea, TextField } from "@radix-ui/themes";
import React from "react";
import type { Node } from "reactflow";
import { useEngineStore } from "../../engine/store";
import type { NodeData } from "../../types";

export default function EntryPanel({
  draft,
  onPatch,
}: {
  draft: NodeData;
  onPatch: (patch: Partial<NodeData>) => void;
}) {
  const isBusy = useEngineStore((s) => s.activeRunning.size > 0);
  const inputs: { key: string; value?: string }[] =
    (draft.inputs as { key: string; value?: string }[] | undefined) ?? [];
  const setAt = (i: number, patch: Partial<{ key: string; value?: string }>) => {
    const next = inputs.map((item, idx) => (idx === i ? { ...item, ...patch } : item));
    onPatch({ inputs: next } as unknown as Partial<NodeData>);
  };
  const removeAt = (i: number) =>
    onPatch({ inputs: inputs.filter((_, idx) => idx !== i) } as unknown as Partial<NodeData>);
  const add = () =>
    onPatch({ inputs: [...inputs, { key: "", value: "" }] } as unknown as Partial<NodeData>);
  return (
    <div className="field">
      <Text as="span" weight="medium">
        Inputs
      </Text>
      <div style={{ display: "grid", gap: 8 }}>
        {inputs.map((it: { key: string; value?: string }, i: number) => (
          <div key={`${it.key || "k"}-${i}`} style={{ display: "grid", gap: 6 }}>
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
              <IconButton
                type="button"
                color="red"
                variant="soft"
                size="1"
                onClick={() => removeAt(i)}
                disabled={isBusy}
                aria-label={`Remove input ${i + 1}`}
              >
                −
              </IconButton>
            </div>
          </div>
        ))}
        <div>
          <Button type="button" onClick={add} disabled={isBusy}>
            Add Input
          </Button>
        </div>
      </div>
      <div className="help">
        Each input row defines a <b>key</b> and a <b>value</b> passed to downstream nodes.
      </div>
    </div>
  );
}
