import type { Edge, Node } from "reactflow";
import create from "zustand";
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
}));
