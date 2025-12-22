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
import FooterStatus from "./components/FooterStatus";
import { makeDefaultNode, type NewNodeType } from "./graph/factory";
import { useGraphUI } from "./graph/uiStore";
import {
  loadGraph,
  loadSettings as dbLoadSettings,
  saveSetting,
} from "./db/sqlite";

// Simple hook for Delete key handling
function useDeleteSelected(
  selected: Node<NodeData> | null,
  nodes: Node<NodeData>[],
  edges: Edge[],
  setNodes: (n: Node<NodeData>[]) => void,
  setEdges: (e: Edge[]) => void
) {
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
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected, nodes, edges, setNodes, setEdges]);
}

export default function App() {
  const { dbReady, nodes, setNodes, edges, setEdges } = useGraph();
  // Selection moved to graph/uiStore
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
    try { useGraphUI.getState().setNodes(next as any); } catch {}
  };

  const selectedId = useGraphUI((s) => s.selectedId);
  const selected = selectedId ? nodes.find((n) => n.id === selectedId) ?? null : null;
  useDeleteSelected(selected, nodes, edges, setNodes, setEdges);

  // Load settings from DB when ready
  useEffect(() => {
    if (!dbReady) return;
    loadSettings();
  }, [dbReady, loadSettings]);

  // FooterStatus reads runtime data from engine store directly

  // Direct ignite: simple and explicit, no globals
  const runFlow = () => ignite(nodes, edges);

  // Maintain compatibility with Entry node's local Ignite button
  useEffect(() => {
    const onIgnite = (e: Event) => {
      const detail = (e as CustomEvent).detail as
        | { entryId?: string | null }
        | undefined;
      ignite(nodes, edges, detail?.entryId ?? undefined);
    };
    window.addEventListener("engine:ignite", onIgnite as EventListener);
    return () =>
      window.removeEventListener("engine:ignite", onIgnite as EventListener);
  }, [nodes, edges]);

  const saveBookmark = (name: string) => {
    try {
      const all = dbLoadSettings();
      const raw = all["bookmarks"] ?? "[]";
      let arr: any[] = [];
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) arr = parsed;
      } catch {}
      const snapNodes = nodes.map((n) => ({
        id: n.id,
        type: n.type,
        x: n.position.x,
        y: n.position.y,
        data: n.data,
      }));
      const snapEdges = edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        sourceHandle: (e as any).sourceHandle ?? null,
        targetHandle: (e as any).targetHandle ?? null,
      }));
      const idx = arr.findIndex((b) => b && b.name === name);
      const entry = {
        name,
        nodes: snapNodes,
        edges: snapEdges,
        savedAt: Date.now(),
      };
      if (idx >= 0) arr[idx] = entry;
      else arr.push(entry);
      saveSetting("bookmarks", JSON.stringify(arr));
    } catch {}
  };

  const loadBookmark = (name: string) => {
    try {
      const all = dbLoadSettings();
      const parsed = JSON.parse(all["bookmarks"] ?? "[]");
      if (!Array.isArray(parsed)) return;
      const found = parsed.find((b: any) => b && b.name === name);
      if (!found) return;
      const n = (found.nodes || []).map((x: any) => ({
        id: String(x.id),
        type: String(x.type),
        position: { x: Number(x.x) || 0, y: Number(x.y) || 0 },
        data: x.data || {},
      }));
      const e = (found.edges || []).map((x: any) => ({
        id: String(x.id),
        source: String(x.source),
        target: String(x.target),
        sourceHandle: x.sourceHandle ?? null,
        targetHandle: x.targetHandle ?? null,
      }));
      setNodes(n);
      setEdges(e);
      try {
        const ui = useGraphUI.getState();
        ui.setNodes(n as any);
        ui.setEdges(e as any);
      } catch {}
    } catch {}
  };

  // Bridge events so child components don’t need props for global actions
  useEffect(() => {
    const onSave = (e: Event) => {
      const name = (e as CustomEvent).detail?.name as string | undefined;
      if (name) saveBookmark(name);
    };
    const onLoad = (e: Event) => {
      const name = (e as CustomEvent).detail?.name as string | undefined;
      if (name) loadBookmark(name);
    };
    const onSetType = (e: Event) => {
      const t = (e as CustomEvent).detail?.type as string | undefined;
      if (t) setNewNodeType(t as NewNodeType);
    };
    window.addEventListener("graph:saveBookmark", onSave as EventListener);
    window.addEventListener("graph:loadBookmark", onLoad as EventListener);
    window.addEventListener("graph:setNewNodeType", onSetType as EventListener);
    return () => {
      window.removeEventListener("graph:saveBookmark", onSave as EventListener);
      window.removeEventListener("graph:loadBookmark", onLoad as EventListener);
      window.removeEventListener("graph:setNewNodeType", onSetType as EventListener);
    };
  }, []);

  // Initialize UI store after DB load
  useEffect(() => {
    if (!dbReady) return;
    try {
      useGraphUI.getState().init(nodes as any, edges as any);
    } catch {}
  }, [dbReady]);

  // Keep App in sync when graph UI store changes (user drags nodes, edits in sidebar)
  useEffect(() => {
    const unsubN = useGraphUI.subscribe((s) => s.nodes, (next) => setNodes(next as any));
    const unsubE = useGraphUI.subscribe((s) => s.edges, (next) => setEdges(next as any));
    return () => {
      unsubN();
      unsubE();
    };
  }, [setNodes, setEdges]);

  // header manages provider list for API keys dropdown

  return (
    <div className="app">
      <Header onAddNode={addNode} />
      <main
        className="app__main"
        style={{
          gridTemplateColumns: `1fr 6px ${
            sidebarVisible ? `${sidebarWidth}px` : "0px"
          }`,
        }}
      >
        <div
          className="main-left"
          style={{ gridTemplateRows: `1fr 6px ${footerHeight}px` }}
        >
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
            title={sidebarVisible ? "Hide sidebar" : "Show sidebar"}
            aria-label={sidebarVisible ? "Hide sidebar" : "Show sidebar"}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              setSidebarVisible(!sidebarVisible);
            }}
          >
            {sidebarVisible ? (
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <polyline points="15 18 9 12 15 6" />
              </svg>
            ) : (
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <polyline points="9 18 15 12 9 6" />
              </svg>
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
