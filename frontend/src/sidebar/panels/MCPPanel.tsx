import { Text, TextField } from "@radix-ui/themes";
import React from "react";
import { useEngineStore } from "../../engine/store";
import type { MCPData, NodeData } from "../../types";

export default function MCPPanel({
  draft,
  onPatch,
}: { draft: NodeData; onPatch: (p: Partial<MCPData>) => void }) {
  const isBusy = useEngineStore((s) => s.activeRunning.size > 0);
  return (
    <>
      <div className="field">
        <Text as="span" weight="medium">
          URL
        </Text>
        <TextField.Root
          value={(draft as MCPData).url ?? ""}
          onChange={(e) => onPatch({ url: (e.target as HTMLInputElement).value })}
          disabled={isBusy}
        />
      </div>
      <div className="field">
        <Text as="span" weight="medium">
          Token
        </Text>
        <TextField.Root
          value={(draft as MCPData).token ?? ""}
          onChange={(e) => onPatch({ token: (e.target as HTMLInputElement).value })}
          disabled={isBusy}
        />
      </div>
    </>
  );
}
