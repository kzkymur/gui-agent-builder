import React from "react";
import { Text, TextArea } from "@radix-ui/themes";
import { useEngineStore } from "../../engine/store";

export default function SchemaEditor({
  value,
  onChange,
}: { value: unknown; onChange: (v: unknown) => void }) {
  const [text, setText] = React.useState<string>(
    typeof value === "string" ? (value as string) : value ? JSON.stringify(value, null, 2) : "",
  );

  // Keep local text in sync when external value changes (e.g., after save/reload)
  React.useEffect(() => {
    const next =
      typeof value === "string" ? (value as string) : value ? JSON.stringify(value, null, 2) : "";
    setText(next);
  }, [value]);

  // Validate live without formatting. Formatting (pretty-print) happens on blur only.
  let error: string | undefined;
  if (text.trim()) {
    try {
      const parsed = JSON.parse(text);
      if (parsed && typeof parsed !== "object") {
        error = "Schema must be a JSON object.";
      }
    } catch (e: any) {
      error = e?.message || "Invalid JSON";
    }
  }

  const isBusy = useEngineStore((s) => s.activeRunning.size > 0);
  return (
    <label className="field">
      <Text as="span" weight="medium">Response Schema (JSON)</Text>
      <TextArea
        rows={6}
        className="mono"
        style={{ resize: "vertical" }}
        placeholder='{"type": "object", "properties": { "result": { "type": "string" } }, "required": ["result"] }'
        value={text}
        onChange={(e) => {
          const next = e.target.value;
          setText(next);
          onChange(next);
        }}
        onBlur={() => {
          try {
            const parsed = text.trim() ? JSON.parse(text) : undefined;
            if (parsed === undefined) {
              onChange(undefined);
            } else if (parsed && typeof parsed === "object") {
              onChange(parsed);
            } else {
              onChange(text);
            }
          } catch {
            onChange(text);
          }
        }}
        aria-invalid={Boolean(error)}
        color={error ? "red" : undefined}
        disabled={isBusy}
      />
      {error && <div style={{ color: "var(--danger, #cc3b3b)", fontSize: 12 }}>{error}</div>}
    </label>
  );
}
