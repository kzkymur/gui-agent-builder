import React from 'react';
import type { Node } from 'reactflow';
import type { LLMData, MCPData, NodeData } from '../types';
import ArrayEditor from './components/ArrayEditor';
import LLMOutputPointersEditor from './components/LLMOutputPointersEditor';
import SchemaEditor from './components/SchemaEditor';

export default function NodeEditor({ node, mcpOptions, onChange }: { node: Node<NodeData> | null; mcpOptions: { id: string; name: string }[]; onChange: (updater: any) => void }) {
  const [draft, setDraft] = React.useState<NodeData | null>(node?.data ?? null);

  React.useEffect(() => {
    setDraft(node?.data ?? null);
  }, [node?.id]);

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
          <hr className="divider" />
          <div className="section-title">Inputs</div>
          <InputsEditor
            inputs={(draft as LLMData).inputs ?? []}
            onChange={(inp) => update({ inputs: inp } as Partial<LLMData>)}
          />
          <label className="field">
            <span>System Prompt</span>
            <textarea className="mono" rows={4} value={(draft as LLMData).system ?? ''} onChange={(e) => update({ system: e.target.value } as Partial<LLMData>)} />
          </label>
          <label className="field">
            <SchemaEditor value={(draft as LLMData).responseSchema} onChange={(schema) => update({ responseSchema: schema } as Partial<LLMData>)} />
            <div className="help">Describe the full model response. Output pointers will reference paths within this schema.</div>
          </label>
          <hr className="divider" />
          <div className="section-title">Outputs (JSON Pointers)</div>
          <LLMOutputPointersEditor pointers={(draft as LLMData).outputPointers ?? []} onChange={(p) => update({ outputPointers: p } as Partial<LLMData>)} />
          <div className="help">Each row is a JSON Pointer (RFC 6901) selecting a value from the response. Example: <code>/result/summary</code>.</div>
        </>
      )}
      {node.type === 'entry' && (
        <ArrayEditor label="Inputs" values={(draft as any).inputs ?? []} onChange={(vals) => update({ inputs: vals } as any)} placeholder="input name" />
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
        <ArrayEditor label="Branches" values={(draft as any).branches ?? []} onChange={(vals) => update({ branches: vals } as any)} placeholder="branch name" />
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

function InputsEditor({ inputs, onChange }: { inputs: { key: string; description: string }[]; onChange: (v: { key: string; description: string }[]) => void }) {
  const list = inputs ?? [];
  const setAt = (i: number, patch: Partial<{ key: string; description: string }>) => {
    const next = list.map((item, idx) => (idx === i ? { ...item, ...patch } : item));
    onChange(next);
  };
  const removeAt = (i: number) => onChange(list.filter((_, idx) => idx !== i));
  const add = () => onChange([...(list ?? []), { key: '', description: '' }]);
  return (
    <div className="field">
      <span>Input Handles</span>
      <div style={{ display: 'grid', gap: 8 }}>
        {list.map((it, i) => (
          <div key={i} style={{ display: 'grid', gap: 6 }}>
            <div style={{ display: 'flex', gap: 6 }}>
              <input style={{ width: '30%' }} placeholder="key" value={it.key} onChange={(e) => setAt(i, { key: e.target.value })} />
              <input style={{ flex: 1 }} placeholder="description" value={it.description} onChange={(e) => setAt(i, { description: e.target.value })} />
              <button type="button" onClick={() => removeAt(i)} aria-label={`Remove input ${i + 1}`}>−</button>
            </div>
          </div>
        ))}
        <div>
          <button type="button" onClick={add}>Add Input</button>
        </div>
      </div>
      <div className="help">Each input handle has a short <b>key</b> and a longer <b>description</b> that becomes part of the prompt.</div>
    </div>
  );
}
