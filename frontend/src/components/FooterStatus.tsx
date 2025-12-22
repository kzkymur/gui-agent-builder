import React, { useEffect, useMemo, useState } from "react";
import type { Node } from "reactflow";
import MarkdownView from "./MarkdownView";
import type { NodeData } from "../types";
import { useEngineStore } from "../engine/store";

export default function FooterStatus({ nodes }: { nodes: Node<NodeData>[] }) {
  const latestOutputByNode = useEngineStore((s) => s.latestOutputByNode);
  const run = useEngineStore((s) => s.run);
  const tokenUsageTotal = useEngineStore((s) => s.tokenUsageTotal);

  const [now, setNow] = useState<number>(() => Date.now());
  useEffect(() => {
    if (run.status !== "running" || !run.startedAt) return;
    const t = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(t);
  }, [run.status, run.startedAt]);
  const durationMs = run.startedAt
    ? Math.max(0, (run.endedAt ?? now) - run.startedAt)
    : undefined;
  const durationLabel = durationMs != null ? `${(durationMs / 1000).toFixed(2)}s` : "—";

  const endSummaries = useMemo(() => {
    const ends = nodes.filter((n) => n.type === "end");
    const parts: string[] = [];
    for (const n of ends) {
      let val: any = latestOutputByNode[n.id];
      if (val && typeof val === "object" && !Array.isArray(val) && "value" in val) {
        val = (val as any).value;
      }
      if (typeof val === "undefined") continue;
      let pretty: string;
      if (typeof val === "string") pretty = val;
      else {
        try { pretty = JSON.stringify(val, null, 2); } catch { pretty = String(val); }
      }
      const name = (n.data as any)?.name || "End";
      parts.push(`${name}:\n\n${pretty}`);
    }
    return parts;
  }, [nodes, latestOutputByNode]);

  return (
    <footer className="app__footer" aria-live="polite">
      <div
        style={{ display: "flex", gap: 24, alignItems: "flex-start", overflowX: "auto" }}
      >
        <div style={{ whiteSpace: "nowrap", color: "var(--muted)" }}>
          Tokens: <strong>{tokenUsageTotal || 0}</strong> · Time: <strong>{durationLabel}</strong>
        </div>
        {endSummaries.length ? (
          <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
            {endSummaries.map((md, i) => (
              <div key={i} style={{ minWidth: 0 }}>
                <MarkdownView text={md} />
              </div>
            ))}
          </div>
        ) : (
          <div>Run the flow; End node outputs will appear here</div>
        )}
      </div>
    </footer>
  );
}

