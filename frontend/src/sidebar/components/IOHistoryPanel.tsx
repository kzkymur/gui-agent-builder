import { Button, Text, Switch } from "@radix-ui/themes";
import React from "react";
import { listNodeIO, clearNodeIO, type NodeIORecord } from "../../db/sqlite";

export default function IOHistoryPanel({ nodeId }: { nodeId: string }) {
  const [rows, setRows] = React.useState<NodeIORecord[]>([]);
  const [limit, setLimit] = React.useState(20);
  const [pretty, setPretty] = React.useState(true);

  const refresh = React.useCallback(() => {
    try {
      setRows(listNodeIO(nodeId, limit));
    } catch {
      setRows([]);
    }
  }, [nodeId, limit]);

  React.useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodeId, limit]);

  return (
    <div className="io-history" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "space-between" }}>
        <Text as="div" weight="medium">I/O History</Text>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--gray-11)" }}>
            <span>{pretty ? "Pretty" : "Raw JSON"}</span>
            <Switch checked={pretty} onCheckedChange={(v) => setPretty(Boolean(v))} />
          </label>
          <Button size="1" variant="soft" onClick={() => refresh()}>Refresh</Button>
          <Button size="1" variant="soft" onClick={() => setLimit((n) => Math.min(100, n + 20))}>Load more</Button>
          <Button size="1" variant="solid" color="red" onClick={() => {
            if (confirm('Clear all logs for this node?')) { try { clearNodeIO(nodeId); refresh(); } catch {}
            }
          }}>Clear all logs</Button>
        </div>
      </div>
      {rows.length === 0 && (
        <div style={{ color: "var(--gray-11)", fontSize: 12 }}>No history yet for this node.</div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {rows.map((r) => (
          <details key={r.id} className="io-item" style={{ border: "1px solid var(--gray-6)", borderRadius: 6, padding: 8, width: "100%" }}>
            <summary style={{ cursor: "pointer" }}>
              <span style={{ fontWeight: 500 }}>{new Date(r.ts ?? 0).toLocaleString()}</span>
              <span style={{ marginLeft: 8, color: "var(--gray-11)", fontSize: 12 }}>run: {r.runId ?? "-"}</span>
              <span style={{ marginLeft: 8, color: "var(--gray-11)", fontSize: 12 }}>trace: {r.traceId ?? "-"}</span>
            </summary>
            <div className="io-sections" style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 10, width: "100%" }}>
              <section>
                <Text as="div" weight="medium">Input</Text>
                {pretty ? <Pretty value={r.input} /> : <pre className="io-pre">{formatJSON(r.input)}</pre>}
              </section>
              <section>
                <Text as="div" weight="medium">Output</Text>
                {pretty ? <Pretty value={r.output} /> : <pre className="io-pre">{formatJSON(r.output)}</pre>}
              </section>
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}

function formatJSON(v: unknown): string {
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
}

function Pretty({ value }: { value: unknown }) {
  return (
    <div className="io-pre pretty" style={{ padding: 10 }}>
      {renderValue(value, 0)}
    </div>
  );
}

function isPlainObject(x: unknown): x is Record<string, unknown> {
  return !!x && typeof x === "object" && Object.getPrototypeOf(x) === Object.prototype;
}

function renderValue(v: unknown, depth: number): React.ReactNode {
  if (v == null) return <span style={{ color: "var(--gray-11)" }}>null</span>;
  if (typeof v === "string") {
    return <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.5 }}>{v}</div>;
  }
  if (typeof v === "number" || typeof v === "boolean") {
    return <code>{String(v)}</code>;
  }
  if (Array.isArray(v)) {
    if (v.length === 0) return <span style={{ color: "var(--gray-11)" }}>(empty list)</span>;
    return (
      <ol className="io-list" style={{ margin: 0, paddingLeft: 18 }}>
        {v.map((item, i) => (
          <li key={i} style={{ margin: "4px 0" }}>
            {renderValue(item, depth + 1)}
          </li>
        ))}
      </ol>
    );
  }
  if (isPlainObject(v)) {
    const entries = Object.entries(v);
    if (entries.length === 0) return <span style={{ color: "var(--gray-11)" }}>(empty object)</span>;
    return (
      <div className="io-kv">
        {entries.map(([k, val]) => (
          <div className="io-kv-row" key={k}>
            <div className="io-k">{k}</div>
            <div className="io-v">{renderValue(val, depth + 1)}</div>
          </div>
        ))}
      </div>
    );
  }
  // Fallback to JSON
  return <pre className="io-pre" style={{ margin: 0 }}>{formatJSON(v)}</pre>;
}
