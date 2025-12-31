import React from "react";
import { Handle, Position } from "reactflow";

type Mode =
  | "normal"
  | "holding"
  | "optional"
  | "optional_holding"
  | string
  | undefined;

export type ColoredHandleProps = {
  id: string;
  type: "source" | "target";
  position: Position;
  // Accept explicit undefined; callers may forward possibly-undefined values.
  mode: Mode | undefined;
  trigger: boolean | undefined;
  /** For nodes where required-ness is fixed (e.g., Switch). If set, overrides mode-derived required. */
  requiredOverride?: boolean;
  className?: string;
};

function computeColors(required: boolean, holding: boolean, trigger: boolean) {
  const r = required ? 255 : 0;
  // Tone down green channel to reduce visual brightness
  const g = holding ? 170 : 0;
  const b = trigger ? 255 : 0;
  const border = `rgb(${r}, ${g}, ${b})`;
  return { border };
}

export default function ColoredHandle({
  id,
  type,
  position,
  mode,
  trigger,
  requiredOverride,
  className,
}: ColoredHandleProps) {
  const m = String(mode ?? "normal");
  const required =
    typeof requiredOverride === "boolean"
      ? requiredOverride
      : !(m === "optional" || m === "optional_holding");
  const holding = m === "holding" || m === "optional_holding";
  const trig = trigger !== false;
  const { border } = computeColors(required, holding, trig);

  return (
    <Handle
      id={id}
      type={type}
      position={position}
      className={className}
      style={{ background: "#000", borderColor: border, borderWidth: 2 }}
    />
  );
}
