import React, { useCallback, useEffect, useMemo } from "react";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  SelectionMode,
  addEdge,
  useEdgesState,
  useNodesState,
  applyEdgeChanges,
  applyNodeChanges,
} from "reactflow";
import type {
  Node,
  Edge,
  NodeTypes,
  OnEdgesChange,
  OnNodesChange,
  Connection,
  OnConnect,
} from "reactflow";
import EntryNode from "../nodes/EntryNode";
import LLMNode from "../nodes/LLMNode";
import RouterNode from "../nodes/RouterNode";
import MCPNode from "../nodes/MCPNode";
import EndNode from "../nodes/EndNode";
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
  const [localNodes, setLocalNodes, handleNodesChange] = useNodesState(nodes);
  const [localEdges, setLocalEdges, handleEdgesChange] = useEdgesState(edges);

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

  // Keep local state in sync when parent props change (e.g., after DB load)
  useEffect(() => {
    setLocalNodes(nodes);
  }, [nodes, setLocalNodes]);

  useEffect(() => {
    setLocalEdges(edges);
  }, [edges, setLocalEdges]);

  const onChangeNodes: OnNodesChange = useCallback(
    (changes) => {
      setLocalNodes((ns) => {
        const next = applyNodeChanges(changes, ns);
        onNodesChange(next as unknown as Node<NodeData>[]);
        return next;
      });
    },
    [setLocalNodes, onNodesChange]
  );

  const onChangeEdges: OnEdgesChange = useCallback(
    (changes) => {
      setLocalEdges((es) => {
        const next = applyEdgeChanges(changes, es);
        onEdgesChange(next as unknown as Edge[]);
        return next;
      });
    },
    [setLocalEdges, onEdgesChange]
  );

  const onConnect: OnConnect = useCallback(
    (connection: Connection) => {
      // Spec: MCP has no inputs/outputs; End has no outputs
      const src = localNodes.find((n) => n.id === connection.source);
      const tgt = localNodes.find((n) => n.id === connection.target);
      if (!src || !tgt) return;
      // Entry: no inputs; End: no outputs; MCP: no inputs/outputs
      if (src.type === "end" || src.type === "mcp") return;
      if (tgt.type === "mcp" || tgt.type === "entry") return;
      setLocalEdges((eds) => {
        const next = addEdge(connection, eds);
        onEdgesChange(next as unknown as Edge[]);
        return next;
      });
    },
    [setLocalEdges, onEdgesChange, localNodes]
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
        nodes={localNodes}
        edges={localEdges}
        nodeTypes={nodeTypes}
        onNodesChange={onChangeNodes}
        onEdgesChange={onChangeEdges}
        onConnect={onConnect}
        onSelectionChange={onSelection}
        fitView
        selectionMode={SelectionMode.Partial}
      >
        <MiniMap pannable zoomable />
        <Controls showInteractive={false} />
        <Background />
      </ReactFlow>
    </div>
  );
}
