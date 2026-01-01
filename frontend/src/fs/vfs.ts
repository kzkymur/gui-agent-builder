import { initDB } from "../db/sqlite";

type EntryType = "file" | "dir";

export type VfsEntry = { path: string; type: EntryType; size?: number };

/**
 * Simple virtual filesystem stored in sqlite-wasm under table `fs_entries`.
 * Paths are POSIX-like and rooted (e.g., "/", "/docs/readme.txt").
 */
export class VFS {
  private static ensured = false;
  private static async ensureSchema() {
    if (VFS.ensured) return;
    const db = await initDB();
    db.exec(`
      BEGIN;
      CREATE TABLE IF NOT EXISTS fs_entries (
        path TEXT PRIMARY KEY,
        type TEXT NOT NULL,        -- 'file' | 'dir'
        content TEXT               -- null for dir
      );
      COMMIT;
    `);
    VFS.ensured = true;
  }

  static async listDirectory(dir: string): Promise<VfsEntry[]> {
    await VFS.ensureSchema();
    const db = await initDB();
    const norm = VFS.normalize(dir);
    const res = db.exec("SELECT path, type, content FROM fs_entries")
      .flatMap((r) => r.values);
    const children: Record<string, VfsEntry> = {};
    for (const [pRaw, tRaw, c] of res) {
      const p = String(pRaw);
      const t = String(tRaw) as EntryType;
      if (!p.startsWith(norm === "/" ? "/" : norm + "/")) continue;
      const rest = p.slice(norm.length === 1 ? 1 : norm.length + 1);
      if (!rest) continue; // the directory itself
      const first = rest.split("/")[0];
      const childPath = norm === "/" ? `/${first}` : `${norm}/${first}`;
      if (!children[childPath]) {
        children[childPath] = {
          path: childPath,
          type: rest.includes("/") ? "dir" : t,
          size: t === "file" && !rest.includes("/") && typeof c === "string" ? c.length : undefined,
        };
      }
    }
    // Ensure root exists even when empty
    if (norm === "/" && Object.keys(children).length === 0) {
      return [];
    }
    return Object.values(children).sort((a, b) => a.path.localeCompare(b.path));
  }

  static async readFile(path: string): Promise<string> {
    await VFS.ensureSchema();
    const db = await initDB();
    const p = VFS.normalize(path);
    const safe = p.replaceAll("'", "''");
    const res = db.exec(`SELECT content FROM fs_entries WHERE path='${safe}' AND type='file'`);
    if (!res.length || !res[0].values.length) throw new Error("File not found");
    const [content] = res[0].values[0];
    return String(content ?? "");
  }

  static async writeFile(path: string, content: string): Promise<void> {
    await VFS.ensureSchema();
    const db = await initDB();
    const p = VFS.normalize(path);
    // ensure parent directories exist as virtual entries
    const parts = p.split("/").filter(Boolean);
    let acc = "";
    for (let i = 0; i < parts.length - 1; i++) {
      acc = acc ? `${acc}/${parts[i]}` : `/${parts[i]}`;
      db.exec(
        `INSERT OR IGNORE INTO fs_entries(path, type, content) VALUES('${acc.replaceAll("'","''")}', 'dir', NULL)`,
      );
    }
    const stmt = db.prepare(
      "INSERT INTO fs_entries(path, type, content) VALUES(?, 'file', ?) ON CONFLICT(path) DO UPDATE SET content=excluded.content, type='file'",
    );
    stmt.run([p, content]);
    stmt.free();
  }

  static async deleteFile(path: string): Promise<void> {
    await VFS.ensureSchema();
    const db = await initDB();
    const p = VFS.normalize(path);
    const safe = p.replaceAll("'", "''");
    db.exec(`DELETE FROM fs_entries WHERE path='${safe}' AND type='file'`);
  }

  static async renameFile(oldPath: string, newPath: string): Promise<void> {
    await VFS.ensureSchema();
    const db = await initDB();
    const src = VFS.normalize(oldPath);
    const dst = VFS.normalize(newPath);
    if (src === dst) return;
    // ensure parent directories for destination
    const parts = dst.split("/").filter(Boolean);
    let acc = "";
    for (let i = 0; i < parts.length - 1; i++) {
      acc = acc ? `${acc}/${parts[i]}` : `/${parts[i]}`;
      db.exec(
        `INSERT OR IGNORE INTO fs_entries(path, type, content) VALUES('${acc.replaceAll("'","''")}', 'dir', NULL)`,
      );
    }
    const s = src.replaceAll("'", "''");
    const d = dst.replaceAll("'", "''");
    // Overwrite if exists at destination
    db.exec(`DELETE FROM fs_entries WHERE path='${d}' AND type='file'`);
    db.exec(`UPDATE fs_entries SET path='${d}' WHERE path='${s}' AND type='file'`);
  }

  private static normalize(p: string): string {
    if (!p || p === "/") return "/";
    let s = p.replaceAll(/\\/g, "/");
    if (!s.startsWith("/")) s = "/" + s;
    // collapse // and trailing /
    s = s.replace(/\/+/, "/");
    if (s.length > 1 && s.endsWith("/")) s = s.slice(0, -1);
    return s;
  }
}
