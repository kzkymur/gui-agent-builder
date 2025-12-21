import React from "react";
import { Button, IconButton, Text, TextField } from "@radix-ui/themes";

export default function ArrayEditor({
  label,
  values,
  onChange,
  placeholder,
}: { label: string; values: string[]; onChange: (vals: string[]) => void; placeholder?: string }) {
  const add = () => onChange([...(values ?? []), ""]);
  const setAt = (i: number, v: string) => onChange(values.map((x, idx) => (idx === i ? v : x)));
  const removeAt = (i: number) => onChange(values.filter((_, idx) => idx !== i));
  return (
    <div className="field">
      <Text as="span" weight="medium">{label}</Text>
      <div style={{ display: "grid", gap: 6 }}>
        {(values ?? []).map((v, i) => (
          <div key={i} style={{ display: "flex", gap: 6 }}>
            <TextField.Root style={{ flex: 1 }} value={v ?? ""} placeholder={placeholder} onChange={(e) => setAt(i, (e.target as HTMLInputElement).value)} />
            <IconButton
              type="button"
              color="red"
              variant="soft"
              size="1"
              onClick={() => removeAt(i)}
              aria-label={`Remove ${label} ${i + 1}`}
            >
              −
            </IconButton>
          </div>
        ))}
        <Button type="button" onClick={add}>Add {label.slice(0, -1)}</Button>
      </div>
    </div>
  );
}
