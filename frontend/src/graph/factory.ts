import type { Node } from "reactflow";
import type { NodeData } from "../types";
import defaults from "../default.json";

export type NewNodeType = "entry" | "llm" | "switch" | "mcp" | "end";

export function makeDefaultNode(type: NewNodeType, idx: number): Node<NodeData> {
  const id = `${type}-${Date.now()}`;
  const base = {
    id,
    type,
    position: { x: 120 + idx * 30, y: 120 + idx * 20 },
  } as const;
  switch (type) {
    case "entry":
      return { ...base, data: { name: "Entry", inputs: [{ key: "user_input", value: "" }] } } as any;
    case "llm":
      return {
        ...base,
        data: {
          name: "LLM",
          responseSchema: (defaults as any)?.llm?.responseSchema,
          outputPointers: (defaults as any)?.llm?.outputPointers,
        },
      } as any;
    case "switch":
      return {
        ...base,
        data: { name: "Switch", threshold: 0.5 },
      } as any;
    case "mcp":
      return { ...base, data: { name: "MCP", url: "http://localhost:9000" } } as any;
    case "end":
    default:
      return { ...base, data: { name: "End" } } as any;
  }
}
