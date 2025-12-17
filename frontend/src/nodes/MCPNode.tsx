import React from 'react';
// MCP has no inputs or outputs per spec
import type { RFNodeProps, MCPData } from '../types';
import NodeChrome from './NodeChrome';

export default function MCPNode({ data }: RFNodeProps<MCPData>) {
  return (
    <NodeChrome title={data.name ?? 'MCP'} kind="mcp">
      <div className="muted" title={data.url}>{data.url}</div>
    </NodeChrome>
  );
}
