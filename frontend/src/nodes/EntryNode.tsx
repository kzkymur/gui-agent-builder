import React from "react";
import { Handle, Position } from "reactflow";
import type { RFNodeProps, EntryData } from "../types";
import NodeChrome from "./NodeChrome";
export default function EntryNode({ id, data }: RFNodeProps<EntryData>) {
  const items = data.inputs ?? [{ key: "user_input", value: "" }];
  return (
    <NodeChrome
      title={data.name ?? "Entry"}
      kind="entry"
      handles={
        <>
          <div
            className="node__handles-left"
            style={{ display: "flex", alignItems: "center", paddingLeft: 4 }}
          >
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                const evt = new CustomEvent("engine:ignite", { detail: { entryId: id } });
                window.dispatchEvent(evt);
              }}
              title="Ignite: start the engine from this entry"
              style={{
                fontSize: 10,
                padding: "2px 6px",
                borderRadius: 6,
                border: "1px solid #2a2a2e",
                background: "#141418",
                color: "var(--fg)",
              }}
            >
              Ignite
            </button>
          </div>
          <div className="node__handles-right">
            {items.map((it, idx) => (
              <div
                key={it.key + idx}
                style={{ display: "flex", alignItems: "center", gap: 6 }}
              >
                <span
                  title={it.value}
                  style={{ fontSize: 11, color: "#9ca3af" }}
                >
                  {it.key || `out-${idx}`}
                </span>
                <Handle
                  id={`out-${idx}`}
                  type="source"
                  position={Position.Right}
                />
              </div>
            ))}
          </div>
        </>
      }
    >
      <div className="muted">
        Inputs: {items.map((i) => i.key).join(", ") || "none"}
      </div>
    </NodeChrome>
  );
}
