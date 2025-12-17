import React from "react";
import { Handle, Position } from "reactflow";
import type { RFNodeProps, EntryData } from "../types";
import NodeChrome from "./NodeChrome";
export default function EntryNode({ data }: RFNodeProps<EntryData>) {
  const ins = data.inputs ?? ["user_input"];
  return (
    <NodeChrome
      title={data.name ?? "Entry"}
      kind="entry"
      handles={
        <>
          <div />
          <div className="node__handles-right">
            {ins.map((inp, idx) => (
              <Handle
                key={inp + idx}
                id={`out-${idx}`}
                type="source"
                position={Position.Right}
              />
            ))}
          </div>
        </>
      }
    >
      <div className="muted">Inputs: {ins.join(", ") || "none"}</div>
    </NodeChrome>
  );
}
