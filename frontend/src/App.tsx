import React, { useEffect, useState } from "react";
import { useEngineStore } from "./engine/store";
import { disconnect as wsDisconnect, connect as wsConnect } from "./engine/ws";
import FooterStatus from "./components/FooterStatus";
import Header from "./components/Header";
import { ignite } from "./engine/runtime";
import { useSettingsStore } from "./engine/settings";
import GraphCanvas from "./graph/GraphCanvas";
import { type NewNodeType, makeDefaultNode } from "./graph/factory";
import { useGraphUI } from "./graph/uiStore";
import { useGraph } from "./graph/useGraph";
import NodeEditor from "./sidebar/NodeEditor";
import type { NodeData } from "./types";
import "./index.css";
import type { Edge, Node } from "reactflow";
import "reactflow/dist/style.css";
// no direct DB access here; children/hooks handle it

// Simple hook for Delete key handling
function useDeleteSelected(
  selectedIds: string[],
  nodes: Node<NodeData>[],
  edges: Edge[],
  setNodes: (n: Node<NodeData>[]) => void,
  setEdges: (e: Edge[]) => void,
) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Delete") return;
      if (!selectedIds.length) return;
      const idSet = new Set(selectedIds);
      const nextNodes = nodes.filter((n) => !idSet.has(n.id));
      const nextEdges = edges.filter((e) => !idSet.has(e.source) && !idSet.has(e.target));
      setNodes(nextNodes);
      setEdges(nextEdges);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedIds, nodes, edges, setNodes, setEdges]);
}

export default function App() {
  const { dbReady, nodes, setNodes, edges, setEdges } = useGraph();
  // Selection moved to graph/uiStore
  const [newNodeType, setNewNodeType] = useState<NewNodeType>("llm");
  const loadSettings = useSettingsStore((s) => s.loadFromDB);
  const sidebarWidth = useSettingsStore((s) => s.sidebarWidth);
  const sidebarVisible = useSettingsStore((s) => s.sidebarVisible);
  const setSidebarWidth = useSettingsStore((s) => s.setSidebarWidth);
  const setSidebarVisible = useSettingsStore((s) => s.setSidebarVisible);
  const footerHeight = useSettingsStore((s) => s.footerHeight);
  const setFooterHeight = useSettingsStore((s) => s.setFooterHeight);

  // Keep App thin; persistence lives in useGraph()

  // Add new node based on selected type
  const addNode = (typeArg?: NewNodeType) => {
    const t = typeArg ?? newNodeType;
    const newNode = makeDefaultNode(t, nodes.length);
    const next = [...nodes, newNode];
    setNodes(next);
    try {
      useGraphUI.getState().setNodes(next);
    } catch {}
  };

  const selectedNodeIds = useGraphUI((s) => s.selectedNodeIds);
  useDeleteSelected(selectedNodeIds, nodes, edges, setNodes, setEdges);

  // Copy/Paste selected node (Cmd/Ctrl+C, Cmd/Ctrl+V)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = (target?.tagName || '').toLowerCase();
      const isEditing =
        tag === 'input' ||
        tag === 'textarea' ||
        (target?.isContentEditable ?? false) ||
        (target as HTMLInputElement)?.type === 'text';
      if (isEditing) return; // don't hijack clipboard in inputs
      const isMod = e.metaKey || e.ctrlKey;
      if (!isMod) return;
      if (e.key.toLowerCase() === "c") {
        useGraphUI.getState().copySelected();
        e.preventDefault();
        e.stopPropagation();
      } else if (e.key.toLowerCase() === "v") {
        useGraphUI.getState().pasteClipboard();
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Load settings from DB when ready
  useEffect(() => {
    if (!dbReady) return;
    loadSettings();
  }, [dbReady, loadSettings]);

  // FooterStatus reads runtime data from engine store directly

  // Maintain compatibility with Entry node's local Ignite button
  useEffect(() => {
    const onIgnite = (e: Event) => {
      const detail = (e as CustomEvent).detail as { entryId?: string | null } | undefined;
      ignite(nodes, edges, detail?.entryId ?? undefined);
    };
    window.addEventListener("engine:ignite", onIgnite as EventListener);
    return () => window.removeEventListener("engine:ignite", onIgnite as EventListener);
  }, [nodes, edges]);

  // Bookmarks are handled entirely inside the useBookmarks hook and Header.

  // Removed event bridge: Header now passes the selected type directly.

  // Initialize UI store after DB load
  useEffect(() => {
    if (!dbReady) return;
    try {
      useGraphUI.getState().init(nodes, edges);
    } catch {}
  }, [dbReady, nodes, edges]);

  // Manage websocket lifecycle for FS tools while any nodes are running and FS tools are in use
  const runStatus = useEngineStore((s) => s.run.status);
  // Connect WS at run start when any LLM has FS tools; disconnect a bit after run ends
  useEffect(() => {
    const baseUrl = (import.meta as any).env?.VITE_BACKEND_URL || "http://localhost:8000";
    const fsInUse = nodes.some((n) => n.type === "llm" && Array.isArray((n.data as any)?.fsNodes) && (n.data as any).fsNodes.length > 0);
    if (runStatus === "running" && fsInUse) {
      try { wsConnect(baseUrl); } catch {}
      return () => {};
    }
    if (runStatus !== "running") {
      const t = window.setTimeout(() => wsDisconnect(), 3000);
      return () => window.clearTimeout(t);
    }
  }, [runStatus, nodes]);

  // Ensure disconnect shortly after no nodes are running (extra safety)
  const activeCount = useEngineStore((s) => s.activeRunning.size);
  useEffect(() => {
    if (activeCount === 0 && runStatus !== "running") {
      const t = window.setTimeout(() => wsDisconnect(), 1500);
      return () => window.clearTimeout(t);
    }
  }, [activeCount, runStatus]);

  // Keep App in sync when graph UI store changes (user drags nodes, edits in sidebar)
  useEffect(() => {
    const unsub = useGraphUI.subscribe((state, prev) => {
      if (state.nodes !== prev.nodes) setNodes(state.nodes);
      if (state.edges !== prev.edges) setEdges(state.edges);
    });
    return () => {
      unsub();
    };
  }, [setNodes, setEdges]);

  // header manages provider list for API keys dropdown

  return (
    <div className="app">
      <Header onAddNode={addNode} />
      <main
        className="app__main"
        style={{
          gridTemplateColumns: `1fr 6px ${sidebarVisible ? `${sidebarWidth}px` : "0px"}`,
        }}
      >
        <div className="main-left" style={{ gridTemplateRows: `1fr 6px ${footerHeight}px` }}>
          <div className="graph">
            <GraphCanvas />
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
          <FooterStatus nodes={nodes} />
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
            type="button"
            title={sidebarVisible ? "Hide sidebar" : "Show sidebar"}
            aria-label={sidebarVisible ? "Hide sidebar" : "Show sidebar"}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              setSidebarVisible(!sidebarVisible);
            }}
          >
            {sidebarVisible ? (
              <img src="/icons/chevron-left.svg" width={12} height={12} aria-hidden />
            ) : (
              <img src="/icons/chevron-right.svg" width={12} height={12} aria-hidden />
            )}
          </button>
        </div>
        <aside
          className="sidebar"
          aria-label="Sidebar"
          style={{
            width: sidebarVisible ? `${sidebarWidth}px` : 0,
            display: sidebarVisible ? "flex" : "none",
          }}
        >
          <NodeEditor />
        </aside>
      </main>
    </div>
  );
}

// NodeEditor moved to ./sidebar/NodeEditor
