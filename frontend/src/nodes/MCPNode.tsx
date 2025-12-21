import React from "react";
// MCP has no inputs or outputs per spec
import type { MCPData, RFNodeProps } from "../types";
import NodeChrome from "./NodeChrome";

export default function MCPNode({ id, data }: RFNodeProps<MCPData>) {
  return (
    <NodeChrome nodeId={id} title={data.name ?? "MCP"} kind="mcp">
      <div className="muted" title={data.url}>
        {data.url}
      </div>
    </NodeChrome>
  );
}
