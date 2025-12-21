import React, { useEffect, useMemo, useState } from "react";
import Header from "./components/Header";
import { useEngineStore } from "./engine/store";
import "reactflow/dist/style.css";
import "./index.css";
import type { Edge, Node } from "reactflow";
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
  const apiKeys = useSettingsStore((s) => s.apiKeys);
  const setApiKeyFor = useSettingsStore((s) => s.setApiKeyFor);
  const loadSettings = useSettingsStore((s) => s.loadFromDB);
  const sidebarWidth = useSettingsStore((s) => s.sidebarWidth);
  const sidebarVisible = useSettingsStore((s) => s.sidebarVisible);
  const setSidebarWidth = useSettingsStore((s) => s.setSidebarWidth);
  const setSidebarVisible = useSettingsStore((s) => s.setSidebarVisible);
  const footerHeight = useSettingsStore((s) => s.footerHeight);
  const setFooterHeight = useSettingsStore((s) => s.setFooterHeight);

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

  const run = useEngineStore((s) => s.run);
  const tokenUsageTotal = useEngineStore((s) => s.tokenUsageTotal);
  const [now, setNow] = useState<number>(() => Date.now());
  useEffect(() => {
    if (run.status !== "running" || !run.startedAt) return;
    const t = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(t);
  }, [run.status, run.startedAt]);
  const durationMs = run.startedAt
    ? Math.max(0, (run.endedAt ?? now) - run.startedAt)
    : undefined;
  const durationLabel = durationMs != null ? `${(durationMs / 1000).toFixed(2)}s` : "—";

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

  // header manages provider list for API keys dropdown

  return (
    <div className="app">
      <Header
        isBusy={isBusy}
        newNodeType={newNodeType}
        onChangeNewNodeType={(v) => setNewNodeType(v as any)}
        onAddNode={addNode}
      />
      <main className="app__main" style={{ gridTemplateColumns: `1fr 6px ${sidebarVisible ? `${sidebarWidth}px` : '0px'}` }}>
        <div className="main-left" style={{ gridTemplateRows: `1fr 6px ${footerHeight}px` }}>
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
          <div
            className="h-resizer"
            title="Drag to resize footer; double‑click to reset"
            onDoubleClick={() => setFooterHeight(200)}
            onMouseDown={(e) => {
              const startY = e.clientY;
              const startH = footerHeight;
              const onMove = (ev: MouseEvent) => {
                const dy = ev.clientY - startY;
                // Invert so the divider follows the cursor: up = larger footer, down = smaller
                setFooterHeight(startH - dy);
              };
              const onUp = () => {
                window.removeEventListener("mousemove", onMove);
                window.removeEventListener("mouseup", onUp);
              };
              window.addEventListener("mousemove", onMove);
              window.addEventListener("mouseup", onUp);
            }}
          />
          <footer className="app__footer" aria-live="polite">
            <div style={{ display: "flex", gap: 24, alignItems: "flex-start", overflowX: "auto" }}>
              <div style={{ whiteSpace: "nowrap", color: "var(--muted)" }}>
                Tokens: <strong>{tokenUsageTotal || 0}</strong> · Time: <strong>{durationLabel}</strong>
              </div>
              {endSummaries.length ? (
                <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
                  {endSummaries.map((md, i) => (
                    <div key={i} style={{ minWidth: 0 }}>
                      <MarkdownView text={md} />
                    </div>
                  ))}
                </div>
              ) : (
                <div>Run the flow; End node outputs will appear here</div>
              )}
            </div>
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
