import React from "react";
import { Handle, Position } from "reactflow";
import type { RFNodeProps, RouterData } from "../types";
import NodeChrome from "./NodeChrome";

export default function RouterNode({ id, data }: RFNodeProps<RouterData>) {
  const branches = data.branches ?? ["a", "b"];
  return (
    <NodeChrome
      nodeId={id}
      title={data.name ?? "Router"}
      kind="router"
      handles={
        <>
          <div className="node__handles-left">
            <Handle type="target" position={Position.Left} />
          </div>
          <div className="node__handles-right">
            {branches.map((b, idx) => (
              <Handle key={b + idx} id={`br-${b}`} type="source" position={Position.Right} />
            ))}
          </div>
        </>
      }
    >
      <div className="muted">Branches: {branches.join(", ") || "—"}</div>
    </NodeChrome>
  );
}
