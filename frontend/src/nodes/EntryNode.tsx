import React from "react";
import { Button } from "@radix-ui/themes";
import { useEngineStore } from "../engine/store";
import { Handle, Position } from "reactflow";
import type { EntryData, RFNodeProps } from "../types";
import NodeChrome from "./NodeChrome";
export default function EntryNode({ id, data }: RFNodeProps<EntryData>) {
  const items = data.inputs ?? [{ key: "user_input", value: "" }];
  const isBusy = useEngineStore((s) => s.activeRunning.size > 0);
  return (
    <NodeChrome
      nodeId={id}
      title={data.name ?? "Entry"}
      kind="entry"
      handles={
        <>
          <div
            className="node__handles-left"
            style={{ display: "flex", alignItems: "center", paddingLeft: 4 }}
          >
            <Button
              type="button"
              size="1"
              variant="soft"
              disabled={isBusy}
              onClick={(e) => {
                e.stopPropagation();
                const evt = new CustomEvent("engine:ignite", { detail: { entryId: id } });
                window.dispatchEvent(evt);
              }}
              title="Ignite: start the engine from this entry"
            >
              Ignite
            </Button>
          </div>
          <div className="node__handles-right">
            {items.map((it, idx) => (
              <div key={it.key + idx} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span title={it.value} style={{ fontSize: 11, color: "#9ca3af" }}>
                  {it.key || `out-${idx}`}
                </span>
                <Handle id={`out-${idx}`} type="source" position={Position.Right} />
              </div>
            ))}
          </div>
        </>
      }
    >
      <div className="muted">Inputs: {items.map((i) => i.key).join(", ") || "none"}</div>
    </NodeChrome>
  );
}
