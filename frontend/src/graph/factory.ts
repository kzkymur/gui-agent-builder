import type { Node } from "reactflow";
import defaults from "../default.json";
import type { NodeData } from "../types";

export type NewNodeType = "entry" | "llm" | "switch" | "mcp" | "fs" | "end";

export function makeDefaultNode(type: NewNodeType, idx: number): Node<NodeData> {
  const id = `${type}-${Date.now()}`;
  const base = {
    id,
    type,
    position: { x: 120 + idx * 30, y: 120 + idx * 20 },
  } as const;
  switch (type) {
    case "entry":
      return {
        ...base,
        data: { name: "Entry", inputs: [{ key: "user_input", value: "" }] },
      } as unknown as Node<NodeData>;
    case "llm":
      return {
        ...base,
        data: {
          name: "LLM",
          responseSchema: (defaults.llm as { responseSchema?: unknown } | undefined)
            ?.responseSchema,
          outputPointers: (defaults.llm as { outputPointers?: string[] } | undefined)
            ?.outputPointers,
        },
      } as unknown as Node<NodeData>;
    case "switch":
      return {
        ...base,
        data: { name: "Switch", threshold: 0.5 },
      } as unknown as Node<NodeData>;
    case "mcp":
      return {
        ...base,
        data: { name: "MCP", url: "http://localhost:9000" },
      } as unknown as Node<NodeData>;
    case "fs":
      return {
        ...base,
        data: { name: "Filesystem" },
      } as unknown as Node<NodeData>;
    default:
      return { ...base, data: { name: "End" } } as unknown as Node<NodeData>;
  }
}
