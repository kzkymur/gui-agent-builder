import type { Node } from "reactflow";
import type { NodeData, LLMData, RouterData } from "../types";
import { backendClient } from "./backendClient";

export type EvalResult = { output: unknown };

export async function evalEntry(
  _node: Node<NodeData>,
  input: Record<string, unknown>
): Promise<EvalResult> {
  return { output: input };
}

export async function evalLLM(
  node: Node<NodeData>,
  input: Record<string, unknown>
): Promise<EvalResult> {
  const data = (node.data || {}) as Partial<LLMData>;
  const messages: Array<{ role: "system" | "user"; content: string }> = [];
  if (data.system)
    messages.push({ role: "system", content: String(data.system) });
  // naive synthesis: key: value per line
  const userContent = Object.entries(input || {})
    .map(([k, v]) => `${k}: ${String(v)}`)
    .join("\n");
  messages.push({ role: "user", content: userContent || "" });

  const body: Record<string, unknown> = {
    provider: data.provider,
    model: data.model,
    messages,
    temperature: 0.5,
    max_tokens: 1024,
    retries: 2,
    mcp: { servers: [] },
  };
  console.log(data.responseSchema && typeof data.responseSchema === "object");
  if (data.responseSchema && typeof data.responseSchema === "object") {
    (body as Record<string, unknown>).response_schema = {
      name: "A",
      schema: data.responseSchema as Record<string, unknown>,
    };
  }
  try {
    const res = await backendClient.POST("/llm/invoke", {
      body,
      headers: {
        "x-provider-api-key": import.meta.env.VITE_CLAUDE_API_KEY,
      },
    });
    if (res.error) throw new Error("backend error");
    const payload: unknown = res.data;
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

export async function evalRouter(
  _node: Node<NodeData>,
  input: Record<string, unknown>
): Promise<EvalResult> {
  const text = String((input && (input["text"] ?? input["content"])) ?? "");
  const short = text.length <= 140;
  const selected = short ? ["short"] : ["long"];
  return { output: { selected } };
}

export async function evalEnd(
  _node: Node<NodeData>,
  input: Record<string, unknown>
): Promise<EvalResult> {
  return { output: input };
}
