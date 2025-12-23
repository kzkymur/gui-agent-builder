import type { Edge, Node } from "reactflow";
import create from "zustand";
import type { NodeData } from "../types";

type GraphUIState = {
  nodes: Node<NodeData>[];
  edges: Edge[];
  selectedId: string | null;
  clipboard: Node<NodeData> | null;
  init: (nodes: Node<NodeData>[], edges: Edge[]) => void;
  setNodes: (updater: Node<NodeData>[] | ((prev: Node<NodeData>[]) => Node<NodeData>[])) => void;
  setEdges: (updater: Edge[] | ((prev: Edge[]) => Edge[])) => void;
  setSelected: (id: string | null) => void;
  copySelected: () => void;
  pasteClipboard: () => void;
};

export const useGraphUI = create<GraphUIState>((set) => ({
  nodes: [],
  edges: [],
  selectedId: null,
  clipboard: null,
  init: (nodes, edges) => set({ nodes, edges }),
  setNodes: (updater) =>
    set((s) => ({
      nodes:
        typeof updater === "function"
          ? (updater as (prev: Node<NodeData>[]) => Node<NodeData>[])(s.nodes)
          : updater,
    })),
  setEdges: (updater) =>
    set((s) => ({
      edges:
        typeof updater === "function" ? (updater as (prev: Edge[]) => Edge[])(s.edges) : updater,
    })),
  setSelected: (id) => set({ selectedId: id }),
  copySelected: () =>
    set((s) => {
      if (!s.selectedId) return {};
      const node = s.nodes.find((n) => n.id === s.selectedId);
      if (!node) return {};
      // shallow copy is fine; data is JSON-like per spec
      return { clipboard: { ...node, data: { ...(node.data as NodeData) } } as Node<NodeData> };
    }),
  pasteClipboard: () =>
    set((s) => {
      if (!s.clipboard) return {};
      const src = s.clipboard as Node<NodeData>;
      const newId = `${src.type}-${Date.now()}`;
      const dup: Node<NodeData> = {
        ...src,
        id: newId,
        position: { x: (src.position?.x ?? 0) + 30, y: (src.position?.y ?? 0) + 30 },
        // ensure data is a fresh object
        data: { ...(src.data as NodeData) },
        selected: true,
      };
      const cleared = s.nodes.map((n) => ({ ...n, selected: false }));
      return { nodes: [...cleared, dup], selectedId: newId };
    }),
}));
