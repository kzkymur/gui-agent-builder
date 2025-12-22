import type { Edge, Node } from "reactflow";
import type { NodeData } from "../types";
import { logGraphSnapshot } from "./graph";
import { ignite as runEngine } from "./runner";

// Minimal starter to prove wiring. Will evolve into the real executor.
export function ignite(nodes: Node<NodeData>[], edges: Edge[], entryId?: string | null) {
  // Log a structured snapshot and delegate to the engine runner.
  logGraphSnapshot(nodes, edges);
  runEngine(nodes, edges, entryId ?? undefined);
}
