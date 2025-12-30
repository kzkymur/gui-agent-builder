import { Checkbox, Text } from "@radix-ui/themes";
import React from "react";
import { useEngineStore } from "../../engine/store";
import type { NodeData } from "../../types";

export default function SwitchPanel({
  draft,
  onPatch,
}: { draft: NodeData; onPatch: (p: Partial<NodeData>) => void }) {
  const isBusy = useEngineStore((s) => s.activeRunning.size > 0);
  const thresh = typeof draft.threshold === "number" ? draft.threshold : 0.5;
  return (
    <>
      <label className="field">
        <Text as="span" weight="medium">
          Threshold
        </Text>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={thresh}
            onChange={(e) => onPatch({ threshold: Number(e.target.value) })}
            disabled={isBusy}
            aria-label="Threshold"
          />
          <Text as="span" weight="medium" style={{ minWidth: 44, textAlign: "right" }}>
            {thresh.toFixed(2)}
          </Text>
        </div>
        <div className="help">Gate (boolean→0/1, number) passes when gate ≥ threshold.</div>
      </label>
      <div className="field">
        <Text as="span" weight="medium">Inputs</Text>
        <div style={{ display: "grid", gap: 8 }}>
          {(["gate", "signal"] as const).map((name) => {
            const cfg = (draft.inputs as any)?.[name] ?? {};
            const mode = String(cfg.mode ?? "normal");
            const isHolding = mode === "holding" || mode === "optional_holding";
            const triggerOn = cfg.trigger !== false;
            const onToggle = (opts: { holding?: boolean; trigger?: boolean }) => {
              const holding = opts.holding ?? isHolding;
              const trigger = opts.trigger ?? triggerOn;
              // Required is implicit for Switch; only toggle holding
              const nextMode = holding ? "holding" : "normal";
              const next = {
                ...(draft.inputs || {}),
                [name]: { mode: nextMode, trigger },
              } as any;
              onPatch({ inputs: next });
            };
            return (
              <div key={name} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <code style={{ minWidth: 48 }}>{name}</code>
                <label style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <Checkbox
                    color="green"
                    checked={isHolding}
                    onCheckedChange={(v) => onToggle({ holding: Boolean(v) })}
                    disabled={isBusy}
                    style={{ paddingLeft: 0, paddingRight: 0 }}
                  />
                  <span style={{ color: isHolding ? "#16a34a" : "#9ca3af" }}>Holding</span>
                </label>
                <label style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <Checkbox
                    color="blue"
                    checked={triggerOn}
                    onCheckedChange={(v) => onToggle({ trigger: Boolean(v) })}
                    disabled={isBusy}
                    style={{ paddingLeft: 0, paddingRight: 0 }}
                  />
                  <span style={{ color: triggerOn ? "#3b82f6" : "#9ca3af" }}>Trigger</span>
                </label>
              </div>
            );
          })}
        </div>
        <div className="help">Required/Holding/Trigger rules mirror LLM inputs for gate and signal.</div>
      </div>
    </>
  );
}
