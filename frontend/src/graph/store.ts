import type { Edge, EdgeChange, Node, NodeChange } from "reactflow";
import { applyEdgeChanges, applyNodeChanges } from "reactflow";
import create from "zustand";
import { initDB, loadGraph, saveGraph } from "../db/sqlite";
import type { NodeData } from "../types";

type GraphState = {
  ready: boolean;
  nodes: Node<NodeData>[];
  edges: Edge[];
  selectedId: string | null;
  init: () => Promise<void>;
  setSelection: (id: string | null) => void;
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  addNode: (node: Node<NodeData>) => void;
  removeNode: (id: string) => void;
  persistNow: () => void;
};

export const useGraphStore = create<GraphState>()((set, get) => ({
  ready: false,
  nodes: [],
  edges: [],
  selectedId: null,
  init: async () => {
    await initDB();
    const { nodes, edges } = loadGraph();
    set({
      ready: true,
      nodes: nodes.map((n) => ({
        id: n.id,
        type: (n.type ?? "default") as Node<NodeData>["type"],
        position: { x: n.x, y: n.y },
        data: n.data as NodeData,
      })),
      edges: edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        sourceHandle: (e as { sourceHandle?: string | null }).sourceHandle ?? null,
        targetHandle: (e as { targetHandle?: string | null }).targetHandle ?? null,
      })),
    });
  },
  setSelection: (id) => set({ selectedId: id }),
  onNodesChange: (changes) => set((s) => ({ nodes: applyNodeChanges(changes, s.nodes) })),
  onEdgesChange: (changes) => set((s) => ({ edges: applyEdgeChanges(changes, s.edges) })),
  addNode: (node) => set((s) => ({ nodes: [...s.nodes, node] })),
  removeNode: (id) =>
    set((s) => ({
      nodes: s.nodes.filter((n) => n.id !== id),
      edges: s.edges.filter((e) => e.source !== id && e.target !== id),
      selectedId: s.selectedId === id ? null : s.selectedId,
    })),
  persistNow: () => {
    const s = get();
    if (!s.ready) return;
    saveGraph(
      s.nodes.map((n) => ({
        id: n.id,
        type: n.type ?? "default",
        x: n.position.x,
        y: n.position.y,
        data: n.data,
      })),
      s.edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target || "",
        sourceHandle: (e as { sourceHandle?: string | null }).sourceHandle ?? null,
        targetHandle: (e as { targetHandle?: string | null }).targetHandle ?? null,
      })),
    );
  },
}));
