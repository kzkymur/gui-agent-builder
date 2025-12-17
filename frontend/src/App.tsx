import React, { useEffect, useMemo, useState } from 'react';
import 'reactflow/dist/style.css';
import './index.css';
import GraphCanvas from './graph/GraphCanvas';
import type { Edge, Node } from 'reactflow';
import type { LLMData, MCPData, NodeData } from './types';
import { initDB, loadGraph, saveGraph } from './db/sqlite';

export default function App() {
  const initialNodes = useMemo<Node<NodeData>[]>(
    () => [
      { id: 'entry', type: 'entry', position: { x: 80, y: 120 }, data: { name: 'Entry', inputs: ['user_input'] } },
      { id: 'llm-1', type: 'llm', position: { x: 340, y: 100 }, data: { name: 'Summarizer', provider: 'OpenAI', model: 'gpt-4o', system: 'Summarize input.', outputPointers: ['/result/summary'] } as LLMData },
      { id: 'router-1', type: 'router', position: { x: 620, y: 100 }, data: { name: 'Route by length', branches: ['short', 'long'] } },
      { id: 'end-short', type: 'end', position: { x: 860, y: 40 }, data: { name: 'End (short)' } },
      { id: 'end-long', type: 'end', position: { x: 860, y: 180 }, data: { name: 'End (long)' } },
      { id: 'mcp-1', type: 'mcp', position: { x: 80, y: 260 }, data: { name: 'MCP: tools', url: 'http://localhost:9000', token: '' } as MCPData }
    ],
    []
  );

  const initialEdges = useMemo<Edge[]>(
    () => [
      { id: 'e1', source: 'entry', target: 'llm-1' },
      { id: 'e2', source: 'llm-1', target: 'router-1' },
      { id: 'e3', source: 'router-1', target: 'end-short' },
      { id: 'e4', source: 'router-1', target: 'end-long' }
    ],
    []
  );

  const [nodes, setNodes] = useState<Node<NodeData>[]>(initialNodes);
  const [edges, setEdges] = useState<Edge[]>(initialEdges);
  const [selected, setSelected] = useState<Node<NodeData> | null>(null);
  const [footerValue, setFooterValue] = useState<string>('');
  const [dbReady, setDbReady] = useState(false);
  const [newNodeType, setNewNodeType] = useState<'entry'|'llm'|'router'|'mcp'|'end'>('llm');

  // Initialize DB and load any saved graph once at startup
  useEffect(() => {
    let mounted = true;
    (async () => {
      await initDB();
      const persisted = loadGraph();
      if (!mounted) return;
      setDbReady(true);
      if (persisted.nodes.length || persisted.edges.length) {
        setNodes(persisted.nodes.map(n => ({ id: n.id, type: n.type as any, position: { x: n.x, y: n.y }, data: n.data as any })));
        setEdges(persisted.edges.map(e => ({ id: e.id, source: e.source, target: e.target })));
      } else {
        // Save initial demo graph once so it persists
        saveToDb(initialNodes, initialEdges);
      }
    })();
    return () => { mounted = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist immediately (used on initial seed) and via debounced effect for edits
  const saveToDb = (nodeList: Node<NodeData>[], edgeList: Edge[]) => {
    if (!dbReady) return; // Ignore saves until DB init completes
    saveGraph(
      nodeList.map(n => ({ id: n.id, type: n.type ?? 'default', x: n.position.x, y: n.position.y, data: n.data })),
      edgeList.map(e => ({ id: e.id, source: e.source, target: e.target! }))
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
  const makeDefaultNode = (type: 'entry'|'llm'|'router'|'mcp'|'end', idx: number): Node<NodeData> => {
    const id = `${type}-${Date.now()}`;
    const base = { id, type, position: { x: 120 + idx * 30, y: 120 + idx * 20 } } as const;
    switch (type) {
      case 'entry':
        return { ...base, data: { name: 'Entry', inputs: ['user_input'] } } as Node<any>;
      case 'llm':
        return { ...base, data: { name: 'LLM', provider: 'OpenAI', model: 'gpt-4o', outputPointers: ['/result'] } } as Node<any>;
      case 'router':
        return { ...base, data: { name: 'Router', branches: ['a', 'b'] } } as Node<any>;
      case 'mcp':
        return { ...base, data: { name: 'MCP', url: 'http://localhost:9000' } } as Node<any>;
      case 'end':
      default:
        return { ...base, data: { name: 'End' } } as Node<any>;
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
      if (e.key !== 'Delete') return;
      if (!selected) return;
      const nextNodes = nodes.filter(n => n.id !== selected.id);
      const nextEdges = edges.filter(e => e.source !== selected.id && e.target !== selected.id);
      setNodes(nextNodes);
      setEdges(nextEdges);
      setSelected(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected, nodes, edges]);

  // Footer reflects End node's value, if an End node is selected
  useEffect(() => {
    const live = selected ? nodes.find(n => n.id === selected.id) : null;
    if (live?.type === 'end') {
      const v = (live.data as any).value ?? '';
      setFooterValue(String(v));
    } else {
      setFooterValue('');
    }
  }, [selected, nodes]);

  return (
    <div className="app">
      <header className="app__header">
        LLM Flow
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginLeft: 12 }}>
          <label style={{ fontSize: 12, color: 'var(--muted)' }} htmlFor="newNodeType">New:</label>
          <select
            id="newNodeType"
            value={newNodeType}
            onChange={(e) => setNewNodeType(e.target.value as any)}
            style={{ background: '#0f0f12', border: '1px solid #2a2a2e', color: 'var(--fg)', borderRadius: 6, padding: '4px 6px' }}
          >
            <option value="entry">Entry</option>
            <option value="llm">LLM</option>
            <option value="router">Router</option>
            <option value="mcp">MCP</option>
            <option value="end">End</option>
          </select>
          <button onClick={addNode}>Add Node</button>
        </div>
      </header>
      <main className="app__main">
        <GraphCanvas
          nodes={nodes}
          edges={edges}
          onNodesChange={(n) => { setNodes(n); }}
          onEdgesChange={(e) => { setEdges(e); }}
          onSelectNode={setSelected}
        />
        <aside className="sidebar" aria-label="Sidebar">
          {(() => {
            const liveSelected = selected ? nodes.find(n => n.id === selected.id) ?? null : null;
            const mcpOptions = nodes
              .filter(n => n.type === 'mcp')
              .map(n => ({ id: n.id, name: (n.data as any)?.name || n.id }));
            return <NodeEditor node={liveSelected} mcpOptions={mcpOptions} onChange={(updater) => { setNodes(updater); }} />;
          })()}
        </aside>
      </main>
      <footer className="app__footer" aria-live="polite">
        {footerValue ? `End value: ${footerValue}` : 'Select an End node to preview its value'}
      </footer>
    </div>
  );
}

function NodeEditor({ node, mcpOptions, onChange }: { node: Node<NodeData> | null; mcpOptions: { id: string; name: string }[]; onChange: (updater: any) => void }) {
  const [draft, setDraft] = React.useState<NodeData | null>(node?.data ?? null);

  React.useEffect(() => {
    setDraft(node?.data ?? null);
    // only reset when switching nodes
  }, [node?.id]);

  // Commit debounced changes back to graph state
  React.useEffect(() => {
    if (!node || !draft) return;
    const t = setTimeout(() => {
      onChange((prev: Node<NodeData>[]) => prev.map(n => (n.id === node.id ? { ...n, data: draft } : n)));
    }, 200);
    return () => clearTimeout(t);
  }, [draft, node, onChange]);

  if (!node || !draft) return <div style={{ color: 'var(--muted)' }}>Select a node to edit.</div>;

  const update = (patch: Partial<NodeData>) => setDraft({ ...draft, ...patch });

  return (
    <div className="editor">
      <div className="section-title">General</div>
      <label className="field">
        <span>Name</span>
        <input value={draft.name ?? ''} onChange={(e) => update({ name: e.target.value })} />
      </label>
      {node.type === 'llm' && (
        <>
          <hr className="divider" />
          <div className="section-title">LLM Settings</div>
          <label className="field">
            <span>Provider</span>
            <input value={(draft as LLMData).provider ?? ''} onChange={(e) => update({ provider: e.target.value } as Partial<LLMData>)} />
          </label>
          <label className="field">
            <span>Model</span>
            <input value={(draft as LLMData).model ?? ''} onChange={(e) => update({ model: e.target.value } as Partial<LLMData>)} />
          </label>
          <label className="field">
            <span>MCP Servers</span>
            {mcpOptions.length === 0 ? (
              <div className="help">No MCP nodes available in the graph.</div>
            ) : (
              <div style={{ display: 'grid', gap: 6 }}>
                {mcpOptions.map(opt => {
                  const selected = ((draft as LLMData).mcpServers ?? []).includes(opt.id);
                  return (
                    <label key={opt.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={(e) => {
                          const current = (draft as LLMData).mcpServers ?? [];
                          const next = e.target.checked
                            ? Array.from(new Set([...current, opt.id]))
                            : current.filter(id => id !== opt.id);
                          update({ mcpServers: next } as Partial<LLMData>);
                        }}
                      />
                      <span>{opt.name}</span>
                    </label>
                  );
                })}
              </div>
            )}
            <div className="help">Check to enable servers for this LLM.</div>
          </label>
      <label className="field">
        <span>System Prompt</span>
        <textarea className="mono" rows={4} value={(draft as LLMData).system ?? ''} onChange={(e) => update({ system: e.target.value } as Partial<LLMData>)} />
      </label>
          <hr className="divider" />
          <div className="section-title">Outputs (JSON Pointers)</div>
          <SchemaEditor
            value={(draft as LLMData).responseSchema}
            onChange={(schema) => update({ responseSchema: schema } as Partial<LLMData>)}
          />
          <div className="help">Provide a JSON Schema describing the full model response. Outputs will point into this structure.</div>
          <LLMOutputPointersEditor
            pointers={(draft as LLMData).outputPointers ?? []}
            onChange={(p) => update({ outputPointers: p } as Partial<LLMData>)}
          />
          <div className="help">Each row is a JSON Pointer (RFC 6901) selecting a value from the response. Example: <code>/result/summary</code>.</div>
        </>
      )}
      {node.type === 'entry' && (
        <ArrayEditor
          label="Inputs"
          values={(draft as any).inputs ?? []}
          onChange={(vals) => update({ inputs: vals } as any)}
          placeholder="input name"
        />
      )}
      {node.type === 'mcp' && (
        <>
          <label className="field">
            <span>URL</span>
            <input value={(draft as MCPData).url ?? ''} onChange={(e) => update({ url: e.target.value } as Partial<MCPData>)} />
          </label>
          <label className="field">
            <span>Token</span>
            <input value={(draft as MCPData).token ?? ''} onChange={(e) => update({ token: e.target.value } as Partial<MCPData>)} />
          </label>
        </>
      )}
      {node.type === 'router' && (
        <ArrayEditor
          label="Branches"
          values={(draft as any).branches ?? []}
          onChange={(vals) => update({ branches: vals } as any)}
          placeholder="branch name"
        />
      )}
      {node.type === 'end' && (
        <label className="field">
          <span>Value (preview)</span>
          <textarea rows={3} value={(draft as any).value ?? ''} onChange={(e) => update({ value: e.target.value } as any)} />
        </label>
      )}
    </div>
  );
}

function ArrayEditor({ label, values, onChange, placeholder }: { label: string; values: string[]; onChange: (vals: string[]) => void; placeholder?: string }) {
  const add = () => onChange([...(values ?? []), '']);
  const setAt = (i: number, v: string) => onChange(values.map((x, idx) => (idx === i ? v : x)));
  const removeAt = (i: number) => onChange(values.filter((_, idx) => idx !== i));
  return (
    <div className="field">
      <span>{label}</span>
      <div style={{ display: 'grid', gap: 6 }}>
        {(values ?? []).map((v, i) => (
          <div key={i} style={{ display: 'flex', gap: 6 }}>
            <input value={v} placeholder={placeholder} onChange={(e) => setAt(i, e.target.value)} />
            <button type="button" onClick={() => removeAt(i)} aria-label={`Remove ${label} ${i + 1}`}>−</button>
          </div>
        ))}
        <button type="button" onClick={add}>Add {label.slice(0, -1)}</button>
      </div>
    </div>
  );
}

function isValidJsonPointer(ptr: string): boolean {
  if (typeof ptr !== 'string') return false;
  if (ptr.length === 0) return false; // empty pointer (whole doc) not allowed here
  if (!ptr.startsWith('/')) return false;
  // Validate that any '~' is followed by 0 or 1 (RFC 6901 escaping ~0, ~1)
  for (let i = 0; i < ptr.length; i++) {
    if (ptr[i] === '~') {
      if (i + 1 >= ptr.length) return false;
      const c = ptr[i + 1];
      if (c !== '0' && c !== '1') return false;
    }
  }
  return true;
}

function LLMOutputPointersEditor({ pointers, onChange }: { pointers: string[]; onChange: (p: string[]) => void }) {
  const list = pointers ?? [];

  const setPtr = (idx: number, value: string) => {
    const next = [...list];
    next[idx] = value;
    onChange(next);
  };
  const remove = (idx: number) => {
    const next = list.filter((_, i) => i !== idx);
    onChange(next);
  };
  const add = () => onChange([...(list ?? []), '/result']);

  return (
    <div className="field">
      <span>JSON Pointers (/path)</span>
      <div style={{ display: 'grid', gap: 8 }}>
        {list.length === 0 && (
          <div className="help">No outputs yet. Click “Add Output”.</div>
        )}
        {list.map((ptr, idx) => (
          <div key={idx} style={{ display: 'grid', gap: 6, gridTemplateColumns: '1fr', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                placeholder="e.g. /result/summary or /data/items/0/name"
                value={ptr}
                onChange={(e) => setPtr(idx, e.target.value)}
                aria-invalid={ptr ? (!isValidJsonPointer(ptr)).toString() : 'false'}
                style={ptr && !isValidJsonPointer(ptr) ? { borderColor: 'var(--danger, #cc3b3b)' } : undefined}
              />
              <button type="button" onClick={() => remove(idx)} aria-label={`Remove output ${idx + 1}`}>−</button>
            </div>
            {ptr && !isValidJsonPointer(ptr) && (
              <div style={{ color: 'var(--danger, #cc3b3b)', fontSize: 12 }}>
                Must start with '/' and use ~0/~1 escapes only.
              </div>
            )}
          </div>
        ))}
        <div>
          <button type="button" onClick={add}>Add Output</button>
        </div>
      </div>
    </div>
  );
}

function SchemaEditor({ value, onChange }: { value: unknown; onChange: (v: unknown) => void }) {
  const text = typeof value === 'string'
    ? (value as string)
    : (value ? JSON.stringify(value, null, 2) : '');

  let error: string | undefined;
  if (typeof value === 'string') {
    const raw = value as string;
    if (raw.trim()) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed !== 'object') {
          error = 'Schema must be a JSON object.';
        }
      } catch (e: any) {
        error = e?.message || 'Invalid JSON';
      }
    }
  }

  return (
    <label className="field">
      <span>Response Schema (JSON)</span>
      <textarea
        rows={6}
        className="mono"
        placeholder='{"type": "object", "properties": { "result": { "type": "string" } }, "required": ["result"] }'
        value={text}
        onChange={(e) => {
          const next = e.target.value;
          try {
            const parsed = next.trim() ? JSON.parse(next) : undefined;
            onChange(parsed);
          } catch {
            onChange(next);
          }
        }}
        aria-invalid={Boolean(error).toString()}
        style={error ? { borderColor: 'var(--danger, #cc3b3b)' } : undefined}
      />
      {error && (
        <div style={{ color: 'var(--danger, #cc3b3b)', fontSize: 12 }}>
          {error}
        </div>
      )}
    </label>
  );
}
