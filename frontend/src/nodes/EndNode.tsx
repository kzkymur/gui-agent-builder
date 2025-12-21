import React from "react";
import { Handle, Position } from "reactflow";
import type { EndData, RFNodeProps } from "../types";
import NodeChrome from "./NodeChrome";

export default function EndNode({ id, data }: RFNodeProps<EndData>) {
  return (
    <NodeChrome
      nodeId={id}
      title={data.name ?? "End"}
      kind="end"
      handles={
        <div className="node__handles-left">
          <Handle type="target" position={Position.Left} />
        </div>
      }
    >
      <div className="muted">Terminal node</div>
    </NodeChrome>
  );
}
