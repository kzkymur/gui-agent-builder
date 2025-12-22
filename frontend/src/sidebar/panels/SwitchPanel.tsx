import React from "react";
import { Text } from "@radix-ui/themes";
import type { NodeData } from "../../types";
import { useEngineStore } from "../../engine/store";

export default function SwitchPanel({ draft, onPatch }: { draft: NodeData; onPatch: (p: Partial<NodeData>) => void }) {
  const isBusy = useEngineStore((s) => s.activeRunning.size > 0);
  const thresh = typeof (draft as any).threshold === "number" ? (draft as any).threshold : 0.5;
  return (
    <label className="field">
      <Text as="span" weight="medium">Threshold</Text>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={thresh}
          onChange={(e) => onPatch({ threshold: Number(e.target.value) } as any)}
          disabled={isBusy}
          aria-label="Threshold"
        />
        <Text as="span" weight="medium" style={{ minWidth: 44, textAlign: "right" }}>
          {thresh.toFixed(2)}
        </Text>
      </div>
      <div className="help">Gate (boolean→0/1, number) passes when gate ≥ threshold.</div>
    </label>
  );
}

