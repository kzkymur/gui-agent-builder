import type { Edge, Node } from "reactflow";
import type { NodeData } from "../types";

function handleLabelFor(
  nodes: Node<NodeData>[],
  nodeId: string | null | undefined,
  handleId: string | null | undefined,
  dir: "source" | "target",
) {
  if (!nodeId || !handleId) return null;
  const node = nodes.find((n) => n.id === nodeId);
  if (!node) return null;
  const data: any = node.data ?? {};
  switch (node.type) {
    case "entry": {
      // entry source handles: out-<idx> map to inputs[idx].key
      if (dir === "source" && handleId.startsWith("out-")) {
        const idx = Number(handleId.replace("out-", ""));
        return Array.isArray(data.inputs) ? (data.inputs[idx]?.key ?? null) : null;
      }
      break;
    }
    case "llm": {
      if (dir === "target" && handleId.startsWith("in-")) {
        const idx = Number(handleId.replace("in-", ""));
        return Array.isArray(data.inputs) ? (data.inputs[idx]?.key ?? null) : null;
      }
      if (dir === "source" && handleId.startsWith("out-")) {
        const idx = Number(handleId.replace("out-", ""));
        const outs =
          Array.isArray(data.outputPointers) && data.outputPointers.length > 0
            ? data.outputPointers
            : ["/result"];
        return outs[idx] ?? null;
      }
      break;
    }
    case "switch": {
      if (dir === "source" && handleId === "out-true") return "pass";
      if (dir === "source" && handleId === "out-false") return "else";
      if (dir === "target" && handleId === "in-gate") return "gate";
      if (dir === "target" && handleId === "in-signal") return "signal";
      break;
    }
    default:
      break;
  }
  return null;
}

export function buildGraphSnapshot(nodes: Node<NodeData>[], edges: Edge[]) {
  return {
    nodes: nodes.map((n) => ({
      id: n.id,
      type: n.type,
      x: n.position.x,
      y: n.position.y,
      data: n.data,
    })),
    edges: edges.map((e) => ({
      id: e.id,
      from: {
        node: e.source,
        handleId: (e as any).sourceHandle ?? null,
        handleLabel: handleLabelFor(nodes, e.source, (e as any).sourceHandle, "source"),
      },
      to: {
        node: e.target,
        handleId: (e as any).targetHandle ?? null,
        handleLabel: handleLabelFor(nodes, e.target, (e as any).targetHandle, "target"),
      },
    })),
  };
}

export function logGraphSnapshot(nodes: Node<NodeData>[], edges: Edge[]) {
  const payload = buildGraphSnapshot(nodes, edges);
  // eslint-disable-next-line no-console
  console.log("[LLM-Flow] Graph snapshot", payload);
}
