import { useCallback, useEffect, useState } from "react";
import type { Edge, Node } from "reactflow";
import type { NodeData } from "../types";
import { loadSettings as dbLoadSettings, saveSetting } from "../db/sqlite";
import { useGraphUI } from "../graph/uiStore";

export type BookmarkMeta = { name: string; savedAt: number };

function readAll(): any[] {
  try {
    const all = dbLoadSettings();
    const raw = all["bookmarks"] ?? "[]";
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function useBookmarks() {
  const [bookmarks, setBookmarks] = useState<BookmarkMeta[]>([]);

  const refresh = useCallback(() => {
    const arr = readAll();
    setBookmarks(arr.map((b: any) => ({ name: String(b.name), savedAt: Number(b.savedAt || 0) })));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const save = useCallback((name: string, nodes: Node<NodeData>[], edges: Edge[]) => {
    const arr = readAll();
    const snapNodes = nodes.map((n) => ({ id: n.id, type: n.type, x: n.position.x, y: n.position.y, data: n.data }));
    const snapEdges = edges.map((e) => ({ id: e.id, source: e.source, target: e.target, sourceHandle: (e as any).sourceHandle ?? null, targetHandle: (e as any).targetHandle ?? null }));
    const idx = arr.findIndex((b) => b && b.name === name);
    const entry = { name, nodes: snapNodes, edges: snapEdges, savedAt: Date.now() };
    if (idx >= 0) arr[idx] = entry; else arr.push(entry);
    try { saveSetting("bookmarks", JSON.stringify(arr)); } catch {}
    setBookmarks(arr.map((b: any) => ({ name: b.name, savedAt: b.savedAt })));
  }, []);

  const load = useCallback((name: string): { nodes: Node<NodeData>[]; edges: Edge[] } | null => {
    const arr = readAll();
    const found = arr.find((b: any) => b && b.name === name);
    if (!found) return null;
    const nodes = (found.nodes || []).map((x: any) => ({ id: String(x.id), type: String(x.type), position: { x: Number(x.x) || 0, y: Number(x.y) || 0 }, data: x.data || {} }));
    const edges = (found.edges || []).map((x: any) => ({ id: String(x.id), source: String(x.source), target: String(x.target), sourceHandle: x.sourceHandle ?? null, targetHandle: x.targetHandle ?? null }));
    return { nodes, edges } as any;
  }, []);

  // Convenience helpers that operate against graph UI store directly
  const saveCurrent = useCallback((name: string) => {
    const s = useGraphUI.getState();
    save(name, s.nodes as any, s.edges as any);
  }, [save]);

  const loadApply = useCallback((name: string) => {
    const res = load(name);
    if (!res) return false;
    try {
      const ui = useGraphUI.getState();
      ui.setNodes(res.nodes as any);
      ui.setEdges(res.edges as any);
    } catch {}
    return true;
  }, [load]);

  return { bookmarks, refresh, save, load, saveCurrent, loadApply } as const;
}
