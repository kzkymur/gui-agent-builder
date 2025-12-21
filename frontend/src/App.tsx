import React, { useEffect, useMemo, useState } from "react";
import "reactflow/dist/style.css";
import "./index.css";
import GraphCanvas from "./graph/GraphCanvas";
import { logGraphSnapshot } from "./engine/graph";
import type { Edge, Node } from "reactflow";
import type { LLMData, MCPData, NodeData } from "./types";
import { useGraph } from "./graph/useGraph";
import NodeEditor from "./sidebar/NodeEditor";
import { backendClient } from "./engine/backendClient";
import { ignite } from "./engine/runner";

export default function App() {
  const { dbReady, nodes, setNodes, edges, setEdges } = useGraph();
  const [selected, setSelected] = useState<Node<NodeData> | null>(null);
  const [footerValue, setFooterValue] = useState<string>("");
  const [newNodeType, setNewNodeType] = useState<
    "entry" | "llm" | "router" | "mcp" | "end"
  >("llm");

  // App.tsx stays thin; persistence lives in useGraph()

  // Factory for default node data by type
  const makeDefaultNode = (
    type: "entry" | "llm" | "router" | "mcp" | "end",
    idx: number
  ): Node<NodeData> => {
    const id = `${type}-${Date.now()}`;
    const base = {
      id,
      type,
      position: { x: 120 + idx * 30, y: 120 + idx * 20 },
    } as const;
    switch (type) {
      case "entry":
        return {
          ...base,
          data: { name: "Entry", inputs: [{ key: "user_input", value: "" }] },
        } as Node<any>;
      case "llm":
        return {
          ...base,
          data: { name: "LLM" },
        } as Node<any>;
      case "router":
        return {
          ...base,
          data: { name: "Router", branches: ["a", "b"] },
        } as Node<any>;
      case "mcp":
        return {
          ...base,
          data: { name: "MCP", url: "http://localhost:9000" },
        } as Node<any>;
      case "end":
      default:
        return { ...base, data: { name: "End" } } as Node<any>;
    }
  };

  // Add new node based on selected type
  const addNode = () => {
    const newNode = makeDefaultNode(newNodeType, nodes.length);
    const next = [...nodes, newNode];
    setNodes(next);
  };

  // Delete selected node with Delete key; remove attached edges
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Delete") return;
      if (!selected) return;
      const nextNodes = nodes.filter((n) => n.id !== selected.id);
      const nextEdges = edges.filter(
        (e) => e.source !== selected.id && e.target !== selected.id
      );
      setNodes(nextNodes);
      setEdges(nextEdges);
      setSelected(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected, nodes, edges]);

  // Footer reflects End node's value, if an End node is selected
  useEffect(() => {
    const live = selected ? nodes.find((n) => n.id === selected.id) : null;
    if (live?.type === "end") {
      const v = (live.data as any).value ?? "";
      setFooterValue(String(v));
    } else {
      setFooterValue("");
    }
  }, [selected, nodes]);

  // Listen for Entry node 'ignite' events and kick off the engine
  useEffect(() => {
    const onIgnite = (e: Event) => {
      const detail = (e as CustomEvent).detail as
        | { entryId?: string | null }
        | undefined;
      ignite(nodes, edges, detail?.entryId ?? null);
    };
    window.addEventListener("engine:ignite", onIgnite as EventListener);
    return () =>
      window.removeEventListener("engine:ignite", onIgnite as EventListener);
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
          <label
            style={{ fontSize: 12, color: "var(--muted)" }}
            htmlFor="newNodeType"
          >
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
          <button onClick={() => logGraphSnapshot(nodes, edges)}>
            Log Graph
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
        <aside className="sidebar" aria-label="Sidebar">
          {(() => {
            const liveSelected = selected
              ? nodes.find((n) => n.id === selected.id) ?? null
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
      <footer className="app__footer" aria-live="polite">
        {footerValue
          ? `End value: ${footerValue}`
          : "Select an End node to preview its value"}
      </footer>
    </div>
  );
}

// NodeEditor moved to ./sidebar/NodeEditor
