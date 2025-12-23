import type React from "react";
import { useEngineStore } from "../engine/store";
import { useGraphUI } from "../graph/uiStore";

type Props = {
  title: string;
  children?: React.ReactNode; // body/content
  handles?: React.ReactNode; // area rendered below body
  kind?: string;
  style?: React.CSSProperties;
  nodeId?: string;
};

export default function NodeChrome({ title, children, handles, kind, style, nodeId }: Props) {
  const activeRunning = useEngineStore((s) => s.activeRunning);
  const isRunning = nodeId
    ? Array.from(activeRunning.values()).some((v) => v.nodeId === nodeId)
    : false;
  const selectedId = useGraphUI((s) => s.selectedId);
  const isSelected = nodeId ? selectedId === nodeId : false;
  const cls = [
    "node",
    kind ? `node--${kind}` : null,
    isSelected ? "node--selected" : null,
    isRunning ? "node--running" : null,
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <div className={cls} style={style}>
      <div className="node__title">{title}</div>
      <div className="node__body">{children}</div>
      {handles ? <div className="node__handles">{handles}</div> : null}
    </div>
  );
}
