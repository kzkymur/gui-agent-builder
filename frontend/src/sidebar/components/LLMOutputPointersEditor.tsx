import React from 'react';

function isValidJsonPointer(ptr: string): boolean {
  if (typeof ptr !== 'string') return false;
  if (ptr.length === 0) return false; // empty pointer not allowed here
  if (!ptr.startsWith('/')) return false;
  for (let i = 0; i < ptr.length; i++) {
    if (ptr[i] === '~') {
      if (i + 1 >= ptr.length) return false;
      const c = ptr[i + 1];
      if (c !== '0' && c !== '1') return false;
    }
  }
  return true;
}

export default function LLMOutputPointersEditor({ pointers, onChange }: { pointers: string[]; onChange: (p: string[]) => void }) {
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
              <div style={{ color: 'var(--danger, #cc3b3b)', fontSize: 12 }}>Must start with '/' and use ~0/~1 escapes only.</div>
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

