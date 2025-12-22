import { Text, TextArea } from "@radix-ui/themes";
import React from "react";
import { useEngineStore } from "../../engine/store";
import type { NodeData } from "../../types";

export default function EndPanel({
  draft,
  onPatch,
}: { draft: NodeData; onPatch: (p: Partial<NodeData>) => void }) {
  const isBusy = useEngineStore((s) => s.activeRunning.size > 0);
  return (
    <div className="field">
      <Text as="span" weight="medium">
        Value (preview)
      </Text>
      <TextArea
        rows={3}
        style={{ resize: "vertical" }}
        value={(draft as NodeData).value ?? ""}
        onChange={(e) => onPatch({ value: e.target.value })}
        disabled={isBusy}
      />
    </div>
  );
}
