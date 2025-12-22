import React from "react";
import { Text, TextField } from "@radix-ui/themes";
import type { NodeData, MCPData } from "../../types";
import { useEngineStore } from "../../engine/store";

export default function MCPPanel({ draft, onPatch }: { draft: NodeData; onPatch: (p: Partial<MCPData>) => void }) {
  const isBusy = useEngineStore((s) => s.activeRunning.size > 0);
  return (
    <>
      <label className="field">
        <Text as="span" weight="medium">URL</Text>
        <TextField.Root
          value={(draft as MCPData).url ?? ""}
          onChange={(e) => onPatch({ url: (e.target as HTMLInputElement).value })}
          disabled={isBusy}
        />
      </label>
      <label className="field">
        <Text as="span" weight="medium">Token</Text>
        <TextField.Root
          value={(draft as MCPData).token ?? ""}
          onChange={(e) => onPatch({ token: (e.target as HTMLInputElement).value })}
          disabled={isBusy}
        />
      </label>
    </>
  );
}

