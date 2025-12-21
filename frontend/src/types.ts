import type { NodeProps } from "reactflow";

export type EntryData = {
  name: string;
  // Entry node collects user-provided inputs: key + value
  inputs: { key: string; value?: string }[];
};

// One input handle is composed by two properties: key and description.
export type LLMInput = {
  key: string;
  description: string;
};

export type LLMData = {
  name: string;
  provider: string;
  model: string;
  system?: string;
  // LLM generation controls (optional)
  temperature?: number;
  maxTokens?: number;
  // IDs of MCP nodes this LLM can call
  mcpServers?: string[];
  // JSON Schema object describing the expected response shape
  responseSchema?: unknown;
  // List of JSON Pointers (RFC 6901) selecting outputs from the response
  outputPointers?: string[];
  // Inputs (one handle per item): key + description only.
  inputs?: LLMInput[];
};

export type SwitchData = {
  name: string;
  // Two-input gate: numeric/boolean 'gate' controls whether 'signal' passes through.
  // Gate is coerced to a number (false→0, true→1). Passes when gate >= threshold.
  threshold?: number; // default 0.5, range 0..1
};

export type MCPData = {
  name: string;
  url: string;
  token?: string;
};

export type EndData = {
  name: string;
  // UI-only for now: shown in footer to represent terminal value
  value?: string;
};

export type NodeData = Partial<EntryData & LLMData & SwitchData & MCPData & EndData> & {
  name?: string;
};

export type RFNodeProps<T extends NodeData> = NodeProps<T>;
