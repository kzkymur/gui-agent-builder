import React from 'react';

export default function SchemaEditor({ value, onChange }: { value: unknown; onChange: (v: unknown) => void }) {
  const [text, setText] = React.useState<string>(
    typeof value === 'string' ? (value as string) : value ? JSON.stringify(value, null, 2) : ''
  );

  // Keep local text in sync when external value changes (e.g., after save/reload)
  React.useEffect(() => {
    const next = typeof value === 'string' ? (value as string) : value ? JSON.stringify(value, null, 2) : '';
    setText(next);
  }, [value]);

  // Validate live without formatting. Formatting (pretty-print) happens on blur only.
  let error: string | undefined;
  if (text.trim()) {
    try {
      const parsed = JSON.parse(text);
      if (parsed && typeof parsed !== 'object') {
        error = 'Schema must be a JSON object.';
      }
    } catch (e: any) {
      error = e?.message || 'Invalid JSON';
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
          setText(next);
          // Persist raw text while typing so it is saved, but do not pretty-print yet
          onChange(next);
        }}
        onBlur={() => {
          // On blur, if valid JSON object, store as parsed object which will pretty-print on re-render
          try {
            const parsed = text.trim() ? JSON.parse(text) : undefined;
            if (parsed === undefined) {
              onChange(undefined);
            } else if (parsed && typeof parsed === 'object') {
              onChange(parsed);
            } else {
              // Not an object; keep raw text
              onChange(text);
            }
          } catch {
            // Keep raw text if invalid
            onChange(text);
          }
        }}
        aria-invalid={Boolean(error).toString()}
        style={error ? { borderColor: 'var(--danger, #cc3b3b)' } : undefined}
      />
      {error && <div style={{ color: 'var(--danger, #cc3b3b)', fontSize: 12 }}>{error}</div>}
    </label>
  );
}
