import React, { useCallback, useMemo } from "react";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  SelectionMode,
  addEdge,
  applyNodeChanges,
} from "reactflow";
import type {
  Connection,
  Edge,
  Node,
  NodeTypes,
  OnConnect,
  OnEdgesChange,
  OnNodesChange,
} from "reactflow";
import EndNode from "../nodes/EndNode";
import EntryNode from "../nodes/EntryNode";
import LLMNode from "../nodes/LLMNode";
import MCPNode from "../nodes/MCPNode";
import RouterNode from "../nodes/RouterNode";
import type { NodeData } from "../types";

type Props = {
  nodes: Node<NodeData>[];
  edges: Edge[];
  onNodesChange: (nodes: Node<NodeData>[]) => void;
  onEdgesChange: (edges: Edge[]) => void;
  onSelectNode: (node: Node<NodeData> | null) => void;
};

export default function GraphCanvas({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onSelectNode,
}: Props) {
  // Parent is the single source of truth; no local mirrors.

  const nodeTypes = useMemo<NodeTypes>(
    () => ({
      entry: EntryNode,
      llm: LLMNode,
      router: RouterNode,
      mcp: MCPNode,
      end: EndNode,
    }),
    []
  );

  const onChangeNodes: OnNodesChange = useCallback(
    (changes) => {
      const next = applyNodeChanges(
        changes,
        nodes as any
      ) as unknown as Node<NodeData>[];
      onNodesChange(next);
    },
    [nodes, onNodesChange]
  );

  const onChangeEdges: OnEdgesChange = useCallback(
    (changes) => {
      const next = changes.reduce<Edge[]>((acc, change) => {
        if (change.type === "remove")
          return acc.filter((e) => e.id !== change.id);
        // Other edge change types are rare here; keep acc by default
        return acc;
      }, edges);
      onEdgesChange(next);
    },
    [edges, onEdgesChange]
  );

  const onConnect: OnConnect = useCallback(
    (connection: Connection) => {
      // Spec: MCP has no inputs/outputs; End has no outputs
      const src = nodes.find((n) => n.id === connection.source);
      const tgt = nodes.find((n) => n.id === connection.target);
      if (!src || !tgt) return;
      // Entry: no inputs; End: no outputs; MCP: no inputs/outputs
      if (src.type === "end" || src.type === "mcp") return;
      if (tgt.type === "mcp" || tgt.type === "entry") return;
      const next = addEdge(connection, edges);
      onEdgesChange(next as unknown as Edge[]);
    },
    [nodes, edges, onEdgesChange]
  );

  const onSelection = useCallback(
    (elements: { nodes: Node<NodeData>[] }) => {
      onSelectNode(elements.nodes[0] ?? null);
    },
    [onSelectNode]
  );

  return (
    <div style={{ width: "100%", height: "100%" }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onChangeNodes}
        onEdgesChange={onChangeEdges}
        onConnect={onConnect}
        onSelectionChange={onSelection}
        fitView
        selectionMode={SelectionMode.Partial}
      >
        <MiniMap pannable zoomable style={{ width: 120, height: 80 }} />
        <Controls showInteractive={false} />
        <Background />
      </ReactFlow>
    </div>
  );
}
