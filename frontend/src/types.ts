import type { NodeProps } from 'reactflow';

export type EntryData = {
  name: string;
  inputs: string[];
};

export type LLMData = {
  name: string;
  provider: string;
  model: string;
  system?: string;
  // IDs of MCP nodes this LLM can call
  mcpServers?: string[];
  // JSON Schema object describing the expected response shape
  responseSchema?: unknown;
  // List of JSON Pointers (RFC 6901) selecting outputs from the response
  outputPointers?: string[];
};

export type RouterData = {
  name: string;
  branches: string[];
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

export type NodeData = Partial<EntryData & LLMData & RouterData & MCPData & EndData> & { name?: string };

export type RFNodeProps<T extends NodeData> = NodeProps<T>;
