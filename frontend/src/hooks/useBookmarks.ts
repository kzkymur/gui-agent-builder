import { useCallback, useEffect, useState } from "react";
import type { Edge, Node } from "reactflow";
import { initDB, loadSettings as dbLoadSettings, saveSetting } from "../db/sqlite";
import { useGraphUI } from "../graph/uiStore";
import type { NodeData } from "../types";

export type BookmarkMeta = { name: string; savedAt: number };

type BookmarkRow = {
  name: unknown;
  savedAt?: unknown;
  nodes?: unknown;
  edges?: unknown;
};

function readAll(): BookmarkRow[] {
  try {
    const all = dbLoadSettings();
    const raw = all.bookmarks ?? "[]";
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as unknown as BookmarkRow[]) : [];
  } catch {
    return [];
  }
}

export function useBookmarks() {
  const [bookmarks, setBookmarks] = useState<BookmarkMeta[]>([]);

  const refresh = useCallback(() => {
    // Ensure DB is initialized before reading settings on fresh page load
    initDB()
      .then(() => {
        const arr = readAll();
        setBookmarks(arr.map((b) => ({ name: String(b.name), savedAt: Number(b.savedAt ?? 0) })));
      })
      .catch(() => setBookmarks([]));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const save = useCallback((name: string, nodes: Node<NodeData>[], edges: Edge[]) => {
    const arr = readAll();
    const snapNodes = nodes.map((n) => ({
      id: n.id,
      type: n.type,
      x: n.position.x,
      y: n.position.y,
      data: n.data,
    }));
    const snapEdges = edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: (e as { sourceHandle?: string | null }).sourceHandle ?? null,
      targetHandle: (e as { targetHandle?: string | null }).targetHandle ?? null,
    }));
    const idx = arr.findIndex((b) => Boolean(b) && b.name === name);
    const entry = { name, nodes: snapNodes, edges: snapEdges, savedAt: Date.now() };
    if (idx >= 0) arr[idx] = entry;
    else arr.push(entry);
    try {
      saveSetting("bookmarks", JSON.stringify(arr));
    } catch {}
    setBookmarks(
      arr.map((b) => ({
        name: String(b.name),
        savedAt: Number((b as { savedAt?: unknown }).savedAt ?? 0),
      })),
    );
  }, []);

  const load = useCallback((name: string): { nodes: Node<NodeData>[]; edges: Edge[] } | null => {
    const arr = readAll();
    const found = arr.find((b) => Boolean(b) && b.name === name);
    if (!found) return null;
    const rawNodes = found.nodes as unknown as
      | Array<{ id: unknown; type: unknown; x: unknown; y: unknown; data?: unknown }>
      | undefined;
    const rawEdges = found.edges as unknown as
      | Array<{
          id: unknown;
          source: unknown;
          target: unknown;
          sourceHandle?: unknown;
          targetHandle?: unknown;
        }>
      | undefined;
    const nodes: Node<NodeData>[] = (rawNodes ?? []).map((x) => ({
      id: String(x.id),
      type: String(x.type),
      position: { x: Number(x.x) || 0, y: Number(x.y) || 0 },
      data: (x.data as Record<string, unknown>) || {},
    }));
    const edges: Edge[] = (rawEdges ?? []).map((x) => ({
      id: String(x.id),
      source: String(x.source),
      target: String(x.target),
      sourceHandle: (x.sourceHandle as string | null | undefined) ?? null,
      targetHandle: (x.targetHandle as string | null | undefined) ?? null,
    }));
    return { nodes, edges };
  }, []);

  // Convenience helpers that operate against graph UI store directly
  const saveCurrent = useCallback(
    (name: string) => {
      const s = useGraphUI.getState();
      save(name, s.nodes, s.edges);
    },
    [save],
  );

  const loadApply = useCallback(
    (name: string) => {
      const res = load(name);
      if (!res) return false;
      try {
        const ui = useGraphUI.getState();
        ui.setNodes(res.nodes);
        ui.setEdges(res.edges);
      } catch {}
      return true;
    },
    [load],
  );

  return { bookmarks, refresh, save, load, saveCurrent, loadApply } as const;
}
