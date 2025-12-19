import React from 'react';

export default function SchemaEditor({ value, onChange }: { value: unknown; onChange: (v: unknown) => void }) {
  const text = typeof value === 'string' ? (value as string) : value ? JSON.stringify(value, null, 2) : '';

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
      {error && <div style={{ color: 'var(--danger, #cc3b3b)', fontSize: 12 }}>{error}</div>}
    </label>
  );
}

