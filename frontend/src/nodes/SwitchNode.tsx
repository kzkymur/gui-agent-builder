import React from "react";
import { Handle, Position } from "reactflow";
import type { RFNodeProps, SwitchData } from "../types";
import NodeChrome from "./NodeChrome";

export default function SwitchNode({ id, data }: RFNodeProps<SwitchData>) {
  return (
    <NodeChrome
      nodeId={id}
      title={data.name ?? "Switch"}
      kind="switch"
      handles={
        <>
          <div className="node__handles-left">
            <div className="handle-row">
              <Handle id="in-gate" type="target" position={Position.Left} />
              <span className="handle-label">gate</span>
            </div>
            <div className="handle-row">
              <Handle id="in-signal" type="target" position={Position.Left} />
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
