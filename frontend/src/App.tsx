import React, { useEffect, useMemo, useState } from "react";
import "reactflow/dist/style.css";
import "./index.css";
import GraphCanvas from "./graph/GraphCanvas";
import type { Edge, Node } from "reactflow";
import type { LLMData, MCPData, NodeData } from "./types";
import { initDB, loadGraph, saveGraph } from "./db/sqlite";
import NodeEditor from "./sidebar/NodeEditor";

export default function App() {
  const initialNodes = useMemo<Node<NodeData>[]>(
    () => [
      {
        id: "entry",
        type: "entry",
        position: { x: 80, y: 120 },
        data: { name: "Entry", inputs: ["user_input"] },
      },
      {
        id: "llm-1",
        type: "llm",
        position: { x: 340, y: 100 },
        data: {
          name: "Summarizer",
          provider: "OpenAI",
          model: "gpt-4o",
          system: "Summarize input.",
          inputs: [{ key: "text", description: "User text to summarize" }],
          outputPointers: ["/result/summary"],
        } as LLMData,
      },
      {
        id: "router-1",
        type: "router",
        position: { x: 620, y: 100 },
        data: { name: "Route by length", branches: ["short", "long"] },
      },
      {
        id: "end-short",
        type: "end",
        position: { x: 860, y: 40 },
        data: { name: "End (short)" },
      },
      {
        id: "end-long",
        type: "end",
        position: { x: 860, y: 180 },
        data: { name: "End (long)" },
      },
      {
        id: "mcp-1",
        type: "mcp",
        position: { x: 80, y: 260 },
        data: {
          name: "MCP: tools",
          url: "http://localhost:9000",
          token: "",
        } as MCPData,
      },
    ],
    []
  );

  const initialEdges = useMemo<Edge[]>(
    () => [
      { id: "e1", source: "entry", target: "llm-1", sourceHandle: "out-0", targetHandle: "in-0" },
      { id: "e2", source: "llm-1", target: "router-1", sourceHandle: "out-0" },
      { id: "e3", source: "router-1", target: "end-short", sourceHandle: "br-short" },
      { id: "e4", source: "router-1", target: "end-long", sourceHandle: "br-long" },
    ],
    []
  );

  const [nodes, setNodes] = useState<Node<NodeData>[]>(initialNodes);
  const [edges, setEdges] = useState<Edge[]>(initialEdges);
  const [selected, setSelected] = useState<Node<NodeData> | null>(null);
  const [footerValue, setFooterValue] = useState<string>("");
  const [dbReady, setDbReady] = useState(false);
  const [newNodeType, setNewNodeType] = useState<
    "entry" | "llm" | "router" | "mcp" | "end"
  >("llm");

  // Initialize DB and load any saved graph once at startup
  useEffect(() => {
    let mounted = true;
    (async () => {
      await initDB();
      const persisted = loadGraph();
      if (!mounted) return;
      setDbReady(true);
      if (persisted.nodes.length || persisted.edges.length) {
        setNodes(
          persisted.nodes.map((n) => ({
            id: n.id,
            type: n.type as any,
            position: { x: n.x, y: n.y },
            data: n.data as any,
          }))
        );
        setEdges(
          persisted.edges.map((e) => ({
            id: e.id,
            source: e.source,
            target: e.target,
            sourceHandle: (e as any).sourceHandle ?? undefined,
            targetHandle: (e as any).targetHandle ?? undefined,
          }))
        );
      } else {
        // Save initial demo graph once so it persists
        saveToDb(initialNodes, initialEdges);
      }
    })();
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist immediately (used on initial seed) and via debounced effect for edits
  const saveToDb = (nodeList: Node<NodeData>[], edgeList: Edge[]) => {
    if (!dbReady) return; // Ignore saves until DB init completes
    saveGraph(
      nodeList.map((n) => ({
        id: n.id,
        type: n.type ?? "default",
        x: n.position.x,
        y: n.position.y,
        data: n.data,
      })),
      edgeList.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target!,
        sourceHandle: (e as any).sourceHandle ?? null,
        targetHandle: (e as any).targetHandle ?? null,
      }))
    );
  };

  // Debounce persistence to avoid jank while typing in the sidebar
  useEffect(() => {
    if (!dbReady) return;
    const t = setTimeout(() => {
      saveToDb(nodes, edges);
    }, 300);
    return () => clearTimeout(t);
  }, [nodes, edges, dbReady]);

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
          data: { name: "Entry", inputs: ["user_input"] },
        } as Node<any>;
      case "llm":
        return {
          ...base,
          data: {
            name: "LLM",
            provider: "OpenAI",
            model: "gpt-4o",
            inputs: [{ key: "input", description: "Primary input" }],
            outputPointers: ["/result"],
          },
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
          <button
            onClick={() => {
              const nodeById = new Map(nodes.map((n) => [n.id, n] as const));
              const handleLabelFor = (nodeId: string | null | undefined, handleId: string | null | undefined, dir: 'source'|'target') => {
                if (!nodeId || !handleId) return null;
                const node = nodeById.get(nodeId);
                if (!node) return null;
                const data: any = node.data ?? {};
                switch (node.type) {
                  case 'entry': {
                    // entry source handles: out-<idx> map to inputs[idx]
                    if (dir === 'source' && handleId.startsWith('out-')) {
                      const idx = Number(handleId.replace('out-',''));
                      return Array.isArray(data.inputs) ? data.inputs[idx] ?? null : null;
                    }
                    break;
                  }
                  case 'llm': {
                    if (dir === 'target' && handleId.startsWith('in-')) {
                      const idx = Number(handleId.replace('in-',''));
                      return Array.isArray(data.inputs) ? data.inputs[idx]?.key ?? null : null;
                    }
                    if (dir === 'source' && handleId.startsWith('out-')) {
                      const idx = Number(handleId.replace('out-',''));
                      const outs = Array.isArray(data.outputPointers) && data.outputPointers.length > 0 ? data.outputPointers : ['/result'];
                      return outs[idx] ?? null;
                    }
                    break;
                  }
                  case 'router': {
                    // router source handles: br-<branch>
                    if (dir === 'source' && handleId.startsWith('br-')) {
                      return handleId.substring(3);
                    }
                    break;
                  }
                  default:
                    break;
                }
                return null;
              };

              const payload = {
                nodes: nodes.map((n) => ({
                  id: n.id,
                  type: n.type,
                  x: n.position.x,
                  y: n.position.y,
                  data: n.data,
                })),
                edges: edges.map((e) => ({
                  id: e.id,
                  from: {
                    node: e.source,
                    handleId: (e as any).sourceHandle ?? null,
                    handleLabel: handleLabelFor(e.source, (e as any).sourceHandle, 'source'),
                  },
                  to: {
                    node: e.target,
                    handleId: (e as any).targetHandle ?? null,
                    handleLabel: handleLabelFor(e.target, (e as any).targetHandle, 'target'),
                  },
                })),
              };
              // Print a stable, readable snapshot of the current graph
              // eslint-disable-next-line no-console
              console.log("[LLM-Flow] Graph snapshot", payload);
            }}
          >
            Log Graph
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
