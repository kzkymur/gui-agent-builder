import type { Edge, Node } from "reactflow";
import type { EntryData, LLMData, NodeData } from "../types";
import { evalEnd, evalEntry, evalLLM, evalSwitch } from "./adapters";
import { useEngineStore } from "./store";
import { appendNodeIO } from "../db/sqlite";

const scheduled = new Set<string>();

function getOutgoing(edges: Edge[], sourceId: string) {
  return edges.filter((e) => e.source === sourceId);
}

function pickLLMOutValue(output: unknown, pointer: string | undefined): unknown {
  if (!pointer) return undefined;
  if (!pointer.startsWith("/")) return undefined;
  try {
    const parts = pointer.split("/").slice(1).map(decodeURIComponent);
    return parts.reduce<unknown>((cur, key) => {
      if (cur == null || typeof cur !== "object") return undefined;
      return (cur as Record<string, unknown>)[key];
    }, output);
  } catch {
    return undefined;
  }
}

function isNodeReady(target: Node<NodeData>, buf: Record<string, unknown>): boolean {
  // Entry nodes don't receive inputs here; Switch requires both gate and signal; LLM requires all declared input keys
  if (target.type === "llm") {
    const cfg = (target.data || {}) as Partial<{
      inputs?: Array<{ key?: string; mode?: "normal" | "optional" | "holding" | "optional_holding" }>;
    }>;
    const inputs = Array.isArray(cfg.inputs) ? cfg.inputs : [];
    if (inputs.length === 0) return true; // nothing to wait for
    return inputs.every((it: { key?: string; mode?: string }, idx: number) => {
      const k = typeof it?.key === "string" && it.key.length ? it.key : `in${idx}`;
      const mode = String(it?.mode ?? "normal");
      const isOptional = mode === "optional" || mode === "optional_holding";
      return isOptional ? true : k in buf;
    });
  }
  if (target.type === "switch") {
    // Require both gate and signal to be present before evaluating
    return "gate" in buf && "signal" in buf;
  }
  // End or others: ready whenever anything arrives
  return true;
}

function isTriggerForKey(target: Node<NodeData>, key: string, indexFallback?: number): boolean {
  if (target.type !== "llm") return true;
  const cfg = (target.data || {}) as Partial<{
    inputs?: Array<{ key?: string; trigger?: boolean }>;
  }>;
  const inputs = Array.isArray(cfg.inputs) ? cfg.inputs : [];
  // Prefer match by key
  const byKey = inputs.find((it) => (it?.key || "") === key);
  if (byKey) return byKey.trigger !== false;
  // Fallback to positional index
  if (typeof indexFallback === "number" && inputs[indexFallback]) {
    return inputs[indexFallback].trigger !== false;
  }
  return true;
}
function isSwitchTriggerForKey(target: Node<NodeData>, key: "gate" | "signal"): boolean {
  const cfg = (target.data || {}) as Partial<{
    inputs?: { gate?: { trigger?: boolean }; signal?: { trigger?: boolean } };
  }>;
  const flag = key === "gate" ? cfg.inputs?.gate?.trigger : cfg.inputs?.signal?.trigger;
  return flag !== false;
}

export function ignite(nodes: Node<NodeData>[], edges: Edge[], entryIds?: string | string[]) {
  const store = useEngineStore.getState();
  store.resetRun();
  const ids: string[] = Array.isArray(entryIds)
    ? entryIds
    : typeof entryIds === "string" && entryIds
      ? [entryIds]
      : nodes.filter((n) => n.type === "entry").map((n) => n.id);
  if (ids.length === 0) {
    // nothing to run; immediately mark as completed
    store.markCompleted(true);
    return;
  }
  for (const id of ids) {
    const node = nodes.find((n) => n.id === id);
    if (!node) continue;
    const data = (node.data || {}) as Partial<EntryData>;
    const pairs = (data.inputs || []).map((it) => [it.key, it.value] as const).filter(([k]) => !!k);
    const input: Record<string, unknown> = Object.fromEntries(pairs);
    store.setInputBuf(id, input);
    store.setLatestInput(id, input);
    const rootTrace = store.traceStart(id);
    // run entry immediately
    scheduleRunNode(nodes, edges, id, rootTrace);
  }
}

function scheduleRunNode(
  nodes: Node<NodeData>[],
  edges: Edge[],
  nodeId: string,
  parentTraceId?: string,
) {
  if (scheduled.has(nodeId)) return;
  scheduled.add(nodeId);
  Promise.resolve().then(() => {
    scheduled.delete(nodeId);
    runNode(nodes, edges, nodeId, parentTraceId).catch(() => {});
  });
}

async function runNode(
  nodes: Node<NodeData>[],
  edges: Edge[],
  nodeId: string,
  parentTraceId?: string,
) {
  const store = useEngineStore.getState();
  const node = nodes.find((n) => n.id === nodeId);
  if (!node) return;
  const traceId = store.traceStart(nodeId, parentTraceId);
  const input = structuredClone(store.inputBufByNode[nodeId] ?? ({} as Record<string, unknown>));
  let output: unknown;
  try {
    // mark node as actively running for UI highlighting
    useEngineStore.getState().addActive(traceId, nodeId);
    if (node.type === "entry") output = (await evalEntry(node, input)).output;
    else if (node.type === "llm") output = (await evalLLM(node, input)).output;
    else if (node.type === "switch") output = (await evalSwitch(node, input)).output;
    else if (node.type === "end") output = (await evalEnd(node, input)).output;
    else output = input;
    useEngineStore.getState().setLatestOutput(nodeId, output);
    useEngineStore.getState().traceFinish(traceId, { output, endedAt: Date.now() });
    // Persist node I/O (node-owned) to SQLite
    try {
      const runId = useEngineStore.getState().run.runId;
      appendNodeIO({ nodeId, runId, traceId, input, output, ts: Date.now() });
    } catch {
      // best-effort; do not block propagation on local persistence errors
    }
  } catch (e: unknown) {
    useEngineStore.getState().traceFinish(traceId, {
      error: String((e as { message?: unknown })?.message || e),
      endedAt: Date.now(),
    });
    // count run-level errors
    useEngineStore.getState().incError();
    return;
  } finally {
    // clear running state regardless of outcome
    useEngineStore.getState().removeActive(traceId);
  }
  // After a successful run, consume non-holding inputs for LLM nodes
  if (node.type === "llm") {
    try {
      const cfg = (node.data || {}) as Partial<{
        inputs?: Array<{ key?: string; mode?: "normal" | "optional" | "holding" | "optional_holding" }>;
      }>;
      const inputs = Array.isArray(cfg.inputs) ? cfg.inputs : [];
      const toConsume: string[] = [];
      inputs.forEach((it, idx) => {
        const mode = String(it?.mode ?? "normal");
        const holding = mode === "holding" || mode === "optional_holding";
        if (!holding) {
          const k = typeof it?.key === "string" && it.key.length ? it.key : `in${idx}`;
          toConsume.push(k);
        }
      });
      if (toConsume.length) useEngineStore.getState().clearInputKeys(nodeId, toConsume);
    } catch {
      // best-effort
    }
  }
  await propagate(nodes, edges, node, traceId, output);

  // After a successful run, consume non-holding inputs for Switch nodes
  if (node.type === "switch") {
    try {
      const cfg = (node.data || {}) as Partial<{
        inputs?: { gate?: { mode?: string }; signal?: { mode?: string } };
      }>;
      const gm = String(cfg.inputs?.gate?.mode ?? "normal");
      const sm = String(cfg.inputs?.signal?.mode ?? "normal");
      const gHolding = gm === "holding" || gm === "optional_holding";
      const sHolding = sm === "holding" || sm === "optional_holding";
      const toConsume: string[] = [];
      if (!gHolding) toConsume.push("gate");
      if (!sHolding) toConsume.push("signal");
      if (toConsume.length) useEngineStore.getState().clearInputKeys(nodeId, toConsume);
    } catch {
      // best-effort
    }
  }
}

async function propagate(
  nodes: Node<NodeData>[],
  edges: Edge[],
  source: Node<NodeData>,
  parentTraceId: string,
  sourceOutput: unknown,
) {
  const outgoing = getOutgoing(edges, source.id);
  const store = useEngineStore.getState();
  for (const e of outgoing) {
    const target = nodes.find((n) => n.id === e.target);
    if (!target) continue;
    const base: Record<string, unknown> = {
      ...(store.inputBufByNode[target.id] || {}),
    };
    let nextInput: Record<string, unknown> = base;
    const debugBeforeKeys = Object.keys(base);
    let changedKey: string | undefined;
    if (source.type === "entry") {
      // Source value: entry's input at the source handle index
      const srcIdx = Number(e.sourceHandle?.replace("out-", ""));
      const sInputs = (source.data as Partial<EntryData>).inputs || [];
      const srcKey = sInputs[srcIdx]?.key;
      const srcLatest = (store.latestInputByNode[source.id] || {}) as Record<string, unknown>;
      const val = srcKey ? srcLatest[srcKey] : undefined;
      // Map to target key when target is LLM using target handle index
      if (target.type === "llm") {
        const inIdx = Number(e.targetHandle?.replace("in-", ""));
        const tKeyRaw = ((target.data as Partial<LLMData>).inputs || [])[inIdx]?.key;
        const tKey = tKeyRaw?.length ? tKeyRaw : `in${inIdx}`;
        nextInput = { ...nextInput, [tKey]: val };
        changedKey = tKey;
      } else if (target.type === "switch") {
        // Route to gate/signal via dedicated target handles later in the generic block
        nextInput = { ...nextInput, value: val };
      } else {
        nextInput = { ...nextInput, value: val };
      }
    } else if (source.type === "llm") {
      const idx = Number(e.sourceHandle?.replace("out-", ""));
      const pointer = ((source.data as Partial<LLMData>).outputPointers || [])[idx];
      const val = pickLLMOutValue(sourceOutput, pointer);
      // Map to the target input key when target is LLM
      if (target.type === "llm") {
        const inIdx = Number(e.targetHandle?.replace("in-", ""));
        const key = ((target.data as Partial<LLMData>).inputs || [])[inIdx]?.key;
        if (key) {
          nextInput = { ...nextInput, [key]: val };
          changedKey = key;
        }
      } else {
        // Non-LLM target: merge raw value
        nextInput = { ...nextInput, value: val };
      }
    } else if (source.type === "switch") {
      const pass = Boolean(
        sourceOutput && typeof sourceOutput === "object"
          ? (sourceOutput as Record<string, unknown>).pass
          : false,
      );
      const outHandle = e.sourceHandle || "";
      if (outHandle === "out-true" && !pass) continue;
      if (outHandle === "out-false" && pass) continue;
      const payload =
        sourceOutput && typeof sourceOutput === "object"
          ? (sourceOutput as Record<string, unknown>).payload
          : undefined;
      // Map to LLM target input key when connected to an LLM
      if (target.type === "llm") {
        const inIdx = Number((e.targetHandle || "").replace("in-", ""));
        const tKeyRaw = ((target.data as Partial<LLMData>).inputs || [])[inIdx]?.key;
        const tKey = tKeyRaw?.length ? tKeyRaw : `in${Number.isFinite(inIdx) ? inIdx : 0}`;
        nextInput = { ...nextInput, [tKey]: payload };
        changedKey = tKey;
      } else {
        nextInput = { ...nextInput, value: payload };
      }
    } else if (source.type === "end") {
      // End has no outputs by spec; skip
      continue;
    }

    // Map by target handle for Switch inputs
    if (target.type === "switch") {
      const tgtHandle = e.targetHandle || "";
      const latestSrc = (store.latestInputByNode[source.id] || {}) as Record<string, unknown>;
      const fromVal = (nextInput as Record<string, unknown>).value ?? latestSrc.value;
      if (tgtHandle === "in-gate") {
        nextInput = { ...nextInput, gate: fromVal };
        changedKey = "gate";
      } else if (tgtHandle === "in-signal") {
        nextInput = { ...nextInput, signal: fromVal };
        changedKey = "signal";
      }
      if ("value" in nextInput) (nextInput as Record<string, unknown>).value = undefined;
    }
    store.setInputBuf(target.id, nextInput);
    store.setLatestInput(target.id, nextInput);
    const shouldTrigger =
      target.type === "llm"
        ? (changedKey ? isTriggerForKey(target, changedKey) : true)
        : target.type === "switch"
          ? (changedKey === "gate" || changedKey === "signal" ? isSwitchTriggerForKey(target, changedKey) : true)
          : true;
    if (shouldTrigger && isNodeReady(target, nextInput)) {
      scheduleRunNode(nodes, edges, target.id, parentTraceId);
    }
  }
}
