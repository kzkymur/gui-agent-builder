import React, { useEffect, useMemo, useState } from "react";
import "reactflow/dist/style.css";
import "./index.css";
import type { Edge, Node } from "reactflow";
import { backendClient } from "./engine/backendClient";
import { logGraphSnapshot } from "./engine/graph";
import { ignite } from "./engine/runner";
import { useEngineStore } from "./engine/store";
import GraphCanvas from "./graph/GraphCanvas";
import { useGraph } from "./graph/useGraph";
import NodeEditor from "./sidebar/NodeEditor";
import type { LLMData, MCPData, NodeData } from "./types";
import { makeDefaultNode, type NewNodeType } from "./graph/factory";
import { loadGraph } from "./db/sqlite";

// Simple hook for Delete key handling
function useDeleteSelected(
  selected: Node<NodeData> | null,
  nodes: Node<NodeData>[],
  edges: Edge[],
  setNodes: (n: Node<NodeData>[]) => void,
  setEdges: (e: Edge[]) => void,
) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Delete") return;
      if (!selected) return;
      const nextNodes = nodes.filter((n) => n.id !== selected.id);
      const nextEdges = edges.filter((e) => e.source !== selected.id && e.target !== selected.id);
      setNodes(nextNodes);
      setEdges(nextEdges);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected, nodes, edges, setNodes, setEdges]);
}

export default function App() {
  const { dbReady, nodes, setNodes, edges, setEdges } = useGraph();
  const [selected, setSelected] = useState<Node<NodeData> | null>(null);
  const [newNodeType, setNewNodeType] = useState<NewNodeType>("llm");

  // Keep App thin; persistence lives in useGraph()

  // Add new node based on selected type
  const addNode = () => {
    const newNode = makeDefaultNode(newNodeType, nodes.length);
    const next = [...nodes, newNode];
    setNodes(next);
  };

  useDeleteSelected(selected, nodes, edges, setNodes, setEdges);

  const latestOutputByNode = useEngineStore((s) => s.latestOutputByNode);
  const endSummaries = useMemo(() => {
    const ends = nodes.filter((n) => n.type === "end");
    const parts: string[] = [];
    for (const n of ends) {
      const val = latestOutputByNode[n.id];
      if (typeof val === "undefined") continue;
      const pretty =
        typeof val === "string"
          ? val
          : (() => {
              try {
                return JSON.stringify(val);
              } catch {
                return String(val);
              }
            })();
      const name = (n.data as any)?.name || "End";
      parts.push(`${name}: ${pretty}`);
    }
    return parts;
  }, [nodes, latestOutputByNode]);

  // Direct ignite: simple and explicit, no globals
  const runFlow = () => ignite(nodes, edges);

  // Maintain compatibility with Entry node's local Ignite button
  useEffect(() => {
    const onIgnite = (e: Event) => {
      const detail = (e as CustomEvent).detail as { entryId?: string | null } | undefined;
      ignite(nodes, edges, detail?.entryId ?? undefined);
    };
    window.addEventListener("engine:ignite", onIgnite as EventListener);
    return () => window.removeEventListener("engine:ignite", onIgnite as EventListener);
  }, [nodes, edges]);

  return (
    <div className="app">
      <header className="app__header">
        LLM Flow
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            marginLeft: 12,
          }}
        >
          <label style={{ fontSize: 12, color: "var(--muted)" }} htmlFor="newNodeType">
            New:
          </label>
          <select
            id="newNodeType"
            value={newNodeType}
            onChange={(e) => setNewNodeType(e.target.value as any)}
            style={{
              background: "#0f0f12",
              border: "1px solid #2a2a2e",
              color: "var(--fg)",
              borderRadius: 6,
              padding: "4px 6px",
            }}
          >
            <option value="entry">Entry</option>
            <option value="llm">LLM</option>
            <option value="router">Router</option>
            <option value="mcp">MCP</option>
            <option value="end">End</option>
          </select>
          <button onClick={addNode}>Add Node</button>
          <button onClick={() => logGraphSnapshot(nodes, edges)}>Log Graph</button>
          <button
            onClick={runFlow}
          >
            Run
          </button>
          <button
            onClick={() => {
              try {
                const { nodes: nn, edges: ee } = loadGraph();
                // eslint-disable-next-line no-console
                console.log("[LLM-Flow] DB rows", { nodes: nn, edges: ee });
              } catch (e) {
                // eslint-disable-next-line no-console
                console.error("[LLM-Flow] Failed to read DB", e);
              }
            }}
          >
            Log DB
          </button>
          <button
            onClick={async () => {
              try {
                // Typed call to backend's health endpoint
                const res = await backendClient.GET("/health");
                // eslint-disable-next-line no-console
                console.log("[LLM-Flow] /health", res.data ?? res.error);
              } catch (err) {
                // eslint-disable-next-line no-console
                console.error("[LLM-Flow] backend call failed", err);
              }
            }}
          >
            Ping Backend
          </button>
        </div>
      </header>
      <main className="app__main">
        <div className="main-left">
          <div className="graph">
            <GraphCanvas
              nodes={nodes}
              edges={edges}
              onNodesChange={(n) => {
                setNodes(n);
              }}
              onEdgesChange={(e) => {
                setEdges(e);
              }}
              onSelectNode={setSelected}
            />
          </div>
          <footer className="app__footer" aria-live="polite">
            {endSummaries.length
              ? endSummaries.join("  |  ")
              : "Run the flow; End node outputs will appear here"}
          </footer>
        </div>
        <aside className="sidebar" aria-label="Sidebar">
          {(() => {
            const liveSelected = selected
              ? (nodes.find((n) => n.id === selected.id) ?? null)
              : null;
            const mcpOptions = nodes
              .filter((n) => n.type === "mcp")
              .map((n) => ({ id: n.id, name: (n.data as any)?.name || n.id }));
            return (
              <NodeEditor
                node={liveSelected}
                mcpOptions={mcpOptions}
                onChange={(updater) => {
                  setNodes(updater);
                }}
              />
            );
          })()}
        </aside>
      </main>
    </div>
  );
}

// NodeEditor moved to ./sidebar/NodeEditor
