import create from "zustand";
import type { Edge, Node } from "reactflow";
import type { NodeData } from "../types";

type GraphUIState = {
  nodes: Node<NodeData>[];
  edges: Edge[];
  selectedId: string | null;
  init: (nodes: Node<NodeData>[], edges: Edge[]) => void;
  setNodes: (updater: Node<NodeData>[] | ((prev: Node<NodeData>[]) => Node<NodeData>[])) => void;
  setEdges: (updater: Edge[] | ((prev: Edge[]) => Edge[])) => void;
  setSelected: (id: string | null) => void;
};

export const useGraphUI = create<GraphUIState>((set) => ({
  nodes: [],
  edges: [],
  selectedId: null,
  init: (nodes, edges) => set({ nodes, edges }),
  setNodes: (updater) =>
    set((s) => ({ nodes: typeof updater === "function" ? (updater as any)(s.nodes) : updater })),
  setEdges: (updater) =>
    set((s) => ({ edges: typeof updater === "function" ? (updater as any)(s.edges) : updater })),
  setSelected: (id) => set({ selectedId: id }),
}));

