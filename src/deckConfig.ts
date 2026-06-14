import type { DeckButtonConfig } from "./types";

/** Default 3x5 (15 button) layout with placeholder macros for the MVP. */
export const DEFAULT_BUTTONS: DeckButtonConfig[] = Array.from({ length: 15 }, (_, i) => {
  const n = i + 1;
  return {
    id: `btn_${n}`,
    label: `Button ${n}`,
    macro: [
      { type: "Delay", ms: 0 },
      { type: "KeyPress", keys: ["Control", "Shift", String(((n - 1) % 9) + 1)] },
    ],
  };
});
