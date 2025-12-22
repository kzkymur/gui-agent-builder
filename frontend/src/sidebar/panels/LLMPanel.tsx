import React from "react";
import { Button, Checkbox, Select, Text, TextArea, TextField } from "@radix-ui/themes";
import type { Node } from "reactflow";
import type { LLMData, NodeData } from "../../types";
import { useEngineStore } from "../../engine/store";
import { getBackendClient } from "../../engine/backendClient";
import SchemaEditor from "../components/SchemaEditor";
import LLMOutputPointersEditor from "../components/LLMOutputPointersEditor";

export function InputsEditor({
  inputs,
  onChange,
}: {
  inputs: { key: string; description: string }[];
  onChange: (v: { key: string; description: string }[]) => void;
}) {
  const isBusy = useEngineStore((s) => s.activeRunning.size > 0);
  const list = inputs ?? [];
  const setAt = (
    i: number,
    patch: Partial<{ key: string; description: string }>,
  ) => {
    const next = list.map((item, idx) => (idx === i ? { ...item, ...patch } : item));
    onChange(next);
  };
  const removeAt = (i: number) => onChange(list.filter((_, idx) => idx !== i));
  const add = () => onChange([...(list ?? []), { key: "", description: "" }]);
  return (
    <div className="field">
      <Text as="span" weight="medium">
        Input Handles
      </Text>
      <div style={{ display: "grid", gap: 8 }}>
        {list.map((it, i) => (
          <div key={i} style={{ display: "grid", gap: 6 }}>
            <div style={{ display: "flex", gap: 6 }}>
              <TextField.Root
                style={{ width: "30%" }}
                placeholder="key"
                value={it.key ?? ""}
                onChange={(e) => setAt(i, { key: (e.target as HTMLInputElement).value })}
                disabled={isBusy}
              />
              <TextField.Root
                style={{ flex: 1 }}
                placeholder="description"
                value={it.description ?? ""}
                onChange={(e) =>
                  setAt(i, { description: (e.target as HTMLInputElement).value })
                }
                disabled={isBusy}
              />
              <Button
                type="button"
                color="red"
                variant="soft"
                size="1"
                onClick={() => removeAt(i)}
                aria-label={`Remove input ${i + 1}`}
                disabled={isBusy}
              >
                −
              </Button>
            </div>
          </div>
        ))}
        <div>
          <Button type="button" onClick={add} disabled={isBusy}>
            Add Input
          </Button>
        </div>
      </div>
      <div className="help">
        Each input handle has a short <b>key</b> and a longer <b>description</b> that becomes
        part of the prompt.
      </div>
    </div>
  );
}

export default function LLMPanel({
  node,
  draft,
  onPatch,
  mcpOptions,
}: {
  node: Node<NodeData>;
  draft: NodeData;
  onPatch: (patch: Partial<LLMData>) => void;
  mcpOptions: { id: string; name: string }[];
}) {
  const isBusy = useEngineStore((s) => s.activeRunning.size > 0);
  const [providerOptions, setProviderOptions] = React.useState<string[]>([]);
  React.useEffect(() => {
    (async () => {
      try {
        const res = await getBackendClient().GET("/providers");
        const ids = (res.data?.providers ?? []).map((p: any) => String(p.id));
        setProviderOptions(ids);
      } catch {
        setProviderOptions([]);
      }
    })();
  }, []);

  return (
    <>
      <hr className="divider" />
      <div className="section-title">LLM Settings</div>
      <details>
        <summary style={{ cursor: "pointer", userSelect: "none" }}>Detail Settings</summary>
        <div style={{ display: "grid", gap: 10, marginTop: 8 }}>
          <label className="field">
            <Text as="span" weight="medium">
              Provider
            </Text>
            <Select.Root
              value={(draft as LLMData).provider ?? ""}
              onValueChange={(val) => onPatch({ provider: val })}
              disabled={isBusy}
            >
              <Select.Trigger placeholder="Select provider…" />
              <Select.Content>
                {providerOptions.map((pid) => (
                  <Select.Item key={pid} value={pid}>
                    {pid}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select.Root>
          </label>
          <label className="field">
            <Text as="span" weight="medium">Max Tokens</Text>
            <TextField.Root
              type="number"
              inputMode="numeric"
              min="1"
              step="1"
              value={typeof (draft as LLMData).maxTokens === "number" ? String((draft as LLMData).maxTokens) : ""}
              onChange={(e) => {
                const v = (e.target as HTMLInputElement).value;
                onPatch({ maxTokens: v === "" ? undefined : Number(v) });
              }}
              disabled={isBusy}
            />
            <div className="help">Empty = model default</div>
          </label>
          <label className="field">
            <Text as="span" weight="medium">
              Model
            </Text>
            <TextField.Root
              value={(draft as LLMData).model ?? ""}
              onChange={(e) => onPatch({ model: (e.target as HTMLInputElement).value })}
              disabled={isBusy}
            />
          </label>
          <label className="field">
            <Text as="span" weight="medium">
              Temperature
            </Text>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={
                  typeof (draft as LLMData).temperature === "number"
                    ? (draft as LLMData).temperature
                    : 0.7
                }
                onChange={(e) => onPatch({ temperature: Number(e.target.value) })}
                disabled={isBusy}
                style={{ flex: 1 }}
              />
              <code style={{ minWidth: 42, textAlign: "right" }}>
                {typeof (draft as LLMData).temperature === "number"
                  ? (draft as LLMData).temperature!.toFixed(2)
                  : "—"}
              </code>
              <Button
                type="button"
                size="1"
                variant="soft"
                onClick={() => onPatch({ temperature: undefined })}
                disabled={isBusy}
                title="Reset to model default"
              >
                Reset
              </Button>
            </div>
            <div className="help">0–1 (Reset = provider default)</div>
          </label>
        </div>
      </details>

      <label className="field">
        <Text as="span" weight="medium">
          MCP Servers
        </Text>
        {mcpOptions.length === 0 ? (
          <div className="help">No MCP nodes available in the graph.</div>
        ) : (
          <div style={{ display: "grid", gap: 6 }}>
            {mcpOptions.map((opt) => {
              const selected = ((draft as LLMData).mcpServers ?? []).includes(opt.id);
              return (
                <label key={opt.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Checkbox
                    checked={selected}
                    onCheckedChange={(checked) => {
                      const current = (draft as LLMData).mcpServers ?? [];
                      const isChecked = Boolean(checked);
                      const next = isChecked
                        ? Array.from(new Set([...current, opt.id]))
                        : current.filter((id) => id !== opt.id);
                      onPatch({ mcpServers: next });
                    }}
                    disabled={isBusy}
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
        onChange={(inp) => onPatch({ inputs: inp })}
      />

      <label className="field">
        <Text as="span" weight="medium">
          System Prompt
        </Text>
        <TextArea
          className="mono"
          rows={4}
          style={{ resize: "vertical" }}
          value={(draft as LLMData).system ?? ""}
          onChange={(e) => onPatch({ system: e.target.value })}
          disabled={isBusy}
        />
      </label>

      <label className="field">
        <SchemaEditor
          value={(draft as LLMData).responseSchema}
          onChange={(schema) => onPatch({ responseSchema: schema })}
        />
        <div className="help">
          Describe the full model response. Output pointers will reference paths within this
          schema.
        </div>
      </label>

      <hr className="divider" />
      <div className="section-title">Outputs (JSON Pointers)</div>
      <LLMOutputPointersEditor
        pointers={(draft as LLMData).outputPointers ?? []}
        onChange={(p) => onPatch({ outputPointers: p })}
      />
      <div className="help">
        Each row is a JSON Pointer (RFC 6901) selecting a value from the response. Example:
        <code>/result/summary</code>.
      </div>
    </>
  );
}
