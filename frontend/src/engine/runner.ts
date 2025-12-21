import type { Edge, Node } from "reactflow";
import type { EntryData, LLMData, NodeData } from "../types";
import { evalEnd, evalEntry, evalLLM, evalRouter } from "./adapters";
import { useEngineStore } from "./store";

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
  useEngineStore.getState().traceFinish(traceId, { input });
  let output: unknown;
  try {
    // mark node as actively running for UI highlighting
    useEngineStore.getState().addActive(traceId, nodeId);
    if (node.type === "entry") output = (await evalEntry(node, input)).output;
    else if (node.type === "llm") output = (await evalLLM(node, input)).output;
    else if (node.type === "router") output = (await evalRouter(node, input)).output;
    else if (node.type === "end") output = (await evalEnd(node, input)).output;
    else output = input;
    useEngineStore.getState().setLatestOutput(nodeId, output);
    useEngineStore.getState().traceFinish(traceId, { output, endedAt: Date.now() });
  } catch (e: any) {
    useEngineStore.getState().traceFinish(traceId, {
      error: String(e?.message || e),
      endedAt: Date.now(),
    });
    // count run-level errors
    useEngineStore.getState().incError();
    return;
  } finally {
    // clear running state regardless of outcome
    useEngineStore.getState().removeActive(traceId);
  }
  await propagate(nodes, edges, node, traceId, output);
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
    if (source.type === "entry") {
      // value is the entry input for the corresponding key
      const idx = Number(e.sourceHandle?.replace("out-", ""));
      const inputs = (source.data as Partial<EntryData>).inputs || [];
      const key = inputs[idx]?.key;
      const srcLatest = store.latestInputByNode[source.id] || {};
      if (key) nextInput = { ...nextInput, [key]: srcLatest[key] };
    } else if (source.type === "llm") {
      const idx = Number(e.sourceHandle?.replace("out-", ""));
      const pointer = ((source.data as Partial<LLMData>).outputPointers || [])[idx];
      const val = pickLLMOutValue(sourceOutput, pointer);
      // Map to the target input key when target is LLM
      if (target.type === "llm") {
        const inIdx = Number(e.targetHandle?.replace("in-", ""));
        const key = ((target.data as Partial<LLMData>).inputs || [])[inIdx]?.key;
        if (key) nextInput = { ...nextInput, [key]: val };
      } else {
        // Non-LLM target: merge raw value
        nextInput = { ...nextInput, value: val };
      }
    } else if (source.type === "router") {
      const handle = e.sourceHandle || "";
      const branch = handle.startsWith("br-") ? handle.substring(3) : "";
      const sel =
        sourceOutput && typeof sourceOutput === "object"
          ? (sourceOutput as Record<string, unknown>)["selected"]
          : undefined;
      const selected = Array.isArray(sel) ? sel.map(String) : [];
      if (selected.includes(String(branch))) {
        // forward the current input unchanged
        nextInput = {
          ...nextInput,
          ...(store.latestInputByNode[source.id] || {}),
        };
      } else {
        continue; // skip edge if branch not selected
      }
    } else if (source.type === "end") {
      // End has no outputs by spec; skip
      continue;
    }
    store.setInputBuf(target.id, nextInput);
    store.setLatestInput(target.id, nextInput);
    scheduleRunNode(nodes, edges, target.id, parentTraceId);
  }
}
