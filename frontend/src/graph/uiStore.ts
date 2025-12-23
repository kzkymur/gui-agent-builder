import type { Edge, Node } from "reactflow";
import create from "zustand";
import type { NodeData } from "../types";

type ClipboardPayload = {
  nodes: Node<NodeData>[];
  edges: Edge[];
} | null;

type GraphUIState = {
  nodes: Node<NodeData>[];
  edges: Edge[];
  selectedId: string | null;
  selectedNodeIds: string[];
  selectedEdgeIds: string[];
  clipboard: ClipboardPayload;
  init: (nodes: Node<NodeData>[], edges: Edge[]) => void;
  setNodes: (updater: Node<NodeData>[] | ((prev: Node<NodeData>[]) => Node<NodeData>[])) => void;
  setEdges: (updater: Edge[] | ((prev: Edge[]) => Edge[])) => void;
  setSelected: (id: string | null) => void;
  setSelection: (nodeIds: string[], edgeIds: string[]) => void;
  copySelected: () => void;
  pasteClipboard: () => void;
};

export const useGraphUI = create<GraphUIState>((set) => ({
  nodes: [],
  edges: [],
  selectedId: null,
  selectedNodeIds: [],
  selectedEdgeIds: [],
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
  setSelected: (id) => set({ selectedId: id, selectedNodeIds: id ? [id] : [], selectedEdgeIds: [] }),
  setSelection: (nodeIds, edgeIds) => set({
    selectedId: nodeIds[0] ?? null,
    selectedNodeIds: nodeIds,
    selectedEdgeIds: edgeIds,
  }),
  copySelected: () =>
    set((s) => {
      const nodeIds = s.selectedNodeIds.length ? s.selectedNodeIds : (s.selectedId ? [s.selectedId] : []);
      if (!nodeIds.length) return {};
      const nodes = s.nodes
        .filter((n) => nodeIds.includes(n.id))
        .map((n) => ({ ...n, data: { ...(n.data as NodeData) } } as Node<NodeData>));
      const idSet = new Set(nodeIds);
      const edges = s.edges.filter((e) => idSet.has(e.source) && idSet.has(e.target)).map((e) => ({ ...e }));
      return { clipboard: { nodes, edges } as ClipboardPayload };
    }),
  pasteClipboard: () =>
    set((s) => {
      if (!s.clipboard) return {};
      const { nodes: srcNodes, edges: srcEdges } = s.clipboard;
      if (!srcNodes?.length) return {};
      const ts = Date.now();
      const idMap = new Map<string, string>();
      srcNodes.forEach((n, i) => idMap.set(n.id, `${n.type}-${ts + i}`));
      const dX = 30;
      const dY = 30;
      const newNodes = srcNodes.map((n) => ({
        ...n,
        id: idMap.get(n.id)!,
        position: { x: (n.position?.x ?? 0) + dX, y: (n.position?.y ?? 0) + dY },
        data: { ...(n.data as NodeData) },
        selected: true,
      }));
      const newEdges = srcEdges.map((e, i) => ({
        ...e,
        id: `edge-${ts + i}`,
        source: idMap.get(e.source)!,
        target: idMap.get(e.target)!,
      }));
      const cleared = s.nodes.map((n) => ({ ...n, selected: false }));
      const nextNodes = [...cleared, ...newNodes];
      const nextEdges = [...s.edges, ...newEdges];
      return {
        nodes: nextNodes,
        edges: nextEdges,
        selectedId: newNodes[0].id,
        selectedNodeIds: newNodes.map((n) => n.id),
        selectedEdgeIds: newEdges.map((e) => e.id),
      };
    }),
}));
