import React from "react";
import { Text, TextArea } from "@radix-ui/themes";
import type { NodeData } from "../../types";
import { useEngineStore } from "../../engine/store";

export default function EndPanel({ draft, onPatch }: { draft: NodeData; onPatch: (p: Partial<NodeData>) => void }) {
  const isBusy = useEngineStore((s) => s.activeRunning.size > 0);
  return (
    <label className="field">
      <Text as="span" weight="medium">Value (preview)</Text>
      <TextArea
        rows={3}
        style={{ resize: "vertical" }}
        value={(draft as any).value ?? ""}
        onChange={(e) => onPatch({ value: e.target.value } as any)}
        disabled={isBusy}
      />
    </label>
  );
}

