import type { Edge, Node } from 'reactflow';
import type { NodeData } from '../types';
import { logGraphSnapshot } from './graph';

// Minimal starter to prove wiring. Will evolve into the real executor.
export function ignite(nodes: Node<NodeData>[], edges: Edge[], entryId?: string | null) {
  // For now, just log a structured snapshot and the chosen entry.
  // eslint-disable-next-line no-console
  console.log('[LLM-Flow] Ignite', { entryId: entryId ?? null });
  logGraphSnapshot(nodes, edges);
}

