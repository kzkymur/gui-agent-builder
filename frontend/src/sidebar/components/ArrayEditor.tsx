import React from 'react';

export default function ArrayEditor({ label, values, onChange, placeholder }: { label: string; values: string[]; onChange: (vals: string[]) => void; placeholder?: string }) {
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

