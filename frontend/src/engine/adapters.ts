import type { Node } from "reactflow";
import type { LLMData, NodeData } from "../types";
import { backendClient } from "./backendClient";
import { useEngineStore } from "./store";
import { getApiKey } from "./settings";

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
  // naive synthesis: key: value per line
  const userContent = Object.entries(input || {})
    .map(([k, v]) => `${k}: ${String(v)}`)
    .join("\n");
  messages.push({ role: "user", content: userContent || "" });

  const t =
    typeof data.temperature === "number"
      ? Math.max(0, Math.min(1, data.temperature))
      : undefined;
  const body: Record<string, unknown> = {
    provider: data.provider,
    model: data.model,
    messages,
    temperature: typeof t === "number" ? t : undefined,
    max_tokens: typeof data.maxTokens === "number" ? data.maxTokens : undefined,
    retries: 2,
    mcp: { servers: [] },
  };
  console.log(data.responseSchema && typeof data.responseSchema === "object");
  if (data.responseSchema && typeof data.responseSchema === "object") {
    (body as Record<string, unknown>).response_schema = data.responseSchema as Record<
      string,
      unknown
    >;
  }
  try {
    const res = await backendClient.POST("/llm/invoke", {
      body,
      headers: {
        "x-provider-api-key": getApiKey(String(data.provider)) || (import.meta as any).env?.VITE_CLAUDE_API_KEY,
      },
    });
    if (res.error) throw new Error("backend error");
    const payload: unknown = res.data;
    try {
      const usage = (payload as any)?.usage;
      if (usage) useEngineStore.getState().addUsage(usage);
    } catch {}
    if (
      payload &&
      typeof payload === "object" &&
      "output" in (payload as Record<string, unknown>)
    ) {
      return { output: (payload as Record<string, unknown>).output };
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
  const data = (node.data || {}) as any;
  const thresh: number = typeof data.threshold === "number" ? data.threshold : 0.5;
  const gateRaw = (input || {})["gate"] as any;
  let gateNum: number;
  if (typeof gateRaw === "boolean") gateNum = gateRaw ? 1 : 0;
  else if (typeof gateRaw === "number" && Number.isFinite(gateRaw)) gateNum = gateRaw;
  else gateNum = NaN;
  const pass = Number.isFinite(gateNum) ? gateNum >= thresh : false;
  const payload = (input || {})["signal"];
  return { output: { pass, payload } };
}

export async function evalEnd(
  _node: Node<NodeData>,
  input: Record<string, unknown>,
): Promise<EvalResult> {
  return { output: input };
}
