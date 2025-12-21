import React from "react";
import {
  Button,
  Checkbox,
  IconButton,
  Text,
  TextArea,
  TextField,
} from "@radix-ui/themes";
import { useEngineStore } from "../engine/store";
import type { Node } from "reactflow";
import type { LLMData, MCPData, NodeData } from "../types";
import ArrayEditor from "./components/ArrayEditor";
import LLMOutputPointersEditor from "./components/LLMOutputPointersEditor";
import SchemaEditor from "./components/SchemaEditor";

export default function NodeEditor({
  node,
  mcpOptions,
  onChange,
}: {
  node: Node<NodeData> | null;
  mcpOptions: { id: string; name: string }[];
  onChange: (updater: any) => void;
}) {
  const [draft, setDraft] = React.useState<NodeData | null>(node?.data ?? null);
  const isBusy = useEngineStore((s) => s.activeRunning.size > 0);

  React.useEffect(() => {
    setDraft(node?.data ?? null);
  }, [node?.id]);

  React.useEffect(() => {
    if (!node || !draft) return;
    const t = setTimeout(() => {
      onChange((prev: Node<NodeData>[]) =>
        prev.map((n) => (n.id === node.id ? { ...n, data: draft } : n))
      );
    }, 200);
    return () => clearTimeout(t);
  }, [draft, node, onChange]);

  if (!node || !draft)
    return <div style={{ color: "var(--muted)" }}>Select a node to edit.</div>;

  const update = (patch: Partial<NodeData>) => setDraft({ ...draft, ...patch });

  return (
    <div className="editor">
      <div className="section-title">General</div>
      <label className="field">
        <Text as="span" weight="medium">
          Name
        </Text>
        <TextField.Root
          value={draft.name ?? ""}
          onChange={(e) =>
            update({ name: (e.target as HTMLInputElement).value })
          }
          disabled={isBusy}
        />
      </label>
      {node.type === "llm" && (
        <>
          <hr className="divider" />
          <div className="section-title">LLM Settings</div>
          <details>
            <summary style={{ cursor: "pointer", userSelect: "none" }}>
              Detail Settings
            </summary>
            <div style={{ display: "grid", gap: 10, marginTop: 8 }}>
              <label className="field">
                <Text as="span" weight="medium">
                  Provider
                </Text>
                <TextField.Root
                  value={(draft as LLMData).provider ?? ""}
                  onChange={(e) =>
                    update({
                      provider: (e.target as HTMLInputElement).value,
                    } as Partial<LLMData>)
                  }
                  disabled={isBusy}
                />
              </label>
              <label className="field">
                <Text as="span" weight="medium">
                  Model
                </Text>
                <TextField.Root
                  value={(draft as LLMData).model ?? ""}
                  onChange={(e) =>
                    update({
                      model: (e.target as HTMLInputElement).value,
                    } as Partial<LLMData>)
                  }
                  disabled={isBusy}
                />
              </label>
              <label className="field">
                <Text as="span" weight="medium">
                  Temperature
                </Text>
                <TextField.Root
                  type="number"
                  step="0.1"
                  min="0"
                  max="2"
                  value={
                    typeof (draft as LLMData).temperature === "number"
                      ? String((draft as LLMData).temperature)
                      : ""
                  }
                  onChange={(e) => {
                    const v = (e.target as HTMLInputElement).value;
                    update({
                      temperature: v === "" ? undefined : Number(v),
                    } as Partial<LLMData>);
                  }}
                  disabled={isBusy}
                />
                <div className="help">0–2 (empty = provider default)</div>
              </label>
              <label className="field">
                <Text as="span" weight="medium">
                  Max Tokens
                </Text>
                <TextField.Root
                  type="number"
                  min="1"
                  value={
                    typeof (draft as LLMData).maxTokens === "number"
                      ? String((draft as LLMData).maxTokens)
                      : ""
                  }
                  onChange={(e) => {
                    const v = (e.target as HTMLInputElement).value;
                    update({
                      maxTokens: v === "" ? undefined : Number(v),
                    } as Partial<LLMData>);
                  }}
                  disabled={isBusy}
                />
                <div className="help">Empty = model default</div>
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
                  const selected = (
                    (draft as LLMData).mcpServers ?? []
                  ).includes(opt.id);
                  return (
                    <label
                      key={opt.id}
                      style={{ display: "flex", alignItems: "center", gap: 8 }}
                    >
                      <Checkbox
                        checked={selected}
                        onCheckedChange={(checked) => {
                          const current = (draft as LLMData).mcpServers ?? [];
                          const isChecked = Boolean(checked);
                          const next = isChecked
                            ? Array.from(new Set([...current, opt.id]))
                            : current.filter((id) => id !== opt.id);
                          update({ mcpServers: next } as Partial<LLMData>);
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
            onChange={(inp) => update({ inputs: inp } as Partial<LLMData>)}
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
              onChange={(e) =>
                update({ system: e.target.value } as Partial<LLMData>)
              }
              disabled={isBusy}
            />
          </label>
          <label className="field">
            <SchemaEditor
              value={(draft as LLMData).responseSchema}
              onChange={(schema) =>
                update({ responseSchema: schema } as Partial<LLMData>)
              }
            />
            <div className="help">
              Describe the full model response. Output pointers will reference
              paths within this schema.
            </div>
          </label>
          <hr className="divider" />
          <div className="section-title">Outputs (JSON Pointers)</div>
          <LLMOutputPointersEditor
            pointers={(draft as LLMData).outputPointers ?? []}
            onChange={(p) => update({ outputPointers: p } as Partial<LLMData>)}
          />
          <div className="help">
            Each row is a JSON Pointer (RFC 6901) selecting a value from the
            response. Example: <code>/result/summary</code>.
          </div>
        </>
      )}
      {node.type === "entry" && (
        <EntryInputsEditor
          inputs={(draft as any).inputs ?? []}
          onChange={(vals) => update({ inputs: vals } as any)}
        />
      )}
      {node.type === "mcp" && (
        <>
          <label className="field">
            <Text as="span" weight="medium">
              URL
            </Text>
            <TextField.Root
              value={(draft as MCPData).url ?? ""}
              onChange={(e) =>
                update({
                  url: (e.target as HTMLInputElement).value,
                } as Partial<MCPData>)
              }
              disabled={isBusy}
            />
          </label>
          <label className="field">
            <Text as="span" weight="medium">
              Token
            </Text>
            <TextField.Root
              value={(draft as MCPData).token ?? ""}
              onChange={(e) =>
                update({
                  token: (e.target as HTMLInputElement).value,
                } as Partial<MCPData>)
              }
              disabled={isBusy}
            />
          </label>
        </>
      )}
      {node.type === "router" && (
        <ArrayEditor
          label="Branches"
          values={(draft as any).branches ?? []}
          onChange={(vals) => update({ branches: vals } as any)}
          placeholder="branch name"
        />
      )}
      {node.type === "end" && (
        <label className="field">
          <Text as="span" weight="medium">
            Value (preview)
          </Text>
          <TextArea
            rows={3}
            style={{ resize: "vertical" }}
            value={(draft as any).value ?? ""}
            onChange={(e) => update({ value: e.target.value } as any)}
            disabled={isBusy}
          />
        </label>
      )}
    </div>
  );
}

function InputsEditor({
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
    patch: Partial<{ key: string; description: string }>
  ) => {
    const next = list.map((item, idx) =>
      idx === i ? { ...item, ...patch } : item
    );
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
              <IconButton
                type="button"
                color="red"
                variant="soft"
                size="1"
                onClick={() => removeAt(i)}
                aria-label={`Remove input ${i + 1}`}
                disabled={isBusy}
              >
                −
              </IconButton>
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

function EntryInputsEditor({
  inputs,
  onChange,
}: {
  inputs: { key: string; value?: string }[];
  onChange: (v: { key: string; value?: string }[]) => void;
}) {
  const isBusy = useEngineStore((s) => s.activeRunning.size > 0);
  const list = inputs ?? [];
  const setAt = (
    i: number,
    patch: Partial<{ key: string; value?: string }>
  ) => {
    const next = list.map((item, idx) =>
      idx === i ? { ...item, ...patch } : item
    );
    onChange(next);
  };
  const removeAt = (i: number) => onChange(list.filter((_, idx) => idx !== i));
  const add = () => onChange([...(list ?? []), { key: "", value: "" }]);
  return (
    <div className="field">
      <Text as="span" weight="medium">
        Inputs
      </Text>
      <div style={{ display: "grid", gap: 8 }}>
        {list.map((it, i) => (
          <div key={i} style={{ display: "grid", gap: 6 }}>
            <div style={{ display: "flex", gap: 6 }}>
              <TextField.Root
                style={{ width: "40%" }}
                placeholder="key"
                value={it.key ?? ""}
                onChange={(e) =>
                  setAt(i, { key: (e.target as HTMLInputElement).value })
                }
                disabled={isBusy}
              />
              <TextArea
                style={{ flex: 1 }}
                placeholder="value"
                value={it.value ?? ""}
                onChange={(e) => setAt(i, { value: e.target.value })}
                disabled={isBusy}
              />
              <IconButton
                type="button"
                color="red"
                variant="soft"
                size="1"
                onClick={() => removeAt(i)}
                aria-label={`Remove input ${i + 1}`}
                disabled={isBusy}
              >
                −
              </IconButton>
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
        Each input row defines a <b>key</b> and a <b>value</b> passed to
        downstream nodes.
      </div>
    </div>
  );
}
