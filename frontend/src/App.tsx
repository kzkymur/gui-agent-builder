import React, { useEffect, useMemo, useState } from "react";
import { Button } from "@radix-ui/themes";
import { useEngineStore } from "./engine/store";
import "reactflow/dist/style.css";
import "./index.css";
import type { Edge, Node } from "reactflow";
import { backendClient } from "./engine/backendClient";
import { useSettingsStore } from "./engine/settings";
import { logGraphSnapshot } from "./engine/graph";
import { ignite } from "./engine/runner";
import GraphCanvas from "./graph/GraphCanvas";
import { useGraph } from "./graph/useGraph";
import NodeEditor from "./sidebar/NodeEditor";
import type { LLMData, MCPData, NodeData } from "./types";
import MarkdownView from "./components/MarkdownView";
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
  const isBusy = useEngineStore((s) => s.activeRunning.size > 0);
  const [selected, setSelected] = useState<Node<NodeData> | null>(null);
  const [newNodeType, setNewNodeType] = useState<NewNodeType>("llm");
  const apiKey = useSettingsStore((s) => s.apiKey);
  const setApiKey = useSettingsStore((s) => s.setApiKey);
  const loadSettings = useSettingsStore((s) => s.loadFromDB);
  const sidebarWidth = useSettingsStore((s) => s.sidebarWidth);
  const sidebarVisible = useSettingsStore((s) => s.sidebarVisible);
  const setSidebarWidth = useSettingsStore((s) => s.setSidebarWidth);
  const setSidebarVisible = useSettingsStore((s) => s.setSidebarVisible);

  // Keep App thin; persistence lives in useGraph()

  // Add new node based on selected type
  const addNode = () => {
    const newNode = makeDefaultNode(newNodeType, nodes.length);
    const next = [...nodes, newNode];
    setNodes(next);
  };

  useDeleteSelected(selected, nodes, edges, setNodes, setEdges);

  // Load settings from DB when ready
  useEffect(() => {
    if (!dbReady) return;
    loadSettings();
  }, [dbReady, loadSettings]);

  const latestOutputByNode = useEngineStore((s) => s.latestOutputByNode);
  const endSummaries = useMemo(() => {
    const ends = nodes.filter((n) => n.type === "end");
    const parts: string[] = [];
    for (const n of ends) {
      let val: any = latestOutputByNode[n.id];
      // Unwrap common End-node shape { value: ... } for footer brevity
      if (val && typeof val === "object" && !Array.isArray(val) && "value" in val) {
        val = (val as any).value;
      }
      if (typeof val === "undefined") continue;
      let pretty: string;
      if (typeof val === "string") pretty = val;
      else {
        try { pretty = JSON.stringify(val, null, 2); } catch { pretty = String(val); }
      }
      const name = (n.data as any)?.name || "End";
      parts.push(`${name}:\n\n${pretty}`);
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
          <label style={{ fontSize: 12, color: "var(--muted)" }} htmlFor="apiKey">
            API Key:
          </label>
          <input
            id="apiKey"
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="Enter provider API key"
            style={{
              background: "#0f0f12",
              border: "1px solid #2a2a2e",
              color: "var(--fg)",
              borderRadius: 6,
              padding: "4px 8px",
              width: 260,
            }}
          />
          <label style={{ fontSize: 12, color: "var(--muted)" }} htmlFor="newNodeType">
            New:
          </label>
          <select
            id="newNodeType"
            value={newNodeType}
            onChange={(e) => setNewNodeType(e.target.value as any)}
            disabled={isBusy}
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
          <Button onClick={addNode} disabled={isBusy}>Add Node</Button>
          <Button variant="soft" onClick={() => logGraphSnapshot(nodes, edges)} disabled={isBusy}>Log Graph</Button>
          <Button
            onClick={runFlow}
            disabled={isBusy}
          >
            Run
          </Button>
          <Button
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
            disabled={isBusy}
          >
            Log DB
          </Button>
          <Button
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
            disabled={isBusy}
          >
            Ping Backend
          </Button>
        </div>
      </header>
      <main className="app__main" style={{ gridTemplateColumns: `1fr 6px ${sidebarVisible ? `${sidebarWidth}px` : '0px'}` }}>
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
            {endSummaries.length ? (
              <div style={{ display: "flex", gap: 16, alignItems: "flex-start", overflowX: "auto" }}>
                {endSummaries.map((md, i) => (
                  <div key={i} style={{ minWidth: 0 }}>
                    <MarkdownView text={md} />
                  </div>
                ))}
              </div>
            ) : (
              "Run the flow; End node outputs will appear here"
            )}
          </footer>
        </div>
        <div
          className="v-resizer"
          onDoubleClick={() => setSidebarVisible(!sidebarVisible)}
          onMouseDown={(e) => {
            if (!sidebarVisible) return;
            const startX = e.clientX;
            const startW = sidebarWidth;
            const onMove = (ev: MouseEvent) => {
              const dx = startX - ev.clientX; // dragging left grows sidebar
              setSidebarWidth(startW + dx);
            };
            const onUp = () => {
              window.removeEventListener("mousemove", onMove);
              window.removeEventListener("mouseup", onUp);
            };
            window.addEventListener("mousemove", onMove);
            window.addEventListener("mouseup", onUp);
          }}
        >
          <button
            className="v-resizer__toggle"
            title={sidebarVisible ? "Hide sidebar" : "Show sidebar"}
            aria-label={sidebarVisible ? "Hide sidebar" : "Show sidebar"}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              setSidebarVisible(!sidebarVisible);
            }}
          >
            {sidebarVisible ? (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <polyline points="15 18 9 12 15 6" />
              </svg>
            ) : (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <polyline points="9 18 15 12 9 6" />
              </svg>
            )}
          </button>
        </div>
        <aside className="sidebar" aria-label="Sidebar" style={{ width: sidebarVisible ? `${sidebarWidth}px` : 0, display: sidebarVisible ? 'flex' : 'none' }}>
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
