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
import FSNode from "../nodes/FSNode";
import SwitchNode from "../nodes/SwitchNode";
import type { NodeData } from "../types";
import { useGraphUI } from "./uiStore";

export default function GraphCanvas() {
  const nodes = useGraphUI((s) => s.nodes);
  const edges = useGraphUI((s) => s.edges);
  const setNodes = useGraphUI((s) => s.setNodes);
  const setEdges = useGraphUI((s) => s.setEdges);
  const setSelected = useGraphUI((s) => s.setSelected);
  const setSelection = useGraphUI((s) => s.setSelection);
  const toggleHistory = useGraphUI((s) => s.toggleHistory);
  // Parent is the single source of truth; no local mirrors.

  const nodeTypes = useMemo<NodeTypes>(
    () => ({
      entry: EntryNode,
      llm: LLMNode,
      switch: SwitchNode,
      mcp: MCPNode,
      fs: FSNode,
      end: EndNode,
    }),
    [],
  );

  const onChangeNodes: OnNodesChange = useCallback(
    (changes) => {
      const next = applyNodeChanges(changes, nodes as Node<NodeData>[]);
      setNodes(next);
    },
    [nodes, setNodes],
  );

  const onChangeEdges: OnEdgesChange = useCallback(
    (changes) => {
      const next = changes.reduce<Edge[]>((acc, change) => {
        if (change.type === "remove") return acc.filter((e) => e.id !== change.id);
        return acc;
      }, edges as Edge[]);
      setEdges(next);
    },
    [edges, setEdges],
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
      const next = addEdge(connection, edges as Edge[]);
      setEdges(next as Edge[]);
    },
    [nodes, edges, setEdges],
  );

  const onSelection = useCallback(
    (elements: { nodes: Node<NodeData>[]; edges: Edge[] }) => {
      const nodeIds = elements.nodes.map((n) => n.id);
      const edgeIds = elements.edges?.map((e) => e.id) ?? [];
      setSelection(nodeIds, edgeIds);
    },
    [setSelection],
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
        onNodeClick={(_, node) => setSelected((node as Node<NodeData>).id)}
        onNodeDoubleClick={(_, node) => {
          setSelected((node as Node<NodeData>).id);
          toggleHistory();
        }}
        onPaneClick={() => setSelected(null)}
        panOnScroll
        panOnDrag={false}
        selectionOnDrag
        zoomOnScroll={false}
        zoomOnPinch
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
