import React from "react";
import { Handle, Position } from "reactflow";
import type { RFNodeProps, SwitchData, NodeData } from "../types";
import NodeChrome from "./NodeChrome";
import ColoredHandle from "./ColoredHandle";

export default function SwitchNode({ id, data }: RFNodeProps<NodeData>) {
  const cfg = (data?.inputs || {}) as NonNullable<SwitchData["inputs"]>;
  return (
    <NodeChrome
      nodeId={id}
      title={data.name ?? "Switch"}
      kind="switch"
      handles={
        <>
          <div className="node__handles-left">
            <div className="handle-row">
              <ColoredHandle
                id="in-gate"
                type="target"
                position={Position.Left}
                mode={cfg?.gate?.mode}
                trigger={cfg?.gate?.trigger}
                requiredOverride={true}
              />
              <span className="handle-label">gate</span>
            </div>
            <div className="handle-row">
              <ColoredHandle
                id="in-signal"
                type="target"
                position={Position.Left}
                mode={cfg?.signal?.mode}
                trigger={cfg?.signal?.trigger}
                requiredOverride={true}
              />
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
