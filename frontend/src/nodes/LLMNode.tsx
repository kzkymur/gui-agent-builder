import React from "react";
import { Handle, Position } from "reactflow";
import type { LLMData, RFNodeProps } from "../types";
import NodeChrome from "./NodeChrome";

export default function LLMNode({ id, data }: RFNodeProps<LLMData>) {
  const outs = Array.isArray(data.outputPointers) ? data.outputPointers : [];
  const ins = Array.isArray(data.inputs) ? data.inputs : [];
  const colorForAttrs = (inp: { mode?: string; trigger?: boolean }) => {
    const mode = String(inp?.mode ?? "normal");
    const required = !(mode === "optional" || mode === "optional_holding"); // red
    const holding = mode === "holding" || mode === "optional_holding"; // green
    const trigger = inp?.trigger !== false; // blue
    const r = required ? 255 : 0;
    // Tone down green channel to reduce visual brightness
    const g = holding ? 170 : 0;
    const b = trigger ? 255 : 0;
    const bg = `rgb(${r}, ${g}, ${b})`;
    const border = `rgb(${Math.max(0, r - 96)}, ${Math.max(0, g - 96)}, ${Math.max(0, b - 96)})`;
    return { bg, border };
  };
  return (
    <NodeChrome
      nodeId={id}
      title={data.name ?? "LLM"}
      kind="llm"
      handles={
        <>
          <div className="node__handles-left">
            {ins.map((inp, idx) => (
              <div
                key={`${inp.key || "in"}-${idx}`}
                style={{ display: "flex", alignItems: "center", gap: 6 }}
              >
                {(() => {
                  const c = colorForAttrs(inp as { mode?: string; trigger?: boolean });
                  return (
                    <Handle
                      id={`in-${idx}`}
                      type="target"
                      position={Position.Left}
                      style={{
                        background: c.bg,
                        borderColor: c.border,
                        borderWidth: 2,
                      }}
                    />
                  );
                })()}
                <span
                  title={inp.description}
                  style={{ fontSize: 11, color: "#9ca3af" }}
                >
                  {inp.key || `in-${idx}`}
                </span>
              </div>
            ))}
          </div>
          <div className="node__handles-right">
            {outs.map((val, idx) => (
              <Handle
                key={`${val || "out"}-${idx}`}
                id={`out-${idx}`}
                type="source"
                position={Position.Right}
              />
            ))}
          </div>
        </>
      }
    >
      <div className="kvs">
        <div className="kv">
          <span>Provider</span>
          <code>{data.provider}</code>
        </div>
        <div className="kv">
          <span>Model</span>
          <code>{data.model}</code>
        </div>
      </div>
    </NodeChrome>
  );
}
