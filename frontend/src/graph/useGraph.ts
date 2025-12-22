import { useEffect, useMemo, useState } from "react";
import type { Edge, Node } from "reactflow";
import { initDB, loadGraph, saveGraph } from "../db/sqlite";
import type { EntryData, LLMData, NodeData } from "../types";

function normalizeNodeData(type: string | undefined, data: unknown): NodeData {
  const d: Record<string, unknown> = (data as Record<string, unknown>) || {};
  if (type === "entry") {
    const inputs = d.inputs as unknown;
    if (Array.isArray(inputs) && inputs.length > 0 && typeof inputs[0] === "string") {
      d.inputs = (inputs as string[]).map((k) => ({ key: k, value: "" }));
    }
  }
  if (type === "llm") {
    const inputs = d.inputs as unknown;
    if (Array.isArray(inputs)) {
      d.inputs = (inputs as Array<Record<string, unknown>>).map((i) => ({
        key: String(i?.key ?? ""),
        description: String(i?.description ?? ""),
      }));
    }
    if (d.outputPointers && !Array.isArray(d.outputPointers)) d.outputPointers = [];
  }
  return d as NodeData;
}

export function useGraph() {
  const [dbReady, setDbReady] = useState(false);
  const [nodes, setNodes] = useState<Node<NodeData>[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      await initDB();
      const persisted = loadGraph();
      if (!mounted) return;
      setDbReady(true);
      if (persisted.nodes.length || persisted.edges.length) {
        setNodes(
          persisted.nodes.map((n) => ({
            id: n.id,
            type: n.type as any,
            position: { x: n.x, y: n.y },
            data: normalizeNodeData(n.type as string, n.data),
          })),
        );
        setEdges(
          persisted.edges.map((e) => ({
            id: e.id,
            source: e.source,
            target: e.target,
            sourceHandle: (e as { sourceHandle?: string | null }).sourceHandle ?? null,
            targetHandle: (e as { targetHandle?: string | null }).targetHandle ?? null,
          })),
        );
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!dbReady) return;
    const t = setTimeout(() => {
      saveGraph(
        nodes.map((n) => ({
          id: n.id,
          type: n.type ?? "default",
          x: n.position.x,
          y: n.position.y,
          data: n.data,
        })),
        edges.map((e) => ({
          id: e.id,
          source: e.source,
          target: e.target!,
          sourceHandle: (e as { sourceHandle?: string | null }).sourceHandle ?? null,
          targetHandle: (e as { targetHandle?: string | null }).targetHandle ?? null,
        })),
      );
    }, 300);
    return () => clearTimeout(t);
  }, [nodes, edges, dbReady]);

  return { dbReady, nodes, setNodes, edges, setEdges } as const;
}
