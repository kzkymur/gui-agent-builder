import React from "react";
import { Handle, Position } from "reactflow";
import type { LLMData, RFNodeProps } from "../types";
import NodeChrome from "./NodeChrome";

export default function LLMNode({ id, data }: RFNodeProps<LLMData>) {
  const outs = Array.isArray(data.outputPointers) ? data.outputPointers : [];
  const ins = Array.isArray(data.inputs) ? data.inputs : [];
  const colorForMode = (
    mode: LLMData["inputs"] extends Array<infer T>
      ? T extends { mode?: string }
        ? T["mode"]
        : string | undefined
      : string | undefined
  ) => {
    const m = (mode ?? "normal") as string;
    if (m === "optional") return { bg: "#3b82f6", border: "#1e40af" }; // blue
    if (m === "holding") return { bg: "#f59e0b", border: "#92400e" }; // amber
    if (m === "optional_holding") return { bg: "#8b5cf6", border: "#4c1d95" }; // violet
    return { bg: "#000", border: "#d1d5db" }; // normal → white with gray border
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
                  const c = colorForMode((inp as { mode?: string }).mode);
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
        <div className="kv">
          <span>Schema</span>
          <code>{data.responseSchema ? "defined" : "—"}</code>
        </div>
      </div>
    </NodeChrome>
  );
}
