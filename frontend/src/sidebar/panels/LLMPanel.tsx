import {
  Button,
  Checkbox,
  Select,
  Text,
  TextArea,
  TextField,
} from "@radix-ui/themes";
import React from "react";
import type { Node } from "reactflow";
import { getBackendClient, rawGet } from "../../engine/backendClient";
import { useEngineStore } from "../../engine/store";
import type { LLMData, NodeData } from "../../types";
import LLMOutputPointersEditor from "../components/LLMOutputPointersEditor";
import SchemaEditor from "../components/SchemaEditor";

export function InputsEditor({
  inputs,
  onChange,
}: {
  inputs: {
    key: string;
    description: string;
    mode?: "normal" | "optional" | "holding" | "optional_holding";
    trigger?: boolean;
  }[];
  onChange: (
    v: {
      key: string;
      description: string;
      mode?: "normal" | "optional" | "holding" | "optional_holding";
      trigger?: boolean;
    }[]
  ) => void;
}) {
  const isBusy = useEngineStore((s) => s.activeRunning.size > 0);
  const list = Array.isArray(inputs) ? inputs : [];
  const setAt = (
    i: number,
    patch: Partial<{ key: string; description: string; mode: any; trigger: boolean }>
  ) => {
    const next = list.map((item, idx) =>
      idx === i ? { ...item, ...patch } : item
    );
    onChange(next);
  };
  const removeAt = (i: number) => onChange(list.filter((_, idx) => idx !== i));
  const add = () => onChange([...(list || []), { key: "", description: "" }]);
  return (
    <div className="field">
      <Text as="span" weight="medium">
        Input Handles
      </Text>
      <div style={{ display: "grid", gap: 8 }}>
        {list.map((it, i) => (
          // Use a stable key independent of the input value to avoid remounting and blur
          <div key={`in-${i}`} style={{ display: "grid", gap: 6 }}>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              {(() => {
                const mode = String(it.mode ?? "normal");
                const isOptional = mode === "optional" || mode === "optional_holding";
                const isHolding = mode === "holding" || mode === "optional_holding";
                const onToggle = (opts: { required?: boolean; holding?: boolean }) => {
                  const required = opts.required ?? !isOptional;
                  const holding = opts.holding ?? isHolding;
                  const nextMode = required
                    ? (holding ? "holding" : "normal")
                    : (holding ? "optional_holding" : "optional");
                  setAt(i, { mode: nextMode as any });
                };
                return (
                  <>
                    <label style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                      <Checkbox
                        color="red"
                        checked={!isOptional}
                        onCheckedChange={(v) => onToggle({ required: Boolean(v) })}
                        disabled={isBusy}
                        style={{ paddingLeft: 0, paddingRight: 0 }}
                      />
                      <span style={{ color: !isOptional ? "#ef4444" : "#9ca3af" }}>Required</span>
                    </label>
                    <label style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                      <Checkbox
                        color="green"
                        checked={isHolding}
                        onCheckedChange={(v) => onToggle({ holding: Boolean(v) })}
                        disabled={isBusy}
                        style={{ paddingLeft: 0, paddingRight: 0 }}
                      />
                      <span style={{ color: isHolding ? "#16a34a" : "#9ca3af" }}>Holding</span>
                    </label>
                    <label style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                      <Checkbox
                        color="blue"
                        checked={it.trigger !== false}
                        onCheckedChange={(v) => setAt(i, { trigger: Boolean(v) })}
                        disabled={isBusy}
                        style={{ paddingLeft: 0, paddingRight: 0 }}
                      />
                      <span style={{ color: it.trigger !== false ? "#3b82f6" : "#9ca3af" }}>Trigger</span>
                    </label>
                  </>
                );
              })()}
              <TextField.Root
                style={{ width: "30%" }}
                placeholder="key"
                value={it.key ?? ""}
                onChange={(e) =>
                  setAt(i, { key: (e.target as HTMLInputElement).value })
                }
                disabled={isBusy}
              />
              <TextField.Root
                style={{ flex: 1 }}
                placeholder="description"
                value={it.description ?? ""}
                onChange={(e) =>
                  setAt(i, {
                    description: (e.target as HTMLInputElement).value,
                  })
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
        Each input handle has a short <b>key</b> and a longer <b>description</b>{" "}
        that becomes part of the prompt.
      </div>
    </div>
  );
}

export default function LLMPanel({
  node,
  draft,
  onPatch,
  mcpOptions,
  fsOptions,
}: {
  node: Node<NodeData>;
  draft: NodeData;
  onPatch: (patch: Partial<LLMData>) => void;
  mcpOptions: { id: string; name: string }[];
  fsOptions: { id: string; name: string }[];
}) {
  const isBusy = useEngineStore((s) => s.activeRunning.size > 0);
  const [providerOptions, setProviderOptions] = React.useState<string[]>([]);
  const provider = (draft as LLMData).provider ?? "";
  const [modelOptions, setModelOptions] = React.useState<
    { id: string; name?: string; description?: string; supports_temperature?: boolean }[]
  >([]);
  const [modelsLoading, setModelsLoading] = React.useState(false);
  React.useEffect(() => {
    (async () => {
      try {
        const res = await getBackendClient().GET("/providers");
        const providers =
          res &&
          typeof res === "object" &&
          res.data &&
          typeof res.data === "object" &&
          Array.isArray((res.data as { providers?: unknown }).providers)
            ? (res.data as { providers: Array<{ id: unknown }> }).providers
            : [];
        const ids = providers.map((p) => String(p.id));
        setProviderOptions(ids);
      } catch {
        setProviderOptions([]);
      }
    })();
  }, []);

  // Load models when provider changes
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!provider) {
        setModelOptions([]);
        return;
      }
      setModelsLoading(true);
      try {
        const data = await rawGet<{
          provider: string;
          models: Array<{ id: string; name?: string; description?: string; supports_temperature?: boolean }>;
        }>(`/model?provider=${encodeURIComponent(provider)}`);
        const list = Array.isArray(data?.models) ? data.models : [];
        if (!cancelled) {
          const opts = list.map((m) => {
            const item: { id: string; name?: string; description?: string; supports_temperature?: boolean } = {
              id: String(m.id),
            };
            if (m.name) item.name = m.name;
            if (m.description) item.description = m.description;
            // Prefer explicit flag from backend; otherwise infer for known families
            const explicit = (m as any).supports_temperature;
            if (typeof explicit === "boolean") {
              item.supports_temperature = Boolean(explicit);
            } else if (provider === "openai" && /^o1(\b|-)/.test(item.id)) {
              item.supports_temperature = false;
            }
            return item;
          });
          setModelOptions(opts);
        }
      } catch {
        if (!cancelled) setModelOptions([]);
      } finally {
        if (!cancelled) setModelsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [provider]);

  return (
    <>
      <hr className="divider" />
      <div className="section-title">LLM Settings</div>
      <details>
        <summary style={{ cursor: "pointer", userSelect: "none" }}>
          Detail Settings
        </summary>
        <div style={{ display: "grid", gap: 10, marginTop: 8 }}>
          <div className="field">
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
          </div>
          <div className="field">
            <Text as="span" weight="medium">
              Max Tokens
            </Text>
            <TextField.Root
              type="number"
              inputMode="numeric"
              min="1"
              step="1"
              value={
                typeof (draft as LLMData).maxTokens === "number"
                  ? String((draft as LLMData).maxTokens)
                  : ""
              }
              onChange={(e) => {
                const v = (e.target as HTMLInputElement).value;
                onPatch({ maxTokens: v === "" ? null : Number(v) });
              }}
              disabled={isBusy}
            />
            <div className="help">Empty = model default</div>
          </div>
          <div className="field">
            <Text as="span" weight="medium">
              Model
            </Text>
            <Select.Root
              value={(draft as LLMData).model ?? ""}
              onValueChange={(val) => onPatch({ model: val })}
              disabled={isBusy || !provider || modelsLoading}
            >
              <Select.Trigger
                placeholder={
                  provider
                    ? modelsLoading
                      ? "Loading models…"
                      : "Select model…"
                    : "Select provider first…"
                }
              />
              <Select.Content>
                {modelOptions.map((m) => (
                  <Select.Item key={m.id} value={m.id}>
                    {m.name ?? m.id}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select.Root>
            {(draft as LLMData).model && (
              <div className="help">
                {modelOptions.find((m) => m.id === (draft as LLMData).model)
                  ?.description || (draft as LLMData).model}
              </div>
            )}
          </div>
          <div className="field">
            <Text as="span" weight="medium">
              Temperature
            </Text>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {(() => {
                const t =
                  typeof (draft as LLMData).temperature === "number"
                    ? ((draft as LLMData).temperature as number)
                    : 0.7;
                const selectedModel = modelOptions.find((m) => m.id === (draft as LLMData).model);
                // Disable when the flag is explicitly false or when we can infer from id/provider
                const inferredUnsupported =
                  (provider === "openai" && /^o1(\b|-)/.test(String((draft as LLMData).model || "")));
                const tempSupported = (selectedModel?.supports_temperature !== false) && !inferredUnsupported;
                return (
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={t}
                    onChange={(e) =>
                      onPatch({ temperature: Number(e.target.value) })
                    }
                    disabled={isBusy || !tempSupported}
                    style={{ flex: 1 }}
                  />
                );
              })()}
              <code style={{ minWidth: 42, textAlign: "right" }}>
                {typeof (draft as LLMData).temperature === "number"
                  ? (draft as LLMData).temperature?.toFixed(2)
                  : "—"}
              </code>
              <Button
                type="button"
                size="1"
                variant="soft"
                onClick={() => onPatch({ temperature: null })}
                disabled={isBusy ||
                  modelOptions.find((m) => m.id === (draft as LLMData).model)?.supports_temperature === false}
                title="Reset to model default"
              >
                Reset
              </Button>
            </div>
            <div className="help">
              {(() => {
                const selectedModel = modelOptions.find((m) => m.id === (draft as LLMData).model);
                const inferredUnsupported = provider === "openai" && /^o1(\b|-)/.test(String((draft as LLMData).model || ""));
                if ((selectedModel && selectedModel.supports_temperature === false) || inferredUnsupported) {
                  return "Temperature not supported by this model.";
                }
                return "0–1 (Reset = provider default)";
              })()}
            </div>
          </div>
        </div>
      </details>

      <div className="field">
        <label style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <Checkbox
            checked={Boolean((draft as LLMData).webSearch)}
            onCheckedChange={(checked) => onPatch({ webSearch: Boolean(checked) })}
            disabled={isBusy}
          />
          <span>Web Search (Tavily)</span>
        </label>
        <div className="help">When enabled, the model can call a web search tool.</div>
      </div>

      <div className="field">
        <Text as="span" weight="medium">
          Tools
        </Text>
        <div style={{ display: "grid", gap: 6 }}>
          <div style={{ color: "var(--gray-11)" }}>MCP Servers</div>
          {mcpOptions.length === 0 ? (
            <div className="help">No MCP nodes available in the graph.</div>
          ) : (
            mcpOptions.map((opt) => {
              const selected = ((draft as LLMData).mcpServers ?? []).includes(opt.id);
              return (
                <div key={opt.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
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
                </div>
              );
            })
          )}
          <div style={{ color: "var(--gray-11)", marginTop: 6 }}>Filesystems</div>
          {fsOptions.length === 0 ? (
            <div className="help">No Filesystem nodes in the graph.</div>
          ) : (
            fsOptions.map((opt) => {
              const selected = Array.isArray((draft as any).fsNodes) && ((draft as any).fsNodes as string[]).includes(opt.id);
              return (
                <div key={opt.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Checkbox
                    checked={selected}
                    onCheckedChange={(checked) => {
                      const current: string[] = Array.isArray((draft as any).fsNodes) ? (draft as any).fsNodes : [];
                      const isChecked = Boolean(checked);
                      const next = isChecked
                        ? Array.from(new Set([...current, opt.id]))
                        : current.filter((id) => id !== opt.id);
                      onPatch({ ...(draft as any), fsNodes: next } as any);
                    }}
                    disabled={isBusy}
                  />
                  <span>{opt.name}</span>
                </div>
              );
            })
          )}
        </div>
        <div className="help">Enable tools the model can call.</div>
      </div>

      <hr className="divider" />
      <div className="section-title">Inputs</div>
      <InputsEditor
        inputs={(draft as LLMData).inputs ?? []}
        onChange={(inp) => onPatch({ inputs: inp })}
      />

      <div className="field">
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
      </div>

      <div className="field">
        <SchemaEditor
          value={(draft as LLMData).responseSchema}
          onChange={(schema) => onPatch({ responseSchema: schema })}
        />
        <div className="help">
          Describe the full model response. Output pointers will reference paths
          within this schema.
        </div>
      </div>

      <hr className="divider" />
      <div className="section-title">Outputs (JSON Pointers)</div>
      <LLMOutputPointersEditor
        pointers={(draft as LLMData).outputPointers ?? []}
        onChange={(p) => onPatch({ outputPointers: p })}
      />
      <div className="help">
        Each row is a JSON Pointer (RFC 6901) selecting a value from the
        response. Example:
        <code>/result/summary</code>.
      </div>
    </>
  );
}
