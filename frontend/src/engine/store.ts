import create from "zustand";

export type TraceNode = {
  id: string;
  nodeId: string;
  parentId?: string;
  startedAt: number;
  endedAt?: number;
  input?: unknown;
  output?: unknown;
  error?: string;
  children: string[];
};

export type RunState = {
  runId: string;
  status: "idle" | "running" | "completed" | "failed" | "cancelled";
  startedAt?: number;
  endedAt?: number;
  errorCount: number;
};

export type EngineState = {
  run: RunState;
  // activationId -> { nodeId, startedAt }
  activeRunning: Map<string, { nodeId: string; startedAt: number }>;
  inputBufByNode: Record<string, Record<string, unknown>>;
  latestInputByNode: Record<string, Record<string, unknown> | undefined>;
  latestOutputByNode: Record<string, unknown>;
  trace: { nodes: Record<string, TraceNode>; roots: string[] };
  tokenUsageTotal: number;
  // actions
  resetRun: (runId?: string) => void;
  addActive: (activationId: string, nodeId: string) => void;
  removeActive: (activationId: string) => void;
  traceStart: (nodeId: string, parentId?: string) => string;
  traceFinish: (
    traceId: string,
    patch: Partial<Pick<TraceNode, "endedAt" | "output" | "error">>,
  ) => void;
  setInputBuf: (nodeId: string, input: Record<string, unknown>) => void;
  setLatestInput: (nodeId: string, input: Record<string, unknown>) => void;
  setLatestOutput: (nodeId: string, output: unknown) => void;
  markCompleted: (ok: boolean) => void;
  incError: () => void;
  addUsage: (usage: any) => void;
};

export const useEngineStore = create<EngineState>((set) => ({
  run: { runId: "", status: "idle", errorCount: 0 },
  activeRunning: new Map(),
  inputBufByNode: {},
  latestInputByNode: {},
  latestOutputByNode: {},
  trace: { nodes: {}, roots: [] },
  tokenUsageTotal: 0,
  resetRun: (runId) =>
    set(() => ({
      run: {
        runId: runId ?? String(Date.now()),
        status: "running",
        startedAt: Date.now(),
        errorCount: 0,
      },
      activeRunning: new Map(),
      inputBufByNode: {},
      latestInputByNode: {},
      latestOutputByNode: {},
      trace: { nodes: {}, roots: [] },
      tokenUsageTotal: 0,
    })),
  addActive: (activationId, nodeId) =>
    set((s) => {
      const next = new Map(s.activeRunning);
      next.set(activationId, { nodeId, startedAt: Date.now() });
      return { activeRunning: next } as Partial<EngineState>;
    }),
  removeActive: (activationId) =>
    set((s) => {
      if (!s.activeRunning.has(activationId)) return {} as Partial<EngineState>;
      const next = new Map(s.activeRunning);
      next.delete(activationId);
      const base: Partial<EngineState> = { activeRunning: next };
      if (next.size === 0 && s.run.status === "running") {
        const ok = (s.run.errorCount ?? 0) === 0;
        return {
          ...base,
          run: { ...s.run, status: ok ? "completed" : "failed", endedAt: Date.now() },
        } as Partial<EngineState>;
      }
      return base as Partial<EngineState>;
    }),
  traceStart: (nodeId, parentId) => {
    const id = `${nodeId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    set((s) => {
      const nodes = { ...s.trace.nodes };
      nodes[id] = { id, nodeId, parentId, startedAt: Date.now(), children: [] };
      const roots = parentId ? s.trace.roots.slice() : [...s.trace.roots, id];
      if (parentId && nodes[parentId])
        nodes[parentId] = { ...nodes[parentId], children: [...nodes[parentId].children, id] };
      return { trace: { nodes, roots } } as Partial<EngineState>;
    });
    return id;
  },
  traceFinish: (traceId, patch) =>
    set((s) => {
      const node = s.trace.nodes[traceId];
      if (!node) return {} as Partial<EngineState>;
      return {
        trace: {
          nodes: { ...s.trace.nodes, [traceId]: { ...node, ...patch } },
          roots: s.trace.roots,
        },
      } as Partial<EngineState>;
    }),
  setInputBuf: (nodeId, input) =>
    set((s) => {
      const prev = s.inputBufByNode[nodeId] || {};
      return { inputBufByNode: { ...s.inputBufByNode, [nodeId]: { ...prev, ...input } } } as Partial<EngineState>;
    }),
  setLatestInput: (nodeId, input) =>
    set((s) => ({ latestInputByNode: { ...s.latestInputByNode, [nodeId]: input } })),
  setLatestOutput: (nodeId, output) =>
    set((s) => ({ latestOutputByNode: { ...s.latestOutputByNode, [nodeId]: output } })),
  markCompleted: (ok) =>
    set((s) => ({ run: { ...s.run, status: ok ? "completed" : "failed", endedAt: Date.now() } })),
  incError: () => set((s) => ({ run: { ...s.run, errorCount: s.run.errorCount + 1 } })),
  addUsage: (usage) =>
    set((s) => {
      try {
        if (!usage || typeof usage !== "object") return {} as Partial<EngineState>;
        const u = usage as any;
        const total = (() => {
          if (typeof u.total_tokens === "number") return u.total_tokens;
          // OpenAI-style legacy
          if (
            typeof u.prompt_tokens === "number" ||
            typeof u.completion_tokens === "number"
          ) {
            return Number(u.prompt_tokens || 0) + Number(u.completion_tokens || 0);
          }
          // Newer input/output naming
          if (
            typeof u.input_tokens === "number" ||
            typeof u.output_tokens === "number"
          ) {
            return Number(u.input_tokens || 0) + Number(u.output_tokens || 0);
          }
          return NaN;
        })();
        if (!Number.isFinite(total)) return {} as Partial<EngineState>;
        return { tokenUsageTotal: (s.tokenUsageTotal || 0) + total } as Partial<EngineState>;
      } catch {
        return {} as Partial<EngineState>;
      }
    }),
}));
