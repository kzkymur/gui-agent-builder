import type { Node } from "reactflow";
import type { LLMData, NodeData } from "../types";
import { getBackendClient } from "./backendClient";
import { getApiKey } from "./settings";
import { useEngineStore } from "./store";

export type EvalResult = { output: unknown };

export async function evalEntry(
  _node: Node<NodeData>,
  input: Record<string, unknown>,
): Promise<EvalResult> {
  return { output: input };
}

export async function evalLLM(
  node: Node<NodeData>,
  input: Record<string, unknown>,
): Promise<EvalResult> {
  const data = (node.data || {}) as Partial<LLMData>;
  const messages: Array<{ role: "system" | "user"; content: string }> = [];
  if (data.system) messages.push({ role: "system", content: String(data.system) });
  // naive synthesis: key: value per line (JSON-stringify objects)
  const userContent = Object.entries(input || {})
    .map(([k, v]) => {
      let sv: string;
      if (v == null) sv = "";
      else if (typeof v === "string") sv = v;
      else if (typeof v === "number" || typeof v === "boolean") sv = String(v);
      else {
        try {
          sv = JSON.stringify(v);
        } catch {
          sv = String(v);
        }
      }
      return `${k}: ${sv}`;
    })
    .join("\n");
  messages.push({ role: "user", content: userContent || "" });

  const t =
    typeof data.temperature === "number" ? Math.max(0, Math.min(1, data.temperature)) : undefined;
  const body = {
    provider: String(data.provider ?? ""),
    model: String(data.model ?? ""),
    messages,
    response_schema:
      data.responseSchema && typeof data.responseSchema === "object"
        ? (data.responseSchema as Record<string, unknown>)
        : null,
    temperature: typeof t === "number" ? t : null,
    max_tokens: typeof data.maxTokens === "number" ? data.maxTokens : null,
    retries: 2,
    mcp: null as { [key: string]: unknown } | null,
  } satisfies import("./__generated__/backend").components["schemas"]["InvokeRequest"];
  // response_schema assigned via body initializer when provided
  try {
    const res = await getBackendClient().POST("/llm/invoke", {
      body,
      headers: {
        "x-provider-api-key": getApiKey(String(data.provider)) || "",
      },
    });
    if (res.error) throw new Error("backend error");
    const payload: unknown = res.data as unknown;
    try {
      const usage =
        payload && typeof payload === "object"
          ? ((payload as { usage?: unknown }).usage ??
            (payload as { raw?: { token_usage?: unknown } }).raw?.token_usage)
          : undefined;
      if (usage && typeof usage === "object") useEngineStore.getState().addUsage(usage);
    } catch {}
    if (
      payload &&
      typeof payload === "object" &&
      "output" in (payload as Record<string, unknown>)
    ) {
      return { output: (payload as { output: unknown }).output };
    }
    return { output: payload };
  } catch (_e) {
    // Fallback in dev without backend
    return { output: { echo: input } as Record<string, unknown> };
  }
}

export async function evalSwitch(
  node: Node<NodeData>,
  input: Record<string, unknown>,
): Promise<EvalResult> {
  const data = (node.data || {}) as Partial<NodeData>;
  const thresh: number = typeof data.threshold === "number" ? data.threshold : 0.5;
  const gateRaw = (input as { gate?: unknown })?.gate;
  let gateNum: number;
  if (typeof gateRaw === "boolean") gateNum = gateRaw ? 1 : 0;
  else if (typeof gateRaw === "number" && Number.isFinite(gateRaw)) gateNum = gateRaw;
  else gateNum = Number.NaN;
  const pass = Number.isFinite(gateNum) ? gateNum >= thresh : false;
  const payload = (input as { signal?: unknown })?.signal;
  return { output: { pass, payload } };
}

export async function evalEnd(
  _node: Node<NodeData>,
  input: Record<string, unknown>,
): Promise<EvalResult> {
  return { output: input };
}
