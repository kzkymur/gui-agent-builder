import React from "react";
import { Handle, Position } from "reactflow";
import type { RFNodeProps, SwitchData } from "../types";
import NodeChrome from "./NodeChrome";

export default function SwitchNode({ id, data }: RFNodeProps<SwitchData>) {
  const cfg = (data?.inputs || {}) as NonNullable<SwitchData["inputs"]>;
  const colorFor = (name: "gate" | "signal") => {
    const mode = String(cfg?.[name]?.mode ?? "normal");
    // Required is always true for Switch inputs
    const required = true;
    const holding = mode === "holding" || mode === "optional_holding";
    const trigger = cfg?.[name]?.trigger !== false;
    const r = required ? 255 : 0;
    const g = holding ? 170 : 0; // toned green to match LLM
    const b = trigger ? 255 : 0;
    const bg = `rgb(${r}, ${g}, ${b})`;
    const border = `rgb(${Math.max(0, r - 96)}, ${Math.max(0, g - 96)}, ${Math.max(0, b - 96)})`;
    return { bg, border };
  };
  return (
    <NodeChrome
      nodeId={id}
      title={data.name ?? "Switch"}
      kind="switch"
      handles={
        <>
          <div className="node__handles-left">
            <div className="handle-row">
              {(() => {
                const c = colorFor("gate");
                return (
                  <Handle
                    id="in-gate"
                    type="target"
                    position={Position.Left}
                    style={{ background: c.bg, borderColor: c.border, borderWidth: 2 }}
                  />
                );
              })()}
              <span className="handle-label">gate</span>
            </div>
            <div className="handle-row">
              {(() => {
                const c = colorFor("signal");
                return (
                  <Handle
                    id="in-signal"
                    type="target"
                    position={Position.Left}
                    style={{ background: c.bg, borderColor: c.border, borderWidth: 2 }}
                  />
                );
              })()}
              <span className="handle-label">signal</span>
            </div>
          </div>
          <div className="node__handles-right">
            <div className="handle-row">
              <span className="handle-label">pass</span>
              <Handle id="out-true" type="source" position={Position.Right} />
            </div>
            <div className="handle-row">
              <span className="handle-label">else</span>
              <Handle id="out-false" type="source" position={Position.Right} />
            </div>
          </div>
        </>
      }
    />
  );
}
