import initSqlJs, { Database, SqlJsStatic } from 'sql.js';
import wasmUrl from 'sql.js/dist/sql-wasm.wasm?url';

const LS_KEY = 'llmflow_db_v1';

let SQL: SqlJsStatic | null = null;
let DB: Database | null = null;

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function bytesToBase64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

export async function initDB(): Promise<Database> {
  if (DB) return DB;
  SQL = await initSqlJs({ locateFile: () => wasmUrl });
  const saved = localStorage.getItem(LS_KEY);
  DB = saved ? new SQL.Database(base64ToBytes(saved)) : new SQL.Database();
  ensureSchema(DB);
  return DB;
}

export function exportAndPersist(): void {
  if (!DB) return;
  const data = DB.export();
  localStorage.setItem(LS_KEY, bytesToBase64(data));
}

function ensureSchema(db: Database) {
  const [[userVersion]] = db.exec('PRAGMA user_version')?.[0]?.values ?? [[0]];
  const v = Number(userVersion ?? 0);
  if (v < 1) {
    db.exec(`
      BEGIN;
      CREATE TABLE IF NOT EXISTS nodes (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        x REAL,
        y REAL,
        data TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS edges (
        id TEXT PRIMARY KEY,
        source TEXT NOT NULL,
        target TEXT NOT NULL,
        sourceHandle TEXT,
        targetHandle TEXT
      );
      PRAGMA user_version = 1;
      COMMIT;
    `);
  }
  // v2: add handle columns to edges if upgrading from an older DB
  if (v < 2) {
    db.exec(`
      BEGIN;
      ALTER TABLE edges ADD COLUMN sourceHandle TEXT;
      ALTER TABLE edges ADD COLUMN targetHandle TEXT;
      PRAGMA user_version = 2;
      COMMIT;
    `);
  }
}

export type PersistNode = { id: string; type: string; x: number; y: number; data: unknown };
export type PersistEdge = { id: string; source: string; target: string; sourceHandle?: string | null; targetHandle?: string | null };

export function loadGraph(): { nodes: PersistNode[]; edges: PersistEdge[] } {
  if (!DB) throw new Error('DB not initialized');
  const nodes: PersistNode[] = [];
  const edges: PersistEdge[] = [];
  const nRes = DB.exec('SELECT id, type, x, y, data FROM nodes');
  if (nRes.length) {
    const rows = nRes[0].values;
    for (const [id, type, x, y, data] of rows) {
      nodes.push({ id: String(id), type: String(type), x: Number(x), y: Number(y), data: JSON.parse(String(data)) });
    }
  }
  const eRes = DB.exec('SELECT id, source, target, sourceHandle, targetHandle FROM edges');
  if (eRes.length) {
    const rows = eRes[0].values;
    for (const [id, source, target, sourceHandle, targetHandle] of rows) {
      edges.push({ id: String(id), source: String(source), target: String(target), sourceHandle: sourceHandle as string | null, targetHandle: targetHandle as string | null });
    }
  }
  return { nodes, edges };
}

export function saveGraph(nodes: PersistNode[], edges: PersistEdge[]) {
  if (!DB) throw new Error('DB not initialized');
  DB.exec('BEGIN');
  DB.exec('DELETE FROM nodes');
  DB.exec('DELETE FROM edges');

  const nStmt = DB.prepare('INSERT INTO nodes (id, type, x, y, data) VALUES (?, ?, ?, ?, ?)');
  for (const n of nodes) {
    nStmt.run([n.id, n.type, n.x, n.y, JSON.stringify(n.data ?? {})]);
  }
  nStmt.free();

  const eStmt = DB.prepare('INSERT INTO edges (id, source, target, sourceHandle, targetHandle) VALUES (?, ?, ?, ?, ?)');
  for (const e of edges) {
    eStmt.run([e.id, e.source, e.target, e.sourceHandle ?? null, e.targetHandle ?? null]);
  }
  eStmt.free();

  DB.exec('COMMIT');
  exportAndPersist();
}
