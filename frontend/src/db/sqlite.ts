import initSqlJs from "sql.js";
import wasmUrl from "sql.js/dist/sql-wasm.wasm?url";

const LS_KEY = "llmflow_db_v1";

type SqlStatement = { run(params: unknown[]): void; free(): void };
type SqlExecRowset = { values: unknown[][] };
type SqlDatabase = {
  exec(sql: string): SqlExecRowset[];
  prepare(sql: string): SqlStatement;
  export(): Uint8Array;
};
type SqlJsModule = { Database: new (data?: Uint8Array) => SqlDatabase };

let SQL: SqlJsModule | null = null;
let DB: SqlDatabase | null = null;

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function bytesToBase64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

export async function initDB(): Promise<SqlDatabase> {
  if (DB) return DB;
  SQL = (await initSqlJs({ locateFile: () => wasmUrl })) as unknown as SqlJsModule;
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

function ensureSchema(db: SqlDatabase) {
  const [[userVersion]] = db.exec("PRAGMA user_version")?.[0]?.values ?? [[0]];
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
  // v3: settings table for user preferences and secrets (e.g., API keys)
  if (v < 3) {
    db.exec(`
      BEGIN;
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT
      );
      PRAGMA user_version = 3;
      COMMIT;
    `);
  }
  // v4: per-node I/O persistence
  if (v < 4) {
    db.exec(`
      BEGIN;
      CREATE TABLE IF NOT EXISTS node_io (
        id INTEGER PRIMARY KEY,
        nodeId TEXT NOT NULL,
        runId TEXT,
        traceId TEXT,
        input TEXT,
        output TEXT,
        ts INTEGER
      );
      CREATE INDEX IF NOT EXISTS idx_node_io_node_ts ON node_io(nodeId, ts);
      PRAGMA user_version = 4;
      COMMIT;
    `);
  }
}

export type PersistNode = { id: string; type: string; x: number; y: number; data: unknown };
export type PersistEdge = {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
};

export function loadGraph(): { nodes: PersistNode[]; edges: PersistEdge[] } {
  if (!DB) throw new Error("DB not initialized");
  const nodes: PersistNode[] = [];
  const edges: PersistEdge[] = [];
  const nRes = DB.exec("SELECT id, type, x, y, data FROM nodes");
  if (nRes.length) {
    const rows = nRes[0].values;
    for (const [id, type, x, y, data] of rows) {
      nodes.push({
        id: String(id),
        type: String(type),
        x: Number(x),
        y: Number(y),
        data: JSON.parse(String(data)),
      });
    }
  }
  const eRes = DB.exec("SELECT id, source, target, sourceHandle, targetHandle FROM edges");
  if (eRes.length) {
    const rows = eRes[0].values;
    for (const [id, source, target, sourceHandle, targetHandle] of rows) {
      edges.push({
        id: String(id),
        source: String(source),
        target: String(target),
        sourceHandle: sourceHandle as string | null,
        targetHandle: targetHandle as string | null,
      });
    }
  }
  return { nodes, edges };
}

export function saveGraph(nodes: PersistNode[], edges: PersistEdge[]) {
  if (!DB) throw new Error("DB not initialized");
  DB.exec("BEGIN");
  DB.exec("DELETE FROM nodes");
  DB.exec("DELETE FROM edges");

  const nStmt = DB.prepare("INSERT INTO nodes (id, type, x, y, data) VALUES (?, ?, ?, ?, ?)");
  for (const n of nodes) {
    nStmt.run([n.id, n.type, n.x, n.y, JSON.stringify(n.data ?? {})]);
  }
  nStmt.free();

  const eStmt = DB.prepare(
    "INSERT INTO edges (id, source, target, sourceHandle, targetHandle) VALUES (?, ?, ?, ?, ?)",
  );
  for (const e of edges) {
    eStmt.run([e.id, e.source, e.target, e.sourceHandle ?? null, e.targetHandle ?? null]);
  }
  eStmt.free();

  DB.exec("COMMIT");
  exportAndPersist();
}

export function loadSettings(): Record<string, string> {
  if (!DB) throw new Error("DB not initialized");
  const res = DB.exec("SELECT key, value FROM settings");
  const out: Record<string, string> = {};
  if (res.length) {
    for (const [k, v] of res[0].values) {
      out[String(k)] = String(v ?? "");
    }
  }
  return out;
}

export function saveSetting(key: string, value: string): void {
  if (!DB) throw new Error("DB not initialized");
  const stmt = DB.prepare(
    "INSERT INTO settings(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
  );
  stmt.run([key, value]);
  stmt.free();
  exportAndPersist();
}

export type NodeIORecord = {
  id?: number;
  nodeId: string;
  runId?: string;
  traceId?: string;
  input?: unknown;
  output?: unknown;
  ts?: number;
};

export function appendNodeIO(rec: NodeIORecord): void {
  if (!DB) throw new Error("DB not initialized");
  const stmt = DB.prepare(
    "INSERT INTO node_io(nodeId, runId, traceId, input, output, ts) VALUES(?, ?, ?, ?, ?, ?)",
  );
  const ts = typeof rec.ts === "number" ? rec.ts : Date.now();
  stmt.run([
    rec.nodeId,
    rec.runId ?? null,
    rec.traceId ?? null,
    rec.input == null ? null : JSON.stringify(rec.input),
    rec.output == null ? null : JSON.stringify(rec.output),
    ts,
  ]);
  stmt.free();
  exportAndPersist();
}

export function loadLatestNodeIO(nodeId: string): NodeIORecord | undefined {
  if (!DB) throw new Error("DB not initialized");
  const res = DB.exec(
    `SELECT id, nodeId, runId, traceId, input, output, ts FROM node_io WHERE nodeId = '${nodeId.replaceAll("'","''")}' ORDER BY ts DESC LIMIT 1`,
  );
  if (!res.length || !res[0].values.length) return undefined;
  const [id, nId, runId, traceId, input, output, ts] = res[0].values[0];
  const parse = (s: unknown) => {
    if (typeof s !== "string" || !s.length) return undefined;
    try {
      return JSON.parse(s);
    } catch {
      return undefined;
    }
  };
  return {
    id: Number(id),
    nodeId: String(nId),
    runId: runId ? String(runId) : undefined,
    traceId: traceId ? String(traceId) : undefined,
    input: parse(input),
    output: parse(output),
    ts: Number(ts),
  };
}

export function listNodeIO(nodeId: string, limit = 50): NodeIORecord[] {
  if (!DB) throw new Error("DB not initialized");
  const safeId = nodeId.replaceAll("'", "''");
  const res = DB.exec(
    `SELECT id, nodeId, runId, traceId, input, output, ts FROM node_io WHERE nodeId='${safeId}' ORDER BY ts ASC LIMIT ${Math.max(1, Math.min(500, limit))}`,
  );
  if (!res.length) return [];
  const rows = res[0].values;
  const parse = (s: unknown) => {
    if (typeof s !== "string" || !s.length) return undefined;
    try {
      return JSON.parse(s);
    } catch {
      return undefined;
    }
  };
  return rows.map(([id, nId, runId, traceId, input, output, ts]) => ({
    id: Number(id),
    nodeId: String(nId),
    runId: runId ? String(runId) : undefined,
    traceId: traceId ? String(traceId) : undefined,
    input: parse(input),
    output: parse(output),
    ts: Number(ts),
  }));
}

export function clearNodeIO(nodeId: string): void {
  if (!DB) throw new Error("DB not initialized");
  const stmt = DB.prepare("DELETE FROM node_io WHERE nodeId = ?");
  stmt.run([nodeId]);
  stmt.free();
  exportAndPersist();
}

export function clearAllNodeIO(): void {
  if (!DB) throw new Error("DB not initialized");
  DB.exec("DELETE FROM node_io");
  exportAndPersist();
}
