import { Handle, Position } from "reactflow";
import type { FSData, RFNodeProps } from "../types";
import NodeChrome from "./NodeChrome";

export default function FSNode({ id, data }: RFNodeProps<FSData>) {
  const title = `🗂 ${data?.name ?? id}`;
  return (
    <NodeChrome title={title} nodeId={id} kind="fs">
      <div style={{ fontSize: 12, color: "#8bd5ff" }}>Virtual filesystem</div>
    </NodeChrome>
  );
}
